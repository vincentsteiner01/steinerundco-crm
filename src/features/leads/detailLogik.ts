// Reine Logik von Peek und Vollseite (ux § 3.3, DESIGN-SYSTEM § 5.11) – getrennt von den Komponenten, damit Tests sie direkt prüfen
// und die Komponenten-Dateien nur Komponenten exportieren (Fast Refresh, Lint).
import { fmtZeit } from '@/lib/format'
import type { LeadMitBezug, LeadRole, LeadStage, PhaseKey, QueueItem } from '@/types/domain'
import type { LeadAktion } from './aktionsBus'

/** Queue-Eintrag des Leads (erste Sektion gewinnt). */
export function queueItemFuer(items: readonly QueueItem[] | undefined, leadId: string): QueueItem | null {
  return (
    (items ?? [])
      .filter((i) => i.lead_id === leadId)
      .sort((a, b) => (a.section_order ?? 99) - (b.section_order ?? 99))[0] ?? null
  )
}

/** Phasenwechsel mit Pflichtdialog (ux § 3.2.2): Erstgespräch/Strategiegespräch → Termin, Beendet → Grund, Wiedervorlage → Datum. */
export function phasenAktion(ziel: PhaseKey): LeadAktion | null {
  if (ziel === 'erstgespraech' || ziel === 'strategiegespraech') return 'termin'
  if (ziel === 'beendet') return 'beenden'
  if (ziel === 'wiedervorlage') return 'wiedervorlage'
  return null
}

/** Stufe nach „Reaktivieren“: im Gespräch, wenn je eine Antwort kam; sonst vernetzt (LinkedIn) oder neu. */
export function reaktivierungsStufe(lead: Pick<LeadMitBezug, 'last_inbound_at' | 'linkedin_url'>): LeadStage {
  if (lead.last_inbound_at) return 'dm_beantwortet'
  return lead.linkedin_url ? 'vernetzt' : 'neu'
}

export type Naechstes = { key: string; wann: string; text: string; art: 'schritt' | 'aufgabe' | 'termin' }

/** „NÄCHSTES“ der Timeline: geplante Schritte, offene Aufgaben, geplante Termine – nach Datum; das erste ist Lime. */
export function naechsteEintraege(
  lead: LeadMitBezug | undefined,
  schrittName: (stepId: string | null) => string | null,
): Naechstes[] {
  if (!lead) return []
  const out: Naechstes[] = []
  for (const e of lead.enrollments ?? [])
    if (e.status === 'aktiv' && e.next_due_at)
      out.push({
        key: `e:${e.id}`,
        wann: e.next_due_at,
        text: schrittName(e.current_step_id) ?? 'Nächster Schritt',
        art: 'schritt',
      })
  for (const t of lead.tasks ?? [])
    if (t.status === 'offen') out.push({ key: `t:${t.id}`, wann: t.due_at, text: t.title, art: 'aufgabe' })
  for (const m of lead.meetings ?? [])
    if (m.status === 'geplant')
      out.push({
        key: `m:${m.id}`,
        wann: m.scheduled_at,
        text: `${m.type === 'strategiegespraech' ? 'Strategiegespräch' : m.type === 'folgegespraech' ? 'Folgegespräch' : 'Erstgespräch'} · ${fmtZeit(m.scheduled_at)}`,
        art: 'termin',
      })
  return out.sort((a, b) => a.wann.localeCompare(b.wann))
}

/** Rolle aus Freitext („Geschäftsführer“, „Head of Sales“, „Key Account Manager“) – ux § 3.2.5. */
export function rolleAusFreitext(text: string | null | undefined): LeadRole {
  const t = (text ?? '').toLowerCase()
  if (!t.trim()) return 'unbekannt'
  if (/(geschäftsführ|geschaeftsfuehr|\bgf\b|\bceo\b|\bcoo\b|\bcfo\b|managing director|vorstand|\bmd\b)/.test(t))
    return 'geschaeftsfuehrer'
  if (/(inhaber|owner|gründer|gruender|founder|gesellschafter)/.test(t)) return 'inhaber'
  if (/(kundenbetreu|key account|account manag|customer success|kundenberat|\bkb\b)/.test(t)) return 'kundenbetreuer'
  if (/(innendienst|inside sales|back ?office|auftragsabwicklung)/.test(t)) return 'innendienst'
  if (/(vertrieb|sales|business development|\bbd\b|verkauf)/.test(t)) return 'vertrieb'
  if (/(projektleit|project manag|\bpm\b|bauleit)/.test(t)) return 'projektleiter'
  return 'sonstiges'
}
