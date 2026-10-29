import { describe, expect, it } from 'vitest'
import type { Ausgangspunkt } from '@/data/recherche'
import { ausgangspunkteFuer, formularFehler, gesendetErlaubt, LEERES_FORMULAR, verbleibend } from './logik'
import { kontrolleFaellig, startAnweisung } from './regeln'

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
