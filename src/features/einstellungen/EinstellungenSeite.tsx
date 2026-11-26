// Einstellungen (Route `/einstellungen/:bereich`, Neustart 25.11.2026): fünf Bereiche – links die Unternavigation, rechts der
// Bereich. Unter 768 px steht die Unternavigation als umbrechende Reihe darüber: alle fünf Einträge bleiben sichtbar, nichts
// scrollt zur Seite. Unbekannte und entfallene Bereiche (ziele, sequenzen, verbindungen) leiten hier aufs Profil um – der
// Router kennt nur `/einstellungen/:bereich`.
import { Navigate, NavLink, useParams } from 'react-router'
import { PFADE } from '@/app/pfade'
import { cn } from '@/components/ui/cn'
import { BEREICHE, STANDARD_BEREICH, istBereich, type Bereich } from './bereiche'
import { Export } from './Export'
import { Feiertage } from './Feiertage'
import { Passcode } from './Passcode'
import { Profil } from './Profil'
import { Sperrliste } from './Sperrliste'

const INHALT: Record<Bereich, () => React.JSX.Element | null> = {
  profil: Profil,
  passcode: Passcode,
  sperrliste: Sperrliste,
  feiertage: Feiertage,
  export: Export,
}

export function Component() {
  const { bereich } = useParams()

  if (!istBereich(bereich)) return <Navigate to={PFADE.einstellungen(STANDARD_BEREICH)} replace />
  const aktiv = BEREICHE.find((b) => b.key === bereich) ?? BEREICHE[0]!
  const Inhalt = INHALT[bereich]

  return (
    <div>
      <header className="pt-7 pb-6 max-md:pt-5 max-md:pb-5">
        {/* min-h-11 wie auf Leads, Leitfäden und Team: der Titel sitzt auf allen Seiten gleich */}
        <h1 className="headline flex min-h-11 items-center">Einstellungen</h1>
      </header>
      <div className="grid gap-6 md:grid-cols-[200px_minmax(0,1fr)] md:gap-10">
        <nav aria-label="Einstellungen">
          <ul className="flex flex-wrap gap-2 md:grid md:gap-0.5">
            {BEREICHE.map((b) => (
              <li key={b.key}>
                <NavLink
                  to={PFADE.einstellungen(b.key)}
                  className={({ isActive }) =>
                    cn(
                      'text-ui ease-brand flex h-11 items-center rounded-sm px-3.5 transition-[background,color] duration-[var(--t-1)] max-md:border md:h-10 md:px-3',
                      isActive
                        ? 'bg-surface-hover text-ink max-md:border-line-strong'
                        : 'text-ink-2 hover:bg-surface-hover hover:text-ink max-md:border-line',
                    )
                  }
                >
                  {b.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        {/* key: beim Wechsel des Bereichs beginnt der Inhalt frisch (keine halb getippten Eingaben aus dem vorigen Bereich) */}
        <section aria-labelledby={`bereich-${bereich}`} key={bereich} className="min-w-0 pb-10">
          {/* Unter 768 px zeigt die Reihe darüber schon, wo man ist – die Überschrift bleibt für Vorleseprogramme */}
          <h2 id={`bereich-${bereich}`} className="text-h2 text-ink-bright mb-6 max-md:sr-only">
            {aktiv.label}
          </h2>
          {/* Eigener Rahmen: der erste Abschnitt des Bereichs ist darin das erste Kind und bekommt keine Trennlinie */}
          <div>
            <Inhalt />
          </div>
        </section>
      </div>
    </div>
  )
}
