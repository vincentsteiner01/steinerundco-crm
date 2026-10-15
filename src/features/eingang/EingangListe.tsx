// Eingang-Liste (Einstellungen → Verbindungen → Eingang): LinkedIn-Benachrichtigungen aus beiden Postfächern (crm.eingang).
// Filter Person (Beide · Vincent · Mike) und Status (Offen · Alle · neu · verarbeitet · unbekannt · ignoriert · Fehler) stehen in
// der URL (?person=, ?status=). Offene Einträge: „Lead zuordnen“ (Lead-Suche → eingang_zuordnen verbucht sofort im Namen des
// Postfach-Inhabers) oder „Ignorieren“. Neue Einträge erscheinen live (Kanal crm:eingang).
import { ExternalLink, Search } from 'lucide-react'
import { useEffect, useId, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { PFADE } from '@/app/pfade'
import { Avatar, Button, Chip, EmptyState, Input, LadeFehler, Segment, Skeleton, StatusChip, cn } from '@/components/ui'
import { toast, toastFehler } from '@/components/toast'
import { useLeadSuche, useMeId, useMembers, useSettings } from '@/data'
import { fmtDatumKurz, fmtZeit } from '@/lib/format'
import { anzeigeName, personSlug } from '@/lib/mitglied'
import type { Member } from '@/types/domain'
import { useEingangIgnorieren, useEingangListe, useEingangLive, useEingangZuordnen, type LeadKurz } from './daten'
import {
  artLabel,
  filterLabel,
  filtere,
  istEinladungVomLead,
  istStatus,
  istStatusFilter,
  kannBearbeiten,
  STATUS_FILTER,
  STATUS_LABEL,
  STATUS_TON,
  zaehle,
  type EingangZeile,
  type StatusFilter,
} from './logik'

const WAS_ZUORDNEN_TUT: Record<string, string> = {
  annahme: 'Vernetzung angenommen, die LinkedIn-Sequenz startet',
  nachricht: 'Antwort erhalten mit diesem Text, laufende Sequenzen stoppen',
}

function Zuordnen({
  zeile,
  postfach,
  onFertig,
}: {
  zeile: EingangZeile
  postfach: Member | undefined
  onFertig: () => void
}) {
  const id = useId()
  const [q, setQ] = useState(zeile.absender_name?.trim() ?? '')
  const [suchwort, setSuchwort] = useState(q)
  const { data: treffer, isFetching } = useLeadSuche(suchwort, 8)
  const { data: members } = useMembers()
  const { data: settings } = useSettings()
  const zuordnen = useEingangZuordnen()

  const suchen = (e: FormEvent) => {
    e.preventDefault()
    setSuchwort(q.trim())
  }
  const waehlen = (leadId: string) =>
    zuordnen.mutate(
      { id: zeile.id, leadId },
      {
        onSuccess: (e) => {
          if (e.status === 'fehler') toastFehler(`Zugeordnet, aber nicht verbucht: ${e.ergebnis ?? 'Fehler'}`)
          else toast(punkt(e.ergebnis?.trim() || 'Zugeordnet'))
          onFertig()
        },
      },
    )
  const wer = anzeigeName(postfach, 'der Postfach-Inhaber')
  const was = WAS_ZUORDNEN_TUT[zeile.art] ?? 'nur die Zuordnung'

  return (
    <div className="grid gap-2.5 pt-1" role="group" aria-label="Lead zuordnen">
      <form onSubmit={suchen} className="flex gap-1.5">
        <label htmlFor={`${id}-q`} className="sr-only">
          Lead suchen
        </label>
        <div className="min-w-0 flex-1">
          <Input
            id={`${id}-q`}
            autoFocus
            value={q}
            placeholder="Name oder Unternehmen"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                onFertig()
              }
            }}
          />
        </div>
        <Button type="submit" icon={Search} busy={isFetching && suchwort.length >= 2}>
          Suchen
        </Button>
      </form>
      {suchwort.length < 2 ? (
        <p className="text-small text-ink-3">Mindestens zwei Buchstaben.</p>
      ) : treffer && treffer.length === 0 ? (
        <p className="text-small text-ink-3">Kein Lead mit „{suchwort}“.</p>
      ) : (
        <ul className="grid" aria-label="Treffer">
          {(treffer ?? []).map((l) => {
            const owner = members?.find((m) => m.id === l.owner_id) ?? null
            return (
              <li key={l.id} className="hairline flex min-h-11 items-center gap-2.5 py-1.5 last:border-b-0">
                <Avatar member={owner} groesse={22} title={owner ? `Zuständig: ${anzeigeName(owner)}` : 'Frei'} />
                <span className="min-w-0 flex-1">
                  <span className="text-table text-ink block truncate font-medium">{l.full_name ?? 'Ohne Namen'}</span>
                  {l.company_name ? (
                    <span className="text-small text-ink-3 block truncate">{l.company_name}</span>
                  ) : null}
                </span>
                <StatusChip stage={l.stage} settings={settings} className="max-sm:hidden" />
                <Button
                  variante="primary"
                  groesse="S"
                  busy={zuordnen.isPending && zuordnen.variables?.leadId === l.id}
                  disabled={zuordnen.isPending}
                  onClick={() => waehlen(l.id)}
                  aria-label={`${l.full_name ?? 'Lead'} zuordnen`}
                >
                  Zuordnen
                </Button>
              </li>
            )
          })}
        </ul>
      )}
      <p className="text-small text-ink-3">
        Zuordnen verbucht sofort im Namen von {wer}: {was}.
      </p>
    </div>
  )
}

const punkt = (s: string) => (/[.…?]$/.test(s) ? s : `${s}.`)

function Eintrag({
  zeile,
  lead,
  postfach,
}: {
  zeile: EingangZeile
  lead: LeadKurz | undefined
  postfach: Member | undefined
}) {
  const [suche, setSuche] = useState(false)
  const ignorieren = useEingangIgnorieren()
  const status = istStatus(zeile.status) ? zeile.status : 'neu'
  const einladung = istEinladungVomLead(zeile)
  const name = zeile.absender_name?.trim() || (lead?.full_name ?? null)
  const offenBar = kannBearbeiten(zeile)

  const ignorierenKlick = () =>
    ignorieren.mutate(
      { id: zeile.id },
      { onSuccess: () => toast(einladung ? 'Erledigt.' : 'Ignoriert – ohne Eintrag im CRM.') },
    )

  return (
    <li className="hairline grid gap-1.5 py-3.5" data-status={status}>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <Avatar
          member={postfach ?? null}
          groesse={22}
          title={`Postfach von ${anzeigeName(postfach, 'unbekannt')}`}
          aria-label={`Postfach von ${anzeigeName(postfach, 'unbekannt')}`}
        />
        <span className={cn('text-table min-w-0 truncate font-medium', name ? 'text-ink' : 'text-ink-3')}>
          {name ?? 'Absender nicht erkannt'}
        </span>
        <span className="text-small text-ink-3">{artLabel(zeile.art)}</span>
        <span className="ml-auto flex items-center gap-2">
          <Chip ton={STATUS_TON[status]}>{STATUS_LABEL[status]}</Chip>
          <time dateTime={zeile.empfangen_at} className="mono-sm text-ink-3 whitespace-nowrap">
            {fmtDatumKurz(zeile.empfangen_at)} {fmtZeit(zeile.empfangen_at)}
          </time>
        </span>
      </div>
      {zeile.linkedin_slug ? (
        <span className="mono-sm text-ink-3 truncate">linkedin.com/in/{zeile.linkedin_slug}</span>
      ) : null}
      {zeile.text ? (
        <p className="text-table text-ink-2 line-clamp-3 max-w-[64ch]" title={zeile.text}>
          ‚{zeile.text}‘
        </p>
      ) : null}
      {zeile.ergebnis ? (
        <p className={cn('text-small', status === 'fehler' ? 'text-danger' : 'text-ink-3')}>{zeile.ergebnis}</p>
      ) : null}
      {zeile.lead_id ? (
        <p className="text-small text-ink-2">
          Lead:{' '}
          <Link
            to={PFADE.lead(zeile.lead_id)}
            className="text-ink hover:text-ink-bright underline decoration-[var(--color-line-strong)] underline-offset-4"
          >
            {lead?.full_name ?? 'öffnen'}
          </Link>
          {lead?.company_name ? <span className="text-ink-3"> · {lead.company_name}</span> : null}
        </p>
      ) : null}
      {offenBar && !suche ? (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {einladung && zeile.lead_id ? (
            <Link
              to={PFADE.lead(zeile.lead_id)}
              className="border-line-strong text-small text-ink hover:bg-surface-hover inline-flex h-7 items-center gap-2 rounded-sm border px-2.5 font-medium"
            >
              Im CRM öffnen
              <ExternalLink size={14} strokeWidth={1.75} aria-hidden />
            </Link>
          ) : (
            <Button
              variante={status === 'unbekannt' ? 'primary' : 'secondary'}
              groesse="S"
              onClick={() => setSuche(true)}
            >
              {status === 'fehler' && zeile.lead_id ? 'Anderem Lead zuordnen' : 'Lead zuordnen'}
            </Button>
          )}
          <Button variante="quiet" groesse="S" busy={ignorieren.isPending} onClick={ignorierenKlick}>
            {einladung ? 'Erledigt' : 'Ignorieren'}
          </Button>
        </div>
      ) : null}
      {offenBar && suche ? <Zuordnen zeile={zeile} postfach={postfach} onFertig={() => setSuche(false)} /> : null}
    </li>
  )
}

export function EingangListe() {
  useEingangLive()
  const [params, setParams] = useSearchParams()
  const { data, isLoading, error, refetch } = useEingangListe()
  const { data: members } = useMembers()
  const meId = useMeId()

  const personParam = params.get('person')
  const person = members?.find((m) => personSlug(m) === personParam) ?? null
  const statusParam = params.get('status')
  const status: StatusFilter = istStatusFilter(statusParam) ? statusParam : 'offen'

  const setze = (k: 'person' | 'status', v: string | null) => {
    const p = new URLSearchParams(params)
    if (v) p.set(k, v)
    else p.delete(k)
    setParams(p, { replace: true })
  }

  const zeilen = useMemo(() => data?.zeilen ?? [], [data])
  const derPerson = useMemo(() => filtere(zeilen, person?.id ?? null, 'alle'), [zeilen, person])
  const zaehler = useMemo(() => zaehle(derPerson), [derPerson])
  const sichtbar = useMemo(() => filtere(derPerson, null, status), [derPerson, status])

  // Reihenfolge: Beide · ich · die andere Person
  const sortiert = [...(members ?? [])].sort((a, b) => Number(b.id === meId) - Number(a.id === meId))
  const personOptionen = [
    { key: 'beide', label: 'Beide' },
    ...sortiert.map((m) => ({ key: String(personSlug(m)), label: anzeigeName(m, 'Person') })),
  ]

  if (error) return <LadeFehler text="Der Eingang konnte nicht geladen werden" onNochmal={() => void refetch()} />

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
        <Segment
          ariaLabel="Postfach"
          klein
          optionen={personOptionen}
          wert={person ? String(personSlug(person)) : 'beide'}
          onChange={(k) => setze('person', k === 'beide' ? null : k)}
        />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Status">
          {STATUS_FILTER.map((f) => {
            const aktiv = f === status
            const n = zaehler[f]
            if (!aktiv && n === 0 && f !== 'offen' && f !== 'alle') return null
            return (
              // Aktiv neutral wie das Segment daneben (surface-hover + line-strong) – Lime heißt nur heute/Primär/Fokus
              // (DESIGN-SYSTEM § 2, Runde 3). Solange geladen wird „–“ statt einer falschen 0.
              <Chip
                key={f}
                ton={aktiv ? 'neutral' : 'muted'}
                aria-pressed={aktiv}
                onClick={() => setze('status', f === 'offen' ? null : f)}
                className={cn('h-7 px-2.5', aktiv ? 'bg-surface-hover' : 'border-line')}
              >
                {filterLabel(f)} <span className="font-mono">{isLoading ? '–' : n}</span>
              </Chip>
            )
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3" data-testid="eingang-laedt">
          <LadeHinweis />
          <Skeleton zeilen={5} />
        </div>
      ) : sichtbar.length === 0 ? (
        <EmptyState
          titel={status === 'offen' ? 'Nichts zuzuordnen.' : 'Keine Einträge.'}
          satz={
            zeilen.length === 0
              ? 'Sobald das Apps Script die ersten LinkedIn-Mails überträgt, stehen sie hier – ohne Neuladen.'
              : status === 'offen'
                ? 'Alle LinkedIn-Mails sind verbucht oder ignoriert.'
                : 'Mit diesem Filter gibt es keine Einträge.'
          }
          className="py-10"
        />
      ) : (
        <ul className="grid max-w-[760px]" aria-label="Eingang">
          {sichtbar.map((z) => (
            <Eintrag
              key={z.id}
              zeile={z}
              lead={z.lead_id ? data?.leads[z.lead_id] : undefined}
              postfach={members?.find((m) => m.id === z.member_id)}
            />
          ))}
        </ul>
      )}
      {zeilen.length >= 300 ? (
        <p className="text-small text-ink-3">Die 300 jüngsten Einträge – ignorierte verschwinden nach 30 Tagen.</p>
      ) : null}
    </div>
  )
}

/** „Lade …“ in Mono, wie die Platzhalterlinien erst nach 300 ms (Runde 3: 1,5 s lang standen nur die Filter-Chips da). */
function LadeHinweis() {
  const [sichtbar, setSichtbar] = useState(false)
  useEffect(() => {
    const t = window.setTimeout(() => setSichtbar(true), 300)
    return () => window.clearTimeout(t)
  }, [])
  return sichtbar ? <p className="text-ink-3 font-mono text-[12.5px]">Lade …</p> : null
}
