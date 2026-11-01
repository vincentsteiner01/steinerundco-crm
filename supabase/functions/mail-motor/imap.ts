// Schlanker IMAP-Client (Mail-Motor, 01.11.2026) über Deno.connectTls auf Port 993 – nur, was der Motor braucht:
// LOGIN · LIST (Sonderordner \Junk/\Sent) · EXAMINE (nur lesen) · UID SEARCH · UID FETCH (Teil der Quelle, PEEK = bleibt
// ungelesen) · UID MOVE (echte Antworten aus dem Spam holen) · LOGOUT. imapflow hatte laut Recherche 04-technik in der
// Edge Runtime Abbrüche; rohes TLS läuft dort nachweislich. Getestet in imap_test.ts gegen einen Attrappen-Server.
import { Leitung, LeitungsFehler, verbinden as tcpVerbinden } from './leitung.ts'

export type ImapZugang = { host: string; port: number; benutzer: string; passwort: string }

export class ImapFehler extends Error {
  constructor(
    message: string,
    readonly anmeldung = false,
  ) {
    super(message)
  }
}

/** Eine Server-Antwortzeile samt eingebetteter Literale ({n}-Blöcke). */
type Teil = { text: string; literale: Uint8Array[] }

export type Ordner = { pfad: string; flags: string[] }
export type BoxStand = { validity: string; uidNext: number; anzahl: number }
export type Abgeholt = { uid: number; datum: string | null; quelle: Uint8Array }

const dec = new TextDecoder()

/** Mailbox-Namen für Befehle quoten. */
export function quote(s: string): string {
  return `"${s.replace(/(["\\])/g, '\\$1')}"`
}

/** „* LIST (\HasNoChildren \Junk) "/" "[Gmail]/Spam"“ → { pfad, flags } (auch Atom- und Literal-Namen). */
export function listeLesen(t: Teil): Ordner | null {
  const m = /^\* (?:LIST|XLIST) \(([^)]*)\) (?:"(?:[^"\\]|\\.)*"|NIL) (.*)$/i.exec(t.text)
  if (!m) return null
  const flags = (m[1] ?? '').split(/\s+/).filter(Boolean)
  const rest = (m[2] ?? '').trim()
  let pfad: string
  if (rest.startsWith('"')) pfad = rest.slice(1, rest.lastIndexOf('"')).replace(/\\(["\\])/g, '$1')
  else if (/^\{\d+\}$/.test(rest) && t.literale[0]) pfad = dec.decode(t.literale[0])
  else pfad = rest
  return { pfad, flags }
}

export class ImapClient {
  private l: Leitung | null = null
  private nr = 0
  faehigkeiten: string[] = []

  constructor(
    private z: ImapZugang,
    private o: { verbindung?: () => Promise<Deno.Conn>; zeitMs?: number } = {},
  ) {}

  /** Eine Antwortzeile lesen – mit Literalen: „… {123}“ + 123 Bytes + Fortsetzung der Zeile. */
  private async teil(): Promise<Teil> {
    const l = this.l!
    let text = await l.zeile()
    const literale: Uint8Array[] = []
    for (;;) {
      const m = /\{(\d+)\+?\}$/.exec(text)
      if (!m) break
      literale.push(await l.bytes(Number(m[1])))
      text += await l.zeile()
    }
    return { text, literale }
  }

  /** Befehl senden, alle unmarkierten Antworten bis zur markierten Zeile sammeln. */
  async befehl(cmd: string): Promise<{ status: string; text: string; teile: Teil[] }> {
    if (!this.l) throw new ImapFehler('Nicht verbunden')
    const tag = `A${String(++this.nr).padStart(3, '0')}`
    await this.l.schreiben(`${tag} ${cmd}\r\n`)
    const teile: Teil[] = []
    for (;;) {
      const t = await this.teil()
      if (t.text.startsWith(`${tag} `)) {
        const [, status = '', text = ''] = /^\S+ (\w+) ?(.*)$/.exec(t.text) ?? []
        return { status: status.toUpperCase(), text, teile }
      }
      teile.push(t)
    }
  }

  private async ok(cmd: string, was: string) {
    const r = await this.befehl(cmd)
    if (r.status !== 'OK') throw new ImapFehler(`${was}: ${r.status} ${r.text}`.slice(0, 400))
    return r
  }

  async verbinden(): Promise<void> {
    const conn = this.o.verbindung ? await this.o.verbindung() : await tcpVerbinden(this.z.host, this.z.port, true)
    this.l = new Leitung(conn, this.o.zeitMs ?? 25_000)
    try {
      const gruss = await this.teil()
      if (!/^\* (OK|PREAUTH)/i.test(gruss.text)) throw new ImapFehler(`Unerwartete Begrüßung: ${gruss.text.slice(0, 200)}`)
      const pass = this.z.passwort.replace(/\s+/g, '')
      const r = await this.befehl(`LOGIN ${quote(this.z.benutzer)} ${quote(pass)}`)
      if (r.status !== 'OK') throw new ImapFehler(`Anmeldung abgelehnt: ${r.text}`.slice(0, 400), true)
      const capIn = /\[CAPABILITY ([^\]]+)\]/i.exec(r.text)?.[1]
      if (capIn) this.faehigkeiten = capIn.toUpperCase().split(/\s+/)
      else {
        const c = await this.ok('CAPABILITY', 'CAPABILITY')
        this.faehigkeiten = (c.teile.find((t) => /^\* CAPABILITY /i.test(t.text))?.text.slice(13) ?? '').toUpperCase().split(/\s+/)
      }
    } catch (e) {
      this.schliessen()
      throw e
    }
  }

  async ordner(): Promise<Ordner[]> {
    const mitSpecial = this.faehigkeiten.includes('SPECIAL-USE') && this.faehigkeiten.includes('LIST-EXTENDED')
    const r = await this.ok(mitSpecial ? 'LIST "" "*" RETURN (SPECIAL-USE)' : 'LIST "" "*"', 'LIST')
    return r.teile.map(listeLesen).filter((x): x is Ordner => !!x)
  }

  /** Spam- und Gesendet-Ordner über SPECIAL-USE, sonst über übliche Namen (Gmail: „[Gmail]/Spam“ oder „[Google Mail]/Spam“). */
  async sonderordner(): Promise<{ spam: string | null; gesendet: string | null }> {
    const liste = await this.ordner()
    const finde = (flag: string, namen: RegExp) =>
      liste.find((o) => o.flags.some((f) => f.toLowerCase() === flag.toLowerCase()))?.pfad ??
      liste.find((o) => namen.test(o.pfad.split(/[/.]/).pop() ?? o.pfad))?.pfad ??
      null
    return {
      spam: finde('\\Junk', /^(spam|junk|junk-e-mail|junk e-mail|spamverdacht|unerwünscht|bulk mail)$/i),
      gesendet: finde('\\Sent', /^(sent|gesendet|gesendete (objekte|elemente)|sent items|sent messages)$/i),
    }
  }

  private async oeffnen(pfad: string, schreiben: boolean): Promise<BoxStand> {
    const r = await this.ok(`${schreiben ? 'SELECT' : 'EXAMINE'} ${quote(pfad)}`, schreiben ? 'SELECT' : 'EXAMINE')
    const alles = [r.text, ...r.teile.map((t) => t.text)].join('\n')
    return {
      validity: /\[UIDVALIDITY (\d+)\]/i.exec(alles)?.[1] ?? '0',
      uidNext: Number(/\[UIDNEXT (\d+)\]/i.exec(alles)?.[1] ?? 0),
      anzahl: Number(/^\* (\d+) EXISTS/im.exec(alles)?.[1] ?? 0),
    }
  }

  /** Nur lesen (EXAMINE) – Flags bleiben unverändert. */
  examine(pfad: string) {
    return this.oeffnen(pfad, false)
  }

  select(pfad: string) {
    return this.oeffnen(pfad, true)
  }

  async uidSuche(kriterium: string): Promise<number[]> {
    const r = await this.ok(`UID SEARCH ${kriterium}`, 'SEARCH')
    const zeile = r.teile.find((t) => /^\* SEARCH\b/i.test(t.text))?.text ?? ''
    return zeile
      .slice(8)
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(Number)
      .filter((n) => Number.isFinite(n) && n > 0)
  }

  /** Quelle (bis maxBytes) der UIDs holen – PEEK, also ohne \Seen. */
  async holen(uids: number[], maxBytes = 60_000): Promise<Abgeholt[]> {
    if (!uids.length) return []
    const r = await this.ok(`UID FETCH ${uids.join(',')} (UID INTERNALDATE BODY.PEEK[]<0.${maxBytes}>)`, 'FETCH')
    const raus: Abgeholt[] = []
    for (const t of r.teile) {
      if (!/^\* \d+ FETCH /i.test(t.text)) continue
      const uid = Number(/\bUID (\d+)/i.exec(t.text)?.[1] ?? 0)
      if (!uid) continue
      const datum = /INTERNALDATE "([^"]+)"/i.exec(t.text)?.[1] ?? null
      raus.push({ uid, datum: datum ? imapDatum(datum) : null, quelle: t.literale[0] ?? new Uint8Array(0) })
    }
    return raus
  }

  /** Nur die Message-ID-Kopfzeilen (für Platzierungstests). */
  async messageIds(uids: number[]): Promise<Map<number, string>> {
    const m = new Map<number, string>()
    if (!uids.length) return m
    const r = await this.ok(`UID FETCH ${uids.join(',')} (UID BODY.PEEK[HEADER.FIELDS (MESSAGE-ID)])`, 'FETCH')
    for (const t of r.teile) {
      const uid = Number(/\bUID (\d+)/i.exec(t.text)?.[1] ?? 0)
      const kopf = t.literale[0] ? dec.decode(t.literale[0]) : ''
      const id = /message-id:\s*(<[^>\s]+>)/i.exec(kopf)?.[1]
      if (uid && id) m.set(uid, id.toLowerCase())
    }
    return m
  }

  /** In einen anderen Ordner verschieben (MOVE, sonst COPY + \Deleted + UID EXPUNGE; ohne UIDPLUS lieber gar nicht). */
  async verschieben(uid: number, ziel: string): Promise<boolean> {
    if (this.faehigkeiten.includes('MOVE')) {
      await this.ok(`UID MOVE ${uid} ${quote(ziel)}`, 'MOVE')
      return true
    }
    if (!this.faehigkeiten.includes('UIDPLUS')) return false
    await this.ok(`UID COPY ${uid} ${quote(ziel)}`, 'COPY')
    await this.ok(`UID STORE ${uid} +FLAGS.SILENT (\\Deleted)`, 'STORE')
    await this.ok(`UID EXPUNGE ${uid}`, 'EXPUNGE')
    return true
  }

  async abmelden(): Promise<void> {
    try {
      if (this.l) await this.befehl('LOGOUT')
    } catch {
      /* egal */
    } finally {
      this.schliessen()
    }
  }

  schliessen() {
    this.l?.schliessen()
    this.l = null
  }
}

const MONAT: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
}

/** IMAP-Datum „01-Nov-2026 10:00:00 +0100“ → ISO. */
export function imapDatum(s: string): string | null {
  const m = /^\s*(\d{1,2})-(\w{3})-(\d{4}) (\d{2}):(\d{2}):(\d{2}) ([+-]\d{4})/.exec(s)
  if (!m) return null
  const iso = `${m[3]}-${MONAT[m[2]!.toLowerCase()] ?? '01'}-${m[1]!.padStart(2, '0')}T${m[4]}:${m[5]}:${m[6]}${m[7]!.slice(0, 3)}:${m[7]!.slice(3)}`
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** IMAP-SINCE-Datum („1-Nov-2026“). */
export function seitDatum(d: Date): string {
  const n = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]
  return `${d.getUTCDate()}-${n}-${d.getUTCFullYear()}`
}

/** „Verbindung testen“ (IMAP-Teil). */
export async function imapPruefen(z: ImapZugang): Promise<{ ok: boolean; fehler?: string; anmeldung?: boolean; spam?: string | null; gesendet?: string | null }> {
  const c = new ImapClient(z)
  try {
    await c.verbinden()
    const so = await c.sonderordner()
    return { ok: true, ...so }
  } catch (e) {
    if (e instanceof ImapFehler) return { ok: false, fehler: e.message, anmeldung: e.anmeldung }
    if (e instanceof LeitungsFehler) return { ok: false, fehler: e.message }
    return { ok: false, fehler: String((e as Error)?.message ?? e).slice(0, 400) }
  } finally {
    await c.abmelden()
  }
}
