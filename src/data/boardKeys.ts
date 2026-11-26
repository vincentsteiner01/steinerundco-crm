// Schlüssel des Boards (26.11.2026), getrennt von board.ts: Realtime (im Start-Bündel) braucht nur diese drei Dinge, nicht die
// ganze Daten-Schicht des Boards.
import type { QueryKey } from '@tanstack/react-query'
import { qk } from './queryKeys'

export const BOARD_KEY = [...qk.leads.all, 'board'] as const

/** Gemeinsamer Schlüssel aller Schreibvorgänge des Boards (verschieben, anlegen, Lead-Blatt speichern) – nur zum Zählen. */
export const BOARD_SCHREIBEN = ['board', 'schreiben'] as const

/** Gehört die Abfrage zum Board (BOARD_KEY oder eine Verlängerung)? */
export const istBoardKey = (key: QueryKey): boolean => BOARD_KEY.every((teil, i) => key[i] === teil)
