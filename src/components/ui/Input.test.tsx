// Input (Fund 37, 25.11.2026): iOS zoomt beim Antippen in Felder unter 16 px. Größe L (alles Neue: Board, Lead-Blatt,
// Einstellungen, Anmelden) hat deshalb am Telefon 16 px; Größe M (E-Mail-Bereich) bleibt, wie sie ist.
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Input } from './Input'

describe('Input', () => {
  it('Größe L: 15 px, am Telefon (unter 768 px) 16 px, 44 px hoch', () => {
    render(<Input groesse="L" aria-label="Vorname" />)
    const feld = screen.getByLabelText('Vorname')
    expect(feld).toHaveClass('text-[15px]', 'max-md:text-[16px]')
    expect(feld.parentElement).toHaveClass('h-11')
  })

  it('Größe M (Standard, E-Mail-Bereich) bleibt unverändert: Schriftgröße des Systems, 36 px hoch, keine Telefon-Regel', () => {
    render(<Input aria-label="Betreff" />)
    const feld = screen.getByLabelText('Betreff')
    expect(feld).toHaveClass('text-ui')
    expect(feld.className).not.toMatch(/text-\[1[56]px\]/)
    expect(feld.parentElement).toHaveClass('h-9')
  })
})
