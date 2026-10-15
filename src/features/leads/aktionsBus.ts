// Brücke Palette → Lead-Aktion (BAUPLAN § 3.3 befehle.ts „Antwort erhalten für …“): der Befehl öffnet den Peek (`crm:peek`, wie
// app/befehle.peekOeffnen – hier ohne Import, sonst Zyklus app/befehle ↔ features/leads/befehle) und merkt die gewünschte Aktion;
// LeadPanel liest sie beim Mount bzw. per Event und öffnet das passende Popover/den Dialog.
import { useEffect } from 'react'

export type LeadAktion =
  | 'antwort'
  | 'termin'
  | 'spaeter'
  | 'beenden'
  | 'wiedervorlage'
  | 'uebergeben'
  | 'freigeben'
  | 'uebernehmen'
  | 'tag'
  | 'anrufgrund'
  | 'papierkorb'
  | 'notiz'

export const EVENT_LEAD_AKTION = 'crm:lead-aktion'

let anstehend: { leadId: string; aktion: LeadAktion } | null = null

/** Palette/Befehl: Peek öffnen und Aktion anfordern. */
export function leadAktionAnfordern(leadId: string, aktion: LeadAktion): void {
  anstehend = { leadId, aktion }
  window.dispatchEvent(new CustomEvent('crm:peek', { detail: { leadId } }))
  window.dispatchEvent(new CustomEvent(EVENT_LEAD_AKTION, { detail: { leadId, aktion } }))
}

/** Holt (und verbraucht) die anstehende Aktion für diesen Lead. */
export function anstehendeAktion(leadId: string): LeadAktion | null {
  if (anstehend?.leadId !== leadId) return null
  const a = anstehend.aktion
  anstehend = null
  return a
}

/** Nur für Tests. */
export function _aktionenZuruecksetzen(): void {
  anstehend = null
}

/** Panel/Vollseite: anstehende Aktion beim Mount und spätere Events für diesen Lead. */
export function useLeadAktionen(leadId: string, handler: (a: LeadAktion) => void): void {
  useEffect(() => {
    const a = anstehendeAktion(leadId)
    if (a) handler(a)
    const h = (e: Event) => {
      const d = (e as CustomEvent<{ leadId?: string; aktion?: LeadAktion }>).detail
      if (d?.leadId === leadId && d.aktion) {
        anstehend = null
        handler(d.aktion)
      }
    }
    window.addEventListener(EVENT_LEAD_AKTION, h)
    return () => window.removeEventListener(EVENT_LEAD_AKTION, h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId])
}
