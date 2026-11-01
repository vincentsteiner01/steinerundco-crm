// Ein Takt des Mail-Motors (jede Minute per pg_cron): MX der neuen Empfänger-Domains → fällige Mails senden → Postfächer
// abrufen (Antworten, Abwesenheit, Unzustellbar; echte Antworten aus dem Spam holen) → Prüf-Postfächer passiv auswerten.
// Kein Aufwärm-Netz: künstliche Mails/Öffnungen/„kein Spam“-Klicks führen seit 09/2026 auf die Heatwave-Blockliste
// (Recherche 02). Die Datenbank kommt als Schnittstelle herein (index.ts: Supabase; motor_test.ts: Attrappe).
import PostalMime from 'npm:postal-mime@2.4.4'
import { einordnen, type Einordnung, messageIds } from './einordnen.ts'
import { ImapClient, type ImapZugang, seitDatum } from './imap.ts'
import { mimeBauen } from './mime.ts'
import { mxAbfragen, type MxKlasse } from './mx.ts'
import { smtpSenden, type SmtpZugang, type VersandErgebnis } from './smtp.ts'

export type Auftrag = {
  art: 'kampagne' | 'einzeln' | 'platzierung'
  id: string
  postfach_id: string
  von: string
  von_name: string
  an: string
  an_name: string | null
  betreff: string
  text: string
  message_id: string
  in_reply_to: string | null
  references: string | null
  kopf: Record<string, string>
}

export type Zugang = {
  id: string
  adresse: string
  rolle: 'versand' | 'saat'
  smtp_host: string | null
  smtp_port: number | null
  smtp_sicherheit: 'ssl' | 'starttls' | null
  imap_host: string
  imap_port: number
  benutzer: string
  passwort: string
  abruf_stand: AbrufStand
}

type OrdnerStand = { pfad: string; validity: string; uid: number }
export type AbrufStand = { posteingang?: OrdnerStand; spam?: OrdnerStand }
export type Ordner = 'posteingang' | 'spam'

export type EingangPosten = {
  ordner: Ordner
  uid: number
  message_id: string | null
  bezug: string[]
  von: string
  von_name: string | null
  betreff: string
  datum: string | null
  einordnung: Einordnung
}
export type Aktion = { ordner: Ordner; uid: number; aktion: 'retten' | 'nichts' }

export interface MotorDb {
  mxOffen(max: number): Promise<string[]>
  mxSetzen(eintraege: { domain: string; klasse: MxKlasse; hosts: string[] }[]): Promise<void>
  auftraege(max: number): Promise<Auftrag[]>
  zugang(postfachId: string): Promise<Zugang | null>
  ergebnis(a: Auftrag, r: VersandErgebnis): Promise<void>
  abrufListe(max: number): Promise<string[]>
  eingang(postfachId: string, posten: EingangPosten[], stand: AbrufStand): Promise<Aktion[]>
  abrufFehler(postfachId: string, fehler: string, anmeldung: boolean): Promise<void>
  platzierungOffen(postfachId: string): Promise<string[]>
  platzierungMelden(postfachId: string, funde: { message_id: string; ordner: Ordner }[]): Promise<void>
}

export type Werkzeuge = {
  senden: typeof smtpSenden
  imap: (z: ImapZugang) => ImapClient
  mx: typeof mxAbfragen
}

const STANDARD: Werkzeuge = { senden: smtpSenden, imap: (z) => new ImapClient(z), mx: mxAbfragen }

const MAX_JE_ORDNER = 15
const QUELLE_MAX = 40_000

/** Kleine Parallelität (Promise-Pool). */
async function parallel<T>(liste: T[], n: number, f: (x: T) => Promise<void>): Promise<void> {
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(n, liste.length) }, async () => {
      while (i < liste.length) {
        const x = liste[i++] as T
        try {
          await f(x)
        } catch (e) {
          console.error('Motor-Schritt fehlgeschlagen', String((e as Error)?.message ?? e).slice(0, 300))
        }
      }
    }),
  )
}

/** Eine Mail des Abrufs lesen und einordnen. */
export async function postenAus(ordner: Ordner, uid: number, datum: string | null, quelle: Uint8Array, heute: Date): Promise<EingangPosten> {
  const roh = new TextDecoder().decode(quelle)
  const p = await PostalMime.parse(roh)
  const kopf: Record<string, string> = {}
  for (const h of p.headers ?? []) kopf[h.key] = kopf[h.key] ? `${kopf[h.key]} ${h.value}` : h.value
  const von = (p.from?.address ?? '').toLowerCase()
  const text = p.text ?? (p.html ? p.html.replace(/<style[\s\S]*?<\/style>|<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ') : '')
  const e = einordnen({ von, vonName: p.from?.name ?? null, betreff: p.subject ?? '', kopf, text, roh: roh.slice(0, 40_000) }, heute)
  return {
    ordner,
    uid,
    message_id: (p.messageId ?? '').toLowerCase() || null,
    bezug: e.bezug.length ? e.bezug : messageIds(p.inReplyTo, p.references),
    von,
    von_name: p.from?.name ?? null,
    betreff: (p.subject ?? '').slice(0, 300),
    datum: datum ?? (p.date ? new Date(p.date).toISOString() : null),
    einordnung: e,
  }
}

/** Ein Versand-Postfach abgleichen: neue Mails in Posteingang und Spam lesen (nur PEEK), DB entscheiden lassen, echte
 *  Antworten aus dem Spam in den Posteingang holen. */
export async function abgleichen(
  c: ImapClient,
  alt: AbrufStand,
  entscheiden: (posten: EingangPosten[], stand: AbrufStand) => Promise<Aktion[]>,
  heute: Date,
): Promise<{ stand: AbrufStand; gelesen: number; gerettet: number }> {
  await c.verbinden()
  try {
    const so = await c.sonderordner()
    const stand: AbrufStand = { ...alt }
    const posten: EingangPosten[] = []
    for (const [ordner, pfad] of [['posteingang', 'INBOX'], ['spam', so.spam]] as [Ordner, string | null][]) {
      if (!pfad) continue
      const box = await c.examine(pfad)
      const vorher = alt[ordner]
      const ab = vorher && vorher.validity === box.validity && vorher.pfad === pfad ? vorher.uid + 1 : Math.max(1, box.uidNext - 30)
      const neu: OrdnerStand = { pfad, validity: box.validity, uid: Math.max(ab - 1, 0) }
      if (!box.uidNext || box.uidNext > ab) {
        const uids = (await c.uidSuche(`UID ${ab}:*`)).filter((u) => u >= ab).sort((a, b) => a - b).slice(0, MAX_JE_ORDNER)
        if (uids.length) {
          neu.uid = uids[uids.length - 1]!
          for (const m of await c.holen(uids, QUELLE_MAX)) {
            try {
              posten.push(await postenAus(ordner, m.uid, m.datum, m.quelle, heute))
            } catch (e) {
              console.error('Mail nicht lesbar', ordner, m.uid, String(e).slice(0, 200))
            }
          }
        }
      }
      stand[ordner] = neu
    }
    const aktionen = await entscheiden(posten, stand)
    const retten = aktionen.filter((a) => a.aktion === 'retten' && a.ordner === 'spam')
    let gerettet = 0
    if (retten.length && so.spam) {
      await c.select(so.spam)
      for (const a of retten) if (await c.verschieben(a.uid, 'INBOX')) gerettet++
    }
    return { stand, gelesen: posten.length, gerettet }
  } finally {
    await c.abmelden()
  }
}

/** Prüf-Postfach (rolle „saat“): wo liegen die gesuchten Test-Mails? Nur lesen – nichts markieren, nichts verschieben
 *  (ein aktives Prüf-Panel wäre genau das Heatwave-Muster). */
export async function platzierungLesen(c: ImapClient, gesucht: string[], heute: Date): Promise<{ message_id: string; ordner: Ordner }[]> {
  const offen = new Set(gesucht.map((x) => x.toLowerCase()))
  const funde: { message_id: string; ordner: Ordner }[] = []
  await c.verbinden()
  try {
    const so = await c.sonderordner()
    const seit = new Date(heute.getTime() - 2 * 86_400_000)
    for (const [ordner, pfad] of [['posteingang', 'INBOX'], ['spam', so.spam]] as [Ordner, string | null][]) {
      if (!pfad || !offen.size) continue
      await c.examine(pfad)
      const uids = (await c.uidSuche(`SINCE ${seitDatum(seit)}`)).sort((a, b) => a - b).slice(-200)
      for (const [, id] of await c.messageIds(uids)) {
        if (offen.has(id)) {
          funde.push({ message_id: id, ordner })
          offen.delete(id)
        }
      }
    }
    return funde
  } finally {
    await c.abmelden()
  }
}

export type Bilanz = { mx: number; gesendet: number; fehler: number; abgerufen: number; gelesen: number; gerettet: number; platziert: number }

/** Ein Takt. `budgetMs`: danach keine neuen Schritte mehr anfangen (Edge-Limit 150 s). */
export async function takt(db: MotorDb, o: { heute?: Date; budgetMs?: number; werkzeuge?: Partial<Werkzeuge> } = {}): Promise<Bilanz> {
  const w = { ...STANDARD, ...o.werkzeuge }
  const start = Date.now()
  const budget = o.budgetMs ?? 100_000
  const zeitDa = () => Date.now() - start < budget
  const heute = o.heute ?? new Date()
  const b: Bilanz = { mx: 0, gesendet: 0, fehler: 0, abgerufen: 0, gelesen: 0, gerettet: 0, platziert: 0 }

  // 1) MX neuer Empfänger-Domains (vor dem Versand – ohne Klasse wird nicht gesendet)
  const domains = await db.mxOffen(30)
  const gefunden: { domain: string; klasse: MxKlasse; hosts: string[] }[] = []
  await parallel(domains, 6, async (d) => {
    const r = await w.mx(d)
    if (r) gefunden.push({ domain: d, ...r })
  })
  if (gefunden.length) await db.mxSetzen(gefunden)
  b.mx = gefunden.length

  // 2) Versand: je Postfach höchstens ein Auftrag pro Takt (Abstand regelt die Datenbank)
  if (zeitDa()) {
    const auftraege = await db.auftraege(8)
    await parallel(auftraege, 4, async (a) => {
      const z = await db.zugang(a.postfach_id)
      if (!z?.smtp_host || !z.smtp_port || !z.smtp_sicherheit) {
        await db.ergebnis(a, { ok: false, art: 'anmeldung', fehler: 'Kein SMTP-Zugang hinterlegt' })
        b.fehler++
        return
      }
      const roh = mimeBauen({
        von: { adresse: a.von, name: a.von_name },
        an: { adresse: a.an, name: a.an_name },
        betreff: a.betreff,
        text: a.text,
        messageId: a.message_id,
        inReplyTo: a.in_reply_to,
        references: a.references,
        kopf: a.kopf,
        datum: new Date(),
      })
      const smtp: SmtpZugang = { host: z.smtp_host, port: z.smtp_port, sicherheit: z.smtp_sicherheit, benutzer: z.benutzer, passwort: z.passwort }
      const r = await w.senden(smtp, { von: a.von, an: a.an }, roh, { ehlo: a.von.split('@')[1] })
      await db.ergebnis(a, r)
      if (r.ok) b.gesendet++
      else b.fehler++
    })
  }

  // 3) Abruf: Versand-Postfächer abgleichen, Prüf-Postfächer passiv auswerten
  if (zeitDa()) {
    const liste = await db.abrufListe(3)
    await parallel(liste, 3, async (id) => {
      if (!zeitDa()) return
      const z = await db.zugang(id)
      if (!z) return
      const imap: ImapZugang = { host: z.imap_host, port: z.imap_port, benutzer: z.benutzer, passwort: z.passwort }
      try {
        if (z.rolle === 'saat') {
          const gesucht = await db.platzierungOffen(id)
          const funde = gesucht.length ? await platzierungLesen(w.imap(imap), gesucht, heute) : []
          await db.platzierungMelden(id, funde)
          b.platziert += funde.length
        } else {
          const r = await abgleichen(w.imap(imap), z.abruf_stand ?? {}, (posten, stand) => db.eingang(id, posten, stand), heute)
          b.gelesen += r.gelesen
          b.gerettet += r.gerettet
        }
        b.abgerufen++
      } catch (e) {
        const err = e as { message?: unknown; anmeldung?: unknown }
        await db.abrufFehler(id, String(err.message ?? e).slice(0, 400), err.anmeldung === true)
      }
    })
  }
  return b
}
