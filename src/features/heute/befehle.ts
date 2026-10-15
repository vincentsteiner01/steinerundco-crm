// Palette-Befehle der Heute-Seite (BAUPLAN § 3.2 befehle.ts): Zähler +1 / +5 / setzen, Liste einfügen, Als andere Person anzeigen,
// Zurück zu meinem Heute, Liste neu sortieren. Die Seite hört auf die Fenster-Ereignisse (HeuteSeite.tsx).
import type { Befehl } from '@/app/befehle'
import { PFADE } from '@/app/pfade'

const zaehler = (detail: { delta?: number; fokus?: boolean }) =>
  window.dispatchEvent(new CustomEvent('crm:heute:zaehler', { detail }))

const aufHeute = (navigate: (p: string) => void, danach: () => void) => {
  if (window.location.pathname !== PFADE.heute) navigate(PFADE.heute)
  window.setTimeout(danach, 50)
}

export const BEFEHLE: Befehl[] = [
  {
    id: 'heute:zaehler+1',
    label: 'Zähler +1 (Anfragen heute)',
    gruppe: 'aktionen',
    tasten: ['+'],
    ausfuehren: ({ navigate }) => aufHeute(navigate, () => zaehler({ delta: 1 })),
  },
  {
    id: 'heute:zaehler+5',
    label: 'Zähler +5 (Anfragen heute)',
    gruppe: 'aktionen',
    tasten: ['⇧+'],
    ausfuehren: ({ navigate }) => aufHeute(navigate, () => zaehler({ delta: 5 })),
  },
  {
    id: 'heute:zaehler-setzen',
    label: 'Zähler setzen …',
    gruppe: 'aktionen',
    ausfuehren: ({ navigate }) => aufHeute(navigate, () => zaehler({ fokus: true })),
  },
  {
    id: 'heute:liste-einfuegen',
    label: 'Liste einfügen (Schnellimport)',
    gruppe: 'aktionen',
    tasten: ['⌘⇧O'],
    ausfuehren: ({ navigate }) => navigate(PFADE.schnellimport(PFADE.heute)),
  },
  {
    id: 'heute:andere-person',
    label: 'Als andere Person anzeigen (Heute)',
    gruppe: 'seiten',
    ausfuehren: ({ navigate }) => navigate(`${PFADE.heute}?person=andere`),
  },
  {
    id: 'heute:zurueck',
    label: 'Zurück zu meinem Heute',
    gruppe: 'seiten',
    sichtbar: () => window.location.search.includes('person='),
    ausfuehren: ({ navigate }) => navigate(PFADE.heute),
  },
  {
    id: 'heute:sortieren',
    label: 'Liste neu sortieren (Heute)',
    gruppe: 'aktionen',
    tasten: ['⌥R'],
    sichtbar: () => window.location.pathname === PFADE.heute,
    ausfuehren: () => window.dispatchEvent(new CustomEvent('crm:heute:sortieren')),
  },
]
