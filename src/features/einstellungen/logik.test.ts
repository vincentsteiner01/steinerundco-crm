// Reine Logik der Einstellungen: Profil-Prüfung, Feiertage, Sperrlisten-Pflichtfelder, Backup-Abstand, Dateinamen.
import { describe, expect, it } from 'vitest'
import { backupAbstand, backupDateiname, csvDateiname } from './daten/export'
import {
  feiertagHinzufuegen,
  feiertagJahre,
  kanalUmfang,
  LEERER_EINTRAG,
  passtSperrsuche,
  pruefeEintrag,
  pruefeProfil,
  sperrGrundText,
  sperrNotiz,
} from './logik'
import { SPERRLISTE } from './_testDaten'

describe('Profil', () => {
  it('Kürzel höchstens 3 Zeichen, Calendly-Link geprüft, leere Felder erlaubt', () => {
    const basis = { short_name: 'VS', signature: '', calendly_url: '' }
    expect(pruefeProfil(basis)).toEqual({})
    expect(pruefeProfil({ ...basis, short_name: 'VINC' }).short_name).toBe('Höchstens 3 Zeichen')
    // Ein altes längeres Kürzel aus der Datenbank bleibt gültig, solange es unverändert ist
    const alt = { ...basis, short_name: 'Mike' }
    expect(pruefeProfil({ ...alt, signature: 'neu' }, alt)).toEqual({})
    expect(pruefeProfil({ ...alt, short_name: 'MIKE' }, alt).short_name).toBe('Höchstens 3 Zeichen')
    expect(pruefeProfil({ ...alt, short_name: 'MM' }, alt)).toEqual({})
    expect(pruefeProfil({ ...basis, calendly_url: 'http://x' }).calendly_url).toContain('calendly.com')
    expect(pruefeProfil({ ...basis, calendly_url: ' https://calendly.com/muster ' })).toEqual({})
  })
})

describe('Feiertage', () => {
  it('hinzufügen: sortiert, ohne Dubletten', () => {
    expect(feiertagHinzufuegen(['2026-12-25', '2026-10-31'], '2026-12-24')).toEqual([
      '2026-10-31',
      '2026-12-24',
      '2026-12-25',
    ])
    expect(feiertagHinzufuegen(['2026-12-25'], '2026-12-25')).toEqual(['2026-12-25'])
  })
  it('Jahre für die Auswahl: jedes einmal, aufsteigend', () => {
    expect(feiertagJahre(['2027-01-01', '2026-12-25', '2026-10-31', '2028-01-01'])).toEqual(['2026', '2027', '2028'])
    expect(feiertagJahre([])).toEqual([])
  })
})

describe('Sperrliste', () => {
  it('mindestens ein Schlüssel und ein Grund Pflicht', () => {
    const f = pruefeEintrag({ ...LEERER_EINTRAG })
    expect(f.schluessel).toMatch(/Mindestens eine Angabe/)
    expect(f.grund).toBe('Grund eingeben')
    expect(pruefeEintrag({ ...LEERER_EINTRAG, email: 'a@b.de', grund: 'x' })).toEqual({})
    expect(pruefeEintrag({ ...LEERER_EINTRAG, url: 'linkedin.com/company/x', grund: 'x' }).url).toMatch(/Profil-Link/)
    expect(pruefeEintrag({ ...LEERER_EINTRAG, telefon: '12', grund: 'x' }).telefon).toBe('Nummer unvollständig')
    expect(pruefeEintrag({ ...LEERER_EINTRAG, email: 'a@b.de', grund: 'x', kanaele: [] }).kanaele).toBeDefined()
  })
  it('manueller Eintrag: Freitext-Grund + Notiz in `note`, Anzeige mit Enum-Label (reason-Check der DB, Review)', () => {
    expect(sperrNotiz(' Widerspruch per Telefon ', '')).toBe('Widerspruch per Telefon')
    expect(sperrNotiz('Bitte nicht', 'Mail vom 12.10.')).toBe('Bitte nicht – Mail vom 12.10.')
    expect(sperrNotiz(' ', ' ')).toBeNull()
    expect(sperrGrundText('manuell', 'Bitte nicht')).toBe('Manuell · Bitte nicht')
    expect(sperrGrundText('bounce', null)).toBe('Bounce')
  })
  it('Kanal-Umfang und Suche', () => {
    expect(kanalUmfang(['linkedin', 'telefon', 'email'])).toBe('alle Kanäle')
    expect(kanalUmfang(['email'])).toBe('E-Mail')
    expect(passtSperrsuche(SPERRLISTE[0]!, 'solar 99')).toBe(true)
    expect(passtSperrsuche(SPERRLISTE[0]!, 'widerspruch gesperrt')).toBe(true)
    expect(passtSperrsuche(SPERRLISTE[1]!, 'solar')).toBe(false)
  })
})

describe('Export', () => {
  it('Dateinamen nach § 3.9 / ux § 3.10', () => {
    expect(csvDateiname('leads', '2026-10-14')).toBe('crm-leads-2026-10-14.csv')
    expect(csvDateiname('emails', '2026-10-14')).toBe('crm-emails-2026-10-14.csv')
    expect(backupDateiname('2026-10-14')).toBe('steinerundco-crm-backup-2026-10-14.json')
  })
  it('backupAbstand: heute · gestern · vor n Tagen', () => {
    expect(backupAbstand('2026-10-14T08:00:00+02:00', '2026-10-14')).toBe('heute')
    expect(backupAbstand('2026-10-13T23:30:00+02:00', '2026-10-14')).toBe('gestern')
    expect(backupAbstand('2026-10-05T08:00:00+02:00', '2026-10-14')).toBe('vor 9 Tagen')
  })
})
