import { MoreHorizontal } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { aktiverTab, MEHR_LEISTE, TAB_LEISTE } from '@/app/nav'
import { cn } from '@/components/ui/cn'
import { ALLGEMEIN } from '@/texte/de'

const tabKlasse = (aktiv: boolean) =>
  cn(
    'text-small relative flex flex-col items-center justify-center gap-0.5 font-medium',
    aktiv
      ? 'text-signal' // wie iOS: aktives Symbol + Beschriftung im Akzent, kein Balken (helles Design, 20.10.2026)
      : 'text-ink-3',
  )

/**
 * < 768 px: Tab-Leiste unten 56 px + safe-area (§ 1.5 Nr. 22). Neustart 25.11.2026: Leads · Leitfäden · E-Mail · Mehr; „Mehr“
 * öffnet Team · Einstellungen · Hilfe. Der E-Mail-Tab ist auf allen /email-Seiten aktiv (`bereich`).
 * Bewusst ohne Radix-Dropdown: die Leiste liegt im initialen Bundle (E22, PhoneTopbar lädt Radix erst unter 768 px).
 */
export function TabLeiste() {
  const { pathname } = useLocation()
  // Offen „auf“ einem Pfad: ein Seitenwechsel schließt das Menü ohne Effekt
  const [offenAuf, setOffenAuf] = useState<string | null>(null)
  const offen = offenAuf === pathname
  const setOffen = (o: boolean) => setOffenAuf(o ? pathname : null)
  const menuId = useId()
  const knopf = useRef<HTMLButtonElement | null>(null)
  const menu = useRef<HTMLDivElement | null>(null)
  const aktiv = aktiverTab(pathname)
  const mehrAktiv = aktiverTab(pathname, MEHR_LEISTE)

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
      className="border-line bg-canvas/90 fixed inset-x-0 bottom-0 z-50 grid h-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom))] grid-cols-4 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
    >
      {TAB_LEISTE.map((t) => (
        <Link
          key={t.pfad}
          to={t.pfad}
          aria-current={aktiv === t ? 'page' : undefined}
          className={tabKlasse(aktiv === t)}
        >
          <t.icon size={20} strokeWidth={1.75} aria-hidden />
          {t.label}
        </Link>
      ))}
      <button
        ref={knopf}
        type="button"
        aria-haspopup="menu"
        aria-expanded={offen}
        aria-controls={offen ? menuId : undefined}
        aria-current={mehrAktiv ? 'page' : undefined}
        className={tabKlasse(!!mehrAktiv || offen)}
        onClick={() => setOffen(!offen)}
      >
        <MoreHorizontal size={20} strokeWidth={1.75} aria-hidden />
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
              <Link
                key={e.pfad}
                to={e.pfad}
                role="menuitem"
                onClick={() => setOffen(false)}
                className={cn(
                  'text-ui hover:bg-surface-hover flex h-11 items-center gap-3 rounded-sm px-3',
                  mehrAktiv === e ? 'text-ink font-medium' : 'text-ink-2',
                )}
              >
                <e.icon size={18} strokeWidth={1.75} aria-hidden />
                {e.label}
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </nav>
  )
}
