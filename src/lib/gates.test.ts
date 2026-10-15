// BAUPLAN § 3.1.12 – alle Gründe inkl. firma_gesperrt (§ 8, § 1.5 Nr. 27).
import { describe, expect, it } from 'vitest'
import { SETTINGS } from '@/test/fixtures/settings'
import type { Email } from '@/types/domain'
import {
  emailGate,
  emailSequenzStartbar,
  hatSperrlistenTreffer,
  kontaktGate,
  linkedinBudget,
  nachfassZaehler,
  telefonGate,
  type GateLead,
} from './gates'
import { SEQUENZ } from './vorlagenKeys'

const frei: GateLead = {
  phone_e164: '+4940123456',
  call_basis: 'linkedin_vernetzt',
  do_not_contact: false,
  do_not_contact_channels: null,
  email: 'test@example.com',
  email_consent_basis: 'requested_linkedin',
  email_consent_at: '2026-10-01',
  last_inbound_at: null,
  companies: { do_not_contact: false },
}
const HEUTE = '2026-10-14'

describe('telefonGate', () => {
  it('erlaubt mit Nummer + Anrufgrund', () => {
    expect(telefonGate(frei)).toEqual({ erlaubt: true })
    expect(telefonGate(frei, [])).toEqual({ erlaubt: true })
  })
  it('keine_nummer / kein_anrufgrund', () => {
    expect(telefonGate({ ...frei, phone_e164: null })).toEqual({ erlaubt: false, grund: 'keine_nummer' })
    expect(telefonGate({ ...frei, call_basis: null })).toEqual({ erlaubt: false, grund: 'kein_anrufgrund' })
  })
  it('sperrliste (Treffer boolean oder mit Kanal)', () => {
    expect(telefonGate(frei, true).grund).toBe('sperrliste')
    expect(telefonGate(frei, [{ channels: ['telefon'] }]).grund).toBe('sperrliste')
    expect(telefonGate(frei, [{ channels: [] }]).grund).toBe('sperrliste')
    expect(telefonGate(frei, [{ channels: ['email'] }])).toEqual({ erlaubt: true })
  })
  it('widerspruch (alle Kanäle oder Telefon)', () => {
    expect(telefonGate({ ...frei, do_not_contact: true }).grund).toBe('widerspruch')
    expect(telefonGate({ ...frei, do_not_contact: true, do_not_contact_channels: ['telefon'] }).grund).toBe(
      'widerspruch',
    )
    expect(telefonGate({ ...frei, do_not_contact: true, do_not_contact_channels: ['email'] })).toEqual({
      erlaubt: true,
    })
  })
  it('firma_gesperrt', () => {
    expect(telefonGate({ ...frei, companies: { do_not_contact: true } })).toEqual({
      erlaubt: false,
      grund: 'firma_gesperrt',
    })
    expect(telefonGate({ ...frei, companies: null })).toEqual({ erlaubt: true })
  })
  it('Reihenfolge: harte Sperren vor fehlenden Daten', () => {
    expect(telefonGate({ ...frei, phone_e164: null, companies: { do_not_contact: true } }).grund).toBe('firma_gesperrt')
    expect(telefonGate({ ...frei, phone_e164: null, do_not_contact: true }, true).grund).toBe('widerspruch')
  })
})

describe('emailGate', () => {
  const opts = { heute: HEUTE }
  it('erlaubt mit Grundlage und Adresse', () => {
    expect(emailGate(frei, 0, false, opts)).toEqual({ erlaubt: true })
    expect(emailGate(frei, 2, [], opts)).toEqual({ erlaubt: true })
  })
  it('keine_grundlage / widerspruch (revoked)', () => {
    expect(emailGate({ ...frei, email_consent_basis: 'none' }, 0, false, opts)).toEqual({
      erlaubt: false,
      grund: 'keine_grundlage',
    })
    expect(emailGate({ ...frei, email_consent_basis: 'revoked' }, 0, false, opts).grund).toBe('widerspruch')
    expect(emailGate({ ...frei, do_not_contact: true, do_not_contact_channels: ['email'] }, 0, false, opts).grund).toBe(
      'widerspruch',
    )
    expect(emailGate({ ...frei, do_not_contact: true, do_not_contact_channels: ['telefon'] }, 0, false, opts)).toEqual({
      erlaubt: true,
    })
  })
  it('zu_viele_nachfass ab drei gesendeten (E12: ≤ 3)', () => {
    expect(emailGate(frei, 3, false, opts)).toEqual({ erlaubt: false, grund: 'zu_viele_nachfass' })
    expect(emailGate(frei, 4, false, opts).grund).toBe('zu_viele_nachfass')
    expect(emailGate(frei, 4, false, { ...opts, maxNachfass: 5 })).toEqual({ erlaubt: true })
  })
  it('sperrliste / keine_adresse / firma_gesperrt', () => {
    expect(emailGate(frei, 0, true, opts).grund).toBe('sperrliste')
    expect(emailGate(frei, 0, [{ channels: ['email'] }], opts).grund).toBe('sperrliste')
    expect(emailGate(frei, 0, [{ channels: ['telefon'] }], opts)).toEqual({ erlaubt: true })
    expect(emailGate({ ...frei, email: null }, 0, false, opts)).toEqual({ erlaubt: false, grund: 'keine_adresse' })
    expect(emailGate({ ...frei, email: ' ' }, 0, false, opts).grund).toBe('keine_adresse')
    expect(emailGate({ ...frei, companies: { do_not_contact: true } }, 0, false, opts)).toEqual({
      erlaubt: false,
      grund: 'firma_gesperrt',
    })
  })
  it('aelter_12_monate: Warnung, kein Block; eingehender Kontakt seitdem hebt sie auf', () => {
    const alt = { ...frei, email_consent_at: '2025-09-01' }
    expect(emailGate(alt, 0, false, opts)).toEqual({ erlaubt: true, warnung: 'aelter_12_monate' })
    expect(emailGate({ ...alt, last_inbound_at: '2026-03-01T10:00:00Z' }, 0, false, opts)).toEqual({ erlaubt: true })
    expect(emailGate({ ...alt, last_inbound_at: '2025-08-01T10:00:00Z' }, 0, false, opts).warnung).toBe(
      'aelter_12_monate',
    )
    // genau 12 Monate: noch keine Warnung, einen Tag später ja
    expect(emailGate({ ...frei, email_consent_at: '2025-10-14' }, 0, false, opts)).toEqual({ erlaubt: true })
    expect(emailGate({ ...frei, email_consent_at: '2025-10-13' }, 0, false, opts).warnung).toBe('aelter_12_monate')
    expect(emailGate(alt, 0, false, { ...opts, maxAlterMonate: 24 })).toEqual({ erlaubt: true })
  })
  it('transaktional: Regeln 1–3 entfallen, Sperrliste/Adresse/Firma bleiben', () => {
    const t = { ...opts, transaktional: true }
    expect(emailGate({ ...frei, email_consent_basis: 'none' }, 9, false, t)).toEqual({ erlaubt: true })
    expect(emailGate({ ...frei, email_consent_basis: 'none', email: null }, 0, false, t).grund).toBe('keine_adresse')
    expect(emailGate({ ...frei, email_consent_basis: 'none' }, 0, true, t).grund).toBe('sperrliste')
    expect(
      emailGate({ ...frei, email_consent_basis: 'none', companies: { do_not_contact: true } }, 0, false, t).grund,
    ).toBe('firma_gesperrt')
    // revoked bleibt auch transaktional ein Widerspruch (§ 8.1 Nr. 6)
    expect(emailGate({ ...frei, email_consent_basis: 'revoked' }, 0, false, t).grund).toBe('widerspruch')
  })
})

describe('kontaktGate (LinkedIn)', () => {
  it('erlaubt / widerspruch / sperrliste / firma_gesperrt', () => {
    expect(kontaktGate(frei)).toEqual({ erlaubt: true })
    expect(kontaktGate({ ...frei, phone_e164: null, email: null, email_consent_basis: 'none' })).toEqual({
      erlaubt: true,
    })
    expect(kontaktGate({ ...frei, do_not_contact: true })).toEqual({ erlaubt: false, grund: 'widerspruch' })
    expect(kontaktGate({ ...frei, do_not_contact: true, do_not_contact_channels: ['linkedin'] }).grund).toBe(
      'widerspruch',
    )
    expect(kontaktGate({ ...frei, do_not_contact: true, do_not_contact_channels: ['email'] })).toEqual({
      erlaubt: true,
    })
    expect(kontaktGate(frei, true)).toEqual({ erlaubt: false, grund: 'sperrliste' })
    expect(kontaktGate(frei, [{ channels: ['linkedin'] }]).grund).toBe('sperrliste')
    expect(kontaktGate({ ...frei, companies: { do_not_contact: true } })).toEqual({
      erlaubt: false,
      grund: 'firma_gesperrt',
    })
  })
})

describe('linkedinBudget', () => {
  const profil = { weekly_budget: 150, daily_target: 30, linkedin_plan: 'premium' as const }
  it('heute noch möglich = min(Tagesziel − heute, Wochenbudget − Woche)', () => {
    expect(linkedinBudget(SETTINGS, profil, 100, 10)).toMatchObject({ moeglich: 20, warnung: false, erreicht: false })
    expect(linkedinBudget(SETTINGS, profil, 140, 0)).toMatchObject({ moeglich: 10, warnung: true, erreicht: false })
    expect(linkedinBudget(SETTINGS, profil, 135, 0).warnung).toBe(true) // 90 %
    expect(linkedinBudget(SETTINGS, profil, 134, 0).warnung).toBe(false)
    expect(linkedinBudget(SETTINGS, profil, 150, 0)).toMatchObject({ moeglich: 0, warnung: true, erreicht: true })
    expect(linkedinBudget(SETTINGS, profil, 160, 5).moeglich).toBe(0)
    expect(linkedinBudget(SETTINGS, profil, 0, 30).moeglich).toBe(0)
  })
  it('Fallbacks: Plan aus Settings, sonst 150/100 und 30', () => {
    expect(linkedinBudget(SETTINGS, { linkedin_plan: 'basic' }, 0, 0)).toMatchObject({
      wochenbudget: 100,
      tagesziel: 30,
    })
    expect(linkedinBudget(SETTINGS, { linkedin_plan: 'sales_navigator' }, 0, 0).wochenbudget).toBe(200)
    expect(linkedinBudget(null, null, 0, 0)).toMatchObject({ wochenbudget: 150, tagesziel: 30, moeglich: 30 })
    expect(linkedinBudget(null, { linkedin_plan: 'basic' }, 0, 0).wochenbudget).toBe(100)
  })
})

// Integration M1–M8: vorher features/sequenzen/startbar.test.ts, features/heute/gate (Nachfass), features/email/gate.
describe('emailSequenzStartbar (M-13, ux § 3.6.3)', () => {
  const mail = (key: string) => ({ key, channel: 'email' as const })
  it('No-Show Erstgespräch: transaktional – nur Adresse nötig', () => {
    expect(
      emailSequenzStartbar(mail(SEQUENZ.email_noshow_erstgespraech), { email: 'a@b.de', email_consent_basis: 'none' }),
    ).toEqual({ startbar: true })
    expect(emailSequenzStartbar(mail(SEQUENZ.email_noshow_erstgespraech), { email: null })).toEqual({
      startbar: false,
      grund: 'keine_adresse',
    })
  })
  it('Nachbereitung nur mit meeting_held / existing_customer', () => {
    const k = mail(SEQUENZ.email_warm_after_strategiegespraech)
    expect(emailSequenzStartbar(k, { email: 'a@b.de', email_consent_basis: 'meeting_held' }).startbar).toBe(true)
    expect(emailSequenzStartbar(k, { email: 'a@b.de', email_consent_basis: 'existing_customer' }).startbar).toBe(true)
    expect(emailSequenzStartbar(k, { email: 'a@b.de', email_consent_basis: 'requested_linkedin' })).toEqual({
      startbar: false,
      grund: 'nur_nach_gespraech',
    })
  })
  it('Infomail: jede Grundlage außer none/revoked', () => {
    const k = mail(SEQUENZ.email_info_nach_linkedin_zusage)
    expect(emailSequenzStartbar(k, { email: 'a@b.de', email_consent_basis: 'requested_linkedin' }).startbar).toBe(true)
    expect(emailSequenzStartbar(k, { email: 'a@b.de', email_consent_basis: 'revoked' })).toEqual({
      startbar: false,
      grund: 'keine_grundlage',
    })
  })
  it('LinkedIn/Telefon: keine Zusatzregel', () => {
    expect(emailSequenzStartbar({ key: SEQUENZ.linkedin_standard, channel: 'linkedin' }, null).startbar).toBe(true)
    expect(emailSequenzStartbar({ key: SEQUENZ.telefon_standard, channel: 'telefon' }, {}).startbar).toBe(true)
  })
})

describe('nachfassZaehler (Regel 3, E12)', () => {
  const mail = (p: Partial<Email>) =>
    ({
      direction: 'out',
      status: 'sent_confirmed',
      sent_at: '2026-10-10T10:00:00Z',
      status_at: '2026-10-10T10:00:00Z',
      ...p,
    }) as Email
  const lead = { email_consent_at: '2026-10-01T09:00:00Z', last_inbound_at: null }
  it('zählt gesendete ausgehende Mails seit Erlaubnis ohne Antwort', () => {
    expect(
      nachfassZaehler(
        [mail({}), mail({ status: 'replied' }), mail({ status: 'draft' }), mail({ direction: 'in' })],
        lead,
      ),
    ).toBe(1)
    expect(nachfassZaehler([mail({ sent_at: '2026-09-01T10:00:00Z' })], lead)).toBe(0)
  })
  it('ein Eingang nach der Erlaubnis setzt die Kette zurück; ohne Mails 0', () => {
    expect(nachfassZaehler([mail({})], { ...lead, last_inbound_at: '2026-10-11T09:00:00Z' })).toBe(0)
    expect(nachfassZaehler(undefined, lead)).toBe(0)
  })
})

describe('hatSperrlistenTreffer (Runde 2: Chip „Sperrliste“ an jedem Lead)', () => {
  it('leeres Array, null und false sind kein Treffer', () => {
    expect(hatSperrlistenTreffer([])).toBe(false)
    expect(hatSperrlistenTreffer(null)).toBe(false)
    expect(hatSperrlistenTreffer(undefined)).toBe(false)
    expect(hatSperrlistenTreffer(false)).toBe(false)
  })
  it('true oder mindestens ein Eintrag ist ein Treffer', () => {
    expect(hatSperrlistenTreffer(true)).toBe(true)
    expect(hatSperrlistenTreffer([{ channels: ['telefon'] }])).toBe(true)
  })
})
