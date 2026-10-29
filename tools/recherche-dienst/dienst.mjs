#!/usr/bin/env node
// Recherche-Dienst (29.10.2026): läuft per launchd auf dem Mac einer Person und macht aus „Recherche starten“ im CRM einen
// arbeitenden Agenten. Er fragt alle 10 s nach angeforderten Läufen dieser Person (agent_status 'wartet', Migration 18), startet
// Claude Code mit Chrome (claude -p --chrome) und dem vollständigen Auftrag aus src/features/recherche/regeln.ts, meldet
// Lebenszeichen und Schlussbericht an den Lauf und stoppt den Agenten, sobald der Lauf pausiert oder beendet wird.
// Datenbank über die Management-API mit dem Token der Supabase CLI aus dem Schlüsselbund (wie tools/db-query.sh).
//
//   bash tools/recherche-dienst/einrichten.sh <member-id>     einrichten (launchd, kopiert Dienst + Regeln)
//   node tools/recherche-dienst/dienst.mjs --probe --einmal   Testlauf der Kette: Agent liest nur die Laufseite, kein LinkedIn
//
// Umgebung: RECHERCHE_MEMBER (Pflicht), RECHERCHE_MODELL (opus), RECHERCHE_BUDGET_USD (40), RECHERCHE_PROBE=1, CRM_URL, CLAUDE_BIN
import { execFileSync, spawn } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { homedir, hostname } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HIER = dirname(fileURLToPath(import.meta.url))
const ME = process.env.RECHERCHE_MEMBER ?? ''
const REF = process.env.SUPABASE_PROJECT_REF ?? 'ekaqkfgvisdngsskzbai'
const CRM_URL = (process.env.CRM_URL ?? 'https://crm.steinerundco.de').replace(/\/$/, '')
const MODELL = process.env.RECHERCHE_MODELL ?? 'opus'
const BUDGET = process.env.RECHERCHE_BUDGET_USD ?? '40'
const PROBE = process.argv.includes('--probe') || process.env.RECHERCHE_PROBE === '1'
const EINMAL = process.argv.includes('--einmal')
const TAKT_MS = 10_000
const STUMM_MS = 10 * 60_000 // ohne Ausgabe so lange → keine Lebenszeichen mehr („antwortet nicht“ im CRM)
const BASIS = join(homedir(), 'Library/Application Support/steinerundco-recherche')
const LOGS = join(homedir(), 'Library/Logs/steinerundco-recherche')
const REGELN = existsSync(join(HIER, 'regeln.ts'))
  ? join(HIER, 'regeln.ts')
  : join(HIER, '../../src/features/recherche/regeln.ts')

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

// ---------------------------------------------------------------------------------------------------------------------
// Datenbank
// ---------------------------------------------------------------------------------------------------------------------
let token = null
function holeToken() {
  const roh = execFileSync(
    '/usr/bin/security',
    ['find-generic-password', '-s', 'Supabase CLI', '-a', 'supabase', '-w'],
    {
      encoding: 'utf8',
    },
  ).trim()
  return Buffer.from(roh.replace(/^go-keyring-base64:/, ''), 'base64').toString('utf8')
}

async function sql(query) {
  token ??= holeToken()
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(20_000),
  })
  const daten = await r.json().catch(() => null)
  if (!r.ok) {
    if (r.status === 401) token = null
    throw new Error(`Datenbank HTTP ${r.status}: ${daten?.message ?? ''}`)
  }
  return Array.isArray(daten) ? daten : []
}

const uuid = (x) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(x)))
    throw new Error(`Keine UUID: ${x}`)
  return `'${x}'`
}
const txt = (x) =>
  `'${String(x ?? '')
    .replaceAll('\0', '')
    .replaceAll("'", "''")}'`
const kuerzen = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/** Schreibt mit Wiederholung – Meldungen über das Agentenende dürfen nicht verloren gehen. */
async function schreiben(query, versuche = 4) {
  for (let i = 1; ; i++) {
    try {
      return await sql(query)
    } catch (e) {
      if (i >= versuche) throw e
      await new Promise((r) => setTimeout(r, 5000 * i))
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------------------------------------------------
/** Neuestes Claude Code der Desktop-App (die Homebrew-Version ist oft zu alt für die Chrome-Erweiterung). */
function claudeBin() {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN
  const app = join(homedir(), 'Library/Application Support/Claude/claude-code')
  const zahl = (v) => v.split('.').map(Number)
  const versionen = existsSync(app)
    ? readdirSync(app)
        .filter((v) => /^\d+\.\d+\.\d+$/.test(v))
        .sort((a, b) => {
          const [x, y] = [zahl(a), zahl(b)]
          return y[0] - x[0] || y[1] - x[1] || y[2] - x[2]
        })
    : []
  for (const v of versionen)
    for (const h of readdirSync(join(app, v))) {
      const p = join(app, v, h, 'claude.app/Contents/MacOS/claude')
      if (existsSync(p)) return p
    }
  return '/opt/homebrew/bin/claude'
}

const probeAuftrag = (url) =>
  `Kurzer Funktionstest des Recherche-Diensts, ohne LinkedIn: Öffne ${url} in einem neuen Tab, lies den Seitenkopf (Status) und die Überschrift im Abschnitt „Agent“, und schließe den Tab wieder. Öffne keine andere Seite und klicke nichts an. Antworte in einer Zeile: „Probelauf ok: <Status> · <Agent-Überschrift>“ – oder „Abbruch: <Grund>“, falls eine Anmeldemaske erscheint.`

const STOPP_TEXT = {
  pausiert: 'Lauf pausiert – Agent gestoppt.',
  abgebrochen: 'Lauf beendet – Agent gestoppt.',
  abgeschlossen: 'Lauf abgeschlossen.',
  fehler: 'Lauf wegen einer Einschränkung angehalten – Agent gestoppt.',
}

/** laufende Agenten: Lauf-ID → Zustand */
const agenten = new Map()

async function starten(lauf) {
  const geholt = await sql(
    `update crm.recherche_laeufe set agent_status = 'arbeitet', agent_rechner = ${txt(RECHNER)}, agent_heartbeat = now(),
       agent_starts = agent_starts + 1, agent_meldung = null
     where id = ${uuid(lauf.id)} and status = 'laeuft' and agent_status = 'wartet' returning id, agent_starts`,
  )
  if (!geholt.length) return // anderer Rechner war schneller oder Lauf inzwischen pausiert
  const nr = geholt[0].agent_starts
  try {
    const person =
      (await sql(`select display_name from crm.members where id = ${uuid(ME)}`))[0]?.display_name || 'Vincent'
    const regeln = await import(`${pathToFileURL(REGELN).href}?t=${Date.now()}`)
    const url = `${CRM_URL}/auftrag/recherche/${lauf.id}`
    const auftrag = PROBE
      ? probeAuftrag(url)
      : regeln.agentAuftrag({ url, person, ziel: lauf.ziel, gesendet: lauf.gesendet })
    const werkzeuge = PROBE ? 'mcp__claude-in-chrome__*' : 'mcp__claude-in-chrome__* WebSearch WebFetch'
    const bin = claudeBin()
    mkdirSync(join(BASIS, 'arbeitsordner'), { recursive: true })
    mkdirSync(LOGS, { recursive: true })
    const datei = join(
      LOGS,
      `${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}_${lauf.id.slice(0, 8)}_${nr}.jsonl`,
    )
    const ausgabe = createWriteStream(datei)
    const kind = spawn(
      bin,
      [
        '-p',
        '--chrome',
        '--model',
        MODELL,
        '--permission-mode',
        'dontAsk',
        '--allowedTools',
        werkzeuge,
        '--output-format',
        'stream-json',
        '--verbose',
        '--max-budget-usd',
        BUDGET,
      ],
      { cwd: join(BASIS, 'arbeitsordner'), stdio: ['pipe', 'pipe', 'pipe'] },
    )
    const a = { kind, datei, letzteAusgabe: Date.now(), ergebnis: null, stoppGrund: null, rest: '' }
    agenten.set(lauf.id, a)
    kind.stdin.end(auftrag)
    // stream-json: eine Zeile je Ereignis; das Schlussereignis (type result) trägt Bericht, Kosten und Abbruchgrund
    const zeileLesen = (z) => {
      if (!z.includes('"type":"result"')) return
      try {
        const o = JSON.parse(z)
        if (o.type === 'result') a.ergebnis = o
      } catch {
        /* keine vollständige JSON-Zeile */
      }
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
    log(`Agent ${nr} für Lauf ${lauf.id} gestartet (${PROBE ? 'Probe' : MODELL}, ${bin}) → ${datei}`)
  } catch (e) {
    agenten.delete(lauf.id)
    log('Start fehlgeschlagen', lauf.id, e.message)
    await schreiben(
      `update crm.recherche_laeufe set agent_status = 'fehler', agent_meldung = ${txt(kuerzen(`Agent konnte nicht starten: ${e.message}`, 1900))}
       where id = ${uuid(lauf.id)}`,
    ).catch(() => {})
  }
}

async function beendet(id, a, code, signal) {
  agenten.delete(id)
  const e = a.ergebnis
  let status = 'fehler'
  let meldung
  if (e?.subtype === 'success' && !e.is_error) {
    status = 'beendet'
    meldung = String(e.result ?? '').trim() || a.stoppGrund || 'Ohne Bericht beendet.'
  } else if (a.stoppGrund) {
    status = 'beendet'
    meldung = a.stoppGrund
  } else if (e && /budget/i.test(String(e.subtype))) {
    meldung = `Budgetgrenze von ${BUDGET} USD für diesen Agenten erreicht – „Agent neu starten“ setzt den Lauf fort.`
  } else if (e) {
    meldung = String(e.result ?? '').trim() || `Agent mit Fehler beendet (${e.subtype}).`
  } else {
    meldung = `Agent unerwartet beendet (${signal ?? `Code ${code}`}). Protokoll auf ${RECHNER}: ${a.datei}`
  }
  log(`Agent für Lauf ${id} beendet: ${status} · ${kuerzen(meldung.replace(/\s+/g, ' '), 200)}`)
  await schreiben(
    `update crm.recherche_laeufe set agent_status = ${txt(status)}, agent_meldung = ${txt(kuerzen(meldung, 1900))},
       agent_heartbeat = now() where id = ${uuid(id)} and agent_status = 'arbeitet'`,
  ).catch((err) => log('Ende nicht gemeldet', id, err.message))
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

// ---------------------------------------------------------------------------------------------------------------------
// Takt
// ---------------------------------------------------------------------------------------------------------------------
let takt = 0
async function durchgang() {
  takt++
  const ids = [...agenten.keys()]
  const laeufe = await sql(
    `select id, status, agent_status, ziel, gesendet from crm.recherche_laeufe
     where member_id = ${uuid(ME)} and ((status = 'laeuft' and agent_status = 'wartet')${ids.length ? ` or id in (${ids.map(uuid).join(', ')})` : ''})
     order by started_at`,
  )
  for (const l of laeufe) {
    if (agenten.has(l.id)) {
      if (l.status !== 'laeuft') stoppen(l.id, l.status)
      // „Agent neu starten“, während dieser noch lebt (z. B. nach Ruhezustand): ihn weiterlaufen lassen
      else if (l.agent_status === 'wartet')
        await sql(
          `update crm.recherche_laeufe set agent_status = 'arbeitet', agent_heartbeat = now() where id = ${uuid(l.id)}`,
        )
    } else if (l.status === 'laeuft' && l.agent_status === 'wartet' && agenten.size === 0) {
      await starten(l)
    }
  }
  // Lebenszeichen alle 30 s – nur solange der Agent etwas ausgibt
  if (takt % 3 === 0) {
    const lebend = [...agenten.entries()].filter(([, a]) => !a.stoppGrund && Date.now() - a.letzteAusgabe < STUMM_MS)
    if (lebend.length)
      await sql(
        `update crm.recherche_laeufe set agent_heartbeat = now()
         where id in (${lebend.map(([id]) => uuid(id)).join(', ')}) and agent_status = 'arbeitet'`,
      )
  }
}

async function aufraeumen(grund) {
  await schreiben(
    `update crm.recherche_laeufe set agent_status = 'beendet', agent_meldung = ${txt(grund)}
     where member_id = ${uuid(ME)} and agent_status = 'arbeitet' and agent_rechner = ${txt(RECHNER)}`,
    2,
  ).catch((e) => log('Aufräumen fehlgeschlagen', e.message))
}

async function main() {
  uuid(ME)
  log(`Recherche-Dienst bereit auf ${RECHNER} für Mitglied ${ME}${PROBE ? ' (Probe)' : ''} · Regeln: ${REGELN}`)
  await aufraeumen('Recherche-Dienst wurde neu gestartet – der Agent war unterbrochen. „Agent neu starten“ setzt fort.')

  let beenden = false
  const ende = async (sig) => {
    if (beenden) return
    beenden = true
    log(`${sig} – Agenten werden gestoppt`)
    for (const a of agenten.values()) {
      a.stoppGrund = 'Recherche-Dienst gestoppt.'
      a.kind.kill('SIGTERM')
    }
    await new Promise((r) => setTimeout(r, 3000))
    await aufraeumen('Recherche-Dienst gestoppt – „Agent neu starten“, sobald er wieder läuft.')
    process.exit(0)
  }
  process.on('SIGTERM', () => void ende('SIGTERM'))
  process.on('SIGINT', () => void ende('SIGINT'))

  for (;;) {
    try {
      await durchgang()
    } catch (e) {
      log('Durchgang fehlgeschlagen:', e.message)
    }
    if (EINMAL && takt >= 1 && agenten.size === 0) break
    await new Promise((r) => setTimeout(r, TAKT_MS))
  }
  log('Fertig (--einmal).')
}

if (!ME) {
  console.error('RECHERCHE_MEMBER fehlt (Mitglieds-ID aus crm.members).')
  process.exit(2)
}
main().catch((e) => {
  log('Abbruch:', e.message)
  process.exit(1)
})
