// Recherche-Dienst (29.10.2026): läuft per launchd auf dem Mac einer Person und macht aus „Recherche starten“ im CRM einen
// arbeitenden ChatGPT-Agenten. Alle 10 s fragt er das CRM nach angeforderten Läufen (agent_status 'wartet' oder 'antwort'),
// startet Codex aus der ChatGPT-App (codex exec, Chrome-Plugin, CRM-Werkzeuge aus crm-mcp.mjs) mit dem Auftrag des Laufs und
// meldet das Ergebnis der Runde zurück: „Fertig:“/„Abbruch:“ beenden, alles andere ist eine Frage an die Person (Freigabe im
// CRM) – deren Antwort setzt dieselbe Codex-Sitzung fort. Pause oder Ende im CRM stoppt den Agenten.
// Einrichten: Befehl aus dem CRM (Laufseite → „Recherche-Dienst einrichten“) · Protokolle: ~/Library/Logs/steinerundco-recherche/
// Umgebung: CODEX_BIN, RECHERCHE_EFFORT (high), RECHERCHE_MODELL (Codex-Standard), RECHERCHE_PROBE=1 (Funktionstest ohne LinkedIn)
import { execFile, execFileSync, spawn } from 'node:child_process'
import { createWriteStream, mkdirSync } from 'node:fs'
import { hostname } from 'node:os'
import { join } from 'node:path'
import { BASIS, dienst, LOGS } from './gemeinsam.mjs'

const VERSION = '2026-10-29'
const CODEX = process.env.CODEX_BIN || '/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex'
const EFFORT = process.env.RECHERCHE_EFFORT || 'high'
const MODELL = process.env.RECHERCHE_MODELL || ''
const PROBE = process.env.RECHERCHE_PROBE === '1'
const ARBEIT = join(BASIS, 'arbeitsordner')
const TAKT_MS = 10_000
const STUMM_MS = 10 * 60_000 // ohne Ausgabe so lange → keine Lebenszeichen mehr („antwortet nicht“ im CRM)

const RECHNER = (() => {
  try {
    return execFileSync('/usr/sbin/scutil', ['--get', 'ComputerName'], { encoding: 'utf8' }).trim().slice(0, 100)
  } catch {
    return hostname()
      .replace(/\.local$/, '')
      .slice(0, 100)
  }
})()

const log = (...t) => console.log(new Date().toISOString(), ...t)
const kuerzen = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const toml = (s) => `"${String(s).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`

/** Mitteilung oben rechts – eine Freigabe soll nicht erst beim nächsten Blick ins CRM auffallen. */
function mitteilen(text) {
  execFile(
    '/usr/bin/osascript',
    [
      '-e',
      'on run argv',
      '-e',
      'display notification (item 1 of argv) with title "LinkedIn-Recherche"',
      '-e',
      'end run',
      text,
    ],
    () => {},
  )
}

const probeAuftrag = () =>
  [
    'Funktionstest des Recherche-Diensts – ohne LinkedIn.',
    '1. Rufe das Werkzeug lauf_status des MCP-Servers crm auf.',
    '2. Öffne in Chrome https://www.turmundleufer.de in einem neuen Tab, lies den Seitentitel und schließe den Tab wieder. Öffne keine andere Seite und klicke nichts an.',
    '3. Beende deine Antwort mit genau zwei Zeilen: „Freigabe nötig: Probelauf fortsetzen“ und „Status <status aus lauf_status> · Titel <Seitentitel>“.',
    'Kommt danach „Freigegeben.“, antworte nur mit „Fertig: Probelauf ok“ und den beiden Werten.',
  ].join('\n')

/** laufende Agenten: Lauf-ID → Zustand */
const agenten = new Map()

async function starten(lauf) {
  const u = await dienst('uebernehmen', { lauf: lauf.id, rechner: RECHNER, version: VERSION })
  if (!u.ok) return // anderer Mac war schneller oder Lauf inzwischen pausiert
  const weiter = u.art === 'weiter'
  const auftrag = weiter ? `Antwort aus dem CRM: ${u.antwort}` : PROBE ? probeAuftrag() : u.auftrag
  if (!auftrag) {
    await dienst('melden', {
      lauf: lauf.id,
      agent_status: 'fehler',
      meldung: 'Am Lauf fehlt der Auftrag – im CRM „Agent neu starten“.',
    })
    return
  }
  mkdirSync(ARBEIT, { recursive: true })
  mkdirSync(LOGS, { recursive: true })
  const mcp =
    `mcp_servers.crm={command=${toml(process.execPath)}, args=[${toml(join(BASIS, 'crm-mcp.mjs'))}], ` +
    `env={RECHERCHE_LAUF=${toml(lauf.id)}}, default_tools_approval_mode="approve"}`
  const gemeinsam = [
    '--json',
    '--skip-git-repo-check',
    '-c',
    `model_reasoning_effort=${toml(EFFORT)}`,
    '-c',
    'web_search="live"',
    '-c',
    mcp,
  ]
  if (MODELL) gemeinsam.push('-m', MODELL)
  const args = weiter
    ? ['exec', 'resume', u.sitzung, ...gemeinsam, '-']
    : ['exec', ...gemeinsam, '-s', 'read-only', '-C', ARBEIT, '-']
  const datei = join(
    LOGS,
    `${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}_${lauf.id.slice(0, 8)}_${u.starts}.jsonl`,
  )
  const ausgabe = createWriteStream(datei, { flags: 'a' })
  const kind = spawn(CODEX, args, { cwd: ARBEIT, stdio: ['pipe', 'pipe', 'pipe'] })
  const a = {
    kind,
    datei,
    letzteAusgabe: Date.now(),
    sitzung: u.sitzung ?? null,
    letzte: '',
    fehler: '',
    stoppGrund: null,
    rest: '',
  }
  agenten.set(lauf.id, a)
  kind.stdin.end(auftrag)

  // codex exec --json: eine Zeile je Ereignis; zählt nur die letzte Agentennachricht der Runde
  const zeileLesen = (z) => {
    if (!z.trim()) return
    let o
    try {
      o = JSON.parse(z)
    } catch {
      return
    }
    if (o.type === 'thread.started' && o.thread_id && o.thread_id !== a.sitzung) {
      a.sitzung = o.thread_id
      void dienst('sitzung', { lauf: lauf.id, sitzung: a.sitzung }).catch(() => {})
    } else if (o.type === 'item.completed' && o.item?.type === 'agent_message') a.letzte = String(o.item.text ?? '')
    else if (o.type === 'turn.failed' || o.type === 'error')
      a.fehler = String(o.error?.message ?? o.message ?? 'Fehler')
  }
  kind.stdout.on('data', (b) => {
    ausgabe.write(b)
    a.letzteAusgabe = Date.now()
    const zeilen = (a.rest + b.toString('utf8')).split('\n')
    a.rest = zeilen.pop() ?? ''
    zeilen.forEach(zeileLesen)
  })
  kind.stderr.on('data', (b) => ausgabe.write(b))
  kind.on('error', (e) => log('Agent-Fehler', lauf.id, e.message))
  kind.on('close', (code, signal) => {
    zeileLesen(a.rest)
    void beendet(lauf.id, a, code, signal).finally(() => ausgabe.end())
  })
  log(
    `Agent ${u.starts}${weiter ? ' (Fortsetzung)' : ''} für Lauf ${lauf.id} gestartet${PROBE ? ' – Probe' : ''} → ${datei}`,
  )
}

async function beendet(id, a, code, signal) {
  agenten.delete(id)
  const letzte = a.letzte.trim()
  let status
  let meldung = ''
  let frage = null
  if (/^Fertig:/i.test(letzte)) [status, meldung] = ['beendet', letzte]
  else if (/^Abbruch:/i.test(letzte)) [status, meldung] = ['fehler', letzte]
  else if (a.stoppGrund) [status, meldung] = ['beendet', a.stoppGrund]
  else if (letzte && code === 0) [status, frage] = ['frage', letzte]
  else
    [status, meldung] = [
      'fehler',
      a.fehler || `Agent unerwartet beendet (${signal ?? `Code ${code}`}). Protokoll auf ${RECHNER}: ${a.datei}`,
    ]
  log(`Runde für Lauf ${id} beendet: ${status} · ${kuerzen((frage ?? meldung).replace(/\s+/g, ' '), 200)}`)
  if (status === 'frage') mitteilen(kuerzen(frage.split('\n')[0], 120))
  for (let i = 1; i <= 4; i++) {
    try {
      await dienst('melden', {
        lauf: id,
        agent_status: status,
        meldung: kuerzen(meldung, 1900),
        frage,
        sitzung: a.sitzung,
      })
      return
    } catch (e) {
      if (i === 4) log('Ende nicht gemeldet', id, e.message)
      else await new Promise((r) => setTimeout(r, 5000 * i))
    }
  }
}

const STOPP_TEXT = {
  pausiert: 'Lauf pausiert – Agent gestoppt.',
  abgebrochen: 'Lauf beendet – Agent gestoppt.',
  abgeschlossen: 'Lauf abgeschlossen.',
  fehler: 'Lauf wegen einer Einschränkung angehalten – Agent gestoppt.',
}

function stoppen(id, status) {
  const a = agenten.get(id)
  if (!a || a.stoppGrund) return
  a.stoppGrund = STOPP_TEXT[status] ?? 'Agent gestoppt.'
  // Pause/Abbruch durch die Person sofort; bei Ziel erreicht oder gemeldeter Einschränkung darf der Agent seinen Bericht schreiben
  const frist = status === 'pausiert' || status === 'abgebrochen' ? 0 : 30_000
  setTimeout(() => {
    if (a.kind.exitCode !== null) return
    a.kind.kill('SIGTERM')
    setTimeout(() => a.kind.exitCode === null && a.kind.kill('SIGKILL'), 10_000)
  }, frist)
  log(`Lauf ${id} ist ${status} → Agent wird gestoppt`)
}

let takt = 0
async function durchgang() {
  takt++
  const { laeufe } = await dienst('abholen', { ids: [...agenten.keys()], rechner: RECHNER, version: VERSION })
  for (const l of laeufe) {
    if (agenten.has(l.id)) {
      if (l.status !== 'laeuft') stoppen(l.id, l.status)
    } else if (
      l.status === 'laeuft' &&
      (l.agent_status === 'wartet' || l.agent_status === 'antwort') &&
      agenten.size === 0
    ) {
      await starten(l)
    }
  }
  if (takt % 3 === 0) {
    const lebend = [...agenten.entries()].filter(([, a]) => !a.stoppGrund && Date.now() - a.letzteAusgabe < STUMM_MS)
    if (lebend.length) await dienst('lebenszeichen', { ids: lebend.map(([id]) => id) })
  }
}

async function main() {
  log(`Recherche-Dienst ${VERSION} bereit auf ${RECHNER}${PROBE ? ' (Probe)' : ''} · Codex: ${CODEX}`)
  await dienst('aufraeumen', {
    rechner: RECHNER,
    grund: 'Recherche-Dienst wurde neu gestartet – der Agent war unterbrochen. „Agent neu starten“ setzt fort.',
  }).catch((e) => log('Aufräumen fehlgeschlagen:', e.message))

  let ende = false
  const beenden = async (sig) => {
    if (ende) return
    ende = true
    log(`${sig} – Agenten werden gestoppt`)
    for (const a of agenten.values()) {
      a.stoppGrund = 'Recherche-Dienst gestoppt – „Agent neu starten“, sobald er wieder läuft.'
      a.kind.kill('SIGTERM')
    }
    await new Promise((r) => setTimeout(r, 4000))
    process.exit(0)
  }
  process.on('SIGTERM', () => void beenden('SIGTERM'))
  process.on('SIGINT', () => void beenden('SIGINT'))

  for (;;) {
    try {
      await durchgang()
    } catch (e) {
      log('Durchgang fehlgeschlagen:', e.message)
    }
    await new Promise((r) => setTimeout(r, TAKT_MS))
  }
}

main().catch((e) => {
  log('Abbruch:', e.message)
  process.exit(1)
})
