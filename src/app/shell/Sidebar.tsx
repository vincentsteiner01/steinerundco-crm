import { MessageSquareWarning, Search } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router'
import { NAV } from '@/app/nav'
import { PFADE } from '@/app/pfade'
import { useUiStore } from '@/app/uiStore'
import { Avatar } from '@/components/ui/Avatar'
import { Kbd } from '@/components/ui/Kbd'
import { cn } from '@/components/ui/cn'
import { useNavZaehler } from '@/data/nav'
import { useAuth } from '@/features/auth/authStore'
import { FEEDBACK_EVENT } from '@/features/feedback/texte'
import { ALLGEMEIN } from '@/texte/de'
import { RealtimePunkt } from './RealtimePunkt'

/** DESIGN-SYSTEM § 4.1: Sidebar 232 px, canvas, Haarlinie rechts, padding 22 12 16; Marke · ⌘K-Trigger · Navigation + Zähler · Fuß (Ich, Abmelden, ?). */
export function Sidebar() {
  const navigate = useNavigate()
  const member = useAuth((s) => s.member)
  const abmelden = useAuth((s) => s.abmelden)
  const setPaletteOffen = useUiStore((s) => s.setPaletteOffen)
  const setHilfeOffen = useUiStore((s) => s.setHilfeOffen)
  const zaehler = useNavZaehler()

  return (
    <aside
      className="border-line bg-canvas sticky top-0 flex h-dvh flex-col border-r px-3 pt-[22px] pb-4"
      aria-label="Seitenleiste"
    >
      <NavLink to={PFADE.heute} className="flex items-baseline gap-2.5 px-2.5 pb-[18px]">
        <span className="text-ink-bright font-serif text-[26px] leading-none italic">Steiner &amp; Co.</span>
        <span className="label">CRM</span>
      </NavLink>

      <button
        type="button"
        onClick={() => setPaletteOffen(true)}
        className="border-line-strong text-ink-3 ease-brand hover:bg-surface-hover hover:text-ink mb-3.5 flex h-[34px] w-full items-center gap-2 rounded-sm border px-2.5 text-left text-[13px] transition-[color,background] duration-[var(--t-1)]"
      >
        <Search size={14} strokeWidth={1.75} aria-hidden />
        <span className="flex-1">{ALLGEMEIN.suchenOderBefehl}</span>
        <Kbd>⌘K</Kbd>
      </button>

      <nav className="grid gap-0.5" aria-label="Hauptnavigation">
        {NAV.map((n, i) =>
          n === 'trenner' ? (
            <hr key={`t${i}`} className="border-line my-2 border-0 border-t" />
          ) : (
            <NavLink
              key={n.pfad}
              to={n.pfad}
              data-tour={`nav:${n.pfad}`}
              className={({ isActive }) =>
                cn(
                  'group text-ui ease-brand hover:bg-surface-hover hover:text-ink relative flex h-[34px] items-center gap-2.5 rounded-sm px-2.5 transition-[background,color] duration-[var(--t-1)]',
                  isActive
                    ? 'bg-surface-hover text-ink before:bg-signal before:absolute before:top-2 before:bottom-2 before:-left-3 before:w-0.5 before:content-[""]'
                    : 'text-ink-2',
                )
              }
            >
              {({ isActive }) => {
                const wert = n.zaehler ? zaehler[n.zaehler] : undefined
                const faellig = n.zaehler === 'heute' && (wert ?? 0) > 0
                const text = n.zaehler === 'telefon' && zaehler.telefon > 0 ? `${zaehler.telefon}` : wert
                return (
                  <>
                    <n.icon size={18} strokeWidth={1.75} aria-hidden className="opacity-85" />
                    <span>{n.label}</span>
                    {text !== undefined && text !== 0 ? (
                      <span
                        className={cn(
                          'tnum ml-auto font-mono text-[12px] group-hover:hidden',
                          isActive ? 'text-ink' : faellig ? 'text-signal' : 'text-ink-3',
                        )}
                      >
                        {text}
                      </span>
                    ) : null}
                    <span className="ml-auto hidden group-hover:inline-flex">
                      <Kbd akkord={n.akkord} />
                    </span>
                  </>
                )
              }}
            </NavLink>
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
