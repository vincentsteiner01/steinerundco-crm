// Etiketten-Farbe je Phase (helles Design, 20.10.2026) – StatusChip, Pipeline-Spalten.
import type { PhaseKey } from '@/types/domain'
import type { ChipTon } from './Chip'

/** Farbe je Phase (Notion-Etiketten): vom kalten Anfang zum warmen Abschluss, Kunde grün, beendet als Umriss. */
export const PHASE_FARBE: Record<PhaseKey, ChipTon> = {
  angefragt: 'grau',
  vernetzt: 'blau',
  eroeffnet: 'lila',
  beantwortet: 'rosa',
  gepitcht: 'braun',
  erstgespraech: 'gelb',
  strategiegespraech: 'orange',
  kunde: 'gruen',
  wiedervorlage: 'grau',
  beendet: 'ended',
}
