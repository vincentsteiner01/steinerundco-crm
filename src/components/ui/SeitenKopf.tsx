import { useEffect, useRef, useState, type ReactNode } from 'react'
import { dateline } from '@/lib/format'
import { cn } from './cn'

export type SeitenKopfProps = {
  titel: string
  /** Text hinter dem zweiten Punkt der Dateline („Vincent“, „alle“, „LinkedIn · 4 Phasen“) */
  kontext?: string
  /** Die eine Voice-Zeile unter der Headline („Guten Morgen, Vincent.“) */
  voice?: string
  rechts?: ReactNode
  className?: string
  /** Dateline komplett ersetzen (KPIs: „LinkedIn · Vincent · 01.–14.10.2026 · Stand 09:41“) */
  dateline?: string
  /** Navigation um die Headline („← Oktober 2026 →“, DESIGN-SYSTEM § 5.15 monthnav) – FOUNDATION-WUNSCH M5 */
  titelLinks?: ReactNode
  titelRechts?: ReactNode
}

/**
 * DESIGN-SYSTEM § 4.1/§ 5.5: sticky top 0, canvas, padding 28 0 20, margin-bottom 24, `is-stuck` (IntersectionObserver auf einem
 * Sentinel davor) setzt die Haarlinie; Höhe wird in `--head-h` geschrieben, damit Tabellenköpfe darunter kleben.
 * Dateline automatisch: „Mittwoch, 14. Oktober 2026 · KW 42 · <kontext>“.
 */
export function SeitenKopf({
  titel,
  kontext,
  voice,
  rechts,
  className,
  dateline: eigeneDateline,
  titelLinks,
  titelRechts,
}: SeitenKopfProps) {
  const sentinel = useRef<HTMLDivElement | null>(null)
  const kopf = useRef<HTMLElement | null>(null)
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    const s = sentinel.current
    if (!s || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setStuck(e ? !e.isIntersecting : false), { threshold: 0 })
    io.observe(s)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const k = kopf.current
    if (!k) return
    const schreibe = () => document.documentElement.style.setProperty('--head-h', `${k.offsetHeight}px`)
    schreibe()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(schreibe)
    ro.observe(k)
    return () => ro.disconnect()
  }, [])

  const dl = eigeneDateline ?? `${dateline()}${kontext ? ` · ${kontext}` : ''}`

  return (
    <>
      <div ref={sentinel} aria-hidden className="h-px" />
      <header
        ref={kopf}
        className={cn(
          'bg-canvas sticky top-0 z-20 mb-6 flex flex-wrap items-end justify-between gap-6 border-b pt-7 pb-5 max-md:mb-[18px] max-md:pt-5 max-md:pb-4',
          'ease-brand transition-[border-color] duration-[var(--t-1)]',
          stuck ? 'is-stuck border-line' : 'border-transparent',
          className,
        )}
      >
        <div className="min-w-0">
          <span className="text-ink-3 tnum mb-2.5 block font-mono text-[12.5px] tracking-[0.02em]">{dl}</span>
          {titelLinks || titelRechts ? (
            <div className="flex items-center gap-3">
              {titelLinks}
              <h1 className="headline">{titel}</h1>
              {titelRechts}
            </div>
          ) : (
            <h1 className="headline">{titel}</h1>
          )}
          {voice ? <p className="voice mt-2">{voice}</p> : null}
        </div>
        {rechts ? <div className="flex flex-wrap items-center gap-2.5">{rechts}</div> : null}
      </header>
    </>
  )
}

/** Stats rechts im Seitenkopf: Mono 13 ink-2, Zahlen 16 px 500 ink-bright; fällig Lime, überfällig Amber. */
export function KopfStats({
  eintraege,
}: {
  eintraege: { wert: number | string; label: string; ton?: 'signal' | 'overdue' }[]
}) {
  return (
    <div className="text-ink-2 tnum flex items-baseline gap-5 font-mono text-[13px] max-md:max-w-full max-md:gap-3.5 max-md:overflow-auto max-md:text-[12px]">
      {eintraege.map((e) => (
        <span key={e.label} className="whitespace-nowrap">
          <b
            className={cn(
              'text-[16px] font-medium max-md:text-[15px]',
              e.ton === 'signal' ? 'text-signal' : e.ton === 'overdue' ? 'text-overdue' : 'text-ink-bright',
            )}
          >
            {e.wert}
          </b>{' '}
          {e.label}
        </span>
      ))}
    </div>
  )
}
