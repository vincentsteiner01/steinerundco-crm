// Palette-Befehle der Hilfe (in src/app/befehle.ts registriert): Einführungstour jederzeit neu starten, Handbuch öffnen,
// direkt zu „Was das CRM (noch) nicht kann“. G S trägt schon der Seiten-Eintrag „Hilfe“ aus NAV – hier keine zweite Taste.
import type { Befehl } from '@/app/befehle'
import { PFADE } from '@/app/pfade'
import { tourStarten } from './ereignis'

export const BEFEHLE: Befehl[] = [
  {
    id: 'hilfe:tour',
    label: 'Einführungstour starten',
    gruppe: 'aktionen',
    ausfuehren: () => tourStarten('onboarding'),
  },
  {
    id: 'hilfe:handbuch',
    label: 'Hilfe & Handbuch',
    gruppe: 'seiten',
    ausfuehren: ({ navigate }) => navigate(PFADE.hilfe()),
  },
  {
    id: 'hilfe:grenzen',
    label: 'Was das CRM (noch) nicht kann',
    gruppe: 'seiten',
    ausfuehren: ({ navigate }) => navigate(PFADE.hilfe('noch-nicht')),
  },
]
