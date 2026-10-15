// I-12: Die sechs Beispiele aus BAUPLAN § 6.3 ergeben exakt die dort notierten Ausgaben (+ Leerzeilen, Überschriften, Codeblock-Marker).
import { describe, expect, it } from 'vitest'
import { erkenneFormat, normalisieren, parseSchnellimport } from './schnellimport'

const BEISPIEL_1 = `| Name | Position | Unternehmen | Ort | LinkedIn |
|---|---|---|---|---|
| Max Mustermann | Geschäftsführer | Sonnenkraft GmbH | Hamburg | https://www.linkedin.com/in/max-mustermann/ |
| Dr. Anna Beispiel | Kundenbetreuerin | Solartechnik Nord | Kiel | [Profil](https://de.linkedin.com/in/anna-beispiel-1a2b3c?originalSubdomain=de) |`

const BEISPIEL_2 = `Hier ist die Liste:
1. **Jörg Müller** – Inhaber, Müller Solar GmbH (Lübeck) – https://www.linkedin.com/in/J%C3%B6rg-M%C3%BCller-77
2. **Frau Petra Schmidt** – Vertriebsleiterin – PV Küste e.K. – linkedin.com/in/petra-schmidt-pv`

const BEISPIEL_3 = `- Tom van der Berg
  - Unternehmen: Berg Energie AG
  - Position: Geschäftsführer
  - LinkedIn: https://www.linkedin.com/in/tomvanderberg
- Lisa Krause
  - Unternehmen: Krause PV
  - LinkedIn: unbekannt`

const BEISPIEL_4 =
  '```csv\nName;Position;Unternehmen;LinkedIn-URL\nHerr Kai Lenz;CEO;Lenz Solartechnik GmbH;https://www.linkedin.com/in/kai-lenz/\nSven Ott;Projektleiter;Ott & Co KG;https://www.linkedin.com/company/ott-co\n```'

const BEISPIEL_5 = `[{"name": "Nina Hoff", "company": "Hoff Solar", "title": "Innendienstleitung", "linkedin_url": "https://www.linkedin.com/in/nina-hoff/", "city": "Bremen"},
 {"vorname": "Ole", "nachname": "Brandt", "firma": "Brandt Energie", "linkedin": "https://www.linkedin.com/sales/lead/ACwAAAbc123,NAME_SEARCH,xyz"}]`

const BEISPIEL_6 = `Max Mustermann | Geschäftsführer | Sonnenkraft GmbH | https://www.linkedin.com/in/max-mustermann?utm_source=chatgpt
3) MAX MUSTERMANN, Sonnenkraft GmbH, HTTPS://WWW.LINKEDIN.COM/IN/MAX-MUSTERMANN/
• Eva Lang (Rostock) – Kundenbetreuung – https://uk.linkedin.com/in/eva-lang-solar#about`

describe('Schnellimport – Grammatik § 6.3', () => {
  it('Beispiel 1 – Markdown-Tabelle', () => {
    const { format, zeilen } = parseSchnellimport(BEISPIEL_1)
    expect(format).toBe('mdtabelle')
    expect(zeilen).toHaveLength(2)
    expect(zeilen[0]).toMatchObject({
      name: 'Max Mustermann',
      first_name: 'Max',
      last_name: 'Mustermann',
      title: null,
      salutation: null,
      company: 'Sonnenkraft GmbH',
      role_title: 'Geschäftsführer',
      role: 'geschaeftsfuehrer',
      linkedin_url: 'https://www.linkedin.com/in/max-mustermann/',
      linkedin_url_norm: 'linkedin.com/in/max-mustermann',
      url_art: 'person',
      city: 'Hamburg',
      status_lokal: 'neu',
    })
    expect(zeilen[1]).toMatchObject({
      name: 'Dr. Anna Beispiel',
      first_name: 'Anna',
      last_name: 'Beispiel',
      title: 'Dr.',
      salutation: null,
      company: 'Solartechnik Nord',
      role_title: 'Kundenbetreuerin',
      role: 'kundenbetreuer',
      linkedin_url: 'https://de.linkedin.com/in/anna-beispiel-1a2b3c?originalSubdomain=de',
      linkedin_url_norm: 'linkedin.com/in/anna-beispiel-1a2b3c',
      url_art: 'person',
      city: 'Kiel',
      status_lokal: 'neu',
    })
  })

  it('Beispiel 2 – nummerierte Liste mit Fettdruck, Einleitungszeile ignoriert', () => {
    const { format, zeilen } = parseSchnellimport(BEISPIEL_2)
    expect(format).toBe('zeilen')
    expect(zeilen).toHaveLength(2)
    expect(zeilen[0]).toMatchObject({
      name: 'Jörg Müller',
      first_name: 'Jörg',
      last_name: 'Müller',
      company: 'Müller Solar GmbH',
      role_title: 'Inhaber',
      role: 'inhaber',
      city: 'Lübeck',
      linkedin_url_norm: 'linkedin.com/in/jörg-müller-77',
      url_art: 'person',
      status_lokal: 'neu',
    })
    expect(zeilen[1]).toMatchObject({
      name: 'Petra Schmidt',
      salutation: 'frau',
      first_name: 'Petra',
      last_name: 'Schmidt',
      company: 'PV Küste e.K.',
      role_title: 'Vertriebsleiterin',
      role: 'vertrieb',
      linkedin_url: 'linkedin.com/in/petra-schmidt-pv',
      linkedin_url_norm: 'linkedin.com/in/petra-schmidt-pv',
      url_art: 'person',
      status_lokal: 'neu',
    })
  })

  it('Beispiel 3 – Aufzählung mit Unterpunkten, „unbekannt“ → keine URL', () => {
    const { zeilen } = parseSchnellimport(BEISPIEL_3)
    expect(zeilen).toHaveLength(2)
    expect(zeilen[0]).toMatchObject({
      first_name: 'Tom',
      last_name: 'van der Berg',
      company: 'Berg Energie AG',
      role_title: 'Geschäftsführer',
      role: 'geschaeftsfuehrer',
      linkedin_url_norm: 'linkedin.com/in/tomvanderberg',
      url_art: 'person',
      status_lokal: 'neu',
    })
    expect(zeilen[1]).toMatchObject({
      first_name: 'Lisa',
      last_name: 'Krause',
      company: 'Krause PV',
      role: 'unbekannt',
      linkedin_url: null,
      linkedin_url_norm: null,
      url_art: 'keine',
      status_lokal: 'unvollstaendig',
    })
  })

  it('Beispiel 4 – CSV im Codeblock, Delimiter ;', () => {
    const { format, zeilen } = parseSchnellimport(BEISPIEL_4)
    expect(format).toBe('csv')
    expect(zeilen).toHaveLength(2)
    expect(zeilen[0]).toMatchObject({
      salutation: 'herr',
      first_name: 'Kai',
      last_name: 'Lenz',
      role_title: 'CEO',
      role: 'geschaeftsfuehrer',
      company: 'Lenz Solartechnik GmbH',
      linkedin_url_norm: 'linkedin.com/in/kai-lenz',
      url_art: 'person',
      status_lokal: 'neu',
    })
    expect(zeilen[1]).toMatchObject({
      first_name: 'Sven',
      last_name: 'Ott',
      role_title: 'Projektleiter',
      role: 'projektleiter',
      company: 'Ott & Co KG',
      linkedin_url: 'https://www.linkedin.com/company/ott-co',
      linkedin_url_norm: null,
      url_art: 'firmenseite',
      status_lokal: 'firmenseite',
    })
  })

  it('Beispiel 5 – JSON-Array mit gemischten Keys, Sales-Nav-Link', () => {
    const { format, zeilen } = parseSchnellimport(BEISPIEL_5)
    expect(format).toBe('json')
    expect(zeilen).toHaveLength(2)
    expect(zeilen[0]).toMatchObject({
      first_name: 'Nina',
      last_name: 'Hoff',
      company: 'Hoff Solar',
      role_title: 'Innendienstleitung',
      role: 'innendienst',
      city: 'Bremen',
      linkedin_url_norm: 'linkedin.com/in/nina-hoff',
      url_art: 'person',
      status_lokal: 'neu',
    })
    expect(zeilen[1]).toMatchObject({
      first_name: 'Ole',
      last_name: 'Brandt',
      company: 'Brandt Energie',
      role: 'unbekannt',
      linkedin_url: 'https://www.linkedin.com/sales/lead/ACwAAAbc123,NAME_SEARCH,xyz',
      linkedin_url_norm: null,
      url_art: 'sales_nav',
      status_lokal: 'sales_nav',
    })
  })

  it('Beispiel 6 – Mischform: Dublette in der Liste, Klammer-Ort, Fragment', () => {
    const { zeilen } = parseSchnellimport(BEISPIEL_6)
    expect(zeilen).toHaveLength(3)
    expect(zeilen[0]).toMatchObject({
      linkedin_url_norm: 'linkedin.com/in/max-mustermann',
      role: 'geschaeftsfuehrer',
      company: 'Sonnenkraft GmbH',
      status_lokal: 'neu',
    })
    expect(zeilen[1]).toMatchObject({
      linkedin_url_norm: 'linkedin.com/in/max-mustermann',
      company: 'Sonnenkraft GmbH',
      status_lokal: 'dublette_liste',
    })
    expect(zeilen[2]).toMatchObject({
      first_name: 'Eva',
      last_name: 'Lang',
      city: 'Rostock',
      role_title: 'Kundenbetreuung',
      role: 'kundenbetreuer',
      company: null,
      linkedin_url_norm: 'linkedin.com/in/eva-lang-solar',
      status_lokal: 'neu',
    })
  })

  it('I-08: de.linkedin.com, Query, Großschreibung und %C3%B6 → ein Schlüssel', () => {
    const text = `1. Jörg Müller – https://www.linkedin.com/in/J%C3%B6rg-M%C3%BCller-77
2. Jörg Müller – HTTPS://DE.LINKEDIN.COM/IN/J%C3%B6RG-M%C3%BCLLER-77/?utm=1
3. Jörg Müller – https://linkedin.com/in/jörg-müller-77#about`
    const { zeilen } = parseSchnellimport(text)
    expect(zeilen.map((z) => z.linkedin_url_norm)).toEqual([
      'linkedin.com/in/jörg-müller-77',
      'linkedin.com/in/jörg-müller-77',
      'linkedin.com/in/jörg-müller-77',
    ])
    expect(zeilen.map((z) => z.status_lokal)).toEqual(['neu', 'dublette_liste', 'dublette_liste'])
  })

  it('normalisiert: CRLF, Tabs, Zero-Width, Codeblock-Marker; Leerzeilen und Überschriften werden ignoriert', () => {
    const text =
      '```\r\n# Liste\r\n\r\n- Max​ Mustermann\t– Sonnenkraft GmbH – https://www.linkedin.com/in/max-mustermann/\r\n\r\nViel Erfolg beim Anschreiben\r\n```'
    const z = normalisieren(text)
    expect(z.some((l) => l.includes('```'))).toBe(false)
    expect(z.some((l) => l.includes('​'))).toBe(false)
    const { zeilen } = parseSchnellimport(text)
    expect(zeilen).toHaveLength(1)
    expect(zeilen[0]?.name).toBe('Max Mustermann')
    expect(zeilen[0]?.company).toBe('Sonnenkraft GmbH')
  })

  it('leere Eingabe → Format leer, keine Zeilen', () => {
    expect(parseSchnellimport('')).toEqual({ format: 'leer', zeilen: [] })
    expect(erkenneFormat(['', '  '])).toBe('leer')
  })

  it('Zeilennummern zeigen auf die Eingabezeile', () => {
    const { zeilen } = parseSchnellimport(BEISPIEL_2)
    expect(zeilen.map((z) => z.zeile)).toEqual([2, 3])
  })
})
