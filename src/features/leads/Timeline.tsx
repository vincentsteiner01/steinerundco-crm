// BAUPLAN § 3.3 `Timeline.tsx` (DESIGN-SYSTEM § 5.11, ux § 3.3.4): Raster 88 14 1fr, Tag-Gruppen „Heute · Gestern · Mo 12.10.“,
// „NÄCHSTES“ über der Linie (Enrollments/Aufgaben/Termine), Filter-Chips (Alle · Nachrichten · Anrufe · E-Mails · Statuswechsel ·
// Notizen · System), „anzeigen“ klappt Text auf, Notiz bearbeiten (Autor, Versionen in metadata.versions), useActivities (Keyset 50).
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { cn } from '@/components/ui/cn'
import { Textarea } from '@/components/ui/Textarea'
import { notizVersionen, useActivities, useNotizBearbeiten } from '@/data/activities'
import { useLead } from '@/data/leads'
import { useMeId, useMembers } from '@/data/members'
import { useSequencesIndex } from '@/data/sequences'
import { useSettings } from '@/data/settings'
import { useTemplates } from '@/data/templates'
import { fmtDatum, fmtDatumKurz, fmtDatumZeit, fmtZeit, heuteBerlin } from '@/lib/format'
import { berlinTag, tagPlus } from '@/lib/zeit'
import { LEER } from '@/texte/de'
import type { Activity } from '@/types/domain'
import { naechsteEintraege } from './detailLogik'
import { hatAufklappText, TIMELINE_FILTER, timelineAkteur, timelineText, type TimelineFilterKey } from './timelineText'

export type TimelineProps = {
  leadId: string
  /** Peek: dichter, Filter nur Alle · Nachrichten · Notizen */
  kompakt?: boolean
  /** Vorbelegter Filter (Tab Notizen: `notizen`) */
  startFilter?: TimelineFilterKey
  /** Filter-Chips verstecken (Tab Notizen) */
  ohneFilter?: boolean
  /** „NÄCHSTES“ über der Linie */
  mitNaechstes?: boolean
  className?: string
}

function tagLabel(tag: string, heute: string): string {
  if (tag === heute) return 'Heute'
  if (tag === tagPlus(heute, -1)) return 'Gestern'
  return tag.slice(0, 4) === heute.slice(0, 4) ? fmtDatumKurz(tag) : fmtDatum(tag)
}

export function Timeline({
  leadId,
  kompakt,
  startFilter = 'alle',
  ohneFilter,
  mitNaechstes = true,
  className,
}: TimelineProps) {
  const [filter, setFilter] = useState<TimelineFilterKey>(startFilter)
  const def = TIMELINE_FILTER.find((f) => f.key === filter)
  const q = useActivities(leadId, def && def.types.length ? { types: [...def.types] } : undefined)
  const { data: lead } = useLead(mitNaechstes ? leadId : null)
  const { data: templates } = useTemplates()
  const { data: settings } = useSettings()
  const { data: members } = useMembers()
  const { data: seq } = useSequencesIndex()
  const me = useMeId()
  const bearbeiten = useNotizBearbeiten()
  const heute = heuteBerlin()
  const [offen, setOffen] = useState<Set<number>>(() => new Set())
  const [edit, setEdit] = useState<{ id: number; text: string } | null>(null)

  const aktivitaeten = useMemo(() => q.data?.pages.flat() ?? [], [q.data])
  const gruppen = useMemo(() => {
    const out: { tag: string; label: string; eintraege: Activity[] }[] = []
    for (const a of aktivitaeten) {
      const tag = berlinTag(a.occurred_at)
      const letzte = out[out.length - 1]
      if (letzte && letzte.tag === tag) letzte.eintraege.push(a)
      else out.push({ tag, label: tagLabel(tag, heute), eintraege: [a] })
    }
    return out
  }, [aktivitaeten, heute])

  const naechstes = useMemo(
    () => (mitNaechstes ? naechsteEintraege(lead, (id) => (id ? (seq?.stepsById.get(id)?.name ?? null) : null)) : []),
    [lead, seq, mitNaechstes],
  )

  const filterChips = kompakt
    ? TIMELINE_FILTER.filter((f) => f.key === 'alle' || f.key === 'nachrichten' || f.key === 'notizen')
    : TIMELINE_FILTER

  const toggle = (id: number) =>
    setOffen((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const speichern = async (a: Activity) => {
    if (!edit || edit.id !== a.id || !edit.text.trim() || bearbeiten.isPending) return
    try {
      await bearbeiten.mutateAsync({ activity: a, note: edit.text.trim(), me })
    } catch {
      return
    }
    setEdit(null)
  }

  const ctx = { templates, settings, members }

  return (
    <div className={cn('min-w-0', className)} data-timeline>
      {!ohneFilter ? (
        <div className="mb-3.5 flex items-baseline justify-between gap-3">
          <h2 className="text-h3 text-ink font-[550]">Verlauf</h2>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Verlauf filtern">
            {filterChips.map((f) => (
              <Chip
                key={f.key}
                interaktiv
                ton={filter === f.key ? 'neutral' : 'muted'}
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}

      {naechstes.length > 0 ? (
        <>
          <span className="label mb-2 block">Nächstes</span>
          <ol className="mb-2" aria-label="Nächstes">
            {naechstes.map((n, i) => {
              // Runde 2: überfällige „Nächstes“-Daten in Amber (Datum, Punkt, „überfällig“ statt „geplant“)
              const ueberfaellig = !!n.wann && berlinTag(n.wann) < heute
              return (
                <li
                  key={n.key}
                  className="relative grid grid-cols-[88px_14px_1fr] gap-x-2.5 pb-4"
                  data-ueberfaellig={ueberfaellig || undefined}
                >
                  <span className={cn('mono-sm pt-0.5', ueberfaellig ? 'text-overdue' : 'text-ink-3')}>
                    {fmtDatumKurz(n.wann)}
                  </span>
                  <span className="relative grid justify-items-center">
                    <span
                      className={cn(
                        'z-[1] mt-1.5 h-1.5 w-1.5 rounded-full',
                        ueberfaellig ? 'bg-overdue' : i === 0 ? 'bg-signal' : 'border-ink-3 border bg-transparent',
                      )}
                    />
                    {i < naechstes.length - 1 ? <span className="bg-line absolute top-3 -bottom-4 w-px" /> : null}
                  </span>
                  <span className={cn('min-w-0 text-[12.5px] leading-[1.45]', i === 0 ? 'text-ink' : 'text-ink-3')}>
                    {n.text}
                    <span className={cn('mono-sm ml-1.5', ueberfaellig ? 'text-overdue' : 'text-ink-3')}>
                      {ueberfaellig ? 'überfällig' : i === 0 ? 'geplant' : ''}
                    </span>
                  </span>
                </li>
              )
            })}
          </ol>
        </>
      ) : null}

      {q.isPending ? (
        <p className="text-small text-ink-3 py-2">Lade …</p>
      ) : aktivitaeten.length === 0 ? (
        <p className="text-small text-ink-3 py-2">{LEER.timeline.satz}</p>
      ) : (
        <ol aria-label="Verlauf">
          {gruppen.map((g, gi) =>
            g.eintraege.map((a, i) => {
              const letzter = gi === gruppen.length - 1 && i === g.eintraege.length - 1
              const text = timelineText(a, ctx)
              const akteur = timelineAkteur(a, members)
              const istNotiz = a.type === 'notiz'
              const auf = hatAufklappText(a)
              const versionen = istNotiz ? notizVersionen(a) : []
              const darfBearbeiten =
                istNotiz &&
                !!me &&
                a.member_id === me &&
                !(a.metadata as { kind?: string })?.kind?.startsWith('auskunft')
              return (
                <li key={a.id} data-typ={a.type} className="relative grid grid-cols-[88px_14px_1fr] gap-x-2.5 pb-4">
                  <span className={cn('mono-sm pt-0.5', i === 0 ? 'text-ink-2 font-medium' : 'text-ink-3')}>
                    {i === 0 ? `${g.label} ` : ''}
                    {fmtZeit(a.occurred_at)}
                  </span>
                  <span className="relative grid justify-items-center">
                    <span className="bg-ink z-[1] mt-1.5 h-1.5 w-1.5 rounded-full" />
                    {!letzter ? <span className="bg-line absolute top-3 -bottom-4 w-px" /> : null}
                  </span>
                  <span className="text-ink min-w-0 text-[12.5px] leading-[1.45]">
                    {text}
                    {akteur ? <span className="mono-sm text-ink-3 ml-1.5 text-[10.5px]">{akteur}</span> : null}
                    {auf ? (
                      <button
                        type="button"
                        className="text-ink-3 hover:text-ink ml-1.5 text-[12px]"
                        aria-expanded={offen.has(a.id)}
                        onClick={() => toggle(a.id)}
                      >
                        {offen.has(a.id) ? 'ausblenden' : 'anzeigen'}
                      </button>
                    ) : null}
                    {darfBearbeiten && edit?.id !== a.id ? (
                      <button
                        type="button"
                        className="text-ink-3 hover:text-ink ml-1.5 text-[12px]"
                        title={
                          versionen.length
                            ? `${versionen.length} ${versionen.length === 1 ? 'Version' : 'Versionen'} – zuletzt ${fmtDatumZeit(versionen[versionen.length - 1]?.at ?? a.occurred_at)}`
                            : undefined
                        }
                        onClick={() => setEdit({ id: a.id, text: a.note ?? '' })}
                      >
                        bearbeiten
                      </button>
                    ) : null}
                    {versionen.length && edit?.id !== a.id ? (
                      <span
                        className="mono-sm text-ink-3 ml-1.5 cursor-help text-[10.5px]"
                        title={versionen.map((v) => `${fmtDatumZeit(v.at)}: ${v.note ?? ''}`).join('\n')}
                      >
                        {versionen.length}v
                      </span>
                    ) : null}
                    {istNotiz && edit?.id === a.id ? (
                      <span className="mt-1.5 block">
                        <Textarea
                          aria-label="Notiz bearbeiten"
                          value={edit.text}
                          autoFocus
                          onChange={(e) => setEdit({ id: a.id, text: e.target.value })}
                          onSubmit={() => void speichern(a)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setEdit(null)
                          }}
                        />
                        <span className="mt-1.5 flex justify-end gap-1.5">
                          <Button variante="quiet" groesse="S" kbd="Esc" onClick={() => setEdit(null)}>
                            Abbrechen
                          </Button>
                          <Button
                            variante="secondary"
                            groesse="S"
                            kbd="⌘↵"
                            busy={bearbeiten.isPending}
                            disabled={!edit.text.trim()}
                            onClick={() => void speichern(a)}
                          >
                            Speichern
                          </Button>
                        </span>
                      </span>
                    ) : istNotiz && a.note && !(a.metadata as { kind?: string })?.kind?.startsWith('auskunft') ? (
                      <span className="text-ink-2 border-line-strong mt-1 block border-l pl-2.5 whitespace-pre-wrap">
                        {a.note}
                      </span>
                    ) : null}
                    {auf && offen.has(a.id) ? (
                      <span className="bg-surface-hover text-ink-2 mt-1.5 block rounded-sm px-3 py-2 whitespace-pre-wrap">
                        {a.note}
                      </span>
                    ) : null}
                  </span>
                </li>
              )
            }),
          )}
        </ol>
      )}
      {q.hasNextPage ? (
        <Button variante="quiet" groesse="S" busy={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>
          Weitere laden
        </Button>
      ) : null}
    </div>
  )
}
