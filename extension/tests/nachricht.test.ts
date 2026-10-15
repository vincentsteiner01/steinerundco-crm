import { describe, expect, it } from 'vitest'
import { fuelleVorlage } from '../src/shared/nachricht'
import { faelligChip } from '../src/shared/zeit'
import { istNachricht } from '../src/shared/protokoll'
import { crmLink, istLinkedin, pruefeCrmBasis } from '../src/shared/konfig'

const LEAD = { first_name: 'Tilda', last_name: 'Testfall', company_name: 'Sonnenfeld Solartechnik GmbH', salutation: 'frau' as const }
const ME = { display_name: 'Vincent Steiner', short_name: 'Vincent', calendly_url: 'https://calendly.com/beispiel/15min' }

describe('Nächste Nachricht füllen (lib/platzhalter)', () => {
  it('füllt Lead- und Absender-Platzhalter, lässt manuelle offen und zerlegt den Text', () => {
    const f = fuelleVorlage('Hallo Frau [Nachname], zu [Reaktion]: [Termin-Link] – [Absender Vorname]', LEAD, ME, {})
    expect(f.text).toBe('Hallo Frau Testfall, zu [Reaktion]: https://calendly.com/beispiel/15min – Vincent')
    expect(f.offen).toEqual(['Reaktion'])
    expect(f.alle).toEqual(['Anrede', 'Nachname', 'Reaktion', 'Termin-Link', 'Absender Vorname'])
    expect(f.teile.filter((t) => t.art === 'platzhalter').map((t) => (t.art === 'platzhalter' ? [t.name, t.wert] : null))).toEqual([
      ['Anrede', 'Frau'],
      ['Nachname', 'Testfall'],
      ['Reaktion', null],
      ['Termin-Link', 'https://calendly.com/beispiel/15min'],
      ['Absender Vorname', 'Vincent'],
    ])
  })

  it('manuelle Werte schließen offene Platzhalter', () => {
    const f = fuelleVorlage('Danke für [Reaktion], [Vorname].', LEAD, ME, { Reaktion: 'die schnelle Antwort' })
    expect(f.text).toBe('Danke für die schnelle Antwort, Tilda.')
    expect(f.offen).toEqual([])
  })
})

describe('Fälligkeit als Zeitzustand', () => {
  const jetzt = new Date('2026-10-15T09:00:00Z')
  it('heute, überfällig, später', () => {
    expect(faelligChip('2026-10-15T07:00:00Z', jetzt)).toMatchObject({ ton: 'heute', text: 'heute' })
    expect(faelligChip('2026-10-13T07:00:00Z', jetzt)).toMatchObject({ ton: 'ueberfaellig', text: '−2 T' })
    expect(faelligChip('2026-10-16T07:00:00Z', jetzt)).toMatchObject({ ton: 'spaeter', text: 'morgen' })
    expect(faelligChip('2026-10-19T07:00:00Z', jetzt)).toMatchObject({ ton: 'spaeter', text: 'in 4 T' })
    expect(faelligChip('2026-11-02T07:00:00Z', jetzt)).toMatchObject({ ton: 'spaeter', text: 'Mo 02.11.' })
    expect(faelligChip(null, jetzt)).toBeNull()
  })
})

describe('Protokoll und Konfiguration', () => {
  it('nimmt nur bekannte Nachrichtentypen an', () => {
    expect(istNachricht({ typ: 'suchen', norm: null, name: null })).toBe(true)
    expect(istNachricht({ typ: 'loeschen' })).toBe(false)
    expect(istNachricht(null)).toBe(false)
  })
  it('CRM-Adresse: https oder localhost, ohne Pfad', () => {
    expect(pruefeCrmBasis('https://crm.steinerundco.de/heute')).toBe('https://crm.steinerundco.de')
    expect(pruefeCrmBasis('http://localhost:8768')).toBe('http://localhost:8768')
    expect(pruefeCrmBasis('http://crm.steinerundco.de')).toBeNull()
    expect(pruefeCrmBasis('javascript:alert(1)')).toBeNull()
    expect(crmLink(null, '/leads/abc')).toBe('https://crm.steinerundco.de/leads/abc')
  })
  it('liest nur www.linkedin.com über https', () => {
    expect(istLinkedin('https://www.linkedin.com/in/x/')).toBe(true)
    expect(istLinkedin('https://evil.example/www.linkedin.com')).toBe(false)
    expect(istLinkedin('chrome://extensions')).toBe(false)
    expect(istLinkedin(null)).toBe(false)
  })
})
