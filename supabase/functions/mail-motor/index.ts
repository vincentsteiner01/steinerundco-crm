// Edge Function mail-motor – Versand, Abruf und Prüfungen der E-Mail-Kampagnen (Migrationen 21/22, 01.11.2026).
//
// Vertrag
//   POST /functions/v1/mail-motor            Takt (pg_cron jede Minute): Kopf x-motor = Schlüssel aus dem Vault (crm_mail_motor).
//                                            Antwortet sofort 202, gearbeitet wird im Hintergrund (EdgeRuntime.waitUntil).
//   POST /functions/v1/mail-motor/test       „Verbindung testen“ aus dem CRM (Authorization: Bearer <Nutzer-JWT>), Body { postfach_id }
//                                            → SMTP-Anmeldung + IMAP-Anmeldung + Sonderordner; Ergebnis in mail_postfaecher.test_ergebnis
//   POST /functions/v1/mail-motor/testmail   (Nutzer-JWT) Body { postfach_id, an } – eine kurze Testmail sofort senden
//   POST /functions/v1/mail-motor/abmelden?t=<token>   One-Click-Abmeldung (RFC 8058, List-Unsubscribe-Post) – ohne Anmeldung
//   GET  /functions/v1/mail-motor/abmelden?t=<token>   → Weiterleitung auf die Bestätigungsseite im CRM (GET meldet nie ab:
//                                                        Link-Scanner rufen Links vorab auf; HTML liefert supabase.co ohnehin nicht)
// Deploy (ohne JWT-Prüfung – der Takt nutzt den Vault-Schlüssel, die CRM-Aufrufe werden hier selbst geprüft):
//   supabase functions deploy mail-motor --project-ref ekaqkfgvisdngsskzbai --no-verify-jwt --use-api
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3'

// deno-lint-ignore no-explicit-any
type Db = SupabaseClient<any, 'crm', 'crm'>
import { imapPruefen } from './imap.ts'
import { mimeBauen } from './mime.ts'
import { type AbrufStand, type Auftrag, type MotorDb, takt, type Zugang } from './motor.ts'
import { smtpPruefen, smtpSenden, type VersandErgebnis } from './smtp.ts'

const CRM = 'https://crm.steinerundco.de'
const ERLAUBTE_URSPRUENGE = [CRM, 'http://127.0.0.1:8768', 'http://localhost:8768']

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined

function cors(req: Request): Record<string, string> {
  const o = req.headers.get('origin') ?? ''
  return ERLAUBTE_URSPRUENGE.includes(o)
    ? { 'access-control-allow-origin': o, 'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info', vary: 'origin' }
    : {}
}

function antwort(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors(req) } })
}

/** Service-Schlüssel: neuer Secret Key (SUPABASE_SECRET_KEYS), sonst der klassische service_role-JWT. */
function serviceKey(): string {
  try {
    const neu = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>
    const k = neu.default ?? Object.values(neu)[0]
    if (k) return k
  } catch {
    /* fällt auf den klassischen Schlüssel zurück */
  }
  const alt = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!alt) throw new Error('Kein Service-Schlüssel in der Umgebung')
  return alt
}

/** Öffentlicher Schlüssel für Abfragen im Namen der Person (RLS greift) – nie der Service-Schlüssel. */
function anonKey(): string {
  const alt = Deno.env.get('SUPABASE_ANON_KEY')
  if (alt) return alt
  const neu = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}') as Record<string, string>
  const k = neu.default ?? Object.values(neu)[0]
  if (!k) throw new Error('Kein öffentlicher Schlüssel in der Umgebung')
  return k
}

function dienst(): Db {
  return createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    db: { schema: 'crm' },
  })
}

async function rpc<T>(db: Db, name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db.rpc(name, args)
  if (error) throw new Error(`${name}: ${error.message}`)
  return data as T
}

/** Datenbank-Schnittstelle des Motors über die crm.mail_motor_*-Funktionen (nur service_role). */
function motorDb(db: Db): MotorDb {
  return {
    mxOffen: (max) => rpc<string[]>(db, 'mail_motor_mx_offen', { p_max: max }),
    mxSetzen: async (e) => void (await rpc(db, 'mail_motor_mx_setzen', { p_eintraege: e })),
    auftraege: (max) => rpc<Auftrag[]>(db, 'mail_motor_auftraege', { p_max: max }),
    zugang: (id) => rpc<Zugang | null>(db, 'mail_motor_zugang', { p_postfach: id }),
    ergebnis: async (a: Auftrag, r: VersandErgebnis) =>
      void (await rpc(db, 'mail_motor_ergebnis', {
        p_art: a.art,
        p_id: a.id,
        p_ok: r.ok,
        p_fehlerart: r.ok ? null : r.art,
        p_fehler: r.ok ? null : r.fehler,
      })),
    abrufListe: (max) => rpc<string[]>(db, 'mail_motor_abruf_liste', { p_max: max }),
    eingang: (id, posten, stand: AbrufStand) => rpc(db, 'mail_motor_eingang', { p_postfach: id, p_posten: posten, p_stand: stand }),
    abrufFehler: async (id, fehler, anmeldung) =>
      void (await rpc(db, 'mail_motor_abruf_fehler', { p_postfach: id, p_fehler: fehler, p_anmeldung: anmeldung })),
    platzierungOffen: (id) => rpc<string[]>(db, 'mail_motor_platzierung_offen', { p_postfach: id }),
    platzierungMelden: async (id, funde) => void (await rpc(db, 'mail_motor_platzierung_melden', { p_postfach: id, p_funde: funde })),
  }
}

let schluesselCache: string | null = null

/** Zeitkonstanter Vergleich. */
function gleich(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let x = 0
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return x === 0
}

async function taktErlaubt(req: Request, db: Db): Promise<boolean> {
  const k = req.headers.get('x-motor') ?? ''
  if (k.length < 32) return false
  schluesselCache ??= await rpc<string | null>(db, 'mail_motor_schluessel')
  return !!schluesselCache && gleich(k, schluesselCache)
}

/** Angemeldetes Mitglied prüfen: sieht es das Postfach (RLS: nur Mitglieder)? */
async function mitgliedDarf(req: Request, postfachId: string): Promise<boolean> {
  const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!jwt) return false
  const nutzer = createClient(Deno.env.get('SUPABASE_URL') ?? '', anonKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    db: { schema: 'crm' },
  })
  const { data: u } = await nutzer.auth.getUser(jwt)
  if (!u?.user) return false
  const { data } = await nutzer.from('mail_postfaecher').select('id').eq('id', postfachId).maybeSingle()
  return !!data
}

async function verbindungTesten(db: Db, postfachId: string) {
  const z = await rpc<Zugang | null>(db, 'mail_motor_zugang', { p_postfach: postfachId })
  if (!z) return { ok: false, fehler: 'Postfach oder Passwort fehlt' }
  const imap = await imapPruefen({ host: z.imap_host, port: z.imap_port, benutzer: z.benutzer, passwort: z.passwort })
  let smtp: VersandErgebnis | null = null
  if (z.rolle === 'versand' && z.smtp_host && z.smtp_port && z.smtp_sicherheit) {
    smtp = await smtpPruefen(
      { host: z.smtp_host, port: z.smtp_port, sicherheit: z.smtp_sicherheit, benutzer: z.benutzer, passwort: z.passwort },
      { ehlo: z.adresse.split('@')[1] },
    )
  }
  const ok = imap.ok && (smtp === null || smtp.ok)
  const fehler = !imap.ok ? `Abruf (IMAP): ${imap.fehler}` : smtp && !smtp.ok ? `Versand (SMTP): ${smtp.fehler}` : null
  const ergebnis = { ok, fehler, imap: { ok: imap.ok, spam: imap.spam ?? null, gesendet: imap.gesendet ?? null }, smtp: smtp ? { ok: smtp.ok } : null }
  await rpc(db, 'mail_motor_test_ergebnis', { p_postfach: postfachId, p_ergebnis: ergebnis })
  return ergebnis
}

async function testmail(db: Db, postfachId: string, an: string) {
  const z = await rpc<Zugang | null>(db, 'mail_motor_zugang', { p_postfach: postfachId })
  if (!z?.smtp_host || !z.smtp_port || !z.smtp_sicherheit) return { ok: false, fehler: 'Kein SMTP-Zugang' }
  const domain = z.adresse.split('@')[1]
  const roh = mimeBauen({
    von: { adresse: z.adresse },
    an: { adresse: an },
    betreff: 'Testmail aus dem CRM',
    text: 'Diese Testmail kommt aus dem CRM von Steiner & Co.\n\nIm Original (Gmail: ⋮ → „Original anzeigen“) sollte bei SPF, DKIM und DMARC „PASS“ stehen.',
    messageId: `<${crypto.randomUUID().replace(/-/g, '')}@${domain}>`,
  })
  return await smtpSenden({ host: z.smtp_host, port: z.smtp_port, sicherheit: z.smtp_sicherheit, benutzer: z.benutzer, passwort: z.passwort },
    { von: z.adresse, an }, roh, { ehlo: domain })
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const pfad = url.pathname.replace(/^.*\/mail-motor/, '') || '/'
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors(req), 'access-control-allow-methods': 'POST, OPTIONS' } })

  // Abmelden (ohne Anmeldung, Token je Empfänger)
  if (pfad === '/abmelden') {
    const t = url.searchParams.get('t') ?? ''
    if (!/^[0-9a-f-]{36}$/i.test(t)) return new Response('Ungültiger Link', { status: 400 })
    if (req.method === 'GET') return Response.redirect(`${CRM}/abmelden#${t}`, 302)
    if (req.method !== 'POST') return new Response('Nur POST', { status: 405 })
    const ok = await rpc<boolean>(dienst(), 'mail_abmelden', { p_token: t }).catch(() => false)
    return new Response(ok ? 'Abgemeldet' : 'Unbekannter Link', { status: ok ? 200 : 404, headers: { 'content-type': 'text/plain; charset=utf-8' } })
  }

  if (req.method !== 'POST') return antwort(req, { fehler: 'Nur POST' }, 405)
  const db = dienst()

  if (pfad === '/' || pfad === '/takt') {
    if (!(await taktErlaubt(req, db))) return antwort(req, { fehler: 'Nicht erlaubt' }, 401)
    const arbeit = takt(motorDb(db))
      .then((b) => console.log('Takt', JSON.stringify(b)))
      .catch((e) => console.error('Takt fehlgeschlagen', String((e as Error)?.message ?? e)))
    if (typeof EdgeRuntime !== 'undefined') {
      EdgeRuntime.waitUntil(arbeit)
      return antwort(req, { angenommen: true }, 202)
    }
    await arbeit
    return antwort(req, { fertig: true })
  }

  let body: Record<string, unknown> = {}
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return antwort(req, { fehler: 'Body ist kein JSON' }, 400)
  }
  const postfachId = typeof body.postfach_id === 'string' ? body.postfach_id : ''
  if (!/^[0-9a-f-]{36}$/i.test(postfachId)) return antwort(req, { fehler: 'postfach_id fehlt' }, 400)
  if (!(await mitgliedDarf(req, postfachId))) return antwort(req, { fehler: 'Nicht angemeldet' }, 401)

  if (pfad === '/test') return antwort(req, await verbindungTesten(db, postfachId))
  if (pfad === '/testmail') {
    const an = typeof body.an === 'string' ? body.an.trim().toLowerCase() : ''
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(an)) return antwort(req, { fehler: 'Empfänger fehlt' }, 400)
    return antwort(req, await testmail(db, postfachId, an))
  }
  return antwort(req, { fehler: 'Unbekannter Pfad' }, 404)
})
