// KPI-Reiter: Zeitraum aus der URL → { von, bis, vorperiode, label, monthKey }. Unverändert aus dem alten CRM (Tag archiv-crm-v1).
// Monat (`?zeitraum=2026-10`) · Woche (ISO, Mo–So, `kw42` im laufenden ISO-Jahr, `kw53-2026` für andere Jahre) · 7 Tage · 30 Tage.
// Ein eigener Zeitraum (`?zeitraum=custom&von=&bis=`) wird weiter gelesen und entsteht beim Blättern aus 7/30 Tagen, steht aber
// nicht mehr zur Wahl. Endet er heute und ist 7 oder 30 Tage lang, ist er wieder „Letzte 7 Tage“ bzw. „Letzte 30 Tage“.
// Vorperiode = gleich lange Spanne direkt davor (Monat → Vormonat, Woche → Vorwoche).
// Reine Funktionen auf Berliner Kalendertagen (`YYYY-MM-DD`).
import { monatLabel } from '@/lib/format'
import { isodow, istTag, kalenderwoche, monatePlus, tagPlus, tageDifferenz, type Tag } from '@/lib/zeit'

export type ZeitraumArt = 'monat' | 'kw' | '7t' | '30t' | 'custom'
type Spanne = { von: Tag; bis: Tag }
export type Zeitraum = {
  art: ZeitraumArt
  von: Tag
  bis: Tag
  /** Headline: „Oktober 2026“ · „KW 42“ · „Letzte 7 Tage“ · „01.–14.10.2026“ */
  label: string
  /** Gleich lange Spanne direkt davor; `label` kurz: „Sept.“ · „KW 41“ · „davor“ */
  vorperiode: Spanne & { label: string }
  /** Nur in der Monatsansicht – dort zählen auch die alten Monatszähler (`period = 'monat'`) */
  monthKey: string | null
  kw: { jahr: number; nr: number } | null
}
type ZeitraumParams = { zeitraum: string; von?: Tag; bis?: Tag }

/** Die Auswahl im Kopf – der eigene Zeitraum wird nicht angeboten. */
export const ZEITRAUM_ARTEN: { key: Exclude<ZeitraumArt, 'custom'>; label: string }[] = [
  { key: 'monat', label: 'Monat' },
  { key: 'kw', label: 'Woche' },
  { key: '7t', label: '7 Tage' },
  { key: '30t', label: '30 Tage' },
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

const monatVon = (tag: Tag): string => tag.slice(0, 7)

function monatsSpanne(monthKey: string): Spanne {
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
    // „davor“ statt „7 Tage davor“: neben den Zahlen der Kacheln („vs. davor 12“) stünde sonst eine dritte Zahl
    vorperiode: { von: tagPlus(von, -n), bis: tagPlus(von, -1), label: 'davor' },
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

/** 7 oder 30, wenn die Spanne heute endet und genau so lang ist – dann ist sie „Letzte 7 Tage“ bzw. „Letzte 30 Tage“. */
function letzteTage(von: Tag, bis: Tag, heute: Tag): 7 | 30 | null {
  if (bis !== heute) return null
  const n = tageDifferenz(von, bis) + 1
  return n === 7 || n === 30 ? n : null
}

/**
 * Welche Wahl im Kopf zu einem Zeitraum gehört. Eine verschobene Spanne von 7 oder 30 Tagen (beim Blättern entstanden) gehört
 * weiter zu „7 Tage“ bzw. „30 Tage“ – so ist immer eine Wahl markiert. Jede andere eigene Spanne: `null`.
 */
export function zeitraumWahl(z: Zeitraum): Exclude<ZeitraumArt, 'custom'> | null {
  if (z.art !== 'custom') return z.art
  const n = tageDifferenz(z.von, z.bis) + 1
  return n === 7 ? '7t' : n === 30 ? '30t' : null
}

/**
 * Jahre, die aus der Adresse angenommen werden. Jedes vierstellige Jahr ging nicht: unter 1000 und ab 9999 kann lib/zeit nicht
 * rechnen – eine von Hand veränderte Adresse (`kw1-0999`, `9999-12`) ließ die Seite beim Rendern abstürzen.
 */
const jahrErlaubt = (jahr: number): boolean => jahr >= 2000 && jahr <= 2100

/** Ein Kalendertag, den es gibt (kein 30.02.), in einem erlaubten Jahr. */
const tagErlaubt = (s: string | null): s is Tag =>
  istTag(s) && jahrErlaubt(Number(s.slice(0, 4))) && tagPlus(s, 0) === s

/** Zeitraum aus den URL-Parametern; ohne (gültigen) Parameter der laufende Monat. */
export function parseZeitraum(params: URLSearchParams, heute: Tag): Zeitraum {
  const z = (params.get('zeitraum') ?? '').toLowerCase()
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(z) && jahrErlaubt(Number(z.slice(0, 4)))) return monat(z)
  const kwTreffer = /^kw(\d{1,2})?(?:-(\d{4}))?$/.exec(z)
  if (kwTreffer) {
    if (!kwTreffer[1]) {
      const h = kwVon(heute)
      return kw(h.jahr, h.nr)
    }
    const nr = Number(kwTreffer[1])
    const jahr = kwTreffer[2] ? Number(kwTreffer[2]) : isoJahr(heute)
    if (jahrErlaubt(jahr) && nr >= 1 && nr <= wochenImJahr(jahr)) return kw(jahr, nr)
  }
  if (z === '7t') return letzte(7, heute)
  if (z === '30t') return letzte(30, heute)
  if (z === 'custom') {
    const von = params.get('von')
    const bis = params.get('bis')
    if (tagErlaubt(von) && tagErlaubt(bis) && von <= bis && tageDifferenz(von, bis) < 366) {
      const n = letzteTage(von, bis, heute)
      return n ? letzte(n, heute) : custom(von, bis)
    }
  }
  return monat(monatVon(heute))
}

/** Zeitraum einer Wahl im Kopf (Monat/Woche/7 Tage/30 Tage des Heute; `custom` übernimmt die aktuelle Spanne). */
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
    case 'custom': {
      // zurück bei den letzten 7/30 Tagen angekommen (← und wieder →): wieder die kurze Adresse
      const n = letzteTage(z.von, z.bis, heute)
      return n ? { zeitraum: n === 7 ? '7t' : '30t' } : { zeitraum: 'custom', von: z.von, bis: z.bis }
    }
  }
}

/**
 * Blättern: Monat → Vor-/Folgemonat, Woche → Vor-/Folgewoche, 7/30 Tage → um die eigene Länge verschoben (wird `custom`).
 * Mit `heute` endet eine Spanne von 7 oder 30 Tagen beim Vorwärtsblättern spätestens heute – sie ist dann wieder „Letzte 7 Tage“
 * bzw. „Letzte 30 Tage“. Blieb der Reiter über Nacht auf einer geblätterten Spanne stehen, führte → sonst daran vorbei in
 * eine Spanne, die fast ganz in der Zukunft liegt.
 */
export function verschoben(z: Zeitraum, richtung: -1 | 1, heute?: Tag): Zeitraum {
  if (z.art === 'monat') return monat(monatVon(monatePlus(z.von, richtung)))
  if (z.art === 'kw') {
    const k = kwVon(tagPlus(z.von, 7 * richtung))
    return kw(k.jahr, k.nr)
  }
  const n = tageDifferenz(z.von, z.bis) + 1
  const bis = tagPlus(z.bis, n * richtung)
  if (heute && richtung === 1 && (n === 7 || n === 30) && z.bis < heute && bis > heute) return letzte(n, heute)
  return custom(tagPlus(z.von, n * richtung), bis)
}

/** Vorwärts blättern ist aus, wenn der folgende Zeitraum ganz in der Zukunft läge. */
export function folgezeitraumMoeglich(z: Zeitraum, heute: Tag): boolean {
  return verschoben(z, 1).von <= heute
}

/** Dateline-Spanne „01.–14.10.2026“: bis höchstens heute. */
export function datelineSpanne(z: Zeitraum, heute: Tag): string {
  const bis = z.bis < heute ? z.bis : heute
  return spanneText(z.von, bis < z.von ? z.bis : bis)
}
