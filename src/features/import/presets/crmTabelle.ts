// BAUPLAN § 3.8 presets/crmTabelle.ts · § 6.2 „CRM-Tabelle“: Tab „CRM“ → Kopfzeile → snake_case-Keys (parse_sheets.py-Regel),
// zweite „System-ID“ → system_id_2, Datum DD.MM.YYYY → ISO, „Ja“ bleibt „Ja“, leer → null, `#ERROR!` → _errors + dm_zustaendigkeit_resolved.
// Ausgabe = { source: { file, sheet_title, tabs }, crm: { rows } } → rpc.importSheetLeads(doc, dryRun). Keine _note_signals (DB-Fallback parse_legacy_note).
import type { Json } from '@/types/database'
import { snake } from '../parser/kopfwort'
import { zelleZuInt, zelleZuIso, zelleZuJa, zelleZuText, type Tab, type Zelle } from '../parser/xlsx'

/** Die 24 Spalten des Sheets „CRM - Steiner & Co.“ (Tab CRM) in Sheet-Reihenfolge. */
export const CRM_SPALTEN = [
  'id',
  'vor_und_nachname',
  'linkedin_url',
  'telefonnummer',
  'unternehmen',
  'mike_anfrage_gesendet_am',
  'mike_akzeptiert',
  'vincent_anfrage_gesendet_am',
  'vincent_akzeptiert',
  'gespraechseroeffnung_am',
  'gespraech_eroeffnet_von',
  'dm_zustaendigkeit',
  'fuer_anderen_freigegeben',
  'letztes_dm_follow_up_am',
  'dm_follow_ups_anzahl',
  'erstgespraech_am',
  'strategiegespraech_am',
  'status',
  'mitarbeiter',
  'lead_phase',
  'naechster_follow_up_am',
  'notizen',
  'system_id',
  'system_id_2',
] as const
export type CrmSpalte = (typeof CRM_SPALTEN)[number]

const DATUM: ReadonlySet<string> = new Set([
  'mike_anfrage_gesendet_am',
  'vincent_anfrage_gesendet_am',
  'gespraechseroeffnung_am',
  'letztes_dm_follow_up_am',
  'erstgespraech_am',
  'strategiegespraech_am',
  'naechster_follow_up_am',
])
const JA: ReadonlySet<string> = new Set(['mike_akzeptiert', 'vincent_akzeptiert', 'fuer_anderen_freigegeben'])
const INT: ReadonlySet<string> = new Set(['id', 'dm_follow_ups_anzahl'])

export type CrmZeile = {
  _row: number
  _errors: string[]
  dm_zustaendigkeit_resolved: string | null
  [key: string]: string | number | string[] | null
}

export type CrmSpaltenInfo = { spalte: string; key: string; erkannt: boolean; beispiel: string | null }

export type CrmDokument = {
  doc: Json
  rows: CrmZeile[]
  spalten: CrmSpaltenInfo[]
  fehlend: CrmSpalte[]
  tab: string | null
}

/** Kopfzeile → Keys; doppelte Keys werden nummeriert (System-ID → system_id, system_id_2). */
export function kopfZuKeys(kopf: readonly Zelle[]): string[] {
  const gesehen = new Map<string, number>()
  return kopf.map((k) => {
    const basis = snake(zelleZuText(k) ?? '')
    if (basis === '') return ''
    const n = (gesehen.get(basis) ?? 0) + 1
    gesehen.set(basis, n)
    return n === 1 ? basis : `${basis}_${n}`
  })
}

function wert(key: string, v: Zelle): string | number | null {
  if (v == null) return null
  if (typeof v === 'string' && v.startsWith('#')) return v // #ERROR!, #REF! … bleibt als Text, landet in _errors
  if (DATUM.has(key)) return zelleZuIso(v) ?? zelleZuText(v)
  if (JA.has(key)) return zelleZuJa(v)
  if (INT.has(key)) return zelleZuInt(v)
  if (key === 'notizen' && typeof v === 'string') return v.replace(/\r\n?/g, '\n')
  return zelleZuText(v)
}

/** Tab „CRM“ (oder erster Tab mit „crm“ im Namen, sonst der erste). */
export function crmTab(tabs: readonly Tab[]): Tab | null {
  return (
    tabs.find((t) => t.name.trim().toLowerCase() === 'crm') ?? tabs.find((t) => /crm/i.test(t.name)) ?? tabs[0] ?? null
  )
}

export function crmTabelleDokument(tabs: readonly Tab[], datei: string): CrmDokument {
  const tab = crmTab(tabs)
  if (!tab || tab.zeilen.length === 0)
    return { doc: {}, rows: [], spalten: [], fehlend: [...CRM_SPALTEN], tab: tab?.name ?? null }
  const kopf = tab.zeilen[0] ?? []
  const keys = kopfZuKeys(kopf)
  const rows: CrmZeile[] = []
  tab.zeilen.slice(1).forEach((zeile, i) => {
    const name = zelleZuText(zeile[keys.indexOf('vor_und_nachname')] ?? null)
    const id = zeile[keys.indexOf('id')] ?? null
    if (!name && id == null) return
    const r: CrmZeile = { _row: i + 2, _errors: [], dm_zustaendigkeit_resolved: null }
    keys.forEach((key, j) => {
      if (key === '') return
      const v = wert(key, zeile[j] ?? null)
      r[key] = v
      if (typeof v === 'string' && v.startsWith('#')) r._errors.push(key)
    })
    // BAUPLAN § 6.2: bei #ERROR!/leer → mitarbeiter (parse_sheets.py rechnete die Formel nach – BAUPLAN gilt, § 3.0 Konfliktregel)
    const zust = r['dm_zustaendigkeit']
    const mitarbeiter = typeof r['mitarbeiter'] === 'string' ? r['mitarbeiter'] : null
    r.dm_zustaendigkeit_resolved =
      typeof zust === 'string' && !zust.startsWith('#') && zust !== '' && zust !== 'Frei' ? zust : mitarbeiter
    if (r._errors.length === 0) delete (r as Partial<CrmZeile>)._errors
    rows.push(r)
  })
  const spalten: CrmSpaltenInfo[] = keys.map((key, j) => ({
    spalte: zelleZuText(kopf[j] ?? null) ?? `Spalte ${j + 1}`,
    key,
    erkannt: (CRM_SPALTEN as readonly string[]).includes(key),
    beispiel: rows.map((r) => r[key]).find((v) => v != null && typeof v !== 'object') as string | null,
  }))
  const fehlend = CRM_SPALTEN.filter((s) => !keys.includes(s))
  const doc = {
    source: { file: datei, sheet_title: 'CRM - Steiner & Co.', tabs: tabs.map((t) => t.name) },
    crm: { rows },
  } as unknown as Json
  return { doc, rows, spalten, fehlend, tab: tab.name }
}

/** Zähler für die Prüfen-Ansicht (I-01). */
export function crmHinweise(rows: readonly CrmZeile[]) {
  const z = {
    zeilen: rows.length,
    ohneUnternehmen: 0,
    ohneStatus: 0,
    mitError: 0,
    beideAngefragt: 0,
    nichtAnschreiben: 0,
    ohneZustaendig: 0,
  }
  for (const r of rows) {
    if (!r['unternehmen']) z.ohneUnternehmen += 1
    if (!r['status']) z.ohneStatus += 1
    if (r._errors?.includes('dm_zustaendigkeit')) z.mitError += 1
    if (r['mike_akzeptiert'] === 'Ja' && r['vincent_akzeptiert'] === 'Ja') z.beideAngefragt += 1
    if (typeof r['notizen'] === 'string' && /nicht anschreiben/i.test(r['notizen'])) z.nichtAnschreiben += 1
    if (!r.dm_zustaendigkeit_resolved) z.ohneZustaendig += 1
  }
  return z
}

/** Dry-Run-Antwort von import_sheet_leads (Zeilen stehen in `hinweise`, § 6.2). */
export type SheetDryRunZeile = {
  id?: number | null
  name?: string | null
  stufe?: string | null
  grund?: string | null
  owner?: string | null
  naechster?: string | null
  hinweis?: string
  warnung?: string
}
export type SheetErgebnis = {
  batch_id: string | null
  dry_run: boolean
  vorschau?: number
  leads_neu: number
  leads_aktualisiert: number
  uebersprungen: number
  vernetzungen?: number
  aktivitaeten?: number
  sequenzen?: number
  aufgaben?: number
  meetings?: number
  firmen?: number
  hinweise: SheetDryRunZeile[]
}
