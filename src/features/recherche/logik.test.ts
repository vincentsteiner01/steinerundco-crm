import { describe, expect, it } from 'vitest'
import type { Ausgangspunkt } from '@/data/recherche'
import {
  agentZustand,
  AGENT_STILL_S,
  AGENT_UEBERNAHME_S,
  ausgangspunkteFuer,
  formularFehler,
  gesendetErlaubt,
  LEERES_FORMULAR,
  verbleibend,
} from './logik'
import { agentAuftrag, ALLE_ABSCHNITTE, KATEGORIEN, kontrolleFaellig, startAnweisung } from './regeln'

const p = (i: number, firma = `Firma ${i % 5}`): Ausgangspunkt => ({
  id: `l${i}`,
  full_name: `Person ${i}`,
  company_name: firma,
  role_title: 'GF',
  linkedin_url: `https://www.linkedin.com/in/p${i}`,
  stage: 'vernetzt',
  role: 'geschaeftsfuehrer',
})

describe('Ausgangspunkte', () => {
  const liste = Array.from({ length: 40 }, (_, i) => p(i))

  it('gleicher Lauf → gleiche Auswahl, anderer Lauf → andere', () => {
    const a = ausgangspunkteFuer(liste, 'lauf-1')
    expect(ausgangspunkteFuer(liste, 'lauf-1')).toEqual(a)
    expect(ausgangspunkteFuer(liste, 'lauf-2').personen.map((x) => x.id)).not.toEqual(a.personen.map((x) => x.id))
    expect(a.personen).toHaveLength(12)
  })

  it('ICP-nahe Positionen zuerst', () => {
    const mix = [
      { ...p(1), role_title: 'Einkauf' },
      { ...p(2), role_title: 'Leiterin Kundenservice' },
      { ...p(3), role_title: null },
      { ...p(4), role_title: 'Geschäftsführer' },
    ]
    const r = ausgangspunkteFuer(mix, 'x', 2)
    expect(r.personen.map((x) => x.id).sort()).toEqual(['l2', 'l4'])
  })

  it('Firmen eindeutig (ohne Groß/Klein)', () => {
    const r = ausgangspunkteFuer([p(1, 'Solar GmbH'), p(2, 'solar gmbh'), p(3, 'PV Nord')], 'x')
    expect(r.firmen).toHaveLength(2)
  })
})

describe('Formular', () => {
  const f = { ...LEERES_FORMULAR, url: 'https://www.linkedin.com/in/max-muster/' }

  it('URL Pflicht, Prüfen braucht nur die URL', () => {
    expect(formularFehler(LEERES_FORMULAR, 'pruefen')).toMatch(/LinkedIn-Profil-URL/)
    expect(formularFehler({ ...f, url: 'https://www.linkedin.com/company/x' }, 'pruefen')).toMatch(
      /LinkedIn-Profil-URL/,
    )
    expect(formularFehler(f, 'pruefen')).toBeNull()
  })

  it('gesendet verlangt Name, Firma, Position, Kategorie, Grund; Absage einen Grund', () => {
    expect(formularFehler(f, 'gesendet')).toBe(
      'Für „gesendet“ fehlt: Vorname, Nachname, Firma, Position, Kategorie, Qualifizierungsgrund.',
    )
    const voll = {
      ...f,
      vorname: 'Max',
      nachname: 'Muster',
      firma: 'PV GmbH',
      position: 'GF',
      kategorie: 'A' as const,
      grund: 'B2C',
    }
    expect(formularFehler(voll, 'gesendet')).toBeNull()
    expect(formularFehler(f, 'nicht_qualifiziert')).toMatch(/Grund/)
    expect(formularFehler(f, 'dublette')).toBeNull()
  })

  it('gesendet erst nach „frei“ für genau diese URL', () => {
    const frei = { frei: true, art: 'neu' as const, grund: '' }
    expect(gesendetErlaubt(f, null)).toBe(false)
    expect(gesendetErlaubt(f, { url: 'https://de.linkedin.com/in/max-muster?x=1', ergebnis: frei })).toBe(true)
    expect(gesendetErlaubt(f, { url: 'https://www.linkedin.com/in/andere', ergebnis: frei })).toBe(false)
    expect(gesendetErlaubt(f, { url: f.url, ergebnis: { ...frei, frei: false, art: 'verbindung' } })).toBe(false)
  })

  it('verbleibend und Kontrollpunkt', () => {
    expect(verbleibend({ ziel: 30, gesendet: 12 })).toBe(18)
    expect(verbleibend({ ziel: 30, gesendet: 31 })).toBe(0)
    expect(kontrolleFaellig({ geprueft: 9, kontrollen: 0 })).toBe(false)
    expect(kontrolleFaellig({ geprueft: 10, kontrollen: 0 })).toBe(true)
    expect(kontrolleFaellig({ geprueft: 10, kontrollen: 1 })).toBe(false)
  })
})

describe('Start-Anweisung', () => {
  it('verweist auf die Seite, nennt die Kernregeln, keine Ausrufezeichen', () => {
    const t = startAnweisung('https://crm.steinerundco.de/auftrag/recherche/abc', 'Vincent')
    for (const teil of [
      'https://crm.steinerundco.de/auftrag/recherche/abc',
      '„Regeln“',
      '„Prüfen“',
      'OHNE Nachricht',
      '30',
      '„LinkedIn-Einschränkung melden“',
    ])
      expect(t).toContain(teil)
    expect(t).not.toMatch(/!/)
  })
})

describe('Agent-Zustand', () => {
  const jetzt = Date.parse('2026-10-29T12:00:00Z')
  const vor = (s: number) => new Date(jetzt - s * 1000).toISOString()
  const l = (p: Partial<Parameters<typeof agentZustand>[0]>) =>
    agentZustand(
      {
        status: 'laeuft',
        agent_status: 'wartet',
        agent_angefordert: vor(5),
        agent_heartbeat: null,
        agent_rechner: null,
        agent_meldung: null,
        ...p,
      },
      jetzt,
    )

  it('angefordert: erst „startet“, ohne Übernahme „kein Agent“ mit Neustart', () => {
    expect(l({}).art).toBe('startet')
    expect(l({}).starten).toBeNull()
    const k = l({ agent_angefordert: vor(AGENT_UEBERNAHME_S + 1) })
    expect(k.art).toBe('kein_dienst')
    expect(k.starten).toBe('neu')
  })

  it('arbeitet mit Lebenszeichen, sonst „antwortet nicht“', () => {
    const a = l({ agent_status: 'arbeitet', agent_heartbeat: vor(20), agent_rechner: 'MacBook Pro' })
    expect(a).toMatchObject({ art: 'arbeitet', titel: 'Agent arbeitet auf MacBook Pro', starten: null })
    expect(l({ agent_status: 'arbeitet', agent_heartbeat: vor(AGENT_STILL_S + 5) })).toMatchObject({
      art: 'still',
      starten: 'neu',
    })
  })

  it('beendet/fehler zeigen den Bericht; manuell bietet „starten“; Pause und Ende ohne Knopf', () => {
    expect(l({ agent_status: 'beendet', agent_meldung: 'Fertig: 3 gesendet' })).toMatchObject({
      text: 'Fertig: 3 gesendet',
      starten: 'neu',
    })
    expect(l({ agent_status: 'fehler', agent_meldung: 'Abbruch: Nicht bei LinkedIn angemeldet' }).art).toBe('fehler')
    expect(l({ agent_status: 'manuell' }).starten).toBe('starten')
    expect(l({ status: 'pausiert', agent_status: 'beendet' })).toMatchObject({ art: 'angehalten', starten: null })
    expect(l({ status: 'abgeschlossen', agent_status: 'beendet', agent_meldung: 'Fertig: 30 gesendet' })).toMatchObject(
      {
        art: 'aus',
        text: 'Fertig: 30 gesendet',
        starten: null,
      },
    )
  })
})

describe('Agent-Auftrag', () => {
  const t = agentAuftrag({
    url: 'https://crm.steinerundco.de/auftrag/recherche/abc',
    person: 'Mike',
    ziel: 30,
    gesendet: 4,
  })

  it('enthält Lauf, alle Regelabschnitte und die Knöpfe der Seite wörtlich', () => {
    expect(t).toContain('https://crm.steinerundco.de/auftrag/recherche/abc')
    expect(t).toContain('4 von 30')
    for (const a of ALLE_ABSCHNITTE) expect(t).toContain(a.titel)
    for (const k of KATEGORIEN) expect(t).toContain(`„${k.label}“`)
    for (const knopf of [
      '„Prüfen“',
      '„Vernetzungsanfrage gesendet“',
      '„Als Dublette eintragen“',
      '„Kriterien geprüft – weiter“',
    ])
      expect(t).toContain(knopf)
  })

  it('verbietet Nachrichten, Anmelden und Umgehen', () => {
    expect(t).toMatch(/Nachrichten, Notizen/)
    expect(t).toMatch(/CAPTCHAs lösen/)
    expect(t).toMatch(/nicht anmelden/)
  })
})
