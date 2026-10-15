import { MoreHorizontal } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { NavLink, useLocation } from 'react-router'
import { MEHR_LEISTE, TAB_LEISTE } from '@/app/nav'
import { cn } from '@/components/ui/cn'
import { useNavZaehler } from '@/data/nav'
import { ALLGEMEIN } from '@/texte/de'

const tabKlasse = (aktiv: boolean) =>
  cn(
    'relative flex flex-col items-center justify-center gap-1 text-[11px] font-medium',
    aktiv
      ? 'text-ink before:absolute before:-top-px before:left-[30%] before:right-[30%] before:h-0.5 before:bg-signal before:content-[""]'
      : 'text-ink-3',
  )

/**
 * < 768 px: Tab-Leiste unten 56 px + safe-area (§ 1.5 Nr. 22): Heute · Leads · Telefon · KPIs · Mehr. „Mehr“ öffnet ein Menü mit
 * Pipeline · E-Mail · Leitfäden · Schnellimport · Einstellungen (ux § 7.1; vorher nur ein Link auf Einstellungen – Review).
 * Bewusst ohne Radix-Dropdown: die Leiste liegt im initialen Bundle (E22, PhoneTopbar lädt Radix erst unter 768 px).
 */
export function TabLeiste() {
  const zaehler = useNavZaehler()
  const { pathname } = useLocation()
  // Offen „auf“ einem Pfad: ein Seitenwechsel schließt das Menü ohne Effekt
  const [offenAuf, setOffenAuf] = useState<string | null>(null)
  const offen = offenAuf === pathname
  const setOffen = (o: boolean) => setOffenAuf(o ? pathname : null)
  const menuId = useId()
  const knopf = useRef<HTMLButtonElement | null>(null)
  const menu = useRef<HTMLDivElement | null>(null)
  const mehrAktiv = MEHR_LEISTE.some((e) => pathname.startsWith(e.bereich))

  useEffect(() => {
    if (offen) menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
  }, [offen])

  const tasten = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setOffen(false)
      knopf.current?.focus()
      return
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const eintraege = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
    const i = eintraege.indexOf(document.activeElement as HTMLElement)
    const n = eintraege.length
    eintraege[(i + (e.key === 'ArrowDown' ? 1 : -1) + n) % n]?.focus()
  }

  return (
    <nav
      aria-label="Navigation"
      className="border-line bg-canvas fixed inset-x-0 bottom-0 z-50 grid h-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom))] grid-cols-5 border-t pb-[env(safe-area-inset-bottom)]"
    >
      {TAB_LEISTE.map((t) => (
        <NavLink key={t.pfad} to={t.pfad} data-tour={`nav:${t.pfad}`} className={({ isActive }) => tabKlasse(isActive)}>
          <t.icon size={18} strokeWidth={1.75} aria-hidden />
          {t.label}
          {t.zaehler && zaehler[t.zaehler] > 0 ? (
            <span className="text-signal tnum absolute top-2 right-[calc(50%-22px)] font-mono text-[10px]">
              {zaehler[t.zaehler]}
            </span>
          ) : null}
        </NavLink>
      ))}
      <button
        ref={knopf}
        type="button"
        aria-haspopup="menu"
        aria-expanded={offen}
        aria-controls={offen ? menuId : undefined}
        aria-current={mehrAktiv ? 'page' : undefined}
        className={tabKlasse(mehrAktiv || offen)}
        onClick={() => setOffen(!offen)}
      >
        <MoreHorizontal size={18} strokeWidth={1.75} aria-hidden />
        {ALLGEMEIN.mehr}
      </button>
      {offen ? (
        <>
          <div className="fixed inset-0 z-40" aria-hidden onClick={() => setOffen(false)} />
          <div
            ref={menu}
            id={menuId}
            role="menu"
            aria-label={ALLGEMEIN.mehr}
            onKeyDown={tasten}
            className="bg-surface-raised border-line shadow-float fixed right-2 bottom-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom)+8px)] z-50 grid min-w-[220px] rounded-md border p-1.5"
          >
            {MEHR_LEISTE.map((e) => (
              <NavLink
                key={e.pfad}
                to={e.pfad}
                data-tour={`nav:${e.pfad}`}
                role="menuitem"
                onClick={() => setOffen(false)}
                className={() =>
                  cn(
                    'text-ui hover:bg-surface-hover flex h-11 items-center gap-3 rounded-sm px-3',
                    pathname.startsWith(e.bereich) ? 'text-ink font-medium' : 'text-ink-2',
                  )
                }
              >
                <e.icon size={18} strokeWidth={1.75} aria-hidden />
                {e.label}
              </NavLink>
            ))}
          </div>
        </>
      ) : null}
    </nav>
  )
}
