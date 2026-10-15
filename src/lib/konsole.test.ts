import { beforeEach, describe, expect, it } from 'vitest'
import { _konsoleLeeren, KONSOLE_MAX, konsolenRoh, merke } from './konsole'

describe('konsole – Roh-Puffer für Feedback-Meldungen', () => {
  beforeEach(() => _konsoleLeeren())

  it('installiert sich beim Import: console.error und console.warn landen im Puffer (Original läuft weiter)', () => {
    console.error('Fehler beim Laden', 42)
    console.warn('Achtung')
    const e = konsolenRoh()
    expect(e.map((x) => [x.art, x.args])).toEqual([
      ['error', ['Fehler beim Laden', 42]],
      ['warn', ['Achtung']],
    ])
    expect(e[0]?.zeit).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('window „error“ und „unhandledrejection“ werden erfasst', () => {
    const fehler = new TypeError('x is undefined')
    window.dispatchEvent(new ErrorEvent('error', { error: fehler, message: 'x is undefined' }))
    const ev = new Event('unhandledrejection') as Event & { reason?: unknown }
    const grund = new Error('Netz weg')
    Object.defineProperty(ev, 'reason', { value: grund })
    window.dispatchEvent(ev)
    const e = konsolenRoh()
    expect(e[0]).toMatchObject({ art: 'fehler', args: [fehler] })
    expect(e[1]).toMatchObject({ art: 'promise', args: [grund] })
  })

  it('hält höchstens 30 Einträge – der älteste fällt raus', () => {
    for (let i = 0; i < KONSOLE_MAX + 5; i++) merke('warn', [`Nr. ${i}`])
    const e = konsolenRoh()
    expect(e).toHaveLength(30)
    expect(e[0]?.args).toEqual(['Nr. 5'])
    expect(e[29]?.args).toEqual(['Nr. 34'])
  })

  it('liefert eine Kopie (Puffer bleibt unberührt)', () => {
    merke('warn', ['a'])
    const e = konsolenRoh()
    e[0]!.args[0] = 'geändert'
    expect(konsolenRoh()[0]?.args).toEqual(['a'])
  })
})
