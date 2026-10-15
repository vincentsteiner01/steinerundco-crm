import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  entferneVariablen,
  imBild,
  markiereKlebende,
  normalisiereBild,
  STIL_EIGENSCHAFTEN,
  verschiebeKlebende,
} from './aufnahme'
import { kurzBrowser, sammleKontext } from './kontext'
import { kurzTitel } from './texte'

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('aufnahme – Screenshot-Helfer', () => {
  it('Knopf und Dialog (data-feedback-ignorieren) erscheinen nie im Bild', () => {
    const knopf = document.createElement('button')
    knopf.setAttribute('data-feedback-ignorieren', '')
    expect(imBild(knopf)).toBe(false)
    expect(imBild(document.createElement('main'))).toBe(true)
    expect(imBild(document.createTextNode('x'))).toBe(true)
  })

  it('entfernt CSS-Variablen aus dem Klon, echte Eigenschaften bleiben', () => {
    const el = document.createElement('div')
    el.style.setProperty('--color-ink', 'red')
    el.style.setProperty('--spacing', '4px')
    el.style.setProperty('color', 'rgb(1, 2, 3)')
    entferneVariablen(el)
    expect(el.style.getPropertyValue('--color-ink')).toBe('')
    expect(el.style.getPropertyValue('--spacing')).toBe('')
    expect(el.style.getPropertyValue('color')).toBe('rgb(1, 2, 3)')
    expect(() => entferneVariablen(document.createTextNode('x'))).not.toThrow()
  })

  it('klebende Köpfe: misst die Verschiebung (sichtbar − ohne sticky), markiert und räumt wieder auf', () => {
    const kopf = document.createElement('header')
    kopf.style.position = 'sticky'
    const normal = document.createElement('div')
    document.body.append(kopf, normal)
    vi.spyOn(kopf, 'getBoundingClientRect').mockImplementation(
      () =>
        // klebt bei 0, ohne sticky läge er 300 px weiter oben
        (kopf.style.getPropertyValue('position') === 'static'
          ? { top: -300, left: 0 }
          : { top: 0, left: 0 }) as DOMRect,
    )
    const aufraeumen = markiereKlebende()
    expect(kopf.getAttribute('data-feedback-sticky')).toBe('0.00 300.00')
    expect(kopf.style.position).toBe('sticky') // Original unverändert
    expect(normal.hasAttribute('data-feedback-sticky')).toBe(false)
    aufraeumen()
    expect(kopf.hasAttribute('data-feedback-sticky')).toBe(false)
  })

  it('im Klon: markierte Klebende per Transform an ihre sichtbare Stelle', () => {
    const wurzel = document.createElement('html')
    const kopf = document.createElement('header')
    kopf.setAttribute('data-feedback-sticky', '0.00 300.00')
    kopf.style.position = 'sticky'
    wurzel.append(kopf)
    verschiebeKlebende(wurzel)
    expect(kopf.style.position).toBe('relative')
    expect(kopf.style.transform).toBe('translate(0.00px, 300.00px)')
    expect(kopf.hasAttribute('data-feedback-sticky')).toBe(false)
  })

  it('kopiert nur bildwirksame Eigenschaften: Layout, Rahmen, Schrift, Kürzung – keine Animationen, keine Variablen', () => {
    for (const p of [
      'display',
      'width',
      'border-top-left-radius',
      'font-family',
      'text-overflow',
      'white-space',
      'transform',
      'appearance',
    ])
      expect(STIL_EIGENSCHAFTEN).toContain(p)
    expect(
      STIL_EIGENSCHAFTEN.some((p) => p.startsWith('--') || p.startsWith('animation') || p.startsWith('transition')),
    ).toBe(false)
    expect(new Set(STIL_EIGENSCHAFTEN).size).toBe(STIL_EIGENSCHAFTEN.length)
  })

  it('eingefügte PNG/JPEG/WebP bis 5 MB bleiben unverändert; Nicht-Bilder werden abgewiesen', async () => {
    const png = new Blob(['x'], { type: 'image/png' })
    expect(await normalisiereBild(png)).toBe(png)
    expect(await normalisiereBild(new Blob(['x'], { type: 'text/plain' }))).toBeNull()
  })
})

describe('kontext', () => {
  it('hält Seite (Pfad + Query), Fenster mit Pixeldichte, Browser, Version und Konsole fest', () => {
    const k = sammleKontext()
    expect(k.route).toBe(`${window.location.pathname}${window.location.search}`)
    expect(k.viewport).toMatch(/^\d+×\d+ @[\d.]+x$/)
    expect(k.app_version).toBe('test')
    expect(Array.isArray(k.konsole)).toBe(true)
  })

  it('kurzBrowser: Chrome/Safari/Firefox/Edge mit System', () => {
    expect(
      kurzBrowser(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
      ),
    ).toBe('Chrome 141 · macOS')
    expect(
      kurzBrowser(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari 18.6 · iOS')
    expect(kurzBrowser('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0')).toBe(
      'Edge 141 · Windows',
    )
    expect(kurzBrowser(null)).toBe('–')
  })

  it('kurzTitel: Titel oder erste Zeile der Beschreibung, gekürzt mit …', () => {
    expect(kurzTitel({ titel: 'Pipeline', beschreibung: 'x' })).toBe('Pipeline')
    expect(kurzTitel({ titel: null, beschreibung: 'Erste Zeile\nzweite' })).toBe('Erste Zeile')
    expect(kurzTitel({ titel: null, beschreibung: 'a'.repeat(100) })).toHaveLength(80)
  })
})
