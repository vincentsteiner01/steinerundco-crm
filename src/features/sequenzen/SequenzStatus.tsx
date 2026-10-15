// Sequenz-Status für Kanal-Karten (BAUPLAN § 3.2 SequenzStatus.tsx, § 5.4 Stale-Regeln): Chip „A · Schritt 3/6 · nächster Mi 14.10.“,
// „pausiert“, „Ruht bis 14.01.“ (LinkedIn Position 5/6, nächster Termin in der Zukunft). Ohne laufende Sequenz nichts.
import { Chip } from '@/components/ui/Chip'
import { useEnrollments } from '@/data/enrollments'
import { useSequencesIndex } from '@/data/sequences'
import { fmtDatumKurz, heuteBerlin } from '@/lib/format'
import { berlinTag } from '@/lib/zeit'
import type { Channel } from '@/types/domain'

export function SequenzStatus({ leadId, kanal }: { leadId: string; kanal: Channel }) {
  const { data: enrollments } = useEnrollments(leadId)
  const { data: idx } = useSequencesIndex()
  const e = enrollments?.find((x) => x.channel === kanal && (x.status === 'aktiv' || x.status === 'pausiert'))
  if (!e) return null
  const seq = idx?.sequenzen.find((s) => s.id === e.sequence_id)
  const name = seq?.name ?? 'Sequenz'
  const gesamt = seq?.steps.length ?? 0
  const naechster = e.next_due_at ? fmtDatumKurz(e.next_due_at) : null
  const heute = heuteBerlin()
  const ruht =
    kanal === 'linkedin' &&
    (e.current_position === 5 || e.current_position === 6) &&
    !!e.next_due_at &&
    berlinTag(e.next_due_at) > heute
  if (e.status === 'pausiert')
    return (
      <Chip ton="muted" title={`${name} · Schritt ${e.current_position}/${gesamt}`}>
        {name} · pausiert
      </Chip>
    )
  if (ruht)
    return (
      <Chip ton="later" title={`${name} · Schritt ${e.current_position}/${gesamt}`}>
        Ruht bis {naechster}
      </Chip>
    )
  return (
    <Chip ton="neutral" className="tnum">
      {name} · Schritt {e.current_position}/{gesamt}
      {naechster ? ` · nächster ${naechster}` : ''}
    </Chip>
  )
}
