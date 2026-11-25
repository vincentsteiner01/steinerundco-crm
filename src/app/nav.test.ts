// Navigation des einfachen CRM (Neustart 25.11.2026): eine Quelle, drei Darstellungen (Sidebar, Icon-Rail, Tab-Leiste) und die
// Aktiv-Logik – jede E-Mail-Seite markiert in Rail und Tab-Leiste denselben einen Punkt.
import { describe, expect, it } from 'vitest'
import {
  aktiverEintrag,
  aktiverRailPfad,
  aktiverTab,
  gruppeVon,
  istGruppe,
  MEHR_LEISTE,
  NAV,
  NAV_BAUM,
  NAV_SEITEN,
  TAB_LEISTE,
} from './nav'

const label = (k: (typeof NAV_BAUM)[number]) => (k === 'trenner' ? '—' : k.label)

describe('drei Darstellungen', () => {
  it('Sidebar: Leads · Leitfäden · E-Mail (vier Unterpunkte, aufgeklappt) · Trenner · Team · Einstellungen · Hilfe', () => {
    expect(NAV_BAUM.map(label)).toEqual(['Leads', 'Leitfäden', 'E-Mail', '—', 'Team', 'Einstellungen', 'Hilfe'])
    const email = NAV_BAUM.find((k) => k !== 'trenner' && istGruppe(k))
    if (!email || email === 'trenner' || !istGruppe(email)) throw new Error('Gruppe E-Mail fehlt')
    expect(email.offenStandard).toBe(true)
    expect(email.kinder.map((e) => [e.label, e.pfad])).toEqual([
      ['Kampagnen', '/email/kampagnen'],
      ['Antworten', '/email/antworten'],
      ['Postfächer', '/email/postfaecher'],
      ['Einzelmails', '/email'],
    ])
    expect(NAV_SEITEN.map((e) => e.pfad)).toEqual([
      '/leads',
      '/leitfaeden',
      '/email/kampagnen',
      '/email/antworten',
      '/email/postfaecher',
      '/email',
      '/team',
      '/einstellungen',
      '/hilfe',
    ])
  })

  it('Icon-Rail: sechs Ikonen, E-Mail als eine Ikone zur ersten E-Mail-Seite', () => {
    const punkte = NAV.filter((n) => n !== 'trenner')
    expect(punkte.map((n) => [n.label, n.pfad])).toEqual([
      ['Leads', '/leads'],
      ['Leitfäden', '/leitfaeden'],
      ['E-Mail', '/email/kampagnen'],
      ['Team', '/team'],
      ['Einstellungen', '/einstellungen'],
      ['Hilfe', '/hilfe'],
    ])
    for (const n of punkte) expect(n.icon, n.label).toBeTruthy()
    expect(NAV.filter((n) => n === 'trenner')).toHaveLength(1)
  })

  it('Tab-Leiste: Leads · Leitfäden · E-Mail, unter „Mehr“ Team · Einstellungen · Hilfe – zusammen dieselben sechs Punkte', () => {
    expect(TAB_LEISTE.map((t) => t.label)).toEqual(['Leads', 'Leitfäden', 'E-Mail'])
    expect(MEHR_LEISTE.map((t) => t.label)).toEqual(['Team', 'Einstellungen', 'Hilfe'])
    expect([...TAB_LEISTE, ...MEHR_LEISTE].map((t) => t.pfad)).toEqual(
      NAV.filter((n) => n !== 'trenner').map((n) => n.pfad),
    )
  })
})

describe('Aktiv-Logik', () => {
  it('Sidebar: längster passender Pfad – /email/kampagnen/42 ist „Kampagnen“, /email „Einzelmails“', () => {
    expect(aktiverEintrag('/leads')?.label).toBe('Leads')
    expect(aktiverEintrag('/email')?.label).toBe('Einzelmails')
    expect(aktiverEintrag('/email/verfassen')?.label).toBe('Einzelmails')
    expect(aktiverEintrag('/email/kampagnen/42')?.label).toBe('Kampagnen')
    expect(aktiverEintrag('/email/antworten')?.label).toBe('Antworten')
    expect(aktiverEintrag('/einstellungen/profil')?.label).toBe('Einstellungen')
    expect(aktiverEintrag('/hilfe/leads')?.label).toBe('Hilfe')
    expect(aktiverEintrag('/leadsx')).toBeNull()
    expect(aktiverEintrag('/anmelden')).toBeNull()
  })

  it('Gruppe: nur E-Mail-Seiten liegen in der Gruppe E-Mail', () => {
    expect(gruppeVon(aktiverEintrag('/email/postfaecher'))?.gruppe).toBe('email')
    expect(gruppeVon(aktiverEintrag('/email'))?.gruppe).toBe('email')
    expect(gruppeVon(aktiverEintrag('/leads'))).toBeNull()
    expect(gruppeVon(null)).toBeNull()
  })

  it('Icon-Rail: jede E-Mail-Seite markiert die eine E-Mail-Ikone', () => {
    for (const p of ['/email', '/email/verfassen', '/email/kampagnen', '/email/kampagnen/42', '/email/antworten'])
      expect(aktiverRailPfad(p), p).toBe('/email/kampagnen')
    expect(aktiverRailPfad('/leads')).toBe('/leads')
    expect(aktiverRailPfad('/einstellungen/sperrliste')).toBe('/einstellungen')
    expect(aktiverRailPfad('/anmelden')).toBeNull()
  })

  it('Tab-Leiste: der E-Mail-Tab ist auf allen /email-Seiten aktiv, „Mehr“ auf Team · Einstellungen · Hilfe', () => {
    for (const p of ['/email', '/email/verfassen', '/email/kampagnen/42', '/email/antworten', '/email/postfaecher'])
      expect(aktiverTab(p)?.label, p).toBe('E-Mail')
    expect(aktiverTab('/leads')?.label).toBe('Leads')
    expect(aktiverTab('/leitfaeden')?.label).toBe('Leitfäden')
    expect(aktiverTab('/team')).toBeNull()
    expect(aktiverTab('/team', MEHR_LEISTE)?.label).toBe('Team')
    expect(aktiverTab('/einstellungen/export', MEHR_LEISTE)?.label).toBe('Einstellungen')
    expect(aktiverTab('/leads', MEHR_LEISTE)).toBeNull()
  })
})
