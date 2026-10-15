import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { dateline, datelineKurz } from '@/lib/format'
import { cn } from './cn'

/** Höhe der Phone-Topbar (DESIGN-SYSTEM § 4.2) – Ersatz für `--head-h`, wenn der Seitenkopf nicht klebt. */
const TOPBAR_PHONE = 56

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

  // Runde 2 (echte Daten): eingerastet war der Kopf 149 px (1440) bzw. 196 px (1024) hoch – Dateline, Voice und umgebrochene
  // Stats blieben stehen, DESIGN-SYSTEM § 4.1 sieht 92 px vor. Eingerastet zeigt er nur noch Titel (24 px) und Stats in einer Zeile
  // (unter 1280 px ohne Stats). `ausgleich` hält den Fluss stabil: der Inhalt darunter springt beim Einrasten nicht nach oben.
  const vollHoehe = useRef(0)
  const [ausgleich, setAusgleich] = useState(0)
  useEffect(() => {
    const k = kopf.current
    if (!k) return
    // Unter 768 px klebt der Kopf nicht (er läge unter der Phone-Topbar und fräße ein Viertel des Bildschirms) –
    // dann kleben Tabellenköpfe direkt unter der 56-px-Topbar.
    const schreibe = () => {
      const klebt = getComputedStyle(k).position === 'sticky'
      document.documentElement.style.setProperty('--head-h', `${klebt ? k.offsetHeight : TOPBAR_PHONE}px`)
      if (!k.classList.contains('is-stuck')) vollHoehe.current = k.offsetHeight
      setAusgleich(klebt && k.classList.contains('is-stuck') ? Math.max(0, vollHoehe.current - k.offsetHeight) : 0)
    }
    schreibe()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(schreibe)
    ro.observe(k)
    return () => ro.disconnect()
  }, [])
  // Beim Einrasten vor dem Zeichnen ausgleichen (sonst springt der Inhalt für einen Frame nach oben)
  useLayoutEffect(() => {
    const k = kopf.current
    if (!k) return
    const klebt = getComputedStyle(k).position === 'sticky'
    setAusgleich(stuck && klebt && vollHoehe.current ? Math.max(0, vollHoehe.current - k.offsetHeight) : 0)
  }, [stuck])

  const dl = eigeneDateline ?? `${dateline()}${kontext ? ` · ${kontext}` : ''}`
  // Automatische Dateline: unter 768 px mit kurzem Datum („Do 15.10. · KW 42“), sonst wurde der Kontext zu „Handbu…“ (Runde 2)
  const inhalt = eigeneDateline ?? (
    <>
      <span className="max-md:hidden">{dateline()}</span>
      <span className="md:hidden">{datelineKurz()}</span>
      {kontext ? ` · ${kontext}` : ''}
    </>
  )

  return (
    <>
      <div ref={sentinel} aria-hidden className="h-px" />
      <header
        ref={kopf}
        data-seitenkopf
        style={ausgleich ? { marginBottom: 24 + ausgleich } : undefined}
        className={cn(
          'bg-canvas sticky top-0 z-20 mb-6 flex flex-wrap items-end justify-between gap-6 border-b pt-7 pb-5',
          'max-md:static max-md:mb-[18px] max-md:gap-4 max-md:pt-5 max-md:pb-4',
          'ease-brand transition-[border-color] duration-[var(--t-1)]',
          stuck ? 'is-stuck border-line md:flex-nowrap md:items-center md:pt-3.5 md:pb-3' : 'border-transparent',
          className,
        )}
      >
        {/* Eingerastet: Titel schrumpft nicht und bricht nicht um – sonst stand bei /kpis 1440 „Oktober / 2026“ zweizeilig
            zwischen ← und → (Runde 3); zu breite Werkzeuge rechts scrollen dann quer statt den Titel zu quetschen */}
        <div className={cn('max-w-full min-w-0', stuck && 'md:shrink-0')}>
          <span
            className={cn(
              'text-ink-3 tnum mb-2.5 block truncate font-mono text-[12.5px] tracking-[0.02em]',
              stuck && 'md:hidden',
            )}
            title={dl}
          >
            {inhalt}
          </span>
          {titelLinks || titelRechts ? (
            <div className="flex items-center gap-3">
              {titelLinks}
              <h1 className={cn('headline', stuck && 'md:text-[24px] md:leading-[1.2] md:whitespace-nowrap')}>
                {titel}
              </h1>
              {titelRechts}
            </div>
          ) : (
            <h1 className={cn('headline', stuck && 'md:text-[24px] md:leading-[1.2] md:whitespace-nowrap')}>{titel}</h1>
          )}
          {voice ? <p className={cn('voice mt-2', stuck && 'md:hidden')}>{voice}</p> : null}
        </div>
        {/* min-w-0 max-w-full: fünf Kennzahlen sprengten bei 390 px sonst die Seite (464 px, Runde 2 /leads) */}
        {rechts ? (
          <div
            className={cn(
              'flex max-w-full min-w-0 flex-wrap items-center gap-2.5',
              stuck && 'max-xl:md:hidden xl:[scrollbar-width:none] xl:flex-nowrap xl:overflow-x-auto',
            )}
          >
            {rechts}
          </div>
        ) : null}
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
    <div className="text-ink-2 tnum flex max-w-full items-baseline gap-5 font-mono text-[13px] max-md:flex-wrap max-md:gap-x-3.5 max-md:gap-y-1 max-md:text-[12px]">
      {eintraege.map((e) => (
        <span key={e.label} className="whitespace-nowrap">
          <b
            className={cn(
              'text-[16px] font-medium max-md:text-[15px]',
              // Eine Null ist kein Signal: „0 fällig“ in Lime/Amber zog den Blick auf nichts (Runde 2, Mikes Heute)
              e.wert === 0 || e.wert === '0'
                ? 'text-ink-bright'
                : e.ton === 'signal'
                  ? 'text-signal'
                  : e.ton === 'overdue'
                    ? 'text-overdue'
                    : 'text-ink-bright',
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
