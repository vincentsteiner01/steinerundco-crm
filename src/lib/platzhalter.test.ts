// BAUPLAN § 3.1.12 – Herr/Frau-Literal, offene Platzhalter, Signatur (§ 3.1.9a).
import { describe, expect, it } from 'vitest'
import { vollerLead } from '@/test/fixtures/leads'
import { VORLAGEN } from '@/test/fixtures/vorlagen'
import { PLATZHALTER, fuellen, istBekannterPlatzhalter, platzhalterWert, tokens } from './platzhalter'

const frau = vollerLead(3, {
  first_name: 'Anna',
  last_name: 'Müller',
  company_name: 'Sonnenkraft GmbH',
  city: 'Hamburg',
})
const herr = vollerLead(1, { first_name: 'Max', last_name: 'Mustermann' })
const neutral = vollerLead(2, { first_name: 'Kim', last_name: 'Schmidt' })

describe('tokens', () => {
  it('findet Platzhalter eindeutig in Reihenfolge, Literal Herr/Frau als Anrede', () => {
    expect(tokens('Hallo [Vorname], [Unternehmen] in [Stadt] – [Vorname]')).toEqual(['Vorname', 'Unternehmen', 'Stadt'])
    expect(tokens('Guten Tag Herr [Nachname], [Reaktion]')).toEqual(['Anrede', 'Nachname', 'Reaktion'])
    expect(tokens('kein Platzhalter')).toEqual([])
  })
})

describe('fuellen – Lead-Felder', () => {
  it('ersetzt gefüllte, lässt offene wörtlich stehen und listet sie', () => {
    const r = fuellen('Hallo [Vorname], [Unternehmen] in [Stadt] – [Reaktion]', frau)
    expect(r.text).toBe('Hallo Anna, Sonnenkraft GmbH in Hamburg – [Reaktion]')
    expect(r.offen).toEqual(['Reaktion'])
    expect(r.gefuellt).toEqual({ Vorname: 'Anna', Unternehmen: 'Sonnenkraft GmbH', Stadt: 'Hamburg' })
  })
  it('leeres Feld → offen', () => {
    const r = fuellen('[Vorname] [Stadt]', { first_name: 'Anna', city: '  ' })
    expect(r.offen).toEqual(['Stadt'])
    expect(r.text).toBe('Anna [Stadt]')
  })
  it('manuelle Werte aus ctx.werte füllen und überschreiben', () => {
    const r = fuellen('[Reaktion] / [Punkt 1] / [Vorname]', frau, {
      werte: { Reaktion: 'spannend', 'Punkt 1': 'A', Vorname: 'Anni' },
    })
    expect(r.text).toBe('spannend / A / Anni')
    expect(r.offen).toEqual([])
  })
  it('Fixture-Vorlagen sind mit Werten vollständig füllbar', () => {
    const vorlage = VORLAGEN[0]
    const r = fuellen(vorlage ? vorlage.body : '', frau, { werte: { Reaktion: 'ok' } })
    expect(r.offen).toEqual([])
  })
})

describe('fuellen – Anrede und Herr/Frau-Literal', () => {
  it('frau → „Frau Müller“, herr → „Herr Mustermann“', () => {
    expect(fuellen('Guten Tag Frau [Nachname],', frau).text).toBe('Guten Tag Frau Müller,')
    expect(fuellen('Guten Tag Herr [Nachname],', frau).text).toBe('Guten Tag Frau Müller,')
    expect(fuellen('Guten Tag Frau [Nachname],', herr).text).toBe('Guten Tag Herr Mustermann,')
    expect(fuellen('[Anrede] [Nachname]', herr).text).toBe('Herr Mustermann')
  })
  it('neutral → Anrede offen, Nachname gefüllt', () => {
    const r = fuellen('Guten Tag Herr [Nachname],', neutral)
    expect(r.text).toBe('Guten Tag [Anrede] Schmidt,')
    expect(r.offen).toEqual(['Anrede'])
    expect(r.gefuellt).toEqual({ Nachname: 'Schmidt' })
  })
  it('einmal erfragte Anrede aus ctx füllt neutral', () => {
    const r = fuellen('Herr [Nachname]', neutral, { anrede: 'frau' })
    expect(r.text).toBe('Frau Schmidt')
    expect(r.offen).toEqual([])
  })
})

describe('fuellen – Absender, Signatur, Meeting, Anlass', () => {
  const me = {
    display_name: 'Vincent Steiner',
    caller_number_e164: '+4940123456',
    signature: 'Vincent Steiner\nSteiner & Co.',
    calendly_url: 'https://calendly.com/x',
  }
  it('Signatur und Absender aus me', () => {
    const r = fuellen('Hallo [Vorname],\n[Signatur]', frau, { me })
    expect(r.text).toBe('Hallo Anna,\nVincent Steiner\nSteiner & Co.')
    expect(r.offen).toEqual([])
    const a = fuellen('[Anrufer] · [Absender Vorname] [Absender Nachname] · [Absender Telefon] · [Termin-Link]', frau, {
      me,
    })
    expect(a.text).toBe('Vincent Steiner · Vincent Steiner · +4940123456 · https://calendly.com/x')
  })
  it('ohne me bleiben Absender-Platzhalter offen', () => {
    const r = fuellen('[Signatur] [Termin-Link]', frau)
    expect(r.offen).toEqual(['Signatur', 'Termin-Link'])
  })
  it('Gesprächsdatum nur aus Meeting stattgefunden', () => {
    expect(fuellen('[Gesprächsdatum]', frau).offen).toEqual(['Gesprächsdatum'])
    expect(
      fuellen('[Gesprächsdatum]', frau, { meeting: { status: 'geplant', scheduled_at: '2026-10-16T08:00:00Z' } }).offen,
    ).toEqual(['Gesprächsdatum'])
    expect(
      fuellen('[Gesprächsdatum]', frau, { meeting: { status: 'stattgefunden', scheduled_at: '2026-10-16T08:00:00Z' } })
        .text,
    ).toBe('16.10.2026')
  })
  it('Anlass aus call_basis + Note', () => {
    expect(fuellen('[Anlass]', { call_basis: null }).offen).toEqual(['Anlass'])
    expect(fuellen('[Anlass]', { call_basis: 'linkedin_vernetzt' }).text).toBe('LinkedIn vernetzt')
    expect(
      fuellen('[Anlass]', { call_basis: 'sonstiger_konkreter_anlass', call_basis_note: 'Messe Intersolar' }).text,
    ).toBe('Sonstiger konkreter Anlass – Messe Intersolar')
  })
  it('Tag/Uhrzeit nur manuell', () => {
    const r = fuellen('Passt [Tag/Uhrzeit 1] oder [Tag/Uhrzeit 2]?', frau, { werte: { 'Tag/Uhrzeit 1': 'Mo 10:00' } })
    expect(r.text).toBe('Passt Mo 10:00 oder [Tag/Uhrzeit 2]?')
    expect(r.offen).toEqual(['Tag/Uhrzeit 2'])
  })
})

describe('PLATZHALTER', () => {
  it('enthält alle Namen aus § 3.1.9a, jeder Name eindeutig', () => {
    const namen = PLATZHALTER.map((p) => p.name)
    for (const n of [
      'Vorname',
      'Nachname',
      'Unternehmen',
      'Stadt',
      'Anrede',
      'Reaktion',
      'Grund',
      'Einwand',
      'Punkt 1',
      'Punkt 2',
      'Punkt 3',
      'Mehrwert-Absatz',
      'Nächster Schritt',
      'Tag/Uhrzeit',
      'Tag/Uhrzeit 1',
      'Tag/Uhrzeit 2',
      'Gesprächsdatum',
      'Anrufer',
      'Absender Vorname',
      'Absender Nachname',
      'Absender Telefon',
      'Signatur',
      'Anlass',
      'Termin-Link',
    ])
      expect(namen).toContain(n)
    expect(new Set(namen).size).toBe(namen.length)
    expect(istBekannterPlatzhalter('Vorname')).toBe(true)
    expect(istBekannterPlatzhalter('Foo')).toBe(false)
    expect(platzhalterWert('Foo', frau)).toBeNull()
  })
})
