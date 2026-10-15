// NICHT DEPLOYT – siehe research/email.md § 3.1 „v2“, BAUPLAN § 3.5 „Edge-Function-Vertrag“, architektur § 6.5.
// Platzhalter: `supabase functions deploy email-send` erst nach BAUPLAN § 9.6 Schritt 11 (Rechtliches) und einer Entscheidung Vincents.
// Der einzige Schalter im Produkt ist settings.email.sending_enabled (heute false). Der Client ruft diese Function in v1 nicht auf.
//
// Vertrag `email-send` (BAUPLAN § 3.5, verbindlich für die spätere Implementierung):
//  1. Aufruf: POST /functions/v1/email-send mit Body { email_id: uuid } und dem Service-JWT (nie der Publishable Key;
//     später über eine pg_net-Queue oder direkt aus dem Composer, wenn sending_enabled = true).
//  2. Liest die emails-Zeile (status = 'draft' oder 'opened_in_client', direction = 'out'), sonst 409 „Nur Entwürfe werden gesendet“.
//  3. Prüft serverseitig dasselbe Gate wie crm.emails_before_write (Grundlage ∉ {none, revoked} außer phase = 'transaktional',
//     Adresse vorhanden, keine Sperrliste, keine Firmensperre) UND settings.email.sending_enabled = true;
//     bei Verstoß 403 mit demselben Fehlertext, status bleibt.
//  4. Provider aus settings.email.provider ∈ {gmail_api, brevo}. Secrets: GOOGLE_CLIENT_ID/SECRET + Refresh-Token je Mitglied aus
//     crm.google_accounts (Tabelle kommt mit v2) bzw. BREVO_API_KEY. Baut RFC 2822 (UTF-8, text/plain + optional text/html),
//     setzt Message-ID: <uuid@steinerundco.de>, bei Folgemails In-Reply-To/References/threadId aus der ersten Mail des Enrollments,
//     List-Unsubscribe bei existing_customer.
//  5. Patcht bei Erfolg: status = 'sent', sent_at = now(), channel = 'gmail_api' | 'brevo', provider_message_id, provider_thread_id,
//     message_id_header; die Snapshot-Spalten schreibt der Trigger.
//  6. Bei Provider-Fehler: status = 'failed', bounce_reason = <Provider-Text ≤ 500 Zeichen>; kein Retry in der Function
//     (Retry ist eine Nutzeraktion „Erneut senden“).
//  7. Webhook-Endpunkt POST /functions/v1/email-send/webhook (Brevo hard_bounce/blocked/spam, Gmail über email-sync v2):
//     Signatur prüfen → status = 'bounced' / 'delivered'; der bestehende Trigger legt bei bounced den Sperrlisten-Eintrag an (§ 8.1 Nr. 6).
//  8. Idempotenz: zweiter Aufruf mit derselben email_id und status ∉ {draft, opened_in_client} → 200 mit der vorhandenen Zeile, kein zweiter Versand.
//  9. Logging: activities.email_gesendet schreibt der Trigger beim Statuswechsel auf sent – die Function loggt nichts selbst.
// 10. Deploy erst nach § 9.6 Schritt 11 und Vincents Entscheidung; bis dahin `supabase functions deploy` nicht ausführen (Tabu M4, § 3.5).
//
// Statusfolge (crm.email_status): draft → opened_in_client → sent → delivered | bounced | failed; replied kommt über email-sync (v2).

Deno.serve(() =>
  new Response(
    JSON.stringify({ error: 'email-send ist nicht aktiviert – settings.email.sending_enabled = false (BAUPLAN § 3.5)' }),
    { status: 501, headers: { 'content-type': 'application/json; charset=utf-8' } },
  ),
)
