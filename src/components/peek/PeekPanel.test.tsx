// PeekPanel: Overlay mit Scrim, „n von m“, ←/→ über uiStore.peekListe, Esc schließt (nicht aus Eingabefeld), Fokusfalle, Scroll-Sperre
import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, useSearchParams } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUiStore } from '@/app/uiStore'
import { _akkordZuruecksetzen } from '@/lib/keyboard'
import { PeekPanel } from './PeekPanel'

function Seite({ kopfRechts }: { kopfRechts?: React.ReactNode }) {
  const [params] = useSearchParams()
  const leadId = params.get('lead')
  return (
    <>
      <button type="button">Außen</button>
      <p data-testid="lead">{leadId ?? '–'}</p>
      {leadId ? (
        <PeekPanel leadId={leadId} kopfRechts={kopfRechts}>
          <input aria-label="Notiz" />
          <button type="button">Innen</button>
        </PeekPanel>
      ) : null}
    </>
  )
}

function rendern(start = '/leads?lead=b', kopfRechts?: React.ReactNode) {
  const router = createMemoryRouter([{ path: '/leads', element: <Seite kopfRechts={kopfRechts} /> }], {
    initialEntries: [start],
  })
  render(<RouterProvider router={router} />)
  return router
}

const taste = (key: string, ziel: Element = document.body) => fireEvent.keyDown(ziel, { key })

describe('PeekPanel', () => {
  beforeEach(() => {
    useUiStore.setState({ hotkeyScope: 'global', scopeStack: [], peekLeadId: null, peekListe: ['a', 'b', 'c'] })
    _akkordZuruecksetzen()
    document.body.style.overflow = ''
  })

  it('zeigt Position „2 von 3“, Scrim und Dialog-Semantik; setzt uiStore.peekLeadId', () => {
    rendern()
    expect(screen.getByText('2 von 3')).toBeInTheDocument()
    const dialog = screen.getByRole('dialog', { name: 'Lead-Detail' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('data-modus', 'overlay')
    expect(document.querySelector('[data-scrim]')).toBeInTheDocument()
    expect(useUiStore.getState().peekLeadId).toBe('b')
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('→ und ← wechseln den Lead über peekListe (zyklisch), Buttons ebenso', () => {
    const router = rendern()
    taste('ArrowRight')
    expect(router.state.location.search).toBe('?lead=c')
    taste('ArrowRight')
    expect(router.state.location.search).toBe('?lead=a')
    taste('ArrowLeft')
    expect(router.state.location.search).toBe('?lead=c')
    fireEvent.click(screen.getByRole('button', { name: 'Voriger Lead' }))
    expect(router.state.location.search).toBe('?lead=b')
    fireEvent.click(screen.getByRole('button', { name: 'Nächster Lead' }))
    expect(router.state.location.search).toBe('?lead=c')
  })

  it('Esc schließt (entfernt ?lead=), gibt die Scroll-Sperre frei; Esc im Eingabefeld schließt nicht', () => {
    const router = rendern()
    const feld = screen.getByLabelText('Notiz')
    feld.focus()
    taste('Escape', feld)
    expect(router.state.location.search).toBe('?lead=b')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    taste('Escape')
    expect(router.state.location.search).toBe('')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.body.style.overflow).toBe('')
  })

  it('Schließen-Button und Scrim-Klick schließen', () => {
    const router = rendern()
    fireEvent.click(screen.getByRole('button', { name: /Schließen/ }))
    expect(router.state.location.search).toBe('')
  })

  it('Fokus liegt im Panel, Tab bleibt im Panel (Fokusfalle) und kehrt beim Schließen zurück', () => {
    rendern()
    const aussen = screen.getByRole('button', { name: 'Außen' })
    const dialog = screen.getByRole('dialog')
    expect(dialog.contains(document.activeElement)).toBe(true)
    const innen = screen.getByRole('button', { name: 'Innen' })
    innen.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(dialog.contains(document.activeElement)).toBe(true)
    expect(document.activeElement).not.toBe(innen)
    aussen.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(dialog.contains(document.activeElement)).toBe(true)
    taste('Escape')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('rendert den Slot rechts im Kopf und ohne Listen-Position keine Pfeile', () => {
    useUiStore.setState({ peekListe: [] })
    rendern('/leads?lead=b', <span>Icons</span>)
    expect(screen.getByText('Icons')).toBeInTheDocument()
    expect(screen.queryByText(/von/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nächster Lead' })).not.toBeInTheDocument()
  })

  it('≥ 1600 px: dritte Spalte ohne Scrim, ohne Scroll-Sperre; < 1024 px: Sheet mit Griff', () => {
    const alt = window.matchMedia
    const mq = (treffer: (q: string) => boolean) =>
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: (q: string) => ({
          matches: treffer(q),
          media: q,
          addEventListener: () => {},
          removeEventListener: () => {},
        }),
      })
    try {
      mq((q) => q.includes('1600'))
      const { unmount } = render(
        <RouterProvider
          router={createMemoryRouter([{ path: '/leads', element: <Seite /> }], { initialEntries: ['/leads?lead=a'] })}
        />,
      )
      const spalte = screen.getByRole('complementary', { name: 'Lead-Detail' })
      expect(spalte).toHaveAttribute('data-modus', 'spalte')
      expect(document.querySelector('[data-scrim]')).not.toBeInTheDocument()
      expect(document.body.style.overflow).toBe('')
      unmount()

      mq((q) => q.includes('1023'))
      vi.spyOn(window, 'matchMedia')
      render(
        <RouterProvider
          router={createMemoryRouter([{ path: '/leads', element: <Seite /> }], { initialEntries: ['/leads?lead=a'] })}
        />,
      )
      expect(screen.getByRole('dialog')).toHaveAttribute('data-modus', 'sheet')
    } finally {
      Object.defineProperty(window, 'matchMedia', { configurable: true, value: alt })
    }
  })
})
