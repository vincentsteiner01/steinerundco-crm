// Schlanker SMTP-Client (Mail-Motor, 01.11.2026) über Deno.connectTls – Port 465 (implizites TLS) ist aus der Supabase
// Edge Runtime erreichbar; 25 und 587 sind laut Doku gesperrt (587 ging im Test am 01.11. noch, darauf bauen wir nicht).
// npm-Bibliotheken (nodemailer, denomailer) haben laut Recherche 04-technik in der Edge Runtime Ausfälle – deshalb eigen:
// EHLO → AUTH PLAIN (oder LOGIN) → MAIL FROM → RCPT TO → DATA → QUIT. Getestet in smtp_test.ts gegen einen Attrappen-Server.
import { Leitung, LeitungsFehler, verbinden as tcpVerbinden } from './leitung.ts'

export type SmtpZugang = {
  host: string
  port: number
  sicherheit: 'ssl' | 'starttls'
  benutzer: string
  passwort: string
}

/**
 * anmeldung → Postfach auf „fehler“ · limit → Pause bis morgen · drossel → Pause 1 Stunde (Gmail 4.7.28 u. ä.) ·
 * empfaenger → Adresse sperren · abgelehnt → Inhalt/Ruf (5.7.x) · voruebergehend → später erneut · sonstiges
 */
export type VersandFehlerArt = 'anmeldung' | 'limit' | 'drossel' | 'empfaenger' | 'abgelehnt' | 'voruebergehend' | 'sonstiges'
export type VersandErgebnis = { ok: true; antwort: string } | { ok: false; art: VersandFehlerArt; fehler: string; code?: number }

type Antwort = { code: number; text: string; zeilen: string[] }

class SmtpFehler extends Error {
  constructor(
    readonly schritt: string,
    readonly antwort: Antwort,
  ) {
    super(`${schritt}: ${antwort.code} ${antwort.text}`)
  }
}

async function lesen(l: Leitung, zeitMs?: number): Promise<Antwort> {
  const zeilen: string[] = []
  for (;;) {
    const z = await l.zeile(zeitMs)
    zeilen.push(z)
    if (!/^\d{3}-/.test(z)) break
  }
  const letzte = zeilen[zeilen.length - 1] ?? ''
  const code = Number(letzte.slice(0, 3)) || 0
  return { code, text: zeilen.map((z) => z.slice(4)).join(' ').trim(), zeilen }
}

async function befehl(l: Leitung, zeile: string, erwartet: number[], schritt: string, zeitMs?: number): Promise<Antwort> {
  await l.schreiben(`${zeile}\r\n`)
  const a = await lesen(l, zeitMs)
  if (!erwartet.includes(a.code)) throw new SmtpFehler(schritt, a)
  return a
}

const b64 = (s: string) => {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

/** Fehlerart aus SMTP-Code, Schritt und Text (RFC 3463 erweiterte Codes). */
export function fehlerArt(code: number, text: string, schritt: string): VersandFehlerArt {
  const t = text.toLowerCase()
  if (schritt === 'anmeldung' || code === 535 || code === 534 || (code === 530 && /auth/.test(t))) return 'anmeldung'
  if (/4\.7\.28|unusual rate|rate limit|too many (messages|connections)|try again later/.test(t) && code >= 400 && code < 500) return 'drossel'
  if (/5\.4\.5|daily (user )?sending (quota|limit)|quota exceeded|sending limit|limit exceeded/.test(t)) return 'limit'
  if (schritt === 'empfaenger' && code >= 550 && /5\.1\.\d|user unknown|no such user|does not exist|recipient (address )?rejected|mailbox unavailable|invalid (recipient|address)/.test(t))
    return 'empfaenger'
  if (code >= 500 && /5\.7\.\d|spam|policy|blocked|reputation|rejected/.test(t)) return 'abgelehnt'
  if (code >= 400 && code < 500) return 'voruebergehend'
  return 'sonstiges'
}

type Optionen = {
  ehlo?: string
  /** Für Tests: eigene Verbindung (Attrappen-Server ohne TLS) */
  verbindung?: () => Promise<Deno.Conn>
  zeitMs?: number
}

async function oeffnen(z: SmtpZugang, o: Optionen): Promise<{ l: Leitung; faehigkeiten: string[] }> {
  const conn = o.verbindung ? await o.verbindung() : await tcpVerbinden(z.host, z.port, z.sicherheit === 'ssl')
  const l = new Leitung(conn, o.zeitMs ?? 20_000)
  // Scheitert der Aufbau (z. B. Anmeldung), die Verbindung sofort schließen – sonst wartet der Server bis zum Zeitlimit
  try {
    return await anmelden(z, o, l)
  } catch (e) {
    l.schliessen()
    throw e
  }
}

async function anmelden(z: SmtpZugang, o: Optionen, l: Leitung): Promise<{ l: Leitung; faehigkeiten: string[] }> {
  const gruss = await lesen(l)
  if (gruss.code !== 220) throw new SmtpFehler('verbindung', gruss)
  const ehlo = o.ehlo ?? 'localhost'
  let e = await befehl(l, `EHLO ${ehlo}`, [250], 'ehlo')
  if (z.sicherheit === 'starttls' && !o.verbindung) {
    await befehl(l, 'STARTTLS', [220], 'starttls')
    l.tauschen(await Deno.startTls(l.conn as Deno.TcpConn, { hostname: z.host }))
    e = await befehl(l, `EHLO ${ehlo}`, [250], 'ehlo')
  }
  const faehigkeiten = e.zeilen.map((x) => x.slice(4).toUpperCase())
  const auth = faehigkeiten.find((f) => f.startsWith('AUTH')) ?? 'AUTH PLAIN'
  const pass = z.passwort.replace(/\s+/g, '')
  try {
    if (/\bPLAIN\b/.test(auth)) {
      await befehl(l, `AUTH PLAIN ${b64(`\u0000${z.benutzer}\u0000${pass}`)}`, [235], 'anmeldung')
    } else {
      await befehl(l, 'AUTH LOGIN', [334], 'anmeldung')
      await befehl(l, b64(z.benutzer), [334], 'anmeldung')
      await befehl(l, b64(pass), [235], 'anmeldung')
    }
  } catch (e) {
    if (e instanceof SmtpFehler) throw new SmtpFehler('anmeldung', e.antwort)
    throw e
  }
  return { l, faehigkeiten }
}

function ergebnisAusFehler(e: unknown): VersandErgebnis {
  if (e instanceof SmtpFehler) {
    return { ok: false, art: fehlerArt(e.antwort.code, e.antwort.text, e.schritt), fehler: e.message.slice(0, 500), code: e.antwort.code }
  }
  if (e instanceof LeitungsFehler) return { ok: false, art: 'voruebergehend', fehler: e.message.slice(0, 500) }
  return { ok: false, art: 'sonstiges', fehler: String((e as Error)?.message ?? e).slice(0, 500) }
}

/** Punkt am Zeilenanfang verdoppeln (RFC 5321 § 4.5.2), Zeilenenden als CRLF, Abschluss mit „.“. */
export function punktieren(roh: string): string {
  const text = roh.replace(/\r?\n/g, '\r\n')
  const gestopft = text.replace(/(^|\r\n)\./g, '$1..')
  return `${gestopft.endsWith('\r\n') ? gestopft : `${gestopft}\r\n`}.\r\n`
}

/** Eine fertige Nachricht (mime.ts) an genau einen Empfänger senden. Fehler werden eingeordnet zurückgegeben. */
export async function smtpSenden(
  z: SmtpZugang,
  umschlag: { von: string; an: string },
  roh: string,
  o: Optionen = {},
): Promise<VersandErgebnis> {
  let l: Leitung | null = null
  try {
    l = (await oeffnen(z, o)).l
    await befehl(l, `MAIL FROM:<${umschlag.von}>`, [250], 'absender')
    await befehl(l, `RCPT TO:<${umschlag.an}>`, [250, 251], 'empfaenger')
    await befehl(l, 'DATA', [354], 'daten')
    await l.schreiben(punktieren(roh))
    const fertig = await lesen(l, 60_000)
    if (fertig.code !== 250) throw new SmtpFehler('daten', fertig)
    try {
      await l.schreiben('QUIT\r\n')
    } catch {
      /* egal */
    }
    return { ok: true, antwort: fertig.text.slice(0, 300) }
  } catch (e) {
    return ergebnisAusFehler(e)
  } finally {
    l?.schliessen()
  }
}

/** „Verbindung testen“: nur Anmeldung. */
export async function smtpPruefen(z: SmtpZugang, o: Optionen = {}): Promise<VersandErgebnis> {
  let l: Leitung | null = null
  try {
    l = (await oeffnen(z, o)).l
    try {
      await l.schreiben('QUIT\r\n')
    } catch {
      /* egal */
    }
    return { ok: true, antwort: 'Anmeldung erfolgreich' }
  } catch (e) {
    return ergebnisAusFehler(e)
  } finally {
    l?.schliessen()
  }
}
