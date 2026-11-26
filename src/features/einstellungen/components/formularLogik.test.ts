// useEntwurf (Fund 34, 25.11.2026): Nach dem Speichern darf nie wieder der alte Stand im Formular stehen, und das nächste
// Speichern darf das eben Gespeicherte nicht überschreiben. `zuruecksetzen` kommt dabei – wie im echten Ablauf – aus dem
// Render des Klicks auf „Speichern“ (onSuccess der Mutation hält diese alte Funktion fest).
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useEntwurf } from './formularLogik'

type Werte = { a: string; b: string }
const ALT: Werte = { a: 'alt', b: 'alt' }

const aufbau = (quelle: Werte | undefined) =>
  renderHook(({ q }: { q: Werte | undefined }) => useEntwurf(q), { initialProps: { q: quelle } })

describe('useEntwurf', () => {
  it('folgt der Quelle, solange nichts geändert ist – und lässt eigene Eingaben stehen, wenn sie sich ändert', () => {
    const h = aufbau(ALT)
    expect(h.result.current.entwurf).toEqual(ALT)
    expect(h.result.current.geaendert).toBe(false)
    h.rerender({ q: { a: 'fremd', b: 'alt' } })
    expect(h.result.current.entwurf).toEqual({ a: 'fremd', b: 'alt' })
    act(() => h.result.current.setEntwurf((e) => ({ ...e, b: 'meins' })))
    expect(h.result.current.geaendert).toBe(true)
    h.rerender({ q: { a: 'noch einmal fremd', b: 'alt' } })
    expect(h.result.current.entwurf).toEqual({ a: 'fremd', b: 'meins' })
  })

  it('ohne Quelle (lädt noch) gibt es keinen Entwurf; kommt sie, steht sie im Formular', () => {
    const h = aufbau(undefined)
    expect(h.result.current.entwurf).toBeUndefined()
    expect(h.result.current.geaendert).toBe(false)
    h.rerender({ q: ALT })
    expect(h.result.current.entwurf).toEqual(ALT)
  })

  it('Quelle kommt nach dem Speichern nach (Profil): speichern → kein alter Stand → Quelle ändert sich → neuer Stand → zweites Speichern enthält beides', () => {
    const h = aufbau(ALT)
    act(() => h.result.current.setEntwurf((e) => ({ ...e, a: 'neu' })))
    // Klick auf „Speichern“: gesendet wird dieser Entwurf, onSuccess hält `zuruecksetzen` aus diesem Render fest
    const gesendet1 = h.result.current.entwurf
    const nachErfolg = h.result.current.zuruecksetzen
    expect(gesendet1).toEqual({ a: 'neu', b: 'alt' })
    act(() => nachErfolg())
    // gespeichert, die Quelle ist noch die alte: im Formular steht trotzdem der neue Stand
    expect(h.result.current.entwurf).toEqual({ a: 'neu', b: 'alt' })
    expect(h.result.current.geaendert).toBe(false)
    // die Quelle ändert sich (neu geladen)
    h.rerender({ q: { a: 'neu', b: 'alt' } })
    expect(h.result.current.entwurf).toEqual({ a: 'neu', b: 'alt' })
    expect(h.result.current.geaendert).toBe(false)
    // zweite Änderung an einem anderen Feld: das zweite Speichern enthält beide
    act(() => h.result.current.setEntwurf((e) => ({ ...e, b: 'auch neu' })))
    expect(h.result.current.geaendert).toBe(true)
    expect(h.result.current.entwurf).toEqual({ a: 'neu', b: 'auch neu' })
  })

  it('Quelle ist beim Speichern schon weiter (optimistisch, wie früher die Feiertage): derselbe Ablauf, kein alter Stand', () => {
    const h = aufbau(ALT)
    act(() => h.result.current.setEntwurf((e) => ({ ...e, a: 'neu' })))
    const nachErfolg = h.result.current.zuruecksetzen
    // onMutate schreibt den neuen Stand sofort in den Cache – die Quelle ändert sich VOR dem Erfolg
    h.rerender({ q: { a: 'neu', b: 'alt' } })
    act(() => nachErfolg())
    expect(h.result.current.entwurf).toEqual({ a: 'neu', b: 'alt' })
    expect(h.result.current.geaendert).toBe(false)
    // das Neuladen danach bringt denselben Stand
    h.rerender({ q: { a: 'neu', b: 'alt' } })
    expect(h.result.current.entwurf).toEqual({ a: 'neu', b: 'alt' })
    act(() => h.result.current.setEntwurf((e) => ({ ...e, b: 'auch neu' })))
    expect(h.result.current.entwurf).toEqual({ a: 'neu', b: 'auch neu' })
  })

  it('gleich weitergeschrieben, bevor die Quelle nachkommt: die neue Eingabe bleibt, das Gespeicherte auch', () => {
    const h = aufbau(ALT)
    act(() => h.result.current.setEntwurf((e) => ({ ...e, a: 'neu' })))
    const nachErfolg = h.result.current.zuruecksetzen
    act(() => nachErfolg())
    act(() => h.result.current.setEntwurf((e) => ({ ...e, b: 'auch neu' })))
    h.rerender({ q: { a: 'neu', b: 'alt' } })
    expect(h.result.current.entwurf).toEqual({ a: 'neu', b: 'auch neu' })
    expect(h.result.current.geaendert).toBe(true)
  })

  it('nach dem Speichern folgt der Entwurf wieder der Quelle (die Datenbank hat z. B. Leerzeichen entfernt)', () => {
    const h = aufbau(ALT)
    act(() => h.result.current.setEntwurf((e) => ({ ...e, a: ' neu ' })))
    act(() => h.result.current.zuruecksetzen())
    h.rerender({ q: { a: 'neu', b: 'alt' } })
    expect(h.result.current.entwurf).toEqual({ a: 'neu', b: 'alt' })
  })
})
