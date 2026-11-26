// Toasts (25.11.2026, Neustart): die Knöpfe zeigen keine Tastenmarken mehr („Rückgängig“ statt „Rückgängig Z“) – die Tasten
// selbst wirken weiter, weil die Hülle `undoAusfuehren`/`retryAusfuehren`/`fehlerSchliessen` ruft (GlobaleTasten: Z, R, Esc).
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// jeder Toast bekommt wie bei sonner eine eigene ID
const sonner = vi.hoisted(() => {
  let n = 0
  return { custom: vi.fn((..._a: unknown[]) => ++n), dismiss: vi.fn() }
})
vi.mock('sonner', () => ({ toast: sonner }))

import { useUiStore } from '@/app/uiStore'
import {
  fehlerSchliessen,
  hatFehlerToast,
  registriereUndo,
  retryAusfuehren,
  toast,
  toastFehler,
  toastUndo,
  undoAusfuehren,
} from './toast'

/** Was sonner zuletzt anzeigen sollte. */
const zeigen = () => {
  const bauen = sonner.custom.mock.calls.at(-1)?.[0] as () => ReactElement
  return render(bauen())
}

/** Der Knopf des n-ten Toasts dieses Tests. */
const knopfVon = (aufruf: number) => {
  const bauen = sonner.custom.mock.calls[aufruf]?.[0] as () => ReactElement
  return render(bauen()).container.querySelector('button') as HTMLButtonElement
}
/** Die ID, die sonner dem n-ten Toast dieses Tests gegeben hat. */
const idVon = (aufruf: number) => sonner.custom.mock.results[aufruf]?.value as number
const optionenVon = (aufruf: number) =>
  sonner.custom.mock.calls[aufruf]![1] as { onDismiss: () => void; onAutoClose: () => void }
/** sonner ruft nach `dismiss()` (einen Moment später) `onDismiss` – hier von Hand nachgestellt. */
const schliesse = (aufruf: number) => optionenVon(aufruf).onDismiss()
const laeuftAb = (aufruf: number) => optionenVon(aufruf).onAutoClose()

beforeEach(() => {
  sonner.custom.mockClear()
  sonner.dismiss.mockClear()
  fehlerSchliessen()
  useUiStore.setState({ letzterUndo: null })
})

describe('Toasts ohne Tastenhinweise', () => {
  it('neutral: nur der Text', () => {
    toast('Gespeichert.')
    const { container } = zeigen()
    expect(screen.getByRole('status')).toHaveTextContent(/^Gespeichert\.$/)
    expect(container.querySelector('button, kbd')).toBeNull()
  })

  it('Rückgängig: Knopf ohne Marke; Klick und die Taste Z (undoAusfuehren) nehmen zurück', async () => {
    const zurueck = vi.fn()
    toastUndo('Jetzt in „Gespräch vereinbart“.', zurueck)
    const { container } = zeigen()
    expect(container.querySelector('kbd')).toBeNull()
    expect(screen.getByRole('button', { name: 'Rückgängig' })).toHaveTextContent(/^Rückgängig$/)
    fireEvent.click(screen.getByRole('button', { name: 'Rückgängig' }))
    await vi.waitFor(() => expect(zurueck).toHaveBeenCalledTimes(1))

    // derselbe Weg, den die Taste Z geht
    const nochmal = vi.fn()
    toastUndo('Karte entfernt.', nochmal)
    expect(await undoAusfuehren()).toBe(true)
    expect(nochmal).toHaveBeenCalledTimes(1)
    // einmal ist genug: danach gibt es nichts mehr zurückzunehmen
    expect(await undoAusfuehren()).toBe(false)
  })

  it('Fehler mit Wiederholen: „Erneut versuchen“ ohne Marke; die Taste R (retryAusfuehren) wiederholt', () => {
    const nochmal = vi.fn()
    toastFehler('Das hat nicht geklappt.', nochmal)
    const { container } = zeigen()
    expect(screen.getByRole('alert')).toHaveTextContent('Das hat nicht geklappt.')
    expect(container.querySelector('kbd')).toBeNull()
    expect(screen.getByRole('button', { name: 'Erneut versuchen' })).toHaveTextContent(/^Erneut versuchen$/)
    expect(retryAusfuehren()).toBe(true)
    expect(nochmal).toHaveBeenCalledTimes(1)
    expect(hatFehlerToast()).toBe(false)
  })

  it('Fehler ohne Wiederholen: „Schließen“ ohne Marke; Esc (fehlerSchliessen) schließt', () => {
    toastFehler('Keine Verbindung.')
    const { container } = zeigen()
    expect(container.querySelector('kbd')).toBeNull()
    expect(screen.getByRole('button', { name: 'Schließen' })).toHaveTextContent(/^Schließen$/)
    expect(hatFehlerToast()).toBe(true)
    expect(fehlerSchliessen()).toBe(true)
    expect(sonner.dismiss).toHaveBeenCalled()
    expect(hatFehlerToast()).toBe(false)
  })
})

// 25.11.2026: Zwei Züge kurz nacheinander ergaben zwei wortgleiche Toasts – „Rückgängig“ am älteren nahm den neueren Zug
// zurück, der zweite Klick tat nichts. Jetzt steht immer nur ein Rückgängig-Toast, und jeder Knopf kennt sein eigenes Ziel.
describe('zwei Züge kurz nacheinander', () => {
  it('der neue Rückgängig-Toast schließt den vorigen; Klick nimmt nur den letzten Zug zurück, Z danach nichts mehr', async () => {
    const a = vi.fn()
    const b = vi.fn()
    toastUndo('Jetzt in „Verloren“.', a)
    toastUndo('Jetzt in „Verloren“.', b)
    expect(sonner.dismiss).toHaveBeenCalledWith(idVon(0))
    expect(sonner.dismiss).not.toHaveBeenCalledWith(idVon(1))
    schliesse(0)
    fireEvent.click(knopfVon(1))
    await vi.waitFor(() => expect(b).toHaveBeenCalledTimes(1))
    expect(a).not.toHaveBeenCalled()
    expect(sonner.dismiss).toHaveBeenLastCalledWith(idVon(1))
    schliesse(1)
    expect(await undoAusfuehren()).toBe(false)
    expect(useUiStore.getState().letzterUndo).toBeNull()
  })

  it('die Taste Z nimmt ebenfalls nur den letzten Zug zurück', async () => {
    const a = vi.fn()
    const b = vi.fn()
    toastUndo('Jetzt in „Verloren“.', a)
    toastUndo('Jetzt in „Verloren“.', b)
    schliesse(0)
    expect(await undoAusfuehren()).toBe(true)
    expect(b).toHaveBeenCalledTimes(1)
    expect(a).not.toHaveBeenCalled()
    // der Knopf des noch stehenden Toasts ist danach tot – nichts geht doppelt zurück
    fireEvent.click(knopfVon(1))
    await Promise.resolve()
    expect(b).toHaveBeenCalledTimes(1)
  })

  it('Klick im älteren Toast, solange er noch ausblendet: nur dessen Zug – der neuere bleibt per Knopf und per Z zurücknehmbar', async () => {
    const a = vi.fn()
    const b = vi.fn()
    toastUndo('Jetzt in „Gespräch vereinbart“.', a)
    toastUndo('Jetzt in „Verloren“.', b)
    fireEvent.click(knopfVon(0))
    await Promise.resolve()
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).not.toHaveBeenCalled()
    schliesse(0)
    // der neuere ist weiter angeboten …
    expect(useUiStore.getState().letzterUndo?.label).toBe('Jetzt in „Verloren“.')
    // … per Knopf
    fireEvent.click(knopfVon(1))
    await vi.waitFor(() => expect(b).toHaveBeenCalledTimes(1))
    expect(a).toHaveBeenCalledTimes(1)

    // … und (neuer Durchgang) per Z
    const c = vi.fn()
    const d = vi.fn()
    toastUndo('Jetzt in „Gespräch vereinbart“.', c)
    toastUndo('Jetzt in „Verloren“.', d)
    fireEvent.click(knopfVon(2))
    schliesse(2)
    expect(await undoAusfuehren()).toBe(true)
    expect(c).toHaveBeenCalledTimes(1)
    expect(d).toHaveBeenCalledTimes(1)
  })

  it('ist der ältere Toast schon geschlossen oder abgelaufen, fasst sein Knopf den neueren Zug nicht an', async () => {
    const a = vi.fn()
    const b = vi.fn()
    toastUndo('Karte entfernt.', a)
    toastUndo('Jetzt in „Verloren“.', b)
    schliesse(0)
    fireEvent.click(knopfVon(0))
    await Promise.resolve()
    expect(a).not.toHaveBeenCalled()
    expect(b).not.toHaveBeenCalled()
    expect(await undoAusfuehren()).toBe(true)
    expect(b).toHaveBeenCalledTimes(1)

    const c = vi.fn()
    toastUndo('Karte entfernt.', c)
    laeuftAb(2)
    fireEvent.click(knopfVon(2))
    await Promise.resolve()
    expect(c).not.toHaveBeenCalled()
    expect(await undoAusfuehren()).toBe(false)
  })

  it('Activity-IDs (E-Mail-Bereich) laufen unverändert über den registrierten Ausführer', async () => {
    const aus = vi.fn()
    registriereUndo(aus)
    toastUndo('Erfasst.', 501)
    fireEvent.click(knopfVon(0))
    await vi.waitFor(() => expect(aus).toHaveBeenCalledTimes(1))
    expect(aus).toHaveBeenCalledWith(501)
    schliesse(0)
    toastUndo('Erfasst.', [7, 8])
    fireEvent.click(knopfVon(1))
    await vi.waitFor(() => expect(aus).toHaveBeenCalledTimes(2))
    expect(aus).toHaveBeenLastCalledWith([7, 8])
  })

  it('Activity-IDs: der Knopf eines Toasts, der gerade einem neueren weicht, nimmt nicht dessen Aktion zurück', async () => {
    const aus = vi.fn()
    registriereUndo(aus)
    toastUndo('Als gesendet verbucht.', 601)
    toastUndo('Als gesendet verbucht.', 602)
    // der ältere blendet noch aus und wird angeklickt
    fireEvent.click(knopfVon(0))
    await Promise.resolve()
    expect(aus).not.toHaveBeenCalled()
    schliesse(0)
    // der neuere bleibt angeboten: per Knopf …
    fireEvent.click(knopfVon(1))
    await vi.waitFor(() => expect(aus).toHaveBeenCalledTimes(1))
    expect(aus).toHaveBeenCalledWith(602)
    // … und nichts geht doppelt zurück
    expect(await undoAusfuehren()).toBe(false)
  })

  it('Knöpfe im Toast sind 40 px hoch', () => {
    toastUndo('Karte entfernt.', vi.fn())
    expect(knopfVon(0)).toHaveClass('h-10')
  })
})
