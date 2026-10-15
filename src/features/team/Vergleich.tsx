// Team-Vergleich (DESIGN-SYSTEM § 5.15 sinngemäß): zwei Personenköpfe (Avatar 48 mit Foto, Name, „zuletzt aktiv“, Heute-Status
// fällig · überfällig · heute erledigt) und je Kennzahl eine Haarlinien-Zeile: Vincent links · Schmetterlingsbalken · Mike rechts.
// Zahlen Geist Mono display (Phone display-sm), Balken 1 px line-strong mit 3-px-Füllung ink (wie die Funnel-Konversion), keine
// Farbe für Personen. Mobil: Köpfe untereinander, Zeilen bleiben dreispaltig mit Namenszeile darüber.
import { useMemo } from 'react'
import { Link } from 'react-router'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { LadeFehler } from '@/components/ui/LadeFehler'
import { Skeleton } from '@/components/ui/Skeleton'
import { useActivitiesZeitraum } from '@/data/activities'
import { useMetricEventZeilen } from '@/data/kpis'
import { useQueueZaehler } from '@/data/queue'
import { useSequencesIndex } from '@/data/sequences'
import { SheetBadge } from '@/features/kpis/_Teile'
import { fmtZahl } from '@/lib/format'
import type { Tag } from '@/lib/zeit'
import { useZuletztAktiv } from './daten/team'
import type { TeamPerson } from './personen'
import { useJetzt } from './useJetzt'
import {
  anteile,
  ERLEDIGT_TYPEN,
  erledigtJePerson,
  FOLLOWUP_TYPEN,
  TEAM_METRIKEN,
  werteJePerson,
  zuletztAktiv,
  type PersonWerte,
  type TeamMetrik,
} from './kennzahlen'
import { monatsanfang, type TeamZeitraum, type TeamZeitraumArt } from './zeitraum'

/** Genitiv für „Mikes Heute-Liste“ (Vincent → Vincents). */
const genitiv = (name: string): string => (/[sßxz]$/i.test(name) ? `${name}’` : `${name}s`)

export function Vergleich({
  links,
  rechts,
  meId,
  z,
  heute,
  onZeitraum,
}: {
  links: TeamPerson
  rechts: TeamPerson
  meId: string | null
  z: TeamZeitraum
  heute: Tag
  onZeitraum: (a: TeamZeitraumArt) => void
}) {
  // Ab Monatsanfang laden: die Sheet-Monatszeile liegt auf dem 1. – sie steuert Badge und Hinweis (gezählt wird nur [von, bis])
  const zeilen = useMetricEventZeilen('team', monatsanfang(z.von), z.bis)
  const followups = useActivitiesZeitraum('team', z.von, z.bis, FOLLOWUP_TYPEN)
  const erledigt = useActivitiesZeitraum('team', heute, heute, ERLEDIGT_TYPEN)

  const werteL = useMemo(
    () => werteJePerson(links.id, zeilen.data, followups.data, z),
    [links.id, zeilen.data, followups.data, z],
  )
  const werteR = useMemo(
    () => werteJePerson(rechts.id, zeilen.data, followups.data, z),
    [rechts.id, zeilen.data, followups.data, z],
  )

  const laden = zeilen.istLaden || followups.istLaden
  const fehler = zeilen.fehler ?? followups.fehler
  const allesNull = TEAM_METRIKEN.every((m) => werteL.werte[m.key] === 0 && werteR.werte[m.key] === 0)
  const sheetPersonen = [...(werteL.sheetMonat ? [links] : []), ...(werteR.sheetMonat ? [rechts] : [])]

  return (
    <section aria-label="Vergleich" className="grid gap-0">
      <div className="border-line grid grid-cols-2 gap-6 border-b pb-5 max-md:grid-cols-1 max-md:gap-0 max-md:pb-0">
        <PersonKopf
          person={links}
          seite="links"
          ich={links.id === meId}
          erledigt={erledigt.istLaden ? null : erledigtJePerson(links.id, erledigt.data)}
        />
        <PersonKopf
          person={rechts}
          seite="rechts"
          ich={rechts.id === meId}
          erledigt={erledigt.istLaden ? null : erledigtJePerson(rechts.id, erledigt.data)}
        />
      </div>

      {/* Mobil stehen die Köpfe untereinander – diese Zeile sagt, welche Spalte wer ist */}
      <div
        className="border-line text-ui text-ink-2 flex items-center justify-between gap-3 border-b py-2.5 md:hidden"
        aria-hidden
      >
        <span className="flex min-w-0 items-center gap-2">
          <Avatar member={links.member} groesse={22} />
          <span className="truncate">{links.name}</span>
        </span>
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{rechts.name}</span>
          <Avatar member={rechts.member} groesse={22} />
        </span>
      </div>

      {fehler && !laden ? (
        <LadeFehler className="mt-4" text="Kennzahlen konnten nicht geladen werden" onNochmal={zeilen.nachladen} />
      ) : laden ? (
        <Skeleton zeilen={8} className="py-6" />
      ) : allesNull ? (
        // Acht Zeilen „0 – 0“ sagen nichts: ein Satz und der Weg zu einem Zeitraum mit Bewegung
        <div className="border-line border-b py-8" data-leer="kennzahlen">
          <p className="voice text-ink-2">
            {z.art === 'heute' ? 'Heute' : `In ${z.label}`} ist für {links.name} und {rechts.name} noch nichts gezählt.
          </p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {z.art !== 'woche' ? (
              <Button groesse="S" onClick={() => onZeitraum('woche')} kbd="2">
                Woche ansehen
              </Button>
            ) : null}
            {z.art !== 'monat' ? (
              <Button groesse="S" variante="quiet" onClick={() => onZeitraum('monat')} kbd="3">
                Monat ansehen
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <ol aria-label={`Kennzahlen ${z.label}: ${links.name} und ${rechts.name}`} className="grid">
          {TEAM_METRIKEN.map((m) => (
            <MetrikZeile key={m.key} m={m} links={links} rechts={rechts} wl={werteL} wr={werteR} />
          ))}
        </ol>
      )}

      {!laden && !fehler && !z.monatszaehler && sheetPersonen.length ? (
        <p className="text-small text-ink-3 mt-3 max-w-[72ch]" data-hinweis="sheet">
          Zahlen wie auf der KPI-Seite. Für {sheetPersonen.map((p) => p.name).join(' und ')} gelten in diesem Monat die
          Werte aus dem KPI-Sheet: In „Heute“ und „Woche“ zählen nur Tageszähler und neu erfasste Ereignisse.{' '}
          <button
            type="button"
            onClick={() => onZeitraum('monat')}
            className="text-ink-2 hover:text-ink underline underline-offset-2"
          >
            Monat ansehen
          </button>
        </p>
      ) : !laden && !fehler ? (
        <p className="text-small text-ink-3 mt-3">Zahlen wie auf der KPI-Seite.</p>
      ) : null}
    </section>
  )
}

function PersonKopf({
  person,
  seite,
  ich,
  erledigt,
}: {
  person: TeamPerson
  seite: 'links' | 'rechts'
  ich: boolean
  erledigt: number | null
}) {
  const jetzt = useJetzt()
  const zuletzt = useZuletztAktiv(person.id)
  // Überfällig wie die Heute-Sektion (ohne Rückrufe/Opener) – sonst „63“ hier, „60“ auf Heute (Runde 2)
  const { data: seqIdx } = useSequencesIndex()
  const queue = useQueueZaehler(person.id, undefined, (id) => !!(id && seqIdx?.stepsById.get(id)?.is_opener))
  const rechts = seite === 'rechts'
  const heuteLink = ich ? '/heute' : `/heute?person=${person.slug}`
  const zahl = (n: number | null | undefined) => (n === null || n === undefined ? '–' : fmtZahl(n))
  return (
    <div
      data-person={person.slug}
      className={cn(
        'flex min-w-0 items-start gap-3.5',
        rechts && 'md:flex-row-reverse md:text-right',
        'max-md:border-line max-md:py-4 max-md:[&:not(:last-child)]:border-b',
      )}
    >
      <Avatar member={person.member} groesse={48} />
      <div className="grid min-w-0 gap-1">
        <h2 className="lead-name text-ink-bright truncate">{person.name}</h2>
        <p className="text-small text-ink-3 truncate" data-zuletzt>
          zuletzt aktiv {zuletzt.isPending ? '…' : zuletztAktiv(zuletzt.data, jetzt)}
        </p>
        <p
          className={cn(
            'tnum text-ink-2 mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 font-mono text-[13px]',
            rechts && 'md:justify-end',
          )}
          aria-label={`Heute: ${zahl(queue.data?.faellig)} fällig, ${zahl(queue.data?.ueberfaelligSektion)} überfällig, ${zahl(erledigt)} erledigt`}
          title="Heute-Liste: fällig (mit überfälligen und Antworten) · davon überfällig · heute erledigt (gesendet, angerufen, abgehakt)"
          data-status
        >
          <span className="whitespace-nowrap">
            <b className={cn('text-[15px] font-medium', queue.data?.faellig ? 'text-signal' : 'text-ink-bright')}>
              {zahl(queue.data?.faellig)}
            </b>{' '}
            fällig
          </span>
          <span className="whitespace-nowrap">
            <b
              className={cn(
                'text-[15px] font-medium',
                queue.data?.ueberfaelligSektion ? 'text-overdue' : 'text-ink-bright',
              )}
            >
              {zahl(queue.data?.ueberfaelligSektion)}
            </b>{' '}
            überfällig
          </span>
          <span className="whitespace-nowrap">
            <b className="text-ink-bright text-[15px] font-medium">{zahl(erledigt)}</b> erledigt
          </span>
        </p>
        <Link
          to={heuteLink}
          className={cn(
            'text-small text-ink-2 hover:text-ink mt-0.5 justify-self-start underline-offset-2 hover:underline',
            rechts && 'md:justify-self-end',
          )}
        >
          {ich ? 'Deine Heute-Liste' : `${genitiv(person.name)} Heute-Liste`} →
        </Link>
      </div>
    </div>
  )
}

function MetrikZeile({
  m,
  links,
  rechts,
  wl,
  wr,
}: {
  m: TeamMetrik
  links: TeamPerson
  rechts: TeamPerson
  wl: PersonWerte
  wr: PersonWerte
}) {
  const a = wl.werte[m.key]
  const b = wr.werte[m.key]
  const anteil = anteile(a, b)
  const sub = (w: PersonWerte) =>
    m.key === 'anrufe' && w.werte.anrufe > 0 ? `davon ${fmtZahl(w.erreicht)} erreicht` : null
  return (
    <li
      data-metrik={m.key}
      aria-label={`${m.label}: ${links.name} ${fmtZahl(a)}, ${rechts.name} ${fmtZahl(b)}`}
      className="border-line wide:grid-cols-[minmax(0,1fr)_minmax(0,3fr)_minmax(0,1fr)] grid grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)_minmax(0,1fr)] items-center gap-x-6 border-b py-2.5 max-md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)] max-md:gap-x-3"
    >
      <Wert wert={a} sub={sub(wl)} sheet={wl.nurSheet.has(m.key)} seite="links" />
      {/* Phone: Label über die ganze Zeile (nie abgeschnitten), darunter Zahl · Balken · Zahl */}
      <div className="grid min-w-0 gap-2.5 max-md:contents">
        <span
          className="label truncate text-center max-md:col-span-3 max-md:row-start-1 max-md:mb-1 max-md:whitespace-normal"
          title={m.hinweis}
        >
          {m.label}
        </span>
        <span className="max-md:col-start-2 max-md:row-start-2 max-md:self-center">
          <Schmetterling links={anteil.links} rechts={anteil.rechts} />
        </span>
      </div>
      <Wert wert={b} sub={sub(wr)} sheet={wr.nurSheet.has(m.key)} seite="rechts" />
    </li>
  )
}

function Wert({
  wert,
  sub,
  sheet,
  seite,
}: {
  wert: number
  sub: string | null
  sheet: boolean
  seite: 'links' | 'rechts'
}) {
  const rechts = seite === 'rechts'
  return (
    <div
      className={cn(
        'grid min-w-0 gap-1 max-md:row-start-2',
        rechts ? 'justify-items-end text-right max-md:col-start-3' : 'justify-items-start max-md:col-start-1',
      )}
    >
      <span
        className={cn('flex flex-wrap items-baseline gap-x-2 gap-y-1', rechts && 'flex-row-reverse')}
        data-seite={seite}
      >
        <span
          className={cn(
            'tnum text-display max-md:text-display-sm font-mono',
            wert === 0 ? 'text-ink-3' : 'text-ink-bright',
          )}
          data-wert
        >
          {fmtZahl(wert)}
        </span>
        {sheet ? <SheetBadge /> : null}
      </span>
      {sub ? <span className="tnum text-ink-2 truncate font-mono text-[12.5px]">{sub}</span> : null}
    </div>
  )
}

/** Schmetterlingsbalken: Mitte = 0, links Vincents Anteil, rechts Mikes – relativ zum größeren Wert. */
function Schmetterling({ links, rechts }: { links: number; rechts: number }) {
  return (
    <span className="grid grid-cols-2 items-center" aria-hidden data-balken>
      <span className="bg-line-strong relative h-px">
        <i
          className="bg-ink absolute -top-px right-0 h-[3px] opacity-90"
          style={{ width: `${Math.round(links * 100)}%` }}
          data-anteil={Math.round(links * 100)}
        />
      </span>
      <span className="bg-line-strong relative h-px">
        <i
          className="bg-ink absolute -top-px left-0 h-[3px] opacity-90"
          style={{ width: `${Math.round(rechts * 100)}%` }}
          data-anteil={Math.round(rechts * 100)}
        />
        <i className="bg-deco absolute -top-[3px] -left-px h-[7px] w-px" />
      </span>
    </span>
  )
}
