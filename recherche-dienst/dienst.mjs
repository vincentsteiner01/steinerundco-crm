// Recherche-Dienst (29.10.2026): läuft per launchd auf dem Mac einer Person – unter Windows (30.10.2026) per Autostart-Eintrag
// aus einrichten.ps1 – und macht aus „Recherche starten“ im CRM einen
// arbeitenden ChatGPT-Agenten. Alle 10 s fragt er das CRM nach angeforderten Läufen (agent_status 'wartet' oder 'antwort'),
// startet Codex aus der ChatGPT-App (codex exec, Chrome-Plugin, CRM-Werkzeuge aus crm-mcp.mjs) mit dem Auftrag des Laufs und
// meldet das Ergebnis der Runde zurück: „Fertig:“/„Abbruch:“ beenden, alles andere ist eine Frage an die Person (Freigabe im
// CRM) – deren Antwort setzt dieselbe Sitzung fort. Pause oder Ende im CRM stoppt den Agenten.
// Claude als Ersatz (30.10.2026, Migration 20): Meldet Codex das Nutzungslimit von ChatGPT und ist der Schalter im CRM an, übernimmt
// Claude Code der Claude-Desktop-App (Claude in Chrome, dieselben CRM-Werkzeuge) den Lauf mit einer Übergabe – Auftrag, Stand aus
// lauf_status, zuletzt beantwortete Frage samt Freigabe. Bis das Limit abläuft, starten neue Runden gleich mit Claude.
// Windows: Codex kommt aus der ChatGPT-App für Windows – den Pfad trägt die App in ihr Computer-Use-Plugin ein (CODEX_CLI_PATH in
// %USERPROFILE%\.codex\plugins\cache\openai-bundled\unified-computer-use\<version>\.mcp.json) und ändert ihn bei jedem Update.
// Einrichten: Befehl aus dem CRM (Laufseite → „Recherche-Dienst einrichten“) · Protokolle: ~/Library/Logs/steinerundco-recherche/
// bzw. %LOCALAPPDATA%\steinerundco-recherche\logs\
// Umgebung: CODEX_BIN, CLAUDE_BIN (sonst neueste Version der Claude-App), RECHERCHE_EFFORT (high), RECHERCHE_MODELL (Codex-Standard),
// RECHERCHE_CLAUDE_MODELL (opus), RECHERCHE_PROBE=1 (Funktionstest ohne LinkedIn), RECHERCHE_LIMIT_PROBE=1 (ChatGPT gilt als gesperrt)
import { execFile, execFileSync, spawn } from 'node:child_process'
import { appendFileSync, createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir, hostname } from 'node:os'
import { join } from 'node:path'
import { BASIS, dienst, LOGS, WINDOWS } from './gemeinsam.mjs'

const VERSION = '2026-10-30'
const EFFORT = process.env.RECHERCHE_EFFORT || 'high'
const MODELL = process.env.RECHERCHE_MODELL || ''
const CLAUDE_MODELL = process.env.RECHERCHE_CLAUDE_MODELL || 'opus'
const PROBE = process.env.RECHERCHE_PROBE === '1'
const ARBEIT = join(BASIS, 'arbeitsordner')
const TAKT_MS = 10_000
const STUMM_MS = 10 * 60_000 // ohne Ausgabe so lange → keine Lebenszeichen mehr („antwortet nicht“ im CRM)
const LIMIT = /usage limit|hit your limit|purchase more credits/i

const RECHNER = (() => {
  try {
    if (WINDOWS) throw new Error('kein scutil')
    return execFileSync('/usr/sbin/scutil', ['--get', 'ComputerName'], { encoding: 'utf8' }).trim().slice(0, 100)
  } catch {
    return hostname()
      .replace(/\.local$/, '')
      .slice(0, 100)
  }
})()

// Unter Windows läuft der Dienst ohne Fenster – das Protokoll schreibt er selbst (auf dem Mac leitet launchd die Ausgabe um)
const LOGDATEI = WINDOWS ? join(LOGS, 'dienst.log') : null
if (LOGDATEI) mkdirSync(LOGS, { recursive: true })
const log = (...t) => {
  const zeile = [new Date().toISOString(), ...t].join(' ')
  console.log(zeile)
  if (LOGDATEI)
    try {
      appendFileSync(LOGDATEI, `${zeile}\n`)
    } catch {
      /* Protokoll ist Beiwerk */
    }
}

/** Codex: Mac aus der ChatGPT-App (CODEX_BIN aus einrichten.sh), Windows aus dem Computer-Use-Plugin der ChatGPT-App. */
function codexBin() {
  if (!WINDOWS) return process.env.CODEX_BIN || '/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex'
  const ordner = join(
    process.env.CODEX_HOME || join(homedir(), '.codex'),
    'plugins',
    'cache',
    'openai-bundled',
    'unified-computer-use',
  )
  try {
    const neueste = readdirSync(ordner)
      .map((v) => join(ordner, v, '.mcp.json'))
      .filter((f) => existsSync(f))
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0]
    const pfad = neueste && JSON.parse(readFileSync(neueste, 'utf8')).mcpServers?.cua_repl?.env?.CODEX_CLI_PATH
    if (pfad && existsSync(pfad)) return pfad
  } catch {
    /* Computer Use in der ChatGPT-App noch nicht eingerichtet */
  }
  return process.env.CODEX_BIN || 'codex.exe'
}

/** Agent samt Unterprozessen beenden – Windows kennt keine Signale, taskkill /T nimmt den ganzen Baum. */
function beenden(kind, signal = 'SIGTERM') {
  if (kind.exitCode !== null) return
  if (WINDOWS && kind.pid) execFile('taskkill', ['/PID', String(kind.pid), '/T', '/F'], { windowsHide: true }, () => {})
  else kind.kill(signal)
}
const kuerzen = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const toml = (s) => `"${String(s).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
const uhrzeit = (t) => new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

/**
 * Schlussnachricht ab der Kennzeile „Freigabe nötig:“, „Fertig:“ oder „Abbruch:“ – Claude schreibt gern erst eine
 * Zusammenfassung und setzt Markdown um die Kennung; das CRM erkennt die Freigabe nur am Anfang.
 */
function kern(text) {
  const zeilen = text.trim().split('\n')
  const i = zeilen.findIndex((z) => /^[\s*_#>]*(Freigabe nötig|Fertig|Abbruch):/i.test(z))
  if (i < 0) return text.trim()
  zeilen[i] = zeilen[i].replace(/^[\s*_#>]*(Freigabe nötig|Fertig|Abbruch):[*_]*\s*/i, '$1: ')
  return zeilen.slice(i).join('\n').trim()
}

/** Mitteilung oben rechts – eine Freigabe soll nicht erst beim nächsten Blick ins CRM auffallen. */
function mitteilen(text) {
  if (WINDOWS) {
    // Windows-Toast über PowerShell (Absender „Windows PowerShell“); der Text kommt per Umgebung, nie in den Befehl
    const ps = [
      '[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null',
      '$x = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)',
      "$t = $x.GetElementsByTagName('text')",
      "$t.Item(0).AppendChild($x.CreateTextNode('LinkedIn-Recherche')) > $null",
      '$t.Item(1).AppendChild($x.CreateTextNode($env:RECHERCHE_MITTEILUNG)) > $null',
      "[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe').Show([Windows.UI.Notifications.ToastNotification]::new($x))",
    ].join('; ')
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', ps],
      { windowsHide: true, env: { ...process.env, RECHERCHE_MITTEILUNG: text } },
      () => {},
    )
    return
  }
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

// ---- Claude Code (Ersatz) ----
/** Neuestes Claude Code der Claude-Desktop-App (die Homebrew-Version ist oft zu alt für Claude in Chrome). */
function claudeBin() {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN
  if (WINDOWS) {
    const p = join(homedir(), '.local', 'bin', 'claude.exe') // Installationsort von Claude Code unter Windows
    return existsSync(p) ? p : null
  }
  const app = join(homedir(), 'Library/Application Support/Claude/claude-code')
  if (!existsSync(app)) return null
  const zahl = (v) => v.split('.').map(Number)
  const versionen = readdirSync(app)
    .filter((v) => /^\d+\.\d+\.\d+$/.test(v))
    .sort((a, b) => {
      const [x, y] = [zahl(a), zahl(b)]
      return y[0] - x[0] || y[1] - x[1] || y[2] - x[2]
    })
  for (const v of versionen)
    for (const h of readdirSync(join(app, v))) {
      const p = join(app, v, h, 'claude.app/Contents/MacOS/claude')
      if (existsSync(p)) return p
    }
  return null
}

/** Ist Claude Code hier angemeldet? Alle 30 min neu geprüft; das CRM zeigt den Schalter nur dann. */
const claude = { bin: null, version: '', geprueft: 0, bekannt: false }
function claudePruefen() {
  if (Date.now() - claude.geprueft < 30 * 60_000) return
  claude.geprueft = Date.now()
  const bin = claudeBin()
  if (!bin) return Object.assign(claude, { bin: null, version: '', bekannt: true })
  execFile(bin, ['auth', 'status', '--json'], { timeout: 30_000, windowsHide: true }, (_fehler, aus) => {
    let an = false
    try {
      an = JSON.parse(aus).loggedIn === true
    } catch {
      /* nicht angemeldet oder alte Version */
    }
    Object.assign(claude, {
      bin: an ? bin : null,
      version: an ? (/claude-code\/([\d.]+)\//.exec(bin)?.[1] ?? 'angemeldet') : '',
      bekannt: true,
    })
  })
}

/** ChatGPT-Limit: bis wann (aus „try again at 7:17 PM“), damit neue Runden bis dahin gleich mit Claude starten. */
let chatgptGesperrt =
  process.env.RECHERCHE_LIMIT_PROBE === '1' ? { bis: Infinity, grund: 'Probe: ChatGPT gilt als gesperrt.' } : null
function limitEnde(text, jetzt = new Date()) {
  const m = /try again at (\d{1,2}):(\d{2})\s*([AP]M)?/i.exec(text)
  if (!m) return 0
  let h = Number(m[1])
  if (m[3]) h = (h % 12) + (/pm/i.test(m[3]) ? 12 : 0)
  const d = new Date(jetzt)
  d.setHours(h, Number(m[2]), 0, 0)
  if (d <= jetzt) d.setDate(d.getDate() + 1)
  return d.getTime()
}

const probeAuftrag = () =>
  [
    'Funktionstest des Recherche-Diensts – ohne LinkedIn.',
    '1. Rufe das Werkzeug lauf_status des MCP-Servers crm auf.',
    '2. Öffne in Chrome https://www.turmundleufer.de in einem neuen Tab, lies den Seitentitel und schließe den Tab wieder. Öffne keine andere Seite und klicke nichts an.',
    '3. Beende deine Antwort mit genau zwei Zeilen: „Freigabe nötig: Probelauf fortsetzen“ und „Status <status aus lauf_status> · Titel <Seitentitel>“.',
    'Kommt danach „Freigegeben.“, antworte nur mit „Fertig: Probelauf ok“ und den beiden Werten.',
  ].join('\n')

/** Auftrag für Claude, wenn es einen ChatGPT-Lauf übernimmt. */
function uebergabe(r, grund) {
  const z = [
    `Übergabe: Dieser Recherchelauf lief bisher mit ChatGPT.${grund ? ` ${grund}` : ''} Du übernimmst ihn ab hier mit demselben Auftrag (unten).`,
    '- Chrome bedienst du mit den Werkzeugen von Claude in Chrome – wo der Auftrag „Chrome-Plugin“ oder „ChatGPT for Chrome“ nennt, sind diese gemeint. Das CRM bedienst du mit den Werkzeugen des MCP-Servers crm.',
    '- Sind mehrere Chrome-Browser verbunden, frag nicht nach: nimm den mit „onThisComputer: true“, sonst den zuletzt verwendeten, den list_connected_browsers nennt (select_browser). Ist dort LinkedIn nicht angemeldet, nimm den anderen, bevor du abbrichst.',
    '- Was schon erledigt ist, steht in lauf_status (bearbeitete_profile): nichts doppelt bearbeiten, niemanden doppelt anfragen.',
    '- Deine Schlussnachricht beginnt direkt mit „Freigabe nötig: …“, „Frage: …“, „Fertig: …“ oder „Abbruch: …“ – ohne Text davor und ohne Markdown.',
  ]
  if (r.frage && r.antwort)
    z.push(
      '- Zuletzt hat ChatGPT diese Frage gestellt, die Antwort aus dem CRM gilt weiter. Eine Freigabe gilt für genau diese Liste, ohne erneute Rückfrage; wer davon in lauf_status schon gesendet ist oder auf LinkedIn „Ausstehend“ zeigt, ist erledigt.',
      '<<<',
      r.frage,
      '>>>',
      `Antwort aus dem CRM: ${r.antwort}`,
    )
  return [...z, '', PROBE ? probeAuftrag() : r.auftrag].join('\n')
}

/** laufende Agenten: Lauf-ID → Zustand */
const agenten = new Map()

async function starten(lauf) {
  const u = await dienst('uebernehmen', { lauf: lauf.id, rechner: RECHNER, version: VERSION })
  if (!u.ok) return // anderer Mac war schneller oder Lauf inzwischen pausiert
  const weiter = u.art === 'weiter'
  const runde = {
    lauf: lauf.id,
    starts: u.starts,
    auftrag: u.auftrag,
    frage: u.frage ?? null,
    antwort: u.antwort ?? null,
    ersatz: !!u.claude_ersatz,
  }
  const fehler = (meldung) => dienst('melden', { lauf: lauf.id, agent_status: 'fehler', meldung })
  if (!u.auftrag && !weiter && !PROBE) return fehler('Am Lauf fehlt der Auftrag – im CRM „Agent neu starten“.')

  if (u.anbieter === 'claude') {
    if (!claude.bin)
      return fehler('Claude Code ist auf diesem Mac nicht angemeldet – im CRM „Agent neu starten“ (mit ChatGPT).')
    return agentStarten(
      runde,
      'claude',
      weiter ? u.sitzung : null,
      weiter ? `Antwort aus dem CRM: ${u.antwort}` : uebergabe(runde, ''),
    )
  }
  if (chatgptGesperrt && Date.now() < chatgptGesperrt.bis && runde.ersatz && claude.bin)
    return wechseln(runde, chatgptGesperrt.grund)
  agentStarten(
    runde,
    'chatgpt',
    weiter ? u.sitzung : null,
    weiter ? `Antwort aus dem CRM: ${u.antwort}` : PROBE ? probeAuftrag() : u.auftrag,
  )
}

/** ChatGPT → Claude im selben Lauf (neue Sitzung, Agent arbeitet weiter). */
async function wechseln(runde, grund) {
  const w = await dienst('wechsel', { lauf: runde.lauf, meldung: `${grund} Claude macht weiter.` })
  if (!w.ok) return false
  log(`Lauf ${runde.lauf}: ${grund} → Claude übernimmt`)
  agentStarten(runde, 'claude', null, uebergabe(runde, grund))
  return true
}

// Codex reicht MCP-Servern nur wenige Umgebungsvariablen durch – unter Windows brauchen Node und PowerShell (DPAPI) mehr
const WINDOWS_UMGEBUNG = [
  'SystemRoot',
  'windir',
  'USERPROFILE',
  'LOCALAPPDATA',
  'APPDATA',
  'TEMP',
  'TMP',
  'PATH',
  'PATHEXT',
  'ComSpec',
]

function codexArgs(id, sitzung) {
  const umgebung = WINDOWS
    ? `env={RECHERCHE_LAUF=${toml(id)}, RECHERCHE_BASIS=${toml(BASIS)}}, env_vars=[${WINDOWS_UMGEBUNG.map(toml).join(', ')}]`
    : `env={RECHERCHE_LAUF=${toml(id)}}`
  const mcp =
    `mcp_servers.crm={command=${toml(process.execPath)}, args=[${toml(join(BASIS, 'crm-mcp.mjs'))}], ` +
    `${umgebung}, default_tools_approval_mode="approve"}`
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
  return sitzung
    ? ['exec', 'resume', sitzung, ...gemeinsam, '-']
    : ['exec', ...gemeinsam, '-s', 'read-only', '-C', ARBEIT, '-']
}

function claudeArgs(id, sitzung) {
  const mcp = {
    mcpServers: { crm: { command: process.execPath, args: [join(BASIS, 'crm-mcp.mjs')], env: { RECHERCHE_LAUF: id } } },
  }
  const args = [
    '-p',
    '--chrome',
    '--strict-mcp-config', // nur crm + Claude in Chrome – ohne die Connectoren des claude.ai-Kontos (sonst ~860k Token je Runde)
    '--disable-slash-commands',
    '--model',
    CLAUDE_MODELL,
    '--permission-mode',
    'dontAsk',
    '--tools',
    'WebSearch,WebFetch',
    '--allowedTools',
    'mcp__claude-in-chrome__* mcp__crm__* WebSearch WebFetch',
    '--mcp-config',
    JSON.stringify(mcp),
    '--output-format',
    'stream-json',
    '--verbose',
  ]
  if (sitzung) args.push('--resume', sitzung)
  return args
}

function agentStarten(runde, anbieter, sitzung, eingabe) {
  const id = runde.lauf
  mkdirSync(ARBEIT, { recursive: true })
  mkdirSync(LOGS, { recursive: true })
  const datei = join(
    LOGS,
    `${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}_${id.slice(0, 8)}_${runde.starts}${anbieter === 'claude' ? '_claude' : ''}.jsonl`,
  )
  const ausgabe = createWriteStream(datei, { flags: 'a' })
  const kind = spawn(
    anbieter === 'claude' ? claude.bin : codexBin(),
    (anbieter === 'claude' ? claudeArgs : codexArgs)(id, sitzung),
    {
      cwd: ARBEIT,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      env: anbieter === 'claude' ? { ...process.env, ENABLE_CLAUDEAI_MCP_SERVERS: 'false' } : process.env,
    },
  )
  const a = {
    kind,
    runde,
    anbieter,
    datei,
    letzteAusgabe: Date.now(),
    sitzung: sitzung ?? null,
    letzte: '',
    fehler: '',
    stoppGrund: null,
    rest: '',
  }
  agenten.set(id, a)
  kind.stdin.end(eingabe)

  const neueSitzung = (s) => {
    if (!s || s === a.sitzung) return
    a.sitzung = s
    void dienst('sitzung', { lauf: id, sitzung: s }).catch(() => {})
  }
  // eine JSON-Zeile je Ereignis; zählt nur die letzte Agentennachricht der Runde
  const zeileLesen = (z) => {
    if (!z.trim()) return
    let o
    try {
      o = JSON.parse(z)
    } catch {
      return
    }
    if (anbieter === 'claude') {
      if (o.session_id && (o.type === 'system' || o.type === 'result')) neueSitzung(o.session_id)
      if (o.type === 'result')
        if (o.is_error || o.subtype !== 'success') a.fehler = String(o.result || o.subtype || 'Fehler')
        else a.letzte = String(o.result ?? '')
    } else if (o.type === 'thread.started') neueSitzung(o.thread_id)
    else if (o.type === 'item.completed' && o.item?.type === 'agent_message') a.letzte = String(o.item.text ?? '')
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
  kind.on('error', (e) => {
    log('Agent-Fehler', id, e.message)
    a.fehler ||= `${anbieter === 'claude' ? 'Claude' : 'Codex'} startet nicht: ${e.message}` // „close“ folgt und meldet es
  })
  kind.on('close', (code, signal) => {
    zeileLesen(a.rest)
    void beendet(id, a, code, signal).finally(() => ausgabe.end())
  })
  log(
    `Agent ${runde.starts}${sitzung ? ' (Fortsetzung)' : ''} für Lauf ${id} gestartet – ${anbieter === 'claude' ? `Claude ${claude.version}` : 'ChatGPT'}${PROBE ? ', Probe' : ''} → ${datei}`,
  )
}

async function beendet(id, a, code, signal) {
  agenten.delete(id)
  if (a.anbieter === 'chatgpt' && !a.stoppGrund && LIMIT.test(a.fehler)) {
    const bis = limitEnde(a.fehler)
    const grund = `ChatGPT hat sein Nutzungslimit erreicht${bis ? ` (wieder ab ${uhrzeit(bis)} Uhr)` : ''}.`
    if (bis) chatgptGesperrt = { bis, grund }
    if (a.runde.ersatz && claude.bin)
      try {
        if (await wechseln(a.runde, grund)) return
      } catch (e) {
        log('Wechsel zu Claude fehlgeschlagen', id, e.message)
      }
    a.fehler = `${grund} ${claude.bin ? 'Claude als Ersatz ist im CRM ausgeschaltet.' : 'Kein angemeldetes Claude Code auf diesem Mac.'} Wortlaut: ${a.fehler}`
  }
  const letzte = kern(a.letzte)
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
    beenden(a.kind)
    setTimeout(() => beenden(a.kind, 'SIGKILL'), 10_000)
  }, frist)
  log(`Lauf ${id} ist ${status} → Agent wird gestoppt`)
}

let takt = 0
let verbunden = false
async function durchgang() {
  takt++
  claudePruefen()
  const { laeufe } = await dienst('abholen', {
    ids: [...agenten.keys()],
    rechner: RECHNER,
    version: VERSION,
    ...(claude.bekannt ? { claude: claude.version } : {}),
  })
  if (!verbunden) {
    verbunden = true
    log('Verbunden mit dem CRM') // einrichten.ps1 wartet auf diese Zeile
  }
  for (const l of laeufe) {
    if (agenten.has(l.id)) {
      if (l.status !== 'laeuft') stoppen(l.id, l.status)
    } else if (
      l.status === 'laeuft' &&
      (l.agent_status === 'wartet' || l.agent_status === 'antwort') &&
      agenten.size === 0 &&
      claude.bekannt // erst wenn feststeht, ob Claude als Ersatz bereitsteht
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
  log(
    `Recherche-Dienst ${VERSION} bereit auf ${RECHNER}${PROBE ? ' (Probe)' : ''} · Codex: ${codexBin()} · Claude: ${claudeBin() ?? '–'}`,
  )
  await dienst('aufraeumen', {
    rechner: RECHNER,
    grund: 'Recherche-Dienst wurde neu gestartet – der Agent war unterbrochen. „Agent neu starten“ setzt fort.',
  }).catch((e) => log('Aufräumen fehlgeschlagen:', e.message))

  let ende = false
  const herunterfahren = async (sig) => {
    if (ende) return
    ende = true
    log(`${sig} – Agenten werden gestoppt`)
    for (const a of agenten.values()) {
      a.stoppGrund = 'Recherche-Dienst gestoppt – „Agent neu starten“, sobald er wieder läuft.'
      beenden(a.kind)
    }
    await new Promise((r) => setTimeout(r, 4000))
    process.exit(0)
  }
  process.on('SIGTERM', () => void herunterfahren('SIGTERM'))
  process.on('SIGINT', () => void herunterfahren('SIGINT'))
  // Ohne Fenster sähe niemand einen Absturz – ins Protokoll, dann neu starten lassen (start.ps1 bzw. launchd)
  process.on('uncaughtException', (e) => {
    log('Absturz:', e.stack ?? e.message)
    process.exit(1)
  })

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
