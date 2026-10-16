import { afterEach, describe, expect, it, vi } from 'vitest'
import { mitWiederholung, mitZeitlimit, Zeitueberschreitung } from './wiederholen'

const sofort = async () => {}

describe('mitZeitlimit', () => {
  afterEach(() => vi.useRealTimers())

  it('hängender Aufruf wird nach dem Limit zum TimeoutError', async () => {
    vi.useFakeTimers()
    const p = mitZeitlimit(new Promise(() => {}), 1000)
    const erwartung = expect(p).rejects.toBeInstanceOf(Zeitueberschreitung)
    await vi.advanceTimersByTimeAsync(1000)
    await erwartung
  })

  it('reicht Ergebnis und Fehler durch', async () => {
    await expect(mitZeitlimit(Promise.resolve(7), 1000)).resolves.toBe(7)
    await expect(mitZeitlimit(Promise.reject(new Error('x')), 1000)).rejects.toThrow('x')
  })
})

describe('mitWiederholung', () => {
  it('wiederholt Netzwerkfehler und liefert den späteren Erfolg', async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce('ok')
    await expect(mitWiederholung(fn, { warte: sofort })).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('gibt nach den Pausen auf und wirft den letzten Netzwerkfehler', async () => {
    const fn = vi.fn<() => Promise<string>>().mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(mitWiederholung(fn, { warte: sofort, pausenMs: [1, 1] })).rejects.toThrow('Failed to fetch')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('wiederholt keine fachlichen Fehler (z. B. Sperre aus der Datenbank)', async () => {
    const fn = vi.fn<() => Promise<string>>().mockRejectedValue({ code: 'P0001', message: 'Lead hat widersprochen' })
    await expect(mitWiederholung(fn, { warte: sofort })).rejects.toMatchObject({ code: 'P0001' })
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
