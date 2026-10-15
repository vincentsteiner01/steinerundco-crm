// BAUPLAN § 3.1.8 – Palette-Befehle Pipeline (M2): nur Navigation; Lead-Aktionen liegen bei features/leads/befehle.ts.
import type { Befehl } from '@/app/befehle'
import { PFADE } from '@/app/pfade'

export const BEFEHLE: Befehl[] = [
  {
    id: 'pipeline-meine',
    label: 'Pipeline – nur meine Leads',
    gruppe: 'aktionen',
    ausfuehren: ({ navigate }) => navigate(`${PFADE.pipeline}?zustaendig=me`),
  },
  {
    id: 'pipeline-frei',
    label: 'Pipeline – freie Leads',
    gruppe: 'aktionen',
    ausfuehren: ({ navigate }) => navigate(`${PFADE.pipeline}?zustaendig=frei`),
  },
]
