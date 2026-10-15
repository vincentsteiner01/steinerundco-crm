// /feedback – alle Meldungen beider Mitglieder (neueste zuerst), Filter nach Status, Detail mit Screenshot (Signed URL 2 min),
// Beschreibung, Kontext, Konsole, Antwort von Claude; Status und Notiz änderbar. Live über den Realtime-Kanal im Feedback-Knopf.
// ≥ 1280 px: Liste + Detail nebeneinander; darunter Detail als Blatt (rechts, Telefon von unten). URL: ?status= · ?id=
import { ExternalLink } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { cn } from '@/components/ui/cn'
import { EmptyState } from '@/components/ui/EmptyState'
import { LadeFehler } from '@/components/ui/LadeFehler'
import { KopfStats, SeitenKopf } from '@/components/ui/SeitenKopf'
import { Segment } from '@/components/ui/Segment'
import { Sheet } from '@/components/ui/Sheet'
import { Skeleton } from '@/components/ui/Skeleton'
import { Textarea } from '@/components/ui/Textarea'
import {
  FEEDBACK_STATUS,
  markiereGesehen,
  useFeedbackAendern,
  useFeedbackBild,
  useFeedbackListe,
  type Feedback,
  type FeedbackStatus,
} from '@/data/feedback'
import { useMembers } from '@/data/members'
import { useAuth } from '@/features/auth/authStore'
import { fmtDatumKurz, fmtDatumZeit, fmtZeit } from '@/lib/format'
import { MOD_LABEL, useHotkeys } from '@/lib/keyboard'
import { useMediaQuery } from '@/lib/useMediaQuery'
import type { Member } from '@/types/domain'
import { kurzBrowser } from './kontext'
import { ART_LABEL, FEEDBACK_EVENT, kurzTitel, STATUS_LABEL, STATUS_TON } from './texte'

type Filter = 'alle' | 'offen' | FeedbackStatus
const FILTER: Filter[] = ['alle', 'offen', ...FEEDBACK_STATUS]
const FILTER_LABEL: Record<Filter, string> = {
  alle: 'Alle',
  offen: 'Offen',
  neu: 'Neu',
  in_arbeit: 'In Arbeit',
  erledigt: 'Erledigt',
  abgelehnt: 'Abgelehnt',
}
const istFilter = (v: string | null): v is Filter => !!v && (FILTER as string[]).includes(v)
const passt = (f: Feedback, filter: Filter) =>
  filter === 'alle' ? true : filter === 'offen' ? f.status === 'neu' || f.status === 'in_arbeit' : f.status === filter

const feedbackGeben = () => window.dispatchEvent(new CustomEvent(FEEDBACK_EVENT))

export function Component() {
  const [params, setParams] = useSearchParams()
  const filter: Filter = istFilter(params.get('status')) ? (params.get('status') as Filter) : 'alle'
  const gewaehlt = params.get('id')
  const breit = useMediaQuery('(min-width: 1280px)')
  const { data, isPending, error, refetch } = useFeedbackListe()
  const { data: members } = useMembers()
  const liste = useMemo(() => data ?? [], [data])
  const sichtbar = useMemo(() => liste.filter((f) => passt(f, filter)), [liste, filter])
  const aktuell = liste.find((f) => f.id === gewaehlt) ?? null

  const setze = (aenderung: Record<string, string | null>, ersetzen = false) => {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(aenderung)) {
      if (v === null) p.delete(k)
      else p.set(k, v)
    }
    setParams(p, { replace: ersetzen })
  }
  const waehle = (id: string | null) => setze({ id }, true)

  // Breit: ohne Auswahl die neueste sichtbare Meldung zeigen
  useEffect(() => {
    if (breit && !gewaehlt && sichtbar[0]) waehle(sichtbar[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breit, gewaehlt, sichtbar])

  const index = sichtbar.findIndex((f) => f.id === gewaehlt)
  useHotkeys(
    'liste',
    {
      j: () => {
        const n = sichtbar[Math.min(sichtbar.length - 1, index + 1)]
        if (n) waehle(n.id)
      },
      k: () => {
        const n = sichtbar[Math.max(0, index - 1)]
        if (n) waehle(n.id)
      },
    },
    [sichtbar, index],
  )

  const zaehler = useMemo(() => {
    const z: Record<Filter, number> = { alle: liste.length, offen: 0, neu: 0, in_arbeit: 0, erledigt: 0, abgelehnt: 0 }
    for (const f of liste) {
      z[f.status] += 1
      if (f.status === 'neu' || f.status === 'in_arbeit') z.offen += 1
    }
    return z
  }, [liste])

  const memberVon = (id: string | null) => members?.find((m) => m.id === id) ?? null

  return (
    <>
      <SeitenKopf
        titel="Feedback"
        kontext="Meldungen an Claude"
        rechts={
          <>
            {liste.length ? (
              <KopfStats
                eintraege={[
                  { wert: zaehler.neu, label: 'neu', ton: zaehler.neu ? 'signal' : undefined },
                  { wert: zaehler.in_arbeit, label: 'in Arbeit' },
                  { wert: zaehler.erledigt, label: 'erledigt' },
                ]}
              />
            ) : null}
            <Button variante="primary" kbd="⌥F" onClick={feedbackGeben}>
              Feedback geben
            </Button>
          </>
        }
      />

      {error ? <LadeFehler text="Feedback konnte nicht geladen werden" onNochmal={() => void refetch()} /> : null}

      {isPending ? (
        <Skeleton zeilen={5} />
      ) : !error && liste.length === 0 ? (
        <EmptyState
          titel="Noch keine Meldungen."
          satz="Wenn etwas klemmt, fehlt oder unklar ist: ⌥F drücken oder in der Seitenleiste auf „Feedback geben“ – Claude bekommt deinen Text, einen Screenshot und die Seite, auf der du gerade bist."
          primaer={{ label: 'Feedback geben', onClick: feedbackGeben, kbd: '⌥F' }}
        />
      ) : liste.length ? (
        <>
          <Segment<Filter>
            ariaLabel="Nach Status filtern"
            wert={filter}
            onChange={(f) => setze({ status: f === 'alle' ? null : f, id: null }, true)}
            optionen={FILTER.map((f) => ({ key: f, label: FILTER_LABEL[f], zaehler: zaehler[f] }))}
            className="mb-4"
          />
          <div className={cn('grid gap-8', breit && 'grid-cols-[minmax(0,1fr)_minmax(0,500px)] items-start')}>
            <section aria-label="Meldungen" className="min-w-0">
              {sichtbar.length === 0 ? (
                <p className="text-ui text-ink-3 border-line border-t py-4">
                  Keine Meldungen mit Status „{FILTER_LABEL[filter]}“.
                </p>
              ) : (
                <ul className="border-line border-t">
                  {sichtbar.map((f) => (
                    <Zeile
                      key={f.id}
                      f={f}
                      member={memberVon(f.member_id)}
                      aktiv={f.id === gewaehlt}
                      onWaehlen={() => waehle(f.id)}
                    />
                  ))}
                </ul>
              )}
            </section>
            {breit ? (
              <aside
                aria-label="Meldung"
                className="border-line sticky top-[calc(var(--head-h,92px)+8px)] max-h-[calc(100dvh-var(--head-h,92px)-24px)] min-w-0 overflow-y-auto border-l pl-8"
              >
                {aktuell ? (
                  <Detail key={aktuell.id} f={aktuell} member={memberVon(aktuell.member_id)} memberVon={memberVon} />
                ) : (
                  <p className="text-ui text-ink-3 py-4">Wähle links eine Meldung.</p>
                )}
              </aside>
            ) : null}
          </div>
          {!breit ? (
            <Sheet
              offen={!!aktuell}
              onOpenChange={(o) => (!o ? waehle(null) : undefined)}
              titel={aktuell ? `${ART_LABEL[aktuell.art]} · ${STATUS_LABEL[aktuell.status]}` : 'Meldung'}
              breite={640}
            >
              {aktuell ? (
                <Detail key={aktuell.id} f={aktuell} member={memberVon(aktuell.member_id)} memberVon={memberVon} />
              ) : null}
            </Sheet>
          ) : null}
        </>
      ) : null}
    </>
  )
}

function Zeile({
  f,
  member,
  aktiv,
  onWaehlen,
}: {
  f: Feedback
  member: Member | null
  aktiv: boolean
  onWaehlen: () => void
}) {
  return (
    <li className="border-line border-b">
      <button
        type="button"
        onClick={onWaehlen}
        aria-current={aktiv || undefined}
        className={cn(
          'ease-brand hover:bg-surface-hover grid w-full min-w-0 gap-1 px-3 py-2.5 text-left transition-[background] duration-[var(--t-1)]',
          aktiv && 'cursor-bar',
        )}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <Chip ton={STATUS_TON[f.status]} className="flex-none">
            {STATUS_LABEL[f.status]}
          </Chip>
          <span className="text-table text-ink min-w-0 flex-1 truncate font-medium" title={kurzTitel(f)}>
            {kurzTitel(f)}
          </span>
          {f.antwort ? <span className="text-small text-ink-2 flex-none">Antwort</span> : null}
        </span>
        <span className="text-ink-3 flex min-w-0 items-center gap-2.5 text-[12.5px]">
          <Avatar member={member} groesse={22} className="flex-none" />
          <span className="flex-none">{ART_LABEL[f.art]}</span>
          <span className="tnum min-w-0 flex-1 truncate font-mono text-[11.5px]" title={f.route ?? undefined}>
            {f.route?.split('?')[0] ?? '–'}
          </span>
          <span className="tnum flex-none font-mono text-[11.5px] whitespace-nowrap">
            {fmtDatumKurz(f.created_at)} {fmtZeit(f.created_at)}
          </span>
        </span>
      </button>
    </li>
  )
}

function Detail({
  f,
  member,
  memberVon,
}: {
  f: Feedback
  member: Member | null
  memberVon: (id: string | null) => Member | null
}) {
  const me = useAuth((s) => s.member?.user_id ?? null)
  const bild = useFeedbackBild(f.screenshot_path)
  const aendern = useFeedbackAendern()
  const [notiz, setNotiz] = useState(f.notiz ?? '')
  const notizGeaendert = notiz.trim() !== (f.notiz ?? '').trim()

  // Eigene Antwort angesehen → kein Toast mehr dafür
  useEffect(() => {
    if (f.member_id === me && f.antwort_at) markiereGesehen(f.id, f.antwort_at)
  }, [f.id, f.member_id, f.antwort_at, me])

  const notizSpeichern = () => {
    if (!notizGeaendert || aendern.isPending) return
    aendern.mutate({ id: f.id, notiz })
  }
  const konsole = Array.isArray(f.konsole) ? (f.konsole as { zeit?: string; art?: string; text?: string }[]) : []
  const routePfad = f.route?.split('?')[0] ?? null

  return (
    <article className="grid min-w-0 gap-5 pb-6" aria-label={kurzTitel(f)}>
      <header className="grid gap-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Chip ton={STATUS_TON[f.status]}>{STATUS_LABEL[f.status]}</Chip>
          <Chip ton="muted">{ART_LABEL[f.art]}</Chip>
          <span className="text-ink-3 flex min-w-0 items-center gap-2 text-[12.5px]">
            <Avatar member={member} groesse={22} className="flex-none" />
            <span className="truncate">{member?.display_name ?? '–'}</span>
            <span className="tnum font-mono text-[11.5px] whitespace-nowrap">{fmtDatumZeit(f.created_at)}</span>
          </span>
        </div>
        <h2 className="text-h2 text-ink-bright break-words">{kurzTitel(f)}</h2>
      </header>

      <p className="text-body text-ink-2 max-w-[64ch] break-words whitespace-pre-wrap">{f.beschreibung}</p>

      {f.screenshot_path ? (
        <figure className="grid gap-1.5">
          {bild.url ? (
            <a
              href={bild.url}
              target="_blank"
              rel="noopener"
              className="border-line-strong block overflow-hidden rounded-sm border"
              title="In neuem Tab öffnen"
            >
              <img
                src={bild.url}
                alt={`Screenshot von ${routePfad ?? 'der Seite'}`}
                className="bg-canvas block w-full"
              />
            </a>
          ) : bild.fehler ? (
            <p className="text-small text-ink-3 border-line-strong rounded-sm border border-dashed px-3.5 py-3">
              Screenshot nicht verfügbar – Seite neu laden.
            </p>
          ) : (
            <div className="bg-surface-hover aspect-[16/10] w-full rounded-sm" aria-busy aria-label="Screenshot lädt" />
          )}
          <figcaption className="text-ink-3 tnum font-mono text-[11.5px]">{f.viewport ?? '–'}</figcaption>
        </figure>
      ) : (
        <p className="text-small text-ink-3">Ohne Screenshot.</p>
      )}

      <dl className="text-small grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 gap-y-1.5">
        <dt className="text-ink-3">Seite</dt>
        <dd className="min-w-0">
          {f.route ? (
            <Link
              to={f.route}
              className="text-ink tnum hover:text-ink-bright decoration-line-strong inline-flex max-w-full items-center gap-1 font-mono text-[12px] underline underline-offset-2"
            >
              <span className="truncate">{f.route}</span>
              <ExternalLink size={12} strokeWidth={1.75} aria-hidden className="flex-none" />
            </Link>
          ) : (
            '–'
          )}
        </dd>
        <dt className="text-ink-3">Fenster</dt>
        <dd className="text-ink-2 tnum font-mono text-[12px]">{f.viewport ?? '–'}</dd>
        <dt className="text-ink-3">Browser</dt>
        <dd className="text-ink-2 truncate" title={f.user_agent ?? undefined}>
          {kurzBrowser(f.user_agent)}
        </dd>
        <dt className="text-ink-3">Version</dt>
        <dd className="text-ink-2 tnum truncate font-mono text-[12px]">{f.app_version ?? '–'}</dd>
      </dl>

      <details className="group">
        <summary className="label cursor-pointer list-none select-none">
          Konsole <span className="tnum font-mono">{konsole.length}</span>
          <span className="text-ink-3 ml-1.5 normal-case group-open:hidden">· zeigen</span>
        </summary>
        {konsole.length ? (
          <ol className="border-line mt-2 grid max-h-64 gap-1.5 overflow-y-auto border-l pl-3">
            {konsole.map((e, i) => (
              <li key={i} className="text-ink-2 grid gap-0.5 font-mono text-[11.5px] leading-[1.4] break-words">
                <span className="text-ink-3 tnum">
                  {e.zeit ? fmtZeit(e.zeit) : '–'} · {e.art ?? '–'}
                </span>
                <span className="whitespace-pre-wrap">{e.text ?? ''}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-small text-ink-3 mt-2">Keine Fehler oder Warnungen beim Melden.</p>
        )}
      </details>

      <section aria-label="Antwort von Claude" className="grid gap-2">
        <span className="label">Antwort von Claude</span>
        {f.antwort ? (
          <div className="bg-surface-hover grid gap-1.5 rounded-sm px-4 py-3.5">
            <p className="text-body text-ink max-w-[64ch] break-words whitespace-pre-wrap">{f.antwort}</p>
            {f.antwort_at ? (
              <span className="text-ink-3 tnum font-mono text-[11.5px]">{fmtDatumZeit(f.antwort_at)}</span>
            ) : null}
          </div>
        ) : (
          <p className="text-small text-ink-3">
            Noch keine Antwort – Claude sieht die Meldung beim nächsten Durchgang.
          </p>
        )}
      </section>

      <section aria-label="Status" className="grid gap-2">
        <span className="label">Status</span>
        <Segment<FeedbackStatus>
          ariaLabel="Status ändern"
          wert={f.status}
          onChange={(s) => s !== f.status && aendern.mutate({ id: f.id, status: s })}
          optionen={FEEDBACK_STATUS.map((s) => ({ key: s, label: STATUS_LABEL[s] }))}
          klein
          className="justify-self-start"
        />
      </section>

      <section className="grid gap-2">
        <label htmlFor={`notiz-${f.id}`} className="label">
          Notiz
        </label>
        <Textarea
          id={`notiz-${f.id}`}
          value={notiz}
          onChange={(e) => setNotiz(e.target.value)}
          onSubmit={notizSpeichern}
          placeholder="Nachtrag oder Rückfrage zu dieser Meldung"
          rows={2}
        />
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <span className="text-small text-ink-3 min-w-0 truncate">
            {f.notiz && f.notiz_at
              ? `Zuletzt: ${memberVon(f.notiz_von)?.display_name ?? 'Claude'} · ${fmtDatumZeit(f.notiz_at)}`
              : null}
          </span>
          <Button
            groesse="S"
            kbd={`${MOD_LABEL}↵`}
            onClick={notizSpeichern}
            disabled={!notizGeaendert}
            busy={aendern.isPending && notizGeaendert}
          >
            Notiz speichern
          </Button>
        </div>
      </section>
    </article>
  )
}
