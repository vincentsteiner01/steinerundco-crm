// BAUPLAN § 3.1.9 `stufen.ts` / § 1.5 Nr. 1 – 16 DB-Stufen, im UI 10 Phasen als Gruppen.
// Ränge exakt wie crm.stage_rank (schema.sql): Funnel-Tiefe 0…120, `langfristig` = 5, `beendet` = −10.
import { PHASE_LABEL, STUFEN_LABEL } from '@/texte/de'
import type { LeadStage, PhaseKey, Settings } from '@/types/domain'

/** DESIGN-SYSTEM § 3.3 – Chip-Töne der Phasen. */
export type PhaseTon = 'neutral' | 'muted' | 'ended' | 'won'

export type Phase = {
  key: PhaseKey
  label: string
  stages: readonly LeadStage[]
  ton: PhaseTon
}

/** Enum-Reihenfolge wie `crm.lead_stage`. */
export const STUFEN: readonly LeadStage[] = [
  'neu',
  'vernetzung_gesendet',
  'vernetzt',
  'gespraech_eroeffnet',
  'dm_follow_up',
  'dm_beantwortet',
  'bedarfsermittlung',
  'pitch',
  'erstgespraech_vereinbart',
  'erstgespraech',
  'strategiegespraech_vereinbart',
  'strategiegespraech',
  'sales_follow_up',
  'kunde',
  'langfristig',
  'beendet',
]

const RANG: Record<LeadStage, number> = {
  neu: 0,
  vernetzung_gesendet: 10,
  vernetzt: 20,
  gespraech_eroeffnet: 30,
  dm_follow_up: 35,
  dm_beantwortet: 40,
  bedarfsermittlung: 50,
  pitch: 60,
  erstgespraech_vereinbart: 70,
  erstgespraech: 80,
  strategiegespraech_vereinbart: 90,
  strategiegespraech: 100,
  sales_follow_up: 110,
  kunde: 120,
  langfristig: 5,
  beendet: -10,
}

/** 10 Phasen (ux § 1.1) in Pipeline-Reihenfolge. */
export const PHASEN: readonly Phase[] = [
  { key: 'angefragt', label: PHASE_LABEL.angefragt, stages: ['neu', 'vernetzung_gesendet'], ton: 'muted' },
  { key: 'vernetzt', label: PHASE_LABEL.vernetzt, stages: ['vernetzt'], ton: 'muted' },
  { key: 'eroeffnet', label: PHASE_LABEL.eroeffnet, stages: ['gespraech_eroeffnet', 'dm_follow_up'], ton: 'neutral' },
  {
    key: 'beantwortet',
    label: PHASE_LABEL.beantwortet,
    stages: ['dm_beantwortet', 'bedarfsermittlung'],
    ton: 'neutral',
  },
  { key: 'gepitcht', label: PHASE_LABEL.gepitcht, stages: ['pitch'], ton: 'neutral' },
  {
    key: 'erstgespraech',
    label: PHASE_LABEL.erstgespraech,
    stages: ['erstgespraech_vereinbart', 'erstgespraech'],
    ton: 'neutral',
  },
  {
    key: 'strategiegespraech',
    label: PHASE_LABEL.strategiegespraech,
    stages: ['strategiegespraech_vereinbart', 'strategiegespraech', 'sales_follow_up'],
    ton: 'neutral',
  },
  { key: 'kunde', label: PHASE_LABEL.kunde, stages: ['kunde'], ton: 'won' },
  { key: 'wiedervorlage', label: PHASE_LABEL.wiedervorlage, stages: ['langfristig'], ton: 'muted' },
  { key: 'beendet', label: PHASE_LABEL.beendet, stages: ['beendet'], ton: 'ended' },
]

const PHASE_NACH_STAGE = new Map<LeadStage, Phase>()
for (const p of PHASEN) for (const s of p.stages) PHASE_NACH_STAGE.set(s, p)

/** Erste (niedrigste) Stufe jeder Phase – Ziel beim Verschieben in der Pipeline. */
export const ERSTE_STAGE_DER_PHASE: Record<PhaseKey, LeadStage> = Object.fromEntries(
  PHASEN.map((p) => [p.key, p.stages[0]]),
) as Record<PhaseKey, LeadStage>

export function phaseVon(stage: LeadStage): Phase {
  const p = PHASE_NACH_STAGE.get(stage)
  if (!p) throw new Error(`Unbekannte Stufe: ${stage}`)
  return p
}

export function phaseNachKey(key: PhaseKey): Phase {
  const p = PHASEN.find((x) => x.key === key)
  if (!p) throw new Error(`Unbekannte Phase: ${key}`)
  return p
}

type StageLabels = Pick<Settings, 'stage_labels'> | Settings['stage_labels'] | null | undefined

function labels(settings: StageLabels): Settings['stage_labels'] | null {
  if (!settings) return null
  if ('stage_labels' in settings) return settings.stage_labels
  return settings as Settings['stage_labels']
}

/** Feinstufen-Label (Primärquelle `settings.stage_labels`, Fallback `de.ts`). */
export function stageLabel(stage: LeadStage, settings?: StageLabels): string {
  return labels(settings)?.[stage]?.label ?? STUFEN_LABEL[stage].label
}

export function stageShort(stage: LeadStage, settings?: StageLabels): string {
  return labels(settings)?.[stage]?.short ?? STUFEN_LABEL[stage].short
}

/** Wie `crm.stage_rank`. */
export function stageRank(stage: LeadStage): number {
  return RANG[stage]
}

/** Phasen-Index 0…9 (für Sortierung von Kanban-Spalten und Funnel). */
export function phaseIndex(stage: LeadStage): number {
  return PHASEN.indexOf(phaseVon(stage))
}
