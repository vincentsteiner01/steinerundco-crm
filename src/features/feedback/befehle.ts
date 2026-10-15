// Vertrag (BAUPLAN § 3.1.8): `export const BEFEHLE: Befehl[]` – Palette-Befehle des Feedbacks.
// Die Seite „Feedback“ (G B) kommt schon über NAV in die Palette; hier nur die Aktion „Feedback geben“.
import type { Befehl } from '@/app/befehle'
import { PFADE } from '@/app/pfade'
import { FEEDBACK_EVENT } from './texte'

export const BEFEHLE: Befehl[] = [
  {
    id: 'feedback-geben',
    label: 'Feedback geben (Fehler, Wunsch, Frage)',
    gruppe: 'aktionen',
    tasten: ['⌥F'],
    // Palette schließt erst – der Screenshot zeigt dann die Seite, nicht die Palette
    ausfuehren: () => window.setTimeout(() => window.dispatchEvent(new CustomEvent(FEEDBACK_EVENT)), 250),
  },
  {
    id: 'feedback-offen',
    label: 'Feedback: offene Meldungen',
    gruppe: 'seiten',
    ausfuehren: ({ navigate }) => navigate(`${PFADE.feedback}?status=offen`),
  },
]
