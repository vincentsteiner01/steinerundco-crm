// BAUPLAN § 3.6 `zeitraum.ts` / § 7.2 „Zeiträume“: Zeitraum aus der URL → { von, bis, vorperiode, label, monthKey }.
// Monat (`?zeitraum=2026-10`) · KW (ISO, Mo–So, `kw42` im laufenden ISO-Jahr, `kw53-2026` für andere Jahre) · 7 T · 30 T ·
// custom (`?zeitraum=custom&von=&bis=`). Vorperiode = gleich lange Spanne direkt davor (Monat → Vormonat, KW → Vorwoche, K-11).
// Reine Funktionen auf Berliner Kalendertagen (`YYYY-MM-DD`).
import { monatLabel } from '@/lib/format'
import { isodow, istTag, kalenderwoche, monatePlus, tagPlus, tageDifferenz, type Tag } from '@/lib/zeit'

export type ZeitraumArt = 'monat' | 'kw' | '7t' | '30t' | 'custom'
export type Spanne = { von: Tag; bis: Tag }
export type Zeitraum = {
  art: ZeitraumArt
  von: Tag
  bis: Tag
  /** Headline: „Oktober 2026“ · „KW 42“ · „Letzte 7 Tage“ · „01.–14.10.2026“ */
  label: string
  /** Gleich lange Spanne direkt davor; `label` kurz: „Sept.“ · „KW 41“ · „7 T davor“ */
  vorperiode: Spanne & { label: string }
  /** Nur in der Monatsansicht (v_funnel_monthly 1:1, K-01/K-02) */
  monthKey: string | null
  kw: { jahr: number; nr: number } | null
}
export type ZeitraumParams = { zeitraum: string; von?: Tag; bis?: Tag }

export const ZEITRAUM_ARTEN: { key: ZeitraumArt; label: string }[] = [
  { key: 'monat', label: 'Monat' },
  { key: 'kw', label: 'KW' },
  { key: '7t', label: '7 T' },
  { key: '30t', label: '30 T' },
  { key: 'custom', label: 'eigener' },
]

const MONAT_KURZ = [
  'Jan.',
  'Feb.',
  'März',
  'Apr.',
  'Mai',
  'Juni',
  'Juli',
  'Aug.',
  'Sept.',
  'Okt.',
  'Nov.',
  'Dez.',
] as const

export const monatVon = (tag: Tag): string => tag.slice(0, 7)

export function monatsSpanne(monthKey: string): Spanne {
  const von = `${monthKey}-01`
  return { von, bis: tagPlus(monatePlus(von, 1), -1) }
}

/** ISO-Jahr einer Woche = Jahr ihres Donnerstags. */
export function isoJahr(tag: Tag): number {
  return Number(tagPlus(tag, 4 - isodow(tag)).slice(0, 4))
}

/** Anzahl ISO-Wochen eines Jahres (52 oder 53): der 28.12. liegt immer in der letzten Woche. */
export function wochenImJahr(jahr: number): number {
  return kalenderwoche(`${jahr}-12-28`)
}

/** Montag–Sonntag der ISO-Woche `nr` im ISO-Jahr `jahr` (KW 1 enthält den 4. Januar). */
export function kwSpanne(jahr: number, nr: number): Spanne {
  const vierter = `${jahr}-01-04`
  const montagEins = tagPlus(vierter, 1 - isodow(vierter))
  const von = tagPlus(montagEins, (nr - 1) * 7)
  return { von, bis: tagPlus(von, 6) }
}

export function kwVon(tag: Tag): { jahr: number; nr: number } {
  return { jahr: isoJahr(tag), nr: kalenderwoche(tag) }
}

/** Montag der Woche eines Tags. */
export const wochenStart = (tag: Tag): Tag => tagPlus(tag, 1 - isodow(tag))

/** `01.–14.10.2026` · `28.09.–04.10.2026` · `30.12.2026–02.01.2027` */
export function spanneText(von: Tag, bis: Tag): string {
  const [j1, m1, t1] = von.split('-') as [string, string, string]
  const [j2, m2, t2] = bis.split('-') as [string, string, string]
  if (j1 === j2 && m1 === m2) return `${t1}.–${t2}.${m2}.${j2}`
  if (j1 === j2) return `${t1}.${m1}.–${t2}.${m2}.${j2}`
  return `${t1}.${m1}.${j1}–${t2}.${m2}.${j2}`
}

function monat(monthKey: string): Zeitraum {
  const s = monatsSpanne(monthKey)
  const vorKey = monatVon(monatePlus(s.von, -1))
  const vs = monatsSpanne(vorKey)
  return {
    art: 'monat',
    ...s,
    label: monatLabel(monthKey),
    monthKey,
    kw: null,
    vorperiode: { ...vs, label: MONAT_KURZ[Number(vorKey.slice(5, 7)) - 1] ?? vorKey },
  }
}

function kw(jahr: number, nr: number): Zeitraum {
  const s = kwSpanne(jahr, nr)
  const vorMontag = tagPlus(s.von, -7)
  const vk = kwVon(vorMontag)
  return {
    art: 'kw',
    ...s,
    label: `KW ${nr}`,
    monthKey: null,
    kw: { jahr, nr },
    vorperiode: { von: vorMontag, bis: tagPlus(vorMontag, 6), label: `KW ${vk.nr}` },
  }
}

function letzte(n: 7 | 30, heute: Tag): Zeitraum {
  const von = tagPlus(heute, -(n - 1))
  return {
    art: n === 7 ? '7t' : '30t',
    von,
    bis: heute,
    label: `Letzte ${n} Tage`,
    monthKey: null,
    kw: null,
    vorperiode: { von: tagPlus(von, -n), bis: tagPlus(von, -1), label: `${n} T davor` },
  }
}

function custom(von: Tag, bis: Tag): Zeitraum {
  const n = tageDifferenz(von, bis) + 1
  return {
    art: 'custom',
    von,
    bis,
    label: spanneText(von, bis),
    monthKey: null,
    kw: null,
    vorperiode: { von: tagPlus(von, -n), bis: tagPlus(von, -1), label: 'davor' },
  }
}

/** Zeitraum aus den URL-Parametern; ohne (gültigen) Parameter der laufende Monat. */
export function parseZeitraum(params: URLSearchParams, heute: Tag): Zeitraum {
  const z = (params.get('zeitraum') ?? '').toLowerCase()
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(z)) return monat(z)
  const kwTreffer = /^kw(\d{1,2})?(?:-(\d{4}))?$/.exec(z)
  if (kwTreffer) {
    if (!kwTreffer[1]) {
      const h = kwVon(heute)
      return kw(h.jahr, h.nr)
    }
    const nr = Number(kwTreffer[1])
    const jahr = kwTreffer[2] ? Number(kwTreffer[2]) : isoJahr(heute)
    if (nr >= 1 && nr <= wochenImJahr(jahr)) return kw(jahr, nr)
  }
  if (z === '7t') return letzte(7, heute)
  if (z === '30t') return letzte(30, heute)
  if (z === 'custom') {
    const von = params.get('von')
    const bis = params.get('bis')
    if (istTag(von) && istTag(bis) && von <= bis && tageDifferenz(von, bis) < 366) return custom(von, bis)
  }
  return monat(monatVon(heute))
}

/** Zeitraum einer Segment-Wahl (Monat/KW/7 T/30 T des Heute; „eigener“ übernimmt die aktuelle Spanne). */
export function zeitraumFuerArt(art: ZeitraumArt, heute: Tag, aktuell: Zeitraum): Zeitraum {
  switch (art) {
    case 'monat':
      return monat(monatVon(heute))
    case 'kw': {
      const h = kwVon(heute)
      return kw(h.jahr, h.nr)
    }
    case '7t':
      return letzte(7, heute)
    case '30t':
      return letzte(30, heute)
    case 'custom':
      return custom(aktuell.von, aktuell.bis)
  }
}

export function eigenerZeitraum(von: Tag, bis: Tag): Zeitraum {
  return von <= bis ? custom(von, bis) : custom(bis, von)
}

/** URL-Parameter eines Zeitraums (`kw42` im laufenden ISO-Jahr, sonst `kw53-2026`). */
export function zeitraumParams(z: Zeitraum, heute: Tag): ZeitraumParams {
  switch (z.art) {
    case 'monat':
      return { zeitraum: z.monthKey ?? monatVon(z.von) }
    case 'kw': {
      const k = z.kw ?? kwVon(z.von)
      return { zeitraum: k.jahr === isoJahr(heute) ? `kw${k.nr}` : `kw${k.nr}-${k.jahr}` }
    }
    case '7t':
      return { zeitraum: '7t' }
    case '30t':
      return { zeitraum: '30t' }
    case 'custom':
      return { zeitraum: 'custom', von: z.von, bis: z.bis }
  }
}

/** `←`/`→`: Monat → Vor-/Folgemonat, KW → Vor-/Folgewoche, 7 T / 30 T / eigener → um die eigene Länge verschoben (wird „eigener“). */
export function verschoben(z: Zeitraum, richtung: -1 | 1): Zeitraum {
  if (z.art === 'monat') return monat(monatVon(monatePlus(z.von, richtung)))
  if (z.art === 'kw') {
    const k = kwVon(tagPlus(z.von, 7 * richtung))
    return kw(k.jahr, k.nr)
  }
  const n = tageDifferenz(z.von, z.bis) + 1
  return custom(tagPlus(z.von, n * richtung), tagPlus(z.bis, n * richtung))
}

/** `→` ist aus, wenn der folgende Zeitraum ganz in der Zukunft läge. */
export function folgezeitraumMoeglich(z: Zeitraum, heute: Tag): boolean {
  return verschoben(z, 1).von <= heute
}

/** Dateline-Spanne „01.–14.10.2026“: bis höchstens heute. */
export function datelineSpanne(z: Zeitraum, heute: Tag): string {
  const bis = z.bis < heute ? z.bis : heute
  return spanneText(z.von, bis < z.von ? z.bis : bis)
}

/** Alle Kalendertage von `von` bis `bis` (inklusive). */
export function tageDerSpanne(von: Tag, bis: Tag): Tag[] {
  const n = tageDifferenz(von, bis)
  if (n < 0) return []
  return Array.from({ length: n + 1 }, (_, i) => tagPlus(von, i))
}

/** Monatszähler (`period = 'monat'`, Sheet-Werte) zählen nur in der Monatsansicht (§ 3.6 Regeln). */
export const monatszaehlerZaehlen = (z: Zeitraum): boolean => z.art === 'monat'
