// Nachricht nach RFC 5322 bauen (Mail-Motor, 01.11.2026): reiner Text in UTF-8, quoted-printable, Kopfzeilen mit
// RFC-2047-Kodierung für Umlaute. Bewusst schlicht – kein HTML, keine Bilder, kein Tracking, kein X-Mailer (Recherche
// 02-zustellbarkeit: Plain Text, erste Mail ohne Link). Getestet in mime_test.ts (Rundreise über postal-mime).

export type Adresse = { adresse: string; name?: string | null }

export type MimeEingabe = {
  von: Adresse
  an: Adresse
  betreff: string
  text: string
  /** mit spitzen Klammern */
  messageId: string
  inReplyTo?: string | null
  /** Message-IDs des Verlaufs, durch Leerzeichen getrennt */
  references?: string | null
  /** weitere Kopfzeilen (List-Unsubscribe …), nur ASCII */
  kopf?: Record<string, string>
  datum?: Date
}

const enc = new TextEncoder()
const NUR_ASCII = /^[\x20-\x7e]*$/

function base64(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

/** RFC 2047: Wörter mit Nicht-ASCII als =?UTF-8?B?…?= in Stücken ≤ 30 Bytes (keine Zeichen zerteilen) – so bleibt auch
 * „Subject: “ + erstes Wort unter 78 Zeichen. */
export function kodiereWort(s: string): string {
  if (NUR_ASCII.test(s)) return s
  const teile: string[] = []
  let stueck = ''
  for (const z of s) {
    if (enc.encode(stueck + z).length > 30) {
      teile.push(stueck)
      stueck = ''
    }
    stueck += z
  }
  if (stueck) teile.push(stueck)
  return teile.map((t) => `=?UTF-8?B?${base64(enc.encode(t))}?=`).join('\r\n ')
}

/** „Name <adresse>“ – Name in Anführungszeichen, wenn er Sonderzeichen enthält, kodiert bei Umlauten. */
export function adressKopf(a: Adresse): string {
  const name = (a.name ?? '').replace(/[\r\n]+/g, ' ').trim()
  if (!name) return a.adresse
  // kodierter Name: Adresse in eine Folgezeile falten (Zeilen bleiben unter 78 Zeichen)
  if (!NUR_ASCII.test(name)) return `${kodiereWort(name)}\r\n <${a.adresse}>`
  if (/[(),.:;<>@[\\\]"]/.test(name)) return `"${name.replace(/(["\\])/g, '\\$1')}" <${a.adresse}>`
  return `${name} <${a.adresse}>`
}

const TAGE = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const MONATE = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** Datum in Berliner Zeit mit Versatz („Mon, 2 Nov 2026 09:14:05 +0100“), wie es ein Mailprogramm in Köln schreibt. */
export function datumKopf(d: Date = new Date()): string {
  const teile = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Berlin',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>
  const lokal = Date.UTC(+teile.year!, +teile.month! - 1, +teile.day!, +teile.hour!, +teile.minute!, +teile.second!)
  const versatzMin = Math.round((lokal - Math.floor(d.getTime() / 1000) * 1000) / 60_000)
  const vz = versatzMin >= 0 ? '+' : '-'
  const abs = Math.abs(versatzMin)
  const versatz = `${vz}${String(Math.floor(abs / 60)).padStart(2, '0')}${String(abs % 60).padStart(2, '0')}`
  const l = new Date(lokal)
  const zwei = (n: number) => String(n).padStart(2, '0')
  return `${TAGE[l.getUTCDay()]}, ${l.getUTCDate()} ${MONATE[l.getUTCMonth()]} ${l.getUTCFullYear()} ${zwei(l.getUTCHours())}:${zwei(l.getUTCMinutes())}:${zwei(l.getUTCSeconds())} ${versatz}`
}

/** Quoted-printable (RFC 2045) mit weichen Umbrüchen nach höchstens 76 Zeichen; Zeilenenden als CRLF. */
export function quotedPrintable(text: string): string {
  const zeilen = text.replace(/\r\n?/g, '\n').split('\n')
  const raus: string[] = []
  for (const zeile of zeilen) {
    const bytes = enc.encode(zeile)
    const zeichen: string[] = []
    bytes.forEach((b, i) => {
      const amEnde = i === bytes.length - 1
      if ((b === 0x20 || b === 0x09) && amEnde) zeichen.push(`=${b.toString(16).toUpperCase().padStart(2, '0')}`)
      else if ((b >= 33 && b <= 126 && b !== 61) || b === 0x20 || b === 0x09) zeichen.push(String.fromCharCode(b))
      else zeichen.push(`=${b.toString(16).toUpperCase().padStart(2, '0')}`)
    })
    let akt = ''
    for (const z of zeichen) {
      if (akt.length + z.length > 75) {
        raus.push(`${akt}=`)
        akt = ''
      }
      akt += z
    }
    raus.push(akt)
  }
  return raus.join('\r\n')
}

/** Lange Message-ID-Listen falten (jede Zeile < 998 Zeichen, hier großzügig je ID eine Zeile). */
function falteIds(ids: string): string {
  return ids.trim().split(/\s+/).filter(Boolean).join('\r\n ')
}

const NAME_OK = /^[A-Za-z][A-Za-z0-9-]{0,60}$/

/** Komplette Nachricht (Kopf + leere Zeile + Text) mit CRLF. */
export function mimeBauen(e: MimeEingabe): string {
  const kopf: string[] = [
    `Date: ${datumKopf(e.datum)}`,
    `From: ${adressKopf(e.von)}`,
    `To: ${adressKopf(e.an)}`,
    `Subject: ${kodiereWort(e.betreff.replace(/[\r\n]+/g, ' ').trim())}`,
    `Message-ID: ${e.messageId}`,
  ]
  if (e.inReplyTo) kopf.push(`In-Reply-To: ${e.inReplyTo}`)
  if (e.references?.trim()) kopf.push(`References: ${falteIds(e.references)}`)
  for (const [k, v] of Object.entries(e.kopf ?? {})) {
    if (NAME_OK.test(k) && NUR_ASCII.test(v)) kopf.push(`${k}: ${v}`)
  }
  kopf.push('MIME-Version: 1.0', 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: quoted-printable')
  return `${kopf.join('\r\n')}\r\n\r\n${quotedPrintable(e.text)}\r\n`
}
