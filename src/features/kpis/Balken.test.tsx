// charts/Balken: 31 Balken, Wochenende deco, heute Lime, Zukunft leer, Peak-Wert sichtbar; FunnelBalken und Sparkline.
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Balken } from './charts/Balken'
import { FunnelBalken } from './charts/FunnelBalken'
import { Sparkline } from './charts/Sparkline'
import { tageDerSpanne } from './zeitraum'

describe('Balken', () => {
  it('rendert 31 Balken für Oktober: Wochenende deco, heute Lime, Zukunft ohne Balken, Peak mit sichtbarem Wert', () => {
    const werte: Record<string, number> = { '2026-10-01': 28, '2026-10-02': 9, '2026-10-03': 28, '2026-10-12': 17 }
    const tage = tageDerSpanne('2026-10-01', '2026-10-31').map((tag) => ({ tag, wert: werte[tag] ?? 0 }))
    const { container } = render(
      <Balken tage={tage} heute="2026-10-14" label="Balkendiagramm: Gespräche eröffnet pro Tag" />,
    )
    expect(screen.getByRole('img', { name: 'Balkendiagramm: Gespräche eröffnet pro Tag' })).toBeInTheDocument()
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
    // Peak (28) und heute zeigen den Wert immer, ein normaler Tag nur bei Hover
    expect(container.querySelector('g[data-tag="2026-10-01"] [data-wertlabel]')?.className.baseVal).toContain(
      'opacity-100',
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

  it('FunnelBalken füllt anteilig, null bleibt leer', () => {
    const { container, rerender } = render(<FunnelBalken anteil={0.3} />)
    expect(container.querySelector('[data-funnel-balken]')).toHaveAttribute('data-anteil', '30')
    expect(container.querySelector('rect')).toHaveAttribute('width', '30.00%')
    rerender(<FunnelBalken anteil={null} />)
    expect(container.querySelector('[data-funnel-balken]')).not.toHaveAttribute('data-anteil')
    expect(container.querySelector('rect')).toBeNull()
  })

  it('Sparkline zeichnet eine Linie über die Werte', () => {
    const { container } = render(<Sparkline werte={[1, 3, 2, 5]} label="Sendungen je Woche" />)
    expect(screen.getByRole('img', { name: 'Sendungen je Woche' })).toBeInTheDocument()
    expect(container.querySelector('polyline')?.getAttribute('points')?.split(' ')).toHaveLength(4)
  })
})
