// Vertrag (BAUPLAN § 3.1.8): `export const BEFEHLE: Befehl[]` – M7: „Schnellimport einfügen“, „Sheets importieren“.
import type { Befehl } from '@/app/befehle'
import { PFADE } from '@/app/pfade'

export const BEFEHLE: Befehl[] = [
  {
    id: 'import.schnellimport',
    label: 'Schnellimport einfügen',
    gruppe: 'aktionen',
    tasten: ['⌘⇧O'],
    ausfuehren: ({ navigate }) => navigate(PFADE.schnellimport(`${window.location.pathname}${window.location.search}`)),
  },
  {
    id: 'import.sheets',
    label: 'Sheets importieren',
    gruppe: 'seiten',
    tasten: ['G I'],
    ausfuehren: ({ navigate }) => navigate(PFADE.import),
  },
]
