import { LogOut } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router'
import { aktiverRailPfad, NAV } from '@/app/nav'
import { PFADE } from '@/app/pfade'
import { Avatar } from '@/components/ui/Avatar'
import { Marke } from '@/components/ui/Marke'
import { Tooltip } from '@/components/ui/Tooltip'
import { cn } from '@/components/ui/cn'
import { useAuth } from '@/features/auth/authStore'
import { ALLGEMEIN } from '@/texte/de'

/** 768–1023 px: Sidebar als Icon-Rail 64 px – dieselben sechs Punkte als Ikonen (Tooltip nennt den Namen), unten Person und Abmelden. */
export function IconRail() {
  const navigate = useNavigate()
  const member = useAuth((s) => s.member)
  const abmelden = useAuth((s) => s.abmelden)
  const { pathname } = useLocation()
  // E-Mail steht als eine Ikone mit dem Pfad ihrer ersten Seite – aktiv für jede E-Mail-Seite
  const aktivPfad = aktiverRailPfad(pathname)
  return (
    <aside
      className="border-line bg-sidebar sticky top-0 flex h-dvh w-16 flex-col items-center border-r px-2.5 pt-[18px] pb-3.5"
      aria-label="Seitenleiste"
    >
      <Link to={PFADE.leads} className="pb-5" aria-label="Steiner & Co. – Leads">
        <Marke nurSymbol groesse="l" />
      </Link>
      <nav className="grid w-full gap-1" aria-label="Hauptnavigation">
        {NAV.map((n, i) =>
          n === 'trenner' ? (
            <hr key={`t${i}`} className="border-line my-2 border-0 border-t" />
          ) : (
            <Tooltip key={n.pfad} side="right" text={n.label}>
              <Link
                to={n.pfad}
                aria-label={n.label}
                aria-current={aktivPfad === n.pfad ? 'page' : undefined}
                // aria-current aus aktiverRailPfad (Gruppe E-Mail) – NavLink setzte es nur bei eigenem Pfadtreffer.
                // Fester String statt className-Funktion: der Tooltip-Trigger (Radix Slot) verkettet className als Text –
                // die Funktion landete als Quelltext im DOM und gab JEDEM Eintrag den Aktiv-Balken (Runde 2, 900 px).
                className={cn(
                  'ease-brand hover:bg-surface-hover hover:text-ink text-ink-2 relative grid h-10 place-items-center rounded-sm transition-[background,color] duration-[var(--t-1)]',
                  'aria-[current=page]:bg-surface-pressed/70 aria-[current=page]:text-ink-bright',
                  'aria-[current=page]:before:bg-signal aria-[current=page]:before:absolute aria-[current=page]:before:top-2 aria-[current=page]:before:bottom-2 aria-[current=page]:before:-left-2.5 aria-[current=page]:before:w-0.5 aria-[current=page]:before:content-[""]',
                )}
              >
                {n.icon ? <n.icon size={20} strokeWidth={1.75} aria-hidden /> : null}
              </Link>
            </Tooltip>
          ),
        )}
      </nav>
      <div className="mt-auto grid justify-items-center gap-2">
        <Avatar member={member ? { display_name: member.display_name, email: member.email } : null} groesse={28} />
        <Tooltip text={ALLGEMEIN.abmelden} side="right">
          <button
            type="button"
            aria-label={ALLGEMEIN.abmelden}
            onClick={() => void abmelden(false).then(() => navigate(PFADE.anmelden, { replace: true }))}
            className="text-ink-2 hover:bg-surface-hover hover:text-ink grid h-10 w-10 place-items-center rounded-sm"
          >
            <LogOut size={18} strokeWidth={1.75} aria-hidden />
          </button>
        </Tooltip>
      </div>
    </aside>
  )
}
