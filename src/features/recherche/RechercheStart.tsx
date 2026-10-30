// Startkarte auf /auftrag (29.10.2026): Play-Button für den LinkedIn-Recherchelauf (derselbe Start wie der blaue Knopf in der
// Seitenleiste). Der Start fordert zugleich den ChatGPT-Agenten an, den der Recherche-Dienst auf dem Rechner startet (Migrationen
// 18/19). Läuft schon ein Lauf, öffnet der Knopf diesen statt einen zweiten anzulegen.
import { Play } from 'lucide-react'
import { Link } from 'react-router'
import { PFADE } from '@/app/pfade'
import { Button, Chip } from '@/components/ui'
import { fmtDatumZeit } from '@/lib/format'
import { agentZustand } from './logik'
import { DienstZeile } from './RechercheDienst'
import { useRechercheOeffnen } from './start'
import { STATUS_LABEL } from './regeln'

export function RechercheStart({ me }: { me: string | null }) {
  const { laeufe, aktiv, los, busy } = useRechercheOeffnen()
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
            ChatGPT sucht passende Energie- und Solarbetriebe, prüft Firma und Rolle, gleicht jedes Profil mit dem CRM
            ab und vernetzt dich mit bis zu 30 Personen – ohne Nachricht und erst nach deiner Freigabe. Jede Person
            landet als Lead im CRM, die KPIs zählen mit. Es startet von selbst in deinem Chrome, sobald der
            Recherche-Dienst auf deinem Rechner (Mac oder Windows) eingerichtet ist.
          </p>
        </div>
        <Button variante="primary" icon={Play} busy={busy} onClick={los}>
          {aktiv ? 'Laufenden Lauf öffnen' : 'Recherche starten'}
        </Button>
      </div>
      <DienstZeile memberId={me} />
      {aktiv ? (
        <p className="text-small text-ink-2" role="status">
          {STATUS_LABEL[aktiv.status]} seit {fmtDatumZeit(aktiv.started_at)} · {agentZustand(aktiv).titel} ·{' '}
          {aktiv.gesendet} von {aktiv.ziel} gesendet · {aktiv.geprueft} Profile geprüft
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
