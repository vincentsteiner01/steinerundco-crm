// BAUPLAN § 3.8 presets/allgemein.ts · § 6.2 „Allgemein“ (CSV/XLSX beliebig): freies Mapping → import_leads-Zeilen
// { first_name, last_name | name, salutation, company, role_title, linkedin_url, city, phone, email, notes, tags } → rpc.importLeads(rows, owner, 'import_csv', label, dryRun).
import type { Json } from '@/types/database'
import { zielFeldFuerKopf, type ZielFeld } from '../parser/kopfwort'
import { parseAnrede } from '../parser/name'
import { zelleZuText, type Zelle } from '../parser/xlsx'

/** Spaltenindex → Zielfeld (null = ignorieren). */
export type Mapping = (ZielFeld | null)[]

export type ImportLeadRow = {
  name?: string
  /** Akademischer Titel („Dr.“, „Prof.“) – import_leads liest `r->>'title'` */
  title?: string
  first_name?: string
  last_name?: string
  salutation?: 'herr' | 'frau' | 'neutral'
  company?: string
  role_title?: string
  linkedin_url?: string
  city?: string
  phone?: string
  email?: string
  notes?: string
  tags?: string[]
}

/** Kopfzeile → Mapping (jedes Zielfeld nur einmal). */
export function erkenneMapping(kopf: readonly (Zelle | string)[]): Mapping {
  const belegt = new Set<ZielFeld>()
  return kopf.map((k) => {
    const z = zielFeldFuerKopf(typeof k === 'string' ? k : zelleZuText(k))
    if (!z || belegt.has(z)) return null
    belegt.add(z)
    return z
  })
}

/** Datenzeilen + Mapping → import_leads-Zeilen (leere Zeilen entfallen). Tags `;`-getrennt. */
export function allgemeinZeilen(zeilen: readonly (readonly Zelle[])[], mapping: Mapping): ImportLeadRow[] {
  const out: ImportLeadRow[] = []
  for (const z of zeilen) {
    const r: ImportLeadRow = {}
    let leer = true
    mapping.forEach((feld, j) => {
      if (!feld) return
      const v = zelleZuText(z[j] ?? null)
      if (v == null) return
      leer = false
      if (feld === 'tags')
        r.tags = v
          .split(/[;,]/)
          .map((t) => t.trim())
          .filter(Boolean)
      else if (feld === 'salutation') {
        const a = parseAnrede(v)
        if (a) r.salutation = a
      } else r[feld] = v
    })
    if (!leer && (r.name || r.first_name || r.last_name || r.linkedin_url)) out.push(r)
  }
  return out
}

export function rowsJson(rows: readonly ImportLeadRow[]): Json {
  return rows as unknown as Json
}

/** Mindestbedingung für Schritt 2 → 3: ein Namensfeld oder eine URL ist zugeordnet. */
export function mappingVollstaendig(m: Mapping): boolean {
  return m.includes('name') || m.includes('first_name') || m.includes('last_name') || m.includes('linkedin_url')
}
