import { describe, expect, it } from 'vitest'
import { parseAnrede, parseName } from './name'

describe('parser/name', () => {
  it('trennt Vor- und Nachname, letztes Wort = Nachname', () => {
    expect(parseName('Max Mustermann')).toMatchObject({ first_name: 'Max', last_name: 'Mustermann', title: null })
    expect(parseName('Jan-Ole Brackmann')).toMatchObject({ first_name: 'Jan-Ole', last_name: 'Brackmann' })
    expect(parseName('Anna Maria Beispiel')).toMatchObject({ first_name: 'Anna Maria', last_name: 'Beispiel' })
  })
  it('Adelspartikel von/van/de/zu/der gehören zum Nachnamen', () => {
    expect(parseName('Tom van der Berg')).toMatchObject({ first_name: 'Tom', last_name: 'van der Berg' })
    expect(parseName('Ursula von der Leyen')).toMatchObject({ first_name: 'Ursula', last_name: 'von der Leyen' })
    expect(parseName('Karl zu Guttenberg')).toMatchObject({ first_name: 'Karl', last_name: 'zu Guttenberg' })
    expect(parseName('Pierre de Coubertin')).toMatchObject({ first_name: 'Pierre', last_name: 'de Coubertin' })
  })
  it('Dr./Prof. → title, bleibt im Anzeigenamen', () => {
    expect(parseName('Dr. Anna Beispiel')).toMatchObject({
      name: 'Dr. Anna Beispiel',
      title: 'Dr.',
      first_name: 'Anna',
    })
    expect(parseName('Prof. Dr. Hans Meier')).toMatchObject({
      title: 'Prof. Dr.',
      first_name: 'Hans',
      last_name: 'Meier',
    })
  })
  it('Herr/Frau/Hr./Fr. → salutation, entfernt aus dem Namen', () => {
    expect(parseName('Herr Kai Lenz')).toMatchObject({ salutation: 'herr', name: 'Kai Lenz', first_name: 'Kai' })
    expect(parseName('Frau Petra Schmidt')).toMatchObject({ salutation: 'frau', name: 'Petra Schmidt' })
    expect(parseName('Fr. Dr. Eva Lang')).toMatchObject({
      salutation: 'frau',
      title: 'Dr.',
      first_name: 'Eva',
      last_name: 'Lang',
    })
  })
  it('Fettdruck und Satzzeichen am Rand werden entfernt', () => {
    expect(parseName('**Jörg Müller** –')).toMatchObject({ first_name: 'Jörg', last_name: 'Müller' })
  })
  it('ein Wort → nur Nachname; leer → alles null', () => {
    expect(parseName('Madonna')).toMatchObject({ first_name: null, last_name: 'Madonna' })
    expect(parseName('')).toEqual({ name: null, first_name: null, last_name: null, title: null, salutation: null })
    expect(parseName(null)).toMatchObject({ name: null })
  })
  it('parseAnrede', () => {
    expect(parseAnrede('Herr')).toBe('herr')
    expect(parseAnrede('F')).toBe('frau')
    expect(parseAnrede('–')).toBe('neutral')
    expect(parseAnrede('x')).toBeNull()
  })
})
