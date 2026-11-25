// PlatzhalterChips (Neustart 25.11.2026): Klick fügt „[Name]“ an der Cursor-Position ein, ersetzt eine Auswahl, der Fokus bleibt im Text.
// Der Test liegt hier, weil die Chips zur Teilaufgabe Leitfäden gehören (Baustein: src/components/PlatzhalterChips.tsx).
import { fireEvent, render, screen } from '@testing-library/react'
import { useRef, useState } from 'react'
import { describe, expect, it } from 'vitest'
import { PlatzhalterChips } from '@/components/PlatzhalterChips'

function Probe({ start = '' }: { start?: string }) {
  const feld = useRef<HTMLTextAreaElement | null>(null)
  const [wert, setWert] = useState(start)
  return (
    <>
      <textarea ref={feld} aria-label="Text" value={wert} onChange={(e) => setWert(e.target.value)} />
      <PlatzhalterChips namen={['Anrede', 'Vorname', 'Absender Vorname']} feld={feld} wert={wert} onChange={setWert} />
    </>
  )
}

const text = () => screen.getByLabelText('Text') as HTMLTextAreaElement
const chip = (name: string) => screen.getByRole('button', { name })

describe('PlatzhalterChips', () => {
  it('fügt an der Cursor-Position ein; Cursor steht danach hinter der Marke, der Fokus bleibt im Text', () => {
    render(<Probe start="Hallo , wie geht es?" />)
    text().focus()
    text().setSelectionRange(6, 6)
    fireEvent.click(chip('Vorname'))
    expect(text()).toHaveValue('Hallo [Vorname], wie geht es?')
    expect(text().selectionStart).toBe(15)
    expect(text().selectionEnd).toBe(15)
    expect(document.activeElement).toBe(text())
  })

  it('zwei Chips nacheinander landen hintereinander an derselben Stelle', () => {
    render(<Probe start="Guten Tag ," />)
    text().focus()
    text().setSelectionRange(10, 10)
    fireEvent.click(chip('Anrede'))
    fireEvent.click(chip('Vorname'))
    expect(text()).toHaveValue('Guten Tag [Anrede][Vorname],')
    expect(text().selectionStart).toBe(27) // 10 + „[Anrede]“ (8) + „[Vorname]“ (9)
  })

  it('ersetzt eine markierte Stelle', () => {
    render(<Probe start="Hallo NAME, bis bald" />)
    text().focus()
    text().setSelectionRange(6, 10)
    fireEvent.click(chip('Absender Vorname'))
    expect(text()).toHaveValue('Hallo [Absender Vorname], bis bald')
    expect(text().selectionStart).toBe(24)
  })

  it('stand der Cursor noch nie im Text, hängt die Marke ans Ende', () => {
    render(<Probe start="Viele Grüße " />)
    fireEvent.click(chip('Absender Vorname'))
    expect(text()).toHaveValue('Viele Grüße [Absender Vorname]')
    expect(document.activeElement).toBe(text())
  })

  it('Maus und Finger nehmen dem Text den Fokus nicht weg (mousedown wird abgefangen)', () => {
    render(<Probe />)
    // fireEvent liefert false, wenn preventDefault aufgerufen wurde
    expect(fireEvent.mouseDown(chip('Anrede'))).toBe(false)
  })

  it('die Leiste ist als Gruppe benannt, jeder Chip ist ein echter Knopf', () => {
    render(<Probe />)
    const gruppe = screen.getByRole('group', { name: 'Platzhalter einfügen' })
    expect(gruppe.querySelectorAll('button[type="button"]')).toHaveLength(3)
  })
})
