// BAUPLAN § 3.3 `befehle.ts` – Palette-Befehle (Gruppe Aktionen): Lead-Aktionen für den aktuellen Lead („… für …“ über
// aktionsBus → Peek öffnet und zeigt das Popover/den Dialog), Spalten wählen, Exportieren (CSV) auf /leads. „Lead anlegen ⌥N“
// steht bereits in den globalen Befehlen (app/befehle.ts) und wird hier nicht dupliziert.
import type { Befehl } from '@/app/befehle'
import { PFADE } from '@/app/pfade'
import { leadAktionAnfordern, type LeadAktion } from './aktionsBus'

const mitLead = (
  id: string,
  label: string,
  aktion: LeadAktion,
  tasten?: string[],
  nurWenn: () => boolean = () => true,
): Befehl => ({
  id,
  label,
  gruppe: 'aktionen',
  tasten,
  sichtbar: (ctx) => !!ctx.leadId && nurWenn(),
  ausfuehren: (ctx) => {
    if (ctx.leadId) leadAktionAnfordern(ctx.leadId, aktion)
  },
})

const aufLeads = () => typeof window !== 'undefined' && window.location.pathname.startsWith(PFADE.leads)
const aufTelefon = () => typeof window !== 'undefined' && window.location.pathname.startsWith(PFADE.telefon)

export const EVENT_LEADS_BEFEHL = 'crm:leads-befehl'

export const BEFEHLE: Befehl[] = [
  mitLead('lead-antwort', 'Antwort erhalten für …', 'antwort', ['A']),
  mitLead('lead-termin', 'Termin eintragen für …', 'termin', ['T']),
  mitLead('lead-spaeter', 'Später …', 'spaeter', ['S']),
  mitLead('lead-beenden', 'Beenden …', 'beenden', ['B']),
  mitLead('lead-wiedervorlage', 'Wiedervorlage …', 'wiedervorlage', ['W']),
  mitLead('lead-uebergeben', 'Übergeben an …', 'uebergeben', ['⌘⇧U']),
  mitLead('lead-freigeben', 'Freigeben', 'freigeben', ['⌘⇧F']),
  mitLead('lead-uebernehmen', 'Übernehmen', 'uebernehmen', ['Ü']),
  mitLead('lead-tag', 'Tag hinzufügen …', 'tag'),
  // Auf /telefon übernimmt die Anrufliste denselben Befehl (features/telefon/befehle.ts) – Integration
  mitLead('lead-anrufgrund', 'Anrufgrund setzen …', 'anrufgrund', undefined, () => !aufTelefon()),
  mitLead('lead-papierkorb', 'In Papierkorb', 'papierkorb'),
  {
    id: 'leads-spalten',
    label: 'Spalten wählen',
    gruppe: 'aktionen',
    sichtbar: aufLeads,
    ausfuehren: () => window.dispatchEvent(new CustomEvent(EVENT_LEADS_BEFEHL, { detail: { befehl: 'spalten' } })),
  },
  {
    id: 'leads-export',
    label: 'Exportieren (CSV)',
    gruppe: 'aktionen',
    sichtbar: aufLeads,
    ausfuehren: () => window.dispatchEvent(new CustomEvent(EVENT_LEADS_BEFEHL, { detail: { befehl: 'export' } })),
  },
  {
    id: 'leads-papierkorb',
    label: 'Papierkorb öffnen',
    gruppe: 'seiten',
    ausfuehren: ({ navigate }) => navigate(PFADE.papierkorb),
  },
]
