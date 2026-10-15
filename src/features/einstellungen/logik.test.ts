// Reine Logik M8: Validierung (0–1000 / 0–300 / Prozent), KPI-Umrechnung, Feiertage, Sperrlisten-Pflichtfelder, Backup-Abstand, Dateinamen.
import { describe, expect, it } from 'vitest'
import { SEQUENZEN } from '@/test/fixtures/sequenzen'
import { pruefeZahl } from './components/formularLogik'
import { backupAbstand, backupDateiname, csvDateiname } from './daten/export'
import { zaehleJeSequenz as gruppiere } from '@/data/enrollments'
import { liesPreferences, mergePreferences } from '@/data/members'
import {
  feiertagHinzufuegen,
  kanalUmfang,
  kpiWerte,
  LEERER_EINTRAG,
  passtSperrsuche,
  pruefeEintrag,
  pruefeKpi,
  pruefeLinkedin,
  pruefeProfil,
  pruefeQueue,
  sequenzUpsert,
  sperrGrundText,
  sperrNotiz,
} from './logik'
import { SPERRLISTE } from './_testDaten'

describe('pruefeZahl', () => {
  it('erkennt leer, nicht numerisch und Bereichsgrenzen', () => {
    expect(pruefeZahl('', 0, 10)).toBe('Zahl eingeben')
    expect(pruefeZahl('abc', 0, 10)).toBe('Zahl eingeben')
    expect(pruefeZahl('11', 0, 10)).toBe('Zwischen 0 und 10')
    expect(pruefeZahl('-1', 0, 10, 'Tage')).toBe('Zwischen 0 und 10 Tage')
    expect(pruefeZahl('10', 0, 10)).toBeUndefined()
    expect(pruefeZahl('2,5', 0, 10)).toBeUndefined()
  })
})

describe('Ziele-Validierung', () => {
  it('Tagesziel 0–1000, Zurückziehen 0–300, Warnschwelle Prozent', () => {
    const f = pruefeLinkedin({
      daily_target: '1001',
      weekly_budget: '150',
      daily_target_default: '30',
      warn_at_pct: '101',
      pending_withdraw_days: '301',
    })
    expect(f.daily_target).toBe('Zwischen 0 und 1000')
    expect(f.weekly_budget).toBeUndefined()
    expect(f.warn_at_pct).toBe('Zwischen 0 und 100\u202F%')
    expect(f.pending_withdraw_days).toBe('Zwischen 0 und 300 Tage')
  })
  it('Queue: Uhrzeit HH:MM, Kommend-Tage 0–30', () => {
    expect(pruefeQueue({ withdraw_weekday: '5', due_time: '9 Uhr', kommend_days: '31' })).toEqual({
      kommend_days: 'Zwischen 0 und 30 Tage',
      due_time: 'Uhrzeit als HH:MM',
    })
  })
  it('KPI: Prozentfelder 0–100, Umrechnung in Anteile', () => {
    const e = {
      annahme_quote: '25',
      antwort_quote: '20',
      pitch_quote: '30',
      erstgespraech_quote: '50',
      connect_rate: '30',
      entscheider_quote: '15',
      termine_pro_100_anrufe: '3',
      antwortzeit_werktage: '1',
    }
    expect(Object.values(pruefeKpi(e)).every((v) => v === undefined)).toBe(true)
    expect(pruefeKpi({ ...e, annahme_quote: '120' }).annahme_quote).toBe('Zwischen 0 und 100\u202F%')
    expect(kpiWerte(e)).toEqual({
      annahme_quote: 0.25,
      antwort_quote: 0.2,
      pitch_quote: 0.3,
      erstgespraech_quote: 0.5,
      connect_rate: 0.3,
      entscheider_quote: 0.15,
      termine_pro_100_anrufe: 3,
      antwortzeit_werktage: 1,
    })
  })
  it('Feiertage: sortiert, ohne Dubletten', () => {
    expect(feiertagHinzufuegen(['2026-12-25', '2026-10-31'], '2026-12-24')).toEqual([
      '2026-10-31',
      '2026-12-24',
      '2026-12-25',
    ])
    expect(feiertagHinzufuegen(['2026-12-25'], '2026-12-25')).toEqual(['2026-12-25'])
  })
})

describe('Profil', () => {
  it('Rufnummer muss sich nach E.164 wandeln lassen, Kürzel ≤ 3, Calendly-Link geprüft', () => {
    const basis = {
      short_name: 'VS',
      linkedin_plan: 'premium' as const,
      weekly_budget: '150',
      daily_target: '30',
      rufnummer: '040 123456',
      signature: '',
      calendly_url: '',
      preferences: liesPreferences({}),
    }
    expect(pruefeProfil(basis)).toEqual({})
    expect(pruefeProfil({ ...basis, rufnummer: '12' }).rufnummer).toBe('Nummer unvollständig')
    expect(pruefeProfil({ ...basis, short_name: 'VINC' }).short_name).toBe('Höchstens 3 Zeichen')
    expect(pruefeProfil({ ...basis, calendly_url: 'http://x' }).calendly_url).toContain('calendly.com')
  })
  it('preferences: Standard alles an, Merge behält fremde Keys', () => {
    expect(liesPreferences(null)).toEqual({
      kanaele: { linkedin: true, telefon: true, email: true },
      realtime_toasts: true,
    })
    const p = liesPreferences({ kanaele: { telefon: false }, realtime_toasts: false })
    expect(p.kanaele).toEqual({ linkedin: true, telefon: false, email: true })
    expect(mergePreferences({ fremd: 1 }, p)).toEqual({
      fremd: 1,
      kanaele: { linkedin: true, telefon: false, email: true },
      realtime_toasts: false,
    })
  })
})

describe('Sperrliste', () => {
  it('mindestens ein Schlüssel und ein Grund Pflicht', () => {
    const f = pruefeEintrag({ ...LEERER_EINTRAG })
    expect(f.schluessel).toMatch(/Mindestens eine Angabe/)
    expect(f.grund).toBe('Grund eingeben')
    expect(pruefeEintrag({ ...LEERER_EINTRAG, email: 'a@b.de', grund: 'x' })).toEqual({})
    expect(pruefeEintrag({ ...LEERER_EINTRAG, url: 'linkedin.com/company/x', grund: 'x' }).url).toMatch(/Profil-URL/)
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

describe('Sequenzen', () => {
  it('sequenzUpsert schreibt nur active und lässt steps weg', () => {
    const u = sequenzUpsert(SEQUENZEN[3]!, true)
    expect(u.active).toBe(true)
    expect(u.key).toBe('linkedin_sheet_regel')
    expect('steps' in u).toBe(false)
  })
  it('gruppiere zählt je sequence_id', () => {
    const m = gruppiere([{ sequence_id: 'a' }, { sequence_id: 'a' }, { sequence_id: 'b' }])
    expect(m.get('a')).toBe(2)
    expect(m.get('b')).toBe(1)
    expect(m.get('c')).toBeUndefined()
  })
})

describe('Export', () => {
  it('Dateinamen nach § 3.9 / ux § 3.10', () => {
    expect(csvDateiname('leads', '2026-10-14')).toBe('crm-leads-2026-10-14.csv')
    expect(csvDateiname('kpi-tageswerte', '2026-10-14')).toBe('crm-kpi-tageswerte-2026-10-14.csv')
    expect(backupDateiname('2026-10-14')).toBe('steinerundco-crm-backup-2026-10-14.json')
  })
  it('backupAbstand: heute · gestern · vor n Tagen', () => {
    expect(backupAbstand('2026-10-14T08:00:00+02:00', '2026-10-14')).toBe('heute')
    expect(backupAbstand('2026-10-13T23:30:00+02:00', '2026-10-14')).toBe('gestern')
    expect(backupAbstand('2026-10-05T08:00:00+02:00', '2026-10-14')).toBe('vor 9 Tagen')
  })
})
