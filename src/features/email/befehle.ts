// Vertrag (BAUPLAN § 3.1.8): `export const BEFEHLE: Befehl[]` – Palette-Befehle M4 (§ 3.5): „E-Mail verfassen an …“ (⌥M),
// „Erlaubnis erfassen …“, „Widerspruch erfassen …“ – alle nur mit Lead-Kontext; die Dialoge öffnet der Composer (`?erlaubnis=1`,
// `?widerspruch=1`), damit die Palette keinen eigenen Dialog-Host braucht.
import type { Befehl } from '@/app/befehle'
import { PFADE } from '@/app/pfade'
import { aktuellerPfad, verfassenUrl } from './links'

export const BEFEHLE: Befehl[] = [
  {
    id: 'email-verfassen',
    label: 'E-Mail verfassen an …',
    gruppe: 'aktionen',
    tasten: ['⌥M'],
    sichtbar: ({ leadId }) => !!leadId,
    ausfuehren: ({ navigate, leadId }) => {
      if (leadId) navigate(verfassenUrl({ leadId, zurueck: aktuellerPfad() }))
    },
  },
  {
    id: 'email-erlaubnis-erfassen',
    label: 'Erlaubnis erfassen …',
    gruppe: 'aktionen',
    sichtbar: ({ leadId }) => !!leadId,
    ausfuehren: ({ navigate, leadId }) => {
      if (leadId) navigate(verfassenUrl({ leadId, zurueck: aktuellerPfad(), erlaubnis: true }))
    },
  },
  {
    id: 'email-widerspruch-erfassen',
    label: 'Widerspruch erfassen …',
    gruppe: 'aktionen',
    sichtbar: ({ leadId }) => !!leadId,
    ausfuehren: ({ navigate, leadId }) => {
      if (leadId) navigate(verfassenUrl({ leadId, zurueck: aktuellerPfad(), widerspruch: true }))
    },
  },
  {
    id: 'email-entwuerfe',
    label: 'E-Mail-Entwürfe',
    gruppe: 'seiten',
    ausfuehren: ({ navigate }) => navigate(`${PFADE.email}?tab=entwuerfe`),
  },
]
