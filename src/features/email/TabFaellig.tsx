// BAUPLAN § 3.5 `TabFaellig.tsx`: QueueKarten (heute/public) mit Kanal E-Mail aus useQueue(me) (Sektionen überfällig/heute) +
// manuelle E-Mail-Aufgaben (tasks mit Vorlage Kanal E-Mail oder Titel „Kurzinfo…“). J/K/Enter, ⌥M = verfassen.
import { useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { Chip, ZeitChip } from '@/components/ui/Chip'
import { EmptyState } from '@/components/ui/EmptyState'
import { LadeFehler } from '@/components/ui/LadeFehler'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/components/ui/cn'
import { useCompleteTask, useMeId, useQueue, useTasksFaellig, useTemplates } from '@/data'
import { QueueKarte, type QueueAktion } from '@/features/heute/public'
import { useHotkeys } from '@/lib/keyboard'
import { LEER } from '@/texte/de'
import type { QueueItem, Task } from '@/types/domain'
import { faelligeEmailSchritte, manuelleEmailAufgaben } from './faellig'
import { LeadName } from './EmailZeile'
import { aktuellerPfad, verfassenUrl } from './links'
import { useListenCursor } from './listenCursor'

export function TabFaellig({ aktiv = true }: { aktiv?: boolean }) {
  const me = useMeId()
  const { data: queue, isPending: queueLaedt, error: queueFehler, refetch } = useQueue(me)
  const { data: tasks } = useTasksFaellig(me)
  const { data: templates } = useTemplates({ channel: 'email' })
  const erledigen = useCompleteTask()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const schritte = useMemo(() => faelligeEmailSchritte(queue ?? []), [queue])
  const aufgaben = useMemo(() => manuelleEmailAufgaben(tasks ?? [], templates ?? []), [tasks, templates])
  const ids = useMemo(
    () => [...schritte.map((s) => s.item_id ?? ''), ...aufgaben.map((a) => a.id)].filter(Boolean),
    [schritte, aufgaben],
  )

  const verfassen = useCallback(
    (z: { leadId: string; vorlageId?: string | null; enrollmentId?: string | null; schrittId?: string | null }) =>
      navigate(verfassenUrl({ ...z, zurueck: aktuellerPfad() })),
    [navigate],
  )
  const oeffnen = useCallback(
    (id: string) => {
      const s = schritte.find((x) => x.item_id === id)
      if (s?.lead_id)
        return verfassen({
          leadId: s.lead_id,
          vorlageId: s.template_id,
          enrollmentId: s.enrollment_id,
          schrittId: s.step_id,
        })
      const a = aufgaben.find((x) => x.id === id)
      if (a?.lead_id) verfassen({ leadId: a.lead_id, vorlageId: a.template_id })
    },
    [schritte, aufgaben, verfassen],
  )
  const { cursor, setCursor } = useListenCursor(ids, oeffnen, aktiv)
  useHotkeys('liste', aktiv && cursor ? { 'alt+m': () => oeffnen(cursor) } : {}, [aktiv, cursor, oeffnen])

  const peek = (leadId: string) => {
    const p = new URLSearchParams(params)
    p.set('lead', leadId)
    setParams(p, { replace: true })
  }
  const aktion = (item: QueueItem, a: QueueAktion) => {
    if (!item.lead_id) return
    if (a === 'oeffnen' || a === 'kopieren' || a === 'gesendet')
      verfassen({
        leadId: item.lead_id,
        vorlageId: item.template_id,
        enrollmentId: item.enrollment_id,
        schrittId: item.step_id,
      })
    else peek(item.lead_id)
  }
  const aufgabeErledigt = async (t: Task) => {
    if (!t.lead_id) return
    try {
      await erledigen.mutateAsync({ taskId: t.id, leadId: t.lead_id })
      toast(`Erledigt · ${t.title ?? 'Aufgabe'}.`)
    } catch {
      /* Toast aus der Daten-Schicht */
    }
  }

  // Fehler statt „Keine E-Mail fällig.“ (ux § 4.3, Review)
  if (queueFehler && !queue)
    return <LadeFehler text="Fällige E-Mails konnten nicht geladen werden" onNochmal={() => void refetch()} />
  if (queueLaedt && !queue) return <Skeleton zeilen={4} />
  if (schritte.length === 0 && aufgaben.length === 0)
    return <EmptyState titel={LEER.emailFaellig.titel} satz={LEER.emailFaellig.satz} />

  // `minmax(0,1fr)`: lange Schritt-Titel der Karten dürfen die Spalte nicht aufweiten (390 px: Seite wurde 1009 px breit)
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      {schritte.length ? (
        <section aria-label="Fällige E-Mail-Schritte" className="grid grid-cols-[minmax(0,1fr)] gap-2.5">
          {schritte.map((item) => {
            const id = item.item_id ?? ''
            return (
              <div key={id} data-cursor-id={id} onClick={() => setCursor(id)}>
                <QueueKarte item={item} aktiv={id === cursor} kontext="heute" onAktion={(a) => aktion(item, a)} />
              </div>
            )
          })}
        </section>
      ) : null}
      {aufgaben.length ? (
        <section aria-label="Manuelle E-Mail-Aufgaben" className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
          <span className="label">Manuelle E-Mail-Aufgaben</span>
          <ul role="listbox" aria-label="Aufgaben" className="border-line border-t">
            {aufgaben.map((t) => {
              const istCursor = t.id === cursor
              return (
                <li
                  key={t.id}
                  role="option"
                  aria-selected={istCursor}
                  data-cursor={istCursor || undefined}
                  data-cursor-id={t.id}
                  onClick={() => setCursor(t.id)}
                  className={cn(
                    'border-line text-table flex h-11 cursor-default items-center gap-3 border-b px-3',
                    istCursor && 'cursor-bar',
                  )}
                >
                  <span className="truncate-1 min-w-0 font-medium">
                    {t.lead_id ? <LeadName leadId={t.lead_id} /> : '–'}
                  </span>
                  <span className="truncate-1 text-small text-ink-3 min-w-0">{t.title}</span>
                  <span className="ml-auto flex items-center gap-2">
                    {t.due_at ? <ZeitChip datum={t.due_at} /> : <Chip ton="later">ohne Datum</Chip>}
                    <Button
                      groesse="S"
                      kbd="↵"
                      disabled={!t.lead_id}
                      onClick={() => t.lead_id && verfassen({ leadId: t.lead_id, vorlageId: t.template_id })}
                    >
                      Verfassen
                    </Button>
                    <Button
                      groesse="S"
                      variante="quiet"
                      onClick={() => void aufgabeErledigt(t)}
                      disabled={erledigen.isPending}
                    >
                      Erledigt
                    </Button>
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
