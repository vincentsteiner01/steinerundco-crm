// _helfer.ts: Europe/Berlin-Grenzen (Sommer-/Winterzeit), Datum, Undefined-Filter, or()-Werte; errors.ts: Meldungstabelle architektur § 4.8.
import { describe, expect, it } from 'vitest'
import { berlinMitternachtIso, berlinTag, kurzDatum, ohneUndefined, orWert, tagPlus, zeitraumGrenzen } from './_helfer'
import { fehlerMeldung, MELDUNG } from './errors'

describe('Zeitraum Europe/Berlin', () => {
  it('Sommerzeit: 00:00 Berlin = 22:00 UTC am Vortag', () => {
    expect(berlinMitternachtIso('2026-10-14')).toBe('2026-10-13T22:00:00.000Z')
  })
  it('Winterzeit: 00:00 Berlin = 23:00 UTC am Vortag', () => {
    expect(berlinMitternachtIso('2026-12-24')).toBe('2026-12-23T23:00:00.000Z')
  })
  it('Zeitumstellung 25.10.2026: Tag danach beginnt 23:00 UTC', () => {
    expect(berlinMitternachtIso('2026-10-25')).toBe('2026-10-24T22:00:00.000Z')
    expect(berlinMitternachtIso('2026-10-26')).toBe('2026-10-25T23:00:00.000Z')
  })
  it('zeitraumGrenzen: [von 00:00, bis 24:00)', () => {
    expect(zeitraumGrenzen('2026-10-01', '2026-10-31')).toEqual({
      ab: '2026-09-30T22:00:00.000Z',
      vor: '2026-10-31T23:00:00.000Z',
    })
  })
  it('berlinTag kippt um 22:00 UTC im Sommer', () => {
    expect(berlinTag(new Date('2026-10-13T21:59:00Z'))).toBe('2026-10-13')
    expect(berlinTag(new Date('2026-10-13T22:00:00Z'))).toBe('2026-10-14')
  })
  it('tagPlus über Monatsgrenze', () => {
    expect(tagPlus('2026-10-31', 1)).toBe('2026-11-01')
  })
  it('kurzDatum: „Fr 16.10.“', () => {
    expect(kurzDatum('2026-10-16T08:00:00Z')).toBe('Fr 16.10.')
  })
})

describe('ohneUndefined / orWert', () => {
  it('entfernt nur undefined, behält null', () => {
    expect(ohneUndefined({ a: 1, b: undefined, c: null })).toEqual({ a: 1, c: null })
  })
  it('entschärft PostgREST-Trenner', () => {
    expect(orWert('Müller, (GmbH) 50%')).toBe('Müller GmbH 50')
  })
})

describe('fehlerMeldung – architektur § 4.8', () => {
  it.each([
    ['23505', MELDUNG.gibtEsSchon, false],
    ['42501', MELDUNG.keinZugriff, false],
    ['PGRST301', MELDUNG.sitzungAbgelaufen, true],
    ['PGRST116', MELDUNG.nichtVorhanden, false],
    ['23502', MELDUNG.pflichtfeld, false],
    ['23503', MELDUNG.verweisFehlt, false],
  ])('%s → %s', (code, meldung, retry) => {
    expect(fehlerMeldung({ code, message: 'x' })).toEqual({ meldung, retry, code })
  })
  it('23514 / 22P02 mit details', () => {
    expect(fehlerMeldung({ code: '23514', details: 'stage', message: 'x' }).meldung).toBe('Ungültiger Wert: stage')
    expect(fehlerMeldung({ code: '22P02', message: 'x' }).meldung).toBe('Ungültiger Wert.')
  })
  it('P0001: deutscher DB-Text wird durchgereicht', () => {
    expect(fehlerMeldung({ code: 'P0001', message: 'Lead hat widersprochen – kein Anruf erlaubt' }).meldung).toBe(
      'Lead hat widersprochen – kein Anruf erlaubt',
    )
  })
  it('Netzwerk → Offline-Meldung mit Retry', () => {
    expect(fehlerMeldung(new TypeError('Failed to fetch'))).toEqual({
      meldung: MELDUNG.offline,
      retry: true,
      code: null,
    })
  })
  it('unbekannt → „Nicht gespeichert – erneut versuchen“', () => {
    expect(fehlerMeldung({ message: '?' })).toEqual({ meldung: MELDUNG.allgemein, retry: true, code: null })
    expect(fehlerMeldung({ status: 401 }).meldung).toBe(MELDUNG.keinZugriff)
  })
})
