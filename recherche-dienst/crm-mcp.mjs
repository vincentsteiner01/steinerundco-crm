// Recherche-Dienst – CRM-Werkzeuge für den ChatGPT-Agenten (29.10.2026): kleiner MCP-Server (stdio, JSON-RPC je Zeile), den Codex
// für einen Lauf startet (RECHERCHE_LAUF). Der Agent bedient das CRM nur hierüber, nie über Webformulare – die Regeln (Dubletten,
// Pflichtangaben, Ziel, Kontrollpunkt) erzwingt die Datenbank in recherche_pruefen/_eintragen/_kontrolle.
import { createInterface } from 'node:readline'
import { dienst } from './gemeinsam.mjs'

const LAUF = process.env.RECHERCHE_LAUF ?? ''
const text = (beschreibung) => ({ type: 'string', description: beschreibung })

const WERKZEUGE = [
  {
    name: 'lauf_status',
    aktion: 'lauf_status',
    description:
      'Status, Ziel und Zähler des Recherchelaufs, ob ein Kontrollpunkt fällig ist, und alle schon bearbeiteten Profile (URL, Name, Firma, Ergebnis) – nichts doppelt bearbeiten.',
    properties: {},
    required: [],
  },
  {
    name: 'ausgangspunkte',
    aktion: 'ausgangspunkte',
    description: 'Vernetzte Kontakte und ihre Firmen aus dem CRM als Startpunkte für die Recherche auf LinkedIn.',
    properties: {},
    required: [],
  },
  {
    name: 'profil_pruefen',
    aktion: 'pruefen',
    description:
      'Dublettenprüfung vor jeder Anfrage: Lauf, CRM, Sperrliste, bestehende Verbindungen, gleicher Name + Firma, frühere Absagen. Nur bei frei = true darf vernetzt werden.',
    properties: {
      url: text('LinkedIn-Profil-URL (https://www.linkedin.com/in/…)'),
      vorname: text('Vorname'),
      nachname: text('Nachname'),
      firma: text('Aktueller Arbeitgeber'),
    },
    required: ['url'],
  },
  {
    name: 'profil_eintragen',
    aktion: 'eintragen',
    description:
      'Ergebnis je geprüftem Profil eintragen. gesendet nur nach Freigabe und erst, wenn LinkedIn „Ausstehend“ zeigt – dann sind Vorname, Nachname, Firma, Position, Kategorie und Grund Pflicht. nicht_qualifiziert und unklar brauchen einen Grund.',
    properties: {
      url: text('LinkedIn-Profil-URL'),
      ergebnis: {
        type: 'string',
        enum: ['gesendet', 'dublette', 'nicht_qualifiziert', 'unklar', 'fehler'],
        description: 'gesendet · dublette · nicht_qualifiziert · unklar · fehler (Senden fehlgeschlagen)',
      },
      vorname: text('Vorname'),
      nachname: text('Nachname'),
      firma: text('Aktueller Arbeitgeber'),
      position: text('Aktuelle Position laut Profil'),
      kategorie: { type: 'string', enum: ['A', 'B', 'C', 'bedingt'], description: 'Zielrolle A, B, C oder bedingt' },
      grund: text('Qualifizierungsgrund bzw. Grund der Absage – kurz, nur belegte Fakten'),
      firma_website: text('Website des Unternehmens, falls bekannt'),
      ausgangspunkt: text('Über welches Profil oder welche Firma die Person gefunden wurde'),
    },
    required: ['url', 'ergebnis'],
  },
  {
    name: 'kontrollpunkt_bestaetigen',
    aktion: 'kontrolle',
    description: 'Nach je 10 geprüften Profilen: bestätigt, dass die letzten Einträge alle Kontrollkriterien erfüllen.',
    properties: { pruefung: text('Kurz: welche Einträge gegen welche Kriterien geprüft wurden') },
    required: ['pruefung'],
  },
  {
    name: 'einschraenkung_melden',
    aktion: 'einschraenkung',
    description:
      'LinkedIn zeigt Warnung, Einladungslimit, Sicherheitsabfrage oder Einschränkung: hält den Lauf im CRM an.',
    properties: { wortlaut: text('Wortlaut der LinkedIn-Meldung') },
    required: ['wortlaut'],
  },
]

const senden = (nachricht) => process.stdout.write(`${JSON.stringify(nachricht)}\n`)

async function aufrufen(name, args) {
  const w = WERKZEUGE.find((x) => x.name === name)
  if (!w) throw new Error(`Unbekanntes Werkzeug ${name}`)
  const daten = { lauf: LAUF }
  for (const k of Object.keys(w.properties)) if (args?.[k] !== undefined && k !== 'pruefung') daten[k] = args[k]
  return dienst(w.aktion, daten)
}

createInterface({ input: process.stdin }).on('line', (zeile) => {
  let m
  try {
    m = JSON.parse(zeile)
  } catch {
    return
  }
  if (m.id === undefined) return // Benachrichtigungen (initialized, cancelled …)
  if (m.method === 'initialize')
    return senden({
      jsonrpc: '2.0',
      id: m.id,
      result: {
        protocolVersion: m.params?.protocolVersion ?? '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'crm', version: '1' },
      },
    })
  if (m.method === 'tools/list')
    return senden({
      jsonrpc: '2.0',
      id: m.id,
      result: {
        tools: WERKZEUGE.map((w) => ({
          name: w.name,
          description: w.description,
          inputSchema: { type: 'object', properties: w.properties, required: w.required, additionalProperties: false },
        })),
      },
    })
  if (m.method === 'tools/call')
    return void aufrufen(m.params?.name, m.params?.arguments ?? {})
      .then((r) =>
        senden({ jsonrpc: '2.0', id: m.id, result: { content: [{ type: 'text', text: JSON.stringify(r) }] } }),
      )
      .catch((e) =>
        senden({
          jsonrpc: '2.0',
          id: m.id,
          result: { content: [{ type: 'text', text: `Fehler: ${e.message}` }], isError: true },
        }),
      )
  if (m.method === 'ping') return senden({ jsonrpc: '2.0', id: m.id, result: {} })
  senden({ jsonrpc: '2.0', id: m.id, error: { code: -32601, message: `Unbekannte Methode ${m.method}` } })
})
