// Erledigt-Zeile (DESIGN-SYSTEM § 5.7 „done“/„später“): 36 px, Mono 12 ink-3, 2-px-Sage-Rand links, „Erledigt · Kurzfristig 3 am
// Sa 24.10.“, rechts „Rückgängig Z“ solange das 6-s-Fenster läuft; danach bleibt die Zeile als Tageslog bis zum Neuladen.
// Variante „fremd“: „Schon erledigt von Mike um 10:41“ (Realtime, 4 s).
import { useUiStore } from '@/app/uiStore'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { undoAusfuehren } from '@/components/toast'

export type ErledigtZeileProps = {
  art: 'erledigt' | 'spaeter' | 'fremd'
  text: string
  name?: string | null
  activityId?: number | null
  className?: string
}

export function ErledigtZeile({ art, text, name, activityId, className }: ErledigtZeileProps) {
  const undoOffen = useUiStore((s) => !!activityId && s.letzterUndo?.activityId === activityId)
  return (
    <div
      role="status"
      data-erledigt={art}
      className={cn(
        'border-line text-ink-3 tnum relative flex h-9 items-center gap-2.5 overflow-hidden rounded-md border pr-3.5 pl-[18px] font-mono text-[12px] tracking-[0.02em]',
        "before:absolute before:top-2 before:bottom-2 before:-left-px before:w-0.5 before:content-['']",
        art === 'erledigt' ? 'before:bg-done' : 'before:bg-line-strong',
        className,
      )}
    >
      <span className={cn('flex-none', art === 'erledigt' ? 'text-done' : 'text-ink-2')}>
        {art === 'erledigt' ? 'Erledigt' : art === 'spaeter' ? 'Später' : 'Schon erledigt'}
      </span>
      <span className="truncate-1 min-w-0 flex-1">
        {name ? <span className="text-ink-2">{name} · </span> : null}
        {text}
      </span>
      {undoOffen ? (
        <Button variante="secondary" groesse="S" kbd="Z" onClick={() => void undoAusfuehren()} className="ml-auto">
          Rückgängig
        </Button>
      ) : null}
    </div>
  )
}
