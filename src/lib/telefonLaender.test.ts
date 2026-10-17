// Feedback ebfc59a0 (Länderauswahl) und 9f9301ea (weitere Nummern), 17.10.2026
import { describe, expect, it } from 'vitest'
import { alsNummerTyp, landLabel, landVon, nachE164, weitereNummern } from './telefon'

describe('nachE164 mit Land', () => {
  it('„0…“ gilt im gewählten Land, nicht immer in Deutschland', () => {
    expect(nachE164('0664 1234567', 'AT')).toBe('+436641234567')
    expect(nachE164('044 668 18 00', 'CH')).toBe('+41446681800')
    expect(nachE164('040 123456')).toBe('+4940123456') // Standard DE bleibt
  })

  it('eine Ländervorwahl in der Eingabe gewinnt immer', () => {
    expect(nachE164('+43 664 1234567', 'DE')).toBe('+436641234567')
    expect(nachE164('0043 664 1234567', 'DE')).toBe('+436641234567')
  })

  it('Land einer gespeicherten Nummer, Label fürs Select', () => {
    expect(landVon('+436641234567')).toBe('AT')
    expect(landVon(null)).toBeNull()
    expect(landLabel('CH')).toBe('CH +41')
  })
})

describe('weitereNummern', () => {
  it('liest nur gültige Einträge, unbekannter Typ → sonstige', () => {
    expect(
      weitereNummern([
        { e164: '+4940123456', typ: 'zentrale' },
        { e164: '+491711234567', typ: 'quatsch' },
        { typ: 'mobil' },
        'falsch',
      ]),
    ).toEqual([
      { e164: '+4940123456', typ: 'zentrale' },
      { e164: '+491711234567', typ: 'sonstige' },
    ])
    expect(weitereNummern(null)).toEqual([])
    expect(alsNummerTyp('unbekannt')).toBe('sonstige')
  })
})
