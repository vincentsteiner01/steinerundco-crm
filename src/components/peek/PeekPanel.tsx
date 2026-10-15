import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from 'react'
import { useSearchParams } from 'react-router'
import { useUiStore } from '@/app/uiStore'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { istEingabe, TastenBereich, useHotkeys } from '@/lib/keyboard'

export type PeekPanelProps = {
  leadId: string
  children: ReactNode
  /** Slot in der Kopfzeile rechts (Icon-Buttons LinkedIn · Anrufen · E-Mail · Vollansicht – rendert M2) */
  kopfRechts?: ReactNode
  /** Überschreibt das Schließen (Standard: `?lead=` aus der URL entfernen) */
  onSchliessen?: () => void
  /** Überschreibt den Wechsel (Standard: `?lead=<id>` setzen) */
  onWechsel?: (leadId: string) => void
  className?: string
  ref?: Ref<HTMLElement>
}

type Modus = 'overlay' | 'spalte' | 'sheet'

function modusAusFenster(): Modus {
  if (typeof window === 'undefined' || !window.matchMedia) return 'overlay'
  if (window.matchMedia('(min-width: 1600px)').matches) return 'spalte'
  // DESIGN-SYSTEM § 4.2 nennt < 768 für das Sheet; BAUPLAN § 3.1.5/Auftrag sagen Sheet < 1024 (Icon-Rail-Bereich) – BAUPLAN gilt
  if (window.matchMedia('(max-width: 1023px)').matches) return 'sheet'
  return 'overlay'
}

const FOKUSSIERBAR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Container des Lead-Peeks (DESIGN-SYSTEM § 4.1/§ 5.11, BAUPLAN § 3.1.10): Overlay 440 px rechts mit Scrim .35 (1024–1599),
 * dritte Spalte ohne Scrim (≥ 1600, AppShell-Grid), Sheet von unten mit Griff (< 1024; Wischen nach unten schließt).
 * Kopfzeile: „n von m“ Mono + ←/→ (uiStore.peekListe), Slot rechts, „Schließen Esc“. Inhalt (`LeadPanel`) kommt als children.
 * `Esc` schließt (nicht aus einem Eingabefeld heraus – dort nur Blur), `←`/`→` wechseln den Lead; Fokusfalle und Body-Scroll-Sperre
 * nur in Overlay/Sheet; der Fokus kehrt beim Schließen zum vorherigen Element zurück.
 */
export function PeekPanel({ leadId, children, kopfRechts, onSchliessen, onWechsel, className, ref }: PeekPanelProps) {
  const [params, setParams] = useSearchParams()
  const liste = useUiStore((s) => s.peekListe)
  const setPeek = useUiStore((s) => s.setPeek)
  const asideRef = useRef<HTMLElement | null>(null)
  const vorherFokus = useRef<Element | null>(null)
  const [modus, setModus] = useState<Modus>(modusAusFenster)

  useEffect(() => {
    if (!window.matchMedia) return
    const mqs = [window.matchMedia('(min-width: 1600px)'), window.matchMedia('(max-width: 1023px)')]
    const h = () => setModus(modusAusFenster())
    for (const mq of mqs) mq.addEventListener?.('change', h)
    return () => {
      for (const mq of mqs) mq.removeEventListener?.('change', h)
    }
  }, [])

  // uiStore kennt den offenen Lead (Aktionen/Tasten prüfen darauf)
  useEffect(() => {
    setPeek(leadId)
  }, [leadId, setPeek])

  const schliesse = useCallback(() => {
    if (onSchliessen) return onSchliessen()
    const p = new URLSearchParams(params)
    p.delete('lead')
    setParams(p, { replace: true })
  }, [onSchliessen, params, setParams])

  const wechsel = useCallback(
    (delta: number) => {
      if (liste.length === 0) return
      const i = liste.indexOf(leadId)
      if (i < 0) return
      const ziel = liste[(i + delta + liste.length) % liste.length]
      if (!ziel || ziel === leadId) return
      if (onWechsel) return onWechsel(ziel)
      const p = new URLSearchParams(params)
      p.set('lead', ziel)
      setParams(p, { replace: true })
    },
    [liste, leadId, onWechsel, params, setParams],
  )

  useHotkeys(
    'global',
    {
      escape: (e) => {
        // Aus einem Eingabefeld heraus verlässt Esc nur das Feld (lib/keyboard blurt); das Panel bleibt
        if (istEingabe(e.target as Element | null)) return
        e.preventDefault()
        schliesse()
      },
      arrowleft: (e) => {
        if (istEingabe(e.target as Element | null)) return
        wechsel(-1)
      },
      arrowright: (e) => {
        if (istEingabe(e.target as Element | null)) return
        wechsel(1)
      },
    },
    [schliesse, wechsel],
  )

  // Body-Scroll-Sperre + Fokus (nur Overlay/Sheet; als Spalte bleibt die Liste bedienbar)
  const modal = modus !== 'spalte'
  useLayoutEffect(() => {
    if (!modal) return
    vorherFokus.current = document.activeElement
    const vorher = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const el = asideRef.current
    if (el && !el.contains(document.activeElement)) el.focus({ preventScroll: true })
    return () => {
      document.body.style.overflow = vorher
      const zurueck = vorherFokus.current as HTMLElement | null
      if (zurueck && typeof zurueck.focus === 'function' && document.contains(zurueck))
        zurueck.focus({ preventScroll: true })
    }
  }, [modal])

  // Fokusfalle: Tab bleibt im Panel
  useEffect(() => {
    if (!modal) return
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const el = asideRef.current
      if (!el) return
      const elemente = Array.from(el.querySelectorAll<HTMLElement>(FOKUSSIERBAR)).filter(
        (f) => !f.hidden && f.getAttribute('aria-hidden') !== 'true' && !f.closest('[hidden]'),
      )
      if (elemente.length === 0) {
        e.preventDefault()
        el.focus()
        return
      }
      const erstes = elemente[0] as HTMLElement
      const letztes = elemente[elemente.length - 1] as HTMLElement
      const aktiv = document.activeElement
      if (!el.contains(aktiv)) {
        e.preventDefault()
        ;(e.shiftKey ? letztes : erstes).focus()
        return
      }
      if (e.shiftKey && aktiv === erstes) {
        e.preventDefault()
        letztes.focus()
      } else if (!e.shiftKey && aktiv === letztes) {
        e.preventDefault()
        erstes.focus()
      }
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [modal])

  // Sheet: Wischen am Griff nach unten schließt
  const wischStart = useRef<number | null>(null)

  const setRef = (el: HTMLElement | null) => {
    asideRef.current = el
    if (typeof ref === 'function') ref(el)
    else if (ref && typeof ref === 'object') (ref as { current: HTMLElement | null }).current = el
  }

  const pos = liste.indexOf(leadId)

  return (
    <>
      {modal ? (
        <div data-scrim className="split:hidden bg-canvas/35 fixed inset-0 z-[39]" onClick={schliesse} aria-hidden />
      ) : null}
      <aside
        ref={setRef}
        role={modal ? 'dialog' : 'complementary'}
        aria-modal={modal || undefined}
        aria-label="Lead-Detail"
        tabIndex={-1}
        data-modus={modus}
        className={cn(
          'bg-surface-raised z-40 flex flex-col outline-none',
          modus === 'overlay' &&
            'shadow-float fixed inset-y-0 right-0 w-[min(var(--spacing-peek),100vw)] animate-[peek-in_var(--t-3)_var(--ease-brand)]',
          modus === 'sheet' &&
            'shadow-float fixed inset-x-0 top-[8vh] bottom-0 animate-[sheet-up_var(--t-3)_var(--ease-brand)] rounded-t-lg',
          modus === 'spalte' && 'border-line sticky top-0 h-dvh w-auto border-l',
          className,
        )}
      >
        {modus === 'sheet' ? (
          <div
            className="relative h-4 shrink-0 touch-none"
            onPointerDown={(e) => {
              wischStart.current = e.clientY
            }}
            onPointerMove={(e) => {
              if (wischStart.current !== null && e.clientY - wischStart.current > 80) {
                wischStart.current = null
                schliesse()
              }
            }}
            onPointerUp={() => {
              wischStart.current = null
            }}
            aria-hidden
          >
            <span className="bg-line-strong absolute top-2 left-1/2 h-1 w-9 -translate-x-1/2 rounded-full" />
          </div>
        ) : null}
        <div className="flex shrink-0 items-center gap-1.5 px-6 pt-5 pb-3.5">
          {pos >= 0 ? (
            <>
              <span className="text-ink-3 tnum mr-1.5 font-mono text-[12px] whitespace-nowrap">
                {pos + 1} von {liste.length}
              </span>
              <button
                type="button"
                aria-label="Voriger Lead"
                title="Voriger Lead · ←"
                disabled={liste.length < 2}
                onClick={() => wechsel(-1)}
                className="text-ink-2 hover:bg-surface-hover hover:text-ink grid h-7 w-7 place-items-center rounded-sm disabled:opacity-45"
              >
                <ChevronLeft size={14} strokeWidth={1.75} aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Nächster Lead"
                title="Nächster Lead · →"
                disabled={liste.length < 2}
                onClick={() => wechsel(1)}
                className="text-ink-2 hover:bg-surface-hover hover:text-ink grid h-7 w-7 place-items-center rounded-sm disabled:opacity-45"
              >
                <ChevronRight size={14} strokeWidth={1.75} aria-hidden />
              </button>
            </>
          ) : null}
          <span className="flex-1" />
          <TastenBereich.Provider value="peek">{kopfRechts}</TastenBereich.Provider>
          <Button variante="quiet" groesse="S" kbd="Esc" icon={X} onClick={schliesse}>
            Schließen
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <TastenBereich.Provider value="peek">{children}</TastenBereich.Provider>
        </div>
      </aside>
    </>
  )
}
