// Reine Logik der Telefon-Ansichten nach Mikes Sales Hub (23.10.2026): Termin-Daten je Lead, nächstes Follow-up, die acht
// Deal-Phasen (abgeleitet aus Stufe + Terminen – nicht frei editierbar, damit die KPIs stimmen) und die Sales-KPIs je Tag,
// Woche oder Monat.
import type {
  FollowUpAufgabe,
  FollowUpTermin,
  TelefonAufgabe,
  TelefonLead,
  TelefonTermin,
} from '@/data/telefonAnsichten'
import { berlinTag, isodow, kalenderwoche, tagPlus, type Tag } from '@/lib/zeit'
import type { MeetingType, Metric, TaskKind } from '@/types/domain'

// ── Termine und Follow-ups je Lead ─────────────────────────────────────────────────────────────────────────

const nachZeit = (a: TelefonTermin, b: TelefonTermin) => a.scheduled_at.localeCompare(b.scheduled_at)

/** Letzter gültiger Termin eines Typs (ohne „verschoben“ – der Ersatztermin zählt). */
export function terminVon(lead: Pick<TelefonLead, 'meetings'>, typ: MeetingType): TelefonTermin | null {
  const liste = lead.meetings.filter((m) => m.type === typ && m.status !== 'verschoben').sort(nachZeit)
  return liste.at(-1) ?? null
}

/** Frühestes offenes Follow-up (Rückruf · Wiedervorlage · Aufgabe). */
export function naechstesFollowUp(lead: Pick<TelefonLead, 'tasks'>): TelefonAufgabe | null {
  const offen = lead.tasks
    .filter((t) => t.status === 'offen' && t.due_at)
    .sort((a, b) => (a.due_at ?? '').localeCompare(b.due_at ?? ''))
  return offen[0] ?? null
}

/** Fällig = Berliner Kalendertag heute oder früher. */
export function istFaellig(iso: string | null | undefined, heute: Tag): boolean {
  return !!iso && berlinTag(iso) <= heute
}

export const AUFGABE_LABEL: Record<TaskKind, string> = {
  rueckruf: 'Rückruf',
  wiedervorlage: 'Wiedervorlage',
  aufgabe: 'Aufgabe',
}

export const TELEFON_TYP: Record<string, string> = {
  zentrale: 'Zentrale',
  durchwahl: 'Durchwahl',
  mobil: 'Mobil',
  unbekannt: '',
}

export const TERMIN_LABEL: Record<MeetingType, string> = {
  erstgespraech: 'Erstgespräch',
  strategiegespraech: 'Strategiegespräch',
  folgegespraech: 'Folgebesprechung',
}

/** Kontakte: fällige/geplante Follow-ups zuerst (nach Datum), dann ohne Follow-up nach Name – wie Mikes Tabelle. */
export function kontakteSortiert<T extends Pick<TelefonLead, 'tasks' | 'full_name' | 'company_name'>>(
  liste: readonly T[],
): T[] {
  return [...liste].sort((a, b) => {
    const fa = naechstesFollowUp(a)?.due_at ?? null
    const fb = naechstesFollowUp(b)?.due_at ?? null
    if (fa && fb) return fa.localeCompare(fb)
    if (fa) return -1
    if (fb) return 1
    return (a.full_name ?? a.company_name ?? '').localeCompare(b.full_name ?? b.company_name ?? '', 'de')
  })
}

// ── Deal-Phasen ────────────────────────────────────────────────────────────────────────────────────────────

export type DealPhase =
  'eg_vereinbart' | 'eg_neu' | 'sg_vereinbart' | 'sg_neu' | 'sg_folge' | 'follow_up' | 'kunde' | 'beendet'

/** Mikes acht Spalten in seiner Reihenfolge. */
export const DEAL_PHASEN: readonly { key: DealPhase; label: string; hinweis: string }[] = [
  { key: 'eg_vereinbart', label: 'EG vereinbart', hinweis: 'Erstgespräch steht im Kalender' },
  { key: 'eg_neu', label: 'EG neu terminieren', hinweis: 'No-Show, abgesagt oder verschoben' },
  { key: 'sg_vereinbart', label: 'SG vereinbart', hinweis: 'Strategiegespräch steht im Kalender' },
  { key: 'sg_neu', label: 'SG neu terminieren', hinweis: 'No-Show, abgesagt oder verschoben' },
  { key: 'sg_folge', label: 'SG Folgebesprechung', hinweis: 'Folgetermin steht im Kalender' },
  { key: 'follow_up', label: 'Follow-Up', hinweis: 'Gespräch war – nächster Schritt offen' },
  { key: 'kunde', label: 'Kunde', hinweis: 'Gewonnen' },
  { key: 'beendet', label: 'Beendet', hinweis: 'Nach einem Gespräch beendet' },
]

const AUS_TYP: Record<MeetingType, { geplant: DealPhase; neu: DealPhase }> = {
  erstgespraech: { geplant: 'eg_vereinbart', neu: 'eg_neu' },
  strategiegespraech: { geplant: 'sg_vereinbart', neu: 'sg_neu' },
  folgegespraech: { geplant: 'sg_folge', neu: 'sg_neu' },
}

/**
 * Phase eines Deals aus Stufe und Terminen: Kunde/Beendet aus der Stufe; sonst der nächste geplante Termin; sonst der letzte
 * Termin (No-Show/abgesagt/verschoben → neu terminieren, stattgefunden → Follow-Up); ohne Termine die Stufe.
 */
export function dealPhase(lead: Pick<TelefonLead, 'stage' | 'meetings'>): DealPhase {
  if (lead.stage === 'kunde') return 'kunde'
  if (lead.stage === 'beendet') return 'beendet'
  const termine = [...lead.meetings].sort(nachZeit)
  const geplant = termine.filter((m) => m.status === 'geplant')
  // Mehrere geplante: der späteste Typ zählt (SG nach EG gebucht → SG vereinbart)
  const g = geplant.at(-1)
  if (g) return AUS_TYP[g.type].geplant
  const letzter = termine.at(-1)
  if (letzter) return letzter.status === 'stattgefunden' ? 'follow_up' : AUS_TYP[letzter.type].neu
  switch (lead.stage) {
    case 'erstgespraech_vereinbart':
      return 'eg_vereinbart'
    case 'strategiegespraech_vereinbart':
      return 'sg_vereinbart'
    default:
      return 'follow_up'
  }
}

/** Termin, der für die Karte zählt: der nächste geplante, sonst der letzte. */
export function relevanterTermin(lead: Pick<TelefonLead, 'meetings'>): TelefonTermin | null {
  const termine = [...lead.meetings].sort(nachZeit)
  return termine.filter((m) => m.status === 'geplant').at(-1) ?? termine.at(-1) ?? null
}

export function nachPhase<T extends Pick<TelefonLead, 'stage' | 'meetings' | 'tasks'>>(
  deals: readonly T[],
): Record<DealPhase, T[]> {
  const out = Object.fromEntries(DEAL_PHASEN.map((p) => [p.key, [] as T[]])) as Record<DealPhase, T[]>
  for (const d of deals) out[dealPhase(d)].push(d)
  // je Spalte: fälliges Follow-up / nächster Termin zuerst
  const schluessel = (d: T) => naechstesFollowUp(d)?.due_at ?? relevanterTermin(d)?.scheduled_at ?? '9999'
  for (const p of DEAL_PHASEN) out[p.key].sort((a, b) => schluessel(a).localeCompare(schluessel(b)))
  return out
}

// ── Follow-ups ─────────────────────────────────────────────────────────────────────────────────────────────

export type FollowUpEintrag = {
  id: string
  art: 'aufgabe' | 'termin'
  label: string
  titel: string | null
  zeit: string | null
  memberId: string | null
  lead: NonNullable<FollowUpAufgabe['leads']>
}

export function followUpEintraege(
  aufgaben: readonly FollowUpAufgabe[],
  termine: readonly FollowUpTermin[],
): FollowUpEintrag[] {
  const out: FollowUpEintrag[] = []
  for (const a of aufgaben)
    if (a.leads)
      out.push({
        id: `a:${a.id}`,
        art: 'aufgabe',
        label: AUFGABE_LABEL[a.kind],
        titel: a.title,
        zeit: a.due_at,
        memberId: a.member_id,
        lead: a.leads,
      })
  for (const t of termine)
    if (t.leads)
      out.push({
        id: `t:${t.id}`,
        art: 'termin',
        label: TERMIN_LABEL[t.type],
        titel: null,
        zeit: t.scheduled_at,
        memberId: t.member_id,
        lead: t.leads,
      })
  return out.sort((a, b) => (a.zeit ?? '9999').localeCompare(b.zeit ?? '9999'))
}

export type FollowUpGruppe = 'ueberfaellig' | 'heute' | 'woche' | 'spaeter'
export const FOLLOWUP_GRUPPEN: readonly { key: FollowUpGruppe; label: string }[] = [
  { key: 'ueberfaellig', label: 'Überfällig' },
  { key: 'heute', label: 'Heute' },
  { key: 'woche', label: 'Nächste 7 Tage' },
  { key: 'spaeter', label: 'Später' },
]

export function followUpGruppe(zeit: string | null, heute: Tag): FollowUpGruppe {
  if (!zeit) return 'spaeter'
  const tag = berlinTag(zeit)
  if (tag < heute) return 'ueberfaellig'
  if (tag === heute) return 'heute'
  return tag <= tagPlus(heute, 7) ? 'woche' : 'spaeter'
}

// ── Sales-KPIs ─────────────────────────────────────────────────────────────────────────────────────────────

export type KpiAnsicht = 'tage' | 'wochen' | 'monate'

/** Mikes Spalten (Reihenfolge seiner Tabelle) → Kennzahl im CRM. */
export const SALES_SPALTEN: readonly { key: Metric; label: string; kurz: string }[] = [
  { key: 'anrufe', label: 'Anwahlen', kurz: 'Anwahlen' },
  { key: 'anrufe_erreicht', label: 'Telefonate', kurz: 'Telefonate' },
  { key: 'entscheider_gespraeche', label: 'Entscheidergespräche', kurz: 'Entscheider' },
  { key: 'erstgespraeche_vereinbart', label: 'EG vereinbart', kurz: 'EG vereinb.' },
  { key: 'erstgespraeche', label: 'EG durchgeführt', kurz: 'EG durchgef.' },
  { key: 'erstgespraech_no_show', label: 'EG No-Shows', kurz: 'EG No-Show' },
  { key: 'strategiegespraeche_vereinbart', label: 'SG vereinbart', kurz: 'SG vereinb.' },
  { key: 'strategiegespraeche', label: 'SG durchgeführt', kurz: 'SG durchgef.' },
  { key: 'strategiegespraech_no_show', label: 'SG No-Shows', kurz: 'SG No-Show' },
  { key: 'kunden_gewonnen', label: 'Kunden', kurz: 'Kunden' },
]

export type SalesSummen = Partial<Record<Metric, number>>
export type SalesZeile = { key: string; label: string; summen: SalesSummen }

/** Zeitraum je Ansicht: 14 Tage · 12 Wochen (ab Montag) · 12 Monate (ab Monatsersten), jeweils bis heute. */
export function kpiSpanne(ansicht: KpiAnsicht, heute: Tag): { von: Tag; bis: Tag } {
  if (ansicht === 'tage') return { von: tagPlus(heute, -13), bis: heute }
  if (ansicht === 'wochen') return { von: tagPlus(heute, -(isodow(heute) - 1) - 7 * 11), bis: heute }
  const [j, m] = heute.split('-').map(Number) as [number, number]
  const start = new Date(Date.UTC(j, m - 1 - 11, 1))
  return { von: start.toISOString().slice(0, 10), bis: heute }
}

const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
const WOCHENTAG = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

function periode(tag: Tag, ansicht: KpiAnsicht): { key: string; label: string } {
  if (ansicht === 'tage') {
    const [, m, d] = tag.split('-')
    return { key: tag, label: `${WOCHENTAG[isodow(tag) - 1]} ${d}.${m}.` }
  }
  if (ansicht === 'wochen') {
    const montag = tagPlus(tag, -(isodow(tag) - 1))
    const [, m, d] = montag.split('-')
    return { key: montag, label: `KW ${kalenderwoche(montag)} · ab ${d}.${m}.` }
  }
  const [j, m] = tag.split('-')
  return { key: `${j}-${m}`, label: `${MONATE[Number(m) - 1]} ${j}` }
}

/** Alle Perioden der Spanne (auch leere), neueste zuerst – wie Mikes Tabelle. */
export function salesZeilen(
  zeilen: readonly { day: string | null; metric: Metric | null; value: number | null; period: string | null }[],
  ansicht: KpiAnsicht,
  spanne: { von: Tag; bis: Tag },
): SalesZeile[] {
  const map = new Map<string, SalesZeile>()
  for (let t = spanne.von; t <= spanne.bis; t = tagPlus(t, 1)) {
    const p = periode(t, ansicht)
    if (!map.has(p.key)) map.set(p.key, { ...p, summen: {} })
  }
  for (const z of zeilen) {
    // Monatswerte aus dem alten KPI-Sheet (LinkedIn) gehören nicht in die Telefon-Tabelle
    if (!z.day || !z.metric || z.period === 'monat') continue
    const p = periode(z.day, ansicht)
    const zeile = map.get(p.key)
    if (!zeile) continue
    zeile.summen[z.metric] = (zeile.summen[z.metric] ?? 0) + (z.value ?? 0)
  }
  return [...map.values()].sort((a, b) => b.key.localeCompare(a.key))
}

export function gesamt(zeilen: readonly SalesZeile[]): SalesSummen {
  const out: SalesSummen = {}
  for (const z of zeilen)
    for (const [k, v] of Object.entries(z.summen)) out[k as Metric] = (out[k as Metric] ?? 0) + (v ?? 0)
  return out
}

const w = (s: SalesSummen, m: Metric) => s[m] ?? 0

/** Mikes Trichter (Balken relativ zu den Anwahlen). */
export function trichter(s: SalesSummen): { label: string; wert: number }[] {
  return [
    { label: 'Anwahlen', wert: w(s, 'anrufe') },
    { label: 'Telefonate', wert: w(s, 'anrufe_erreicht') },
    { label: 'Entscheidergespräche', wert: w(s, 'entscheider_gespraeche') },
    { label: 'EG durchgeführt', wert: w(s, 'erstgespraeche') },
    { label: 'SG durchgeführt', wert: w(s, 'strategiegespraeche') },
    { label: 'Kunden', wert: w(s, 'kunden_gewonnen') },
  ]
}

/** Mikes Conversions inkl. Show-Rates (durchgeführt / vereinbart); `null` ohne Nenner. */
export function conversions(s: SalesSummen): { label: string; z: number; n: number; quote: number | null }[] {
  const q = (label: string, z: number, n: number) => ({ label, z, n, quote: n ? z / n : null })
  return [
    q('Anwahlen → Telefonate', w(s, 'anrufe_erreicht'), w(s, 'anrufe')),
    q('Telefonate → Entscheider', w(s, 'entscheider_gespraeche'), w(s, 'anrufe_erreicht')),
    q('Entscheider → EG', w(s, 'erstgespraeche'), w(s, 'entscheider_gespraeche')),
    q('EG → SG', w(s, 'strategiegespraeche'), w(s, 'erstgespraeche')),
    q('SG → Kunden', w(s, 'kunden_gewonnen'), w(s, 'strategiegespraeche')),
    q('EG Show-Rate', w(s, 'erstgespraeche'), w(s, 'erstgespraeche_vereinbart')),
    q('SG Show-Rate', w(s, 'strategiegespraeche'), w(s, 'strategiegespraeche_vereinbart')),
  ]
}
