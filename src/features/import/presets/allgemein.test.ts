import { describe, expect, it } from 'vitest'
import { allgemeinZeilen, erkenneMapping, mappingVollstaendig } from './allgemein'

describe('presets/allgemein', () => {
  it('erkennt das Mapping aus der Kopfzeile, jedes Zielfeld nur einmal', () => {
    expect(
      erkenneMapping([
        'Vorname',
        'Nachname',
        'Firma',
        'Position',
        'LinkedIn',
        'Ort',
        'Telefon',
        'E-Mail',
        'Tags',
        'Umsatz',
        'Name',
      ]),
    ).toEqual([
      'first_name',
      'last_name',
      'company',
      'role_title',
      'linkedin_url',
      'city',
      'phone',
      'email',
      'tags',
      null,
      'name',
    ])
    expect(mappingVollstaendig([null, 'company'])).toBe(false)
    expect(mappingVollstaendig(['linkedin_url'])).toBe(true)
  })

  it('baut import_leads-Zeilen: Tags ;-getrennt, Anrede normalisiert, Zahlen als Text, leere Zeilen weg', () => {
    const rows = allgemeinZeilen(
      [
        ['Max', 'Mustermann', 'Herr', 'X GmbH', 'Solar;PV', 40123],
        [null, null, null, 'nur Firma', null, null],
        ['Eva', 'Lang', 'F', null, null, null],
      ],
      ['first_name', 'last_name', 'salutation', 'company', 'tags', 'phone'],
    )
    expect(rows).toEqual([
      {
        first_name: 'Max',
        last_name: 'Mustermann',
        salutation: 'herr',
        company: 'X GmbH',
        tags: ['Solar', 'PV'],
        phone: '40123',
      },
      { first_name: 'Eva', last_name: 'Lang', salutation: 'frau' },
    ])
  })
})
