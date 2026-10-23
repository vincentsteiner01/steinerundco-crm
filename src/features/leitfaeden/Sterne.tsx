// 1–3 Sterne wie in Mikes Sales Hub (23.10.2026). Klick setzt die Bewertung, Klick auf den gesetzten Stern nimmt sie zurück.
import { Star } from 'lucide-react'
import { cn } from '@/components/ui/cn'
import { BEWERTUNG_TEXT } from './kategorien'

export function Sterne({
  wert,
  onChange,
  groesse = 18,
  mitText = true,
}: {
  wert: number | null | undefined
  onChange?: (w: number | null) => void
  groesse?: number
  mitText?: boolean
}) {
  return (
    <span className="inline-flex items-center gap-2" data-bewertung={wert ?? 0}>
      <span className="inline-flex items-center gap-0.5" role={onChange ? 'group' : undefined} aria-label="Bewertung">
        {[1, 2, 3].map((n) => {
          const an = (wert ?? 0) >= n
          const stern = (
            <Star
              size={groesse}
              strokeWidth={1.5}
              aria-hidden
              className={cn(an ? 'fill-[#e8a33d] text-[#e8a33d]' : 'text-ink-3/70')}
            />
          )
          return onChange ? (
            <button
              key={n}
              type="button"
              aria-label={`${n} von 3 Sternen`}
              aria-pressed={wert === n}
              onClick={(e) => {
                e.stopPropagation()
                onChange(wert === n ? null : n)
              }}
              className="hover:bg-surface-hover rounded-xs p-0.5"
            >
              {stern}
            </button>
          ) : (
            <span key={n} className="p-0.5">
              {stern}
            </span>
          )
        })}
      </span>
      {mitText ? <span className="text-ink-3 text-[12px]">{BEWERTUNG_TEXT(wert)}</span> : null}
    </span>
  )
}
