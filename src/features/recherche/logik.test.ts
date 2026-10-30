import { describe, expect, it } from 'vitest'
import type { Ausgangspunkt } from '@/data/recherche'
import {
  agentZustand,
  AGENT_STILL_S,
  AGENT_UEBERNAHME_S,
  ausgangspunkteFuer,
  dienstLage,
  DIENST_VERBUNDEN_S,
  type DienstLage,
  einrichtungsBefehl,
  formularFehler,
  gesendetErlaubt,
  LEERES_FORMULAR,
  systemVon,
  verbleibend,
} from './logik'
import { agentAuftrag, ALLE_ABSCHNITTE, FREIGABE_PRAEFIX, kontrolleFaellig, startAnweisung } from './regeln'

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
  const l = (p: Partial<Parameters<typeof agentZustand>[0]>, dienst: DienstLage | undefined = 'verbunden') =>
    agentZustand(
      {
        status: 'laeuft',
        agent_status: 'wartet',
        agent_angefordert: vor(5),
        agent_heartbeat: null,
        agent_rechner: null,
        agent_meldung: null,
        agent_frage: null,
        agent_anbieter: 'chatgpt',
        ...p,
      },
      jetzt,
      dienst,
    )

  it('angefordert: erst „startet“, ohne Übernahme „kein Agent“ mit Neustart', () => {
    expect(l({}).art).toBe('startet')
    expect(l({}).starten).toBeNull()
    const k = l({ agent_angefordert: vor(AGENT_UEBERNAHME_S + 1) })
    expect(k.art).toBe('kein_dienst')
    expect(k.starten).toBe('neu')
  })

  it('ohne verbundenen Recherche-Dienst sofort „kein Dienst“ – mit dem passenden Hinweis', () => {
    expect(l({}, 'keiner')).toMatchObject({
      art: 'kein_dienst',
      text: expect.stringMatching(/noch kein Recherche-Dienst/),
    })
    expect(l({}, 'getrennt').text).toMatch(/meldet sich nicht/)
    expect(l({}, undefined).art).toBe('startet') // Dienste laden noch
  })

  it('arbeitet mit Lebenszeichen, sonst „antwortet nicht“', () => {
    const a = l({ agent_status: 'arbeitet', agent_heartbeat: vor(20), agent_rechner: 'MacBook Pro' })
    expect(a).toMatchObject({ art: 'arbeitet', titel: 'ChatGPT arbeitet auf MacBook Pro', starten: null })
    expect(l({ agent_status: 'arbeitet', agent_heartbeat: vor(AGENT_STILL_S + 5) })).toMatchObject({
      art: 'still',
      starten: 'neu',
    })
  })

  it('nach ChatGPT-Limit: Claude arbeitet, mit dem Hinweis des Diensts', () => {
    const c = l({
      agent_status: 'arbeitet',
      agent_heartbeat: vor(5),
      agent_anbieter: 'claude',
      agent_meldung: 'ChatGPT hat sein Nutzungslimit erreicht (wieder ab 19:17 Uhr). Claude macht weiter.',
    })
    expect(c.titel).toBe('Claude arbeitet')
    expect(c.text).toMatch(/^ChatGPT hat sein Nutzungslimit erreicht .* Claude arbeitet in deinem Chrome/)
    expect(l({ agent_status: 'antwort', agent_anbieter: 'claude' }).text).toMatch(/startet Claude gleich/)
    // ChatGPT ohne Hinweis – eine alte Meldung bleibt unsichtbar
    expect(l({ agent_status: 'arbeitet', agent_heartbeat: vor(5), agent_meldung: 'alt' }).text).not.toMatch(/alt/)
  })

  it('Frage: Freigabe-Liste mit Überschrift, andere Fragen als freie Antwort; nach der Antwort „macht weiter“', () => {
    const f = l({
      agent_status: 'frage',
      agent_frage: 'Freigabe nötig: 2 Vernetzungsanfragen\nA B · GF · X GmbH\nC D · PL · Y GmbH',
    })
    expect(f).toMatchObject({ art: 'frage', titel: 'Freigabe nötig: 2 Vernetzungsanfragen', freigabe: true })
    expect(f.text).toBe('A B · GF · X GmbH\nC D · PL · Y GmbH')
    expect(l({ agent_status: 'frage', agent_frage: 'Frage: Auch Großhändler?' })).toMatchObject({
      titel: 'Der Agent hat eine Frage',
      text: 'Frage: Auch Großhändler?',
      freigabe: false,
    })
    expect(l({ agent_status: 'antwort' }).titel).toMatch(/Antwort übermittelt/)
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

  it('Einrichtungsbefehl je Betriebssystem, Vorschlag aus dem Browser', () => {
    const k = `rd_${'a'.repeat(64)}`
    expect(einrichtungsBefehl(k, 'https://crm.x')).toBe(
      `curl -fsSL https://crm.x/recherche-dienst/einrichten.sh | bash -s -- ${k}`,
    )
    expect(einrichtungsBefehl(k, 'https://crm.x', 'windows')).toBe(
      `& ([scriptblock]::Create((irm https://crm.x/recherche-dienst/einrichten.ps1))) ${k}`,
    )
    expect(systemVon('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130')).toBe('windows')
    expect(systemVon('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15')).toBe('mac')
  })

  it('Dienst-Lage: verbunden bei Meldung in der letzten Minute', () => {
    expect(dienstLage(undefined, jetzt)).toBeUndefined()
    expect(dienstLage([], jetzt)).toBe('keiner')
    expect(dienstLage([{ zuletzt_gesehen: null }], jetzt)).toBe('keiner')
    expect(dienstLage([{ zuletzt_gesehen: vor(DIENST_VERBUNDEN_S + 30) }], jetzt)).toBe('getrennt')
    expect(dienstLage([{ zuletzt_gesehen: vor(DIENST_VERBUNDEN_S + 30) }, { zuletzt_gesehen: vor(8) }], jetzt)).toBe(
      'verbunden',
    )
  })
})

describe('Agent-Auftrag (ChatGPT)', () => {
  const t = agentAuftrag({ person: 'Mike' })

  it('enthält alle Regelabschnitte, die CRM-Werkzeuge und das Freigabe-Format', () => {
    for (const a of ALLE_ABSCHNITTE) expect(t).toContain(a.titel)
    for (const w of [
      'lauf_status',
      'ausgangspunkte',
      'profil_pruefen',
      'profil_eintragen',
      'kontrollpunkt_bestaetigen',
      'einschraenkung_melden',
    ])
      expect(t).toContain(w)
    expect(t).toContain(`„${FREIGABE_PRAEFIX} N Vernetzungsanfragen“`)
    expect(t).toContain('im Namen von Mike')
    expect(t).toContain('einmal für den ganzen Lauf, nicht je Person')
    expect(t).toMatch(/nie über Webformulare/)
  })

  it('verbietet Nachrichten, Anmelden und Umgehen; Ende mit Fertig/Abbruch', () => {
    expect(t).toMatch(/Nachrichten, Notizen/)
    expect(t).toMatch(/CAPTCHAs lösen/)
    expect(t).toMatch(/nicht anmelden/)
    expect(t).toMatch(/„Fertig: X gesendet, Y geprüft“ oder „Abbruch: <Grund>“/)
    expect(t).not.toMatch(/!/)
  })
})
