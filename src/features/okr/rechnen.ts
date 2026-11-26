// Reiter „Ziele“ (OKR, 26.11.2026): Typen und die ganze Rechnerei – reine Funktionen, ohne React und ohne Datenbank.
// Ein Ziel (Objective) hat Key Results. Jedes Key Result hat einen Zielwert mit Takt (ganzer Zeitraum | je Woche | je Tag),
// gilt fürs Team oder je Person und bekommt seine Zahl entweder von selbst aus dem CRM (Sicht v_kpi_tage) oder von Hand.
// Woche und Heute sind keine eigenen Ziele: Sie ergeben sich aus dem Zielwert, verteilt auf die zählenden Tage
// (Werktage ohne Feiertage; bei E-Mails alle Tage, weil der Versand auch am Wochenende läuft).
import type { KpiZeile } from '@/features/kpis/kennzahlen'
import { monatLabel } from '@/lib/format'
import { FEIERTAGE_HH, istWerktag } from '@/lib/werktage'
import { isodow, monatePlus, tagPlus, type Tag } from '@/lib/zeit'

export const EBENEN = ['jahr', 'quartal', 'monat'] as const
export type Ebene = (typeof EBENEN)[number]
export const TAKTE = ['zeitraum', 'woche', 'tag'] as const
export type Takt = (typeof TAKTE)[number]
export const QUELLEN = [
  'manuell',
  'angeschrieben',
  'vernetzungen_versendet',
  'vernetzungen_angenommen',
  'gespraech',
  'im_geschaeft',
  'emails_gesendet',
  'email_antworten',
] as const
export type Quelle = (typeof QUELLEN)[number]

export type OkrZiel = { id: string; titel: string; ebene: Ebene; von: Tag; bis: Tag; position: number }
export type OkrErgebnis = {
  id: string
  ziel_id: string
  titel: string
  zielwert: number
  takt: Takt
  /** true: der Zielwert gilt für jede Person einzeln */
  je_person: boolean
  quelle: Quelle
  /** rechnet die gezählte Zahl um (Neukunden × Kundenwert = Umsatz); sonst 1 */
  faktor: number
  einheit: string | null
  position: number
}
/** Von Hand gezählter Fortschritt: je Key Result, Person und Tag eine Zeile. */
export type OkrEintrag = { ergebnis_id: string; member_id: string; tag: Tag; wert: number }
export type OkrTodo = {
  id: string
  ergebnis_id: string
  text: string
  /** wer es erledigt; null = beide */
  member_id: string | null
  erledigt_at: string | null
  position: number
}
export type OkrDaten = { ziele: OkrZiel[]; ergebnisse: OkrErgebnis[]; eintraege: OkrEintrag[]; todos: OkrTodo[] }

export const EBENE_LABEL: Record<Ebene, string> = { jahr: 'Jahr', quartal: 'Quartal', monat: 'Monat' }
export const TAKT_LABEL: Record<Takt, string> = { zeitraum: 'im ganzen Zeitraum', woche: 'je Woche', tag: 'je Tag' }
/** Woher die Zahl kommt – so steht es in der Auswahl „Wie wird gezählt?“. */
export const QUELLE_LABEL: Record<Quelle, string> = {
  manuell: 'Wir zählen von Hand',
  angeschrieben: 'DMs (Karten in „Angeschrieben“)',
  vernetzungen_versendet: 'Vernetzungen versendet (eure Tageszahlen)',
  vernetzungen_angenommen: 'Vernetzungen angenommen (eure Tageszahlen)',
  gespraech: 'Gespräche vereinbart',
  im_geschaeft: 'Neukunden (Karten in „Im Geschäft“)',
  emails_gesendet: 'E-Mails gesendet',
  email_antworten: 'E-Mail-Antworten',
}

// ── Zeiträume ───────────────────────────────────────────────────────────────────────────────────────────────

const spaeter = (a: Tag, b: Tag): Tag => (a > b ? a : b)
const frueher = (a: Tag, b: Tag): Tag => (a < b ? a : b)

export const monatsErster = (tag: Tag): Tag => `${tag.slice(0, 7)}-01`
export const monatsLetzter = (tag: Tag): Tag => tagPlus(monatePlus(monatsErster(tag), 1), -1)

const MONATE: Record<Ebene, number> = { monat: 1, quartal: 3, jahr: 12 }

/** Zeitraum eines Ziels ab einem Startmonat: Monat = 1, Quartal = 3, Jahr = 12 Monate. */
export function zeitraumFuer(ebene: Ebene, start: Tag): { von: Tag; bis: Tag } {
  const von = monatsErster(start)
  return { von, bis: tagPlus(monatePlus(von, MONATE[ebene]), -1) }
}

const MONAT_KURZ = ['Jan.', 'Febr.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.']
const monatKurz = (tag: Tag): string => `${MONAT_KURZ[Number(tag.slice(5, 7)) - 1] ?? ''} ${tag.slice(0, 4)}`

/** „Dezember 2026“ · „Dez. 2026 – Febr. 2027“ */
export function zeitraumText(z: Pick<OkrZiel, 'von' | 'bis'>): string {
  if (z.von.slice(0, 7) === z.bis.slice(0, 7)) return monatLabel(z.von)
  return `${monatKurz(z.von)} – ${monatKurz(z.bis)}`
}

const nachPosition = <T extends { position: number; titel: string }>(a: T, b: T): number =>
  a.position - b.position || a.titel.localeCompare(b.titel, 'de')

/**
 * Was die Seite für einen Monat zeigt: oben die großen Ziele (Jahr, dann Quartal), die den Monat berühren, darunter die
 * Monatsziele.
 */
export function sichtbareZiele(ziele: readonly OkrZiel[], monat: Tag): { gross: OkrZiel[]; monat: OkrZiel[] } {
  const von = monatsErster(monat)
  const bis = monatsLetzter(monat)
  const beruehrt = ziele.filter((z) => z.von <= bis && z.bis >= von)
  const rang = (z: OkrZiel) => (z.ebene === 'jahr' ? 0 : 1)
  return {
    gross: beruehrt.filter((z) => z.ebene !== 'monat').sort((a, b) => rang(a) - rang(b) || nachPosition(a, b)),
    monat: beruehrt.filter((z) => z.ebene === 'monat').sort(nachPosition),
  }
}

/** Startmonat der Seite: der laufende Monat, wenn er Monatsziele hat – sonst der nächste Monat mit Zielen, sonst der laufende. */
export function startMonat(ziele: readonly OkrZiel[], heute: Tag): Tag {
  const jetzt = monatsErster(heute)
  const monate = ziele
    .filter((z) => z.ebene === 'monat')
    .map((z) => monatsErster(z.von))
    .sort()
  if (monate.includes(jetzt)) return jetzt
  return monate.find((m) => m > jetzt) ?? jetzt
}

/** Anteil der vergangenen Kalendertage eines Zeitraums, 0…1 (heute zählt mit). */
export function zeitAnteil(z: Pick<OkrZiel, 'von' | 'bis'>, heute: Tag): number {
  if (heute < z.von) return 0
  if (heute >= z.bis) return 1
  let alle = 0
  let vorbei = 0
  for (let t = z.von; t <= z.bis; t = tagPlus(t, 1)) {
    alle++
    if (t <= heute) vorbei++
  }
  return alle ? vorbei / alle : 0
}

// ── Zählende Tage und Soll ────────────────────────────────────────────────────────────────────────────────────

export type Zaehltage = 'werktage' | 'alle'
const TAGE_JE_WOCHE: Record<Zaehltage, number> = { werktage: 5, alle: 7 }

/** E-Mails gehen auch am Wochenende raus – alles andere wird an Werktagen erledigt. */
export function zaehltageVon(quelle: Quelle): Zaehltage {
  return quelle === 'emails_gesendet' || quelle === 'email_antworten' ? 'alle' : 'werktage'
}

export function zaehlt(tag: Tag, art: Zaehltage, feiertage: readonly Tag[] = FEIERTAGE_HH): boolean {
  return art === 'alle' || istWerktag(tag, feiertage)
}

/** Zählende Tage von `von` bis `bis` (beide inklusive); 0, wenn `bis` vor `von` liegt. */
export function anzahlTage(von: Tag, bis: Tag, art: Zaehltage, feiertage: readonly Tag[] = FEIERTAGE_HH): number {
  let n = 0
  for (let t = von; t <= bis; t = tagPlus(t, 1)) if (zaehlt(t, art, feiertage)) n++
  return n
}

type Spanne = Pick<OkrZiel, 'von' | 'bis'>

/** Zielwert je zählendem Tag. */
export function proTag(e: OkrErgebnis, ziel: Spanne, feiertage: readonly Tag[] = FEIERTAGE_HH): number {
  const art = zaehltageVon(e.quelle)
  if (e.takt === 'tag') return e.zielwert
  if (e.takt === 'woche') return e.zielwert / TAGE_JE_WOCHE[art]
  const n = anzahlTage(ziel.von, ziel.bis, art, feiertage)
  return n > 0 ? e.zielwert / n : 0
}

/** Soll für den Ausschnitt `von`–`bis` (auf den Zeitraum des Ziels beschnitten), ungerundet. */
export function soll(
  e: OkrErgebnis,
  ziel: Spanne,
  von: Tag,
  bis: Tag,
  feiertage: readonly Tag[] = FEIERTAGE_HH,
): number {
  const a = spaeter(von, ziel.von)
  const b = frueher(bis, ziel.bis)
  if (b < a) return 0
  // der ganze Zeitraum ist genau der Zielwert – ohne Rundungsrest aus der Division
  if (e.takt === 'zeitraum' && a === ziel.von && b === ziel.bis) return e.zielwert
  return proTag(e, ziel, feiertage) * anzahlTage(a, b, zaehltageVon(e.quelle), feiertage)
}

/** Soll als ganze Zahl für die Anzeige: aufgerundet – wer Wochen- und Tagesziel schafft, schafft auch das Ganze. */
export const aufgerundet = (x: number): number => Math.ceil(x - 1e-9)

/** Montag bis Sonntag der Woche, in der `tag` liegt. */
export function wocheVon(tag: Tag): { von: Tag; bis: Tag } {
  const von = tagPlus(tag, 1 - isodow(tag))
  return { von, bis: tagPlus(von, 6) }
}

// ── Ist ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Zahlen = { kpi: readonly KpiZeile[]; eintraege: readonly OkrEintrag[] }

/**
 * Gezählter Wert eines Key Results im Ausschnitt `von`–`bis`. `memberId = null` = alle Personen zusammen.
 * Aus dem CRM: Tageszeilen von v_kpi_tage (die alten Monatszähler zählen hier nie). Von Hand: die Einträge des Key Results.
 */
export function istWert(e: OkrErgebnis, memberId: string | null, zahlen: Zahlen, von: Tag, bis: Tag): number {
  let summe = 0
  if (e.quelle === 'manuell') {
    for (const x of zahlen.eintraege) {
      if (x.ergebnis_id !== e.id || x.tag < von || x.tag > bis) continue
      if (memberId !== null && x.member_id !== memberId) continue
      summe += x.wert
    }
  } else {
    for (const z of zahlen.kpi) {
      if (z.period !== 'tag' || z.tag < von || z.tag > bis) continue
      if (memberId !== null && z.member_id !== memberId) continue
      summe += z[e.quelle]
    }
  }
  return summe * e.faktor
}

/** Alles, was je für ein von Hand gezähltes Key Result eingetragen wurde – auch nachgetragen nach Ende des Zeitraums. */
const ALLE_TAGE = { von: '0000-01-01', bis: '9999-12-31' } as const

// ── Fortschritt und Ampel ─────────────────────────────────────────────────────────────────────────────────────

export const STATUS = ['geschafft', 'im_plan', 'knapp', 'hinten', 'offen', 'verfehlt'] as const
export type Status = (typeof STATUS)[number]
export const STATUS_LABEL: Record<Status, string> = {
  geschafft: 'Geschafft',
  im_plan: 'Im Plan',
  knapp: 'Knapp',
  hinten: 'Hinten',
  offen: 'Offen',
  verfehlt: 'Verfehlt',
}

/** Ab diesem Anteil am Soll bis gestern gilt „Knapp“ statt „Hinten“. */
const KNAPP_AB = 0.7

/**
 * Ampel eines Key Results. Verglichen wird mit dem Soll bis GESTERN – der Morgen eines Tages gilt nicht als Rückstand.
 * „Im Plan“ misst gegen das abgerundete Soll: bei kleinen Zielen (4 Beiträge im Monat) reicht 1 von 1,6.
 */
export function ampel(ist: number, sollGesamt: number, sollBisGestern: number, ziel: Spanne, heute: Tag): Status {
  if (sollGesamt <= 0) return 'offen'
  if (ist >= sollGesamt - 1e-9) return 'geschafft'
  if (heute < ziel.von) return 'offen'
  if (heute > ziel.bis) return 'verfehlt'
  if (ist >= Math.floor(sollBisGestern + 1e-9)) return 'im_plan'
  return ist >= sollBisGestern * KNAPP_AB ? 'knapp' : 'hinten'
}

export type IstSoll = { ist: number; soll: number }
export type Fortschritt = {
  /** null = das Team zusammen */
  memberId: string | null
  ist: number
  /** Soll für den ganzen Zeitraum */
  soll: number
  /** Ist ÷ Soll, 0…1 (bei 1 gedeckelt) – die Länge des Balkens */
  anteil: number
  /** wo man heute stehen müsste, 0…1 – der Strich auf dem Balken (Soll bis gestern ÷ Soll) */
  tempo: number
  status: Status
  /** nur wenn heute im Zeitraum liegt und das Soll der Woche mindestens ein (knappes) Ganzes ist */
  woche: IstSoll | null
  /** nur wenn heute im Zeitraum liegt, ein zählender Tag ist und das Soll des Tages mindestens ein (knappes) Ganzes ist */
  heute: IstSoll | null
}

/**
 * Ab diesem (ungerundeten) Soll gibt es ein Wochen- bzw. Tagesziel. Darunter nicht: Vier Beiträge im Monat sind kein
 * Beitrag am Tag, zwei im Monat keiner pro Woche – aufgerundet stünde sonst jeden Tag „0 / 1“ da.
 */
const AUSSCHNITT_AB = 0.75
const ausschnitt = (ist: number, sollWert: number): IstSoll | null =>
  sollWert >= AUSSCHNITT_AB ? { ist, soll: sollWert } : null

/** Fortschritt eines Key Results für eine Person (`memberId`) oder das Team (`null`). */
export function fortschritt(
  e: OkrErgebnis,
  ziel: Spanne,
  memberId: string | null,
  zahlen: Zahlen,
  heute: Tag,
  feiertage: readonly Tag[] = FEIERTAGE_HH,
): Fortschritt {
  const art = zaehltageVon(e.quelle)
  const gesamtSoll = soll(e, ziel, ziel.von, ziel.bis, feiertage)
  const ganz = e.quelle === 'manuell' ? ALLE_TAGE : ziel
  const ist = istWert(e, memberId, zahlen, ganz.von, ganz.bis)
  const gestern = tagPlus(heute, -1)
  const bisGestern = heute > ziel.von ? soll(e, ziel, ziel.von, frueher(gestern, ziel.bis), feiertage) : 0
  const laeuft = heute >= ziel.von && heute <= ziel.bis
  const w = wocheVon(heute)
  return {
    memberId,
    ist,
    soll: gesamtSoll,
    anteil: gesamtSoll > 0 ? Math.min(1, Math.max(0, ist / gesamtSoll)) : 0,
    tempo: gesamtSoll > 0 ? Math.min(1, bisGestern / gesamtSoll) : 0,
    status: ampel(ist, gesamtSoll, bisGestern, ziel, heute),
    woche: laeuft
      ? ausschnitt(istWert(e, memberId, zahlen, w.von, w.bis), soll(e, ziel, w.von, w.bis, feiertage))
      : null,
    heute:
      laeuft && zaehlt(heute, art, feiertage)
        ? ausschnitt(istWert(e, memberId, zahlen, heute, heute), soll(e, ziel, heute, heute, feiertage))
        : null,
  }
}

/** Je Person ein Fortschritt (Key Result „je Person“) – sonst einer fürs Team. */
export function fortschritte(
  e: OkrErgebnis,
  ziel: Spanne,
  memberIds: readonly string[],
  zahlen: Zahlen,
  heute: Tag,
  feiertage: readonly Tag[] = FEIERTAGE_HH,
): Fortschritt[] {
  if (!e.je_person) return [fortschritt(e, ziel, null, zahlen, heute, feiertage)]
  return memberIds.map((id) => fortschritt(e, ziel, id, zahlen, heute, feiertage))
}

const mittel = (werte: readonly number[]): number =>
  werte.length ? werte.reduce((s, x) => s + x, 0) / werte.length : 0

/** Fortschritt eines Key Results über alle Personen, 0…1. */
export const ergebnisAnteil = (f: readonly Fortschritt[]): number => mittel(f.map((x) => x.anteil))

/** Fortschritt eines Ziels, 0…1: der Durchschnitt seiner Key Results (wie in OKR-Werkzeugen üblich). */
export function zielAnteil(jeErgebnis: readonly (readonly Fortschritt[])[]): number {
  return mittel(jeErgebnis.map(ergebnisAnteil))
}

/** Schlechtester Stand zuerst – für die eine Ampel eines Ziels. */
const STATUS_RANG: Record<Status, number> = { verfehlt: 0, hinten: 1, knapp: 2, im_plan: 3, offen: 4, geschafft: 5 }
export function schlechtester(status: readonly Status[]): Status {
  return status.reduce<Status>((a, b) => (STATUS_RANG[b] < STATUS_RANG[a] ? b : a), 'geschafft')
}

// ── Anzeige ───────────────────────────────────────────────────────────────────────────────────────────────────

const zahl = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 })

/** „37“ · „15.000 €“ */
export function wertText(n: number, einheit: string | null): string {
  const t = zahl.format(Math.round(n))
  return einheit ? `${t} ${einheit}` : t
}

/** „37 / 100“ · „5.000 € / 120.000 €“ – das Soll aufgerundet */
export function istSollText(x: IstSoll, einheit: string | null): string {
  return `${wertText(x.ist, einheit)} / ${wertText(aufgerundet(x.soll), einheit)}`
}

/** Eine Zeile unter dem Titel: „100 im ganzen Zeitraum · je Person · zählt von selbst“ */
export function ergebnisZeile(e: OkrErgebnis): string {
  const teile = [`${wertText(e.zielwert, e.einheit)} ${TAKT_LABEL[e.takt]}`, e.je_person ? 'je Person' : 'fürs Team']
  teile.push(e.quelle === 'manuell' ? 'von Hand' : 'zählt von selbst')
  return teile.join(' · ')
}
