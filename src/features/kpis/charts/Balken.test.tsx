// charts/Balken: 31 Balken, Wochenende blass, heute in der Signalfarbe, Zukunft leer, Spitzenwert sichtbar; bei vielen Balken
// nur jede zweite Tagesnummer und nur ein Spitzentag mit dauerhaftem Wert, bei wenigen jeder Wert dauerhaft; dazu FunnelBalken.
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MEMBER_V } from '@/test/fixtures/leads'
import { isodow, tagPlus } from '@/lib/zeit'
import { leereSummen, tageswerte, type KpiZeile } from '../kennzahlen'
import { Balken } from './Balken'
import { FunnelBalken } from './FunnelBalken'

/** Karla Kennzahl schreibt im Oktober 2026 an vier Tagen Leute an (28 · 9 · 28 · 17). */
const ZEILEN: KpiZeile[] = (
  [
    ['2026-10-01', 28],
    ['2026-10-02', 9],
    ['2026-10-03', 28],
    ['2026-10-12', 17],
  ] as const
).map(([tag, angeschrieben]) => ({ member_id: MEMBER_V, tag, period: 'tag', ...leereSummen(), angeschrieben }))

describe('Balken', () => {
  it('rendert 31 Balken für Oktober: Wochenende blass, heute Signalfarbe, Zukunft ohne Balken, Spitzenwert sichtbar', () => {
    const tage = tageswerte(ZEILEN, '2026-10-01', '2026-10-31').map((t) => ({
      tag: t.tag,
      wert: t.werte.angeschrieben,
    }))
    const { container } = render(
      <Balken tage={tage} heute="2026-10-14" label="Balkendiagramm: Angeschrieben pro Tag" />,
    )
    expect(screen.getByRole('img', { name: 'Balkendiagramm: Angeschrieben pro Tag' })).toBeInTheDocument()
    const gruppen = container.querySelectorAll('g[data-tag]')
    expect(gruppen).toHaveLength(31)
    const art = (tag: string) => container.querySelector(`g[data-tag="${tag}"]`)?.getAttribute('data-art')
    expect(art('2026-10-01')).toBe('tag') // Donnerstag
    expect(art('2026-10-03')).toBe('wochenende') // Samstag
    expect(art('2026-10-04')).toBe('wochenende') // Sonntag
    expect(art('2026-10-14')).toBe('heute')
    expect(art('2026-10-15')).toBe('zukunft')
    expect(container.querySelectorAll('g[data-art="zukunft"]')).toHaveLength(17)
    expect(container.querySelectorAll('g[data-art="zukunft"] rect:not(.fill-transparent)')).toHaveLength(0)
    expect(container.querySelector('g[data-tag="2026-10-12"]')).toHaveAttribute('data-wert', '17')
    // Spitzenwert (28, der jüngste Tag damit) und heute zeigen den Wert immer, ein normaler Tag nur bei Hover
    expect(container.querySelector('g[data-tag="2026-10-03"] [data-wertlabel]')?.className.baseVal).toContain(
      'opacity-100',
    )
    expect(container.querySelector('g[data-tag="2026-10-01"] [data-wertlabel]')?.className.baseVal).toContain(
      'opacity-0',
    )
    expect(container.querySelector('g[data-tag="2026-10-14"] [data-wertlabel]')?.className.baseVal).toContain(
      'fill-signal',
    )
    expect(container.querySelector('g[data-tag="2026-10-02"] [data-wertlabel]')?.className.baseVal).toContain(
      'opacity-0',
    )
    expect(
      container.querySelector('g[data-tag="2026-10-14"] rect:not(.fill-transparent)')?.className.baseVal,
    ).toContain('fill-signal')
    expect(
      container.querySelector('g[data-tag="2026-10-03"] rect:not(.fill-transparent)')?.className.baseVal,
    ).toContain('fill-deco')
  })

  it('ein Monat: nur jeder zweite Tag trägt seine Nummer – heute immer; nichts unter 12 px', () => {
    const tage = tageswerte(ZEILEN, '2026-10-01', '2026-10-31').map((t) => ({
      tag: t.tag,
      wert: t.werte.angeschrieben,
    }))
    const nummern = (c: HTMLElement) => Array.from(c.querySelectorAll('[data-tagnummer]')).map((n) => n.textContent)
    // heute = 14.: die geraden Tage
    const { container, unmount } = render(<Balken tage={tage} heute="2026-10-14" label="Oktober" />)
    expect(nummern(container)).toEqual([
      '02',
      '04',
      '06',
      '08',
      '10',
      '12',
      '14',
      '16',
      '18',
      '20',
      '22',
      '24',
      '26',
      '28',
      '30',
    ])
    expect(container.querySelector('g[data-tag="2026-10-14"] [data-tagnummer]')?.className.baseVal).toContain(
      'fill-signal',
    )
    for (const t of container.querySelectorAll('text')) expect(t.className.baseVal).toContain('text-[12px]')
    unmount()
    // heute nicht im Zeitraum (Blick zurück): vom ersten Tag aus
    const zurueck = render(<Balken tage={tage} heute="2026-11-26" label="Oktober" />)
    expect(nummern(zurueck.container).slice(0, 3)).toEqual(['01', '03', '05'])
    expect(nummern(zurueck.container)).toHaveLength(16)
  })

  it('viele Balken: dauerhaft beschriftet sind nur heute und ein Spitzentag – nie zwei Nachbarn', () => {
    // 28.10.–26.11.2026 (30 Tage, heute = Donnerstag, 26.11.)
    const HEUTE = '2026-11-26'
    const dauerhaft = (wert: (tag: string) => number, heute = HEUTE) => {
      const tage = Array.from({ length: 30 }, (_, i) => tagPlus('2026-10-28', i)).map((tag) => ({
        tag,
        wert: wert(tag),
      }))
      const { container, unmount } = render(<Balken tage={tage} heute={heute} label="30 Tage" />)
      const tags = Array.from(container.querySelectorAll('g[data-tag]'))
        .filter((g) => g.querySelector('[data-wertlabel]')?.classList.contains('opacity-100'))
        .map((g) => g.getAttribute('data-tag'))
      unmount()
      return tags
    }
    const werktags = (tag: string) => (isodow(tag) >= 6 ? 0 : 20)

    // werktags immer 20: jeder Werktag ist „Spitze“ – beschriftet ist allein heute (statt „2020202020“)
    expect(dauerhaft(werktags)).toEqual([HEUTE])
    // gestern und heute derselbe Höchstwert: nur heute
    expect(dauerhaft((tag) => (tag >= '2026-11-25' ? 25 : 3))).toEqual([HEUTE])
    // Spitze gestern, heute weniger: heute hat Vorrang, die Spitze zeigt sich bei Hover
    expect(dauerhaft((tag) => (tag === '2026-11-25' ? 30 : 5))).toEqual([HEUTE])
    // Spitze gestern und an einem früheren Tag: der frühere trägt den Wert
    expect(dauerhaft((tag) => (tag === '2026-11-25' || tag === '2026-11-10' ? 30 : 5))).toEqual(['2026-11-10', HEUTE])
    // heute wenig, Spitze an mehreren Tagen: der jüngste davon
    expect(dauerhaft((tag) => (tag === HEUTE ? 2 : werktags(tag)))).toEqual(['2026-11-24', HEUTE])
    // Blick zurück (heute nicht im Zeitraum): genau ein Spitzentag
    expect(dauerhaft(werktags, '2026-12-20')).toEqual(['2026-11-26'])
  })

  it('eine Woche: jede Tagesnummer und jeder Wert über 0 stehen dauerhaft da – ohne Hover (Telefon)', () => {
    const tage = tageswerte(ZEILEN, '2026-09-28', '2026-10-04').map((t) => ({
      tag: t.tag,
      wert: t.werte.angeschrieben,
    }))
    const { container } = render(<Balken tage={tage} heute="2026-10-14" label="KW 40" />)
    expect(container.querySelectorAll('[data-tagnummer]')).toHaveLength(7)
    const sichtbar = (tag: string) =>
      container.querySelector(`g[data-tag="${tag}"] [data-wertlabel]`)?.classList.contains('opacity-100')
    expect(sichtbar('2026-10-01')).toBe(true) // 28, Spitzenwert
    expect(sichtbar('2026-10-02')).toBe(true) // 9
    expect(sichtbar('2026-10-03')).toBe(true) // 28
    // Nullen bleiben weg
    expect(sichtbar('2026-09-28')).toBe(false)
    expect(sichtbar('2026-10-04')).toBe(false)
  })

  it('ohne Tage oder ohne Werte: leeres Diagramm, kein Balken über der Grundlinie', () => {
    const { container, rerender } = render(<Balken tage={[]} heute="2026-10-14" label="leer" />)
    expect(container.querySelectorAll('g[data-tag]')).toHaveLength(0)
    rerender(<Balken tage={[{ tag: '2026-10-13', wert: 0 }]} heute="2026-10-14" label="leer" />)
    expect(container.querySelector('g[data-tag="2026-10-13"] rect:not(.fill-transparent)')).toHaveAttribute(
      'height',
      '0',
    )
  })

  it('FunnelBalken füllt anteilig, null bleibt leer, über 100 % ist der Balken voll', () => {
    const { container, rerender } = render(<FunnelBalken anteil={0.3} />)
    expect(container.querySelector('[data-funnel-balken]')).toHaveAttribute('data-anteil', '30')
    expect(container.querySelector('rect')).toHaveAttribute('width', '30.00%')
    rerender(<FunnelBalken anteil={null} />)
    expect(container.querySelector('[data-funnel-balken]')).not.toHaveAttribute('data-anteil')
    expect(container.querySelector('rect')).toBeNull()
    rerender(<FunnelBalken anteil={1.25} />)
    expect(container.querySelector('rect')).toHaveAttribute('width', '100.00%')
  })
})
