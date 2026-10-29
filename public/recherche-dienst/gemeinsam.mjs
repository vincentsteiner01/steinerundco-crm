// Recherche-Dienst – gemeinsame Teile von dienst.mjs und crm-mcp.mjs (29.10.2026): Verbindung zum CRM und der persönliche
// Dienst-Schlüssel. Alle Aufrufe gehen an crm.recherche_dienst (Migration 19) und handeln als die Person des Schlüssels.
// Verbindungsdaten (Projekt-URL, Publishable Key – dieselben öffentlichen Werte wie im JS-Bundle) legt einrichten.sh ab,
// der Schlüssel liegt im macOS-Schlüsselbund (Dienst „steinerundco-recherche“).
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const BASIS = join(homedir(), 'Library/Application Support/steinerundco-recherche')
export const LOGS = join(homedir(), 'Library/Logs/steinerundco-recherche')
export const KEYCHAIN = { dienst: 'steinerundco-recherche', konto: 'dienst' }

let verbindung = null
let schluessel = process.env.RECHERCHE_SCHLUESSEL || null

function holeSchluessel() {
  schluessel ??= execFileSync(
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
