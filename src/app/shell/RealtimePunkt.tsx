import { useUiStore } from '@/app/uiStore'
import { cn } from '@/components/ui/cn'
import { ALLGEMEIN } from '@/texte/de'

/** 6-px-Punkt „live“/„getrennt“ (DESIGN-SYSTEM § 5.4; Präsenz-Cyan ist v1.1 – hier ink). */
export function RealtimePunkt({ className }: { className?: string }) {
  const realtime = useUiStore((s) => s.realtime)
  const live = realtime === 'live'
  return (
    <span
      className={cn('text-small text-ink-3 inline-flex items-center gap-2', className)}
      title={live ? 'Realtime verbunden' : 'Realtime getrennt – supabase-js verbindet neu'}
      role="status"
    >
      <i
        aria-hidden
        className={cn(
          'h-1.5 w-1.5 flex-none rounded-full',
          live ? 'bg-ink-2' : 'border-line-strong border bg-transparent',
        )}
      />
      <span>{live ? ALLGEMEIN.live : ALLGEMEIN.getrennt}</span>
    </span>
  )
}
