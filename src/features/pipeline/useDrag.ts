// BAUPLAN § 3.3 `useDrag.ts` – dnd-kit: Pointer-Sensor (Aktivierungsabstand 6 px, sonst klickt man Karten nicht mehr),
// Drag-Ende → { leadId, zielPhase } oder null. Die Regel (dropRegeln.ts) wendet PipelineSeite an.
import { PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { PHASEN } from '@/lib/stufen'
import type { PhaseKey } from '@/types/domain'

const KEYS = new Set<string>(PHASEN.map((p) => p.key))

export function useDragSensoren() {
  return useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
}

export type DropErgebnis = { leadId: string; ziel: PhaseKey } | null

export function dragEnde(e: DragEndEvent): DropErgebnis {
  const ziel = e.over?.id
  if (typeof ziel !== 'string' || !KEYS.has(ziel)) return null
  return { leadId: String(e.active.id), ziel: ziel as PhaseKey }
}
