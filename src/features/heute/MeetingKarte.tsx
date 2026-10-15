// Meeting-Karte (BAUPLAN § 3.2 MeetingKarte.tsx, § 1.5 Nr. 28, H-24): item_kind meeting – „Stattgefunden? Status setzen“ mit
// Stattgefunden 1 · No-Show 2 · Abgesagt 3 · Verschoben 4 (useMeetingStatus). Nach No-Show eines Erstgesprächs Vorschlag-Toast
// „Sequenz ‚No-Show Erstgespräch‘ starten? ↵“ → enroll(email_noshow_erstgespraech); ohne E-Mail „Rückruf planen? ↵“ → Aufgabe morgen 10:00.
import { useState } from 'react'
import { NotizFeld } from '@/components/aktionen'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { DatePicker } from '@/components/ui/DatePicker'
import { useEnroll } from '@/data/enrollments'
import { useLead } from '@/data/leads'
import { useMeId, useMembers } from '@/data/members'
import { useMeetingStatus } from '@/data/meetings'
import { useTaskErstellen } from '@/data/tasks'
import { fmtDatumKurz, fmtDatumZeit, fmtZeit } from '@/lib/format'
import { useHotkeys } from '@/lib/keyboard'
import { SEQUENZ } from '@/lib/vorlagenKeys'
import { tagPlus, tagZuDate } from '@/lib/zeit'
import type { MeetingStatus } from '@/types/domain'
import { faelligVon } from './karten'
import { KartenAktionen, KartenKopf, KartenRahmen, KartenSub, KartenWer } from './KartenTeile'
import { useHeuteKontext } from './kontext'
import type { VariantenProps } from './QueueKarte'
import { itemKey } from './sektionen'
import { toastVorschlag } from './vorschlagToast'

const TYP_LABEL = {
  erstgespraech: 'Erstgespräch',
  strategiegespraech: 'Strategiegespräch',
  folgegespraech: 'Folgegespräch',
} as const
const STATUS: { status: MeetingStatus; kbd: '1' | '2' | '3' | '4'; label: string }[] = [
  { status: 'stattgefunden', kbd: '1', label: 'Stattgefunden' },
  { status: 'no_show', kbd: '2', label: 'No-Show' },
  { status: 'abgesagt', kbd: '3', label: 'Abgesagt' },
  { status: 'verschoben', kbd: '4', label: 'Verschoben' },
]
const STATUS_LABEL: Record<MeetingStatus, string> = {
  geplant: 'geplant',
  stattgefunden: 'stattgefunden',
  no_show: 'No-Show',
  abgesagt: 'abgesagt',
  verschoben: 'verschoben',
}

export const NOSHOW_SEQUENZ_TEXT = 'No-Show erfasst. Sequenz ‚No-Show Erstgespräch‘ starten?'
export const NOSHOW_RUECKRUF_TEXT = 'No-Show erfasst. Rückruf planen?'

export function MeetingKarte({ item, onAktion }: VariantenProps) {
  const h = useHeuteKontext()
  const { data: lead } = useLead(item.lead_id)
  const { data: members } = useMembers()
  const me = useMeId()
  const statusMut = useMeetingStatus()
  const enroll = useEnroll()
  const taskErstellen = useTaskErstellen()
  const [verschieben, setVerschieben] = useState(false)
  const [neuWann, setNeuWann] = useState<string | null>(null)

  const leadId = item.lead_id ?? ''
  const meeting = lead?.meetings.find((m) => m.id === item.meeting_id) ?? null
  const typ = meeting?.type ?? 'erstgespraech'
  const wann = meeting?.scheduled_at ?? item.due_at
  const label = `${TYP_LABEL[typ]}${wann ? ` · ${fmtDatumZeit(wann)}` : ''} · Stattgefunden? Status setzen`
  const owner = members?.find((m) => m.id === item.owner_id)
  const salesOwner = members?.find((m) => m.id === lead?.sales_owner_id)

  const setzeStatus = async (status: MeetingStatus, scheduledAt?: string) => {
    if (!item.meeting_id || !leadId || statusMut.isPending) return
    h.markiereEigen(itemKey(item))
    try {
      await statusMut.mutateAsync({ id: item.meeting_id, leadId, status, scheduledAt })
    } catch {
      return
    }
    const text = `${TYP_LABEL[typ]} ${STATUS_LABEL[status]}${scheduledAt ? ` auf ${fmtDatumKurz(scheduledAt)} ${fmtZeit(scheduledAt)}` : ''}`
    toast(`${text}.`)
    h.onErledigt(itemKey(item), { art: 'erledigt', text, activityId: null, name: item.lead_name })
    if (status === 'no_show' && typ === 'erstgespraech') {
      if (lead?.email) {
        toastVorschlag(NOSHOW_SEQUENZ_TEXT, {
          label: 'Starten',
          onAusfuehren: () => enroll.mutate({ leadId, sequenceKey: SEQUENZ.email_noshow_erstgespraech }),
        })
      } else {
        toastVorschlag(NOSHOW_RUECKRUF_TEXT, {
          label: 'Rückruf',
          onAusfuehren: () =>
            taskErstellen.mutate({
              lead_id: leadId,
              member_id: me,
              kind: 'rueckruf',
              title: 'Rückruf',
              due_at: tagZuDate(tagPlus(h.heute, 1), '10:00').toISOString(),
            }),
        })
      }
    }
    onAktion('termin')
  }

  const verschiebenBestaetigen = () => {
    if (!neuWann || neuWann.length < 16) return
    void setzeStatus('verschoben', tagZuDate(neuWann.slice(0, 10), neuWann.slice(11, 16)).toISOString())
    setVerschieben(false)
  }

  useHotkeys(
    'karte',
    {
      '1': () => void setzeStatus('stattgefunden'),
      '2': () => void setzeStatus('no_show'),
      '3': () => void setzeStatus('abgesagt'),
      '4': () => setVerschieben(true),
    },
    [item.meeting_id, typ, lead?.email],
  )

  return (
    <KartenRahmen aktiv faellig={faelligVon(item, h.heute)} data-key={item.item_id ?? undefined}>
      <KartenKopf label={label} item={item} heute={h.heute} />
      <KartenWer item={item} owner={owner} salesOwner={salesOwner} />
      <KartenSub>
        {[lead?.role_title, lead?.city, meeting?.location].filter(Boolean).join(' · ')}
        {meeting?.duration_min ? ` · ${meeting.duration_min} Min.` : null}
      </KartenSub>
      <KartenAktionen>
        {STATUS.map((s) => (
          <Button
            key={s.status}
            variante={s.status === 'stattgefunden' ? 'primary' : 'secondary'}
            kbd={s.kbd}
            busy={statusMut.isPending && statusMut.variables?.status === s.status}
            onClick={() => (s.status === 'verschoben' ? setVerschieben(true) : void setzeStatus(s.status))}
          >
            {s.label}
          </Button>
        ))}
        <NotizFeld
          leadId={leadId}
          aktiv
          trigger={
            <Button variante="quiet" groesse="S" kbd="N">
              Notiz
            </Button>
          }
          onFertig={() => onAktion('notiz')}
        />
      </KartenAktionen>
      {verschieben ? (
        <div className="mt-3 flex flex-wrap items-end gap-2" role="group" aria-label="Verschieben auf">
          <DatePicker wert={neuWann} onChange={setNeuWann} mitUhrzeit presets={['morgen', '+3', 'mo', '+1w']} />
          <Button variante="primary" groesse="S" kbd="⌘↵" onClick={verschiebenBestaetigen} disabled={!neuWann}>
            Verschieben
          </Button>
          <Button variante="quiet" groesse="S" kbd="Esc" onClick={() => setVerschieben(false)}>
            Abbrechen
          </Button>
        </div>
      ) : null}
    </KartenRahmen>
  )
}
