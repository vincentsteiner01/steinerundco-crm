// Kleine reine Helfer der Leads-Seiten (kein JSX): Zeitpunkte zu Berliner Wanduhrzeit, stabile Listen. Die Nachlese der Trigger-
// Aktivität für den Undo-Toast ist seit der Integration `nachleseAktivitaet` (src/data/activities.ts).
import { useMemo } from 'react'
import { tagZuDate } from '@/lib/zeit'

/** Jetzt als ISO-Zeitstempel (Schreibzugriffe wie `phone_collected_at`). */
export function jetztIso(): string {
  return new Date().toISOString()
}

/**
 * Nächste Aktion an einem Kalendertag zur Fälligkeitszeit (settings.queue.due_time, Standard 09:00) in Europe/Berlin –
 * mit dem richtigen Versatz (Sommer +02:00, Winter +01:00) statt eines festen Suffixes.
 */
export function naechsteAktionIso(tag: string, dueTime = '09:00'): string {
  return tagZuDate(tag, dueTime).toISOString()
}

/**
 * Stabile Identität einer geladenen Lead-Liste: `useLeadsUnendlich` liefert bei jedem Render ein neues Array (`pages.flat()`);
 * abhängige Memos/Effekte (Peek-Liste, Cursor) liefen sonst in jeder Runde. Neu nur, wenn sich IDs oder `updated_at` ändern.
 */
export function useStabileListe<T extends { id: string; updated_at: string }>(liste: T[]): T[] {
  const signatur = liste.map((l) => `${l.id}:${l.updated_at}`).join('|')
  // eslint-disable-next-line react-hooks/exhaustive-deps -- absichtlich nur über die Signatur
  return useMemo(() => liste, [signatur])
}
