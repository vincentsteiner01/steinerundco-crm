// Startkarte auf /auftrag (29.10.2026): Play-Button für den LinkedIn-Recherchelauf. Läuft schon ein Lauf, öffnet der Knopf
// diesen statt einen zweiten anzulegen (die Datenbank lässt ohnehin nur einen aktiven Lauf je Person zu).
import { Play } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { PFADE } from '@/app/pfade'
import { Button, Chip } from '@/components/ui'
import { useMeineLaeufe, useRechercheStarten } from '@/data/recherche'
import { fmtDatumZeit } from '@/lib/format'
import { STATUS_LABEL } from './regeln'

export function RechercheStart({ me }: { me: string | null }) {
  const navigate = useNavigate()
  const { data: laeufe } = useMeineLaeufe(me)
  const starten = useRechercheStarten()
  const aktiv = laeufe?.find((l) => l.status === 'laeuft' || l.status === 'pausiert')
  const fruehere = (laeufe ?? []).filter((l) => l !== aktiv).slice(0, 3)

  return (
    <section
      className="bg-sidebar mt-7 grid max-w-[880px] gap-3 rounded-md px-4 py-4 md:px-5"
      aria-label="LinkedIn-Recherche"
      data-recherche-start
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid max-w-[60ch] min-w-0 gap-1">
          <h2 className="text-ink-bright text-[15px] font-semibold">Neue Leads recherchieren und vernetzen</h2>
          <p className="text-small text-ink-2">
            Der Agent sucht passende Energie- und Solarbetriebe, prüft Firma und Rolle, gleicht jedes Profil mit dem CRM
            ab und sendet bis zu 30 Vernetzungsanfragen ohne Nachricht. Jede Person landet als Lead im CRM, die KPIs
            zählen mit. Voraussetzung: du bist in Chrome bei LinkedIn angemeldet.
          </p>
        </div>
        <Button
          variante="primary"
          icon={Play}
          busy={starten.isPending}
          onClick={() =>
            aktiv
              ? navigate(PFADE.recherche(aktiv.id))
              : starten.mutate(undefined, { onSuccess: (l) => navigate(PFADE.recherche(l.id)) })
          }
        >
          {aktiv ? 'Laufenden Lauf öffnen' : 'Recherche starten'}
        </Button>
      </div>
      {aktiv ? (
        <p className="text-small text-ink-2" role="status">
          {STATUS_LABEL[aktiv.status]} seit {fmtDatumZeit(aktiv.started_at)} · {aktiv.gesendet} von {aktiv.ziel}{' '}
          gesendet · {aktiv.geprueft} Profile geprüft
        </p>
      ) : null}
      {fruehere.length ? (
        <ul className="text-small text-ink-3 grid gap-1" aria-label="Letzte Läufe">
          {fruehere.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-2">
              <Chip ton={l.status === 'fehler' ? 'danger' : 'ended'}>{STATUS_LABEL[l.status] ?? l.status}</Chip>
              <Link className="hover:text-ink underline-offset-2 hover:underline" to={PFADE.recherche(l.id)}>
                {fmtDatumZeit(l.started_at)} · {l.gesendet} gesendet · {l.geprueft} geprüft · {l.dubletten} Dubletten
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
