// Mailing-Helfer (01.11.2026) – nur erfundene Namen.
import { describe, expect, it } from 'vitest'
import { blocklistenLinks, dkimBits, dnsPruefen, empfohleneEintraege, spfLookups } from './dns'
import {
  anbieterVorlage,
  fuellenVorschau,
  hochlaufLage,
  offenePlatzhalter,
  quote,
  tagImAblauf,
  textHinweise,
  woerter,
  zeitplanAus,
  zeitplanText,
} from './logik'

describe('fuellenVorschau (wie crm.mail_fuellen)', () => {
  const lead = {
    first_name: 'Lukas',
    last_name: 'Feldhaus',
    company_name: 'Feldhaus Solar GmbH',
    salutation: 'herr',
    title: 'Dr.',
  }
  it('Briefanrede mit Titel, Absender, Signatur, eigene Variablen vorn', () => {
    const t = fuellenVorschau(
      '[Briefanrede],\n\n[Satz] zu [Unternehmen].\n\n[Absender Vorname]\n[Signatur]',
      lead,
      { name: 'Vincent Testnutzer', signatur: 'Testfirma' },
      { Satz: 'Danke für das Gespräch' },
    )
    expect(t).toBe(
      'Sehr geehrter Herr Dr. Feldhaus,\n\nDanke für das Gespräch zu Feldhaus Solar GmbH.\n\nVincent\nTestfirma',
    )
  })
  it('ohne Anrede „Guten Tag Vorname Nachname“; leere Werte bleiben als Platzhalter stehen', () => {
    expect(
      fuellenVorschau('[Briefanrede], [Stadt]', { first_name: 'Jana', last_name: 'Kurz', salutation: 'neutral' }, null),
    ).toBe('Guten Tag Jana Kurz, [Stadt]')
    expect(offenePlatzhalter('Hallo [Vorname], [Stadt] [Stadt]')).toEqual(['Vorname', 'Stadt'])
  })
})

describe('textHinweise', () => {
  it('erste Mail: Link, „Re:“, zu lang, Werbesprache, unbekannter Platzhalter', () => {
    const lang = Array.from({ length: 160 }, () => 'Wort').join(' ')
    const h = textHinweise('Re: Angebot', `Hallo [Vorname], KOSTENLOS!!! www.beispiel.de ${lang} [Rabattcode]`, true)
    const t = h.map((x) => x.text).join(' | ')
    expect(t).toMatch(/„Re:“ oder „AW:“/)
    expect(t).toMatch(/Link in der ersten Mail/)
    expect(t).toMatch(/zu lang/)
    expect(t).toMatch(/Werbesprache/)
    expect(t).toMatch(/\[Rabattcode\]/)
  })
  it('Folgemail darf leeren Betreff und Links haben; eigene Variablen sind bekannt', () => {
    expect(textHinweise('', 'Kurz nachgefasst: https://beispiel.de [Satz]', false, ['Satz'])).toEqual([])
  })
  it('woerter', () => {
    expect(woerter('  eins zwei\n drei ')).toBe(3)
    expect(woerter('')).toBe(0)
  })
})

describe('Zeitplan und Ablauf', () => {
  it('zeitplanText fasst Mo–Fr zusammen, Einzeltage mit Komma', () => {
    expect(zeitplanText(zeitplanAus({ tage: [1, 2, 3, 4, 5], von: '08:00', bis: '16:00' }))).toBe(
      'Mo–Fr · 08:00–16:00 Uhr',
    )
    expect(zeitplanText({ tage: [2, 4], von: '09:00', bis: '12:00' })).toBe('Di, Do · 09:00–12:00 Uhr')
    expect(zeitplanAus(null)).toEqual({ tage: [1, 2, 3, 4, 5], von: '08:00', bis: '16:00' })
  })
  it('tagImAblauf: Tag 0, +3, +8', () => {
    const w = [0, 3, 5]
    expect([0, 1, 2].map((i) => tagImAblauf(w, i))).toEqual([0, 3, 8])
  })
  it('quote', () => {
    expect(quote(1, 3)).toBe('33 %')
    expect(quote(1, 40)).toBe('2,5 %')
    expect(quote(0, 0)).toBe('–')
  })
})

describe('Hochlauf und Anbieter', () => {
  it('hochlaufLage liest die Datenbank-Antwort, Unbekanntes → null', () => {
    expect(hochlaufLage({ stufe: 'stufe_1', woche: 1, limit: 10, heute: 2, gruende: [] })?.limit).toBe(10)
    expect(hochlaufLage({ stufe: 'quatsch' })).toBeNull()
    expect(hochlaufLage(null)).toBeNull()
  })
  it('anbieterVorlage: Google mit App-Passwort-Link, GMX nur Prüf-Postfach, unbekannt → Sonstige', () => {
    expect(anbieterVorlage('google').smtp?.port).toBe(465)
    expect(anbieterVorlage('google').link).toContain('apppasswords')
    expect(anbieterVorlage('gmx').nurPruef).toBe(true)
    expect(anbieterVorlage('xyz').key).toBe('sonstige')
  })
})

describe('DNS', () => {
  const antworten: Record<string, unknown> = {
    'versand-test.de|MX': { Status: 0, Answer: [{ type: 15, data: '1 smtp.google.com.' }] },
    'versand-test.de|TXT': { Status: 0, Answer: [{ type: 16, data: '"v=spf1 include:_spf.google.com ~all"' }] },
    '_dmarc.versand-test.de|TXT': {
      Status: 0,
      Answer: [{ type: 16, data: '"v=DMARC1; p=none; rua=mailto:dmarc@versand-test.de"' }],
    },
    'google._domainkey.versand-test.de|TXT': {
      Status: 0,
      Answer: [{ type: 16, data: `"v=DKIM1; k=rsa; p=${'A'.repeat(392)}"` }],
    },
  }
  const f = ((url: string) => {
    const u = new URL(url)
    const k = `${u.searchParams.get('name')}|${u.searchParams.get('type')}`
    return Promise.resolve(new Response(JSON.stringify(antworten[k] ?? { Status: 3 })))
  }) as typeof fetch

  it('alles da → ok, DKIM 2048 Bit', async () => {
    const e = await dnsPruefen('Versand-Test.de', 'google', null, f)
    expect(e.ok).toBe(true)
    expect(e.dkim).toMatchObject({ ok: true, selector: 'google', bits: 2048 })
    expect(e.dmarc).toMatchObject({ ok: true, policy: 'none', rua: true })
  })
  it('fehlendes DMARC und DKIM → nicht ok mit Hinweisen', async () => {
    const e = await dnsPruefen('andere.de', 'google', null, f)
    expect(e.ok).toBe(false)
    expect(e.mx.hinweis).toBe('Kein MX-Eintrag')
    expect(e.dkim.hinweis).toBe('Kein DKIM-Schlüssel gefunden')
    expect(e.dmarc.hinweis).toBe('Kein DMARC-Eintrag')
  })
  it('dkimBits schätzt 1024/2048, spfLookups zählt die erste Ebene', () => {
    expect(dkimBits(`p=${'A'.repeat(216)}`)).toBe(1024)
    expect(dkimBits(`v=DKIM1; p=${'A'.repeat(392)}`)).toBe(2048)
    expect(dkimBits('v=DKIM1; p=')).toBeNull()
    expect(spfLookups('v=spf1 include:_spf.google.com include:_spf-eu.ionos.com a mx ~all')).toBe(4)
  })
  it('empfohleneEintraege und Blocklisten-Links', () => {
    const e = empfohleneEintraege('versand-test.de', 'google')
    expect(e.map((x) => x.name)).toEqual([
      'versand-test.de',
      '_dmarc.versand-test.de',
      'versand-test.de',
      'google._domainkey.versand-test.de',
    ])
    expect(e[1]?.wert).toContain('rua=mailto:dmarc@versand-test.de')
    expect(blocklistenLinks('versand-test.de')[1]?.url).toContain('validity')
  })
})
