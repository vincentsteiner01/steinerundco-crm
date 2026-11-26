// Formular-Logik des Lead-Blatts (blatt.ts): Prüfung und Patch rund um den LinkedIn-Link (26.11.2026 – ein Profil-Link mit
// Anhang wurde abgelehnt, die Prüfung lief erst auf dem Server). Nur erfundene Namen.
import { describe, expect, it } from 'vitest'
import { blattPatch, KEIN_PROFIL_LINK, pruefeBlatt, type BlattWerte } from './blatt'

const SAUBER = 'https://www.linkedin.com/in/max-muster-demo'

function werte(patch: Partial<BlattWerte> = {}): BlattWerte {
  return {
    first_name: 'Max',
    last_name: 'Muster',
    salutation: 'herr',
    company_name: '',
    linkedin_url: '',
    owner_id: 'mitglied-a',
    board_liste: 'angeschrieben',
    notes: '',
    ...patch,
  }
}

describe('pruefeBlatt: LinkedIn-Link', () => {
  it.each([
    'https://www.linkedin.com/in/max-muster-demo',
    'https://www.linkedin.com/in/max-muster-demo/overlay/contact-info/',
    'https://www.linkedin.com/in/max-muster-demo/detail/contact-info/',
    'https://www.linkedin.com/in/max-muster-demo/recent-activity/all/',
    'linkedin.com/mwlite/in/max-muster-demo',
    'de.linkedin.com/in/max-muster-demo?trk=x',
  ])('%j ist ein Profil-Link', (link) => {
    expect(pruefeBlatt(werte(), werte({ linkedin_url: link }))).toEqual({})
  })

  it.each([
    'https://www.linkedin.com/company/muster-solar-demo',
    'https://www.linkedin.com/sales/lead/ACwAAABCDEF,NAME_SEARCH,abc',
    'https://www.linkedin.com/feed/',
    'https://www.linkedin.com/in/',
    'https://notlinkedin.com/in/x',
    'https://linkedin.com.evil.de/in/x',
  ])('%j ist keiner: Fehler am Link-Feld', (link) => {
    expect(pruefeBlatt(werte(), werte({ linkedin_url: link }))).toEqual({ link: KEIN_PROFIL_LINK })
  })

  it('der Link ist freiwillig: leer und nur Leerzeichen sind erlaubt', () => {
    expect(pruefeBlatt(werte(), werte({ linkedin_url: '' }))).toEqual({})
    expect(pruefeBlatt(werte({ linkedin_url: SAUBER }), werte({ linkedin_url: '   ' }))).toEqual({})
  })

  it('ein unveränderter alter Firmen-Link bleibt erlaubt', () => {
    const alt = werte({ linkedin_url: 'https://www.linkedin.com/company/muster-solar-demo' })
    expect(pruefeBlatt(alt, { ...alt, notes: 'Ruft Dienstag zurück' })).toEqual({})
  })

  it('ohne Namen und ohne Link fehlt der Name', () => {
    expect(pruefeBlatt(werte(), werte({ first_name: ' ', last_name: '' }))).toEqual({
      name: 'Bitte einen Namen eingeben',
    })
  })
})

describe('blattPatch: LinkedIn-Link', () => {
  it.each([
    'https://www.linkedin.com/in/max-muster-demo/overlay/contact-info/',
    'https://www.linkedin.com/in/max-muster-demo/detail/contact-info/',
    'https://www.linkedin.com/in/max-muster-demo/recent-activity/all/',
    'https://www.linkedin.com/mwlite/in/max-muster-demo',
    '  de.linkedin.com/in/max-muster-demo/?trk=x#top  ',
    'https://www.linkedin.com/in/max-muster-demo',
  ])('%j wird als sauberer Profil-Link gespeichert', (link) => {
    expect(blattPatch(werte(), werte({ linkedin_url: link }))).toEqual({ linkedin_url: SAUBER })
  })

  it('geleerter Link wird null; unveränderter Link steht nicht im Patch', () => {
    expect(blattPatch(werte({ linkedin_url: SAUBER }), werte({ linkedin_url: ' ' }))).toEqual({ linkedin_url: null })
    const alt = werte({ linkedin_url: 'https://www.linkedin.com/in/max-muster-demo/' })
    expect(blattPatch(alt, { ...alt, notes: 'Notiz' })).toEqual({ notes: 'Notiz' })
  })

  it('eine Eingabe, die kein Profil-Link ist, zählt weiter als ungespeicherte Änderung', () => {
    const firma = 'https://www.linkedin.com/company/muster-solar-demo'
    expect(blattPatch(werte(), werte({ linkedin_url: firma }))).toEqual({ linkedin_url: firma })
  })
})
