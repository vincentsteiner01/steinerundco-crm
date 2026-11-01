// Tests für mime.ts – Rundreise über postal-mime (derselbe Parser wie beim Abruf). Nur erfundene Namen.
// Aufruf: deno test --node-modules-dir=none supabase/functions/mail-motor
import assert from 'node:assert/strict'
import PostalMime from 'npm:postal-mime@2.4.4'
import { adressKopf, datumKopf, kodiereWort, mimeBauen, quotedPrintable } from './mime.ts'

Deno.test('Rundreise: Umlaute in Betreff, Name und Text, lange Zeile, Gleichheitszeichen, Verlauf', async () => {
  const text =
    'Guten Tag Frau Müller,\n\nwie besprochen schicke ich Ihnen die Übersicht – 3 Punkte = 1 Seite.\n' +
    'Diese Zeile ist absichtlich sehr lang, damit quoted-printable sie weich umbrechen muss, ohne dass beim Lesen etwas verloren geht. Äöü ß €.\n' +
    '\nViele Grüße\nVincent Testnutzer'
  const roh = mimeBauen({
    von: { adresse: 'vincent@versand-beispiel.de', name: 'Vincent Testnutzer' },
    an: { adresse: 'lena.mueller@beispiel-solar.de', name: 'Lena Müller' },
    betreff: 'Ihre Anfrage zur Übersicht – kurze Rückmeldung',
    text,
    messageId: '<abc123@versand-beispiel.de>',
    inReplyTo: '<vorher-1@versand-beispiel.de>',
    references: '<start-0@versand-beispiel.de> <vorher-1@versand-beispiel.de>',
    kopf: { 'List-Unsubscribe': '<mailto:vincent@versand-beispiel.de?subject=Abmelden>' },
    datum: new Date('2026-11-02T08:14:05Z'),
  })
  for (const z of roh.split('\r\n')) assert.ok(z.length <= 78, `Zeile zu lang: ${z}`)
  assert.ok(!/[^\x00-\x7f]/.test(roh), 'Rohnachricht muss reines ASCII sein')
  const p = await PostalMime.parse(roh)
  assert.equal(p.subject, 'Ihre Anfrage zur Übersicht – kurze Rückmeldung')
  assert.deepEqual(p.from, { address: 'vincent@versand-beispiel.de', name: 'Vincent Testnutzer' })
  assert.equal(p.to?.[0]?.name, 'Lena Müller')
  assert.equal(p.messageId, '<abc123@versand-beispiel.de>')
  assert.equal(p.inReplyTo, '<vorher-1@versand-beispiel.de>')
  assert.match(p.references ?? '', /start-0@versand-beispiel\.de.*vorher-1@versand-beispiel\.de/s)
  assert.equal(p.text?.replace(/\r\n/g, '\n').trimEnd(), text)
  assert.match(roh, /^Date: Mon, 2 Nov 2026 09:14:05 \+0100$/m)
  assert.match(roh, /^List-Unsubscribe: <mailto:/m)
  assert.ok(!/X-Mailer|User-Agent/i.test(roh))
})

Deno.test('kodiereWort: ASCII bleibt, Umlaute werden zu kurzen UTF-8-B-Wörtern', () => {
  assert.equal(kodiereWort('Kurze Frage'), 'Kurze Frage')
  const k = kodiereWort('Ä'.repeat(40))
  for (const w of k.split('\r\n ')) assert.ok(w.length <= 52 && w.startsWith('=?UTF-8?B?'), w)
})

Deno.test('adressKopf: Sonderzeichen in Anführungszeichen, ohne Namen nur Adresse', () => {
  assert.equal(adressKopf({ adresse: 'a@b.de', name: 'Steiner, Vincent' }), '"Steiner, Vincent" <a@b.de>')
  assert.equal(adressKopf({ adresse: 'a@b.de' }), 'a@b.de')
  assert.equal(adressKopf({ adresse: 'a@b.de', name: 'Max Muster' }), 'Max Muster <a@b.de>')
})

Deno.test('datumKopf: Sommerzeit +0200, Winterzeit +0100', () => {
  assert.equal(datumKopf(new Date('2026-07-01T10:00:00Z')), 'Wed, 1 Jul 2026 12:00:00 +0200')
  assert.equal(datumKopf(new Date('2026-12-24T23:30:00Z')), 'Fri, 25 Dec 2026 00:30:00 +0100')
})

Deno.test('quotedPrintable: Leerzeichen am Zeilenende, Gleichheitszeichen, Umlaute', () => {
  assert.equal(quotedPrintable('a = b \nü'), 'a =3D b=20\r\n=C3=BC')
})
