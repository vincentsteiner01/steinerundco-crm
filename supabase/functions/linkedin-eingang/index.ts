// Edge Function linkedin-eingang – nimmt LinkedIn-Benachrichtigungs-Mails aus dem eigenen Gmail entgegen (Apps Script,
// tools/apps-script/LinkedIn-ins-CRM.gs) und verbucht sie über crm.eingang_verarbeiten (Migration 7).
//
// Vertrag
//   POST /functions/v1/linkedin-eingang
//   Authorization: Bearer <Eingangs-Schlüssel>      (crm.eingang_token_erzeugen; hier nur sha256 → crm.eingang_tokens)
//   Body: { "nachrichten": [ { id, datum, betreff, von, text, links: string[], dmarc? } ] }   höchstens 50 Mails, 200 kB
//   Antwort 200: { neu, doppelt, verarbeitet, unbekannt, ignoriert, offen, fehler }
//   401 unbekannter/widerrufener Schlüssel · 400 ungültiger Body · 405 nicht POST · 413 zu groß
//
// Deploy (ohne JWT-Prüfung, der Schlüssel ist kein Supabase-JWT):
//   supabase functions deploy linkedin-eingang --project-ref ekaqkfgvisdngsskzbai --no-verify-jwt --use-api
// Server-zu-Server, deshalb kein CORS. Die Function liest und schreibt nie etwas bei LinkedIn.
// Der eigentliche Ablauf (Zeilen bauen, anlegen, offene verbuchen, Löschfrist) steht testbar in ablauf.ts.
import { createClient } from 'npm:@supabase/supabase-js@2.117.3'
import { ablauf, type EingangDb, SpeicherFehler } from './ablauf.ts'

const MAX_BYTES = 200 * 1024
const MAX_MAILS = 50

function antwort(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } })
}

async function sha256Hex(s: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Service-Schlüssel: neuer Secret Key (SUPABASE_SECRET_KEYS), sonst der klassische service_role-JWT. */
function serviceKey(): string {
  try {
    const neu = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>
    const k = neu.default ?? Object.values(neu)[0]
    if (k) return k
  } catch { /* fällt auf den klassischen Schlüssel zurück */ }
  const alt = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!alt) throw new Error('Kein Service-Schlüssel in der Umgebung')
  return alt
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return antwort({ fehler: 'Nur POST' }, 405)

  const m = /^Bearer\s+([A-Za-z0-9_-]{20,200})$/.exec((req.headers.get('authorization') ?? '').trim())
  if (!m) return antwort({ fehler: 'Eingangs-Schlüssel fehlt' }, 401)
  if (Number(req.headers.get('content-length') ?? '0') > MAX_BYTES) return antwort({ fehler: 'Body größer als 200 kB' }, 413)

  const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    db: { schema: 'crm' },
  })

  // Schlüssel prüfen (nur der Hash liegt in der Datenbank)
  const { data: tok, error: tokFehler } = await db.from('eingang_tokens')
    .select('id, member_id, revoked_at').eq('token_hash', await sha256Hex(m[1] as string)).maybeSingle()
  if (tokFehler) {
    console.error('Schlüssel-Abfrage fehlgeschlagen', tokFehler.message)
    return antwort({ fehler: 'Datenbank nicht erreichbar' }, 503)
  }
  if (!tok || tok.revoked_at) return antwort({ fehler: 'Eingangs-Schlüssel unbekannt oder widerrufen' }, 401)

  // Body lesen und prüfen
  const roh = new Uint8Array(await req.arrayBuffer())
  if (roh.byteLength > MAX_BYTES) return antwort({ fehler: 'Body größer als 200 kB' }, 413)
  let body: unknown
  try {
    body = JSON.parse(new TextDecoder().decode(roh))
  } catch {
    return antwort({ fehler: 'Body ist kein JSON' }, 400)
  }
  const liste = (body as { nachrichten?: unknown })?.nachrichten
  if (!Array.isArray(liste)) return antwort({ fehler: 'Feld „nachrichten“ fehlt' }, 400)
  if (liste.length > MAX_MAILS) return antwort({ fehler: `Höchstens ${MAX_MAILS} Mails je Aufruf` }, 413)

  await db.from('eingang_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', tok.id)

  const edb: EingangDb = {
    async profil(memberId) {
      const [p, m] = await Promise.all([
        db.from('member_profiles').select('linkedin_url').eq('member_id', memberId).maybeSingle(),
        db.from('members').select('display_name, short_name').eq('id', memberId).maybeSingle(),
      ])
      const namen = [m.data?.display_name, m.data?.short_name].filter((x): x is string => typeof x === 'string' && x.trim() !== '')
      return { linkedinUrl: (p.data?.linkedin_url as string | null | undefined) ?? null, namen }
    },
    anlegen: async (zeilen) => await db.from('eingang').upsert(zeilen, { onConflict: 'quelle,external_id', ignoreDuplicates: true }).select('id, status'),
    offene: async (memberId, externalIds) =>
      await db.from('eingang').select('id, art, ergebnis')
        .eq('quelle', 'gmail_linkedin').eq('member_id', memberId).eq('status', 'neu').in('external_id', externalIds),
    verarbeiten: async (id) => await db.rpc('eingang_verarbeiten', { p_id: id }).single<{ status: string }>(),
    aufraeumen: async () => await db.rpc('eingang_aufraeumen'),
  }

  let zaehler
  try {
    zaehler = await ablauf(edb, tok.member_id as string, liste)
  } catch (e) {
    if (e instanceof SpeicherFehler) return antwort({ fehler: e.message }, 500)
    console.error('linkedin-eingang abgebrochen', e instanceof Error ? e.message : String(e))
    return antwort({ fehler: 'Verarbeitung abgebrochen – der nächste Lauf versucht es erneut' }, 500)
  }
  console.log('linkedin-eingang', JSON.stringify(zaehler))
  return antwort(zaehler)
})
