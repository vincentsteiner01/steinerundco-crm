// Editor (LF-04): `[` öffnet die Platzhalter-Liste, Auswahl fügt `[Nachname]` ein, Filter engt ein, ⌘Enter speichert,
// Betreff nur bei E-Mail, Platzhalter-Chips (unbekannte Amber).
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { Channel } from '@/types/domain'
import { Editor, type EditorWert } from './Editor'

function Huelle({
  kanal = 'linkedin',
  start = '',
  onSpeichern = () => {},
}: {
  kanal?: Channel
  start?: string
  onSpeichern?: () => void
}) {
  const [wert, setWert] = useState<EditorWert>({ subject: '', body: start })
  return (
    <>
      <Editor kanal={kanal} wert={wert} onChange={setWert} onSpeichern={onSpeichern} />
      <output data-testid="body">{wert.body}</output>
      <output data-testid="subject">{wert.subject}</output>
    </>
  )
}

const textarea = () => screen.getByLabelText('Text') as HTMLTextAreaElement

/** Tippt `text` an Position `caret` (setzt value + selectionStart, feuert change). */
function tippe(el: HTMLTextAreaElement, value: string, caret = value.length) {
  fireEvent.change(el, { target: { value, selectionStart: caret, selectionEnd: caret } })
}

describe('Editor', () => {
  it('„[“ öffnet die Liste mit allen Platzhaltern; Klick fügt [Nachname] ein (LF-04)', () => {
    render(<Huelle start="Hallo " />)
    const ta = textarea()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    tippe(ta, 'Hallo [')
    const liste = screen.getByRole('listbox', { name: 'Platzhalter' })
    expect(liste).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(24)
    expect(screen.getByRole('option', { name: /\[Vorname\]/ })).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByRole('option', { name: /\[Nachname\]/ }))
    expect(screen.getByTestId('body')).toHaveTextContent('Hallo [Nachname]')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('Filter nach „[“ engt die Liste ein; ↓ und ↵ übernehmen; Esc schließt', () => {
    render(<Huelle />)
    const ta = textarea()
    tippe(ta, '[')
    tippe(ta, '[nachn')
    const optionen = screen.getAllByRole('option').map((o) => o.textContent)
    expect(optionen[0]).toContain('[Nachname]')
    expect(optionen).toHaveLength(2)
    fireEvent.keyDown(ta, { key: 'ArrowDown' })
    expect(screen.getByRole('option', { name: /Absender Nachname/ })).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(ta, { key: 'Enter' })
    expect(screen.getByTestId('body')).toHaveTextContent('[Absender Nachname]')
    tippe(ta, '[Absender Nachname] [')
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    fireEvent.keyDown(ta, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('„]“ getippt oder leerer Filter ohne Treffer schließt bzw. zeigt Hinweis', () => {
    render(<Huelle />)
    const ta = textarea()
    tippe(ta, '[')
    tippe(ta, '[xyz')
    expect(screen.getByText('Kein Platzhalter „xyz“.')).toBeInTheDocument()
    tippe(ta, '[xyz]')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('⌘Enter speichert, Enter allein nicht', () => {
    const speichern = vi.fn()
    render(<Huelle start="Text" onSpeichern={speichern} />)
    fireEvent.keyDown(textarea(), { key: 'Enter' })
    expect(speichern).not.toHaveBeenCalled()
    fireEvent.keyDown(textarea(), { key: 'Enter', metaKey: true })
    expect(speichern).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(textarea(), { key: 'Enter', ctrlKey: true })
    expect(speichern).toHaveBeenCalledTimes(2)
  })

  it('Betreff-Feld nur bei E-Mail; Chips für jeden Platzhalter, unbekannte Amber', () => {
    const { unmount } = render(<Huelle start="Hallo [Vorname] und [Quatsch]" />)
    expect(screen.queryByLabelText('Betreff')).not.toBeInTheDocument()
    const chips = screen.getByLabelText('Platzhalter im Text')
    expect(chips).toHaveTextContent('[Vorname]')
    expect(chips).toHaveTextContent('[Quatsch]')
    expect(screen.getByTitle('Unbekannter Platzhalter – wird nie gefüllt')).toHaveTextContent('[Quatsch]')
    unmount()
    render(<Huelle kanal="email" />)
    const betreff = screen.getByLabelText('Betreff')
    fireEvent.change(betreff, { target: { value: 'Hallo [Vorname]' } })
    expect(screen.getByTestId('subject')).toHaveTextContent('Hallo [Vorname]')
    expect(screen.getByLabelText('Platzhalter im Text')).toHaveTextContent('[Vorname]')
  })
})
