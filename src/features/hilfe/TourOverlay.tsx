// Tour-Oberfläche (nachgeladen): Spotlight – die Seite ist abgedunkelt bis auf das Ziel – und ein verankertes Popover mit Titel,
// ein bis zwei Sätzen, Schrittzähler und Weiter/Zurück/Überspringen. < 768 px: Sheet von unten über der Tab-Leiste.
// Während der Tour liegt ein durchsichtiger Schild über der Seite: Klicks und Seitentasten erreichen die App nicht – eine Tour
// kann nie versehentlich etwas speichern (E, S, B … sind solange stumm). Tasten: → / ↵ weiter, ← zurück, Esc überspringen.
import { useEffect, useEffectEvent, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { Kbd } from '@/components/ui/Kbd'
import { useIstTelefon } from '@/lib/useMediaQuery'
import type { TourKey } from './ereignis'
import { mitName, TOUREN } from './touren'
import { beschneide, findeZiel, loch, platziere, scrollDelta, type Rechteck } from './ziel'

export type TourEnde = 'fertig' | 'uebersprungen'

export type TourOverlayProps = {
  tour: TourKey
  /** Vorname für „Willkommen, Vincent.“ */
  name?: string | null
  onEnde: (art: TourEnde) => void
}

/** Wie lange die Tour nach einem Ziel sucht, bevor sie das Popover mittig zeigt (Seite lädt lazy, Daten kommen nach). */
export const ZIEL_SUCHE_MS = 3000
const ZIEL_TAKT_MS = 120
const TOPBAR_PX = 56
const TABLEISTE_PX = 56

const naechsterFrame = (cb: () => void): number =>
  typeof window.requestAnimationFrame === 'function' ? window.requestAnimationFrame(cb) : window.setTimeout(cb, 16)
const frameAbbrechen = (id: number) =>
  typeof window.cancelAnimationFrame === 'function' ? window.cancelAnimationFrame(id) : window.clearTimeout(id)

const rechteckVon = (el: Element): Rechteck => {
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}
const gleich = (a: Rechteck | null, b: Rechteck | null) =>
  a === b ||
  (!!a &&
    !!b &&
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5)

/** Höhe des klebenden Seitenkopfs (SeitenKopf schreibt `--head-h`), damit gescrollte Ziele nicht darunter verschwinden. */
function kopfHoehe(): number {
  const v = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--head-h'))
  return Number.isFinite(v) ? v : 0
}

export default function TourOverlay({ tour: tourKey, name, onEnde }: TourOverlayProps) {
  const tour = TOUREN[tourKey]
  const [index, setIndex] = useState(0)
  const schritt = tour.schritte[index]!
  const letzter = index === tour.schritte.length - 1
  const telefon = useIstTelefon()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  // Ergebnis der Zielsuche, gebunden an Schritt + Seite: gilt nur, solange beides passt (kein Zurücksetzen im Effekt nötig)
  const schluessel = `${index}:${pathname}`
  const [suche, setSuche] = useState<{ schluessel: string; ziel: HTMLElement | null } | null>(null)
  const gesucht = suche?.schluessel === schluessel
  const ziel = gesucht ? suche.ziel : null
  const [rect, setRect] = useState<Rechteck | null>(null)
  const [viewport, setViewport] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
  const [karte, setKarte] = useState({ w: 360, h: 220 })
  const karteRef = useRef<HTMLDivElement | null>(null)
  const weiterRef = useRef<HTMLButtonElement | null>(null)
  const titelId = useId()
  const textId = useId()

  const weiter = () => (letzter ? onEnde('fertig') : setIndex((i) => Math.min(i + 1, tour.schritte.length - 1)))
  const zurueck = () => setIndex((i) => Math.max(0, i - 1))
  const ueberspringen = () => onEnde('uebersprungen')

  // Fokus: vorher aktives Element merken und am Ende zurückgeben
  useEffect(() => {
    const vorher = document.activeElement as HTMLElement | null
    return () => vorher?.focus?.({ preventScroll: true })
  }, [])

  // Seite des Schritts öffnen, dann das Ziel suchen (lazy Routen, Daten kommen nach)
  useEffect(() => {
    if (schritt.pfad && pathname !== schritt.pfad) {
      navigate(schritt.pfad)
      return // nach dem Seitenwechsel läuft der Effekt mit neuem `pathname` erneut
    }
    const start = Date.now()
    let takt = 0
    const suchen = () => {
      const el = findeZiel(schritt.ziele)
      if (el || !schritt.ziele?.length || Date.now() - start >= ZIEL_SUCHE_MS) {
        setSuche({ schluessel, ziel: el })
        return
      }
      takt = window.setTimeout(suchen, ZIEL_TAKT_MS)
    }
    takt = window.setTimeout(suchen, 0)
    return () => window.clearTimeout(takt)
  }, [schritt, pathname, navigate, schluessel])

  // Telefon: Platz unter der Seite schaffen, damit auch Ziele ganz unten (Tageszähler) über das Sheet gescrollt werden können
  useLayoutEffect(() => {
    if (!telefon) return
    const alt = document.body.style.paddingBottom
    document.body.style.paddingBottom = `${Math.round(karte.h)}px`
    return () => {
      document.body.style.paddingBottom = alt
    }
  }, [telefon, karte.h])

  // Ziel ins Bild holen: inneren Scroller (Kanban, Tabelle) per scrollIntoView, dann das Fenster so, dass das Ziel weder
  // unter dem klebenden Kopf noch unter dem Sheet (Telefon) liegt
  useLayoutEffect(() => {
    if (!ziel) return
    ziel.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
    const r = rechteckVon(ziel)
    const istFixiert = !!ziel.closest('nav, aside[aria-label="Seitenleiste"]')
    if (istFixiert) return
    const oben = (telefon ? TOPBAR_PX : 0) + Math.max(kopfHoehe(), 0) + 8
    const unten = window.innerHeight - (telefon ? karte.h + TABLEISTE_PX : 0) - 8
    const delta = scrollDelta(r, oben, Math.max(oben + 40, unten))
    if (delta !== 0) window.scrollBy({ top: delta, behavior: 'instant' as ScrollBehavior })
  }, [ziel, telefon, karte.h])

  // Rechteck des Ziels mitführen (Scrollen, Größe, Realtime-Neuzeichnen ersetzt das Element)
  useEffect(() => {
    let frame = 0
    const messen = () => {
      frameAbbrechen(frame)
      frame = naechsterFrame(() => {
        setViewport((v) =>
          v.w === window.innerWidth && v.h === window.innerHeight ? v : { w: window.innerWidth, h: window.innerHeight },
        )
        // Während der Suche das alte Loch stehen lassen (kein Aufblitzen der vollen Abdunkelung zwischen zwei Zielen)
        if (!ziel) {
          if (gesucht) setRect(null)
          return
        }
        if (!ziel.isConnected) {
          setSuche({ schluessel, ziel: findeZiel(schritt.ziele) })
          return
        }
        const r = rechteckVon(ziel)
        setRect((alt) => (gleich(alt, r) ? alt : r))
      })
    }
    messen()
    window.addEventListener('scroll', messen, { capture: true, passive: true })
    window.addEventListener('resize', messen)
    const ro = typeof ResizeObserver !== 'undefined' && ziel ? new ResizeObserver(messen) : null
    if (ziel) ro?.observe(ziel)
    const takt = window.setInterval(messen, 500)
    return () => {
      frameAbbrechen(frame)
      window.removeEventListener('scroll', messen, { capture: true })
      window.removeEventListener('resize', messen)
      ro?.disconnect()
      window.clearInterval(takt)
    }
  }, [ziel, gesucht, schritt, schluessel])

  // Kartengröße für die Platzierung (Inhalt wechselt je Schritt, Breite je Viewport)
  useEffect(() => {
    const k = karteRef.current
    if (!k) return
    const messen = () => {
      const r = k.getBoundingClientRect()
      if (r.width && r.height)
        setKarte((alt) =>
          Math.abs(r.width - alt.w) > 1 || Math.abs(r.height - alt.h) > 1 ? { w: r.width, h: r.height } : alt,
        )
    }
    messen()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(messen)
    ro.observe(k)
    return () => ro.disconnect()
  }, [telefon])

  // Fokus auf „Weiter“ je Schritt (Tastatur und Screenreader starten am Handlungsknopf)
  useEffect(() => {
    weiterRef.current?.focus({ preventScroll: true })
  }, [index])

  // Tasten: in der Capture-Phase vor allen Seitentasten (useHotkeys hört auf `document`) – nichts erreicht die Seite
  const taste = useEffectEvent((e: KeyboardEvent) => {
    const imKnopf = e.target instanceof HTMLElement && !!e.target.closest('[data-tour-karte] button')
    if (e.key === 'Escape') {
      e.preventDefault()
      ueberspringen()
    } else if (e.key === 'ArrowRight' || (e.key === 'Enter' && !imKnopf)) {
      e.preventDefault()
      weiter()
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      zurueck()
    } else if (e.key !== 'Tab' && e.key !== 'Enter' && e.key !== ' ' && !e.metaKey && !e.ctrlKey) {
      // Einzelbuchstaben (E, S, B, J …) dürfen während der Tour nichts auslösen
      e.preventDefault()
    }
    e.stopPropagation()
  })
  useEffect(() => {
    const h = (e: KeyboardEvent) => taste(e)
    window.addEventListener('keydown', h, { capture: true })
    return () => window.removeEventListener('keydown', h, { capture: true })
  }, [])

  // Telefon: das Loch endet an Topbar und Tab-Leiste – außer das Ziel liegt selbst in der Tab-Leiste
  const imRahmen = !!ziel?.closest('nav[aria-label="Navigation"]')
  const roh = rect ? loch(rect, viewport) : null
  const l = roh && telefon && !imRahmen ? beschneide(roh, TOPBAR_PX, viewport.h - TABLEISTE_PX) : roh
  const platz = !telefon ? platziere(l, karte, viewport) : null
  // Telefon: liegt das Ziel ganz im Bereich des Sheets (fester Feedback-Knopf über der Tab-Leiste), kommt das Sheet nach oben
  const sheetOben = telefon && !!l && !imRahmen && l.top >= viewport.h - TABLEISTE_PX - karte.h
  const zeigeLeer = gesucht && !ziel && !!schritt.leer
  const titel = mitName(schritt.titel, name)

  const abdunkler =
    'bg-scrim pointer-events-none absolute ease-brand transition-[top,left,width,height] duration-[var(--t-3)]'

  return createPortal(
    <div
      className="pointer-events-auto fixed inset-0 z-[80]"
      data-tour-overlay={tour.key}
      onPointerDown={(e) => {
        // Klicks außerhalb der Karte landen auf dem Schild und gehen nicht an die Seite
        if (!(e.target instanceof Element && e.target.closest('[data-tour-karte]'))) e.preventDefault()
      }}
    >
      {l ? (
        <>
          <div className={abdunkler} style={{ top: 0, left: 0, right: 0, height: l.top }} />
          <div className={abdunkler} style={{ top: l.top + l.height, left: 0, right: 0, bottom: 0 }} />
          <div className={abdunkler} style={{ top: l.top, left: 0, width: l.left, height: l.height }} />
          <div className={abdunkler} style={{ top: l.top, left: l.left + l.width, right: 0, height: l.height }} />
          <div
            aria-hidden
            data-tour-loch
            className="border-signal ease-brand pointer-events-none absolute rounded-md border transition-[top,left,width,height] duration-[var(--t-3)]"
            style={{ top: l.top, left: l.left, width: l.width, height: l.height }}
          />
        </>
      ) : (
        <div className={cn(abdunkler, 'inset-0')} />
      )}

      <div
        ref={karteRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titelId}
        aria-describedby={textId}
        data-tour-karte
        data-seite={telefon ? (sheetOben ? 'sheet-oben' : 'sheet') : platz?.seite}
        className={cn(
          'bg-surface-raised shadow-float fixed outline-none',
          telefon && !sheetOben
            ? 'inset-x-0 bottom-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom))] animate-[sheet-up_var(--t-3)_var(--ease-brand)] rounded-t-lg px-4 pt-2.5 pb-4'
            : sheetOben
              ? 'inset-x-0 top-0 animate-[pop-in_var(--t-3)_var(--ease-brand)] rounded-b-lg px-4 pt-[calc(16px+env(safe-area-inset-top))] pb-4'
              : 'ease-brand w-[min(360px,calc(100vw-32px))] rounded-md p-5 transition-[top,left] duration-[var(--t-3)]',
        )}
        style={platz ? { top: platz.top, left: platz.left } : undefined}
      >
        {telefon && !sheetOben ? (
          <div aria-hidden className="bg-line-strong mx-auto mb-3 h-1 w-9 rounded-full" />
        ) : null}
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="label">{tour.titel}</span>
          <span className="mono-sm text-ink-3 tnum" aria-label={`Schritt ${index + 1} von ${tour.schritte.length}`}>
            {index + 1} / {tour.schritte.length}
          </span>
        </div>
        <div key={schritt.id} className="animate-[pop-in_var(--t-3)_var(--ease-brand)]">
          <h2 id={titelId} className="text-h2 text-ink-bright">
            {titel}
          </h2>
          <p id={textId} className="text-body text-ink-2 mt-1.5">
            {schritt.text}
          </p>
          {zeigeLeer ? <p className="text-small text-ink-3 mt-2">{schritt.leer}</p> : null}
          {schritt.tasten?.length ? (
            <div className="mt-3 flex flex-wrap items-center gap-1 [@media(hover:none)_and_(pointer:coarse)]:hidden">
              {schritt.tasten.map((t) => (t.includes(' ') ? <Kbd key={t} akkord={t} /> : <Kbd key={t}>{t}</Kbd>))}
            </div>
          ) : null}
        </div>
        <div className="mt-4 flex items-center gap-1.5">
          <Button variante="quiet" groesse={telefon ? 'M' : 'S'} kbd="Esc" onClick={ueberspringen}>
            {tour.key === 'onboarding' ? 'Überspringen' : 'Schließen'}
          </Button>
          <span className="flex-1" />
          <Button variante="secondary" groesse={telefon ? 'M' : 'S'} kbd="←" disabled={index === 0} onClick={zurueck}>
            Zurück
          </Button>
          <Button ref={weiterRef} variante="primary" groesse={telefon ? 'M' : 'S'} kbd="→" onClick={weiter}>
            {letzter ? 'Fertig' : 'Weiter'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
