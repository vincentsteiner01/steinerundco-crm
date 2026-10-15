// gate.test.ts (BAUPLAN § 3.5): alle Regeln 1–7 + Transaktional-Ausnahme, Nachfass-Zähler, Sperrlisten-Treffer, Sequenz-Startbarkeit (M-13).
import { describe, expect, it } from 'vitest'
import type { SperrlisteEintrag } from '@/types/domain'
import { email, leadMitErlaubnis, VORLAGE_INFO, VORLAGE_NOSHOW } from './_testHilfe'
import { emailSequenzStartbar as startbar, nachfassZaehler } from '@/lib/gates'
import { EMAIL_WARNUNG_12_MONATE as WARNUNG_12_MONATE } from '@/texte/de'
import { berechneGate, gateText, sperrlistenTreffer } from './gate'

const emailSequenzStartbar = (key: string, lead: Parameters<typeof startbar>[1]) =>
  startbar({ key, channel: 'email' }, lead)

const HEUTE = '2026-10-15'
const gate = (p: Partial<Parameters<typeof berechneGate>[0]> = {}) =>
  berechneGate({ lead: leadMitErlaubnis(), template: VORLAGE_INFO, heute: HEUTE, ...p })

describe('emailGate – Regeln', () => {
  it('erlaubt mit Grundlage, Adresse, ohne Treffer', () => {
    expect(gate()).toMatchObject({ erlaubt: true, text: null, nachfassZaehler: 0, transaktional: false })
  })

  it('1) none → gesperrt mit Tooltip-Text inkl. Vorname (M-01)', () => {
    const g = gate({ lead: leadMitErlaubnis({ email_consent_basis: 'none' }) })
    expect(g).toMatchObject({ erlaubt: false, grund: 'keine_grundlage' })
    expect(g.text).toBe(
      'Keine Erlaubnis-Grundlage. Trag ein, wann und wie Tobias um die Mail gebeten hat – oder frag erst auf LinkedIn/am Telefon.',
    )
  })

  it('1) revoked → Widerspruch, gesperrt', () => {
    expect(gate({ lead: leadMitErlaubnis({ email_consent_basis: 'revoked' }) })).toMatchObject({
      erlaubt: false,
      grund: 'widerspruch',
      text: 'Widerspruch – nicht kontaktieren',
    })
  })

  it('2) Grundlage > 12 Monate ohne Eingang → erlaubt mit Warnung (M-02)', () => {
    const g = gate({ lead: leadMitErlaubnis({ email_consent_at: '2025-09-01T09:00:00+02:00' }) })
    expect(g).toMatchObject({ erlaubt: true, warnung: 'aelter_12_monate', warnungText: WARNUNG_12_MONATE })
    const mitEingang = gate({
      lead: leadMitErlaubnis({
        email_consent_at: '2025-09-01T09:00:00+02:00',
        last_inbound_at: '2026-06-01T09:00:00+02:00',
      }),
    })
    expect(mitEingang.warnung).toBeUndefined()
  })

  it('3) drei unbeantwortete Mails seit der Grundlage → vierte gesperrt mit Hinweis (M-03)', () => {
    const drei = [email(), email(), email()]
    const g = gate({ emails: drei })
    expect(g).toMatchObject({ erlaubt: false, grund: 'zu_viele_nachfass', nachfassZaehler: 3 })
    expect(g.text).toContain('Thema schließen oder neuen Anlass schaffen (LinkedIn/Telefon)')
    expect(gate({ emails: drei.slice(0, 2) })).toMatchObject({ erlaubt: true, nachfassZaehler: 2 })
  })

  it('3) Antwort des Leads setzt den Zähler zurück; beantwortete/verworfene Mails zählen nicht', () => {
    const lead = leadMitErlaubnis()
    expect(
      nachfassZaehler([email({ status: 'replied' }), email({ status: 'failed' }), email({ status: 'draft' })], lead),
    ).toBe(0)
    const alt = email({ sent_at: '2026-10-06T10:00:00+02:00' })
    expect(nachfassZaehler([alt, alt, alt], { ...lead, last_inbound_at: '2026-10-08T10:00:00+02:00' })).toBe(0)
    expect(nachfassZaehler([email({ sent_at: '2026-10-01T10:00:00+02:00' })], lead)).toBe(0) // vor der Grundlage
  })

  it('4) Sperrlisten-Treffer (Adresse oder Lead) → gesperrt, kein Override (M-09)', () => {
    const treffer = [
      { id: 's1', email: 'TOBIAS.LINDNER@beispiel.de', lead_id: null, channels: ['email'] },
    ] as unknown as SperrlisteEintrag[]
    expect(gate({ sperrliste: treffer })).toMatchObject({ erlaubt: false, grund: 'sperrliste' })
    expect(gate({ sperrliste: treffer, template: VORLAGE_NOSHOW })).toMatchObject({
      erlaubt: false,
      grund: 'sperrliste',
    })
    expect(sperrlistenTreffer(treffer, { id: 'x', email: 'andere@b.de' })).toBe(false)
    expect(
      sperrlistenTreffer([{ id: 's2', email: null, lead_id: 'L', channels: [] }] as unknown as SperrlisteEintrag[], {
        id: 'L',
        email: null,
      }),
    ).toHaveLength(1)
  })

  it('4) manueller Eintrag ohne lead_id über Telefon oder LinkedIn-URL, alle Kanäle → gesperrt (Review: vorher nur id/E-Mail)', () => {
    const lead = leadMitErlaubnis({ phone_e164: '+494012345678', linkedin_url_norm: 'linkedin.com/in/tobias-lindner' })
    const perTelefon = [
      { id: 's3', email: null, lead_id: null, phone_e164: '+494012345678', channels: ['linkedin', 'telefon', 'email'] },
    ] as unknown as SperrlisteEintrag[]
    expect(gate({ lead, sperrliste: perTelefon })).toMatchObject({ erlaubt: false, grund: 'sperrliste' })
    const perUrl = [
      { id: 's4', email: null, lead_id: null, linkedin_url_norm: 'linkedin.com/in/tobias-lindner', channels: null },
    ] as unknown as SperrlisteEintrag[]
    expect(gate({ lead, sperrliste: perUrl })).toMatchObject({ erlaubt: false, grund: 'sperrliste' })
    // nur Telefon gesperrt → E-Mail bleibt erlaubt (kanalgenau)
    const nurTelefon = [
      { id: 's5', email: null, lead_id: null, phone_e164: '+494012345678', channels: ['telefon'] },
    ] as unknown as SperrlisteEintrag[]
    expect(gate({ lead, sperrliste: nurTelefon })).toMatchObject({ erlaubt: true })
  })

  it('5) offene Platzhalter → gesperrt „Erst alle Platzhalter eintragen.“ (M-04)', () => {
    expect(gate({ offen: ['Punkt 1'] })).toMatchObject({ erlaubt: false, text: 'Erst alle Platzhalter eintragen.' })
  })

  it('6) keine Adresse → gesperrt', () => {
    expect(gate({ lead: leadMitErlaubnis({ email: null }) })).toMatchObject({ erlaubt: false, grund: 'keine_adresse' })
    expect(gate({ lead: leadMitErlaubnis({ email: '  ' }) })).toMatchObject({ erlaubt: false, grund: 'keine_adresse' })
  })

  it('7) Firmensperre → gesperrt „Firma gesperrt – nicht anschreiben“', () => {
    const lead = { ...leadMitErlaubnis(), companies: { do_not_contact: true } }
    expect(gate({ lead })).toMatchObject({
      erlaubt: false,
      grund: 'firma_gesperrt',
      text: 'Firma gesperrt – nicht anschreiben',
    })
  })

  it('transaktional: Regeln 1–3 entfallen, 4–7 bleiben (M-12)', () => {
    const ohne = leadMitErlaubnis({ email_consent_basis: 'none' })
    expect(gate({ lead: ohne, template: VORLAGE_NOSHOW })).toMatchObject({ erlaubt: true, transaktional: true })
    expect(gate({ template: VORLAGE_NOSHOW, emails: [email(), email(), email(), email()] })).toMatchObject({
      erlaubt: true,
    })
    expect(gate({ lead: { ...ohne, email: null }, template: VORLAGE_NOSHOW })).toMatchObject({
      erlaubt: false,
      grund: 'keine_adresse',
    })
    expect(gate({ lead: { ...ohne, companies: { do_not_contact: true } }, template: VORLAGE_NOSHOW })).toMatchObject({
      erlaubt: false,
      grund: 'firma_gesperrt',
    })
  })

  it('Settings steuern Höchstzahl und Alter', () => {
    const g = gate({
      emails: [email()],
      settings: { email: { ...({} as never), max_followups_per_consent: 1, consent_max_age_months: 12 } },
    })
    expect(g.grund).toBe('zu_viele_nachfass')
  })

  it('ohne Lead: gesperrt', () => {
    expect(berechneGate({ lead: null })).toMatchObject({ erlaubt: false })
  })

  it('gateText kennt jeden Grund', () => {
    for (const g of [
      'keine_grundlage',
      'widerspruch',
      'zu_viele_nachfass',
      'sperrliste',
      'keine_adresse',
      'firma_gesperrt',
      'offene_platzhalter',
    ] as const)
      expect(gateText(g).length).toBeGreaterThan(5)
  })
})

describe('emailSequenzStartbar (M-13)', () => {
  it('No-Show ohne Grundlage startbar, Strategiegespräch nur mit meeting_held/existing_customer', () => {
    const ohne = leadMitErlaubnis({ email_consent_basis: 'none' })
    expect(emailSequenzStartbar('email_noshow_erstgespraech', ohne).startbar).toBe(true)
    expect(emailSequenzStartbar('email_warm_after_strategiegespraech', ohne).startbar).toBe(false)
    expect(emailSequenzStartbar('email_warm_after_strategiegespraech', leadMitErlaubnis()).startbar).toBe(false)
    expect(
      emailSequenzStartbar(
        'email_warm_after_strategiegespraech',
        leadMitErlaubnis({ email_consent_basis: 'meeting_held' }),
      ).startbar,
    ).toBe(true)
    expect(
      emailSequenzStartbar(
        'email_warm_after_erstgespraech',
        leadMitErlaubnis({ email_consent_basis: 'existing_customer' }),
      ).startbar,
    ).toBe(true)
    expect(emailSequenzStartbar('email_info_nach_linkedin_zusage', leadMitErlaubnis()).startbar).toBe(true)
    expect(emailSequenzStartbar('email_noshow_erstgespraech', leadMitErlaubnis({ email: null })).startbar).toBe(false)
  })
})
