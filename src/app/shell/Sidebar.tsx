import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { aktiverEintrag, gruppeVon, istGruppe, NAV_BAUM, type NavEintrag, type NavGruppe } from '@/app/nav'
import { PFADE } from '@/app/pfade'
import { Avatar } from '@/components/ui/Avatar'
import { Marke } from '@/components/ui/Marke'
import { cn } from '@/components/ui/cn'
import { useAuth } from '@/features/auth/authStore'
import { ALLGEMEIN } from '@/texte/de'

/**
 * Sidebar ≥ 1024 px (232 px, Haarlinie rechts). Neustart 25.11.2026: nur Marke, die sechs Navigationspunkte und unten die
 * angemeldete Person mit „Abmelden“ – keine Suche, keine Zähler, keine Tastenhinweise.
 */
export function Sidebar() {
  const navigate = useNavigate()
  const member = useAuth((s) => s.member)
  const abmelden = useAuth((s) => s.abmelden)
  const { pathname } = useLocation()
  const aktiv = aktiverEintrag(pathname)
  const aktiveGruppe = gruppeVon(aktiv)
  const [offen, setOffen] = useState<Record<string, boolean>>(liesOffen)
  const istOffen = (g: NavGruppe) => g.gruppe === aktiveGruppe?.gruppe || (offen[g.gruppe] ?? g.offenStandard)
  const umschalten = (g: NavGruppe) => {
    // Die Gruppe der aktiven Seite bleibt offen – sonst verschwände der markierte Punkt
    if (g.gruppe === aktiveGruppe?.gruppe) return
    const neu = { ...offen, [g.gruppe]: !istOffen(g) }
    setOffen(neu)
    schreibeOffen(neu)
  }

  return (
    <aside
      className="border-line bg-sidebar sticky top-0 flex h-dvh flex-col overflow-hidden border-r px-3 pt-[18px] pb-4"
      aria-label="Seitenleiste"
    >
      <Link to={PFADE.leads} className="flex items-center px-2 pb-5">
        <Marke zusatz="CRM" />
      </Link>

      {/* Scrollt bei kleiner Fensterhöhe, statt den Fuß zu verdrängen */}
      <nav className="-mx-1 grid min-h-0 content-start gap-0.5 overflow-y-auto px-1 pb-2" aria-label="Hauptnavigation">
        {NAV_BAUM.map((k, i) =>
          k === 'trenner' ? (
            <hr key={`t${i}`} className="border-line my-2 border-0 border-t" />
          ) : istGruppe(k) ? (
            <Gruppe key={k.gruppe} gruppe={k} offen={istOffen(k)} onToggle={() => umschalten(k)} aktiv={aktiv} />
          ) : (
            <Eintrag key={k.pfad} e={k} aktiv={aktiv === k} />
          ),
        )}
      </nav>

      <div className="border-line mt-auto flex items-center gap-2.5 border-t px-2 pt-3">
        <Avatar member={member ? { display_name: member.display_name, email: member.email } : null} groesse={28} />
        <span className="truncate-1 text-ui min-w-0">{member?.display_name ?? '–'}</span>
        <button
          type="button"
          onClick={() => void abmelden(false).then(() => navigate(PFADE.anmelden, { replace: true }))}
          className="text-small text-ink-3 hover:text-ink hover:bg-surface-hover -mr-1.5 ml-auto h-8 flex-none rounded-sm px-2"
        >
          {ALLGEMEIN.abmelden}
        </button>
      </div>
    </aside>
  )
}

// Neuer Schlüssel seit dem Neustart: der alte (`crm.nav.offen`) merkte sich Gruppen, die es nicht mehr gibt
const OFFEN_KEY = 'crm.nav.gruppen'

/** Auf-/Zugeklappt je Gruppe – nur Bequemlichkeit dieses Browsers (fehlt der Speicher, gilt der Standard). */
function liesOffen(): Record<string, boolean> {
  try {
    const roh = localStorage.getItem(OFFEN_KEY)
    const w: unknown = roh ? JSON.parse(roh) : {}
    return w && typeof w === 'object' ? (w as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}
function schreibeOffen(w: Record<string, boolean>): void {
  try {
    localStorage.setItem(OFFEN_KEY, JSON.stringify(w))
  } catch {
    // ohne Speicher bleibt es beim Standard
  }
}

const ZEILE =
  'text-ui ease-brand hover:bg-surface-hover hover:text-ink relative flex h-9 w-full items-center gap-2.5 rounded-sm px-2.5 text-left transition-[background,color] duration-[var(--t-1)]'
const ZEILE_AKTIV = 'bg-surface-pressed/70 text-ink-bright'

function Eintrag({ e, aktiv, eingerueckt }: { e: NavEintrag; aktiv: boolean; eingerueckt?: boolean }) {
  return (
    <Link
      to={e.pfad}
      // Aktiv bestimmt aktiverEintrag (längster Pfad: /email/kampagnen vor /email), nicht NavLinks Pfadvergleich
      aria-current={aktiv ? 'page' : undefined}
      className={cn(ZEILE, eingerueckt && 'pl-[38px]', aktiv ? ZEILE_AKTIV : 'text-ink-2')}
    >
      {eingerueckt || !e.icon ? null : (
        <e.icon size={18} strokeWidth={1.75} aria-hidden className={aktiv ? 'text-ink' : 'text-ink-3'} />
      )}
      <span className="min-w-0 truncate">{e.label}</span>
    </Link>
  )
}

function Gruppe({
  gruppe,
  offen,
  onToggle,
  aktiv,
}: {
  gruppe: NavGruppe
  offen: boolean
  onToggle: () => void
  aktiv: NavEintrag | null
}) {
  const id = `nav-gruppe-${gruppe.gruppe}`
  const enthaeltAktiv = !!aktiv && gruppe.kinder.includes(aktiv)
  return (
    <div className="grid gap-0.5" data-gruppe={gruppe.gruppe}>
      <button
        type="button"
        aria-expanded={offen}
        aria-controls={id}
        onClick={onToggle}
        className={cn(ZEILE, 'text-ink-2')}
      >
        <gruppe.icon size={18} strokeWidth={1.75} aria-hidden className={enthaeltAktiv ? 'text-ink' : 'text-ink-3'} />
        <span className="min-w-0 truncate">{gruppe.label}</span>
        <ChevronRight
          size={14}
          strokeWidth={1.75}
          aria-hidden
          className={cn(
            'text-ink-3 ease-brand ml-auto shrink-0 transition-transform duration-[var(--t-1)]',
            offen && 'rotate-90',
          )}
        />
      </button>
      {offen ? (
        <div id={id} className="grid gap-0.5">
          {gruppe.kinder.map((e) => (
            <Eintrag key={e.pfad} e={e} aktiv={aktiv === e} eingerueckt />
          ))}
        </div>
      ) : null}
    </div>
  )
}
