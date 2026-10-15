// M3 – Reihenfolge der Anrufliste (BAUPLAN § 3.4 anrufliste.ts, ux § 2.5 Schritt 1, T-01/T-02):
// Rückrufe fällig (due_at ↑) → Wiederholungen (Telefon-Enrollment aktiv, Position 2–5, next_due_at ≤ heute, Slot-Rotation)
// → frische Leads (kein Telefon-Enrollment, stage_rank ↓, created_at ↑). Filter `telefonGate`; reine Funktion.
import { sperrlistenEintraege, telefonGate, type TelefonGrund } from '@/lib/gates'
import { stageRank } from '@/lib/stufen'
import { berlinTag, tageDifferenz, tagPlus, tagZuDate, type Tag } from '@/lib/zeit'
import type { Enrollment, Lead, LeadStage, SperrlisteEintrag, Task } from '@/types/domain'
import type { LetzterAnruf } from '@/data/calls'

export type SlotKey = 'A' | 'B' | 'C' | 'D'
export const SLOT_FOLGE: readonly SlotKey[] = ['A', 'B', 'C', 'D']

/** Slot-Rotation A → B → C → D → A je Versuch (ux § 3.5.4: Versuch 1 A · 2 B · 3 C · 4 D · 5 A). */
export function slotFuerVersuch(versuch: number): SlotKey {
  return SLOT_FOLGE[(Math.max(1, versuch) - 1) % 4] ?? 'A'
}

/** Zähler aus dem Task-Titel „Rückruf – nicht erreicht (Wiederholung n)“ (§ 1.5 Nr. 38: keine Spalte). */
export function wiederholungAusTitel(titel: string | null | undefined): number {
  const m = /Wiederholung (\d)/.exec(titel ?? '')
  return m ? Number(m[1]) : 0
}

/** Lead der Liste, optional mit Firmen-Embed (Firmensperre § 1.5 Nr. 27). */
export type ListenLead = Lead & { companies?: { do_not_contact?: boolean | null } | null }

export type RueckrufZeile = {
  art: 'rueckruf'
  lead: ListenLead
  task: Task
  dueAt: string
  /** Uhrzeit vorbei, kein Anruf (ux § 4.5 „verpasst · 00:35“) */
  verpasst: boolean
  wiederholung: number
  versuch: number
  letzterAnruf: LetzterAnruf | null
}

export type AnrufZeile = {
  art: 'wiederholung' | 'frisch'
  lead: ListenLead
  enrollment: Enrollment | null
  versuch: number
  slot: SlotKey
  faelligAt: string | null
  /** Tage überfällig (0 = heute) */
  ueberfaelligTage: number
  letzterAnruf: LetzterAnruf | null
}

export type GesperrtZeile = { lead: ListenLead; grund: TelefonGrund }

export type Anrufliste = {
  rueckrufe: RueckrufZeile[]
  /** Wiederholungen + frische Leads in Reihenfolge */
  anrufliste: AnrufZeile[]
  /** Nur mit `alle`: Versuche mit Fälligkeit nach heute */
  kommend: AnrufZeile[]
  nichtAnrufbar: GesperrtZeile[]
  zaehler: { liste: number; rueckrufe: number; versuche: number; frisch: number; nichtAnrufbar: number }
}

export type AnruflisteEingabe = {
  leads: readonly ListenLead[]
  /** offene Aufgaben (mindestens die fälligen Rückrufe) */
  tasks: readonly Task[]
  /** Telefon-Enrollments (aktiv/pausiert) */
  enrollments: readonly Enrollment[]
  sperrliste?: readonly SperrlisteEintrag[]
  jetzt: Date
  heute?: Tag
  maxVersuche?: number
  /** heute per `R` aus der Liste entfernt */
  entfernt?: ReadonlySet<string>
  /** Segment „Alle“: auch kommende Versuche */
  alle?: boolean
  /** letzter Anruf je Lead (Ergebnis-Chip, „vereinbart … mit …“) */
  letzte?: ReadonlyMap<string, LetzterAnruf>
}

/** Phasen, in denen ein Erstanruf sinnvoll ist: Vernetzt … Sales Follow-up (nicht Angefragt, Kunde, Wiedervorlage, Beendet). */
export function istAnrufKandidat(stage: LeadStage): boolean {
  const r = stageRank(stage)
  return r >= stageRank('vernetzt') && r <= stageRank('sales_follow_up')
}

export function anrufliste(e: AnruflisteEingabe): Anrufliste {
  const heute = e.heute ?? berlinTag(e.jetzt)
  const jetztMs = e.jetzt.getTime()
  const endeHeuteMs = tagZuDate(tagPlus(heute, 1), '00:00').getTime()
  const maxVersuche = e.maxVersuche ?? 5
  const sperrliste = e.sperrliste ?? []
  const entfernt = e.entfernt ?? new Set<string>()
  const letzte = e.letzte ?? new Map<string, LetzterAnruf>()

  const enrollmentJeLead = new Map<string, Enrollment>()
  for (const en of e.enrollments) {
    if (en.channel !== 'telefon' || (en.status !== 'aktiv' && en.status !== 'pausiert')) continue
    const vorhanden = enrollmentJeLead.get(en.lead_id)
    if (!vorhanden || (vorhanden.status !== 'aktiv' && en.status === 'aktiv')) enrollmentJeLead.set(en.lead_id, en)
  }

  const rueckrufJeLead = new Map<string, Task>()
  for (const t of e.tasks) {
    if (t.kind !== 'rueckruf' || t.status !== 'offen' || !t.lead_id) continue
    const vorhanden = rueckrufJeLead.get(t.lead_id)
    if (!vorhanden || t.due_at < vorhanden.due_at) rueckrufJeLead.set(t.lead_id, t)
  }

  const rueckrufe: RueckrufZeile[] = []
  const wiederholungen: AnrufZeile[] = []
  const frische: AnrufZeile[] = []
  const kommend: AnrufZeile[] = []
  const nichtAnrufbar: GesperrtZeile[] = []

  for (const lead of e.leads) {
    if (lead.deleted_at || lead.stage === 'beendet') continue
    const task = rueckrufJeLead.get(lead.id) ?? null
    const kandidat = istAnrufKandidat(lead.stage)
    if (!task && !kandidat) continue

    const gate = telefonGate(lead, sperrlistenEintraege(sperrliste, lead))
    if (!gate.erlaubt) {
      // ux § 3.5.1 sagt „Sperrlisten-Treffer erscheinen nie“, BAUPLAN T-17 verlangt den Grund „Sperrliste“ in „Noch nicht anrufbar“ → BAUPLAN gilt.
      nichtAnrufbar.push({ lead, grund: gate.grund ?? 'kein_anrufgrund' })
      continue
    }

    const enrollment = enrollmentJeLead.get(lead.id) ?? null
    const letzterAnruf = letzte.get(lead.id) ?? null
    const versuchAusEnrollment = enrollment?.current_position ?? null

    if (task) {
      const dueMs = new Date(task.due_at).getTime()
      if (dueMs < endeHeuteMs) {
        rueckrufe.push({
          art: 'rueckruf',
          lead,
          task,
          dueAt: task.due_at,
          verpasst: dueMs < jetztMs,
          wiederholung: wiederholungAusTitel(task.title),
          versuch: versuchAusEnrollment ?? 1,
          letzterAnruf,
        })
      }
      // offener Rückruf in der Zukunft: Lead ist versprochen, nicht in der Liste (ux § 2.5 Schritt 1)
      continue
    }

    if (entfernt.has(lead.id)) continue

    if (enrollment) {
      if (enrollment.status !== 'aktiv') continue // pausiert (Rückruf/Nummer recherchieren) – kein Versuch
      const versuch = versuchAusEnrollment ?? 1
      if (versuch > maxVersuche) continue // Schritt 6 = Wiedervorlage
      const due = enrollment.next_due_at
      const dueMs = due ? new Date(due).getTime() : 0
      const zeile: AnrufZeile = {
        art: 'wiederholung',
        lead,
        enrollment,
        versuch,
        slot: slotFuerVersuch(versuch),
        faelligAt: due,
        ueberfaelligTage: due ? Math.max(0, tageDifferenz(berlinTag(due), heute)) : 0,
        letzterAnruf,
      }
      if (!due || dueMs < endeHeuteMs) wiederholungen.push(zeile)
      else if (e.alle) kommend.push(zeile)
      continue
    }

    frische.push({
      art: 'frisch',
      lead,
      enrollment: null,
      versuch: 1,
      slot: 'A',
      faelligAt: null,
      ueberfaelligTage: 0,
      letzterAnruf,
    })
  }

  rueckrufe.sort((a, b) => a.dueAt.localeCompare(b.dueAt) || vergleichFirma(a.lead, b.lead))
  wiederholungen.sort((a, b) => (a.faelligAt ?? '').localeCompare(b.faelligAt ?? '') || vergleichFirma(a.lead, b.lead))
  kommend.sort((a, b) => (a.faelligAt ?? '').localeCompare(b.faelligAt ?? ''))
  // § 1.5 Nr. 35: Sales Leads (höherer Rang) vor Vernetzten; danach ältere zuerst
  frische.sort(
    (a, b) =>
      stageRank(b.lead.stage) - stageRank(a.lead.stage) ||
      a.lead.created_at.localeCompare(b.lead.created_at) ||
      vergleichFirma(a.lead, b.lead),
  )
  nichtAnrufbar.sort((a, b) => a.grund.localeCompare(b.grund) || vergleichFirma(a.lead, b.lead))

  const liste = [...wiederholungen, ...frische]
  return {
    rueckrufe,
    anrufliste: liste,
    kommend,
    nichtAnrufbar,
    zaehler: {
      liste: rueckrufe.length + liste.length,
      rueckrufe: rueckrufe.length,
      versuche: wiederholungen.length,
      frisch: frische.length,
      nichtAnrufbar: nichtAnrufbar.length,
    },
  }
}

function vergleichFirma(a: Lead, b: Lead): number {
  return (a.company_name ?? '').localeCompare(b.company_name ?? '', 'de') || a.created_at.localeCompare(b.created_at)
}

/** Lead-IDs in Anrufreihenfolge (Call-Block). */
export function listeIds(l: Anrufliste): string[] {
  return [...l.rueckrufe.map((r) => r.lead.id), ...l.anrufliste.map((z) => z.lead.id)]
}
