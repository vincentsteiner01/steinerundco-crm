// BAUPLAN § 3.3 Drop-Regeln (verbindlich, reine Funktion): Ziel-Phase → Aktion. Ein Drop ändert nie `owner_id`;
// Rückwärts-Drops stoppen keine Sequenzen (das entscheidet die DB: nur `beendet`/`kunde`). ux § 3.4, P-02 … P-06.
import { ERSTE_STAGE_DER_PHASE, phaseIndex, phaseNachKey } from '@/lib/stufen'
import type { LeadStage, PhaseKey } from '@/types/domain'

export type DropAktion =
  | { art: 'stage'; stage: LeadStage }
  | { art: 'termin'; typ: 'erstgespraech' | 'strategiegespraech' }
  | { art: 'kunde' }
  | { art: 'wiedervorlage' }
  | { art: 'beenden' }

/** Ziel-Phase → Aktion. Direkte Stufen: Angefragt → vernetzung_gesendet (Korrektur), Vernetzt → vernetzt, Eröffnet → gespraech_eroeffnet … */
export function dropRegel(ziel: PhaseKey): DropAktion {
  switch (ziel) {
    case 'angefragt':
      return { art: 'stage', stage: 'vernetzung_gesendet' }
    case 'vernetzt':
      return { art: 'stage', stage: 'vernetzt' }
    case 'eroeffnet':
      return { art: 'stage', stage: 'gespraech_eroeffnet' }
    case 'beantwortet':
      return { art: 'stage', stage: 'dm_beantwortet' }
    case 'gepitcht':
      return { art: 'stage', stage: 'pitch' }
    case 'erstgespraech':
      return { art: 'termin', typ: 'erstgespraech' }
    case 'strategiegespraech':
      return { art: 'termin', typ: 'strategiegespraech' }
    case 'kunde':
      return { art: 'kunde' }
    case 'wiedervorlage':
      return { art: 'wiedervorlage' }
    case 'beendet':
      return { art: 'beenden' }
  }
}

/** Braucht die Aktion ein Popover/einen Dialog (Pflichtangabe vor dem Wechsel)? */
export function brauchtDialog(a: DropAktion): boolean {
  return a.art !== 'stage'
}

/** Rückwärts = Ziel-Phase liegt in der Pipeline vor der aktuellen (Timeline sagt dann „Phase zurückgesetzt“). */
export function istRueckwaerts(von: LeadStage, ziel: PhaseKey): boolean {
  return phaseIndex(von) > phaseIndex(ERSTE_STAGE_DER_PHASE[ziel])
}

/** Nachbar-Phase für ⇧→ / ⇧← (null am Rand). */
export function nachbarPhase(von: LeadStage, richtung: 1 | -1): PhaseKey | null {
  const i = phaseIndex(von) + richtung
  const keys: PhaseKey[] = [
    'angefragt',
    'vernetzt',
    'eroeffnet',
    'beantwortet',
    'gepitcht',
    'erstgespraech',
    'strategiegespraech',
    'kunde',
    'wiedervorlage',
    'beendet',
  ]
  const k = keys[i]
  return k ? phaseNachKey(k).key : null
}

/** Drop auf die eigene Phase ist keine Aktion. */
export function istGleichePhase(von: LeadStage, ziel: PhaseKey): boolean {
  return phaseIndex(von) === phaseIndex(ERSTE_STAGE_DER_PHASE[ziel])
}
