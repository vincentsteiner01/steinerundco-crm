// Einstellungen (BAUPLAN § 3.9, DESIGN-SYSTEM § 5.18): zwei Spalten 220px 1fr – Unternavigation (Einträge 34 px) + Formulare
// 560 px; Bereich aus der Route `/einstellungen/:bereich`; unbekannter Bereich → Profil; mobil: Liste (Tabs) → Formular.
import { Navigate, NavLink, useNavigate, useParams } from 'react-router'
import { PFADE } from '@/app/pfade'
import { Kbd, SeitenKopf, Tabs, cn } from '@/components/ui'
import { useHotkeys } from '@/lib/keyboard'
import { BEREICHE, STANDARD_BEREICH, istBereich, type Bereich } from './bereiche'
import { Export } from './Export'
import { Passcode } from './Passcode'
import { Profil } from './Profil'
import { Sequenzen } from './Sequenzen'
import { Sperrliste } from './Sperrliste'
import { Verbindungen } from './Verbindungen'
import { Ziele } from './Ziele'

const INHALT: Record<Bereich, () => React.JSX.Element> = {
  profil: Profil,
  passcode: Passcode,
  ziele: Ziele,
  sequenzen: Sequenzen,
  sperrliste: Sperrliste,
  export: Export,
  verbindungen: Verbindungen,
}

export function Component() {
  const { bereich } = useParams()
  const navigate = useNavigate()

  useHotkeys('global', Object.fromEntries(BEREICHE.map((b) => [b.taste, () => navigate(PFADE.einstellungen(b.key))])), [
    navigate,
  ])

  // Mobil: den aktiven Tab der quer scrollenden Leiste hält `Tabs` selbst in Sicht (Runde 3, 7. Tab „Verbindungen“ bei 390 px)
  if (!istBereich(bereich)) return <Navigate to={PFADE.einstellungen(STANDARD_BEREICH)} replace />
  const aktiv = BEREICHE.find((b) => b.key === bereich) ?? BEREICHE[0]!
  const Inhalt = INHALT[bereich]

  return (
    <>
      <SeitenKopf titel="Einstellungen" kontext={aktiv.label} />
      <div className="grid gap-8 md:grid-cols-[220px_1fr]">
        <nav aria-label="Einstellungen" className="max-md:hidden">
          <ul className="grid gap-0.5">
            {BEREICHE.map((b) => (
              <li key={b.key}>
                <NavLink
                  to={PFADE.einstellungen(b.key)}
                  className={({ isActive }) =>
                    cn(
                      'text-ui ease-brand flex h-[34px] items-center justify-between gap-2 rounded-sm px-2.5 transition-[background,color] duration-[var(--t-1)]',
                      isActive ? 'bg-surface-hover text-ink' : 'text-ink-2 hover:bg-surface-hover hover:text-ink',
                    )
                  }
                >
                  <span>{b.label}</span>
                  <Kbd>{b.taste}</Kbd>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0">
          <Tabs
            className="mb-5 md:hidden"
            ariaLabel="Einstellungen"
            tabs={BEREICHE.map((b) => ({ key: b.key, label: b.label }))}
            wert={bereich}
            onChange={(k) => navigate(PFADE.einstellungen(k))}
          />
          <div className="mb-6 max-md:hidden">
            <h2 id={`bereich-${bereich}`} className="text-h2 text-ink-bright">
              {aktiv.label}
            </h2>
            <p className="text-small text-ink-3 mt-1">{aktiv.beschreibung}</p>
          </div>
          <section aria-labelledby={`bereich-${bereich}`} key={bereich}>
            <Inhalt />
          </section>
        </div>
      </div>
    </>
  )
}
