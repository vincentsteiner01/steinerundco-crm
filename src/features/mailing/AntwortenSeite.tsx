// /email/antworten (01.11.2026) – die „Unibox“: alle Antworten aus allen Postfächern an einem Ort. Abwesenheitsnotizen und
// Unzustellbar-Meldungen sortiert der Mail-Motor vorher aus (sie pausieren bzw. stoppen den Empfänger). Abmeldungen stehen schon auf
// der Sperrliste. Antworten geht direkt von hier – über dasselbe Postfach, im selben Verlauf, im nächsten Takt.
import { CheckCheck, CornerDownLeft, ExternalLink, Undo2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { PFADE } from '@/app/pfade'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { cn } from '@/components/ui/cn'
import { LadeFehler } from '@/components/ui/LadeFehler'
import { KopfStats, SeitenKopf } from '@/components/ui/SeitenKopf'
import { Segment } from '@/components/ui/Segment'
import { Skeleton } from '@/components/ui/Skeleton'
import { Textarea } from '@/components/ui/Textarea'
import { type Eingang, useAntworten, useAntwortSenden, useEingangMarkieren, useMailVerlauf } from '@/data/mailing'
import { fmtDatumZeit } from '@/lib/format'
import type { Database } from '@/types/database'
import { HINWEIS } from './logik'
import { Leer, MailNav } from './Teile'

type Filter = 'offen' | 'interesse' | 'abmeldung' | 'alle'
type Label = Database['crm']['Enums']['reply_label']

const LABELS: { key: Label; label: string }[] = [
  { key: 'interessiert', label: 'Interesse' },
  { key: 'frage', label: 'Frage' },
  { key: 'spaeter', label: 'Später' },
  { key: 'kein_bedarf', label: 'Kein Bedarf' },
  { key: 'nicht_icp', label: 'Passt nicht' },
  { key: 'widerspruch', label: 'Widerspruch' },
]

const nameVon = (e: Eingang) =>
  `${e.leads?.first_name ?? ''} ${e.leads?.last_name ?? ''}`.trim() || e.from_address || 'Unbekannt'

export function Component() {
  const antworten = useAntworten()
  const markieren = useEingangMarkieren()
  const [params, setParams] = useSearchParams()
  const [filter, setFilter] = useState<Filter>('offen')
  const liste = useMemo(() => {
    const alle = antworten.data ?? []
    return alle.filter((a) =>
      filter === 'alle'
        ? true
        : filter === 'offen'
          ? !a.erledigt_at
          : filter === 'interesse'
            ? (a.label ?? a.hinweis) === 'interessiert'
            : a.label === 'widerspruch' || a.hinweis === 'abmeldung',
    )
  }, [antworten.data, filter])
  const gewaehltId = params.get('id') ?? liste[0]?.id ?? null
  const gewaehlt = (antworten.data ?? []).find((a) => a.id === gewaehltId) ?? null
  const offen = (antworten.data ?? []).filter((a) => !a.erledigt_at).length

  // Gelesen markieren, sobald eine Antwort offen ist
  useEffect(() => {
    if (gewaehlt && !gewaehlt.gelesen_at)
      markieren.mutate({ id: gewaehlt.id, werte: { gelesen_at: new Date().toISOString() } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gewaehlt?.id])

  const waehlen = (id: string) => {
    const p = new URLSearchParams(params)
    p.set('id', id)
    setParams(p, { replace: true })
  }

  return (
    <>
      <SeitenKopf
        titel="Antworten"
        kontext="E-Mail"
        rechts={
          <KopfStats
            eintraege={[
              { wert: offen, label: 'offen', ton: offen ? 'signal' : undefined },
              {
                wert: (antworten.data ?? []).filter((a) => (a.label ?? a.hinweis) === 'interessiert').length,
                label: 'mit Interesse',
              },
            ]}
          />
        }
      />
      <MailNav antworten={offen} />
      <Segment
        ariaLabel="Antworten filtern"
        className="mb-4"
        wert={filter}
        onChange={setFilter}
        optionen={[
          { key: 'offen', label: 'Offen', zaehler: offen },
          { key: 'interesse', label: 'Interesse' },
          { key: 'abmeldung', label: 'Abmeldungen' },
          { key: 'alle', label: 'Alle' },
        ]}
      />
      {antworten.isPending ? (
        <Skeleton className="h-60" />
      ) : antworten.isError ? (
        <LadeFehler text="Antworten konnten nicht geladen werden" onNochmal={() => void antworten.refetch()} />
      ) : !liste.length ? (
        <Leer
          titel={filter === 'offen' ? 'Alles beantwortet' : 'Keine Antworten'}
          satz="Antworten auf Kampagnen erscheinen hier automatisch – der Mail-Motor schaut alle paar Minuten in die Postfächer."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(280px,380px)_1fr]">
          <ul
            className="border-line-strong max-h-[70dvh] overflow-y-auto rounded-md border max-lg:max-h-none"
            aria-label="Antworten"
          >
            {liste.map((a) => {
              const h = a.label ? null : a.hinweis ? HINWEIS[a.hinweis] : null
              return (
                <li key={a.id} className="border-line border-b last:border-b-0">
                  <button
                    type="button"
                    onClick={() => waehlen(a.id)}
                    aria-current={a.id === gewaehlt?.id}
                    className={cn(
                      'hover:bg-surface-hover grid w-full gap-0.5 px-3.5 py-2.5 text-left',
                      a.id === gewaehlt?.id && 'bg-signal-tint',
                    )}
                  >
                    <span className="flex items-center gap-2">
                      {!a.gelesen_at ? (
                        <span className="bg-signal size-2 shrink-0 rounded-full" aria-label="ungelesen" />
                      ) : null}
                      <span
                        className={cn(
                          'text-ui min-w-0 flex-1 truncate',
                          !a.gelesen_at ? 'text-ink-bright font-semibold' : 'text-ink',
                        )}
                      >
                        {nameVon(a)}
                      </span>
                      <span className="text-ink-3 shrink-0 text-[12px]">
                        {a.sent_at ? fmtDatumZeit(a.sent_at) : ''}
                      </span>
                    </span>
                    <span className="text-small text-ink-2 truncate">{a.subject}</span>
                    <span className="text-small text-ink-3 line-clamp-2">{a.body_text}</span>
                    <span className="flex flex-wrap gap-1">
                      {a.label ? (
                        <Chip ton="blau">{LABELS.find((l) => l.key === a.label)?.label ?? a.label}</Chip>
                      ) : null}
                      {h ? <Chip ton={h.ton}>{h.label}</Chip> : null}
                      {a.erledigt_at ? <Chip ton="muted">erledigt</Chip> : null}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          {gewaehlt ? <Detail key={gewaehlt.id} e={gewaehlt} /> : null}
        </div>
      )}
    </>
  )
}

function Detail({ e }: { e: Eingang }) {
  const { data: verlauf } = useMailVerlauf(e.lead_id)
  const senden = useAntwortSenden()
  const markieren = useEingangMarkieren()
  const [text, setText] = useState('')
  const abmeldung = e.hinweis === 'abmeldung' || e.label === 'widerspruch'
  return (
    <article className="border-line-strong min-w-0 rounded-md border" aria-label={`Antwort von ${nameVon(e)}`}>
      <header className="border-line flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-h3 text-ink-bright truncate">{nameVon(e)}</h2>
          <p className="text-small text-ink-3 truncate">
            {e.leads?.company_name ? `${e.leads.company_name} · ` : ''}
            {e.from_address} → {e.to_address}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          <Link
            to={PFADE.lead(e.lead_id)}
            className="text-small text-signal inline-flex items-center gap-1 hover:underline"
          >
            Lead öffnen <ExternalLink size={12} aria-hidden />
          </Link>
        </div>
      </header>
      <div className="grid gap-3 px-4 py-3">
        <div className="flex flex-wrap gap-1.5" aria-label="Einordnen">
          {LABELS.map((l) => (
            <Chip
              key={l.key}
              ton={e.label === l.key ? 'blau' : 'grau'}
              onClick={() => markieren.mutate({ id: e.id, werte: { label: e.label === l.key ? null : l.key } })}
            >
              {l.label}
            </Chip>
          ))}
        </div>
        {abmeldung ? (
          <p className="bg-danger-tint text-small text-danger rounded-sm px-3 py-2">
            Abmeldung erkannt – die Adresse steht schon auf der Sperrliste, Kampagnen schreiben sie nicht mehr an. Soll
            der Lead gar nicht mehr kontaktiert werden (auch nicht per Telefon oder LinkedIn), im Lead „Widerspruch
            erfassen“.
          </p>
        ) : null}
        <ol className="grid gap-2.5" aria-label="Verlauf">
          {(verlauf ?? []).map((m) => (
            <li
              key={m.id}
              className={cn(
                'max-w-[92%] rounded-md px-3.5 py-2.5',
                m.direction === 'in' ? 'bg-surface-hover justify-self-start' : 'bg-signal-tint justify-self-end',
                m.id === e.id && 'ring-signal ring-1',
              )}
            >
              <p className="text-ink-3 text-[12px]">
                {m.direction === 'in' ? 'Antwort' : m.status === 'draft' ? 'Wird gesendet …' : 'Gesendet'} ·{' '}
                {fmtDatumZeit(m.sent_at ?? m.created_at)}
              </p>
              <p className="text-small text-ink-bright mt-0.5">{m.subject}</p>
              <p className="text-body text-ink mt-1 break-words whitespace-pre-wrap">{m.body_text}</p>
            </li>
          ))}
        </ol>
        {!abmeldung ? (
          <div className="grid gap-2">
            <Textarea
              rows={5}
              value={text}
              onChange={(x) => setText(x.target.value)}
              placeholder="Antwort schreiben … (Signatur wird angehängt)"
              aria-label="Antwort"
            />
            <div className="flex flex-wrap justify-between gap-2">
              <Button
                variante="quiet"
                icon={e.erledigt_at ? Undo2 : CheckCheck}
                onClick={() =>
                  markieren.mutate({
                    id: e.id,
                    werte: { erledigt_at: e.erledigt_at ? null : new Date().toISOString() },
                  })
                }
              >
                {e.erledigt_at ? 'Wieder offen' : 'Erledigt'}
              </Button>
              <Button
                variante="primary"
                icon={CornerDownLeft}
                disabled={text.trim().length < 2}
                busy={senden.isPending}
                onClick={() =>
                  senden.mutate(
                    { eingang: e.id, text },
                    { onSuccess: () => (setText(''), toast('Antwort geht in der nächsten Minute raus')) },
                  )
                }
              >
                Antworten
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  )
}
