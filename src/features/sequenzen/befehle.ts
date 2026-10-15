// Palette-Befehle der Sequenzen (BAUPLAN § 3.2): „Sequenz starten für …“ / „Sequenz stoppen für …“ – nur mit Lead im Kontext;
// die Palette öffnet den Lead im Peek, dort liegt das Menü (features/sequenzen/public SequenzStartenMenue in der Kanal-Karte, M2).
import type { Befehl } from '@/app/befehle'
import { peekOeffnen } from '@/app/befehle'

export const BEFEHLE: Befehl[] = [
  {
    id: 'sequenz:starten',
    label: 'Sequenz starten für den aktuellen Lead',
    gruppe: 'aktionen',
    sichtbar: ({ leadId }) => !!leadId,
    ausfuehren: ({ leadId }) => {
      if (leadId) peekOeffnen(leadId)
    },
  },
  {
    id: 'sequenz:stoppen',
    label: 'Sequenz stoppen für den aktuellen Lead',
    gruppe: 'aktionen',
    sichtbar: ({ leadId }) => !!leadId,
    ausfuehren: ({ leadId }) => {
      if (leadId) peekOeffnen(leadId)
    },
  },
]
