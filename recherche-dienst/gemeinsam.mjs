// Recherche-Dienst – gemeinsame Teile von dienst.mjs und crm-mcp.mjs (29.10.2026): Verbindung zum CRM und der persönliche
// Dienst-Schlüssel. Alle Aufrufe gehen an crm.recherche_dienst (Migration 19) und handeln als die Person des Schlüssels.
// Verbindungsdaten (Projekt-URL, Publishable Key – dieselben öffentlichen Werte wie im JS-Bundle) legt einrichten.sh bzw.
// einrichten.ps1 ab. Der Schlüssel liegt auf dem Mac im Schlüsselbund (Dienst „steinerundco-recherche“), unter Windows
// (30.10.2026) per DPAPI verschlüsselt in schluessel.dpapi – nur dasselbe Windows-Konto kann ihn lesen.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const WINDOWS = process.platform === 'win32'
export const BASIS =
  process.env.RECHERCHE_BASIS ||
  (WINDOWS
    ? join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'steinerundco-recherche')
    : join(homedir(), 'Library/Application Support/steinerundco-recherche'))
export const LOGS = WINDOWS ? join(BASIS, 'logs') : join(homedir(), 'Library/Logs/steinerundco-recherche')
export const KEYCHAIN = { dienst: 'steinerundco-recherche', konto: 'dienst' }

let verbindung = null
let schluessel = process.env.RECHERCHE_SCHLUESSEL || null

function holeSchluessel() {
  if (schluessel) return schluessel
  if (WINDOWS) {
    const datei = join(BASIS, 'schluessel.dpapi').replaceAll("'", "''")
    schluessel = execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `$s = (Get-Content -LiteralPath '${datei}' -TotalCount 1).Trim() | ConvertTo-SecureString; ` +
          '[Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))',
      ],
      { encoding: 'utf8', windowsHide: true },
    ).trim()
  } else
    schluessel = execFileSync(
      '/usr/bin/security',
      ['find-generic-password', '-s', KEYCHAIN.dienst, '-a', KEYCHAIN.konto, '-w'],
      {
        encoding: 'utf8',
      },
    ).trim()
  return schluessel
}

/** Aktion an crm.recherche_dienst – wirft mit dem Wortlaut der Datenbank. */
export async function dienst(aktion, daten = {}) {
  verbindung ??= JSON.parse(readFileSync(join(BASIS, 'verbindung.json'), 'utf8'))
  const headers = {
    apikey: verbindung.key,
    'Content-Type': 'application/json',
    'Content-Profile': 'crm',
    'Accept-Profile': 'crm',
  }
  const r = await fetch(`${verbindung.url}/rest/v1/rpc/recherche_dienst`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ p_schluessel: holeSchluessel(), p_aktion: aktion, p_daten: daten }),
    signal: AbortSignal.timeout(30_000),
  })
  const antwort = await r.json().catch(() => null)
  if (!r.ok) throw new Error(antwort?.message ?? `CRM antwortet mit HTTP ${r.status}`)
  return antwort
}
