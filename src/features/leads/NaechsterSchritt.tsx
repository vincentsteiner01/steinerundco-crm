// BAUPLAN § 3.3 `NaechsterSchritt.tsx` (DESIGN-SYSTEM § 5.11, ux § 3.3.2): Mini-Queue-Karte (heute/public.QueueKarte) oder
// Zustand „Keine Sequenz aktiv“ (SequenzStartenMenue · Wiedervorlage · Beenden) oder „Beendet · Grund · Datum · Reaktivieren“.
import { useNavigate } from 'react-router'
import { PFADE } from '@/app/pfade'
import { Beenden, Spaeter, Wiedervorlage } from '@/components/aktionen'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { ZeitChip } from '@/components/ui/Chip'
import { useLeadUpdate } from '@/data/leads'
import { useSequencesIndex } from '@/data/sequences'
import { useSettings } from '@/data/settings'
import { QueueKarte, type QueueAktion } from '@/features/heute/public'
import { SequenzStartenMenue } from '@/features/sequenzen/public'
import { fmtDatum, fmtDatumKurz, heuteBerlin } from '@/lib/format'
import { kontaktGate, telefonGate, type SperrlistenTreffer } from '@/lib/gates'
import { GATE_GRUND_LABEL, GRUND_LABEL } from '@/texte/de'
import type { LeadMitBezug, QueueItem } from '@/types/domain'
import { reaktivierungsStufe } from './detailLogik'

export type NaechsterSchrittProps = {
  lead: LeadMitBezug
  /** Queue-Eintrag des Leads (aus useQueue(owner) gefiltert) – M1 rendert die Karte */
  item: QueueItem | null
  kontext?: 'heute' | 'peek'
  /** Karten-Tasten (C E S N A B) nur, wenn die Karte den Fokus hat (Peek: ja) */
  aktiv?: boolean
  sperrliste?: SperrlistenTreffer
}

export function NaechsterSchritt({ lead, item, kontext = 'peek', aktiv = true, sperrliste }: NaechsterSchrittProps) {
  const navigate = useNavigate()
  const update = useLeadUpdate()
  const { data: settings } = useSettings()
  const { data: seq } = useSequencesIndex()
  const heute = heuteBerlin()

  const onAktion = (a: QueueAktion) => {
    // Datenaktionen führt die Karte (M1) selbst aus; hier nur Navigation
    if (a === 'oeffnen') navigate(PFADE.lead(lead.id))
    if (a === 'anrufen') {
      // § 8.2 Nr. 2: nur mit offenem Telefon-Gate in den Anruf-Screen (Review)
      const g = telefonGate(lead, sperrliste)
      if (g.erlaubt) navigate(PFADE.anruf(lead.id))
      else toast(GATE_GRUND_LABEL[g.grund ?? 'keine_nummer'])
    }
  }

  if (lead.stage === 'beendet') {
    const grund = lead.ended_reason
      ? (settings?.ended_reason_labels?.[lead.ended_reason] ?? GRUND_LABEL[lead.ended_reason])
      : '–'
    const reaktivieren = async () => {
      try {
        await update.mutateAsync({
          id: lead.id,
          erwartetUpdatedAt: lead.updated_at,
          patch: { stage: reaktivierungsStufe(lead), ended_reason: null, ended_note: null, ended_at: null },
        })
        toast('Reaktiviert.')
      } catch {
        /* Toast kommt aus der Mutation */
      }
    }
    return (
      <div
        className="border-line-strong bg-surface mb-5 rounded-md border px-4 py-3.5"
        data-naechster-schritt="beendet"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="label">Beendet</span>
          <span className="text-ink text-[14px]">
            {grund}
            {lead.ended_at ? ` · ${fmtDatum(lead.ended_at)}` : ''}
          </span>
          {lead.ended_note ? <span className="text-small text-ink-3">· {lead.ended_note}</span> : null}
          <span className="flex-1" />
          <Button variante="secondary" groesse="S" busy={update.isPending} onClick={() => void reaktivieren()}>
            Reaktivieren
          </Button>
        </div>
      </div>
    )
  }

  if (item) {
    return (
      <div className="mb-5" data-naechster-schritt="karte">
        <QueueKarte item={item} aktiv={aktiv} onAktion={onAktion} kontext={kontext} />
        <div className="mt-1.5 flex justify-end">
          <Button
            variante="quiet"
            groesse="S"
            onClick={() => navigate(`${PFADE.heute}?lead=${encodeURIComponent(lead.id)}`)}
          >
            Jetzt vorbereiten →
          </Button>
        </div>
      </div>
    )
  }

  const enrollment = (lead.enrollments ?? [])
    .filter((e) => e.status === 'aktiv' && e.next_due_at)
    .sort((a, b) => (a.next_due_at ?? '').localeCompare(b.next_due_at ?? ''))[0]
  if (enrollment?.next_due_at) {
    const sequenz = seq?.sequenzen.find((s) => s.id === enrollment.sequence_id)
    const schritt = enrollment.current_step_id ? seq?.stepsById.get(enrollment.current_step_id) : undefined
    const gesamt = sequenz?.steps.length ?? 0
    return (
      <div
        className="border-line-strong bg-surface mb-5 rounded-md border px-4 py-3.5"
        data-naechster-schritt="sequenz"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="label">Nächster Schritt{schritt ? ` · ${schritt.name}` : ''}</span>
          <ZeitChip datum={enrollment.next_due_at} heute={heute} />
          <span className="text-small text-ink-3">
            {sequenz
              ? `${sequenz.name}${gesamt ? ` · Schritt ${enrollment.current_position ?? 1}/${gesamt}` : ''}`
              : ''}
            {' · '}
            {fmtDatumKurz(enrollment.next_due_at)}
          </span>
          <span className="flex-1" />
          <Spaeter
            leadId={lead.id}
            enrollmentId={enrollment.id}
            aktiv={aktiv}
            snoozeCount={enrollment.snooze_count}
            faelligAm={enrollment.next_due_at}
          />
        </div>
      </div>
    )
  }

  const gate = kontaktGate(lead, sperrliste)
  const wiedervorlage =
    lead.stage === 'langfristig' ? lead.tasks?.find((t) => t.kind === 'wiedervorlage' && t.status === 'offen') : null
  return (
    <div className="border-line-strong bg-surface mb-5 rounded-md border px-4 py-3.5" data-naechster-schritt="keine">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-ink text-[14px]">
          {wiedervorlage ? `Wiedervorlage am ${fmtDatum(wiedervorlage.due_at)}` : 'Keine Sequenz aktiv'}
        </span>
        <span className="flex-1" />
        {gate.erlaubt ? <SequenzStartenMenue leadId={lead.id} /> : null}
        <Wiedervorlage leadId={lead.id} aktiv={aktiv} />
        <Beenden leadId={lead.id} aktiv={aktiv} />
      </div>
    </div>
  )
}
