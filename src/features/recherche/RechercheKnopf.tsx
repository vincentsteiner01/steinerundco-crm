// Blauer Play-Knopf unter der Suche (Seitenleiste und Icon-Rail, 29.10.2026, Vincent: „dass man das von da aus immer starten
// kann“). Startet einen Recherchelauf samt ChatGPT-Agent oder öffnet den laufenden – mit Fortschritt und „Freigabe nötig“, sobald
// der Agent auf eine Antwort wartet. Eigenes Chunk (Start-Bundle-Budget); Start-Hook und Beschriftung in start.ts.
import { Loader2, Play } from 'lucide-react'
import { cn } from '@/components/ui/cn'
import { knopfText, useRechercheOeffnen } from './start'

export function RechercheKnopf({ kompakt = false }: { kompakt?: boolean }) {
  const { aktiv, los, busy } = useRechercheOeffnen()
  const text = knopfText(aktiv)
  const frage = aktiv?.status === 'laeuft' && aktiv.agent_status === 'frage'
  const Icon = busy ? Loader2 : Play
  const icon = <Icon size={14} strokeWidth={2} className={cn('shrink-0', busy && 'animate-spin')} aria-hidden />
  const punkt = frage ? (
    <span className="bg-signal-ink size-1.5 shrink-0 animate-pulse rounded-full" aria-hidden data-freigabe />
  ) : null
  const klasse =
    'bg-signal text-signal-ink hover:bg-signal-hover ease-brand mb-3.5 h-[34px] w-full rounded-sm text-[13px] font-semibold transition-colors duration-[var(--t-1)] disabled:opacity-80'

  // Icon-Rail: Beschriftung als title statt Radix-Tooltip – sonst zieht das Chunk Tooltip-Code ins Start-Bundle
  if (kompakt)
    return (
      <button
        type="button"
        onClick={los}
        disabled={busy}
        aria-label={text}
        title={text}
        data-tour="recherche-play"
        className={cn(klasse, 'relative grid place-items-center')}
      >
        {icon}
        {punkt ? <span className="absolute top-1.5 right-1.5 flex">{punkt}</span> : null}
      </button>
    )
  return (
    <button
      type="button"
      onClick={los}
      disabled={busy}
      data-tour="recherche-play"
      className={cn(klasse, 'flex items-center gap-2 px-2.5 text-left')}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{text}</span>
      {punkt}
    </button>
  )
}
