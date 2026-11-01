// Tests für einordnen.ts – nur erfundene Namen und Adressen.  Aufruf: deno test supabase/functions/mail-motor
import assert from 'node:assert/strict'
import { einordnen, type EingangsMail, messageIds, neuerText, rueckkehrDatum } from './einordnen.ts'

const HEUTE = new Date('2026-11-02T09:00:00Z')

function mail(teil: Partial<EingangsMail>): EingangsMail {
  return { von: 'lukas.feldhaus@beispiel-solar.de', vonName: 'Lukas Feldhaus', betreff: '', kopf: {}, text: '', ...teil }
}

// ---------------------------------------------------------------- Message-IDs
Deno.test('messageIds: In-Reply-To und References, ohne Doppelte, klein', () => {
  assert.deepEqual(messageIds('<A1@Mail.de>', '<x9@b.de> <a1@mail.de>\r\n <y7@c.de>'), ['<a1@mail.de>', '<x9@b.de>', '<y7@c.de>'])
  assert.deepEqual(messageIds(null, undefined, ''), [])
})

// ---------------------------------------------------------------- Unzustellbar
const GMAIL_BOUNCE = [
  'Content-Type: multipart/report; boundary="000"; report-type=delivery-status',
  '',
  '--000',
  'Content-Type: text/plain; charset="UTF-8"',
  '',
  'Address not found',
  "Your message wasn't delivered to jonas.bergfeld@beispiel-energie.de because the address couldn't be found, or is unable to receive mail.",
  '',
  '--000',
  'Content-Type: message/delivery-status',
  '',
  'Reporting-MTA: dns; googlemail.com',
  '',
  'Final-Recipient: rfc822; jonas.bergfeld@beispiel-energie.de',
  'Action: failed',
  'Status: 5.1.1',
  'Diagnostic-Code: smtp; 550-5.1.1 The email account that you tried to reach does not exist.',
  '',
  '--000',
  'Content-Type: message/rfc822',
  '',
  'From: Vincent Testnutzer <vincent@versand-beispiel.de>',
  'Message-ID: <k1-abc123@versand-beispiel.de>',
  'Subject: Kurze Frage zu Ihrem Innendienst',
].join('\r\n')

Deno.test('Gmail-Bounce: Adresse unbekannt → hart, Empfänger und Original-Message-ID', () => {
  const e = einordnen(
    mail({
      von: 'mailer-daemon@googlemail.com',
      vonName: 'Mail Delivery Subsystem',
      betreff: 'Delivery Status Notification (Failure)',
      kopf: {
        'content-type': 'multipart/report; boundary="000"; report-type=delivery-status',
        'message-id': '<bounce-1@mx.google.com>',
      },
      text: "Address not found\nYour message wasn't delivered to jonas.bergfeld@beispiel-energie.de because the address couldn't be found.",
      roh: GMAIL_BOUNCE,
    }),
    HEUTE,
  )
  assert.equal(e.art, 'unzustellbar')
  if (e.art !== 'unzustellbar') return
  assert.equal(e.hart, true)
  assert.equal(e.grund, 'adresse_ungueltig')
  assert.equal(e.empfaenger, 'jonas.bergfeld@beispiel-energie.de')
  assert.equal(e.status, '5.1.1')
  assert.deepEqual(e.bezug, ['<k1-abc123@versand-beispiel.de>'])
})

Deno.test('Microsoft-NDR ohne Report-Teil: Unzustellbar am Betreff + RecipientNotFound', () => {
  const e = einordnen(
    mail({
      von: 'postmaster@beispiel-solar.onmicrosoft.com',
      vonName: 'Microsoft Outlook',
      betreff: 'Unzustellbar: Kurze Frage zu Ihrem Innendienst',
      text:
        'Ihre Nachricht hat folgende Empfänger nicht erreicht: lena.kurz@beispiel-solar.de\n' +
        "Remote Server returned '550 5.1.10 RESOLVER.ADR.RecipientNotFound; Recipient not found by SMTP address lookup'",
    }),
    HEUTE,
  )
  assert.equal(e.art, 'unzustellbar')
  if (e.art !== 'unzustellbar') return
  assert.equal(e.hart, true)
  assert.equal(e.grund, 'adresse_ungueltig')
  assert.equal(e.status, '5.1.10')
})

Deno.test('Abgelehnt wegen Spam (5.7.1) → hart, aber Grund „abgelehnt“ (Adresse nicht sperren)', () => {
  const e = einordnen(
    mail({
      von: 'mailer-daemon@mx.beispiel-hoster.de',
      betreff: 'Mail delivery failed: returning message to sender',
      kopf: { 'content-type': 'multipart/report; report-type=delivery-status; boundary=x' },
      text: 'This message was created automatically by mail delivery software.',
      roh: 'Final-Recipient: rfc822; info@beispiel-solar.de\nAction: failed\nStatus: 5.7.1\nDiagnostic-Code: smtp; 550 5.7.1 Message rejected due to spam content\n',
    }),
    HEUTE,
  )
  assert.equal(e.art, 'unzustellbar')
  if (e.art !== 'unzustellbar') return
  assert.equal(e.grund, 'abgelehnt')
  assert.equal(e.hart, true)
})

Deno.test('Verzögert (4.4.7, Action delayed) → weich', () => {
  const e = einordnen(
    mail({
      von: 'mailer-daemon@googlemail.com',
      betreff: 'Delivery Status Notification (Delay)',
      kopf: { 'content-type': 'multipart/report; report-type=delivery-status; boundary=y' },
      roh: 'Final-Recipient: rfc822; anna@beispiel.de\nAction: delayed\nStatus: 4.4.7\n',
    }),
    HEUTE,
  )
  assert.equal(e.art, 'unzustellbar')
  if (e.art !== 'unzustellbar') return
  assert.equal(e.hart, false)
  assert.equal(e.grund, 'voruebergehend')
})

// ---------------------------------------------------------------- Abwesenheit
Deno.test('Abwesenheitsnotiz mit Auto-Submitted und Rückkehrdatum', () => {
  const e = einordnen(
    mail({
      betreff: 'Abwesenheitsnotiz: Kurze Frage zu Ihrem Innendienst',
      kopf: { 'auto-submitted': 'auto-replied', 'in-reply-to': '<k1-abc@versand-beispiel.de>' },
      text: 'Vielen Dank für Ihre Nachricht. Ich bin bis einschließlich 7.11. nicht im Büro. In dringenden Fällen wenden Sie sich an info@beispiel-solar.de.',
    }),
    HEUTE,
  )
  assert.deepEqual(e, { art: 'abwesend', bis: '2026-11-07', ausgeschieden: false, bezug: ['<k1-abc@versand-beispiel.de>'] })
})

Deno.test('Abwesenheit ohne Automatik-Kopf: Betreff + Text eindeutig, Datum mit Jahr', () => {
  const e = einordnen(
    mail({ betreff: 'Automatische Antwort: Ihre Anfrage', text: 'Ich befinde mich im Urlaub und bin ab dem 12.11.2026 wieder erreichbar.' }),
    HEUTE,
  )
  assert.equal(e.art, 'abwesend')
  if (e.art === 'abwesend') assert.equal(e.bis, '2026-11-12')
})

Deno.test('Ausgeschieden: Person nicht mehr im Unternehmen', () => {
  const e = einordnen(
    mail({
      betreff: 'Automatische Antwort: Kurze Frage',
      kopf: { 'auto-submitted': 'auto-generated' },
      text: 'Herr Feldhaus ist nicht mehr im Unternehmen tätig. Bitte wenden Sie sich an kontakt@beispiel-solar.de.',
    }),
    HEUTE,
  )
  assert.equal(e.art, 'abwesend')
  if (e.art === 'abwesend') {
    assert.equal(e.ausgeschieden, true)
    assert.equal(e.bis, null)
  }
})

Deno.test('Eingangsbestätigung eines Ticketsystems → automatisch', () => {
  const e = einordnen(
    mail({ betreff: 'Ihre Anfrage [Ticket #4711]', text: 'Wir haben Ihre Nachricht erhalten und melden uns schnellstmöglich. Ticketnummer: 4711' }),
    HEUTE,
  )
  assert.equal(e.art, 'automatisch')
})

Deno.test('Precedence: bulk ohne Abwesenheitstext → automatisch', () => {
  assert.equal(einordnen(mail({ kopf: { precedence: 'bulk' }, betreff: 'Newsletter November', text: 'Neuigkeiten' }), HEUTE).art, 'automatisch')
})

// ---------------------------------------------------------------- Menschliche Antworten
const UNSERE_MAIL_ZITIERT =
  '\n\nAm Mo., 2. Nov. 2026 um 09:14 Uhr schrieb Vincent Testnutzer <vincent@versand-beispiel.de>:\n' +
  '> Hallo Herr Feldhaus,\n> kurze Frage …\n> Wenn Sie keine weiteren E-Mails von mir möchten, genügt eine kurze Antwort.'

Deno.test('Antwort mit zitierter Abmelde-Zeile ist KEINE Abmeldung, sondern Interesse', () => {
  const e = einordnen(
    mail({
      betreff: 'Re: Kurze Frage zu Ihrem Innendienst',
      kopf: { 'in-reply-to': '<k1-abc@versand-beispiel.de>', references: '<k1-abc@versand-beispiel.de>' },
      text: 'Hallo Herr Testnutzer,\n\nklingt interessant. Rufen Sie mich gerne Donnerstag an.\n\nGrüße\nLukas Feldhaus' + UNSERE_MAIL_ZITIERT,
    }),
    HEUTE,
  )
  assert.equal(e.art, 'antwort')
  if (e.art !== 'antwort') return
  assert.equal(e.hinweis, 'interessiert')
  assert.ok(!e.neuerText.includes('keine weiteren'))
  assert.deepEqual(e.bezug, ['<k1-abc@versand-beispiel.de>'])
})

Deno.test('Abmeldung: „Bitte nehmen Sie mich aus Ihrem Verteiler“', () => {
  const e = einordnen(mail({ betreff: 'Re: Kurze Frage', text: 'Bitte nehmen Sie mich aus Ihrem Verteiler.' + UNSERE_MAIL_ZITIERT }), HEUTE)
  assert.equal(e.art === 'antwort' && e.hinweis, 'abmeldung')
})

Deno.test('Abmeldung: kurzes „Stop“', () => {
  const e = einordnen(mail({ betreff: 'Re: Kurze Frage', text: 'Stop' + UNSERE_MAIL_ZITIERT }), HEUTE)
  assert.equal(e.art === 'antwort' && e.hinweis, 'abmeldung')
})

Deno.test('Kein Interesse (ohne Interesse-Fehltreffer)', () => {
  const e = einordnen(mail({ betreff: 'Re: Kurze Frage', text: 'Danke, aber wir haben kein Interesse.' + UNSERE_MAIL_ZITIERT }), HEUTE)
  assert.equal(e.art === 'antwort' && e.hinweis, 'kein_interesse')
})

Deno.test('Neutrale Rückfrage ohne Hinweis', () => {
  const e = einordnen(mail({ betreff: 'Re: Kurze Frage', text: 'Woher haben Sie meine Adresse?' + UNSERE_MAIL_ZITIERT }), HEUTE)
  assert.equal(e.art, 'antwort')
  if (e.art === 'antwort') assert.equal(e.hinweis, null)
})

// ---------------------------------------------------------------- Zitat abschneiden
Deno.test('neuerText: Outlook-Kopfblock „Von:/Gesendet:“ wird abgeschnitten, normales „Von:“ nicht', () => {
  const t = 'Passt, danke!\n\nVon: Vincent Testnutzer <vincent@versand-beispiel.de>\nGesendet: Montag, 2. November 2026 09:14\nAn: Lukas\nBetreff: Kurze Frage\n\nHallo …'
  assert.equal(neuerText(t), 'Passt, danke!')
  assert.equal(neuerText('Von: Montag bis Freitag erreichbar.\nGruß'), 'Von: Montag bis Freitag erreichbar.\nGruß')
  assert.equal(neuerText('Gerne.\n-----Ursprüngliche Nachricht-----\nVon: x'), 'Gerne.')
  assert.equal(neuerText('Ja\nOn Mon, Nov 2, 2026 at 9:14 AM Vincent <v@b.de> wrote:\n> alt'), 'Ja')
})

// ---------------------------------------------------------------- Rückkehrdatum
Deno.test('rueckkehrDatum: Jahreswechsel, Monatsnamen, nichts Unplausibles', () => {
  const dez = new Date('2026-12-20T09:00:00Z')
  assert.equal(rueckkehrDatum('Ab 7.1. bin ich wieder im Büro.', dez), '2027-01-07')
  assert.equal(rueckkehrDatum('Ich bin bis zum 14. November abwesend.', HEUTE), '2026-11-14')
  assert.equal(rueckkehrDatum('Telefon 0221 12.34.56', HEUTE), null)
  assert.equal(rueckkehrDatum('Gegründet am 1.4.1998', HEUTE), null)
})
