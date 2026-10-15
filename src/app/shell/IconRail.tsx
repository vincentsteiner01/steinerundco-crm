import { Search } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router'
import { NAV } from '@/app/nav'
import { PFADE } from '@/app/pfade'
import { useUiStore } from '@/app/uiStore'
import { Avatar } from '@/components/ui/Avatar'
import { Kbd } from '@/components/ui/Kbd'
import { Tooltip } from '@/components/ui/Tooltip'
import { cn } from '@/components/ui/cn'
import { useNavZaehler } from '@/data/nav'
import { useAuth } from '@/features/auth/authStore'
import { ALLGEMEIN } from '@/texte/de'

/** 768–1023 px: Sidebar als Icon-Rail 64 px (Tooltips mit Label + G-Akkord). */
export function IconRail() {
  const navigate = useNavigate()
  const member = useAuth((s) => s.member)
  const abmelden = useAuth((s) => s.abmelden)
  const setPaletteOffen = useUiStore((s) => s.setPaletteOffen)
  const zaehler = useNavZaehler()
  return (
    <aside
      className="border-line bg-canvas sticky top-0 flex h-dvh w-16 flex-col items-center border-r px-2.5 pt-[18px] pb-3.5"
      aria-label="Seitenleiste"
    >
      <NavLink
        to={PFADE.heute}
        className="text-ink-bright pb-[18px] font-serif text-[22px] leading-none italic"
        aria-label="Steiner & Co. – Heute"
      >
        S&amp;
      </NavLink>
      <Tooltip
        text={
          <span className="inline-flex items-center gap-2">
            Suchen oder Befehl <Kbd>⌘K</Kbd>
          </span>
        }
        side="right"
      >
        <button
          type="button"
          onClick={() => setPaletteOffen(true)}
          aria-label={ALLGEMEIN.suchenOderBefehl}
          className="border-line-strong text-ink-3 hover:bg-surface-hover hover:text-ink mb-3.5 grid h-[34px] w-full place-items-center rounded-sm border"
        >
          <Search size={14} strokeWidth={1.75} aria-hidden />
        </button>
      </Tooltip>
      <nav className="grid w-full gap-0.5" aria-label="Hauptnavigation">
        {NAV.map((n, i) =>
          n === 'trenner' ? (
            <hr key={`t${i}`} className="border-line my-2 border-0 border-t" />
          ) : (
            <Tooltip
              key={n.pfad}
              side="right"
              text={
                <span className="inline-flex items-center gap-2">
                  {n.label} <Kbd akkord={n.akkord} />
                </span>
              }
            >
              <NavLink
                to={n.pfad}
                aria-label={n.label}
                className={({ isActive }) =>
                  cn(
                    'ease-brand hover:bg-surface-hover hover:text-ink relative grid h-[34px] place-items-center rounded-sm transition-[background,color] duration-[var(--t-1)]',
                    isActive
                      ? 'bg-surface-hover text-ink before:bg-signal before:absolute before:top-2 before:bottom-2 before:-left-2.5 before:w-0.5 before:content-[""]'
                      : 'text-ink-2',
                  )
                }
              >
                <n.icon size={18} strokeWidth={1.75} aria-hidden />
                {n.zaehler === 'heute' && zaehler.heute > 0 ? (
                  <span className="text-signal tnum absolute top-1 right-1 font-mono text-[9px]">{zaehler.heute}</span>
                ) : null}
              </NavLink>
            </Tooltip>
          ),
        )}
      </nav>
      <div className="mt-auto grid justify-items-center gap-2">
        <Tooltip text={ALLGEMEIN.abmelden} side="right">
          <button
            type="button"
            aria-label={ALLGEMEIN.abmelden}
            onClick={() => void abmelden(false).then(() => navigate(PFADE.anmelden, { replace: true }))}
          >
            <Avatar member={member ? { display_name: member.display_name, email: member.email } : null} groesse={28} />
          </button>
        </Tooltip>
      </div>
    </aside>
  )
}
