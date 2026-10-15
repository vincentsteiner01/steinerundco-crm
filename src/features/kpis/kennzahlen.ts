// BAUPLAN § 3.6 `kennzahlen.ts` / § 7.2 – Definitionen der Kennzahlen: Summen über v_metric_events, Quoten (Sheet-Formeln,
// null statt Division durch 0 → „–“), Kacheln je Kanal mit Delta/Prozentpunkten/Ziel, Funnel-Zeilen, die drei Hook-Kacheln
// (Ø Gesprächsdauer, E-Mail beantwortet, Widersprüche) und „Geantwortet nach Schritt“ (§ 7.3). Reine Funktionen.
import type { ActivityZeitraum } from '@/data/activities'
import { fmtDauer, fmtDelta, fmtPp, fmtProzent, fmtZahl, MINUS } from '@/lib/format'
import { tagPlus, tageDifferenz, type Tag } from '@/lib/zeit'
import type {
  Antwortzeit,
  Call,
  CallOutcomeDef,
  CounterPeriod,
  DailyActivity,
  Email,
  FunnelMonat,
  LinkedinConnection,
  Metric,
  NoteVariant,
  Settings,
} from '@/types/domain'
import { kwVon, wochenStart } from './zeitraum'

export type Summen = Partial<Record<Metric, number>>
export type Quoten = {
  annahme_quote: number | null
  antwort_quote: number | null
  pitch_quote: number | null
  erstgespraech_quote: number | null
  strategiegespraech_quote: number | null
  kunden_quote: number | null
  connect_rate: number | null
  entscheider_quote: number | null
  termine_pro_100_anrufe: number | null
  termin_quote_gespraech: number | null
}
export type FunnelWerte = { summen: Summen; quoten: Quoten }
export type Fussnote = 'zaehler' | 'sheet' | null
export type Ziele = Settings['kpi_targets']

/** `null` statt Division durch 0 (§ 7.1). */
export const quote = (z: number | null | undefined, n: number | null | undefined): number | null =>
  n ? (z ?? 0) / n : null

export const wert = (s: Summen, m: Metric): number => s[m] ?? 0

/** Quoten identisch mit v_funnel_monthly (§ 7.2). */
export function quotenAus(s: Summen): Quoten {
  return {
    annahme_quote: quote(s.vernetzungen_angenommen, s.vernetzungen_versendet),
    antwort_quote: quote(s.dm_beantwortet, s.gespraeche_eroeffnet),
    pitch_quote: quote(s.erstgespraech_gepitcht, s.dm_beantwortet),
    erstgespraech_quote: quote(s.erstgespraeche, s.erstgespraech_gepitcht),
    strategiegespraech_quote: quote(s.strategiegespraeche, s.erstgespraeche),
    kunden_quote: quote(s.kunden_gewonnen, s.strategiegespraeche),
    connect_rate: quote(s.anrufe_erreicht, s.anrufe),
    entscheider_quote: quote(s.entscheider_gespraeche, s.anrufe),
    termine_pro_100_anrufe: s.anrufe ? ((s.termine_telefon ?? 0) * 100) / s.anrufe : null,
    termin_quote_gespraech: quote(s.termine_telefon, s.entscheider_gespraeche),
  }
}

export const ausSummen = (summen: Summen): FunnelWerte => ({ summen, quoten: quotenAus(summen) })
export const LEERE_WERTE: FunnelWerte = ausSummen({})

const METRIKEN: readonly Metric[] = [
  'vernetzungen_versendet',
  'vernetzungen_angenommen',
  'ausstehend',
  'gespraeche_eroeffnet',
  'dm_beantwortet',
  'erstgespraech_gepitcht',
  'erstgespraeche_vereinbart',
  'erstgespraeche',
  'strategiegespraeche',
  'kunden_gewonnen',
  'erstgespraech_no_show',
  'erstgespraech_abgesagt',
  'strategiegespraech_no_show',
  'strategiegespraech_abgesagt',
  'anrufe',
  'anrufe_erreicht',
  'entscheider_gespraeche',
  'termine_telefon',
  'emails_gesendet',
]

/** Monatsansicht: v_funnel_monthly 1:1 (Summen + vorberechnete Quoten, K-01/K-02). */
export function ausFunnelMonat(f: FunnelMonat | null | undefined): FunnelWerte {
  if (!f) return LEERE_WERTE
  const summen: Summen = {}
  for (const m of METRIKEN) summen[m] = f[m] ?? 0
  return {
    summen,
    quoten: {
      annahme_quote: f.annahme_quote,
      antwort_quote: f.antwort_quote,
      pitch_quote: f.pitch_quote,
      erstgespraech_quote: f.erstgespraech_quote,
      strategiegespraech_quote: f.strategiegespraech_quote,
      kunden_quote: f.kunden_quote,
      connect_rate: f.connect_rate,
      entscheider_quote: f.entscheider_quote,
      termine_pro_100_anrufe: f.termine_pro_100_anrufe,
      termin_quote_gespraech: quote(f.termine_telefon, f.entscheider_gespraeche),
    },
  }
}

export type EventZeile = {
  metric: Metric | null
  value: number | null
  period: CounterPeriod | null
  source: string | null
}

/**
 * Summen je Metrik über v_metric_events-Zeilen. `monatszaehler = false` lässt `period = 'monat'` (Sheet-Monatswerte) aus –
 * sie zählen nur in der Monatsansicht (§ 3.6). `nurSheet` = Metriken, deren Wert ausschließlich aus Monatszählern stammt
 * (Badge „aus Sheet“, K-09).
 */
export function summiereEvents(
  zeilen: readonly EventZeile[],
  monatszaehler: boolean,
): { summen: Summen; nurSheet: Set<Metric> } {
  const summen: Summen = {}
  const ausSheet = new Set<Metric>()
  const ausAnderem = new Set<Metric>()
  for (const z of zeilen) {
    if (!z.metric) continue
    const v = z.value ?? 0
    if (z.period === 'monat') {
      if (!monatszaehler) continue
      if (v !== 0) ausSheet.add(z.metric)
    } else if (v !== 0) ausAnderem.add(z.metric)
    summen[z.metric] = (summen[z.metric] ?? 0) + v
  }
  const nurSheet = new Set<Metric>()
  for (const m of ausSheet) if (!ausAnderem.has(m)) nurSheet.add(m)
  return { summen, nurSheet }
}

// ── Kacheln (§ 7.4 Nr. 2) ──────────────────────────────────────────────────────────────────────────────────

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
  /** Quoten-Delta in Prozentpunkten */
  deltaPp: number | null
  /** Ziel: Anteil bei Quoten, Zahl bei dezimal/dauer */
  ziel: number | null
  zielArt: 'min' | 'max'
  erreicht: boolean | null
  fussnote: Fussnote
}

function kachel(k: Omit<Kachel, 'delta' | 'deltaPp' | 'erreicht'>): Kachel {
  const delta = k.art === 'prozent' ? null : k.wert !== null && k.vorWert !== null ? k.wert - k.vorWert : null
  const quoteJetzt = k.art === 'prozent' ? k.wert : k.quote
  const quoteVor = k.art === 'prozent' ? k.vorWert : k.vorQuote
  const deltaPp = quoteJetzt !== null && quoteVor !== null ? (quoteJetzt - quoteVor) * 100 : null
  const mess = k.art === 'zahl' ? k.quote : k.wert
  const erreicht = k.ziel === null || mess === null ? null : k.zielArt === 'max' ? mess <= k.ziel : mess >= k.ziel
  return { ...k, delta, deltaPp, erreicht }
}

const zahl = (
  key: string,
  label: string,
  w: FunnelWerte,
  v: FunnelWerte,
  metric: Metric,
  o: { quote?: keyof Quoten; ziel?: number | null; fussnote?: Fussnote } = {},
): Kachel =>
  kachel({
    key,
    label,
    art: 'zahl',
    wert: wert(w.summen, metric),
    quote: o.quote ? w.quoten[o.quote] : null,
    vorWert: wert(v.summen, metric),
    vorQuote: o.quote ? v.quoten[o.quote] : null,
    ziel: o.ziel ?? null,
    zielArt: 'min',
    fussnote: o.fussnote ?? null,
  })

export type LinkedinExtras = {
  antwortzeit: number | null
  antwortzeitVor: number | null
  /** daily_counters.source = 'manuell' im Zeitraum → Fußnote „Zähler, teilweise manuell“ */
  manuell: boolean
  nurSheet: Set<Metric>
}

export function kachelnLinkedin(w: FunnelWerte, v: FunnelWerte, e: LinkedinExtras, ziele: Ziele | undefined): Kachel[] {
  const fn = (m: Metric, zaehler = false): Fussnote =>
    e.nurSheet.has(m) ? 'sheet' : zaehler && e.manuell ? 'zaehler' : null
  return [
    zahl('vernetzungen_versendet', 'Vernetzung versendet', w, v, 'vernetzungen_versendet', {
      fussnote: fn('vernetzungen_versendet', true),
    }),
    zahl('vernetzungen_angenommen', 'Angenommen', w, v, 'vernetzungen_angenommen', {
      quote: 'annahme_quote',
      ziel: ziele?.annahme_quote ?? null,
      fussnote: fn('vernetzungen_angenommen'),
    }),
    zahl('gespraeche_eroeffnet', 'Gespräche eröffnet', w, v, 'gespraeche_eroeffnet', {
      fussnote: fn('gespraeche_eroeffnet'),
    }),
    zahl('dm_beantwortet', 'DM beantwortet', w, v, 'dm_beantwortet', {
      quote: 'antwort_quote',
      ziel: ziele?.antwort_quote ?? null,
      fussnote: fn('dm_beantwortet'),
    }),
    zahl('erstgespraeche', 'Erstgespräche', w, v, 'erstgespraeche', {
      quote: 'erstgespraech_quote',
      ziel: ziele?.erstgespraech_quote ?? null,
      fussnote: fn('erstgespraeche'),
    }),
    kachel({
      key: 'antwortzeit',
      label: 'Ø Antwortzeit',
      art: 'dezimal',
      wert: e.antwortzeit,
      quote: null,
      vorWert: e.antwortzeitVor,
      vorQuote: null,
      ziel: ziele?.antwortzeit_werktage ?? null,
      zielArt: 'max',
      fussnote: null,
    }),
  ]
}

export type TelefonExtras = { dauer: number | null; dauerVor: number | null; nurSheet: Set<Metric> }

export function kachelnTelefon(w: FunnelWerte, v: FunnelWerte, e: TelefonExtras, ziele: Ziele | undefined): Kachel[] {
  const fn = (m: Metric): Fussnote => (e.nurSheet.has(m) ? 'sheet' : null)
  return [
    zahl('anrufe', 'Dials', w, v, 'anrufe', { fussnote: fn('anrufe') }),
    zahl('anrufe_erreicht', 'Connects', w, v, 'anrufe_erreicht', {
      quote: 'connect_rate',
      ziel: ziele?.connect_rate ?? null,
      fussnote: fn('anrufe_erreicht'),
    }),
    zahl('entscheider_gespraeche', 'Entscheider', w, v, 'entscheider_gespraeche', {
      quote: 'entscheider_quote',
      ziel: ziele?.entscheider_quote ?? null,
      fussnote: fn('entscheider_gespraeche'),
    }),
    zahl('termine_telefon', 'Termine', w, v, 'termine_telefon', { fussnote: fn('termine_telefon') }),
    kachel({
      key: 'termine_pro_100_anrufe',
      label: 'Termine/100 Dials',
      art: 'dezimal',
      wert: w.quoten.termine_pro_100_anrufe,
      quote: null,
      vorWert: v.quoten.termine_pro_100_anrufe,
      vorQuote: null,
      ziel: ziele?.termine_pro_100_anrufe ?? null,
      zielArt: 'min',
      fussnote: null,
    }),
    kachel({
      key: 'gespraechsdauer',
      label: 'Ø Gesprächsdauer',
      art: 'dauer',
      wert: e.dauer,
      quote: null,
      vorWert: e.dauerVor,
      vorQuote: null,
      ziel: null,
      zielArt: 'min',
      fussnote: null,
    }),
  ]
}

export type EmailExtras = {
  beantwortet: number | null
  beantwortetVor: number | null
  widersprueche: number
  widerspruecheVor: number
  nurSheet: Set<Metric>
}

export function kachelnEmail(w: FunnelWerte, v: FunnelWerte, e: EmailExtras): Kachel[] {
  return [
    zahl('emails_gesendet', 'E-Mails gesendet', w, v, 'emails_gesendet', {
      fussnote: e.nurSheet.has('emails_gesendet') ? 'sheet' : null,
    }),
    kachel({
      key: 'email_beantwortet',
      label: 'Beantwortet',
      art: 'prozent',
      wert: e.beantwortet,
      quote: null,
      vorWert: e.beantwortetVor,
      vorQuote: null,
      ziel: null,
      zielArt: 'min',
      fussnote: null,
    }),
    kachel({
      key: 'widersprueche',
      label: 'Widersprüche',
      art: 'zahl',
      wert: e.widersprueche,
      quote: null,
      vorWert: e.widerspruecheVor,
      vorQuote: null,
      ziel: null,
      zielArt: 'min',
      fussnote: null,
    }),
  ]
}

// ── Formatierung der Kacheln (ux § 6.4; `–` bei null) ─────────────────────────────────────────────────────

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
      return fmtProzent(w)
    case 'dauer':
      return fmtDauer(w)
    case 'dezimal':
      return dezimal(w)
  }
}

/** „+38 · +11 pp“ · „+17“ · „−0,3“ · null, wenn keine Vorperiode. */
export function kachelDelta(k: Kachel): string | null {
  const teile: string[] = []
  if (k.delta !== null)
    teile.push(
      k.art === 'dauer' ? dauerDelta(k.delta) : k.art === 'dezimal' ? dezimalDelta(k.delta) : fmtDelta(k.delta),
    )
  if (k.deltaPp !== null) teile.push(fmtPp(k.deltaPp))
  return teile.length ? teile.join(' · ') : null
}

/** „vs. Sept. 288“ · „vs. Sept. 19 %“ */
export function kachelVergleich(k: Kachel, vorLabel: string): string | null {
  if (k.vorWert === null) return null
  const v = k.art === 'zahl' && k.vorQuote !== null ? fmtProzent(k.vorQuote) : formatWert(k.art, k.vorWert)
  return `vs. ${vorLabel} ${v}`
}

/** „Ziel ≥ 25 %“ · „Ziel ≤ 1,0“ */
export function kachelZiel(k: Kachel): string | null {
  if (k.ziel === null) return null
  const z = k.art === 'zahl' || k.art === 'prozent' ? fmtProzent(k.ziel) : dezimal(k.ziel)
  return `Ziel ${k.zielArt === 'max' ? '≤' : '≥'} ${z}`
}

// ── Funnel-Zeilen (§ 7.4 Nr. 3) ───────────────────────────────────────────────────────────────────────────

export type FunnelZeile = {
  metric: Metric
  nr: string
  label: string
  sub: boolean
  gross: boolean
  wert: number
  /** undefined = keine Konversionsspalte */
  quote?: number | null
  vorWert: number
  vorQuote?: number | null
  delta: number
  deltaPp: number | null
  ziel: number | null
  erreicht: boolean | null
  fussnote: Fussnote
  hinweis: string | null
  /** Klick → /leads (§ 7.5) */
  leads:
    | 'anfragen'
    | 'angenommen'
    | 'ereignis:gespraech_eroeffnet'
    | 'ereignis:nachricht_erhalten'
    | 'ereignis:pitch_gesendet'
    | 'termine'
    | 'termine:erstgespraech'
    | 'termine:strategiegespraech'
    | 'termine:vereinbart'
    | 'kunde'
    | null
}

export function funnelZeilen(
  w: FunnelWerte,
  v: FunnelWerte,
  ziele: Ziele | undefined,
  nurSheet: Set<Metric>,
  manuell: boolean,
): FunnelZeile[] {
  const zeile = (
    metric: Metric,
    nr: string,
    label: string,
    o: {
      sub?: boolean
      gross?: boolean
      quote?: keyof Quoten
      ziel?: number | null
      hinweis?: string
      leads?: FunnelZeile['leads']
      zaehler?: boolean
    },
  ): FunnelZeile => {
    const q = o.quote ? w.quoten[o.quote] : undefined
    const vq = o.quote ? v.quoten[o.quote] : undefined
    const wertJetzt = wert(w.summen, metric)
    const vorWert = wert(v.summen, metric)
    const ziel = o.ziel ?? null
    return {
      metric,
      nr,
      label,
      sub: !!o.sub,
      gross: !!o.gross,
      wert: wertJetzt,
      quote: q,
      vorWert,
      vorQuote: vq,
      delta: wertJetzt - vorWert,
      deltaPp: q !== undefined && q !== null && vq !== undefined && vq !== null ? (q - vq) * 100 : null,
      ziel,
      erreicht: ziel === null || q === undefined || q === null ? null : q >= ziel,
      fussnote: nurSheet.has(metric) ? 'sheet' : o.zaehler && manuell ? 'zaehler' : null,
      hinweis: o.hinweis ?? null,
      leads: o.leads ?? null,
    }
  }
  return [
    zeile('vernetzungen_versendet', '01', 'Vernetzung versendet', {
      gross: true,
      leads: 'anfragen',
      zaehler: true,
      hinweis: 'Tageszähler',
    }),
    zeile('vernetzungen_angenommen', '02', 'Angenommen', {
      gross: true,
      quote: 'annahme_quote',
      ziel: ziele?.annahme_quote,
      leads: 'angenommen',
    }),
    zeile('ausstehend', '—', 'Ausstehend', { sub: true, hinweis: 'Bestandsgröße, keine Konversion' }),
    zeile('gespraeche_eroeffnet', '03', 'Gespräche eröffnet', {
      leads: 'ereignis:gespraech_eroeffnet',
      hinweis: 'Summe der Tageswerte',
    }),
    zeile('dm_beantwortet', '04', 'DM beantwortet', {
      quote: 'antwort_quote',
      ziel: ziele?.antwort_quote,
      leads: 'ereignis:nachricht_erhalten',
    }),
    zeile('erstgespraech_gepitcht', '05', 'Erstgespräch gepitcht', {
      quote: 'pitch_quote',
      ziel: ziele?.pitch_quote,
      leads: 'ereignis:pitch_gesendet',
    }),
    zeile('erstgespraeche', '06', 'Erstgespräche', {
      quote: 'erstgespraech_quote',
      ziel: ziele?.erstgespraech_quote,
      leads: 'termine:erstgespraech',
      hinweis: 'stattgefunden',
    }),
    zeile('erstgespraeche_vereinbart', '—', 'Erstgespräche vereinbart', {
      sub: true,
      hinweis: 'nach Buchungsdatum, keine Konversion',
      leads: 'termine:vereinbart',
    }),
    zeile('strategiegespraeche', '07', 'Strategiegespräche', {
      quote: 'strategiegespraech_quote',
      leads: 'termine:strategiegespraech',
    }),
    zeile('kunden_gewonnen', '08', 'Kunden gewonnen', { quote: 'kunden_quote', leads: 'kunde' }),
  ]
}

// ── Hook-Kacheln (§ 1.5 Nr. 40, K-14/K-15) ────────────────────────────────────────────────────────────────

/** Ø Dauer (Sekunden) über ausgehende, nicht korrigierte Anrufe, deren Ergebnis `is_connect` ist; 0 Connects → null. */
export function gespraechsdauer(
  calls: readonly Pick<Call, 'outcome' | 'duration_sec' | 'corrected' | 'direction'>[],
  defs: readonly Pick<CallOutcomeDef, 'outcome' | 'is_connect'>[],
): number | null {
  const connect = new Set(defs.filter((d) => d.is_connect).map((d) => d.outcome))
  let summe = 0
  let n = 0
  for (const c of calls) {
    if (c.direction !== 'out' || c.corrected || !c.outcome || !connect.has(c.outcome)) continue
    summe += c.duration_sec ?? 0
    n++
  }
  return n ? summe / n : null
}

const GESENDET = new Set<Email['status']>(['sent', 'sent_confirmed', 'delivered', 'replied'])

/** `replied` ÷ gesendet (sent/sent_confirmed/delivered/replied); 0 gesendet → null. */
export function emailBeantwortetQuote(emails: readonly Pick<Email, 'status' | 'direction'>[]): number | null {
  let gesendet = 0
  let beantwortet = 0
  for (const e of emails) {
    if (e.direction !== 'out' || !GESENDET.has(e.status)) continue
    gesendet++
    if (e.status === 'replied') beantwortet++
  }
  return gesendet ? beantwortet / gesendet : null
}

/**
 * Widersprüche, die den Kanal E-Mail betreffen. Konfliktentscheid (BAUPLAN § 7.2/K-15 „channel = email“ ↔ Trigger
 * `leads_after_update`, der `widerspruch` immer mit `channel = sonstiges` und dem Umfang in `metadata.channels` loggt): gezählt wird
 * `channel = email` ODER ein Umfang mit `email` ODER die Trigger-Zeile ohne Kanalliste (= alle Kanäle) – sonst bliebe die Kachel
 * immer 0 (Review).
 */
export function widersprueche(
  acts: readonly (Pick<ActivityZeitraum, 'type' | 'channel'> & { kanaele?: ActivityZeitraum['kanaele'] })[],
): number {
  return acts.filter((a) => {
    if (a.type !== 'widerspruch') return false
    if (a.channel === 'email') return true
    const k = a.kanaele
    if (Array.isArray(k) && k.length > 0) return k.includes('email')
    return a.channel === 'sonstiges' // Trigger-Zeile ohne Kanalliste = Widerspruch für alle Kanäle
  }).length
}

export const EINGEHEND = new Set<ActivityZeitraum['type']>(['nachricht_erhalten', 'email_erhalten'])
export const AUSGEHEND = new Set<ActivityZeitraum['type']>([
  'gespraech_eroeffnet',
  'nachricht_gesendet',
  'pitch_gesendet',
  'email_gesendet',
])

type SchrittAktivitaet = Pick<ActivityZeitraum, 'lead_id' | 'type' | 'occurred_at' | 'step_id' | 'enrollment_id' | 'id'>

/**
 * „Geantwortet nach Schritt“ (§ 7.3): je eingehender Nachricht die letzte vorangehende ausgehende Aktivität desselben Leads
 * mit `step_id` (Sequenz-Schritt) → Zähler je `step_id`. Ein Durchlauf über die nach lead_id, occurred_at sortierten Zeilen.
 */
export function geantwortetNachSchritt(acts: readonly SchrittAktivitaet[]): Map<string, number> {
  const sortiert = [...acts].sort(
    (a, b) => a.lead_id.localeCompare(b.lead_id) || a.occurred_at.localeCompare(b.occurred_at) || a.id - b.id,
  )
  const zaehler = new Map<string, number>()
  const letzterSchrittJeLead = new Map<string, string>()
  for (const a of sortiert) {
    if (AUSGEHEND.has(a.type)) {
      if (a.step_id && a.enrollment_id) letzterSchrittJeLead.set(a.lead_id, a.step_id)
      else letzterSchrittJeLead.delete(a.lead_id) // Antwort außerhalb einer Sequenz zählt keinem Schritt
      continue
    }
    if (!EINGEHEND.has(a.type)) continue
    const s = letzterSchrittJeLead.get(a.lead_id)
    if (!s) continue
    zaehler.set(s, (zaehler.get(s) ?? 0) + 1)
    letzterSchrittJeLead.delete(a.lead_id) // eine Antwort je Schritt
  }
  return zaehler
}

/** Ø Werktage über beantwortete eingehende Nachrichten (v_antwortzeit); nichts beantwortet → null. Gerundet auf 0,1. */
export function antwortzeitSchnitt(zeilen: readonly Pick<Antwortzeit, 'werktage'>[]): number | null {
  const w = zeilen.map((z) => z.werktage).filter((x): x is number => x !== null)
  if (!w.length) return null
  return Math.round((w.reduce((a, b) => a + b, 0) / w.length) * 10) / 10
}

export type NotizVariante = {
  variante: NoteVariant
  gesamt: number
  angenommen: number
  annahmeQuote: number | null
  antworten: number
  antwortQuote: number | null
}

export const NOTIZ_VARIANTE_LABEL: Record<NoteVariant, string> = {
  ohne: 'Ohne Notiz',
  note_v1: 'Notiz V1',
  note_v2: 'Notiz V2',
}

/** Annahme-/Antwortquote je Notiz-Variante (§ 7.3): Antwort = Lead mit `nachricht_erhalten` unter den angenommenen. */
export function notizVarianten(
  connections: readonly Pick<LinkedinConnection, 'lead_id' | 'status' | 'accepted_at' | 'note_variant'>[],
  acts: readonly Pick<ActivityZeitraum, 'lead_id' | 'type'>[],
): NotizVariante[] {
  const geantwortet = new Set(acts.filter((a) => a.type === 'nachricht_erhalten').map((a) => a.lead_id))
  const out: NotizVariante[] = []
  for (const variante of ['ohne', 'note_v1', 'note_v2'] as const) {
    const c = connections.filter((x) => x.note_variant === variante)
    if (!c.length) continue
    const angenommen = c.filter((x) => x.status === 'angenommen' || x.accepted_at)
    const antworten = angenommen.filter((x) => geantwortet.has(x.lead_id)).length
    out.push({
      variante,
      gesamt: c.length,
      angenommen: angenommen.length,
      annahmeQuote: quote(angenommen.length, c.length),
      antworten,
      antwortQuote: quote(antworten, angenommen.length),
    })
  }
  return out
}

// ── Tagesverlauf + Wochentabelle (§ 7.4 Nr. 4) ────────────────────────────────────────────────────────────

export type TagesMetrik =
  | 'gespraeche_eroeffnet'
  | 'vernetzungen_versendet'
  | 'dm_beantwortet'
  | 'anrufe'
  | 'anrufe_erreicht'
  | 'emails_gesendet'
export type TagesMetrikDef = { key: TagesMetrik; label: string; kurz: string; kanal: 'linkedin' | 'telefon' | 'email' }
export const TAGES_METRIKEN: readonly TagesMetrikDef[] = [
  { key: 'gespraeche_eroeffnet', label: 'Gespräche eröffnet', kurz: 'Eröffnet', kanal: 'linkedin' },
  { key: 'vernetzungen_versendet', label: 'Anfragen', kurz: 'Anfragen', kanal: 'linkedin' },
  { key: 'dm_beantwortet', label: 'Antworten', kurz: 'Antworten', kanal: 'linkedin' },
  { key: 'anrufe', label: 'Dials', kurz: 'Dials', kanal: 'telefon' },
  { key: 'anrufe_erreicht', label: 'Connects', kurz: 'Connects', kanal: 'telefon' },
  { key: 'emails_gesendet', label: 'E-Mails gesendet', kurz: 'E-Mails', kanal: 'email' },
]
export type TagesWert = { tag: Tag; werte: Record<TagesMetrik, number> }

const leereWerte = (): Record<TagesMetrik, number> => ({
  gespraeche_eroeffnet: 0,
  vernetzungen_versendet: 0,
  dm_beantwortet: 0,
  anrufe: 0,
  anrufe_erreicht: 0,
  emails_gesendet: 0,
})

/** v_daily_activity-Zeilen (ggf. beider Personen) → ein Eintrag je Kalendertag des Zeitraums, fehlende Tage 0. */
export function tageswerte(
  zeilen: readonly Pick<DailyActivity, 'day' | TagesMetrik>[],
  von: Tag,
  bis: Tag,
): TagesWert[] {
  const n = tageDifferenz(von, bis)
  if (n < 0) return []
  const map = new Map<Tag, TagesWert>()
  for (let i = 0; i <= n; i++) {
    const tag = tagPlus(von, i)
    map.set(tag, { tag, werte: leereWerte() })
  }
  for (const z of zeilen) {
    const t = z.day ? map.get(z.day) : undefined
    if (!t) continue
    for (const m of TAGES_METRIKEN) t.werte[m.key] += z[m.key] ?? 0
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

/** Wochentabelle: KW-Zeilen über den Zeitraum; Wochen, die ihn nur anschneiden, zählen nur die Tage im Zeitraum (§ 1.5 Nr. 30). */
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
