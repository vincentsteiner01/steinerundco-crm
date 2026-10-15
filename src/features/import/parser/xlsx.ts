// BAUPLAN § 3.8 parser/xlsx.ts: `await import('xlsx')` (E22: nur im Import-Chunk) → Tabs → Zeilen (data_only), Datumszellen → ISO.
// Zellwerte bleiben roh (string | number | boolean | Date | null); die Presets wandeln je Spalte.

export type Zelle = string | number | boolean | Date | null
export type Tab = { name: string; zeilen: Zelle[][] }

/** Liest eine XLSX/XLS-Datei (ArrayBuffer) → Tabs mit Zeilen. Lädt SheetJS erst beim Aufruf. */
export async function liesXlsx(daten: ArrayBuffer): Promise<Tab[]> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(daten, { type: 'array', cellDates: true, cellNF: false, cellText: false })
  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name]
    if (!ws) return { name, zeilen: [] }
    const roh = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null, blankrows: false })
    return { name, zeilen: roh.map((z) => z.map(zelleNormieren)) }
  })
}

function zelleNormieren(v: unknown): Zelle {
  if (v == null) return null
  if (v instanceof Date) return v
  if (typeof v === 'number' || typeof v === 'boolean') return v
  const s = String(v).trim()
  return s === '' ? null : s
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Date (SheetJS, lokale Kalenderteile) → `YYYY-MM-DD`. */
export function dateZuIso(d: Date): string | null {
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Excel-Serial (Tage seit 1899-12-30) → ISO. */
export function serialZuIso(n: number): string | null {
  if (!Number.isFinite(n) || n < 1 || n > 2958465) return null
  const ms = Math.round((n - 25569) * 86400 * 1000)
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/** `DD.MM.YYYY`, `D.M.YYYY`, `YYYY-MM-DD` → ISO; sonst null (§ 6.1). */
export function textZuIso(s: string): string | null {
  const t = s.trim()
  let m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(t)
  if (m) {
    const tag = Number(m[1])
    const monat = Number(m[2])
    const jahr = Number(m[3])
    if (monat < 1 || monat > 12 || tag < 1 || tag > 31) return null
    return `${jahr}-${pad(monat)}-${pad(tag)}`
  }
  m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/.exec(t)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  return null
}

/** Zelle → ISO-Datum (Date, Serial oder Text) oder null. */
export function zelleZuIso(v: Zelle): string | null {
  if (v == null || typeof v === 'boolean') return null
  if (v instanceof Date) return dateZuIso(v)
  if (typeof v === 'number') return serialZuIso(v)
  return textZuIso(v)
}

/** Zelle → Text (Zahlen ohne Nachkommanullen, Datum als ISO) oder null. */
export function zelleZuText(v: Zelle): string | null {
  if (v == null) return null
  if (v instanceof Date) return dateZuIso(v)
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v)
  if (typeof v === 'boolean') return v ? 'Ja' : null
  const s = v.trim()
  return s === '' ? null : s
}

/** Zelle → Ganzzahl oder null. */
export function zelleZuInt(v: Zelle): number | null {
  if (v == null || v instanceof Date || typeof v === 'boolean') return null
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : null
  const n = Number.parseInt(v.replace(/[^\d-]/g, ''), 10)
  return Number.isFinite(n) ? n : null
}

/** „Ja“/„ja“/„x“/„✓“/true → „Ja“, sonst null (§ 6.1, Sheet-Preset behält den Text). */
export function zelleZuJa(v: Zelle): 'Ja' | null {
  if (v === true) return 'Ja'
  if (typeof v !== 'string') return null
  return /^(ja|j|x|✓|✔|yes|true|wahr)$/i.test(v.trim()) ? 'Ja' : null
}

/** Gültige Dateiendung/-größe (§ 6.1: XLSX/CSV ≤ 10 MB). */
export const MAX_BYTES = 10 * 1024 * 1024
export const MAX_ZEILEN = 5000
export type DateiArt = 'xlsx' | 'csv'
export function dateiArt(name: string): DateiArt | null {
  const n = name.toLowerCase()
  if (/\.(xlsx|xlsm|xls)$/.test(n)) return 'xlsx'
  if (/\.(csv|tsv|txt)$/.test(n)) return 'csv'
  return null
}
