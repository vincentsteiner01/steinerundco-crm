// Kalendertage in Europe/Berlin (BAUPLAN § 5.2: `berlin_date(ts)`), ohne Zeitzonen-Bibliothek (E7: kein @date-fns/tz).
// Ein „Tag“ ist hier immer die Zeichenkette YYYY-MM-DD – das entspricht `date` in Postgres und vermeidet jede Verschiebung
// zwischen UTC-Server, Browser-Zeitzone und Berlin.

export const ZEITZONE = 'Europe/Berlin'

/** Kalendertag als `YYYY-MM-DD`. */
export type Tag = string

const TAG_RE = /^(\d{4})-(\d{2})-(\d{2})$/

const teileFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZEITZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

export type BerlinTeile = { jahr: number; monat: number; tag: number; stunde: number; minute: number; sekunde: number }

/** Zerlegt einen Zeitpunkt in Berliner Wanduhr-Teile. */
export function berlinTeile(d: Date): BerlinTeile {
  const t: Record<string, number> = {}
  for (const p of teileFormat.formatToParts(d)) {
    if (p.type !== 'literal') t[p.type] = Number(p.value)
  }
  return {
    jahr: t.year ?? 1970,
    monat: t.month ?? 1,
    tag: t.day ?? 1,
    stunde: t.hour ?? 0,
    minute: t.minute ?? 0,
    sekunde: t.second ?? 0,
  }
}

export function istTag(s: unknown): s is Tag {
  return typeof s === 'string' && TAG_RE.test(s)
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Berliner Kalendertag eines Zeitpunkts; ein `YYYY-MM-DD`-String wird unverändert zurückgegeben. */
export function berlinTag(d: Date | string): Tag {
  if (typeof d === 'string') {
    if (istTag(d)) return d
    return berlinTag(new Date(d))
  }
  const t = berlinTeile(d)
  return `${t.jahr}-${pad(t.monat)}-${pad(t.tag)}`
}

function tagTeile(tag: Tag): [number, number, number] {
  const m = TAG_RE.exec(tag)
  if (!m) throw new Error(`Kein Kalendertag: ${tag}`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

/** Tag + n Kalendertage (n darf negativ sein). */
export function tagPlus(tag: Tag, n: number): Tag {
  const [j, m, t] = tagTeile(tag)
  const d = new Date(Date.UTC(j, m - 1, t + n))
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/** ISO-Wochentag wie `extract(isodow …)`: Mo = 1 … So = 7. */
export function isodow(tag: Tag): number {
  const [j, m, t] = tagTeile(tag)
  const wd = new Date(Date.UTC(j, m - 1, t)).getUTCDay()
  return wd === 0 ? 7 : wd
}

/** Tag + n Monate mit Tagesbegrenzung (31.01. + 1 = 28.02.) – wie `date + interval 'n month'` in Postgres. */
export function monatePlus(tag: Tag, n: number): Tag {
  const [j, m, t] = tagTeile(tag)
  const ziel = new Date(Date.UTC(j, m - 1 + n, 1))
  const letzter = new Date(Date.UTC(ziel.getUTCFullYear(), ziel.getUTCMonth() + 1, 0)).getUTCDate()
  return `${ziel.getUTCFullYear()}-${pad(ziel.getUTCMonth() + 1)}-${pad(Math.min(t, letzter))}`
}

/** Nächster Wochentag (1 = Mo … 7 = So) strikt nach `tag` (ux § 4.9 „mo“ = nächster Montag, nie heute). */
export function naechsterWochentag(tag: Tag, wochentag: number): Tag {
  const delta = (wochentag - isodow(tag) + 7) % 7 || 7
  return tagPlus(tag, delta)
}

/** Kalendertage von `von` bis `bis` (positiv, wenn `bis` später liegt). */
export function tageDifferenz(von: Tag, bis: Tag): number {
  const [j1, m1, t1] = tagTeile(von)
  const [j2, m2, t2] = tagTeile(bis)
  return Math.round((Date.UTC(j2, m2 - 1, t2) - Date.UTC(j1, m1 - 1, t1)) / 86_400_000)
}

/** ISO-Kalenderwoche (Mo–So, KW 1 enthält den 4. Januar). */
export function kalenderwoche(tag: Tag): number {
  const [j, m, t] = tagTeile(tag)
  const d = new Date(Date.UTC(j, m - 1, t))
  const dow = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dow)
  const jahresanfang = Date.UTC(d.getUTCFullYear(), 0, 1)
  return Math.ceil(((d.getTime() - jahresanfang) / 86_400_000 + 1) / 7)
}

/**
 * Zeitpunkt zu Berliner Wanduhrzeit an einem Kalendertag (`due_on`: Standard 09:00).
 * Rechnet den UTC-Versatz über Intl aus; an DST-Umstellungen wird die nächste gültige Zeit genommen.
 */
export function tagZuDate(tag: Tag, zeit = '09:00'): Date {
  const [j, m, t] = tagTeile(tag)
  const [hh = 0, mm = 0] = zeit.split(':').map(Number)
  const gewuenscht = Date.UTC(j, m - 1, t, hh, mm)
  let kandidat = gewuenscht
  for (let i = 0; i < 2; i++) {
    const w = berlinTeile(new Date(kandidat))
    const wandzeit = Date.UTC(w.jahr, w.monat - 1, w.tag, w.stunde, w.minute)
    const diff = wandzeit - gewuenscht
    if (diff === 0) break
    kandidat -= diff
  }
  return new Date(kandidat)
}

/** Beliebige Eingabe (Date, ISO-Zeitstempel, `YYYY-MM-DD`) als Date; ein reiner Tag wird als Berliner 00:00 gelesen. */
export function alsDate(d: Date | string): Date {
  if (d instanceof Date) return d
  if (istTag(d)) return tagZuDate(d, '00:00')
  return new Date(d)
}
