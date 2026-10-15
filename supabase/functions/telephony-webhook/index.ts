// NICHT DEPLOYT – siehe research/telefon.md § 3.2 (Phase 2: Cloud-Telefonanlage mit Push-Events), architektur § 6.5.
// Platzhalter für Phase 2; v1 verbucht Anrufe manuell über crm.log_call (tel:-Link + Ergebnis-Pflicht, BAUPLAN E11).
//
// Vorbereiteter Vertrag `telephony-webhook` (research/telefon § 3.2, nicht aktivieren):
//  1. Route /telephony/{provider}; Signatur prüfen (Placetel HMAC-SHA256 im Header X-PLACETEL-SIGNATURE /
//     sipgate Quell-IP + Shared-Secret-Query / Aircall Token). Secret nur in Supabase Secrets (PLACETEL_SECRET …), nie im Frontend.
//  2. Rohevent in crm.call_events (provider, external_call_id, event, payload, received_at) schreiben – idempotent per provider + external_call_id + event.
//  3. to_number → E.164 normalisieren → Lead per phone_e164 matchen (Fallback: Firmennummer → Firma → offener Lead derselben Firma).
//  4. newCall/OutgoingCall: calls-Zeile anlegen/finden (provider, external_call_id, started_at); answer/CallAccepted: answered_at;
//     hangup/HungUp: ended_at, duration_sec, technisches Ergebnis vorbelegen (busy → busy, noAnswer/missed/cancel → no_answer,
//     voicemail → voicemail, notFound/unavailable → wrong_number, normalClearing + answered → offen, Mike wählt Gruppe B/C).
//  5. Realtime-Broadcast → der Anruf-Screen springt in den Ergebnis-Modus, sobald das Hangup-Event eintrifft.
//  6. calls.provider = 'manual'-Zeilen aus demselben Zeitfenster (±2 min, gleiche Nummer) werden mit dem Provider-Call gemergt, nicht dupliziert.
// Schema-Vorbereitung ist in Migration 1 enthalten (calls.provider, external_call_id, from_number, to_number, answered_at, ended_at,
// duration_sec, talk_sec, recording_url, raw_outcome; Tabelle call_events; member_profiles.caller_number_e164).
// Deploy später: supabase functions deploy telephony-webhook --project-ref ekaqkfgvisdngsskzbai --use-api

Deno.serve(() =>
  new Response(JSON.stringify({ error: 'telephony-webhook ist nicht aktiviert (Phase 2, research/telefon § 3.2)' }), {
    status: 501,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  }),
)
