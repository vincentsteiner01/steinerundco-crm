// Sheet und Dialog (25.11.2026, Neustart): zwei optionale Eigenschaften für das Neue – `ruhig` (Sheet: kein Tastenhinweis,
// Schließen als × mit 44 px) und `gross` (Dialog: Knöpfe 44 px). Ohne Angabe bleibt alles wie bisher – so benutzt es der
// E-Mail-Bereich (Composer, Erlaubnis, Bounce …).
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Dialog } from './Dialog'
import { Sheet } from './Sheet'

describe('Sheet', () => {
  it('Standard (E-Mail-Composer): „Schließen“ mit der Marke Esc, klein wie bisher', () => {
    const zu = vi.fn()
    render(
      <Sheet offen onOpenChange={zu} titel="E-Mail verfassen">
        Inhalt
      </Sheet>,
    )
    const blatt = within(screen.getByRole('dialog', { name: 'E-Mail verfassen' }))
    const knopf = blatt.getByRole('button', { name: /Schließen/ })
    expect(knopf).toHaveTextContent('SchließenEsc')
    expect(knopf.querySelector('kbd')).toHaveTextContent('Esc')
    expect(knopf).toHaveClass('h-7')
    fireEvent.click(knopf)
    expect(zu).toHaveBeenCalledWith(false)
  })

  it('ruhig (Lead-Blatt): kein Tastenhinweis, Schließen als × mit 44-px-Fläche und Namen für Screenreader', () => {
    const zu = vi.fn()
    render(
      <Sheet offen onOpenChange={zu} titel="Petra Probelauf" ruhig>
        Inhalt
      </Sheet>,
    )
    const blatt = screen.getByRole('dialog', { name: 'Petra Probelauf' })
    expect(blatt.querySelector('kbd')).toBeNull()
    const knopf = within(blatt).getByRole('button', { name: 'Schließen' })
    expect(knopf).toHaveTextContent(/^$/)
    expect(knopf).toHaveClass('size-11')
    fireEvent.click(knopf)
    expect(zu).toHaveBeenCalledWith(false)
  })

  it('Esc meldet in beiden Fällen onOpenChange(false) – ob geschlossen wird, entscheidet der Aufrufer', () => {
    const zu = vi.fn()
    render(
      <Sheet offen onOpenChange={zu} titel="Petra Probelauf" ruhig>
        <input aria-label="Notiz" />
      </Sheet>,
    )
    fireEvent.keyDown(screen.getByLabelText('Notiz'), { key: 'Escape' })
    expect(zu).toHaveBeenCalledWith(false)
    // gesteuert: ohne Zustimmung des Aufrufers bleibt das Blatt offen
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('Dialog', () => {
  const primaer = { label: 'Löschen', onClick: vi.fn() }

  it('Standard: Knöpfe 36 px wie bisher', () => {
    render(<Dialog offen onOpenChange={vi.fn()} titel="Bounce erfassen?" primaer={primaer} />)
    const d = within(screen.getByRole('dialog', { name: 'Bounce erfassen?' }))
    expect(d.getByRole('button', { name: 'Abbrechen' })).toHaveClass('h-9')
    expect(d.getByRole('button', { name: 'Löschen' })).toHaveClass('h-9', 'bg-signal')
  })

  it('gross: beide Knöpfe 44 px', () => {
    render(
      <Dialog
        gross
        offen
        onOpenChange={vi.fn()}
        titel="Änderungen verwerfen?"
        primaer={primaer}
        abbrechen="Weiter bearbeiten"
      />,
    )
    const d = within(screen.getByRole('dialog', { name: 'Änderungen verwerfen?' }))
    expect(d.getByRole('button', { name: 'Weiter bearbeiten' })).toHaveClass('h-11')
    expect(d.getByRole('button', { name: 'Löschen' })).toHaveClass('h-11')
    expect(d.getByRole('button', { name: 'Löschen' })).not.toHaveClass('h-9')
  })

  // E-Mail-Bereich „keine Design-Änderungen“: dort (ohne `gross`) war der Bestätigungsknopf immer blau
  it('danger: rot nur in den neuen, großen Dialogen – ohne `gross` bleibt der Knopf blau wie vor dem Neustart', () => {
    const gefaehrlich = { ...primaer, danger: true }
    const { unmount } = render(<Dialog offen onOpenChange={vi.fn()} titel="Bounce erfassen?" primaer={gefaehrlich} />)
    const klein = screen.getByRole('button', { name: 'Löschen' })
    expect(klein).toHaveClass('bg-signal', 'h-9')
    expect(klein).not.toHaveClass('bg-danger')
    unmount()
    render(<Dialog gross offen onOpenChange={vi.fn()} titel="Eintrag entfernen" primaer={gefaehrlich} />)
    const gross = screen.getByRole('button', { name: 'Löschen' })
    expect(gross).toHaveClass('bg-danger', 'h-11')
    expect(gross).not.toHaveClass('bg-signal')
  })
})

// Fund 36 (25.11.2026): Sheet und Dialog haben keinen Radix-Auslöser – nach dem Schließen fiel der Fokus auf <body>, Tab begann
// wieder am Seitenanfang. Jetzt geht er zurück auf das Element, von dem aus geöffnet wurde.
describe('Fokus nach dem Schließen', () => {
  function MitDialog({ mitFeld }: { mitFeld?: boolean }) {
    const [offen, setOffen] = useState(false)
    return (
      <>
        <button type="button" onClick={() => setOffen(true)}>
          Eintrag entfernen
        </button>
        <button type="button">Anderer Knopf</button>
        <Dialog
          offen={offen}
          onOpenChange={setOffen}
          titel="Eintrag entfernen?"
          primaer={{ label: 'Entfernen', onClick: () => setOffen(false) }}
          kinder={mitFeld ? <textarea aria-label="Zitat" autoFocus /> : undefined}
        />
      </>
    )
  }

  it('Dialog: „Abbrechen“, Esc und der Bestätigungsknopf geben den Fokus an den auslösenden Knopf zurück', async () => {
    render(<MitDialog />)
    const knopf = screen.getByRole('button', { name: 'Eintrag entfernen' })
    for (const schliessen of [
      () => fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' })),
      () => fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' }),
      () => fireEvent.click(screen.getByRole('button', { name: 'Entfernen' })),
    ]) {
      knopf.focus()
      fireEvent.click(knopf)
      await screen.findByRole('dialog', { name: 'Eintrag entfernen?' })
      // der Fokus ist im Dialog angekommen
      await waitFor(() => expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement))
      schliessen()
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      await waitFor(() => expect(knopf).toHaveFocus())
    }
  })

  it('Dialog mit autoFocus-Feld: gemerkt wird der Knopf, nicht das Feld im Dialog', async () => {
    render(<MitDialog mitFeld />)
    const knopf = screen.getByRole('button', { name: 'Eintrag entfernen' })
    knopf.focus()
    fireEvent.click(knopf)
    await waitFor(() => expect(screen.getByLabelText('Zitat')).toHaveFocus())
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    await waitFor(() => expect(knopf).toHaveFocus())
  })

  function MitSheet({ ersatz }: { ersatz?: () => HTMLElement | null }) {
    const [offen, setOffen] = useState(false)
    const [karteDa, setKarteDa] = useState(true)
    return (
      <>
        {karteDa ? (
          <button type="button" onClick={() => setOffen(true)}>
            Petra Probelauf
          </button>
        ) : null}
        <button type="button">Max Muster</button>
        {/* wie das Lead-Blatt: erst eingehängt, wenn es offen ist */}
        {offen ? (
          <Sheet offen onOpenChange={setOffen} titel="Lead" ruhig fokusErsatz={ersatz}>
            <input aria-label="Vorname" />
            <button type="button" onClick={() => setKarteDa(false)}>
              Karte entfernen
            </button>
          </Sheet>
        ) : null}
      </>
    )
  }

  it('Sheet: nach „Schließen“ liegt der Fokus wieder auf der Karte, von der aus geöffnet wurde', async () => {
    render(<MitSheet />)
    const karte = screen.getByRole('button', { name: 'Petra Probelauf' })
    karte.focus()
    fireEvent.click(karte)
    await screen.findByRole('dialog', { name: 'Lead' })
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(karte).toHaveFocus())
  })

  it('Sheet: gibt es die Karte nicht mehr, bekommt das Ersatzziel den Fokus', async () => {
    render(<MitSheet ersatz={() => screen.getByRole('button', { name: 'Max Muster' })} />)
    const karte = screen.getByRole('button', { name: 'Petra Probelauf' })
    karte.focus()
    fireEvent.click(karte)
    await screen.findByRole('dialog', { name: 'Lead' })
    fireEvent.click(screen.getByRole('button', { name: 'Karte entfernen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Max Muster' })).toHaveFocus())
  })

  it('ohne Auslöser und ohne Ersatz (E-Mail-Composer als eigene Seite) bleibt es wie bisher: kein Fehler, kein fremdes Ziel', async () => {
    function Seite() {
      const [offen, setOffen] = useState(true)
      return (
        <>
          <button type="button">Unbeteiligt</button>
          <Sheet offen={offen} onOpenChange={setOffen} titel="E-Mail verfassen">
            Inhalt
          </Sheet>
        </>
      )
    }
    render(<Seite />)
    fireEvent.click(await screen.findByRole('button', { name: /Schließen/ }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    // Radix' eigener Timer ist durch: der Fokus liegt auf keinem fremden Element
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.getByRole('button', { name: 'Unbeteiligt' })).not.toHaveFocus()
  })
})
