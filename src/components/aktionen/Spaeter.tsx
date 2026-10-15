// „Später“ `S` (BAUPLAN § 3.1.10b, ux § 2.3 Schritt 2, H-07/H-08): Popover 1 morgen · 2 +3 T · 3 nächster Montag · 4 +1 W ·
// 5 +2 Mo (→ Wiedervorlage) · D Datum → rpc.snoozeStep / rpc.snoozeTask (über die Hooks); ab snooze_count ≥ settings.queue.snooze_warn_after
// Frage „Dreimal verschoben – beenden oder Wiedervorlage?“; Undo über die `schritt_verschoben`-Aktivität (nur Sequenzschritte).
import { useState } from 'react'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { DatePicker } from '@/components/ui/DatePicker'
import { Popover, PopoverEintrag } from '@/components/ui/Popover'
import { useEnrollments, useSnoozeStep } from '@/data/enrollments'
import { useSettings } from '@/data/settings'
import { useSetWiedervorlage, useSnoozeTask, useTasks } from '@/data/tasks'
import { useUndo } from '@/data/undo'
import { fmtDatum, fmtDatumKurz, heuteBerlin } from '@/lib/format'
import { tagPlus, tagZuDate } from '@/lib/zeit'
import { TOAST } from '@/texte/de'
import {
  nachleseAktivitaet,
  useAktionTaste,
  useLeadInvalidierung,
  useOffen,
  useTastenWaehrendOffen,
  type AktionProps,
} from './_gemeinsam'
import { AktionButton, ScopeFormular } from './_Teile'
import { Beenden } from './Beenden'
import { spaeterOptionen, spaeterWann } from './spaeterOptionen'
import { Wiedervorlage } from './Wiedervorlage'

export type SpaeterProps = AktionProps & {
  /** Bisherige Verschiebungen des Schritts/der Aufgabe (sonst aus den Hooks gelesen) */
  snoozeCount?: number
  /** Fälligkeit des Schritts/der Aufgabe (`next_due_at`/`due_at`) – Basis von 1/2/4 (sonst aus den Hooks gelesen) */
  faelligAm?: string | null
}

export function Spaeter({
  leadId,
  enrollmentId,
  taskId,
  trigger,
  offen: offenProp,
  onOpenChange,
  onFertig,
  aktiv,
  snoozeCount,
  faelligAm,
  className,
}: SpaeterProps) {
  const [offen, setOffen] = useOffen(offenProp, onOpenChange)
  const [datumOffen, setDatumOffen] = useState(false)
  const [trotzdem, setTrotzdem] = useState(false)
  const { data: settings } = useSettings()
  const nachladen = snoozeCount === undefined || faelligAm === undefined
  const { data: enrollments } = useEnrollments(enrollmentId && nachladen ? leadId : null)
  const { data: tasks } = useTasks(taskId && nachladen ? leadId : null)
  const snoozeStep = useSnoozeStep()
  const snoozeTask = useSnoozeTask()
  const wiedervorlage = useSetWiedervorlage()
  const { anbieten } = useUndo()
  const inval = useLeadInvalidierung()

  const heute = heuteBerlin()
  const faellig =
    faelligAm !== undefined
      ? faelligAm
      : enrollmentId
        ? enrollments?.find((e) => e.id === enrollmentId)?.next_due_at
        : taskId
          ? tasks?.find((t) => t.id === taskId)?.due_at
          : null
  const optionen = spaeterOptionen(heute, settings?.feiertage, faellig)
  const dueTime = settings?.queue.due_time ?? '09:00'
  const warnAb = settings?.queue.snooze_warn_after ?? 3
  const bisher =
    snoozeCount ??
    (enrollmentId ? enrollments?.find((e) => e.id === enrollmentId)?.snooze_count : undefined) ??
    (taskId ? tasks?.find((t) => t.id === taskId)?.snooze_count : undefined) ??
    0
  const frage = bisher >= warnAb && !trotzdem
  const kannVerschieben = !!enrollmentId || !!taskId
  const busy = snoozeStep.isPending || snoozeTask.isPending || wiedervorlage.isPending

  const schliessen = (o: boolean) => {
    setOffen(o)
    if (!o) {
      setDatumOffen(false)
      setTrotzdem(false)
    }
  }

  /** `tage` (1/2/4): die DB rechnet ab max(next_due_at, jetzt) – ein schon künftiger Schritt rückt weiter (§ 5.2, A7). */
  const verschieben = async (tag: string, tage?: number) => {
    if (busy || !kannVerschieben) return
    const ziel = tage ? { days: tage } : { until: tagZuDate(tag, dueTime).toISOString() }
    try {
      if (enrollmentId) await snoozeStep.mutateAsync({ enrollmentId, leadId, ...ziel })
      else if (taskId) await snoozeTask.mutateAsync({ taskId, leadId, ...ziel })
    } catch {
      return
    }
    inval(leadId)
    const text = TOAST.spaeter(spaeterWann(tag, heute))
    const a = enrollmentId ? await nachleseAktivitaet(leadId, ['schritt_verschoben']) : null
    if (a) anbieten(a.id, text, leadId)
    else toast(text)
    schliessen(false)
    onFertig?.()
  }

  const parken = async (tag: string) => {
    if (busy) return
    try {
      await wiedervorlage.mutateAsync({ leadId, due: tag })
    } catch {
      return
    }
    inval(leadId)
    const text = `Wiedervorlage am ${fmtDatum(tag)}.`
    const a = await nachleseAktivitaet(leadId, ['stage_wechsel'])
    if (a) anbieten(a.id, text, leadId)
    else toast(text)
    schliessen(false)
    onFertig?.()
  }

  const waehle = (o: (typeof optionen)[number]) =>
    o.wiedervorlage ? void parken(o.tag) : void verschieben(o.tag, o.tage)

  useAktionTaste('s', trigger === undefined && !!aktiv, () => setOffen(true))
  useTastenWaehrendOffen(offen, (b) => {
    if (frage) return undefined
    const o = optionen.find((x) => x.kbd === b)
    if (o) {
      waehle(o)
      return true
    }
    if (b === 'd') {
      setDatumOffen(true)
      return true
    }
    return undefined
  })

  return (
    <Popover
      offen={offen}
      onOpenChange={schliessen}
      titel="Später"
      className={className}
      trigger={
        trigger ?? (
          <AktionButton kbd="S" disabled={!kannVerschieben}>
            Später
          </AktionButton>
        )
      }
    >
      <ScopeFormular />
      {frage ? (
        <div className="grid gap-2.5 p-1.5" role="group" aria-label="Dreimal verschoben">
          <p className="text-ui text-ink">Dreimal verschoben – beenden oder Wiedervorlage?</p>
          <div className="flex flex-wrap gap-1.5">
            <Beenden
              leadId={leadId}
              trigger={<Button groesse="S">Beenden</Button>}
              onFertig={() => schliessen(false)}
            />
            <Wiedervorlage
              leadId={leadId}
              trigger={<Button groesse="S">Wiedervorlage</Button>}
              onFertig={() => schliessen(false)}
            />
            <Button variante="quiet" groesse="S" onClick={() => setTrotzdem(true)}>
              Trotzdem verschieben
            </Button>
          </div>
        </div>
      ) : (
        <div role="menu" aria-label="Später">
          {optionen.map((o) => (
            <PopoverEintrag
              key={o.kbd}
              kbd={o.kbd}
              role="menuitem"
              mono={fmtDatumKurz(o.tag)}
              disabled={busy || (!o.wiedervorlage && !kannVerschieben)}
              onClick={() => waehle(o)}
            >
              {o.label}
            </PopoverEintrag>
          ))}
          {datumOffen ? (
            <div className="px-1 pt-1.5 pb-1" role="group" aria-label="Datum">
              <DatePicker
                wert={null}
                min={tagPlus(heute, 1)}
                presets={['morgen', '+3', 'mo', '+1w', '+2m']}
                placeholder="Datum wählen"
                onChange={(iso) => iso && void verschieben(iso)}
              />
            </div>
          ) : (
            <PopoverEintrag
              kbd="D"
              role="menuitem"
              disabled={busy || !kannVerschieben}
              onClick={() => setDatumOffen(true)}
            >
              Datum …
            </PopoverEintrag>
          )}
        </div>
      )}
    </Popover>
  )
}
