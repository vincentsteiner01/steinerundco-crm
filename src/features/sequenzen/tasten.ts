// Tastenliste „Sequenzen“ (BAUPLAN § 3.2 tasten.ts): der Editor hat nur ⌘↵ Speichern; Starten/Stoppen laufen über Menüs.
import type { TastenGruppe } from '@/app/tasten'

export const TASTEN: TastenGruppe[] = [
  {
    gruppe: 'Sequenzen',
    eintraege: [{ tasten: ['⌘↵'], beschreibung: 'Sequenz-Editor: Änderungen speichern' }],
  },
]
