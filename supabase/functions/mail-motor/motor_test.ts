// Tests für motor.ts und mx.ts mit Attrappen (keine echte Datenbank, kein Netz). Nur erfundene Adressen.
// Aufruf: deno test --node-modules-dir=none supabase/functions/mail-motor
import assert from 'node:assert/strict'
import type { ImapClient } from './imap.ts'
import { abgleichen, type Auftrag, type MotorDb, platzierungLesen, takt, type Zugang } from './motor.ts'
import { mxAbfragen, mxKlasse } from './mx.ts'

const enc = new TextEncoder()
const HEUTE = new Date('2026-11-02T09:00:00Z')

function mail(teile: string[]): Uint8Array {
  return enc.encode(teile.join('\r\n'))
}

const ANTWORT = mail([
  'From: Lena Kurz <lena@beispiel-solar.de>',
  'Subject: Re: Kurze Frage',
  'Message-ID: <Antwort-1@beispiel-solar.de>',
  'In-Reply-To: <k1@versand-beispiel.de>',
  '',
  'Gerne, rufen Sie mich an.',
])

/** Attrappe eines IMAP-Clients: Ordner mit UIDs → Mails; protokolliert Aufrufe. */
function fakeImap(ordner: Record<string, Map<number, Uint8Array>>, spam = 'Spam') {
  const log: string[] = []
  let offen = ''
  const c = {
    faehigkeiten: ['MOVE'],
    verbinden: () => (log.push('verbinden'), Promise.resolve()),
    sonderordner: () => Promise.resolve({ spam, gesendet: 'Sent' }),
    examine: (p: string) => {
      offen = p
      log.push(`examine ${p}`)
      const uids = [...(ordner[p]?.keys() ?? [])]
      return Promise.resolve({ validity: '1', uidNext: (uids.length ? Math.max(...uids) : 0) + 1, anzahl: uids.length })
    },
    select: (p: string) => ((offen = p), log.push(`select ${p}`), Promise.resolve({ validity: '1', uidNext: 0, anzahl: 0 })),
    uidSuche: (k: string) => {
      log.push(`suche ${offen} ${k}`)
      const ab = Number(/UID (\d+):\*/.exec(k)?.[1] ?? 1)
      return Promise.resolve([...(ordner[offen]?.keys() ?? [])].filter((u) => u >= ab || k.startsWith('SINCE')))
    },
    holen: (uids: number[]) =>
      Promise.resolve(uids.map((uid) => ({ uid, datum: '2026-11-02T08:30:00.000Z', quelle: ordner[offen]!.get(uid)! }))),
    messageIds: (uids: number[]) => {
      const m = new Map<number, string>()
      for (const u of uids) {
        const id = /Message-ID: (<[^>]+>)/i.exec(new TextDecoder().decode(ordner[offen]!.get(u)!))?.[1]
        if (id) m.set(u, id.toLowerCase())
      }
      return Promise.resolve(m)
    },
    verschieben: (uid: number, ziel: string) => (log.push(`verschieben ${offen} ${uid} → ${ziel}`), Promise.resolve(true)),
    abmelden: () => (log.push('abmelden'), Promise.resolve()),
  }
  return { client: c as unknown as ImapClient, log }
}

Deno.test('abgleichen: neue Antwort im Posteingang + echte Antwort im Spam → DB entscheidet, Spam-Antwort wird gerettet', async () => {
  const { client, log } = fakeImap({
    INBOX: new Map([[5, ANTWORT]]),
    Spam: new Map([[9, ANTWORT]]),
  })
  let gesehen: string[] = []
  const r = await abgleichen(
    client,
    { posteingang: { pfad: 'INBOX', validity: '1', uid: 4 } },
    (posten) => {
      gesehen = posten.map((p) => `${p.ordner}:${p.uid}:${p.einordnung.art}:${p.bezug.join(',')}`)
      return Promise.resolve(posten.map((p) => ({ ordner: p.ordner, uid: p.uid, aktion: p.ordner === 'spam' ? ('retten' as const) : ('nichts' as const) })))
    },
    HEUTE,
  )
  assert.deepEqual(gesehen, ['posteingang:5:antwort:<k1@versand-beispiel.de>', 'spam:9:antwort:<k1@versand-beispiel.de>'])
  assert.equal(r.gerettet, 1)
  assert.deepEqual(r.stand.posteingang, { pfad: 'INBOX', validity: '1', uid: 5 })
  assert.ok(log.includes('verschieben Spam 9 → INBOX'))
  assert.equal(log[log.length - 1], 'abmelden')
})

Deno.test('abgleichen: erster Abruf liest nur die letzten 30 UIDs, bekannte UIDs nicht noch einmal', async () => {
  const inbox = new Map<number, Uint8Array>()
  for (let u = 1; u <= 100; u++) inbox.set(u, ANTWORT)
  const { client } = fakeImap({ INBOX: inbox }, '')
  let anzahl = 0
  const r = await abgleichen(client, {}, (posten) => ((anzahl = posten.length), Promise.resolve([])), HEUTE)
  assert.equal(anzahl, 15) // höchstens 15 je Takt, Rest im nächsten Takt
  assert.equal(r.stand.posteingang?.uid, 85)
})

Deno.test('platzierungLesen: findet Test-Mails in Posteingang und Spam, nur lesend', async () => {
  const testA = mail(['Message-ID: <T-A@versand-beispiel.de>', '', 'x'])
  const testB = mail(['Message-ID: <t-b@versand-beispiel.de>', '', 'x'])
  const { client, log } = fakeImap({ INBOX: new Map([[1, testA]]), Spam: new Map([[2, testB]]) })
  const funde = await platzierungLesen(client, ['<t-a@versand-beispiel.de>', '<t-b@versand-beispiel.de>', '<t-c@x.de>'], HEUTE)
  assert.deepEqual(funde, [
    { message_id: '<t-a@versand-beispiel.de>', ordner: 'posteingang' },
    { message_id: '<t-b@versand-beispiel.de>', ordner: 'spam' },
  ])
  assert.ok(!log.some((l) => l.startsWith('select') || l.startsWith('verschieben')), 'Prüf-Postfächer werden nie verändert')
})

Deno.test('takt: MX zuerst, dann Versand mit gebauter Nachricht, Ergebnis gemeldet', async () => {
  const gemeldet: string[] = []
  const gesendet: string[] = []
  const auftrag: Auftrag = {
    art: 'kampagne', id: 'e1', postfach_id: 'p1', von: 'vincent@versand-beispiel.de', von_name: 'Vincent Testnutzer',
    an: 'lena@beispiel-solar.de', an_name: 'Lena Kurz', betreff: 'Kurze Frage', text: 'Hallo Frau Kurz,\n\n…',
    message_id: '<k1@versand-beispiel.de>', in_reply_to: null, references: null, kopf: {},
  }
  const zugang: Zugang = {
    id: 'p1', adresse: 'vincent@versand-beispiel.de', rolle: 'versand', smtp_host: 'smtp.example', smtp_port: 465,
    smtp_sicherheit: 'ssl', imap_host: 'imap.example', imap_port: 993, benutzer: 'vincent@versand-beispiel.de', passwort: 'x', abruf_stand: {},
  }
  const db: MotorDb = {
    mxOffen: () => Promise.resolve(['beispiel-solar.de']),
    mxSetzen: (e) => (gemeldet.push(`mx ${e.map((x) => `${x.domain}=${x.klasse}`).join(',')}`), Promise.resolve()),
    auftraege: () => Promise.resolve([auftrag]),
    zugang: () => Promise.resolve(zugang),
    ergebnis: (a, r) => (gemeldet.push(`ergebnis ${a.id} ${r.ok}`), Promise.resolve()),
    abrufListe: () => Promise.resolve([]),
    eingang: () => Promise.resolve([]),
    abrufFehler: () => Promise.resolve(),
    platzierungOffen: () => Promise.resolve([]),
    platzierungMelden: () => Promise.resolve(),
  }
  const b = await takt(db, {
    heute: HEUTE,
    werkzeuge: {
      mx: () => Promise.resolve({ klasse: 'ionos', hosts: ['mx00.ionos.de'] }),
      senden: (_z, u, roh, o) => {
        gesendet.push(`${u.von}→${u.an} ehlo=${o?.ehlo} ${/Message-ID: <k1@versand-beispiel\.de>/.test(roh)}`)
        return Promise.resolve({ ok: true, antwort: '250 OK' })
      },
    },
  })
  assert.deepEqual(gemeldet, ['mx beispiel-solar.de=ionos', 'ergebnis e1 true'])
  assert.deepEqual(gesendet, ['vincent@versand-beispiel.de→lena@beispiel-solar.de ehlo=versand-beispiel.de true'])
  assert.equal(b.gesendet, 1)
})

Deno.test('mxKlasse: deutsche Anbieter, Gateways, Null-MX', () => {
  assert.equal(mxKlasse(['aspmx.l.google.com.']), 'google')
  assert.equal(mxKlasse(['smtp.google.com']), 'google')
  assert.equal(mxKlasse(['beispiel-de.mail.protection.outlook.com']), 'microsoft')
  assert.equal(mxKlasse(['mx00.ionos.de', 'mx01.ionos.de']), 'ionos')
  assert.equal(mxKlasse(['smtpin.rzone.de']), 'strato')
  assert.equal(mxKlasse(['mx00.t-online.de']), 'tonline')
  assert.equal(mxKlasse(['mx00.emig.gmx.net']), 'gmx_webde')
  assert.equal(mxKlasse(['w0123.kasserver.com']), 'allinkl')
  assert.equal(mxKlasse(['mx01.hornetsecurity.com']), 'gateway')
  assert.equal(mxKlasse(['mail.beispiel.de']), 'sonstige')
  assert.equal(mxKlasse(['.']), 'kein_mx')
  assert.equal(mxKlasse([]), 'kein_mx')
})

Deno.test('mxAbfragen: NXDOMAIN → kein_mx, Fehler → null, Sortierung nach Priorität', async () => {
  const antwort = (j: unknown) => () => Promise.resolve(new Response(JSON.stringify(j)))
  assert.deepEqual(await mxAbfragen('gibtsnicht.de', antwort({ Status: 3 })), { klasse: 'kein_mx', hosts: [] })
  assert.equal(await mxAbfragen('x.de', antwort({ Status: 2 })), null)
  assert.deepEqual(
    await mxAbfragen('beispiel.de', antwort({ Status: 0, Answer: [{ type: 15, data: '10 mx01.ionos.de.' }, { type: 15, data: '5 mx00.ionos.de.' }] })),
    { klasse: 'ionos', hosts: ['mx00.ionos.de', 'mx01.ionos.de'] },
  )
})
