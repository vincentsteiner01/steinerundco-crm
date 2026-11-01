// Tests für imap.ts gegen einen Attrappen-Server (lokales TCP). Nur erfundene Adressen.
// Aufruf: deno test --allow-net=127.0.0.1 supabase/functions/mail-motor
import assert from 'node:assert/strict'
import { ImapClient, ImapFehler, imapDatum, listeLesen, quote, seitDatum } from './imap.ts'

const enc = new TextEncoder()

/** Literal-Block für den Server: „{n}\r\n<inhalt>“ mit Byte-Länge. */
const literal = (s: string) => `{${enc.encode(s).length}}\r\n${s}`

type Antwort = { zeilen: string[]; status?: string }

function attrappe(antworten: (befehl: string) => Antwort) {
  const server = Deno.listen({ hostname: '127.0.0.1', port: 0 })
  const port = (server.addr as Deno.NetAddr).port
  const befehle: string[] = []
  const fertig = (async () => {
    const conn = await server.accept()
    const dec = new TextDecoder()
    await conn.write(enc.encode('* OK [CAPABILITY IMAP4rev1] Attrappe bereit\r\n'))
    let rest = ''
    const buf = new Uint8Array(65536)
    try {
      for (;;) {
        const n = await conn.read(buf)
        if (n === null) break
        rest += dec.decode(buf.subarray(0, n))
        let i: number
        while ((i = rest.indexOf('\r\n')) >= 0) {
          const zeile = rest.slice(0, i)
          rest = rest.slice(i + 2)
          const [tag, ...r] = zeile.split(' ')
          const befehl = r.join(' ')
          befehle.push(befehl)
          const a = antworten(befehl)
          const text = a.zeilen.map((z) => `${z}\r\n`).join('') + `${tag} ${a.status ?? 'OK erledigt'}\r\n`
          await conn.write(enc.encode(text))
          if (befehl === 'LOGOUT') {
            conn.close()
            return
          }
        }
      }
    } catch {
      /* Client hat geschlossen */
    } finally {
      try {
        conn.close()
      } catch {
        /* */
      }
    }
  })().finally(() => server.close())
  return { port, befehle, fertig }
}

const ZUGANG = { host: '127.0.0.1', port: 0, benutzer: 'vincent@versand-beispiel.de', passwort: 'abcd efgh ijkl mnop' }

const MAIL = [
  'From: Lena Kurz <lena@beispiel-solar.de>',
  'To: vincent@versand-beispiel.de',
  'Subject: Re: Kurze Frage',
  'Message-ID: <antwort-1@beispiel-solar.de>',
  'In-Reply-To: <k1@versand-beispiel.de>',
  'Content-Type: text/plain; charset=utf-8',
  '',
  'Gerne, rufen Sie mich an. Grüße',
  '',
].join('\r\n')

Deno.test('Ablauf: LOGIN, LIST mit \\Junk, EXAMINE, UID SEARCH, FETCH mit Literal (Umlaute), MOVE, LOGOUT', async () => {
  const a = attrappe((b) => {
    if (b.startsWith('LOGIN')) return { zeilen: [], status: 'OK [CAPABILITY IMAP4rev1 MOVE UIDPLUS SPECIAL-USE LIST-EXTENDED] eingeloggt' }
    if (b.startsWith('LIST'))
      return {
        zeilen: [
          '* LIST (\\HasNoChildren) "/" "INBOX"',
          '* LIST (\\HasChildren \\Noselect) "/" "[Gmail]"',
          '* LIST (\\HasNoChildren \\Junk) "/" "[Gmail]/Spam"',
          '* LIST (\\HasNoChildren \\Sent) "/" "[Gmail]/Gesendet"',
        ],
      }
    if (b.startsWith('EXAMINE'))
      return { zeilen: ['* 3 EXISTS', '* OK [UIDVALIDITY 777] UIDs gültig', '* OK [UIDNEXT 43] Vorhersage'], status: 'OK [READ-ONLY] EXAMINE fertig' }
    if (b.startsWith('UID SEARCH')) return { zeilen: ['* SEARCH 41 42'] }
    if (b.startsWith('UID FETCH'))
      return { zeilen: [`* 2 FETCH (UID 42 INTERNALDATE "02-Nov-2026 09:30:00 +0100" BODY[]<0> ${literal(MAIL)})`] }
    if (b.startsWith('SELECT')) return { zeilen: ['* OK [UIDVALIDITY 9]'] }
    if (b.startsWith('UID MOVE')) return { zeilen: ['* OK [COPYUID 9 42 100]'] }
    if (b === 'LOGOUT') return { zeilen: ['* BYE'] }
    return { zeilen: [], status: 'BAD unbekannt' }
  })
  const c = new ImapClient(ZUGANG, { verbindung: () => Deno.connect({ hostname: '127.0.0.1', port: a.port }) })
  await c.verbinden()
  assert.ok(c.faehigkeiten.includes('MOVE'))
  const so = await c.sonderordner()
  assert.deepEqual(so, { spam: '[Gmail]/Spam', gesendet: '[Gmail]/Gesendet' })
  const box = await c.examine('INBOX')
  assert.deepEqual(box, { validity: '777', uidNext: 43, anzahl: 3 })
  assert.deepEqual(await c.uidSuche('UID 41:*'), [41, 42])
  const [m] = await c.holen([42])
  assert.equal(m?.uid, 42)
  assert.equal(m?.datum, '2026-11-02T08:30:00.000Z')
  assert.equal(new TextDecoder().decode(m!.quelle), MAIL)
  await c.select('[Gmail]/Spam')
  assert.equal(await c.verschieben(42, 'INBOX'), true)
  await c.abmelden()
  await a.fertig
  assert.equal(a.befehle[0], 'LOGIN "vincent@versand-beispiel.de" "abcdefghijklmnop"')
  assert.equal(a.befehle[1], 'LIST "" "*" RETURN (SPECIAL-USE)')
  assert.equal(a.befehle[2], 'EXAMINE "INBOX"')
  assert.match(a.befehle[4] ?? '', /^UID FETCH 42 \(UID INTERNALDATE BODY\.PEEK\[\]<0\.60000>\)$/)
  assert.equal(a.befehle[6], 'UID MOVE 42 "INBOX"')
})

Deno.test('Anmeldung abgelehnt → ImapFehler mit anmeldung = true, Verbindung zu', async () => {
  const a = attrappe((b) =>
    b.startsWith('LOGIN') ? { zeilen: [], status: 'NO [AUTHENTICATIONFAILED] Invalid credentials (Failure)' } : { zeilen: [] },
  )
  const c = new ImapClient(ZUGANG, { verbindung: () => Deno.connect({ hostname: '127.0.0.1', port: a.port }) })
  await assert.rejects(
    () => c.verbinden(),
    (e: unknown) => e instanceof ImapFehler && e.anmeldung && /Invalid credentials/.test(e.message),
  )
  await a.fertig
})

Deno.test('Message-IDs für Platzierungstests (HEADER.FIELDS als Literal)', async () => {
  const a = attrappe((b) => {
    if (b.startsWith('LOGIN')) return { zeilen: [] }
    if (b === 'CAPABILITY') return { zeilen: ['* CAPABILITY IMAP4rev1 UIDPLUS'] }
    if (b.startsWith('UID FETCH'))
      return {
        zeilen: [
          `* 1 FETCH (UID 7 BODY[HEADER.FIELDS (MESSAGE-ID)] ${literal('Message-ID: <Test-A@versand-beispiel.de>\r\n\r\n')})`,
          `* 2 FETCH (UID 8 BODY[HEADER.FIELDS (MESSAGE-ID)] ${literal('\r\n')})`,
        ],
      }
    return { zeilen: [] }
  })
  const c = new ImapClient(ZUGANG, { verbindung: () => Deno.connect({ hostname: '127.0.0.1', port: a.port }) })
  await c.verbinden()
  assert.deepEqual(c.faehigkeiten, ['IMAP4REV1', 'UIDPLUS'])
  const ids = await c.messageIds([7, 8])
  assert.deepEqual([...ids.entries()], [[7, '<test-a@versand-beispiel.de>']])
  await c.abmelden()
  await a.fertig
})

Deno.test('listeLesen: Atom-Name, Literal-Name, NIL-Trenner', () => {
  assert.deepEqual(listeLesen({ text: '* LIST (\\HasNoChildren) "." INBOX', literale: [] }), { pfad: 'INBOX', flags: ['\\HasNoChildren'] })
  assert.deepEqual(listeLesen({ text: '* LIST (\\Junk) NIL {4}', literale: [new TextEncoder().encode('Spam')] }), {
    pfad: 'Spam',
    flags: ['\\Junk'],
  })
  assert.equal(quote('a"b\\c'), '"a\\"b\\\\c"')
})

Deno.test('Datumshelfer', () => {
  assert.equal(imapDatum('1-Nov-2026 10:00:00 +0000'), '2026-11-01T10:00:00.000Z')
  assert.equal(seitDatum(new Date('2026-11-02T00:00:00Z')), '2-Nov-2026')
})
