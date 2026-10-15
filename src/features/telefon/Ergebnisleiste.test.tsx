// Ergebnisleiste: 15 Tasten in drei Gruppen, D in danger, Auswahl (BAUPLAN § 3.4, ux § 3.5.3)
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Ergebnisleiste } from './Ergebnisleiste'
import { ERGEBNIS_TASTEN, ERGEBNISSE, ergebnisseMit } from './ergebnisse'

describe('Ergebnisleiste', () => {
  it('zeigt 15 Buttons mit Tastenhinweis in den Gruppen A · B · C', () => {
    const onWaehlen = vi.fn()
    render(<Ergebnisleiste ergebnisse={ERGEBNISSE} gewaehlt={null} onWaehlen={onWaehlen} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(15)
    expect(buttons.map((b) => b.getAttribute('data-taste'))).toEqual([...ERGEBNIS_TASTEN])
    expect(ERGEBNIS_TASTEN.join(' ')).toBe('1 2 3 4 X 5 6 7 8 9 0 W K Q D')
    expect(screen.getByRole('group', { name: 'A · Nicht erreicht' }).querySelectorAll('button')).toHaveLength(5)
    expect(screen.getByRole('group', { name: 'B · Zentrale' }).querySelectorAll('button')).toHaveLength(3)
    expect(screen.getByRole('group', { name: 'C · Entscheider' }).querySelectorAll('button')).toHaveLength(7)
    expect(screen.getByRole('button', { name: /Werbewiderspruch/ })).toHaveClass('text-danger')
    fireEvent.click(screen.getByRole('button', { name: /Rückruf vereinbart/ }))
    expect(onWaehlen).toHaveBeenCalledWith(expect.objectContaining({ taste: '7', outcome: 'callback_scheduled' }))
  })

  it('markiert das gewählte Ergebnis (aria-pressed + Lime-Rahmen); mobil ohne Tastenhinweis und 48 px', () => {
    const { rerender } = render(<Ergebnisleiste ergebnisse={ERGEBNISSE} gewaehlt="5" onWaehlen={() => {}} />)
    const fuenf = screen.getByRole('button', { name: /Entscheider nicht erreichbar/ })
    expect(fuenf).toHaveAttribute('aria-pressed', 'true')
    expect(fuenf).toHaveClass('border-signal')
    expect(fuenf.querySelector('kbd')).toHaveTextContent('5')
    rerender(<Ergebnisleiste ergebnisse={ERGEBNISSE} gewaehlt={null} onWaehlen={() => {}} gross />)
    const btn = screen.getByRole('button', { name: /Nicht erreicht$/ })
    expect(btn.querySelector('kbd')).toBeNull()
    expect(btn).toHaveClass('h-12')
  })

  it('übernimmt Hotkey und Langtext aus call_outcome_defs, Gruppen bleiben statisch', () => {
    const defs = ERGEBNISSE.map((e) => ({
      outcome: e.outcome,
      label: `DB ${e.kurz}`,
      hotkey: e.taste === 'D' ? 'd' : e.taste,
      group_label: 'x',
      is_connect: false,
      is_dm: false,
      counts_attempt: e.outcome !== 'busy',
      default_next_action: null,
      sort_order: 1,
    }))
    const liste = ergebnisseMit(defs)
    expect(liste.map((e) => e.taste)).toEqual([...ERGEBNIS_TASTEN])
    expect(liste[0]?.label).toBe('DB Nicht erreicht')
    expect(liste.find((e) => e.outcome === 'busy')?.zaehltVersuch).toBe(false)
    expect(ergebnisseMit([])).toBe(ERGEBNISSE)
  })
})
