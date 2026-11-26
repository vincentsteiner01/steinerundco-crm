// KPI-Reiter (26.11.2026, zurück aus dem alten CRM, verkleinert): Rechenkern über die Zeilen der Sicht crm.v_kpi_tage.
// Summen je Kennzahl, Quoten (null statt Division durch 0 → „–“), Kacheln mit Vergleich zur Vorperiode, Funnel-Zeilen,
// Tagesverlauf und Wochentabelle. Reine Funktionen – der rechnerische Teil (kachel, Wochen) stammt aus dem alten kennzahlen.ts
// (Tag archiv-crm-v1); Telefon, Sequenzen, Ziele und Sheets-Import sind entfallen.
// Nacharbeit 26.11.2026: Kacheln vergleichen Anzahl mit Anzahl („−38 vs. Okt. 160“) – nie eine Zahl mit einem Anteil, und ohne
// das Kürzel „pp“; Anteile stehen je Zeitraum nebeneinander im Funnel. Wo der Vergleich nicht stimmen kann (alte Monatszähler
// ohne Tageswerte), bleibt er leer.
import { fmtAnteil, fmtDauer, fmtDelta, fmtPp, fmtZahl, MINUS } from '@/lib/format'
import { isodow, tagPlus, tageDifferenz, type Tag } from '@/lib/zeit'
import { kwVon } from './zeitraum'

export const KENNZAHLEN = [
  'vernetzungen_versendet',
  'vernetzungen_angenommen',
  'angeschrieben',
  'gespraech',
  'im_geschaeft',
  'verloren',
  'emails_gesendet',
  'email_antworten',
] as const
export type Kennzahl = (typeof KENNZAHLEN)[number]
export type Summen = Record<Kennzahl, number>

/**
 * Zeile von crm.v_kpi_tage: je Person, Tag und Zählerart. `period = 'monat'` sind die alten Monatszähler (Tag = Monatserster,
 * nur September und Oktober 2026) – sie zählen nur in der Monatsansicht, nie im Tagesverlauf oder in der Wochentabelle.
 */
export type KpiZeile = { member_id: string | null; tag: Tag; period: 'tag' | 'monat' } & Summen

export function leereSummen(): Summen {
  return {
    vernetzungen_versendet: 0,
    vernetzungen_angenommen: 0,
    angeschrieben: 0,
    gespraech: 0,
    im_geschaeft: 0,
    verloren: 0,
    emails_gesendet: 0,
    email_antworten: 0,
  }
}

/** Summen je Kennzahl über alle Zeilen (Personen und Tage); Monatszähler nur mit `mitMonat` (Monatsansicht). */
export function summiere(zeilen: readonly KpiZeile[], mitMonat: boolean): Summen {
  const s = leereSummen()
  for (const z of zeilen) {
    if (z.period === 'monat' && !mitMonat) continue
    for (const k of KENNZAHLEN) s[k] += z[k]
  }
  return s
}

/**
 * Summen der Vorperiode; `null` = für diese Kennzahl gibt es keinen verlässlichen Vergleich (alte Monatszähler ohne
 * Tageswerte). Kacheln und Funnel zeigen dann „–“ statt einer zu kleinen Zahl.
 */
export type Vorsummen = Record<Kennzahl, number | null>

/** Kennzahlen, für die in den Zeilen ein alter Monatszähler (> 0) steht – in diesem Monat sind ihre Tageswerte nicht vollständig. */
export function mitMonatszaehler(zeilen: readonly KpiZeile[]): Set<Kennzahl> {
  const mit = new Set<Kennzahl>()
  for (const z of zeilen) if (z.period === 'monat') for (const k of KENNZAHLEN) if (z[k] > 0) mit.add(k)
  return mit
}

/**
 * Kennzahlen, für die in `alle` (Zeilen aller Personen) ein alter Monatszähler steht, in `eigene` für denselben Monat aber
 * keiner: Die Tageswerte dieses Monats sind unvollständig, und der gewählten Person fehlt die Zahl, die sie ergänzt.
 */
export function fremdeMonatszaehler(alle: readonly KpiZeile[], eigene: readonly KpiZeile[]): Set<Kennzahl> {
  const eigen = new Set<string>()
  for (const z of eigene) if (z.period === 'monat') for (const k of KENNZAHLEN) if (z[k] > 0) eigen.add(`${z.tag}|${k}`)
  const fremd = new Set<Kennzahl>()
  for (const z of alle)
    if (z.period === 'monat') for (const k of KENNZAHLEN) if (z[k] > 0 && !eigen.has(`${z.tag}|${k}`)) fremd.add(k)
  return fremd
}

/** Vorperiode ohne die genannten Kennzahlen (`null`): für sie fällt der Vergleich weg. */
export function ohneVergleich(vor: Summen, ohne: ReadonlySet<Kennzahl>): Vorsummen {
  const v: Vorsummen = { ...vor }
  for (const k of ohne) v[k] = null
  return v
}

/** Kennzahlen, deren Wert > 0 ausschließlich aus Monatszählern stammt (Marke „aus Sheet“); leer, wenn sie nicht mitzählen. */
export function nurAusMonat(zeilen: readonly KpiZeile[], mitMonat: boolean): ReadonlySet<Kennzahl> {
  const nur = new Set<Kennzahl>()
  if (!mitMonat) return nur
  const ausTagen = new Set<Kennzahl>()
  for (const z of zeilen) for (const k of KENNZAHLEN) if (z[k] !== 0) (z.period === 'monat' ? nur : ausTagen).add(k)
  for (const k of ausTagen) nur.delete(k)
  return nur
}

/** `null` statt Division durch 0. */
export function quote(z: number, n: number): number | null {
  return n > 0 ? z / n : null
}

/** Quote der Vorperiode; ohne verlässlichen Zähler oder Nenner (`null`) keine. */
const vorQuoteVon = (z: number | null, n: number | null): number | null =>
  z === null || n === null ? null : quote(z, n)

/**
 * Unterschied zweier Anteile in Prozentpunkten – aus den gerundeten Prozenten, wie sie angezeigt werden: 0 % gegen 2 % sind
 * −2 (aus den ungerundeten Anteilen 0 und 1,5 % würde −1,5 und gerundet −1).
 */
const prozentpunkte = (jetzt: number, vor: number): number => Math.round(jetzt * 100) - Math.round(vor * 100)

// ── Kacheln ────────────────────────────────────────────────────────────────────────────────────────────────

export type Fussnote = 'zaehler' | 'sheet' | null
export type KachelArt = 'zahl' | 'prozent' | 'dauer' | 'dezimal'
export type Kachel = {
  key: string
  label: string
  /** Hauptwert: Anzahl (zahl), Anteil 0…1 (prozent), Sekunden (dauer), Kommazahl (dezimal) */
  wert: number | null
  art: KachelArt
  /** Zweiter Wert als Anteil 0…1 neben der Zahl („93 · 30 %“) */
  quote: number | null
  vorWert: number | null
  vorQuote: number | null
  /** Wert − Vorperiode (zahl/dauer/dezimal) */
  delta: number | null
  /** Quoten-Delta in Prozentpunkten (aus den gerundeten Prozenten) */
  deltaPp: number | null
  /** Ziel: Anteil bei Quoten, Zahl bei dezimal/dauer – der Reiter vergibt keine Ziele mehr, immer null */
  ziel: number | null
  zielArt: 'min' | 'max'
  erreicht: boolean | null
  fussnote: Fussnote
}

function kachel(k: Omit<Kachel, 'delta' | 'deltaPp' | 'erreicht'>): Kachel {
  const delta = k.art === 'prozent' ? null : k.wert !== null && k.vorWert !== null ? k.wert - k.vorWert : null
  const quoteJetzt = k.art === 'prozent' ? k.wert : k.quote
  const quoteVor = k.art === 'prozent' ? k.vorWert : k.vorQuote
  const deltaPp = quoteJetzt !== null && quoteVor !== null ? prozentpunkte(quoteJetzt, quoteVor) : null
  const mess = k.art === 'zahl' ? k.quote : k.wert
  const erreicht = k.ziel === null || mess === null ? null : k.zielArt === 'max' ? mess <= k.ziel : mess >= k.ziel
  return { ...k, delta, deltaPp, erreicht }
}

/** Zahl-Kachel einer Kennzahl; `von` = Vorstufe, auf die sich die Quote bezieht. */
const zahl = (
  metric: Kennzahl,
  label: string,
  werte: Summen,
  vor: Vorsummen,
  o: { von?: Kennzahl; sheet?: ReadonlySet<Kennzahl> } = {},
): Kachel =>
  kachel({
    key: metric,
    label,
    art: 'zahl',
    wert: werte[metric],
    quote: o.von ? quote(werte[metric], werte[o.von]) : null,
    vorWert: vor[metric],
    vorQuote: o.von ? vorQuoteVon(vor[metric], vor[o.von]) : null,
    ziel: null,
    zielArt: 'min',
    fussnote: o.sheet?.has(metric) ? 'sheet' : null,
  })

/** Die sechs Kacheln des Boards: zwei Tageszähler (Vernetzungen), dann die Listen des Boards. */
export function kachelnBoard(werte: Summen, vor: Vorsummen, sheet: ReadonlySet<Kennzahl>): Kachel[] {
  return [
    zahl('vernetzungen_versendet', 'Vernetzungen versendet', werte, vor, { sheet }),
    zahl('vernetzungen_angenommen', 'Angenommen', werte, vor, { von: 'vernetzungen_versendet', sheet }),
    zahl('angeschrieben', 'Angeschrieben', werte, vor, { sheet }),
    zahl('gespraech', 'Gespräch vereinbart', werte, vor, { von: 'angeschrieben', sheet }),
    zahl('im_geschaeft', 'Im Geschäft', werte, vor, { von: 'gespraech', sheet }),
    zahl('verloren', 'Verloren', werte, vor, { sheet }),
  ]
}

export function kachelnEmail(werte: Summen, vor: Vorsummen): Kachel[] {
  return [
    zahl('emails_gesendet', 'E-Mails gesendet', werte, vor),
    zahl('email_antworten', 'Antworten', werte, vor, { von: 'emails_gesendet' }),
  ]
}

// ── Formatierung der Kacheln (`–` bei null) ───────────────────────────────────────────────────────────────

const dezimal = (n: number): string => n.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const dezimalDelta = (n: number): string => {
  const r = Math.round(n * 10) / 10
  if (r === 0) return '±0,0'
  return `${r > 0 ? '+' : MINUS}${dezimal(Math.abs(r))}`
}
const dauerDelta = (n: number): string => {
  const r = Math.round(n)
  if (r === 0) return '±00:00'
  return `${r > 0 ? '+' : MINUS}${fmtDauer(Math.abs(r))}`
}

export function formatWert(art: KachelArt, w: number | null): string {
  if (w === null) return '–'
  switch (art) {
    case 'zahl':
      return fmtZahl(w)
    case 'prozent':
      return fmtAnteil(w)
    case 'dauer':
      return fmtDauer(w)
    case 'dezimal':
      return dezimal(w)
  }
}

/**
 * Veränderung des Hauptwerts: „+17“ (Anzahl) · „−0,3“ · „+00:12“; nur eine Prozent-Kachel nennt Prozentpunkte („+11 pp“).
 * `null`, wenn es keinen Vergleich gibt.
 */
export function kachelDelta(k: Kachel): string | null {
  if (k.art === 'prozent') return k.deltaPp !== null ? fmtPp(k.deltaPp) : null
  if (k.delta === null) return null
  return k.art === 'dauer' ? dauerDelta(k.delta) : k.art === 'dezimal' ? dezimalDelta(k.delta) : fmtDelta(k.delta)
}

/** Hauptwert der Vorperiode in derselben Einheit wie die Kachel: „vs. Sept. 288“ (Anzahl) · „vs. Sept. 19 %“ (Prozent-Kachel). */
export function kachelVergleich(k: Kachel, vorLabel: string): string | null {
  if (k.vorWert === null) return null
  return `vs. ${vorLabel} ${formatWert(k.art, k.vorWert)}`
}

/** „Ziel ≥ 25 %“ · „Ziel ≤ 1,0“ */
export function kachelZiel(k: Kachel): string | null {
  if (k.ziel === null) return null
  const z = k.art === 'zahl' || k.art === 'prozent' ? fmtAnteil(k.ziel) : dezimal(k.ziel)
  return `Ziel ${k.zielArt === 'max' ? '≤' : '≥'} ${z}`
}

// ── Funnel-Zeilen ─────────────────────────────────────────────────────────────────────────────────────────

export type FunnelZeile = {
  metric: Kennzahl
  nr: string
  label: string
  sub: boolean
  gross: boolean
  wert: number
  /** undefined = keine Konversionsspalte */
  quote?: number | null
  /** `null` = kein verlässlicher Vergleich (siehe Vorsummen) – dann ist auch `delta` null */
  vorWert: number | null
  vorQuote?: number | null
  delta: number | null
  deltaPp: number | null
  ziel: number | null
  erreicht: boolean | null
  fussnote: Fussnote
  hinweis: string | null
}

/**
 * Fünf Stufen von der Vernetzung bis zum Geschäft, Quote = Anteil zur Vorstufe. Die Stufen zählen je Tag ihres Eintretens –
 * eine Quote über 100 % ist möglich (z. B. Annahmen dieser Woche auf Anfragen der Vorwoche) und wird so gezeigt.
 * „Angeschrieben“ hat wie die erste Stufe keine Quote (auch die Kachel nicht): die Karten des Boards sind keine Teilmenge
 * der von Hand gezählten Annahmen – mit den echten Zahlen stand dort regelmäßig über 100 %.
 */
export function funnelZeilen(werte: Summen, vor: Vorsummen, sheet: ReadonlySet<Kennzahl>): FunnelZeile[] {
  const zeile = (
    metric: Kennzahl,
    nr: string,
    label: string,
    o: { gross?: boolean; von?: Kennzahl } = {},
  ): FunnelZeile => {
    const q = o.von ? quote(werte[metric], werte[o.von]) : undefined
    const vq = o.von ? vorQuoteVon(vor[metric], vor[o.von]) : undefined
    const vorWert = vor[metric]
    return {
      metric,
      nr,
      label,
      sub: false,
      gross: !!o.gross,
      wert: werte[metric],
      quote: q,
      vorWert,
      vorQuote: vq,
      delta: vorWert === null ? null : werte[metric] - vorWert,
      deltaPp: q !== undefined && q !== null && vq !== undefined && vq !== null ? prozentpunkte(q, vq) : null,
      ziel: null,
      erreicht: null,
      fussnote: sheet.has(metric) ? 'sheet' : null,
      hinweis: null,
    }
  }
  return [
    zeile('vernetzungen_versendet', '01', 'Vernetzungen versendet', { gross: true }),
    zeile('vernetzungen_angenommen', '02', 'Angenommen', { gross: true, von: 'vernetzungen_versendet' }),
    zeile('angeschrieben', '03', 'Angeschrieben'),
    zeile('gespraech', '04', 'Gespräch vereinbart', { von: 'angeschrieben' }),
    zeile('im_geschaeft', '05', 'Im Geschäft', { von: 'gespraech' }),
  ]
}

// ── Tagesverlauf + Wochentabelle ──────────────────────────────────────────────────────────────────────────

export type TagesMetrik =
  | 'angeschrieben'
  | 'vernetzungen_versendet'
  | 'vernetzungen_angenommen'
  | 'gespraech'
  | 'im_geschaeft'
  | 'verloren'
  | 'emails_gesendet'
export type TagesMetrikDef = { key: TagesMetrik; label: string; kurz: string }
export const TAGES_METRIKEN: TagesMetrikDef[] = [
  { key: 'angeschrieben', label: 'Angeschrieben', kurz: 'Angeschrieben' },
  { key: 'vernetzungen_versendet', label: 'Vernetzungen versendet', kurz: 'Vernetzungen' },
  { key: 'vernetzungen_angenommen', label: 'Angenommen', kurz: 'Angenommen' },
  { key: 'gespraech', label: 'Gespräch vereinbart', kurz: 'Gespräche' },
  { key: 'im_geschaeft', label: 'Im Geschäft', kurz: 'Im Geschäft' },
  { key: 'verloren', label: 'Verloren', kurz: 'Verloren' },
  { key: 'emails_gesendet', label: 'E-Mails gesendet', kurz: 'E-Mails' },
]
export type TagesWert = { tag: Tag; werte: Record<TagesMetrik, number> }

const leereWerte = (): Record<TagesMetrik, number> => ({
  angeschrieben: 0,
  vernetzungen_versendet: 0,
  vernetzungen_angenommen: 0,
  gespraech: 0,
  im_geschaeft: 0,
  verloren: 0,
  emails_gesendet: 0,
})

/** Zeilen (ggf. mehrerer Personen) → ein Eintrag je Kalendertag des Zeitraums, fehlende Tage 0. Monatszähler zählen nie. */
export function tageswerte(zeilen: readonly KpiZeile[], von: Tag, bis: Tag): TagesWert[] {
  const n = tageDifferenz(von, bis)
  if (n < 0) return []
  const map = new Map<Tag, TagesWert>()
  for (let i = 0; i <= n; i++) {
    const tag = tagPlus(von, i)
    map.set(tag, { tag, werte: leereWerte() })
  }
  for (const z of zeilen) {
    if (z.period !== 'tag') continue
    const t = map.get(z.tag)
    if (!t) continue
    for (const m of TAGES_METRIKEN) t.werte[m.key] += z[m.key]
  }
  return [...map.values()]
}

export type WochenZeile = {
  kw: number
  jahr: number
  /** Montag–Sonntag der ISO-Woche (auch wenn sie den Zeitraum nur anschneidet) */
  von: Tag
  bis: Tag
  werte: Record<TagesMetrik, number>
  /** Tage der Woche, die im Zeitraum liegen */
  tage: number
  aktuell: boolean
}

/** Montag der Woche eines Tags. */
const wochenStart = (tag: Tag): Tag => tagPlus(tag, 1 - isodow(tag))

/** Wochentabelle: KW-Zeilen über den Zeitraum; Wochen, die ihn nur anschneiden, zählen nur die Tage im Zeitraum. */
export function wochen(tage: readonly TagesWert[], heute: Tag): WochenZeile[] {
  const out: WochenZeile[] = []
  const heuteStart = wochenStart(heute)
  for (const t of tage) {
    const start = wochenStart(t.tag)
    let z = out[out.length - 1]
    if (!z || z.von !== start) {
      const k = kwVon(t.tag)
      z = {
        kw: k.nr,
        jahr: k.jahr,
        von: start,
        bis: tagPlus(start, 6),
        werte: leereWerte(),
        tage: 0,
        aktuell: start === heuteStart,
      }
      out.push(z)
    }
    z.tage++
    for (const m of TAGES_METRIKEN) z.werte[m.key] += t.werte[m.key]
  }
  return out
}

export function summeWochen(zeilen: readonly WochenZeile[]): Record<TagesMetrik, number> {
  const s = leereWerte()
  for (const z of zeilen) for (const m of TAGES_METRIKEN) s[m.key] += z.werte[m.key]
  return s
}
