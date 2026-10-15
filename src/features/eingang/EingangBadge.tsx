// Eingang-Badge (für Heute und Sidebar, über public.ts): Anzahl offener LinkedIn-Mails (neu · unbekannt · fehler) beider
// Personen; Klick öffnet Einstellungen → Verbindungen → Eingang. Bei 0 rendert es nichts. Lime = heute zu tun (DESIGN-SYSTEM § 3.2).
import { Link } from 'react-router'
import { cn } from '@/components/ui'
import { useEingangLive, useEingangOffenAnzahl } from './daten'

export const EINGANG_PFAD = '/einstellungen/verbindungen?tab=eingang'

export type EingangBadgeProps = {
  /** `kompakt`: nur die Zahl (Sidebar-Zähler); sonst „Eingang 3 zuordnen“ (Heute). */
  kompakt?: boolean
  className?: string
}

export function EingangBadge({ kompakt, className }: EingangBadgeProps) {
  useEingangLive()
  const { data: n } = useEingangOffenAnzahl()
  if (!n) return null
  const titel = n === 1 ? '1 LinkedIn-Mail wartet im Eingang' : `${n} LinkedIn-Mails warten im Eingang`
  return (
    <Link
      to={EINGANG_PFAD}
      title={titel}
      aria-label={titel}
      className={cn(
        'border-signal/24 bg-signal-tint text-signal tnum inline-flex h-[22px] items-center gap-1.5 rounded-xs border px-2 text-[12px] leading-none font-medium whitespace-nowrap',
        'ease-brand hover:bg-surface-hover transition-[background] duration-[var(--t-1)]',
        className,
      )}
    >
      {kompakt ? null : <span>Eingang</span>}
      <span className="font-mono">{n}</span>
      {kompakt ? null : <span>zuordnen</span>}
    </Link>
  )
}
