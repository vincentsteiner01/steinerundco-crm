import { beforeEach, describe, expect, it } from 'vitest'
import { _konsoleLeeren, merke } from '@/lib/konsole'
import { bereinige, formatiere, konsolenEintraege } from './konsoleText'

describe('konsoleText – Konsolen-Einträge einer Meldung', () => {
  beforeEach(() => _konsoleLeeren())

  it('macht den Roh-Puffer lesbar: Fehler mit Name, Meldung und Stapel; Zeit und Art bleiben', () => {
    merke('fehler', [new TypeError('x is undefined')])
    merke('error', ['Lead %s hat %d Schritte', 'Anna', 3, { a: 1 }])
    const e = konsolenEintraege()
    expect(e[0]).toMatchObject({ art: 'fehler' })
    expect(e[0]?.text).toMatch(/^TypeError: x is undefined/)
    expect(e[1]?.text).toBe('Lead Anna hat 3 Schritte {"a":1}')
  })

  it('formatiert %c weg und kommt mit zyklischen Objekten klar', () => {
    expect(formatiere(['%cfarbig', 'color: red', 'x'])).toBe('farbig x')
    const a: Record<string, unknown> = {}
    a['selbst'] = a
    expect(() => formatiere(['zyklisch', a])).not.toThrow()
  })

  it('kürzt auf 1000 Zeichen', () => {
    merke('warn', ['x'.repeat(5000)])
    expect(konsolenEintraege()[0]?.text).toHaveLength(1000)
  })

  it('meldet nie Tokens: JWT, Supabase-Schlüssel, Bearer, token=/passcode:-Werte, lange Geheimnis-Ketten', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'
    merke('error', [
      `Authorization: Bearer abc.def-ghi apikey=sb_publishable_AbC123xyz ${jwt}`,
      { access_token: 'geheim123', refresh_token: 'r1' },
      'passcode: hunter22 token=XYZ abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGH',
    ])
    const text = konsolenEintraege()[0]?.text ?? ''
    for (const geheim of [
      'eyJ',
      'sb_publishable_AbC123xyz',
      'abc.def-ghi',
      'geheim123',
      'hunter22',
      'XYZ',
      '0123456789ABCDEFGH',
    ])
      expect(text).not.toContain(geheim)
    expect(text).toContain('[JWT]')
  })

  it('lässt normale Texte, UUIDs und Pfade stehen', () => {
    const t = 'Lead 3f2a9c1e-1b2c-4d5e-8f90-123456789abc nicht gefunden in /src/features/pipeline/PipelineSeite.tsx:42'
    expect(bereinige(t)).toBe(t)
  })
})
