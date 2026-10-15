import { describe, expect, it } from 'vitest'
import { dekodiere, erkenneDelimiter, mappeKopf, parseCsv, tabelleZuDatensaetze } from './csv'
import { zielFeldFuerKopf } from './kopfwort'

describe('parser/csv', () => {
  it('erkennt ; vs , vs Tab', () => {
    expect(erkenneDelimiter('Name;Position;Unternehmen')).toBe(';')
    expect(erkenneDelimiter('Name,Position,Unternehmen')).toBe(',')
    expect(erkenneDelimiter('Name\tPosition\tUnternehmen')).toBe('\t')
    expect(erkenneDelimiter('Name, Inc.;Position;Firma')).toBe(';')
  })
  it('parst mit BOM, CRLF und Anführungszeichen', () => {
    const t = parseCsv(
      '﻿Name;Unternehmen;LinkedIn\r\n"Müller, Jörg";"Müller Solar GmbH";https://www.linkedin.com/in/j\r\n',
    )
    expect(t.delimiter).toBe(';')
    expect(t.kopf).toEqual(['Name', 'Unternehmen', 'LinkedIn'])
    expect(t.zeilen).toEqual([['Müller, Jörg', 'Müller Solar GmbH', 'https://www.linkedin.com/in/j']])
  })
  it('dekodiert UTF-8 und fällt auf Latin-1 zurück', () => {
    const utf8 = new TextEncoder().encode('Jörg').buffer
    expect(dekodiere(utf8 as ArrayBuffer)).toBe('Jörg')
    const latin1 = new Uint8Array([0x4a, 0xf6, 0x72, 0x67]).buffer
    expect(dekodiere(latin1 as ArrayBuffer)).toBe('Jörg')
    const bom = new Uint8Array([0xef, 0xbb, 0xbf, 0x41]).buffer
    expect(dekodiere(bom as ArrayBuffer)).toBe('A')
  })
  it('Kopfwort-Mapping § 6.2 (Teilstring, case-insensitiv, Umlaute transliteriert)', () => {
    expect(zielFeldFuerKopf('Vor- und Nachname')).toBe('name')
    expect(zielFeldFuerKopf('Vorname')).toBe('first_name')
    expect(zielFeldFuerKopf('NACHNAME')).toBe('last_name')
    expect(zielFeldFuerKopf('Unternehmen')).toBe('company')
    expect(zielFeldFuerKopf('Firma')).toBe('company')
    expect(zielFeldFuerKopf('Position')).toBe('role_title')
    expect(zielFeldFuerKopf('Titel')).toBe('role_title')
    expect(zielFeldFuerKopf('LinkedIn-URL')).toBe('linkedin_url')
    expect(zielFeldFuerKopf('Profil')).toBe('linkedin_url')
    expect(zielFeldFuerKopf('Ort')).toBe('city')
    expect(zielFeldFuerKopf('Standort')).toBe('city')
    expect(zielFeldFuerKopf('Telefonnummer')).toBe('phone')
    expect(zielFeldFuerKopf('E-Mail')).toBe('email')
    expect(zielFeldFuerKopf('Notizen')).toBe('notes')
    expect(zielFeldFuerKopf('Tags')).toBe('tags')
    expect(zielFeldFuerKopf('Anrede')).toBe('salutation')
    expect(zielFeldFuerKopf('Kontakt')).toBe('name')
    expect(zielFeldFuerKopf('Umsatz')).toBeNull()
    expect(mappeKopf(['Name', 'Name', 'Firma'])).toEqual(['name', null, 'company'])
  })
  it('Tabelle → Datensätze (leere Zeilen weg, Zeilennummer ab 2)', () => {
    const ds = tabelleZuDatensaetze(
      [
        ['Max Mustermann', 'X GmbH'],
        ['', ''],
        ['Eva Lang', ''],
      ],
      ['name', 'company'],
    )
    expect(ds).toEqual([
      { _zeile: 2, name: 'Max Mustermann', company: 'X GmbH' },
      { _zeile: 4, name: 'Eva Lang' },
    ])
  })
})
