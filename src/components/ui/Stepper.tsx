import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from './cn'

export type StepperProps = {
  wert: number
  ziel?: number
  manuell?: boolean
  onDelta: (n: number) => void
  onSetzen: (n: number) => void
  fuss?: ReactNode
  label?: string
  className?: string
}

/** Tageszähler (DESIGN-SYSTEM § 5.2): Zahl display 40 px + ✎ wenn manuell, Knöpfe −1 +1 +5 +10 (S, Mono 12,5), Zahlenfeld 72 px, Ziel „/ 30“ ink-3, Tick 200 ms. */
export function Stepper({
  wert,
  ziel,
  manuell,
  onDelta,
  onSetzen,
  fuss,
  label = 'Vernetzungen versendet',
  className,
}: StepperProps) {
  const [tick, setTick] = useState(0)
  const [eingabe, setEingabe] = useState(String(wert))
  const vorher = useRef(wert)
  const verwerfen = useRef(false)
  useEffect(() => {
    if (vorher.current !== wert) {
      vorher.current = wert
      setTick((t) => t + 1)
      setEingabe(String(wert))
    }
  }, [wert])

  const knopf = (n: number) => (
    <button
      key={n}
      type="button"
      onClick={() => onDelta(n)}
      className="border-line-strong tnum ease-brand hover:bg-surface-hover inline-flex h-7 items-center rounded-sm border px-2.5 font-mono text-[12.5px] transition-[background] duration-[var(--t-1)]"
    >
      {n > 0 ? `+${n}` : `−${Math.abs(n)}`}
    </button>
  )

  return (
    <div className={cn('border-line-strong bg-surface rounded-md border px-5 pt-[18px] pb-4', className)}>
      <span className="label block">{label}</span>
      <div className="my-2 mb-3 flex items-baseline gap-2">
        <span key={tick} className={cn('display', tick > 0 && 'animate-tick')} aria-live="polite">
          {wert}
        </span>
        {ziel !== undefined ? <span className="text-ink-3 tnum font-mono text-[16px]">/ {ziel}</span> : null}
        {manuell ? (
          <span
            className="text-ink-3 ml-auto font-mono text-[12px] tracking-[0.02em]"
            title="Zähler, teilweise manuell"
          >
            ✎ manuell
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {[-1, 1, 5, 10].map(knopf)}
        <div className="border-line-strong bg-surface-hover focus-within:border-signal flex h-7 w-[72px] items-center rounded-sm border px-2">
          <input
            aria-label="Zähler setzen"
            inputMode="numeric"
            className="tnum w-full bg-transparent text-right font-mono text-[12.5px] outline-none"
            value={eingabe}
            onChange={(e) => setEingabe(e.target.value.replace(/[^\d]/g, ''))}
            onBlur={() => {
              const n = Number.parseInt(eingabe, 10)
              if (!verwerfen.current && Number.isFinite(n) && n !== wert) onSetzen(Math.max(0, n))
              else setEingabe(String(wert))
              verwerfen.current = false
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur()
              if (e.key === 'Escape') {
                // Esc verwirft die Eingabe (kein onSetzen) und verlässt das Feld; preventDefault hält useHotkeys fern
                // (FOUNDATION-WUNSCH M1: vorher übernahm der Blur aus keyboard.ts den getippten Wert).
                e.preventDefault()
                verwerfen.current = true
                setEingabe(String(wert))
                e.currentTarget.blur()
              }
            }}
          />
        </div>
      </div>
      {fuss ? <div className="text-small text-ink-3 mt-3 leading-normal">{fuss}</div> : null}
    </div>
  )
}
