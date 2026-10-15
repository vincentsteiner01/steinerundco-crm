// M3 – Session-Auswertung für Kopfzeile und Block-Ende (T-12): Dials · Erreicht · Entscheider · Termine · Rückrufe · Ø Dauer.
// `is_connect`/`is_dm` kommen aus `call_outcome_defs`; ohne Daten greift die Seed-Belegung.
import type { Call, CallOutcomeDef } from '@/types/domain'

export type BlockZusammenfassung = {
  dials: number
  erreicht: number
  entscheider: number
  termine: number
  rueckrufe: number
  dauerSec: number
}

const CONNECT_STANDARD = new Set([
  'gatekeeper',
  'gatekeeper_blocked',
  'callback_scheduled',
  'dm_interest',
  'meeting_booked',
  'send_info',
  'not_now',
  'not_interested',
  'not_icp',
  'do_not_call',
])
const DM_STANDARD = new Set(['dm_interest', 'meeting_booked', 'send_info', 'not_now', 'not_interested'])

/** Reine Auswertung: Werte stimmen mit den Anruf-Datensätzen der Session überein. */
export function blockZusammenfassung(
  calls: readonly Call[],
  defs?: readonly CallOutcomeDef[] | null,
): BlockZusammenfassung {
  const connect = defs?.length ? new Set(defs.filter((d) => d.is_connect).map((d) => d.outcome)) : CONNECT_STANDARD
  const dm = defs?.length ? new Set(defs.filter((d) => d.is_dm).map((d) => d.outcome)) : DM_STANDARD
  const erreichte = calls.filter((c) => connect.has(c.outcome))
  const dauer = erreichte.reduce((s, c) => s + (c.duration_sec ?? 0), 0)
  return {
    dials: calls.length,
    erreicht: erreichte.length,
    entscheider: calls.filter((c) => dm.has(c.outcome)).length,
    termine: calls.filter((c) => c.outcome === 'meeting_booked').length,
    rueckrufe: calls.filter((c) => c.outcome === 'callback_scheduled').length,
    dauerSec: erreichte.length ? Math.round(dauer / erreichte.length) : 0,
  }
}
