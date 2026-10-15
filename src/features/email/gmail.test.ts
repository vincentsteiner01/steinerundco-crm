// gmail.test.ts (BAUPLAN § 3.5): URL-Kodierung, Umlaute, Zeilenumbrüche, 1 400-Grenze, mailto, Suche, Re:-Betreff (M-05, M-11).
import { describe, expect, it } from 'vitest'
import { BODY_MAX, composeUrl, gmailSucheUrl, mailtoUrl, passtInCompose, reBetreff } from './gmail'

describe('composeUrl', () => {
  it('baut view=cm mit fs, tf, authuser, to, su, body (M-05)', () => {
    const url = composeUrl({ authuser: 'vincent@steinerundco.de', to: 'a@b.de', su: 'Hallo', body: 'Text' })
    expect(url.startsWith('https://mail.google.com/mail/?view=cm&fs=1&tf=1&')).toBe(true)
    const p = new URL(url).searchParams
    expect(p.get('view')).toBe('cm')
    expect(p.get('authuser')).toBe('vincent@steinerundco.de')
    expect(p.get('to')).toBe('a@b.de')
    expect(p.get('su')).toBe('Hallo')
    expect(p.get('body')).toBe('Text')
  })

  it('kodiert Umlaute, Sonderzeichen und Zeilenumbrüche (\\n → %0A, \\r\\n → %0A)', () => {
    const url = composeUrl({ to: 'ä@ö.de', su: 'Grüße & Dank', body: 'Zeile 1\r\nZeile 2\nÄÖÜ ß – „Zitat“ 30 %' })
    expect(url).toContain('su=Gr%C3%BC%C3%9Fe%20%26%20Dank')
    expect(url).toContain('body=Zeile%201%0AZeile%202%0A%C3%84')
    expect(url).not.toContain('%0D')
    expect(new URL(url).searchParams.get('body')).toBe('Zeile 1\nZeile 2\nÄÖÜ ß – „Zitat“ 30 %')
  })

  it('lässt authuser weg, wenn keins bekannt ist; trimmt die Adresse', () => {
    const url = composeUrl({ authuser: null, to: '  a@b.de ', su: '', body: '' })
    expect(url).not.toContain('authuser=')
    expect(new URL(url).searchParams.get('to')).toBe('a@b.de')
  })

  it('Index als authuser', () => {
    expect(composeUrl({ authuser: 0, to: 'a@b.de', su: 's', body: 'b' })).toContain('authuser=0&')
  })
})

describe('Grenze 1 400', () => {
  it('passtInCompose bis genau 1 400 Zeichen', () => {
    expect(BODY_MAX).toBe(1400)
    expect(passtInCompose('x'.repeat(1400))).toBe(true)
    expect(passtInCompose('x'.repeat(1401))).toBe(false)
  })
})

describe('mailtoUrl', () => {
  it('subject/body kodiert, Zeilenumbruch als %0A', () => {
    const u = mailtoUrl({ to: 'a@b.de', su: 'Hä?', body: 'eins\nzwei' })
    expect(u).toBe('mailto:a%40b.de?subject=H%C3%A4%3F&body=eins%0Azwei')
  })
})

describe('gmailSucheUrl', () => {
  it('sucht im Postfach der Person nach Betreff + Empfänger, ohne Re:-Präfix', () => {
    const u = gmailSucheUrl({ email: 'vincent@steinerundco.de', subject: 'Re: Unser Gespräch', to: 'a@b.de' })
    expect(u).toBe('https://mail.google.com/mail/u/vincent%40steinerundco.de/#search/Unser+Gespr%C3%A4ch+a%40b.de')
  })
})

describe('reBetreff', () => {
  it('setzt „Re: “ genau einmal (M-11)', () => {
    expect(reBetreff('Unser Gespräch')).toBe('Re: Unser Gespräch')
    expect(reBetreff('Re: Unser Gespräch')).toBe('Re: Unser Gespräch')
    expect(reBetreff('RE:  Unser Gespräch')).toBe('RE:  Unser Gespräch')
  })
})
