// Screenshot der aktuellen Seite für eine Feedback-Meldung – genau der sichtbare Ausschnitt (Fenster, nicht die ganze Seite).
// modern-screenshot (SVG-foreignObject → Canvas) wird erst beim Melden nachgeladen. Im Browser geprüft (15.10.2026):
//   · Schriften: die eingebaute Font-Einbettung verliert bei Geist/Geist Mono die `src` (unicode-range) → eigene
//     @font-face-Regeln mit den drei self-hosted woff2 als data:-URL (einmal geladen, dann gecacht).
//   · Scroll-Position: Klon mit `margin-top: -scrollY` (fixierte Elemente – Tab-Leiste, Toasts, Peek – bleiben am Fenster);
//     klebende Köpfe (position: sticky) bleiben im Klon nicht kleben → werden vorher vermessen und per Transform an ihre
//     sichtbare Stelle verschoben.
//   · Benutzerdefinierte CSS-Eigenschaften (--*) werden aus jedem Klon-Knoten entfernt: die Werte sind schon aufgelöst,
//     die ~200 Variablen je Knoten machten das SVG 10× größer und die Aufnahme langsam.
//   · WebP 0,9 statt PNG: das Rausch-Overlay (3,5 %) macht PNG ~3 MB groß, WebP ~70–300 kB; Safari kann kein WebP
//     kodieren → JPEG.
//   · Nur die sichtbar wirksamen CSS-Eigenschaften werden kopiert (`includeStyleProperties`, Liste unten): synthetische
//     Pipeline-Last (10 Spalten, 184 Karten, ~2 900 Knoten, horizontal + Spalte gescrollt) 2,7 s → 0,7 s, Bild identisch.
// Alles mit `data-feedback-ignorieren` (Knopf, Dialog) erscheint nie im Bild.

export const IGNORIEREN_ATTR = 'data-feedback-ignorieren'
const STICKY_ATTR = 'data-feedback-sticky'
const MAX_BYTES = 5 * 1024 * 1024
const ZEITLIMIT_MS = 8000

// Seit dem hellen Design (20.10.2026) nutzt das CRM die Systemschrift – sie ist im Bild ohne Einbetten verfügbar.
const SCHRIFTEN: { familie: string; datei: string; stil: 'normal' | 'italic'; gewicht: string }[] = []

let schriftCss: Promise<string> | null = null

/** Kopierte Eigenschaften je Knoten (alles, was das Bild verändert; keine Animationen/Transitions – der Klon ist ein Standbild). */
export const STIL_EIGENSCHAFTEN: string[] = [
  ...['display', 'position', 'top', 'right', 'bottom', 'left', 'z-index', 'float', 'clear', 'box-sizing', 'isolation'],
  ...['width', 'height', 'min-width', 'min-height', 'max-width', 'max-height', 'aspect-ratio'],
  ...['margin', 'padding'].flatMap((p) => ['top', 'right', 'bottom', 'left'].map((s) => `${p}-${s}`)),
  ...['top', 'right', 'bottom', 'left'].flatMap((s) => ['width', 'style', 'color'].map((e) => `border-${s}-${e}`)),
  ...['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((e) => `border-${e}-radius`),
  ...['background-color', 'background-image', 'background-size', 'background-position', 'background-repeat'],
  ...['background-clip', 'background-origin', 'color', 'opacity', 'visibility', 'overflow-x', 'overflow-y'],
  ...['text-overflow', 'white-space', 'word-break', 'overflow-wrap', 'hyphens', 'text-wrap', 'tab-size'],
  ...['font-family', 'font-size', 'font-weight', 'font-style', 'font-stretch', 'font-variant-numeric'],
  ...['font-feature-settings', 'font-variation-settings', 'font-kerning', 'font-optical-sizing', 'font-synthesis'],
  ...['line-height', 'letter-spacing', 'word-spacing', 'text-align', 'text-transform', 'text-indent', 'text-shadow'],
  ...['text-decoration-line', 'text-decoration-color', 'text-decoration-style', 'text-decoration-thickness'],
  ...['text-underline-offset', 'text-rendering', '-webkit-font-smoothing', 'vertical-align', 'direction'],
  ...['flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis', 'order'],
  ...['align-items', 'align-self', 'align-content', 'justify-content', 'justify-items', 'justify-self'],
  ...['row-gap', 'column-gap', 'grid-template-columns', 'grid-template-rows', 'grid-template-areas', 'grid-area'],
  ...['grid-column-start', 'grid-column-end', 'grid-row-start', 'grid-row-end'],
  ...['grid-auto-flow', 'grid-auto-rows', 'grid-auto-columns'],
  ...['transform', 'transform-origin', 'translate', 'scale', 'rotate', 'perspective', 'transform-style'],
  ...['box-shadow', 'outline-width', 'outline-style', 'outline-color', 'outline-offset', 'filter', 'backdrop-filter'],
  ...['clip-path', 'mask-image', 'mix-blend-mode', 'object-fit', 'object-position', 'appearance', 'accent-color'],
  ...[
    'list-style-type',
    'list-style-position',
    'content',
    'quotes',
    'table-layout',
    'border-collapse',
    'border-spacing',
  ],
  ...['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray'],
  ...['-webkit-line-clamp', '-webkit-box-orient', '-webkit-text-fill-color', '-webkit-text-stroke', 'caret-color'],
  ...['scrollbar-width', 'scrollbar-color', 'pointer-events'],
]

function alsDataUrl(blob: Blob): Promise<string> {
  return new Promise((ok, fehler) => {
    const r = new FileReader()
    r.onload = () => ok(String(r.result))
    r.onerror = () => fehler(r.error)
    r.readAsDataURL(blob)
  })
}

/** @font-face-Regeln mit eingebetteten Schriften (einmal je Sitzung). Fehler → leer (Ersatzschriften im Bild). */
export function schriftRegeln(): Promise<string> {
  schriftCss ??= Promise.all(
    SCHRIFTEN.map(async (s) => {
      const antwort = await fetch(s.datei)
      if (!antwort.ok) return ''
      const url = await alsDataUrl(await antwort.blob())
      return `@font-face{font-family:'${s.familie}';src:url(${url}) format('woff2');font-weight:${s.gewicht};font-style:${s.stil};font-display:block}`
    }),
  )
    .then((teile) => teile.join(''))
    .catch(() => '')
  return schriftCss
}

/** Knoten, die nie im Screenshot erscheinen (Feedback-Knopf, Dialog). */
export function imBild(n: Node): boolean {
  return !(n instanceof Element && n.hasAttribute(IGNORIEREN_ATTR))
}

/**
 * Klebende Elemente, die gerade kleben, mit ihrer Verschiebung markieren (sichtbare Lage − Lage ohne `sticky`).
 * Liefert die Aufräum-Funktion. Synchron: zwischen Messen und Zurücksetzen wird nicht gezeichnet – kein Flackern.
 */
export function markiereKlebende(doc: Document = document): () => void {
  const markiert: Element[] = []
  for (const el of doc.body.querySelectorAll<HTMLElement>('*')) {
    if (getComputedStyle(el).position !== 'sticky') continue
    const sichtbar = el.getBoundingClientRect()
    const vorher = el.style.getPropertyValue('position')
    const prio = el.style.getPropertyPriority('position')
    el.style.setProperty('position', 'static', 'important')
    const natuerlich = el.getBoundingClientRect()
    if (vorher) el.style.setProperty('position', vorher, prio)
    else el.style.removeProperty('position')
    const dx = sichtbar.left - natuerlich.left
    const dy = sichtbar.top - natuerlich.top
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
      el.setAttribute(STICKY_ATTR, `${dx.toFixed(2)} ${dy.toFixed(2)}`)
      markiert.push(el)
    }
  }
  return () => {
    for (const el of markiert) el.removeAttribute(STICKY_ATTR)
  }
}

/** Je Klon-Knoten: CSS-Variablen entfernen (Werte sind aufgelöst). */
export function entferneVariablen(n: Node): void {
  const stil = (n as Partial<HTMLElement>).style
  if (!stil || typeof stil.getPropertyValue !== 'function') return
  const weg: string[] = []
  for (let i = 0; i < stil.length; i++) {
    const p = stil[i]
    if (p?.startsWith('--')) weg.push(p)
  }
  for (const p of weg) stil.removeProperty(p)
}

/** Ganzer Klon: markierte Klebende an ihre sichtbare Stelle schieben (Transform – `position: relative` + `top` zeichnet das SVG-Bild nicht). */
export function verschiebeKlebende(wurzel: Node): void {
  if (!(wurzel instanceof Element)) return
  for (const el of wurzel.querySelectorAll<HTMLElement>(`[${STICKY_ATTR}]`)) {
    const [dx = '0', dy = '0'] = (el.getAttribute(STICKY_ATTR) ?? '').split(' ')
    const alt = el.style.getPropertyValue('transform')
    el.style.setProperty('position', 'relative')
    el.style.setProperty('inset', 'auto')
    el.style.setProperty('transform', `translate(${dx}px, ${dy}px)${alt && alt !== 'none' ? ` ${alt}` : ''}`)
    el.removeAttribute(STICKY_ATTR)
  }
}

let webpOk: boolean | null = null
/** Kann der Browser WebP kodieren? (Safari nicht → JPEG) */
export function kannWebp(): boolean {
  if (webpOk !== null) return webpOk
  try {
    const c = document.createElement('canvas')
    c.width = c.height = 1
    webpOk = c.toDataURL('image/webp').startsWith('data:image/webp')
  } catch {
    webpOk = false
  }
  return webpOk
}

function mitZeitlimit<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((ok) => {
    const t = setTimeout(() => ok(null), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        ok(v)
      },
      () => {
        clearTimeout(t)
        ok(null)
      },
    )
  })
}

/**
 * Nimmt den sichtbaren Ausschnitt auf (vor dem Dialog aufrufen). `null`, wenn es nicht klappt oder länger als 8 s dauert –
 * die Meldung geht dann ohne Bild (oder mit eingefügtem Bild) raus.
 */
export async function nimmAuf(): Promise<Blob | null> {
  const ergebnis = await mitZeitlimit(aufnehmen(), ZEITLIMIT_MS)
  return ergebnis
}

async function aufnehmen(): Promise<Blob | null> {
  const [{ domToBlob }, cssText] = await Promise.all([import('modern-screenshot'), schriftRegeln()])
  const root = document.documentElement
  const breite = root.clientWidth || window.innerWidth
  const hoehe = window.innerHeight
  const typ = kannWebp() ? 'image/webp' : 'image/jpeg'
  const aufraeumen = markiereKlebende()
  try {
    const optionen = (scale: number, quality: number) => ({
      width: breite,
      height: hoehe,
      scale,
      type: typ,
      quality,
      backgroundColor: getComputedStyle(document.body).backgroundColor,
      filter: imBild,
      font: cssText ? { cssText } : (false as const),
      timeout: 5000,
      features: { restoreScrollPosition: true },
      style: { marginTop: `${-window.scrollY}px`, marginLeft: `${-window.scrollX}px` },
      includeStyleProperties: STIL_EIGENSCHAFTEN,
      onCloneEachNode: entferneVariablen,
      onCloneNode: verschiebeKlebende,
    })
    const scale = Math.min(window.devicePixelRatio || 1, 2)
    let blob = await domToBlob(root, optionen(scale, 0.9))
    // Sehr große Seiten (selten): einmal kleiner und stärker komprimiert
    if (blob.size > MAX_BYTES) blob = await domToBlob(root, optionen(1, 0.8))
    return blob.size > MAX_BYTES ? null : blob
  } catch (e) {
    console.warn('Feedback: Screenshot nicht möglich', e)
    return null
  } finally {
    aufraeumen()
  }
}

/**
 * Eingefügtes/gezogenes Bild übernehmen: PNG/JPEG/WebP bis 5 MB unverändert, sonst (HEIC, GIF, zu groß) über Canvas
 * als JPEG (max. 2880 px breit). `null` = kein lesbares Bild.
 */
export async function normalisiereBild(datei: Blob): Promise<Blob | null> {
  const ok = ['image/png', 'image/jpeg', 'image/webp'].includes(datei.type)
  if (ok && datei.size <= MAX_BYTES) return datei
  if (!datei.type.startsWith('image/')) return null
  try {
    const bild = await createImageBitmap(datei)
    const faktor = Math.min(1, 2880 / bild.width)
    const c = document.createElement('canvas')
    c.width = Math.round(bild.width * faktor)
    c.height = Math.round(bild.height * faktor)
    c.getContext('2d')?.drawImage(bild, 0, 0, c.width, c.height)
    const blob = await new Promise<Blob | null>((ok2) => c.toBlob(ok2, 'image/jpeg', 0.85))
    return blob && blob.size <= MAX_BYTES ? blob : null
  } catch {
    return null
  }
}
