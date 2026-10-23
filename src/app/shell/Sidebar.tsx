import { Marke } from '@/components/ui/Marke'
import { ChevronRight, MessageSquareWarning, Search } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router'
import {
  aktiverEintrag,
  gruppeVon,
  istGruppe,
  NAV_BAUM,
  pfadOhneQuery,
  type NavEintrag,
  type NavGruppe,
} from '@/app/nav'
import { PFADE } from '@/app/pfade'
import { useUiStore } from '@/app/uiStore'
import { Avatar } from '@/components/ui/Avatar'
import { Kbd } from '@/components/ui/Kbd'
import { cn } from '@/components/ui/cn'
import { useNavZaehler } from '@/data/nav'
import { useAuth } from '@/features/auth/authStore'
import { FEEDBACK_EVENT } from '@/features/feedback/ereignis'
import { ALLGEMEIN } from '@/texte/de'
import { RealtimePunkt } from './RealtimePunkt'

// Eingang-Zähler (LinkedIn-Mails) am Eintrag „Einstellungen“ – nachgeladen, nicht im Start-Bundle (E22)
const EingangZahl = lazy(() => import('./EingangZahl').then((m) => ({ default: m.EingangZahl })))

/** DESIGN-SYSTEM § 4.1: Sidebar 232 px, canvas, Haarlinie rechts, padding 22 12 16; Marke · ⌘K-Trigger · Navigation + Zähler · Fuß (Ich, Abmelden, ?). */
export function Sidebar() {
  const navigate = useNavigate()
  const member = useAuth((s) => s.member)
  const abmelden = useAuth((s) => s.abmelden)
  const setPaletteOffen = useUiStore((s) => s.setPaletteOffen)
  const setHilfeOffen = useUiStore((s) => s.setHilfeOffen)
  const zaehler = useNavZaehler()
  const { pathname, search } = useLocation()
  const aktiv = aktiverEintrag(pathname, search)
  const aktiveGruppe = gruppeVon(aktiv)
  const [offen, setOffen] = useState<Record<string, boolean>>(liesOffen)
  const umschalten = (g: NavGruppe) => {
    const jetzt = g.gruppe === aktiveGruppe?.gruppe || (offen[g.gruppe] ?? g.offenStandard)
    // Die Gruppe der aktiven Seite bleibt offen – sonst verschwände der markierte Punkt
    if (jetzt && g.gruppe === aktiveGruppe?.gruppe) return
    const neu = { ...offen, [g.gruppe]: !jetzt }
    setOffen(neu)
    schreibeOffen(neu)
  }

  return (
    <aside
      className="border-line bg-sidebar sticky top-0 flex h-dvh flex-col overflow-hidden border-r px-3 pt-[18px] pb-4"
      aria-label="Seitenleiste"
    >
      <NavLink to={PFADE.heute} className="flex items-center px-2 pb-4">
        <Marke zusatz="CRM" />
      </NavLink>

      <button
        type="button"
        onClick={() => setPaletteOffen(true)}
        className="border-line bg-canvas text-ink-3 ease-brand hover:text-ink shadow-card mb-3.5 flex h-[34px] w-full items-center gap-2 rounded-sm border px-2.5 text-left text-[13px] transition-[color,background] duration-[var(--t-1)]"
      >
        <Search size={14} strokeWidth={1.75} aria-hidden />
        <span className="min-w-0 flex-1 truncate">{ALLGEMEIN.suchenOderBefehl}</span>
        <Kbd>⌘K</Kbd>
      </button>

      {/* Scrollt bei kleiner Fensterhöhe, statt den Fuß (Ich, Feedback) zu verdrängen */}
      <nav className="-mx-1 grid min-h-0 content-start gap-0.5 overflow-y-auto px-1 pb-2" aria-label="Hauptnavigation">
        {NAV_BAUM.map((k, i) =>
          k === 'trenner' ? (
            <hr key={`t${i}`} className="border-line my-2 border-0 border-t" />
          ) : istGruppe(k) ? (
            <Gruppe
              key={k.gruppe}
              gruppe={k}
              offen={k.gruppe === aktiveGruppe?.gruppe || (offen[k.gruppe] ?? k.offenStandard)}
              onToggle={() => umschalten(k)}
              aktiv={aktiv}
              zaehler={zaehler}
            />
          ) : (
            <Eintrag key={k.pfad} e={k} aktiv={aktiv === k} zaehler={zaehler} />
          ),
        )}
      </nav>

      <div className="mt-auto grid gap-1 px-2.5">
        <RealtimePunkt className="py-1.5" />
        <div className="border-line flex items-center gap-2.5 border-t pt-2.5 pb-1">
          <Avatar member={member ? { display_name: member.display_name, email: member.email } : null} groesse={28} />
          <span className="min-w-0 leading-tight">
            <span className="truncate-1 text-ui block">{member?.display_name ?? '–'}</span>
            <span className="text-ink-3 block text-[11.5px]">{ALLGEMEIN.angemeldet}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              void abmelden(false).then(() => navigate(PFADE.anmelden, { replace: true }))
            }}
            className="text-ink-3 hover:text-ink ml-auto text-[12px]"
          >
            {ALLGEMEIN.abmelden}
          </button>
        </div>
        {/* Feedback mit Screenshot (⌥F): hier statt als schwebender Knopf über dem Inhalt (Runde 2: verdeckte Zeit-Chips, Deltas) */}
        <button
          type="button"
          data-tour="feedback"
          aria-label="Feedback geben (⌥F)"
          onClick={() => window.dispatchEvent(new Event(FEEDBACK_EVENT))}
          className="text-ink-3 hover:text-ink hover:bg-surface-hover -mx-1.5 flex items-center justify-between rounded-sm px-1.5 py-1 text-[12px]"
        >
          <span className="flex items-center gap-1.5">
            <MessageSquareWarning size={14} strokeWidth={1.75} aria-hidden />
            Feedback geben
          </span>
          <Kbd>⌥F</Kbd>
        </button>
        <div className="text-ink-3 flex items-center justify-between text-[12px]">
          <span>{ALLGEMEIN.tastenkuerzel}</span>
          <button
            type="button"
            onClick={() => setHilfeOffen(true)}
            className="hover:bg-surface-hover rounded-sm px-1.5 py-1"
            aria-label="Tastenkürzel anzeigen"
          >
            <Kbd>?</Kbd>
          </button>
        </div>
      </div>
    </aside>
  )
}

const OFFEN_KEY = 'crm.nav.offen'

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
  'group text-ui ease-brand hover:bg-surface-hover hover:text-ink relative flex h-[32px] w-full items-center gap-2.5 rounded-sm px-2.5 text-left transition-[background,color] duration-[var(--t-1)]'

function ZaehlerText({
  e,
  zaehler,
  aktiv,
}: {
  e: { zaehler?: NavEintrag['zaehler'] }
  zaehler: ReturnType<typeof useNavZaehler>
  aktiv: boolean
}) {
  const wert = e.zaehler ? zaehler[e.zaehler] : undefined
  if (wert === undefined || wert === 0) return null
  const faellig = e.zaehler === 'heute' && wert > 0
  return (
    <span
      className={cn(
        'tnum ml-auto font-mono text-[12px] group-hover:hidden',
        aktiv ? 'text-ink' : faellig ? 'text-signal' : 'text-ink-3',
      )}
    >
      {wert}
    </span>
  )
}

function Eintrag({
  e,
  aktiv,
  zaehler,
  eingerueckt,
}: {
  e: NavEintrag
  aktiv: boolean
  zaehler: ReturnType<typeof useNavZaehler>
  eingerueckt?: boolean
}) {
  return (
    <Link
      to={e.pfad}
      // Aktiv bestimmt aktiverEintrag (Query-Ansichten wie /leitfaeden?kanal=telefon), nicht NavLinks Pfadvergleich
      aria-current={aktiv ? 'page' : undefined}
      data-tour={`nav:${pfadOhneQuery(e.pfad)}`}
      className={cn(ZEILE, eingerueckt && 'pl-[34px]', aktiv ? 'bg-surface-pressed/70 text-ink-bright' : 'text-ink-2')}
    >
      {eingerueckt || !e.icon ? null : (
        <e.icon size={18} strokeWidth={1.75} aria-hidden className={aktiv ? 'text-ink' : 'text-ink-3'} />
      )}
      <span className="min-w-0 truncate">{e.label}</span>
      {e.pfad === '/einstellungen' ? (
        <Suspense fallback={null}>
          <EingangZahl aktiv={aktiv} />
        </Suspense>
      ) : null}
      <ZaehlerText e={e} zaehler={zaehler} aktiv={aktiv} />
      {e.akkord ? (
        <span className="ml-auto hidden group-hover:inline-flex">
          <Kbd akkord={e.akkord} />
        </span>
      ) : null}
    </Link>
  )
}

function Gruppe({
  gruppe,
  offen,
  onToggle,
  aktiv,
  zaehler,
}: {
  gruppe: NavGruppe
  offen: boolean
  onToggle: () => void
  aktiv: NavEintrag | null
  zaehler: ReturnType<typeof useNavZaehler>
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
        className={cn(ZEILE, enthaeltAktiv && !offen ? 'bg-surface-pressed/70 text-ink-bright' : 'text-ink-2')}
      >
        <gruppe.icon size={18} strokeWidth={1.75} aria-hidden className={enthaeltAktiv ? 'text-ink' : 'text-ink-3'} />
        <span className="min-w-0 truncate">{gruppe.label}</span>
        {/* Zugeklappt: Zähler der Gruppe (Anrufliste, Eingang) neben dem Pfeil */}
        <span className="ml-auto flex items-center gap-2 [&>span]:ml-0 [&>span]:group-hover:inline">
          {offen ? null : <ZaehlerText e={gruppe} zaehler={zaehler} aktiv={false} />}
          {!offen && gruppe.gruppe === 'mehr' ? (
            <Suspense fallback={null}>
              <EingangZahl aktiv={false} />
            </Suspense>
          ) : null}
          <ChevronRight
            size={14}
            strokeWidth={1.75}
            aria-hidden
            className={cn(
              'text-ink-3 ease-brand shrink-0 transition-transform duration-[var(--t-1)]',
              offen && 'rotate-90',
            )}
          />
        </span>
      </button>
      {offen ? (
        <div id={id} className="grid gap-0.5">
          {gruppe.kinder.map((e) => (
            <Eintrag key={e.pfad} e={e} aktiv={aktiv === e} zaehler={zaehler} eingerueckt />
          ))}
        </div>
      ) : null}
    </div>
  )
}
