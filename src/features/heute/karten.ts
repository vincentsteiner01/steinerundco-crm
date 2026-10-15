// Kleine reine Helfer der Karten (getrennt von den Komponenten – oxlint react/only-export-components).
import type { QueueItem } from '@/types/domain'

/** Aktueller Zeitpunkt (eine Funktion wie `heuteBerlin()`, damit der Render keinen `new Date()`-Aufruf enthält). */
export const jetzt = (): Date => new Date()

export type Faellig = 'today' | 'overdue' | null

export function faelligVon(item: Pick<QueueItem, 'section' | 'due_date'>, heute: string): Faellig {
  if (item.section === 'ueberfaellig') return 'overdue'
  if (item.section === 'heute' || item.due_date === heute) return 'today'
  return null
}

/** Kopfzeilen-Label „KURZFRISTIG 2 · TAG 7 NACH KF 1“ aus title/subtitle der View. */
export function kartenLabel(item: Pick<QueueItem, 'title' | 'subtitle'>): string {
  return [item.title, item.subtitle].filter((s): s is string => !!s && s.trim().length > 0).join(' · ')
}

/** Text „Kurzfristig 2 vorbereitet“ / „Rückruf vorbereitet“ / „Ja (V1) vorgeschlagen“ der kollabierten Karte. */
export function vorbereitetText(item: Pick<QueueItem, 'item_kind' | 'title'>, vorlageName?: string | null): string {
  if (item.item_kind === 'antworten') return vorlageName ? `${vorlageName} vorgeschlagen` : 'Antwort offen'
  if (item.item_kind === 'meeting') return 'Status setzen'
  if (item.item_kind === 'rueckruf') return 'Rückruf vorbereitet'
  return `${item.title ?? 'Schritt'} vorbereitet`
}
