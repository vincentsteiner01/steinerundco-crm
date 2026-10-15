// Getrackter Anteil des LinkedIn-Tageszählers („n davon mit Profil erfasst“) – Modul-Logik auf dem M0-Hook
// useActivitiesZeitraum. `useMarkAccepted`/`useLogRequest` liegen seit der Integration in src/data/connections.ts.
import { useActivitiesZeitraum } from '@/data/activities'
import { heuteBerlin } from '@/lib/format'
import type { ActivityType } from '@/types/domain'

const ANFRAGE_TYPEN: ActivityType[] = ['vernetzung_gesendet']

/**
 * Anfragen der Person am heutigen Berliner Tag. BAUPLAN § 3.2 nennt `linkedin_connections.requested_at heute`; der Trigger
 * `connections_after_write` schreibt je Anfrage genau eine `vernetzung_gesendet`-Aktivität – gezählt über den M0-Hook.
 */
export function useAnfragenHeute(memberId: string | null | undefined) {
  const heute = heuteBerlin()
  const r = useActivitiesZeitraum(memberId ?? 'team', heute, heute, memberId ? ANFRAGE_TYPEN : [])
  return { ...r, data: memberId ? r.data : [] }
}
