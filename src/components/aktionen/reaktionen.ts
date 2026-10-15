// Reaktions-Chips `1–9` der Aktion „Antwort erhalten“ (BAUPLAN § 3.1.10b, § 1.5 Nr. 26). Vorlagen-Mapping ausschließlich
// über lib/vorlagenKeys (PHASE2_VORLAGE_NACH_LABEL / phase2Vorlage); `widerspruch` nur über „Widerspruch erfassen“.
import { phase2Vorlage, type VorlageKey } from '@/lib/vorlagenKeys'
import { reaktionLabel } from '@/texte/de'
import type { ReplyLabel } from '@/types/domain'

export type ReaktionChip = {
  kbd: '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  label: string
  reply: ReplyLabel
  /** Zitat ist Pflicht (Chip 4 „Nein (mit Grund)“). */
  zitatPflicht: boolean
}

export const REAKTION_CHIPS: readonly ReaktionChip[] = [
  { kbd: '1', label: reaktionLabel('interessiert'), reply: 'interessiert', zitatPflicht: false },
  { kbd: '2', label: reaktionLabel('frage'), reply: 'frage', zitatPflicht: false },
  { kbd: '3', label: reaktionLabel('kein_bedarf'), reply: 'kein_bedarf', zitatPflicht: false },
  { kbd: '4', label: reaktionLabel('kein_bedarf', true), reply: 'kein_bedarf', zitatPflicht: true },
  { kbd: '5', label: reaktionLabel('hat_partner'), reply: 'hat_partner', zitatPflicht: false },
  { kbd: '6', label: reaktionLabel('falsches_problem'), reply: 'falsches_problem', zitatPflicht: false },
  { kbd: '7', label: reaktionLabel('spaeter'), reply: 'spaeter', zitatPflicht: false },
  { kbd: '8', label: reaktionLabel('sonstiges'), reply: 'sonstiges', zitatPflicht: false },
  { kbd: '9', label: reaktionLabel('nicht_icp'), reply: 'nicht_icp', zitatPflicht: false },
]

/** Vorgeschlagene Phase-2-Vorlage je Chip (Chip 4 → `li_bedarf_nein_mit_grund`, Chip 9 → keine: `log_reply` beendet den Lead). */
export function vorlageFuerChip(chip: ReaktionChip): VorlageKey | null {
  return phase2Vorlage(chip.reply, chip.zitatPflicht)
}

/** Chip 4 ohne Zitat ist blockiert. */
export function chipBlockiert(chip: ReaktionChip | null, zitat: string): boolean {
  return !!chip && chip.zitatPflicht && zitat.trim().length === 0
}

export const ZITAT_PFLICHT_TEXT = 'Zitat ist Pflicht bei ‚Nein (mit Grund)‘.'
