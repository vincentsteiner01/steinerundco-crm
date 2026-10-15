// Tour-Ziele finden und Popover platzieren. Ziele kommen zuerst über feste `data-tour`-Anker (nav:<pfad>, queue-karte,
// call-block, leitfaden-detail, feedback), dahinter stabile Selektoren als Rückfall (href, aria-label, data-*). Fehlt ein Ziel,
// zeigt die Tour das Popover mittig – nie einen Fehler.

/** CSS-Selektor oder „Element per Selektor, dessen Text `text` enthält“ (Knöpfe ohne eigenes Attribut). */
export type ZielSpec = string | { css: string; text: string }

export type Rechteck = { top: number; left: number; width: number; height: number }
export type Groesse = { w: number; h: number }
export type Seite = 'unten' | 'oben' | 'rechts' | 'links' | 'innen' | 'mitte'
export type Platz = { top: number; left: number; seite: Seite }

/** Sichtbar = hat eine Fläche und liegt nicht in `display:none`/`visibility:hidden` (Sidebar < 1024, Tab-Leiste ≥ 768 …). */
export function istSichtbar(el: Element): boolean {
  const r = el.getBoundingClientRect()
  if (r.width <= 0 || r.height <= 0) return false
  const stil = window.getComputedStyle(el)
  return stil.visibility !== 'hidden' && stil.display !== 'none'
}

function kandidaten(spec: ZielSpec, wurzel: ParentNode): HTMLElement[] {
  try {
    if (typeof spec === 'string') return Array.from(wurzel.querySelectorAll<HTMLElement>(spec))
    const nadel = spec.text.toLowerCase()
    return Array.from(wurzel.querySelectorAll<HTMLElement>(spec.css)).filter((el) =>
      (el.textContent ?? '').toLowerCase().includes(nadel),
    )
  } catch {
    return [] // ungültiger Selektor darf die Tour nicht abbrechen
  }
}

/** Erstes sichtbares Element der ersten Spezifikation, die trifft (Reihenfolge = Priorität). */
export function findeZiel(ziele: readonly ZielSpec[] | undefined, wurzel: ParentNode = document): HTMLElement | null {
  if (!ziele) return null
  for (const spec of ziele) {
    const el = kandidaten(spec, wurzel).find(istSichtbar)
    if (el) return el
  }
  return null
}

export const RAND = 16
const ABSTAND = 12

/**
 * Popover neben das Ziel legen: links stehende, schmale Ziele (Navigation) → rechts daneben; sonst unten, oben, rechts, links –
 * die erste Seite, die ganz in den Viewport passt. Passt keine (großes Ziel, z. B. eine aufgeklappte Queue-Karte auf 1024 px) →
 * `innen`: unten rechts im Ziel, damit Kopf und Name oben links sichtbar bleiben. Kein Ziel → mittig. Immer im Viewport (16 px).
 */
export function platziere(ziel: Rechteck | null, karte: Groesse, viewport: Groesse): Platz {
  const mitte: Platz = {
    top: Math.max(RAND, Math.round((viewport.h - karte.h) / 2)),
    left: Math.max(RAND, Math.round((viewport.w - karte.w) / 2)),
    seite: 'mitte',
  }
  if (!ziel) return mitte

  const klemmeX = (x: number) => Math.min(Math.max(RAND, x), Math.max(RAND, viewport.w - karte.w - RAND))
  const klemmeY = (y: number) => Math.min(Math.max(RAND, y), Math.max(RAND, viewport.h - karte.h - RAND))
  const unten = ziel.top + ziel.height + ABSTAND
  const oben = ziel.top - ABSTAND - karte.h
  const rechts = ziel.left + ziel.width + ABSTAND
  const links = ziel.left - ABSTAND - karte.w

  const passt: Record<'unten' | 'oben' | 'rechts' | 'links', boolean> = {
    unten: unten + karte.h <= viewport.h - RAND,
    oben: oben >= RAND,
    rechts: rechts + karte.w <= viewport.w - RAND,
    links: links >= RAND,
  }
  const linksSchmal = ziel.left + ziel.width / 2 < viewport.w / 3 && ziel.width < viewport.w / 3
  const reihenfolge: ('unten' | 'oben' | 'rechts' | 'links')[] = linksSchmal
    ? ['rechts', 'unten', 'oben', 'links']
    : ['unten', 'oben', 'rechts', 'links']

  for (const seite of reihenfolge) {
    if (!passt[seite]) continue
    if (seite === 'unten') return { top: unten, left: klemmeX(ziel.left), seite }
    if (seite === 'oben') return { top: oben, left: klemmeX(ziel.left), seite }
    if (seite === 'rechts') return { top: klemmeY(ziel.top), left: rechts, seite }
    return { top: klemmeY(ziel.top), left: links, seite }
  }
  return {
    top: klemmeY(Math.min(ziel.top + ziel.height, viewport.h) - karte.h - RAND),
    left: klemmeX(ziel.left + ziel.width - karte.w - RAND),
    seite: 'innen',
  }
}

/** Rechteck auf den freien Bereich [oben, unten] begrenzen (Telefon: zwischen Topbar und Tab-Leiste). */
export function beschneide(r: Rechteck, oben: number, unten: number): Rechteck {
  const top = Math.max(r.top, oben)
  const bottom = Math.min(r.top + r.height, unten)
  return { ...r, top, height: Math.max(0, bottom - top) }
}

/** Loch im Abdunkler: Ziel plus 6 px Luft, auf den Viewport begrenzt. */
export function loch(ziel: Rechteck, viewport: Groesse, luft = 6): Rechteck {
  const top = Math.max(0, ziel.top - luft)
  const left = Math.max(0, ziel.left - luft)
  const bottom = Math.min(viewport.h, ziel.top + ziel.height + luft)
  const right = Math.min(viewport.w, ziel.left + ziel.width + luft)
  return { top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top) }
}

/**
 * Wie weit muss gescrollt werden, damit das Ziel im freien Bereich [oben, unten] liegt? 0 = schon sichtbar.
 * Größer als der Bereich → Oberkante ausrichten.
 */
export function scrollDelta(ziel: Rechteck, oben: number, unten: number): number {
  const hoehe = unten - oben
  if (ziel.top >= oben && ziel.top + ziel.height <= unten) return 0
  if (ziel.height > hoehe) return ziel.top - oben
  const mitte = oben + (hoehe - ziel.height) / 2
  return ziel.top - mitte
}
