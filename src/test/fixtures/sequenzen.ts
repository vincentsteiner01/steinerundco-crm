// Seed-Sequenzen (nur Struktur und Verzögerungen – E14) als synthetische Fixture. Spalten wie crm.sequences /
// crm.sequence_steps (name, weekdays_only, stop_on_*, trigger_kind), Keys aus lib/vorlagenKeys (SEQUENZ) – Integration M1–M8.
import { SEQUENZ } from '@/lib/vorlagenKeys'
import type { SequenceMitSchritten } from '@/types/domain'

let nr = 0

function seq(
  key: string,
  name: string,
  channel: 'linkedin' | 'telefon' | 'email',
  delays: number[],
  active = true,
): SequenceMitSchritten {
  nr += 1
  const id = `30000000-0000-4000-8000-${String(nr).padStart(12, '0')}`
  const basis = {
    id,
    key,
    name,
    channel,
    active,
    version: 1,
    description: null,
    trigger_kind: 'manuell',
    weekdays_only: true,
    stop_on_meeting: true,
    stop_on_reply: true,
    created_at: '2026-10-01T09:00:00+02:00',
    updated_at: '2026-10-01T09:00:00+02:00',
  }
  const steps = delays.map((d, i) => ({
    id: `30000000-0000-4000-8${String(nr).padStart(3, '0')}-${String(i + 1).padStart(12, '0')}`,
    sequence_id: id,
    position: i + 1,
    name: `Schritt ${i + 1}`,
    kind: channel === 'telefon' ? 'anruf' : channel === 'email' ? 'email' : 'nachricht',
    channel,
    delay_days: d,
    template_id: null,
    is_opener: i === 0 && channel === 'linkedin',
    sets_stage: null,
    instructions: null,
    created_at: '2026-10-01T09:00:00+02:00',
    updated_at: '2026-10-01T09:00:00+02:00',
  }))
  return { ...(basis as unknown as SequenceMitSchritten), steps: steps as unknown as SequenceMitSchritten['steps'] }
}

export const SEQUENZEN: SequenceMitSchritten[] = [
  seq(SEQUENZ.linkedin_standard, 'A', 'linkedin', [0, 3, 7, 10, 70, 84]),
  seq(SEQUENZ.linkedin_vernetzt_ohne_antwort, 'B', 'linkedin', [2, 4, 7, 10, 70, 84]),
  seq(SEQUENZ.linkedin_nachfassen_im_gespraech, 'C', 'linkedin', [3, 7, 70]),
  seq(SEQUENZ.linkedin_sheet_regel, 'A alt', 'linkedin', [0, 3, 3, 3, 30, 30], false),
  seq(SEQUENZ.telefon_standard, 'Telefon-Standard', 'telefon', [0, 2, 3, 4, 5, 90]),
  seq(SEQUENZ.email_warm_after_erstgespraech, 'E-Mail Erstgespräch', 'email', [0, 3, 7, 11, 69]),
  seq(SEQUENZ.email_warm_after_strategiegespraech, 'E-Mail Strategiegespräch', 'email', [0, 5, 9]),
  seq(SEQUENZ.email_noshow_erstgespraech, 'No-Show Erstgespräch', 'email', [0, 3]),
  seq(SEQUENZ.email_info_nach_linkedin_zusage, 'Infomail', 'email', [0, 4, 8]),
]
