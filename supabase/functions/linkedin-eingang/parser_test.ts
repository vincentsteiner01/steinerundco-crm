// Tests für parser.ts – nur erfundene Namen und Adressen.  Aufruf: deno test supabase/functions/linkedin-eingang
import assert from 'node:assert/strict'
import { eigeneSlugsSchaetzen, type Mail, nameBereinigen, parseMail, slugAusLink, textAuszug, zeileBauen } from './parser.ts'

const FUSS_DE = [
  '',
  '----------------------------------------',
  'Diese E-Mail ist für Vincent Testnutzer (Gründer bei Testfirma) bestimmt.',
  'Erfahren Sie, warum wir dies hinzugefügt haben. <https://www.linkedin.com/help/linkedin/answer/4788?lang=de>',
  'Sie erhalten Benachrichtigungen per E-Mail zu Nachrichten. Abmelden <https://www.linkedin.com/comm/psettings/email-unsubscribe?otpToken=GEHEIM>',
  'Hilfe: https://www.linkedin.com/help/linkedin/answer/67?lang=de',
  '© 2026 LinkedIn Corporation, 1000 West Maude Avenue, Sunnyvale, CA 94085.',
].join('\n')
const FUSS_EN = [
  '',
  '----------------------------------------',
  'This email was intended for Vincent Testnutzer (Founder at Testfirma).',
  'Learn why we included this: https://www.linkedin.com/help/linkedin/answer/4788',
  'You are receiving LinkedIn notification emails. Unsubscribe: https://www.linkedin.com/comm/psettings/email-unsubscribe?otpToken=SECRET',
  '© 2026 LinkedIn Corporation, 1000 West Maude Avenue, Sunnyvale, CA 94085.',
].join('\n')

function mail(teil: Partial<Mail>): Mail {
  return { id: '18f0a1b2c3d4e5f6', datum: '2026-10-15T08:30:00.000Z', betreff: '', von: '', text: '', links: [], ...teil }
}

// ---------------------------------------------------------------- Annahmen
Deno.test('1 · de Sie: Annahme, Name aus „über LinkedIn“, eigener Slug ausgeschlossen, Links ohne Query', () => {
  const e = parseMail(mail({
    betreff: 'Anna Beispiel hat Ihre Einladung angenommen',
    von: '"Anna Beispiel über LinkedIn" <invitations@linkedin.com>',
    text: 'Anna Beispiel hat Ihre Einladung angenommen.\n\nAnna Beispiel\nGeschäftsführerin bei Beispiel GmbH\n\nProfil anzeigen' + FUSS_DE,
    links: [
      'https://www.linkedin.com/comm/in/vincent-eigen?trk=eml-header',
      'https://www.linkedin.com/comm/in/anna-beispiel-4a1b2c?midToken=AQx&trk=eml-email_accept_invite-hero&otpToken=GEHEIM123',
      'https://www.linkedin.com/comm/in/anna-beispiel-4a1b2c?trk=eml-cta',
      'https://www.linkedin.com/comm/mynetwork/?trk=x',
    ],
  }), { eigenerSlug: 'vincent-eigen' })
  assert.equal(e.linkedin, true)
  assert.equal(e.art, 'annahme')
  assert.equal(e.name, 'Anna Beispiel')
  assert.equal(e.parser.name_quelle, 'absender')
  assert.equal(e.slug, 'anna-beispiel-4a1b2c')
  assert.equal(e.parser.regel, 'betreff:de-annahme-hat-angenommen')
  assert.equal(e.text, null)
  assert.ok(e.links.every((l) => !l.includes('?') && !/token/i.test(l)), JSON.stringify(e.links))
  assert.ok(e.links.includes('www.linkedin.com/comm/in/anna-beispiel-4a1b2c'))
})

Deno.test('2 · de Sie: „… zum Vernetzen angenommen“, Absender nur „LinkedIn“ → Name aus Betreff, de.linkedin.com', () => {
  const e = parseMail(mail({
    betreff: 'Bernd Muster hat Ihre Einladung zum Vernetzen angenommen',
    von: 'LinkedIn <invitations@linkedin.com>',
    links: ['https://de.linkedin.com/in/bernd-muster/?originalSubdomain=de'],
  }))
  assert.equal(e.art, 'annahme')
  assert.equal(e.name, 'Bernd Muster')
  assert.equal(e.parser.name_quelle, 'betreff')
  assert.equal(e.slug, 'bernd-muster')
})

Deno.test('3 · de du: „… hat deine Einladung angenommen“', () => {
  const e = parseMail(mail({
    betreff: 'Carla Exempel hat deine Einladung angenommen',
    von: 'LinkedIn <invitations-noreply@linkedin.com>',
    links: ['https://www.linkedin.com/comm/in/carla-exempel-9z'],
  }))
  assert.equal(e.art, 'annahme')
  assert.equal(e.name, 'Carla Exempel')
  assert.equal(e.slug, 'carla-exempel-9z')
})

Deno.test('4 · en: „accepted your invitation“ und „start a conversation with your new connection“', () => {
  const a = parseMail(mail({
    betreff: 'Dario Sample accepted your invitation',
    von: '"Dario Sample via LinkedIn" <invitations@linkedin.com>',
    links: ['https://www.linkedin.com/comm/in/dariosample'],
  }))
  assert.equal(a.art, 'annahme')
  assert.equal(a.name, 'Dario Sample')
  assert.equal(a.slug, 'dariosample')
  const b = parseMail(mail({
    betreff: 'Vincent, start a conversation with your new connection, Emma Testcase',
    von: 'LinkedIn <invitations@linkedin.com>',
  }))
  assert.equal(b.art, 'annahme')
  assert.equal(b.name, 'Emma Testcase')
  assert.equal(b.slug, null)
  const c = parseMail(mail({ betreff: 'Sie und Felix Frei sind jetzt vernetzt', von: 'LinkedIn <invitations@linkedin.com>' }))
  assert.equal(c.art, 'annahme')
  assert.equal(c.name, 'Felix Frei')
})

// ---------------------------------------------------------------- Nachrichten
Deno.test('5 · de Sie: „Sie haben eine neue Nachricht von …“ → nur der Nachrichtentext, ohne Name, Headline, Aufruf, Fuß', () => {
  const e = parseMail(mail({
    betreff: 'Sie haben eine neue Nachricht von Erik Probe',
    von: '"Erik Probe über LinkedIn" <messages-noreply@linkedin.com>',
    text: [
      'Sie haben eine neue Nachricht',
      '',
      'Erik Probe',
      'Inhaber bei Probe Haustechnik GmbH',
      '',
      'Hallo Herr Testnutzer, danke für die Vernetzung.',
      'Wir suchen tatsächlich gerade eine Lösung für den Innendienst.',
      '',
      'Antworten <https://www.linkedin.com/comm/messaging/thread/2-ABC/?trk=eml-reply>',
      '',
      'Weitere Nachrichten von Ihrem Netzwerk',
    ].join('\n') + FUSS_DE,
    links: ['https://www.linkedin.com/comm/in/erik-probe-77?trk=a', 'https://www.linkedin.com/comm/messaging/thread/2-ABC/'],
  }))
  assert.equal(e.art, 'nachricht')
  assert.equal(e.name, 'Erik Probe')
  assert.equal(e.slug, 'erik-probe-77')
  assert.equal(e.text, 'Hallo Herr Testnutzer, danke für die Vernetzung.\nWir suchen tatsächlich gerade eine Lösung für den Innendienst.')
})

Deno.test('6 · de Sie/du: „hat Ihnen/dir eine Nachricht gesendet“, „Neue Nachricht von …“', () => {
  const a = parseMail(mail({ betreff: 'Erik Probe hat Ihnen eine Nachricht gesendet', von: '"Erik Probe über LinkedIn" <messages-noreply@linkedin.com>' }))
  assert.equal(a.art, 'nachricht')
  assert.equal(a.parser.regel, 'betreff:de-nachricht-hat-gesendet')
  const b = parseMail(mail({
    betreff: 'Frieda Fiktiv hat dir eine Nachricht gesendet',
    von: 'LinkedIn <messages-noreply@linkedin.com>',
    text: 'Frieda Fiktiv\nVertrieb | Fiktiv AG\n\nHi, kurze Frage: Habt ihr nächste Woche Zeit?\n\nAntworten' + FUSS_DE,
  }))
  assert.equal(b.art, 'nachricht')
  assert.equal(b.name, 'Frieda Fiktiv')
  assert.equal(b.text, 'Hi, kurze Frage: Habt ihr nächste Woche Zeit?')
  const c = parseMail(mail({ betreff: 'Neue Nachricht von Gustav Imaginär', von: 'LinkedIn <messages-noreply@linkedin.com>' }))
  assert.equal(c.art, 'nachricht')
  assert.equal(c.name, 'Gustav Imaginär')
})

Deno.test('7 · en: „sent you a new message“, „New message from“, „You have a new message from“', () => {
  const a = parseMail(mail({
    betreff: 'Hanna Placeholder sent you a new message',
    von: '"Hanna Placeholder via LinkedIn" <messages-noreply@linkedin.com>',
    text: 'Hanna Placeholder\nHead of Sales at Placeholder Ltd\n\nThanks for connecting – happy to chat next week.\n\nReply' + FUSS_EN,
  }))
  assert.equal(a.art, 'nachricht')
  assert.equal(a.text, 'Thanks for connecting – happy to chat next week.')
  for (const betreff of ['New message from Ivan Invented', 'You have a new message from Ivan Invented']) {
    const b = parseMail(mail({ betreff, von: 'LinkedIn <messages-noreply@linkedin.com>' }))
    assert.equal(b.art, 'nachricht', betreff)
    assert.equal(b.name, 'Ivan Invented', betreff)
  }
})

Deno.test('8 · Weiterleitungs-Links (LinkedIn-redir und Google, %-kodiert) liefern den Slug', () => {
  const e = parseMail(mail({
    betreff: 'Katrin Kunstname hat Ihnen eine Nachricht gesendet',
    von: '"Katrin Kunstname über LinkedIn" <messages-noreply@linkedin.com>',
    links: [
      'https://www.linkedin.com/redir/redirect?url=https%3A%2F%2Fde.linkedin.com%2Fin%2Fkatrin-kunstname-7b3%3Ftrk%3Dabc&urlhash=x1',
      'https://www.google.com/url?q=https://www.linkedin.com/comm/in/katrin-kunstname-7b3%3FmidToken%3Dz&sa=D',
    ],
  }))
  assert.equal(e.slug, 'katrin-kunstname-7b3')
  assert.equal(e.parser.slug_quelle, 'redirect')
  assert.deepEqual(slugAusLink('https%3A%2F%2Fwww.linkedin.com%2Fcomm%2Fin%2Fjonas-test'), { slug: 'jonas-test', ueber: 'redirect' })
  assert.deepEqual(slugAusLink('https://www.linkedin.com/in/j%C3%BCrgen-m%C3%BCster-12/'), { slug: 'jürgen-müster-12', ueber: 'link' })
  assert.equal(slugAusLink('https://www.linkedin.com/in/ACoAAAbCdEfGhIjKlMnOp'), null, 'Mitglieds-URN ist kein Profil-Slug')
  assert.equal(slugAusLink('https://www.linkedin.com/company/testfirma/'), null)
})

Deno.test('9 · Slug-Wahl: der zum Namen passende Slug gewinnt gegen häufigere fremde Slugs', () => {
  const e = parseMail(mail({
    betreff: 'Neue Nachricht von Jürgen Müster',
    von: 'LinkedIn <messages-noreply@linkedin.com>',
    links: [
      'https://www.linkedin.com/comm/in/empfohlen-eins', 'https://www.linkedin.com/comm/in/empfohlen-eins',
      'https://www.linkedin.com/comm/in/juergen-muester-1a',
    ],
  }))
  assert.equal(e.slug, 'juergen-muester-1a')
  assert.equal(e.parser.slugs, 2)
})

Deno.test('10 · Absender-Regel: InMail mit eigenem Betreff von „… via LinkedIn“ <inmail-hit-reply@> ist eine Nachricht', () => {
  const e = parseMail(mail({
    betreff: 'Kurze Frage zu Ihrem Angebot',
    von: '"Lena Beispielhaft via LinkedIn" <inmail-hit-reply@linkedin.com>',
    text: 'Lena Beispielhaft\nInhaberin bei Beispielhaft KG\n\nGuten Tag, wie läuft so ein Projekt bei Ihnen ab?\n\nAntworten' + FUSS_DE,
  }))
  assert.equal(e.art, 'nachricht')
  assert.equal(e.parser.regel, 'absender:inmail-hit-reply')
  assert.equal(e.name, 'Lena Beispielhaft')
  assert.equal(e.text, 'Guten Tag, wie läuft so ein Projekt bei Ihnen ab?')
})

Deno.test('11 · Text-Regel: Betreff unklar, erste Zeilen des Textes nennen die Annahme', () => {
  const e = parseMail(mail({
    betreff: 'Neuigkeiten zu Ihrer Einladung',
    von: 'LinkedIn <notifications-noreply@linkedin.com>',
    text: 'Max Fantasie hat Ihre Einladung angenommen.\nProfil anzeigen' + FUSS_DE,
  }))
  assert.equal(e.art, 'annahme')
  assert.equal(e.parser.regel, 'text:de-annahme-hat-angenommen')
  assert.equal(e.name, 'Max Fantasie')
  assert.equal(e.parser.name_quelle, 'text')
})

// ---------------------------------------------------------------- Einladungen
Deno.test('12 · Einladung erhalten (de mit Notiz, en)', () => {
  const a = parseMail(mail({
    betreff: 'Ida Erfunden möchte sich mit Ihnen vernetzen',
    von: '"Ida Erfunden über LinkedIn" <invitations@linkedin.com>',
    text: 'Ida Erfunden\nGeschäftsführerin bei Erfunden GmbH\n\n„Hallo Herr Testnutzer, wir haben uns auf der Messe gesehen.“\n\nAnnehmen <https://www.linkedin.com/comm/mynetwork/invite-accept?x=1>\nProfil anzeigen' + FUSS_DE,
    links: ['https://www.linkedin.com/comm/in/ida-erfunden'],
  }))
  assert.equal(a.art, 'einladung')
  assert.equal(a.name, 'Ida Erfunden')
  assert.equal(a.slug, 'ida-erfunden')
  assert.equal(a.text, '„Hallo Herr Testnutzer, wir haben uns auf der Messe gesehen.“')
  const b = parseMail(mail({ betreff: 'Jonas Madeup wants to connect', von: 'LinkedIn <invitations@linkedin.com>' }))
  assert.equal(b.art, 'einladung')
  assert.equal(b.name, 'Jonas Madeup')
  const c = parseMail(mail({ betreff: 'Ich möchte mich mit Ihnen auf LinkedIn vernetzen', von: '"Olga Ohnename über LinkedIn" <invitations@linkedin.com>' }))
  assert.equal(c.art, 'einladung')
  assert.equal(c.name, 'Olga Ohnename')
})

// ---------------------------------------------------------------- Ignorieren
Deno.test('13 · Werbung, Hinweise, Seiten-Einladungen → sonstiges', () => {
  const faelle: Array<[string, string]> = [
    ['Vincent, Sie wurden diese Woche in 12 Suchanfragen gefunden', 'LinkedIn <notifications-noreply@linkedin.com>'],
    ['LinkedIn Premium: Testen Sie 1 Monat kostenlos', 'LinkedIn <linkedin@e.linkedin.com>'],
    ['Neue Jobs für Sie: Vertriebsleitung in Teststadt', 'LinkedIn Job Alerts <jobalerts-noreply@linkedin.com>'],
    ['Anna Beispiel hat Sie eingeladen, ihrer Seite zu folgen', 'LinkedIn <invitations@linkedin.com>'],
    ['Anna Beispiel hat Ihren Beitrag kommentiert', 'LinkedIn <notifications-noreply@linkedin.com>'],
    ['Erik Probe sent you a Sponsored message', 'LinkedIn <messages-noreply@linkedin.com>'],
  ]
  for (const [betreff, von] of faelle) {
    const e = parseMail(mail({ betreff, von, text: 'Etwas Text' + FUSS_DE }))
    assert.equal(e.linkedin, true, betreff)
    assert.equal(e.art, 'sonstiges', betreff)
    assert.ok(e.parser.grund, betreff)
  }
})

Deno.test('14 · Sammel-Mails (mehrere Nachrichten/Personen) → sonstiges', () => {
  for (const betreff of ['Sie haben 3 neue Nachrichten', 'Du hast ungelesene Nachrichten', 'You have 4 new messages',
    'Katrin Kunstname and 2 others sent you messages', 'Anna Beispiel und 3 weitere haben Ihre Einladung angenommen']) {
    const e = parseMail(mail({ betreff, von: 'LinkedIn <messages-noreply@linkedin.com>' }))
    assert.equal(e.art, 'sonstiges', betreff)
    assert.match(e.parser.grund ?? '', /Sammel/, betreff)
  }
  const d = parseMail(mail({ betreff: 'Erik Probe hat Ihnen eine Nachricht gesendet', von: 'LinkedIn <messaging-digest-noreply@linkedin.com>' }))
  assert.equal(d.art, 'sonstiges')
})

Deno.test('15 · Fremde und gefälschte Absender sind keine LinkedIn-Mails', () => {
  for (const von of ['Newsletter <news@example.com>', 'LinkedIn <invitations@linkedin.com.boese.example>', 'invitations@notlinkedin.com']) {
    const e = parseMail(mail({ betreff: 'Anna Beispiel hat Ihre Einladung angenommen', von }))
    assert.equal(e.linkedin, false, von)
    assert.equal(e.art, 'sonstiges', von)
  }
  const f = parseMail(mail({ betreff: 'Anna Beispiel hat Ihre Einladung angenommen', von: 'LinkedIn <invitations@linkedin.com>', dmarc: 'fail' }))
  assert.equal(f.linkedin, false)
  assert.match(f.parser.grund ?? '', /DMARC/)
})

// ---------------------------------------------------------------- Helfer
Deno.test('16 · Namen bereinigen: Zusätze, Emojis, Titel bleiben, Nicht-Namen → null', () => {
  assert.equal(nameBereinigen('Max Mustermann, MBA 🚀'), 'Max Mustermann')
  assert.equal(nameBereinigen('Vincent, Paula Probe'), 'Paula Probe')
  assert.equal(nameBereinigen('Dr. Paula Probe | Beraterin'), 'Dr. Paula Probe')
  assert.equal(nameBereinigen('Paula Probe (sie/ihr)'), 'Paula Probe')
  assert.equal(nameBereinigen('LinkedIn'), null)
  assert.equal(nameBereinigen('https://www.linkedin.com/in/x'), null)
  assert.equal(nameBereinigen('Das ist ganz sicher kein Name einer Person hier'), null)
})

Deno.test('17 · Textauszug: Zitate und Antwortkopf weg, höchstens 2000 Zeichen', () => {
  const t = textAuszug('Gern.\n\nAm 14.10.2026 schrieb Vincent Testnutzer:\n> alte Nachricht', null, 'x')
  assert.equal(t, 'Gern.')
  const lang = textAuszug('A'.repeat(3000) + FUSS_DE, null, 'x')
  assert.equal(lang?.length, 2000)
  assert.ok(lang?.endsWith('…'))
  assert.equal(textAuszug('Antworten\n' + FUSS_DE, null, 'x'), null)
})

Deno.test('18 · zeileBauen: roh ≤ 4 kB, keine Query, Status je Art, fremde Mail ohne Betreff', () => {
  const viele = Array.from({ length: 40 }, (_, i) => `https://www.linkedin.com/comm/feed/update/urn:li:activity:${'9'.repeat(150)}${i}?otpToken=GEHEIM`)
  const m = mail({ betreff: 'Erik Probe hat Ihnen eine Nachricht gesendet ' + 'x'.repeat(900), von: '"Erik Probe über LinkedIn" <messages-noreply@linkedin.com>', links: viele, text: 'Hallo' })
  const z = zeileBauen(m, parseMail(m), '00000000-0000-0000-0000-000000000001', new Date('2026-10-15T09:00:00Z'))
  const groesse = new TextEncoder().encode(JSON.stringify(z.roh)).length
  assert.ok(groesse <= 4000, `roh ist ${groesse} Byte`)
  assert.ok(!JSON.stringify(z.roh).includes('GEHEIM'))
  assert.equal(z.status, 'neu')
  assert.equal(z.art, 'nachricht')
  assert.equal(z.empfangen_at, '2026-10-15T08:30:00.000Z')
  assert.equal(z.external_id, '18f0a1b2c3d4e5f6')
  assert.equal(z.verarbeitet_at, null)

  const w = mail({ id: 'w1', betreff: 'LinkedIn Premium: Testen Sie 1 Monat kostenlos', von: 'LinkedIn <linkedin@e.linkedin.com>', datum: 'kaputt' })
  const zw = zeileBauen(w, parseMail(w), 'm', new Date('2026-10-15T09:00:00Z'))
  assert.equal(zw.status, 'ignoriert')
  assert.equal(zw.empfangen_at, '2026-10-15T09:00:00.000Z')
  assert.ok(zw.ergebnis)

  const f = mail({ id: 'f1', betreff: 'Privates Thema', von: 'Freundin <freundin@example.com>' })
  const zf = zeileBauen(f, parseMail(f), 'm')
  assert.equal(zf.status, 'ignoriert')
  assert.equal(zf.roh.betreff, undefined, 'Betreff fremder Mails wird nicht gespeichert')
  assert.equal(zf.roh.von_domain, undefined, 'auch keine Absender-Domain')
  assert.deepEqual(Object.keys(zf.roh), ['parser'])
})

Deno.test('19 · Datensparsamkeit: Werbung/Hinweise behalten nur Regel, Grund und Systemadresse – kein Betreff, Absender, Link', () => {
  const w = mail({
    id: 'w2',
    betreff: 'Erika Fremd hat Ihr Profil angesehen',
    von: 'LinkedIn <notifications-noreply@linkedin.com>',
    text: 'Erika Fremd hat Ihr Profil angesehen. https://www.linkedin.com/comm/in/erika-fremd-9?trk=x',
    links: ['https://www.linkedin.com/comm/in/erika-fremd-9'],
  })
  const z = zeileBauen(w, parseMail(w), 'm')
  assert.equal(z.status, 'ignoriert')
  assert.equal(z.absender_name, null)
  assert.equal(z.linkedin_slug, null)
  assert.equal(z.text, null)
  assert.deepEqual(Object.keys(z.roh), ['parser'])
  const info = z.roh.parser as Record<string, unknown>
  assert.equal(info.absender, 'notifications-noreply')
  assert.ok(!JSON.stringify(z.roh).includes('Erika'), JSON.stringify(z.roh))
})

Deno.test('20 · eigener Slug ohne Profil-URL: Slug mit dem eigenen Vornamen zählt nicht, außer der Absender heißt so', () => {
  const links = [
    'https://www.linkedin.com/comm/in/vincent-steiner-0815?trk=eml-header',
    'https://www.linkedin.com/comm/in/vincent-steiner-0815?trk=eml-footer',
    'https://www.linkedin.com/comm/in/abx-4711?trk=eml-cta',
  ]
  const m = mail({ betreff: 'Neue Nachricht von Anna Ab', von: '"Anna Ab über LinkedIn" <messages-noreply@linkedin.com>', links })
  assert.equal(parseMail(m).slug, 'vincent-steiner-0815', 'ohne Wissen gewinnt der häufigste Slug')
  assert.equal(parseMail(m, { eigeneNamen: ['Vincent'] }).slug, 'abx-4711')
  assert.equal(parseMail(m, { eigeneSlugs: ['vincent-steiner-0815'] }).slug, 'abx-4711')
  const gleich = mail({
    betreff: 'Neue Nachricht von Vincent Probe',
    von: '"Vincent Probe über LinkedIn" <messages-noreply@linkedin.com>',
    links: ['https://www.linkedin.com/comm/in/vincent-probe-1'],
  })
  assert.equal(parseMail(gleich, { eigeneNamen: ['Vincent'] }).slug, 'vincent-probe-1', 'Absender heißt selbst Vincent')
})

Deno.test('21 · eigeneSlugsSchaetzen: Slug in ≥ 3 Mails von ≥ 2 Absendern, der zu keinem passt, ist der eigene', () => {
  const kopf = 'https://www.linkedin.com/comm/in/mein-profil-77?trk=eml-header'
  const m = (id: string, wer: string, slug: string) =>
    mail({ id, betreff: `Neue Nachricht von ${wer}`, von: `"${wer} über LinkedIn" <messages-noreply@linkedin.com>`, links: [kopf, `https://www.linkedin.com/comm/in/${slug}`] })
  const liste = [m('a', 'Anna Ab', 'abx-1'), m('b', 'Bernd Muster', 'bernd-muster'), m('c', 'Clara Probe', 'cp-3')]
  assert.deepEqual(eigeneSlugsSchaetzen(liste), ['mein-profil-77'])
  assert.deepEqual(eigeneSlugsSchaetzen(liste.slice(0, 2)), [], 'zwei Mails reichen nicht')
  assert.equal(parseMail(liste[0] as Mail, { eigeneSlugs: eigeneSlugsSchaetzen(liste) }).slug, 'abx-1')
})
