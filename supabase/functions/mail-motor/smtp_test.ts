// Tests für smtp.ts gegen einen Attrappen-Server (lokales TCP, kein TLS). Aufruf: deno test -A supabase/functions/mail-motor
import assert from 'node:assert/strict'
import { fehlerArt, punktieren, smtpPruefen, smtpSenden } from './smtp.ts'

type Regel = (zeile: string) => string | null

/** Mini-SMTP-Server: antwortet zeilenweise nach `regel`; sammelt alles, was im DATA-Teil ankommt. */
function attrappe(regel: Regel) {
  const server = Deno.listen({ hostname: '127.0.0.1', port: 0 })
  const port = (server.addr as Deno.NetAddr).port
  const protokoll: string[] = []
  let daten = ''
  const fertig = (async () => {
    const conn = await server.accept()
    const enc = new TextEncoder()
    const dec = new TextDecoder()
    await conn.write(enc.encode('220 attrappe ESMTP\r\n'))
    let rest = ''
    let imData = false
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
          if (imData) {
            if (zeile === '.') {
              imData = false
              await conn.write(enc.encode('250 2.0.0 OK queued as X1\r\n'))
            } else daten += `${zeile}\n`
            continue
          }
          protokoll.push(zeile)
          const a = regel(zeile)
          if (a === 'DATA') {
            imData = true
            await conn.write(enc.encode('354 Go ahead\r\n'))
          } else if (a) await conn.write(enc.encode(`${a}\r\n`))
          if (zeile === 'QUIT') {
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
  return { port, protokoll, daten: () => daten, fertig }
}

const ZUGANG = { host: '127.0.0.1', port: 0, sicherheit: 'ssl' as const, benutzer: 'vincent@versand-beispiel.de', passwort: 'abcd efgh ijkl mnop' }

function standard(zusatz: Partial<Record<'auth' | 'rcpt', string>> = {}): Regel {
  return (z) => {
    if (z.startsWith('EHLO')) return '250-attrappe\r\n250-SIZE 35882577\r\n250 AUTH LOGIN PLAIN'
    if (z.startsWith('AUTH PLAIN')) return zusatz.auth ?? '235 2.7.0 Accepted'
    if (z.startsWith('MAIL FROM')) return '250 2.1.0 OK'
    if (z.startsWith('RCPT TO')) return zusatz.rcpt ?? '250 2.1.5 OK'
    if (z === 'DATA') return 'DATA'
    if (z === 'QUIT') return '221 2.0.0 Bye'
    return '500 unbekannt'
  }
}

Deno.test('Senden: EHLO, AUTH PLAIN ohne Leerzeichen im App-Passwort, Umschlag, Punkt-Verdopplung', async () => {
  const a = attrappe(standard())
  const roh = 'Subject: Test\r\n\r\nZeile eins\r\n.Zeile mit Punkt\r\n.\r\nEnde'
  const e = await smtpSenden(ZUGANG, { von: 'vincent@versand-beispiel.de', an: 'lena@beispiel-solar.de' }, roh, {
    ehlo: 'versand-beispiel.de',
    verbindung: () => Deno.connect({ hostname: '127.0.0.1', port: a.port }),
  })
  await a.fertig
  assert.deepEqual(e, { ok: true, antwort: '2.0.0 OK queued as X1' })
  assert.equal(a.protokoll[0], 'EHLO versand-beispiel.de')
  const auth = atob(a.protokoll[1]!.slice('AUTH PLAIN '.length))
  assert.equal(auth, '\u0000vincent@versand-beispiel.de\u0000abcdefghijklmnop')
  assert.equal(a.protokoll[2], 'MAIL FROM:<vincent@versand-beispiel.de>')
  assert.equal(a.protokoll[3], 'RCPT TO:<lena@beispiel-solar.de>')
  assert.equal(a.daten(), 'Subject: Test\n\nZeile eins\n..Zeile mit Punkt\n..\nEnde\n')
})

Deno.test('Anmeldung abgelehnt (535) → art „anmeldung“', async () => {
  const a = attrappe(standard({ auth: '535-5.7.8 Username and Password not accepted.\r\n535 5.7.8 BadCredentials' }))
  const e = await smtpSenden(ZUGANG, { von: 'v@b.de', an: 'x@y.de' }, 'Subject: x\r\n\r\ny', {
    verbindung: () => Deno.connect({ hostname: '127.0.0.1', port: a.port }),
  })
  await a.fertig.catch(() => {})
  assert.equal(e.ok, false)
  if (!e.ok) {
    assert.equal(e.art, 'anmeldung')
    assert.equal(e.code, 535)
  }
})

Deno.test('Empfänger unbekannt (550 5.1.1 bei RCPT) → art „empfaenger“', async () => {
  const a = attrappe(standard({ rcpt: '550 5.1.1 The email account that you tried to reach does not exist' }))
  const e = await smtpSenden(ZUGANG, { von: 'v@b.de', an: 'weg@y.de' }, 'Subject: x\r\n\r\ny', {
    verbindung: () => Deno.connect({ hostname: '127.0.0.1', port: a.port }),
  })
  await a.fertig.catch(() => {})
  assert.equal(!e.ok && e.art, 'empfaenger')
})

Deno.test('Prüfen: nur Anmeldung, dann QUIT', async () => {
  const a = attrappe(standard())
  const e = await smtpPruefen(ZUGANG, { verbindung: () => Deno.connect({ hostname: '127.0.0.1', port: a.port }) })
  await a.fertig
  assert.equal(e.ok, true)
  assert.deepEqual(a.protokoll.map((z) => z.split(' ')[0]), ['EHLO', 'AUTH', 'QUIT'])
})

Deno.test('fehlerArt: Limit, Drossel, Ablehnung, vorübergehend', () => {
  assert.equal(fehlerArt(550, '5.4.5 Daily user sending limit exceeded', 'daten'), 'limit')
  assert.equal(fehlerArt(421, '4.7.28 Unusual rate of unsolicited mail', 'daten'), 'drossel')
  assert.equal(fehlerArt(550, '5.7.1 Message rejected due to policy', 'daten'), 'abgelehnt')
  assert.equal(fehlerArt(451, '4.3.0 Temporary failure', 'daten'), 'voruebergehend')
  assert.equal(fehlerArt(554, 'Transaction failed', 'daten'), 'sonstiges')
})

Deno.test('punktieren: LF → CRLF, Abschluss genau einmal', () => {
  assert.equal(punktieren('a\n.b'), 'a\r\n..b\r\n.\r\n')
  assert.equal(punktieren('a\r\n'), 'a\r\n.\r\n')
})
