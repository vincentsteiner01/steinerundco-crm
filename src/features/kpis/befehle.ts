// Vertrag (BAUPLAN § 3.1.8): `export const BEFEHLE: Befehl[]` – Palette-Befehle von M5 (Zeitraum-Sprünge, CSV-Export).
import type { Befehl } from '@/app/befehle'
import { PFADE } from '@/app/pfade'
import { heuteBerlin } from '@/lib/format'

/** KpisSeite hört auf dieses Event und exportiert den aktuellen Zeitraum (K-12). */
export const KPIS_EXPORT_EVENT = 'crm:kpis-export'

const aufKpis = () => typeof window !== 'undefined' && window.location.pathname.startsWith(PFADE.kpis)

export const BEFEHLE: Befehl[] = [
  {
    id: 'kpis-monat',
    label: 'KPIs: dieser Monat',
    gruppe: 'seiten',
    ausfuehren: ({ navigate }) => navigate(`${PFADE.kpis}?zeitraum=${heuteBerlin().slice(0, 7)}`),
  },
  {
    id: 'kpis-woche',
    label: 'KPIs: diese Woche',
    gruppe: 'seiten',
    ausfuehren: ({ navigate }) => navigate(`${PFADE.kpis}?zeitraum=kw`),
  },
  {
    id: 'kpis-7t',
    label: 'KPIs: letzte 7 Tage',
    gruppe: 'seiten',
    ausfuehren: ({ navigate }) => navigate(`${PFADE.kpis}?zeitraum=7t`),
  },
  {
    id: 'kpis-team',
    label: 'KPIs: Team',
    gruppe: 'seiten',
    ausfuehren: ({ navigate }) => navigate(`${PFADE.kpis}?person=team`),
  },
  {
    id: 'kpis-export',
    label: 'KPIs als CSV exportieren',
    gruppe: 'aktionen',
    sichtbar: aufKpis,
    ausfuehren: () => window.dispatchEvent(new CustomEvent(KPIS_EXPORT_EVENT)),
  },
]
