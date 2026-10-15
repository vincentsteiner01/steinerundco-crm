// Team-Protokoll: Aktivitäten beider Personen im Zeitraum, neueste oben, nach Tagen gruppiert (Heute · Gestern · Mo 12.10.).
// Zeile: Avatar 22 · Uhrzeit Mono · Kanal-Glyph · Satz aus dem gemeinsamen Timeline-Wortlaut (leads/timelineText → TIMELINE_TEXT)
// · Lead-Name (öffnet den Peek über `?lead=`) und Unternehmen. Filter Person (Beide · Vincent · Mike) und Kanal in der URL
// (`?person=`, `?kanal=`). Keyset-Seiten à 50 („Ältere laden“); live über die Realtime-Invalidierung von ['activities', 'zeitraum'].
import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { useUiStore } from '@/app/uiStore'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { Glyph } from '@/components/ui/Glyph'
import { LadeFehler } from '@/components/ui/LadeFehler'
import { Segment } from '@/components/ui/Segment'
import { Skeleton } from '@/components/ui/Skeleton'
import { useMembers } from '@/data/members'
import { useSettings } from '@/data/settings'
import { useTemplates } from '@/data/templates'
import { timelineText } from '@/features/leads/timelineText'
import { fmtDatumKurz, fmtZeit } from '@/lib/format'
import type { Tag } from '@/lib/zeit'
import { KANAL_LABEL } from '@/texte/de'
import { useTeamProtokoll, type ProtokollZeile } from './daten/team'
import { nachTagen } from './kennzahlen'
import { parseKanal, parsePerson, type KanalWahl, type TeamPerson } from './personen'
import type { TeamZeitraum } from './zeitraum'

const KANAELE: { key: KanalWahl; label: string }[] = [
  { key: 'alle', label: 'Alle' },
  { key: 'linkedin', label: KANAL_LABEL.linkedin },
  { key: 'telefon', label: KANAL_LABEL.telefon },
  { key: 'email', label: KANAL_LABEL.email },
  { key: 'sonstiges', label: KANAL_LABEL.sonstiges },
]

export function Protokoll({
  personen,
  z,
  heute,
  onMonat,
}: {
  personen: readonly TeamPerson[]
  z: TeamZeitraum
  heute: Tag
  onMonat: () => void
}) {
  const [params, setParams] = useSearchParams()
  const person = parsePerson(params.get('person'), personen)
  const kanal = parseKanal(params.get('kanal'))
  const memberIds = useMemo(() => (person ? [person.id] : personen.map((p) => p.id)), [person, personen])
  const q = useTeamProtokoll({ memberIds, kanal: kanal === 'alle' ? null : kanal, von: z.von, bis: z.bis })
  const { data: templates } = useTemplates()
  const { data: settings } = useSettings()
  const { data: members } = useMembers()

  const zeilen = useMemo(() => q.data?.pages.flat() ?? [], [q.data])
  const gruppen = useMemo(() => nachTagen(zeilen, heute), [zeilen, heute])
  const ctx = useMemo(() => ({ templates, settings, members }), [templates, settings, members])

  const setze = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) p.delete(k)
      else p.set(k, v)
    }
    setParams(p, { replace: true })
  }
  const oeffne = (leadId: string) => {
    // ←/→ im Peek blättern durch die Leads des Protokolls (Reihenfolge wie angezeigt, ohne Dubletten)
    useUiStore.getState().setPeekListe([...new Set(zeilen.map((r) => r.lead_id))])
    setze({ lead: leadId })
  }
  const personVon = (memberId: string | null) => personen.find((p) => p.id === memberId)
  const gefiltert = !!person || kanal !== 'alle'
  const wer = person ? person.name : personen.map((p) => p.name).join(' und ')

  return (
    <section aria-labelledby="team-protokoll" className="mt-12 max-md:mt-9">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 id="team-protokoll" className="text-h2 text-ink">
            Team-Protokoll
          </h2>
          <span className="text-small text-ink-3" data-protokoll-hinweis>
            {z.label} · neueste oben · aktualisiert sich live
            {zeilen.length ? (
              <>
                {' · '}
                <span className="tnum font-mono">{zeilen.length}</span>
                {q.hasNextPage ? ' geladen' : zeilen.length === 1 ? ' Eintrag' : ' Einträge'}
              </>
            ) : null}
          </span>
        </div>
        <div className="flex max-w-full flex-wrap items-center gap-2">
          <Segment
            ariaLabel="Person"
            klein
            optionen={[{ key: 'beide', label: 'Beide' }, ...personen.map((p) => ({ key: p.slug, label: p.name }))]}
            wert={person ? person.slug : 'beide'}
            onChange={(k) => setze({ person: k === 'beide' ? null : k })}
          />
          <Segment<KanalWahl>
            ariaLabel="Kanal"
            klein
            optionen={KANAELE}
            wert={kanal}
            onChange={(k) => setze({ kanal: k === 'alle' ? null : k })}
          />
        </div>
      </div>

      {q.isError && !q.isFetching ? (
        <LadeFehler text="Das Team-Protokoll konnte nicht geladen werden" onNochmal={() => void q.refetch()} />
      ) : q.isPending ? (
        <Skeleton zeilen={6} className="py-4" />
      ) : zeilen.length === 0 ? (
        <div className="border-line border-t py-8" data-leer>
          <p className="voice text-ink-2">
            {gefiltert ? 'Mit diesem Filter' : `Von ${wer}`} ist {z.art === 'heute' ? 'heute' : `in ${z.label}`} noch
            nichts erfasst.
          </p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {gefiltert ? (
              <Button groesse="S" onClick={() => setze({ person: null, kanal: null })}>
                Filter zurücksetzen
              </Button>
            ) : null}
            {z.art !== 'monat' ? (
              <Button groesse="S" variante="quiet" onClick={onMonat}>
                Ganzen Monat ansehen
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="grid">
          {gruppen.map((g) => (
            <div
              key={g.tag}
              role="group"
              aria-label={`${g.label}, ${g.zeilen.length} ${g.zeilen.length === 1 ? 'Eintrag' : 'Einträge'}`}
              data-tag={g.tag}
              className="mt-5 first:mt-1"
            >
              <h3 className="border-line-strong flex h-8 items-center gap-2.5 border-b">
                <span className="label">{g.label}</span>
                {g.label === 'Heute' || g.label === 'Gestern' ? (
                  <span className="tnum text-ink-3 font-mono text-[12px]">{fmtDatumKurz(g.tag)}</span>
                ) : null}
                <span className="tnum text-ink-3 ml-auto font-mono text-[12px]">{g.zeilen.length}</span>
              </h3>
              <ol className="grid">
                {g.zeilen.map((r) => (
                  <ProtokollEintrag
                    key={r.id}
                    r={r}
                    person={personVon(r.member_id)}
                    text={timelineText(r, ctx)}
                    onOeffnen={oeffne}
                  />
                ))}
              </ol>
            </div>
          ))}
          <div className="text-small text-ink-3 flex items-center gap-3 pt-4">
            {q.hasNextPage ? (
              <Button groesse="S" onClick={() => void q.fetchNextPage()} busy={q.isFetchingNextPage}>
                Ältere laden
              </Button>
            ) : (
              <span>Alle Einträge {z.art === 'heute' ? 'von heute' : `aus ${z.label}`} geladen.</span>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

function ProtokollEintrag({
  r,
  person,
  text,
  onOeffnen,
}: {
  r: ProtokollZeile
  person: TeamPerson | undefined
  text: string
  onOeffnen: (leadId: string) => void
}) {
  const name = r.lead?.full_name?.trim() || 'Lead ohne Namen'
  const firma = r.lead?.company_name?.trim() || null
  const geloescht = !!r.lead?.deleted_at
  return (
    <li
      data-eintrag={r.id}
      className="border-line flex min-h-10 items-center gap-3 border-b py-1.5 max-md:items-start max-md:py-2.5"
    >
      <Avatar member={person?.member} groesse={22} className="max-md:mt-px" />
      <time
        dateTime={r.occurred_at}
        className="mono-sm tnum text-ink-3 w-10 flex-none max-md:pt-[3px]"
        title={`${fmtDatumKurz(r.occurred_at)} ${fmtZeit(r.occurred_at)}`}
      >
        {fmtZeit(r.occurred_at)}
      </time>
      {/* Kanal-Glyph nur für LinkedIn · Telefon · E-Mail; Stufenwechsel/Termine (Sonstiges) bekommen eine leere Spalte */}
      <span className="flex w-[22px] flex-none justify-center max-md:hidden">
        {r.channel && r.channel !== 'sonstiges' ? <Glyph kanal={r.channel} /> : null}
      </span>
      <div className="grid min-w-0 flex-1 items-baseline gap-x-5 gap-y-0.5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <span className="text-small text-ink truncate" title={text} data-satz>
          {text}
        </span>
        <span className="text-small flex min-w-0 items-baseline gap-1.5">
          <button
            type="button"
            onClick={() => onOeffnen(r.lead_id)}
            title={geloescht ? `${name} – im Papierkorb` : `${name} im Peek öffnen`}
            className={cn(
              'max-w-full shrink-0 truncate text-left font-medium underline-offset-2 hover:underline',
              geloescht ? 'text-ink-3 line-through' : 'text-ink',
            )}
            data-lead={r.lead_id}
          >
            {name}
          </button>
          {firma ? (
            <span className="text-ink-3 min-w-0 shrink truncate" title={firma}>
              {firma}
            </span>
          ) : null}
        </span>
      </div>
    </li>
  )
}
