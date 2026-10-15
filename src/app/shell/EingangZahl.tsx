// Sidebar-Zähler am Eintrag „Einstellungen“ (Runde 3, Wunsch verbindungen.md Nr. 1): offene LinkedIn-Mails im Eingang beider
// Personen. Nur die Zahl (kein Link – der Eintrag selbst ist schon ein Link, ein <a> im <a> wäre ungültig). Lazy aus Sidebar.tsx
// geladen, damit Eingang-Daten und Realtime-Kanal nicht im Start-Bundle landen (E22, 220 kB).
import { cn } from '@/components/ui/cn'
import { useEingangLive, useEingangOffenAnzahl } from '@/features/eingang/public'

export function EingangZahl({ aktiv }: { aktiv: boolean }) {
  useEingangLive()
  const { data: n } = useEingangOffenAnzahl()
  if (!n) return null
  return (
    <span
      title={n === 1 ? '1 LinkedIn-Mail wartet im Eingang' : `${n} LinkedIn-Mails warten im Eingang`}
      className={cn('tnum ml-auto font-mono text-[12px] group-hover:hidden', aktiv ? 'text-ink' : 'text-signal')}
    >
      {n}
    </span>
  )
}
