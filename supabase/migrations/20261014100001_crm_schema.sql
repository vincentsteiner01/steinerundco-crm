-- =====================================================================================================
-- CRM Steiner & Co. · Schema „crm“ · Migration (idempotent)
-- Ziel: Supabase-Projekt ekaqkfgvisdngsskzbai (Postgres 17), eigenes Schema „crm“ neben dem Aktendashboard.
-- Stand: 2026-10-14
--
-- Konventionen (wie im Aktendashboard):
--   · Helfer in Schema „private“, Zugriff ausschließlich über private.is_member() (security definer).
--   · RLS auf jeder Tabelle, beide Mitglieder sehen und bearbeiten alles (Zuständigkeit ist ein Feld, keine Rechte-Grenze).
--   · updated_at-Trigger auf allen Tabellen mit updated_at.
--   · Deutsche Kommentare, deutsche Enum-Werte für das Fachmodell. Ausnahme: call_outcome und email_consent_basis
--     übernehmen die Codes aus research/telefon.md und research/email.md, weil Skripte und Vorlagen darauf verweisen.
--   · Alle Funktionen: set search_path = '' und vollqualifizierte Namen.
--   · Zeitzone der Fachlogik: Europe/Berlin (crm.today(), crm.berlin_date(), crm.due_on()).
--
-- Die Datei kann mehrfach ausgeführt werden (create … if not exists, create or replace, drop policy if exists,
-- Enum-Anlage mit Ausnahme-Fang). Sie legt KEINE Daten an – siehe seed.sql und import-mapping.sql.
-- Der PostgREST-Schalter (db_schema = public, crm) wird vom Lead gesetzt (Dashboard → API → Exposed schemas).
-- =====================================================================================================

create schema if not exists crm;
create schema if not exists private;

-- -----------------------------------------------------------------------------------------------------
-- 0. Portabilität: Voraussetzungen nachziehen, falls diese Migration in einem frischen Projekt läuft
--    (im Akten-Projekt existieren public.members, private.is_member(), private.set_updated_at() und auth.uid()).
-- -----------------------------------------------------------------------------------------------------
do $do$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  if to_regprocedure('auth.uid()') is null then
    create schema if not exists auth;
    create function auth.uid() returns uuid language sql stable as $fn$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $fn$;
    grant usage on schema auth to authenticated, anon, service_role;
    grant execute on function auth.uid() to authenticated, anon, service_role;
  end if;
  if to_regclass('public.members') is null then
    create table public.members (
      user_id      uuid primary key,
      email        text not null unique,
      display_name text not null,
      created_at   timestamptz not null default now()
    );
    alter table public.members enable row level security;
    revoke all on public.members from anon;
    grant select on public.members to authenticated;
  end if;
  if to_regprocedure('private.is_member()') is null then
    create function private.is_member() returns boolean language sql stable security definer set search_path = '' as $fn$
      select exists (select 1 from public.members m where m.user_id = (select auth.uid()));
    $fn$;
    revoke all on function private.is_member() from public;
    grant usage on schema private to authenticated;
    grant execute on function private.is_member() to authenticated;
    create policy "Mitglieder sehen Mitglieder" on public.members
      for select to authenticated using ((select private.is_member()));
  end if;
  if to_regprocedure('private.set_updated_at()') is null then
    create function private.set_updated_at() returns trigger language plpgsql set search_path = '' as $fn$
      begin new.updated_at := now(); return new; end;
    $fn$;
    revoke all on function private.set_updated_at() from public;
  end if;
end
$do$;

-- -----------------------------------------------------------------------------------------------------
-- 1. Enums
-- -----------------------------------------------------------------------------------------------------
do $$ begin create type crm.channel as enum ('linkedin', 'telefon', 'email', 'sonstiges'); exception when duplicate_object then null; end $$;

-- Funnel + Parkstufen. Deckt die Sheet-Werte ab (Offen/Eröffnung → gespraech_eroeffnet, DM Follow-Up/Keine Antwort → dm_follow_up,
-- In Gespräch → dm_beantwortet, Pitch, EG vereinbart/EG neu terminieren → erstgespraech_vereinbart, SG … → strategiegespraech_*,
-- Follow-Up → sales_follow_up, Kunde, Beendet/Nicht qualifiziert → beendet) und den vollen KPI-Funnel.
do $$ begin create type crm.lead_stage as enum (
  'neu', 'vernetzung_gesendet', 'vernetzt', 'gespraech_eroeffnet', 'dm_follow_up', 'dm_beantwortet', 'bedarfsermittlung', 'pitch',
  'erstgespraech_vereinbart', 'erstgespraech', 'strategiegespraech_vereinbart', 'strategiegespraech', 'sales_follow_up', 'kunde',
  'langfristig', 'beendet'); exception when duplicate_object then null; end $$;

do $$ begin create type crm.ended_reason as enum ('kein_bedarf', 'nicht_icp', 'nicht_qualifiziert', 'kein_interesse', 'falsche_nummer', 'duplikat', 'widerspruch', 'sonstiges'); exception when duplicate_object then null; end $$;
do $$ begin create type crm.salutation as enum ('herr', 'frau', 'neutral'); exception when duplicate_object then null; end $$;
do $$ begin create type crm.form_of_address as enum ('sie', 'du'); exception when duplicate_object then null; end $$;
do $$ begin create type crm.lead_role as enum ('geschaeftsfuehrer', 'inhaber', 'kundenbetreuer', 'innendienst', 'vertrieb', 'projektleiter', 'sonstiges', 'unbekannt'); exception when duplicate_object then null; end $$;
do $$ begin create type crm.record_source as enum ('app', 'import_sheet', 'import_csv', 'schnellimport', 'linkedin_export', 'telefonie', 'email_sync'); exception when duplicate_object then null; end $$;
do $$ begin create type crm.connection_status as enum ('ausstehend', 'angenommen', 'zurueckgezogen', 'abgelaufen'); exception when duplicate_object then null; end $$;
do $$ begin create type crm.note_variant as enum ('ohne', 'note_v1', 'note_v2'); exception when duplicate_object then null; end $$;
do $$ begin create type crm.linkedin_plan as enum ('basic', 'premium', 'sales_navigator'); exception when duplicate_object then null; end $$;

do $$ begin create type crm.activity_type as enum (
  'angelegt', 'import',
  'vernetzung_gesendet', 'vernetzung_angenommen', 'vernetzung_zurueckgezogen', 'vernetzung_abgelaufen',
  'gespraech_eroeffnet', 'nachricht_gesendet', 'nachricht_erhalten', 'pitch_gesendet',
  'anruf', 'email_gesendet', 'email_erhalten',
  'meeting_geplant', 'meeting_stattgefunden', 'meeting_no_show', 'meeting_abgesagt', 'meeting_verschoben',
  'notiz', 'stage_wechsel', 'uebergabe', 'freigabe',
  'sequenz_gestartet', 'sequenz_gestoppt', 'sequenz_abgeschlossen', 'sequenz_pausiert', 'schritt_uebersprungen', 'schritt_verschoben',
  'aufgabe_erledigt', 'einwilligung', 'widerspruch'); exception when duplicate_object then null; end $$;

-- Antwort-Label beim Loggen einer Antwort (steuert Phase-2-Vorlagen und Folgeaktion)
do $$ begin create type crm.reply_label as enum ('interessiert', 'frage', 'kein_bedarf', 'spaeter', 'nicht_icp', 'hat_partner', 'falsches_problem', 'widerspruch', 'sonstiges'); exception when duplicate_object then null; end $$;

-- Vorlagen-Phasen aller drei Kanäle (LinkedIn: vernetzung…langfristig · Telefon: gatekeeper…datenschutz · E-Mail: zusammenfassung…transaktional)
do $$ begin create type crm.template_phase as enum (
  'vernetzung', 'eroeffnung', 'bedarfsermittlung', 'pitch', 'follow_up', 'langfristig',
  'gatekeeper', 'einstieg', 'problem', 'qualifizierung', 'einwand', 'abschluss', 'mailbox', 'rueckruf', 'datenschutz',
  'zusammenfassung', 'nachfassen', 'infomail', 'transaktional'); exception when duplicate_object then null; end $$;

do $$ begin create type crm.sequence_trigger as enum ('manuell', 'vernetzung_angenommen', 'vernetzung_mit_notiz_angenommen', 'antwort_gesendet', 'erstgespraech_stattgefunden', 'telefon_nicht_erreicht', 'info_zugesagt_linkedin', 'info_zugesagt_telefon'); exception when duplicate_object then null; end $$;
do $$ begin create type crm.step_kind as enum ('nachricht', 'anruf', 'email', 'aufgabe'); exception when duplicate_object then null; end $$;
do $$ begin create type crm.enrollment_status as enum ('aktiv', 'pausiert', 'abgeschlossen', 'gestoppt'); exception when duplicate_object then null; end $$;
do $$ begin create type crm.stop_reason as enum ('antwort_erhalten', 'meeting_gebucht', 'lead_beendet', 'verbindung_entfernt', 'widerspruch', 'manuell', 'ersetzt', 'uebergabe'); exception when duplicate_object then null; end $$;
do $$ begin create type crm.step_outcome as enum ('gesendet', 'uebersprungen', 'antwort_erhalten', 'abgebrochen'); exception when duplicate_object then null; end $$;
do $$ begin create type crm.meeting_type as enum ('erstgespraech', 'strategiegespraech', 'folgegespraech'); exception when duplicate_object then null; end $$;
do $$ begin create type crm.meeting_status as enum ('geplant', 'stattgefunden', 'no_show', 'abgesagt', 'verschoben'); exception when duplicate_object then null; end $$;
do $$ begin create type crm.call_direction as enum ('out', 'in'); exception when duplicate_object then null; end $$;
do $$ begin create type crm.call_provider as enum ('manual', 'placetel', 'sipgate', 'aircall'); exception when duplicate_object then null; end $$;
-- 15 Ergebnis-Codes aus research/telefon.md §2.2 (Tasten 1–9, 0, X, W, K, Q, D)
do $$ begin create type crm.call_outcome as enum ('no_answer', 'busy', 'voicemail', 'voicemail_left', 'wrong_number', 'gatekeeper', 'gatekeeper_blocked', 'callback_scheduled', 'dm_interest', 'meeting_booked', 'send_info', 'not_now', 'not_interested', 'not_icp', 'do_not_call'); exception when duplicate_object then null; end $$;
do $$ begin create type crm.reached_person as enum ('niemand', 'zentrale', 'assistenz', 'entscheider', 'sonstige'); exception when duplicate_object then null; end $$;
-- Konkreter Anlass für einen Werbeanruf (§ 7 Abs. 2 Nr. 1 UWG), Pflicht vor dem ersten Anruf
do $$ begin create type crm.call_basis as enum ('linkedin_vernetzt_antwort', 'linkedin_vernetzt', 'email_antwort', 'website_anfrage', 'messe_event', 'empfehlung', 'bestandskontakt', 'stellenanzeige_innendienst', 'oeffentliche_aussage', 'sonstiger_konkreter_anlass'); exception when duplicate_object then null; end $$;
do $$ begin create type crm.phone_source as enum ('website_kontakt', 'google_profil', 'branchenverzeichnis', 'linkedin', 'visitenkarte', 'mitgeteilt', 'impressum', 'unbekannt'); exception when duplicate_object then null; end $$;
do $$ begin create type crm.phone_type as enum ('zentrale', 'durchwahl', 'mobil', 'unbekannt'); exception when duplicate_object then null; end $$;
-- Erlaubnis-Grundlage für E-Mails (research/email.md §1.6 A); ohne Grundlage ist Senden gesperrt
do $$ begin create type crm.email_consent_basis as enum ('none', 'requested_linkedin', 'requested_phone', 'requested_email', 'meeting_held', 'double_opt_in', 'existing_customer', 'revoked'); exception when duplicate_object then null; end $$;
do $$ begin create type crm.email_direction as enum ('out', 'in'); exception when duplicate_object then null; end $$;
do $$ begin create type crm.email_channel as enum ('gmail_compose', 'gmail_api', 'brevo', 'mailto', 'manual'); exception when duplicate_object then null; end $$;
do $$ begin create type crm.email_status as enum ('draft', 'opened_in_client', 'sent_confirmed', 'sent', 'delivered', 'bounced', 'replied', 'failed', 'received'); exception when duplicate_object then null; end $$;
do $$ begin create type crm.task_kind as enum ('rueckruf', 'wiedervorlage', 'aufgabe'); exception when duplicate_object then null; end $$;
do $$ begin create type crm.task_status as enum ('offen', 'erledigt', 'abgebrochen'); exception when duplicate_object then null; end $$;
do $$ begin create type crm.next_action_kind as enum ('sequenz_schritt', 'rueckruf', 'wiedervorlage', 'aufgabe', 'meeting', 'antworten'); exception when duplicate_object then null; end $$;
-- Kennzahlen des KPI-Sheets (+ Telefon/E-Mail)
do $$ begin create type crm.metric as enum (
  'vernetzungen_versendet', 'vernetzungen_angenommen', 'ausstehend',
  'gespraeche_eroeffnet', 'dm_beantwortet', 'erstgespraech_gepitcht', 'erstgespraeche_vereinbart', 'erstgespraeche', 'strategiegespraeche', 'kunden_gewonnen',
  'erstgespraech_no_show', 'erstgespraech_abgesagt', 'strategiegespraech_no_show', 'strategiegespraech_abgesagt',
  'anrufe', 'anrufe_erreicht', 'entscheider_gespraeche', 'termine_telefon', 'emails_gesendet'); exception when duplicate_object then null; end $$;
do $$ begin create type crm.counter_period as enum ('tag', 'monat'); exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------------------------------
-- 2. Immutable/stable Helfer (werden von Tabellen, Indizes und Views gebraucht)
-- -----------------------------------------------------------------------------------------------------

-- Heutiges Datum in Europe/Berlin (Supabase läuft in UTC)
create or replace function crm.today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Europe/Berlin')::date;
$$;

create or replace function crm.berlin_date(p timestamptz) returns date
language sql immutable set search_path = '' as $$
  select (p at time zone 'Europe/Berlin')::date;
$$;

-- Prozent-Dekodierung für URL-Slugs (%C3%B6 → ö). Als immutable deklariert, weil die DB-Kodierung (UTF8) fest ist.
create or replace function crm.url_decode(p text) returns text
language plpgsql immutable strict set search_path = '' as $$
declare
  r bytea := ''::bytea;
  i int := 1;
  n int := length(p);
  c text;
begin
  while i <= n loop
    c := substr(p, i, 1);
    if c = '%' and i + 2 <= n and substr(p, i + 1, 2) ~ '^[0-9A-Fa-f]{2}$' then
      r := r || decode(substr(p, i + 1, 2), 'hex');
      i := i + 3;
    else
      r := r || convert_to(c, 'UTF8');
      i := i + 1;
    end if;
  end loop;
  return convert_from(r, 'UTF8');
exception when others then
  return p;
end;
$$;

-- Dedupe-Schlüssel für LinkedIn-Profile: „linkedin.com/in/<slug>“ (klein, ohne Schema/www/Locale, ohne Query/Fragment/Slash,
-- dekodiert). Gleiches Format wie import/tools/parse_sheets.py. Nur /in/-Pfade sind Personen; Firmen- und Sales-Navigator-Links → null.
create or replace function crm.normalize_linkedin_url(p text) returns text
language plpgsql immutable set search_path = '' as $$
declare u text;
begin
  if p is null or btrim(p) = '' then return null; end if;
  u := lower(btrim(p));
  u := regexp_replace(u, '^https?://', '');
  u := regexp_replace(u, '^([a-z]{2,3}\.)?linkedin\.com', 'linkedin.com');
  u := split_part(split_part(u, '?', 1), '#', 1);
  u := regexp_replace(u, '/+$', '');
  u := crm.url_decode(u);
  if u !~ '^linkedin\.com/in/[^/]+$' then return null; end if;
  return u;
end;
$$;

-- Telefonnummer nach E.164 (Standard-Land DE). Gibt null zurück, wenn zu kurz.
create or replace function crm.normalize_phone(p text) returns text
language plpgsql immutable set search_path = '' as $$
declare s text;
begin
  if p is null then return null; end if;
  s := regexp_replace(p, '[^0-9+]', '', 'g');
  if s = '' then return null; end if;
  if s like '00%' then s := '+' || substr(s, 3);
  elsif s like '0%' then s := '+49' || substr(s, 2);
  elsif s not like '+%' then s := '+' || s;
  end if;
  if length(s) < 8 or length(s) > 17 then return null; end if;
  return s;
end;
$$;

create or replace function crm.company_norm(p text) returns text
language sql immutable set search_path = '' as $$
  select nullif(lower(btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g'))), '');
$$;

-- Datum in beiden Schreibweisen (ISO 2026-10-14 oder deutsch 14.10.2026), sonst null
create or replace function crm.any_date(p text) returns date
language plpgsql immutable set search_path = '' as $$
begin
  if p is null or btrim(p) = '' or p in ('None', 'null') then return null; end if;
  if p ~ '^\d{4}-\d{2}-\d{2}' then return left(p, 10)::date; end if;
  if p ~ '^\d{1,2}\.\d{1,2}\.\d{4}$' then return to_date(p, 'DD.MM.YYYY'); end if;
  return null;
exception when others then
  return null;
end;
$$;

-- „Dr. Hans-Georg Wendland“ → (Dr., Hans-Georg, Wendland); Anrede wird entfernt, Adelspartikel bleiben beim Nachnamen
create or replace function crm.split_person_name(p text, out title text, out first_name text, out last_name text)
language plpgsql immutable set search_path = '' as $$
declare s text; parts text[]; n int;
begin
  s := btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g'));
  if s = '' then return; end if;
  while s ~* '^(Dr\.|Prof\.|Dipl\.-Ing\.|Ing\.|Mag\.|Herr|Frau|Hr\.|Fr\.)\s+' loop
    if s ~* '^(Herr|Frau|Hr\.|Fr\.)\s+' then
      s := regexp_replace(s, '^(Herr|Frau|Hr\.|Fr\.)\s+', '', 'i');
    else
      title := concat_ws(' ', title, (regexp_match(s, '^(\S+)'))[1]);
      s := regexp_replace(s, '^\S+\s+', '');
    end if;
  end loop;
  parts := regexp_split_to_array(s, ' ');
  n := array_length(parts, 1);
  if n is null then return; end if;
  if n = 1 then last_name := parts[1]; return; end if;
  last_name := parts[n];
  if n >= 3 and lower(parts[n - 1]) in ('von', 'van', 'de', 'der', 'zu', 'zur', 'vom', 'da', 'di', 'del', 'le', 'du', 'ten', 'ter') then
    last_name := parts[n - 1] || ' ' || last_name;
    n := n - 1;
  end if;
  first_name := array_to_string(parts[1:n - 1], ' ');
  return;
end;
$$;

-- Reihenfolge im Funnel (für „weiter vorne/hinten“, Queue-Sortierung, Pipeline). Parkstufen bekommen eigene Werte.
create or replace function crm.stage_rank(p crm.lead_stage) returns int
language sql immutable set search_path = '' as $$
  select case p
    when 'neu' then 0 when 'vernetzung_gesendet' then 10 when 'vernetzt' then 20 when 'gespraech_eroeffnet' then 30
    when 'dm_follow_up' then 35 when 'dm_beantwortet' then 40 when 'bedarfsermittlung' then 50 when 'pitch' then 60
    when 'erstgespraech_vereinbart' then 70 when 'erstgespraech' then 80 when 'strategiegespraech_vereinbart' then 90
    when 'strategiegespraech' then 100 when 'sales_follow_up' then 110 when 'kunde' then 120
    when 'langfristig' then 5 when 'beendet' then -10 end;
$$;

-- Import-Modus (gesetzt per set_config('crm.import_mode','on',true)): Trigger legen Aktivitäten an, aber keine Zähler, keine Auto-Sequenzen.
create or replace function crm.import_mode() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(current_setting('crm.import_mode', true), '') = 'on';
$$;

create or replace function crm.record_source_now() returns crm.record_source
language sql stable set search_path = '' as $$
  select case when crm.import_mode() then 'import_sheet'::crm.record_source else 'app'::crm.record_source end;
$$;

-- -----------------------------------------------------------------------------------------------------
-- 3. Tabellen (in Abhängigkeitsreihenfolge)
-- -----------------------------------------------------------------------------------------------------

-- 3.1 Einstellungen & Mitglieder ---------------------------------------------------------------------
create table if not exists crm.settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_by  uuid references public.members (user_id) on delete set null,
  updated_at  timestamptz not null default now()
);
comment on table crm.settings is 'Globale Einstellungen als JSON (Wochenbudget, Queue-Regeln, Feiertage, KPI-Ziele, E-Mail-Schalter). Schlüssel siehe seed.sql.';

create table if not exists crm.member_profiles (
  member_id            uuid primary key references public.members (user_id) on delete cascade,
  short_name           text,                                   -- „Vincent“ / „Mike“ (Anzeige, Import-Zuordnung)
  linkedin_plan        crm.linkedin_plan not null default 'premium',
  linkedin_url         text,
  weekly_budget        int not null default 150 check (weekly_budget between 0 and 1000),   -- Vernetzungen je rollierende 7 Tage
  daily_target         int not null default 30  check (daily_target between 0 and 300),
  caller_number_e164   text,                                   -- Absendernummer für Telefonie (Rufnummernanzeige ist Pflicht)
  email_address        text,
  signature            text,                                   -- Signatur für E-Mails/DMs
  calendly_url         text,
  preferences          jsonb not null default '{}'::jsonb,      -- UI-Präferenzen (Spalten, Tastatur, Standard-View)
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
comment on table crm.member_profiles is 'Pro-Person-Einstellungen zu public.members (LinkedIn-Plan, Wochenbudget, Tagesziel, Absendernummer, Signatur).';

create table if not exists crm.tags (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  color      text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
comment on table crm.tags is 'Freie Schlagworte für Leads (z. B. „Nicht anschreiben“, „Empfehlungsgeber“, „Partnerfirma“).';

-- 3.2 Vorlagen & Sequenzen ---------------------------------------------------------------------------
create table if not exists crm.templates (
  id               uuid primary key default gen_random_uuid(),
  key              text not null unique,                        -- stabiler Schlüssel (Seed, Sequenz-Schritte), z. B. li_fu_kurz_2
  channel          crm.channel not null,
  phase            crm.template_phase not null,
  name             text not null,
  when_to_use      text,
  subject          text,                                        -- nur E-Mail
  body             text not null default '',
  notes            text,                                        -- „Notizen / Tests“ aus dem Leitfaden-Sheet
  variables        text[] not null default '{}',                -- automatisch aus [Platzhaltern] extrahiert
  form_of_address  crm.form_of_address,
  required_consent crm.email_consent_basis[],                   -- E-Mail: zulässige Erlaubnis-Grundlagen
  variant_of       uuid references crm.templates (id) on delete set null,
  active           boolean not null default true,
  sort_order       int not null default 0,
  legacy_phase     int,                                         -- Stufe 1–4 im Leitfaden-Sheet
  legacy_order     int,
  created_by       uuid references public.members (user_id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table crm.templates is 'Nachrichten-, Skript- und E-Mail-Vorlagen aller Kanäle (LinkedIn-Leitfäden Stufe 1–4, Telefonskript-Phasen, E-Mail-Vorlagen). Platzhalter in eckigen Klammern: [Vorname], [Nachname], [Unternehmen], [Grund], [Reaktion], [Tag/Uhrzeit] …';

create table if not exists crm.sequences (
  id            uuid primary key default gen_random_uuid(),
  key           text not null unique,                           -- z. B. linkedin_standard
  name          text not null,
  channel       crm.channel not null,
  description   text,
  trigger_kind  crm.sequence_trigger not null default 'manuell',
  weekdays_only boolean not null default true,                 -- Fälligkeit Sa/So/Feiertag → nächster Werktag
  stop_on_reply boolean not null default true,                 -- immer an (Exit-Regel), nur dokumentiert
  stop_on_meeting boolean not null default true,
  active        boolean not null default true,
  version       int not null default 1,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table crm.sequences is 'Kadenzen (Aufgaben-Generator, kein Bot): LinkedIn Standard, LinkedIn „Vernetzt ohne Antwort“, Nachfassen im Gespräch, Telefon Standard, E-Mail-Sequenzen.';

create table if not exists crm.sequence_steps (
  id           uuid primary key default gen_random_uuid(),
  sequence_id  uuid not null references crm.sequences (id) on delete cascade,
  position     int not null check (position >= 1),
  name         text not null,
  kind         crm.step_kind not null default 'nachricht',
  channel      crm.channel,                                     -- null = Kanal der Sequenz
  delay_days   int not null default 0 check (delay_days between 0 and 400),  -- Kalendertage ab vorherigem erledigten Schritt
  template_id  uuid references crm.templates (id) on delete set null,
  instructions text,
  is_opener    boolean not null default false,                  -- erste Nachricht = KPI „Gespräch eröffnet“
  sets_stage   crm.lead_stage,                                  -- Stufe, die nach Erledigung gesetzt wird (vorwärts; langfristig erzwingt)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (sequence_id, position)
);
comment on table crm.sequence_steps is 'Schritte einer Sequenz: Verzögerung in Tagen ab dem vorherigen Schritt, Vorlage, Art (Nachricht/Anruf/E-Mail/Aufgabe).';

-- 3.3 Firmen, Import-Batches, Leads -------------------------------------------------------------------
create table if not exists crm.companies (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (length(btrim(name)) > 0),
  name_norm      text generated always as (crm.company_norm(name)) stored,
  website        text,
  domain         text,
  city           text,
  linkedin_url   text,
  phone_e164     text,
  employees      int,
  segment        text,                                          -- Installateur / EPC / Projektentwickler …
  notes          text,
  do_not_contact boolean not null default false,                -- ganze Firma sperren („NICHT ANSCHREIBEN – <Firma>“)
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table crm.companies is 'Unternehmen (Solarbetriebe). Ein Lead gehört optional zu einer Firma; mehrere Ansprechpartner je Firma möglich.';
create unique index if not exists companies_name_norm_uidx on crm.companies (name_norm);

create table if not exists crm.import_batches (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid references public.members (user_id) on delete set null,
  source     crm.record_source not null,
  label      text,
  preset     text,                                              -- sheet_crm | sheet_kpi | chatgpt | csv | linkedin_export
  file_name  text,
  row_count  int not null default 0,
  inserted   int not null default 0,
  updated    int not null default 0,
  skipped    int not null default 0,
  blocked    int not null default 0,
  payload    jsonb,                                             -- Eingabe-Snapshot (Schnellimport/CSV) für „Rückgängig“
  summary    jsonb,
  undone_at  timestamptz,
  created_at timestamptz not null default now()
);
comment on table crm.import_batches is 'Jeder Import (Sheet, CSV, Schnellimport, LinkedIn-Export) als Batch mit Zählern und Snapshot – Grundlage für „Rückgängig“.';

create table if not exists crm.leads (
  id                       uuid primary key default gen_random_uuid(),
  -- Stammdaten
  salutation               crm.salutation not null default 'neutral',
  title                    text,                                -- Dr., Prof.
  first_name               text,
  last_name                text,
  full_name                text generated always as (btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))) stored,
  role                     crm.lead_role not null default 'unbekannt',
  role_title               text,                                -- Freitext-Position aus LinkedIn
  company_id               uuid references crm.companies (id) on delete set null,
  company_name             text,                                -- Snapshot/Freitext (wird aus companies synchronisiert)
  city                     text,
  website                  text,
  linkedin_url             text,
  linkedin_url_norm        text generated always as (crm.normalize_linkedin_url(linkedin_url)) stored,
  sales_nav_url            text,
  url_verified             boolean not null default false,      -- erst nach erstem Öffnen/„Anfrage gesendet“ true
  email                    text check (email is null or email = lower(email)),
  phone_e164               text,
  phone_type               crm.phone_type not null default 'unbekannt',
  phone_source             crm.phone_source not null default 'unbekannt',
  phone_source_url         text,
  phone_collected_at       timestamptz,
  -- Zuständigkeit
  owner_id                 uuid references public.members (user_id) on delete set null,   -- DM-Zuständigkeit; null = „Frei“
  sales_owner_id           uuid references public.members (user_id) on delete set null,   -- Sales-Verantwortlicher ab Erstgespräch
  opened_by_id             uuid references public.members (user_id) on delete set null,   -- Gespräch eröffnet von
  released                 boolean not null default false,      -- „Für anderen freigegeben?“
  released_at              timestamptz,
  released_reason          text,
  -- Funnel
  stage                    crm.lead_stage not null default 'neu',
  stage_changed_at         timestamptz not null default now(),
  ended_reason             crm.ended_reason,
  ended_at                 timestamptz,
  ended_note               text,
  priority                 smallint not null default 0 check (priority between -1 and 3),
  -- Nächster Schritt (von Triggern gepflegt)
  next_action_at           timestamptz,
  next_action_kind         crm.next_action_kind,
  next_action_ref          uuid,
  next_action_label        text,
  -- Letzte Aktivität (von Triggern gepflegt)
  last_activity_at         timestamptz,
  last_activity_type       crm.activity_type,
  last_outbound_at         timestamptz,
  last_inbound_at          timestamptz,
  last_inbound_channel     crm.channel,
  inbound_unanswered_since timestamptz,                         -- gesetzt bei eingehender Nachricht, gelöscht bei nächster ausgehender
  follow_up_count          int not null default 0,              -- „DM Follow-Ups Anzahl“
  -- Recht & Erlaubnis
  do_not_contact           boolean not null default false,
  do_not_contact_channels  crm.channel[],
  objection_at             timestamptz,
  objection_note           text,
  email_consent_basis      crm.email_consent_basis not null default 'none',
  email_consent_at         date,
  email_consent_note       text,
  email_consent_ref        jsonb,                               -- {call_id | meeting_id | activity_id | url}
  call_basis               crm.call_basis,
  call_basis_note          text,
  call_basis_url           text,
  privacy_notice_sent_at   timestamptz,
  privacy_notice_version   text,
  -- Qualifizierung & Notizen
  qualification            jsonb not null default '{}'::jsonb,  -- {wer_beantwortet, haeufigkeit, team_groesse_innendienst, wissensquelle, prioritaet, entscheider}
  notes                    text,                                -- „Notizen“ aus dem Sheet / Freitext
  custom                   jsonb not null default '{}'::jsonb,  -- {legacy: {…Sheet-Zeile…}}
  -- Herkunft
  source                   crm.record_source not null default 'app',
  source_batch_id          uuid references crm.import_batches (id) on delete set null,
  legacy_id                int,                                 -- Spalte „ID“ im CRM-Sheet
  legacy_system_id         uuid,
  legacy_system_id_2       uuid,
  created_by               uuid references public.members (user_id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  deleted_at               timestamptz,                         -- Papierkorb
  search tsvector generated always as (
    setweight(to_tsvector('german', coalesce(first_name, '') || ' ' || coalesce(last_name, '') || ' ' || coalesce(company_name, '')), 'A') ||
    setweight(to_tsvector('german', coalesce(role_title, '') || ' ' || coalesce(city, '') || ' ' || coalesce(email, '') || ' ' || coalesce(linkedin_url, '')), 'B') ||
    setweight(to_tsvector('german', coalesce(notes, '') || ' ' || coalesce(ended_note, '')), 'C')
  ) stored,
  constraint leads_beendet_braucht_grund check (stage <> 'beendet' or ended_reason is not null),
  constraint leads_name_oder_url check (coalesce(first_name, last_name, linkedin_url) is not null)
);
comment on table crm.leads is 'Personen (ICP-Kontakte). Eine Zeile je Mensch; Dedupe über linkedin_url_norm. Trägt Funnel-Stufe, Zuständigkeit, nächsten Schritt, Erlaubnis-Grundlagen und Legacy-IDs aus dem Sheet.';

create unique index if not exists leads_linkedin_norm_uidx on crm.leads (linkedin_url_norm) where linkedin_url_norm is not null;
create unique index if not exists leads_legacy_id_uidx on crm.leads (legacy_id) where legacy_id is not null;
create index if not exists leads_search_idx on crm.leads using gin (search);
create index if not exists leads_owner_stage_idx on crm.leads (owner_id, stage) where deleted_at is null;
create index if not exists leads_stage_idx on crm.leads (stage) where deleted_at is null;
create index if not exists leads_next_action_idx on crm.leads (owner_id, next_action_at) where deleted_at is null and next_action_at is not null;
create index if not exists leads_inbound_idx on crm.leads (owner_id, inbound_unanswered_since) where inbound_unanswered_since is not null;
create index if not exists leads_company_idx on crm.leads (company_id);
create index if not exists leads_phone_idx on crm.leads (phone_e164) where phone_e164 is not null;
create index if not exists leads_email_idx on crm.leads (email) where email is not null;
create index if not exists leads_last_activity_idx on crm.leads (last_activity_at desc);

create table if not exists crm.lead_tags (
  lead_id uuid not null references crm.leads (id) on delete cascade,
  tag_id  uuid not null references crm.tags (id) on delete cascade,
  primary key (lead_id, tag_id)
);
comment on table crm.lead_tags is 'Zuordnung Lead ↔ Schlagwort.';

-- 3.4 LinkedIn-Vernetzungen ---------------------------------------------------------------------------
create table if not exists crm.linkedin_connections (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references crm.leads (id) on delete cascade,
  member_id     uuid not null references public.members (user_id) on delete cascade,
  requested_at  timestamptz,                                    -- null = Datum unbekannt (Alt-Daten)
  accepted_at   timestamptz,
  status        crm.connection_status not null default 'ausstehend',
  note_variant  crm.note_variant not null default 'ohne',
  withdrawn_at  timestamptz,
  source        crm.record_source not null default 'app',
  kpi_relevant  boolean not null default true,                  -- false = schon in den importierten Sheet-Zahlen enthalten
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (lead_id, member_id),
  constraint connections_status_konsistent check (
    (status = 'angenommen') = (accepted_at is not null)
    and (status <> 'zurueckgezogen' or withdrawn_at is not null))
);
comment on table crm.linkedin_connections is 'Vernetzungsanfrage je Person und Mitglied (Mike und Vincent können dieselbe Person angefragt haben). Annahme setzt die Lead-Stufe und startet die LinkedIn-Sequenz.';
create index if not exists connections_member_status_idx on crm.linkedin_connections (member_id, status, requested_at desc);
create index if not exists connections_lead_idx on crm.linkedin_connections (lead_id);

-- 3.5 Enrollments (Lead in Sequenz) --------------------------------------------------------------------
create table if not exists crm.enrollments (
  id               uuid primary key default gen_random_uuid(),
  lead_id          uuid not null references crm.leads (id) on delete cascade,
  sequence_id      uuid not null references crm.sequences (id) on delete restrict,
  channel          crm.channel not null,
  member_id        uuid references public.members (user_id) on delete set null,   -- wer die Schritte ausführt
  status           crm.enrollment_status not null default 'aktiv',
  current_step_id  uuid references crm.sequence_steps (id) on delete set null,
  current_position int,
  next_due_at      timestamptz,
  started_at       timestamptz not null default now(),
  last_step_at     timestamptz,
  completed_at     timestamptz,
  stopped_at       timestamptz,
  stopped_reason   crm.stop_reason,
  snooze_count     int not null default 0,
  note             text,
  source           crm.record_source not null default 'app',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint enrollments_aktiv_hat_faelligkeit check (status <> 'aktiv' or next_due_at is not null)
);
comment on table crm.enrollments is 'Ein Lead in einer Sequenz: aktueller Schritt, Fälligkeit des nächsten Schritts, Status (aktiv/pausiert/abgeschlossen/gestoppt) und Stopp-Grund.';
create unique index if not exists enrollments_eine_aktive_je_kanal_uidx on crm.enrollments (lead_id, channel) where status in ('aktiv', 'pausiert');
create index if not exists enrollments_due_idx on crm.enrollments (member_id, next_due_at) where status = 'aktiv';
create index if not exists enrollments_lead_idx on crm.enrollments (lead_id);

-- 3.6 Anrufe ------------------------------------------------------------------------------------------
create table if not exists crm.call_outcome_defs (
  outcome             crm.call_outcome primary key,
  label               text not null,
  hotkey              text,
  group_label         text not null,                            -- A Niemand erreicht · B Erreicht, nicht Entscheider · C Entscheider
  is_connect          boolean not null default false,
  is_dm               boolean not null default false,
  counts_attempt      boolean not null default true,
  default_next_action text,
  sort_order          int not null default 0
);
comment on table crm.call_outcome_defs is 'Ergebnis-Taxonomie für Anrufe (Taste, Gruppe, Flags connect/dm/attempt, Standard-Folgeaktion). Seed aus research/telefon.md §2.2.';

create table if not exists crm.calls (
  id               uuid primary key default gen_random_uuid(),
  lead_id          uuid not null references crm.leads (id) on delete cascade,
  member_id        uuid references public.members (user_id) on delete set null,
  direction        crm.call_direction not null default 'out',
  provider         crm.call_provider not null default 'manual',
  external_call_id text,
  from_number      text,
  to_number        text,
  started_at       timestamptz not null default now(),
  answered_at      timestamptz,
  ended_at         timestamptz,
  duration_sec     int check (duration_sec is null or duration_sec >= 0),
  talk_sec         int check (talk_sec is null or talk_sec >= 0),
  attempt_no       int,
  outcome          crm.call_outcome not null,
  raw_outcome      text,                                        -- Provider-Code (busy, noAnswer, …)
  reached_person   crm.reached_person,
  reached_name     text,
  note             text,
  template_id      uuid references crm.templates (id) on delete set null,
  enrollment_id    uuid references crm.enrollments (id) on delete set null,
  recording_url    text,                                        -- v1 ungenutzt (§ 201 StGB)
  corrected        boolean not null default false,              -- Korrektur-Flag statt Löschen (append-only)
  kpi_relevant     boolean not null default true,
  source           crm.record_source not null default 'app',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (provider, external_call_id)
);
comment on table crm.calls is 'Jeder Anrufversuch (append-only, kein Löschen): Nummern, Zeiten, Ergebnis-Code, erreichte Person, Skript. Beleg für § 7 UWG und Grundlage der Telefon-KPIs.';
create index if not exists calls_lead_idx on crm.calls (lead_id, started_at desc);
create index if not exists calls_member_idx on crm.calls (member_id, started_at desc);

-- 3.7 Aufgaben (Rückrufe, Wiedervorlagen) -------------------------------------------------------------
create table if not exists crm.tasks (
  id           uuid primary key default gen_random_uuid(),
  lead_id      uuid references crm.leads (id) on delete cascade,
  member_id    uuid references public.members (user_id) on delete set null,
  kind         crm.task_kind not null default 'wiedervorlage',
  title        text not null,
  due_at       timestamptz not null,
  status       crm.task_status not null default 'offen',
  done_at      timestamptz,
  snooze_count int not null default 0,
  call_id      uuid references crm.calls (id) on delete set null,
  template_id  uuid references crm.templates (id) on delete set null,
  note         text,
  source       crm.record_source not null default 'app',
  created_by   uuid references public.members (user_id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table crm.tasks is 'Manuelle Termine außerhalb von Sequenzen: Rückruf (mit Uhrzeit), Wiedervorlage („Nächster Follow-Up am“ ohne Sequenz, Langfristig), Aufgabe. Erscheinen in der Heute-Queue.';
create index if not exists tasks_due_idx on crm.tasks (member_id, due_at) where status = 'offen';
create index if not exists tasks_lead_idx on crm.tasks (lead_id);

-- 3.8 Meetings ----------------------------------------------------------------------------------------
create table if not exists crm.meetings (
  id                   uuid primary key default gen_random_uuid(),
  lead_id              uuid not null references crm.leads (id) on delete cascade,
  member_id            uuid references public.members (user_id) on delete set null,
  type                 crm.meeting_type not null default 'erstgespraech',
  scheduled_at         timestamptz not null,
  duration_min         int not null default 15,
  status               crm.meeting_status not null default 'geplant',
  booked_at            timestamptz not null default now(),     -- wann vereinbart (KPI „Erstgespräche vereinbart“)
  calendly_uri         text,
  calendly_invitee_uri text,
  location             text,                                    -- Telefon / Video-Link
  outcome_note         text,
  rescheduled_from_id  uuid references crm.meetings (id) on delete set null,
  source               crm.record_source not null default 'app',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
comment on table crm.meetings is 'Erst-, Strategie- und Folgegespräche mit Status (geplant/stattgefunden/no_show/abgesagt/verschoben) und Calendly-Referenz. Verschieben = neue Zeile mit rescheduled_from_id.';
create index if not exists meetings_lead_idx on crm.meetings (lead_id, scheduled_at desc);
create index if not exists meetings_member_idx on crm.meetings (member_id, scheduled_at) where status = 'geplant';
create unique index if not exists meetings_calendly_uidx on crm.meetings (calendly_uri) where calendly_uri is not null;

-- 3.9 E-Mails -----------------------------------------------------------------------------------------
create table if not exists crm.emails (
  id                     uuid primary key default gen_random_uuid(),
  lead_id                uuid not null references crm.leads (id) on delete cascade,
  member_id              uuid references public.members (user_id) on delete set null,
  direction              crm.email_direction not null default 'out',
  channel                crm.email_channel not null default 'gmail_compose',
  template_id            uuid references crm.templates (id) on delete set null,
  enrollment_id          uuid references crm.enrollments (id) on delete set null,
  step_id                uuid references crm.sequence_steps (id) on delete set null,
  from_address           text,
  to_address             text,
  subject                text,
  body_text              text,
  body_html              text,
  message_id_header      text,
  in_reply_to            text,
  references_header      text,
  provider_thread_id     text,
  provider_message_id    text,
  status                 crm.email_status not null default 'draft',
  status_at              timestamptz not null default now(),
  sent_at                timestamptz,
  replied_at             timestamptz,
  bounce_reason          text,
  consent_basis_snapshot crm.email_consent_basis,                -- Erlaubnis-Grundlage zum Sendezeitpunkt (Beweis)
  consent_at_snapshot    date,
  consent_note_snapshot  text,
  source                 crm.record_source not null default 'app',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
comment on table crm.emails is 'Gesendete/empfangene E-Mails mit Provider-IDs, Thread-Headern, Status und Snapshot der Erlaubnis-Grundlage (§ 7 UWG, BGH I ZR 164/09).';
create index if not exists emails_lead_idx on crm.emails (lead_id, created_at desc);
create unique index if not exists emails_message_id_uidx on crm.emails (message_id_header) where message_id_header is not null;

-- 3.10 Aktivitäten (Timeline) -------------------------------------------------------------------------
create table if not exists crm.activities (
  id            bigint generated always as identity primary key,
  lead_id       uuid not null references crm.leads (id) on delete cascade,
  member_id     uuid references public.members (user_id) on delete set null,
  channel       crm.channel not null default 'sonstiges',
  type          crm.activity_type not null,
  occurred_at   timestamptz not null default now(),
  template_id   uuid references crm.templates (id) on delete set null,
  outcome       text,                                           -- call_outcome-Code, step_outcome, reply_label …
  reply_label   crm.reply_label,
  note          text,
  metadata      jsonb not null default '{}'::jsonb,
  enrollment_id uuid references crm.enrollments (id) on delete set null,
  step_id       uuid references crm.sequence_steps (id) on delete set null,
  call_id       uuid references crm.calls (id) on delete set null,
  meeting_id    uuid references crm.meetings (id) on delete set null,
  email_id      uuid references crm.emails (id) on delete set null,
  task_id       uuid references crm.tasks (id) on delete set null,
  kpi_relevant  boolean not null default true,
  source        crm.record_source not null default 'app',
  created_at    timestamptz not null default now()
);
comment on table crm.activities is 'Chronik je Lead: Vernetzung, Nachrichten, Anrufe, E-Mails, Meetings, Notizen, Stufenwechsel, Übergaben, Sequenz-Ereignisse. Quelle aller KPI-Berechnungen (kpi_relevant).';
create index if not exists activities_lead_idx on crm.activities (lead_id, occurred_at desc);
create index if not exists activities_member_type_idx on crm.activities (member_id, type, occurred_at);
create index if not exists activities_type_time_idx on crm.activities (type, occurred_at);
create index if not exists activities_template_idx on crm.activities (template_id) where template_id is not null;

-- 3.11 Zähler, Views, Sperrliste ------------------------------------------------------------------------
create table if not exists crm.daily_counters (
  member_id  uuid not null references public.members (user_id) on delete cascade,
  date       date not null,
  metric     crm.metric not null,
  period     crm.counter_period not null default 'tag',         -- monat: Datum = Monatserster (KPI-Sheet-Import)
  value      int not null default 0 check (value >= 0),
  note       text,
  source     text not null default 'manuell',                   -- manuell | auto | kpi_sheet
  updated_by uuid references public.members (user_id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (member_id, date, metric, period),
  constraint counters_monat_am_ersten check (period = 'tag' or extract(day from date) = 1)
);
comment on table crm.daily_counters is 'Manuelle Tageszähler („Vernetzungen versendet“ – wird auch durch erfasste Anfragen hochgezählt) und historische Monatswerte aus dem KPI-Sheet. Werden zu den Ereignis-Zahlen addiert.';

create table if not exists crm.saved_views (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid references public.members (user_id) on delete cascade,   -- null = für beide
  entity     text not null check (entity in ('leads', 'queue', 'pipeline', 'kpi', 'calls')),
  name       text not null,
  filters    jsonb not null default '{}'::jsonb,
  sort       jsonb not null default '[]'::jsonb,
  columns    jsonb not null default '[]'::jsonb,
  is_default boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table crm.saved_views is 'Gespeicherte Ansichten (Filter, Sortierung, Spalten) pro Person oder für beide.';

create table if not exists crm.sperrliste (
  id                uuid primary key default gen_random_uuid(),
  linkedin_url_norm text,
  email             text,
  phone_e164        text,
  name              text,
  company           text,
  reason            text not null check (reason in ('widerspruch', 'abmeldung', 'bounce', 'manuell')),
  channels          crm.channel[] not null default array['linkedin', 'telefon', 'email']::crm.channel[],
  note              text,
  lead_id           uuid references crm.leads (id) on delete set null,
  created_by        uuid references public.members (user_id) on delete set null,
  created_at        timestamptz not null default now(),
  constraint sperrliste_schluessel check (coalesce(linkedin_url_norm, email, phone_e164) is not null)
);
comment on table crm.sperrliste is 'Werbesperrdatei (Art. 21 DSGVO): Minimaldaten, damit widersprechende Personen auch nach Re-Import nie wieder kontaktiert werden. Import und Queue prüfen dagegen (Hard-Block).';
create unique index if not exists sperrliste_linkedin_uidx on crm.sperrliste (linkedin_url_norm) where linkedin_url_norm is not null;
create unique index if not exists sperrliste_email_uidx on crm.sperrliste (email) where email is not null;
create unique index if not exists sperrliste_phone_uidx on crm.sperrliste (phone_e164) where phone_e164 is not null;

-- -----------------------------------------------------------------------------------------------------
-- 4. Stable Helfer, die Tabellen lesen (Settings, Termine, Mitglieder)
-- -----------------------------------------------------------------------------------------------------
create or replace function crm.setting(p_key text, p_path text default null) returns jsonb
language sql stable set search_path = '' as $$
  select case when p_path is null then s.value else s.value #> string_to_array(p_path, '.') end
  from crm.settings s where s.key = p_key;
$$;

create or replace function crm.is_holiday(p date) returns boolean
language sql stable set search_path = '' as $$
  select coalesce(crm.setting('feiertage') @> to_jsonb(array[to_char(p, 'YYYY-MM-DD')]), false);
$$;

-- Sa/So/Feiertag → nächster Werktag
create or replace function crm.roll_to_weekday(p date) returns date
language plpgsql stable set search_path = '' as $$
declare d date := p; i int := 0;
begin
  while (extract(isodow from d) >= 6 or crm.is_holiday(d)) and i < 10 loop
    d := d + 1; i := i + 1;
  end loop;
  return d;
end;
$$;

-- Fälligkeitszeitpunkt eines Tages (Standard 09:00 Europe/Berlin, Einstellung queue.due_time)
create or replace function crm.due_on(p date) returns timestamptz
language sql stable set search_path = '' as $$
  select (p + coalesce((crm.setting('queue', 'due_time') #>> '{}')::time, time '09:00')) at time zone 'Europe/Berlin';
$$;

create or replace function crm.next_due(p_from timestamptz, p_delay_days int, p_weekdays_only boolean default true) returns timestamptz
language sql stable set search_path = '' as $$
  select crm.due_on(case when p_weekdays_only then crm.roll_to_weekday(crm.berlin_date(p_from) + p_delay_days)
                         else crm.berlin_date(p_from) + p_delay_days end);
$$;

-- Mitglied nach Kurzname/Vorname/E-Mail-Präfix („Vincent“, „Mike“, „Vincent Steiner“)
create or replace function crm.member_id_by_name(p_name text) returns uuid
language sql stable set search_path = '' as $$
  select m.user_id from public.members m
  left join crm.member_profiles mp on mp.member_id = m.user_id
  where p_name is not null and (
        lower(coalesce(mp.short_name, '')) = lower(btrim(p_name))
     or lower(m.display_name) = lower(btrim(p_name))
     or lower(split_part(m.display_name, ' ', 1)) = lower(split_part(btrim(p_name), ' ', 1))
     or lower(split_part(m.email, '@', 1)) = lower(split_part(btrim(p_name), ' ', 1)))
  order by (lower(coalesce(mp.short_name, '')) = lower(btrim(p_name))) desc, m.created_at
  limit 1;
$$;

-- Hat das Mitglied für diesen Monat KPI-Sheet-Werte? (dann zählen importierte Sheet-Ereignisse nicht doppelt)
create or replace function crm.has_kpi_sheet(p_member uuid, p_month date) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from crm.daily_counters c
                 where c.member_id = p_member and c.period = 'monat' and c.source = 'kpi_sheet'
                   and date_trunc('month', c.date)::date = date_trunc('month', p_month)::date);
$$;

create or replace function crm.is_blocked(p_linkedin_norm text, p_email text, p_phone text) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from crm.sperrliste s
                 where (p_linkedin_norm is not null and s.linkedin_url_norm = p_linkedin_norm)
                    or (p_email is not null and s.email = lower(p_email))
                    or (p_phone is not null and s.phone_e164 = p_phone));
$$;

-- -----------------------------------------------------------------------------------------------------
-- 5. Kernfunktionen (von Triggern und RPCs genutzt)
-- -----------------------------------------------------------------------------------------------------

-- Aktivität anlegen (zentraler Weg; Trigger auf activities pflegt danach den Lead)
create or replace function crm.log_activity(
  p_lead_id uuid, p_member_id uuid, p_channel crm.channel, p_type crm.activity_type,
  p_occurred_at timestamptz default now(), p_template_id uuid default null, p_outcome text default null,
  p_note text default null, p_metadata jsonb default '{}'::jsonb,
  p_enrollment_id uuid default null, p_step_id uuid default null, p_call_id uuid default null,
  p_meeting_id uuid default null, p_email_id uuid default null, p_task_id uuid default null,
  p_reply_label crm.reply_label default null, p_kpi_relevant boolean default true, p_source crm.record_source default null)
returns bigint language plpgsql set search_path = '' as $$
declare v_id bigint;
begin
  insert into crm.activities (lead_id, member_id, channel, type, occurred_at, template_id, outcome, reply_label, note, metadata,
                              enrollment_id, step_id, call_id, meeting_id, email_id, task_id, kpi_relevant, source)
  values (p_lead_id, p_member_id, coalesce(p_channel, 'sonstiges'), p_type, coalesce(p_occurred_at, now()), p_template_id, p_outcome, p_reply_label,
          p_note, coalesce(p_metadata, '{}'::jsonb), p_enrollment_id, p_step_id, p_call_id, p_meeting_id, p_email_id, p_task_id,
          coalesce(p_kpi_relevant, true), coalesce(p_source, crm.record_source_now()))
  returning id into v_id;
  return v_id;
end;
$$;

-- Stufe setzen (erzwingt). Beendet verlangt einen Grund.
create or replace function crm.set_stage(p_lead_id uuid, p_stage crm.lead_stage, p_member_id uuid default null,
                                         p_ended_reason crm.ended_reason default null, p_note text default null)
returns void language plpgsql set search_path = '' as $$
begin
  update crm.leads
     set stage = p_stage,
         ended_reason = case when p_stage = 'beendet' then coalesce(p_ended_reason, ended_reason, 'sonstiges') else null end,
         ended_note = case when p_stage = 'beendet' then coalesce(p_note, ended_note) else ended_note end
   where id = p_lead_id and stage is distinct from p_stage;
end;
$$;

-- Stufe nur vorwärts bewegen. Aus langfristig/beendet reaktivieren (außer bei Widerspruch).
create or replace function crm.raise_stage(p_lead_id uuid, p_stage crm.lead_stage, p_member_id uuid default null)
returns void language plpgsql set search_path = '' as $$
declare l crm.leads;
begin
  select * into l from crm.leads where id = p_lead_id;
  if not found then return; end if;
  if l.do_not_contact then return; end if;
  if l.stage in ('langfristig', 'beendet') then
    if l.ended_reason = 'widerspruch' then return; end if;
    perform crm.set_stage(p_lead_id, p_stage, p_member_id);
  elsif crm.stage_rank(p_stage) > crm.stage_rank(l.stage) then
    perform crm.set_stage(p_lead_id, p_stage, p_member_id);
  end if;
end;
$$;

-- Alle aktiven/pausierten Sequenzen eines Leads stoppen (optional nur ein Kanal)
create or replace function crm.stop_enrollments(p_lead_id uuid, p_reason crm.stop_reason, p_channel crm.channel default null, p_note text default null)
returns int language plpgsql set search_path = '' as $$
declare n int;
begin
  update crm.enrollments
     set status = 'gestoppt', stopped_at = now(), stopped_reason = p_reason, next_due_at = null,
         note = coalesce(p_note, note)
   where lead_id = p_lead_id and status in ('aktiv', 'pausiert') and (p_channel is null or channel = p_channel);
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Nächsten Schritt des Leads aus Sequenzen, Aufgaben und Meetings neu berechnen
create or replace function crm.recompute_lead_next_action(p_lead_id uuid)
returns void language plpgsql set search_path = '' as $$
declare r record;
begin
  select * into r from (
    select e.next_due_at as due_ts, 'sequenz_schritt'::crm.next_action_kind as kind, e.id as ref,
           coalesce(s.name, 'Sequenzschritt') as label
      from crm.enrollments e left join crm.sequence_steps s on s.id = e.current_step_id
     where e.lead_id = p_lead_id and e.status = 'aktiv' and e.next_due_at is not null
    union all
    select t.due_at, case t.kind when 'rueckruf' then 'rueckruf'::crm.next_action_kind
                                 when 'wiedervorlage' then 'wiedervorlage'::crm.next_action_kind
                                 else 'aufgabe'::crm.next_action_kind end, t.id, t.title
      from crm.tasks t where t.lead_id = p_lead_id and t.status = 'offen'
    union all
    select m.scheduled_at, 'meeting'::crm.next_action_kind, m.id,
           case m.type when 'erstgespraech' then 'Erstgespräch' when 'strategiegespraech' then 'Strategiegespräch' else 'Folgegespräch' end
      from crm.meetings m where m.lead_id = p_lead_id and m.status = 'geplant'
  ) x order by due_ts asc limit 1;

  update crm.leads
     set next_action_at = r.due_ts, next_action_kind = r.kind, next_action_ref = r.ref, next_action_label = r.label
   where id = p_lead_id
     and (next_action_at is distinct from r.due_ts or next_action_ref is distinct from r.ref
          or next_action_kind is distinct from r.kind or next_action_label is distinct from r.label);
end;
$$;

-- Lead in Sequenz aufnehmen. Gibt die Enrollment-ID zurück; bestehende aktive Sequenz desselben Kanals bleibt (keine Doppelung).
create or replace function crm.enroll(p_lead_id uuid, p_sequence_key text, p_member_id uuid default null,
                                      p_start_at timestamptz default now(), p_start_position int default 1,
                                      p_first_due timestamptz default null, p_note text default null)
returns uuid language plpgsql set search_path = '' as $$
declare seq crm.sequences; st crm.sequence_steps; l crm.leads; v_id uuid; v_member uuid;
begin
  select * into seq from crm.sequences where key = p_sequence_key and active;
  if not found then raise exception 'Sequenz „%“ nicht gefunden oder inaktiv', p_sequence_key; end if;
  select * into l from crm.leads where id = p_lead_id;
  if not found then raise exception 'Lead % nicht gefunden', p_lead_id; end if;
  if l.do_not_contact or (l.stage = 'beendet' and l.ended_reason = 'widerspruch') then
    raise exception 'Lead ist gesperrt (Widerspruch) – keine Sequenz möglich';
  end if;
  select id into v_id from crm.enrollments where lead_id = p_lead_id and channel = seq.channel and status in ('aktiv', 'pausiert');
  if v_id is not null then return v_id; end if;

  select * into st from crm.sequence_steps where sequence_id = seq.id and position >= p_start_position order by position limit 1;
  if not found then raise exception 'Sequenz „%“ hat keinen Schritt ab Position %', p_sequence_key, p_start_position; end if;

  v_member := coalesce(p_member_id, l.owner_id, auth.uid());
  if l.owner_id is null and v_member is not null and not l.released then
    update crm.leads set owner_id = v_member where id = p_lead_id;   -- wer eröffnet, übernimmt die Zuständigkeit
  end if;

  insert into crm.enrollments (lead_id, sequence_id, channel, member_id, status, current_step_id, current_position, next_due_at, started_at, note, source)
  values (p_lead_id, seq.id, seq.channel, v_member, 'aktiv', st.id, st.position,
          coalesce(p_first_due, crm.next_due(coalesce(p_start_at, now()), st.delay_days, seq.weekdays_only)),
          coalesce(p_start_at, now()), p_note, crm.record_source_now())
  returning id into v_id;
  return v_id;
end;
$$;

-- Aktuellen Schritt als erledigt verbuchen und den nächsten terminieren (ohne Aktivität – die loggt der Aufrufer)
create or replace function crm.advance_enrollment(p_enrollment_id uuid, p_done_at timestamptz default now(), p_apply_stage boolean default true)
returns crm.enrollments language plpgsql set search_path = '' as $$
declare e crm.enrollments; seq crm.sequences; cur crm.sequence_steps; nxt crm.sequence_steps;
begin
  select * into e from crm.enrollments where id = p_enrollment_id for update;
  if not found then raise exception 'Enrollment % nicht gefunden', p_enrollment_id; end if;
  select * into seq from crm.sequences where id = e.sequence_id;
  select * into cur from crm.sequence_steps where id = e.current_step_id;

  if p_apply_stage and cur.sets_stage is not null then
    if cur.sets_stage = 'langfristig' then perform crm.set_stage(e.lead_id, 'langfristig', e.member_id);
    else perform crm.raise_stage(e.lead_id, cur.sets_stage, e.member_id); end if;
  end if;

  select * into nxt from crm.sequence_steps where sequence_id = e.sequence_id and position > coalesce(cur.position, e.current_position, 0) order by position limit 1;
  if nxt.id is null then
    update crm.enrollments set status = 'abgeschlossen', completed_at = p_done_at, current_step_id = null, next_due_at = null,
                               last_step_at = p_done_at, snooze_count = 0
     where id = e.id returning * into e;
  else
    update crm.enrollments set status = 'aktiv', current_step_id = nxt.id, current_position = nxt.position,
                               next_due_at = crm.next_due(p_done_at, nxt.delay_days, seq.weekdays_only),
                               last_step_at = p_done_at, snooze_count = 0
     where id = e.id returning * into e;
  end if;
  return e;
end;
$$;

-- -----------------------------------------------------------------------------------------------------
-- 6. Trigger-Funktionen und Trigger
-- -----------------------------------------------------------------------------------------------------

-- 6.1 updated_at überall
do $$
declare t text;
begin
  foreach t in array array['settings', 'member_profiles', 'templates', 'sequences', 'sequence_steps', 'companies', 'leads',
                           'linkedin_connections', 'enrollments', 'calls', 'tasks', 'meetings', 'emails', 'daily_counters', 'saved_views'] loop
    execute format('create or replace trigger %I_set_updated_at before update on crm.%I for each row execute function private.set_updated_at()', t, t);
  end loop;
end
$$;

-- 6.2 Vorlagen: Platzhalter extrahieren
create or replace function crm.templates_before_write() returns trigger
language plpgsql set search_path = '' as $$
begin
  select coalesce(array_agg(distinct m[1] order by m[1]), '{}')
    into new.variables
    from regexp_matches(coalesce(new.subject, '') || E'\n' || coalesce(new.body, ''), '\[([^\[\]]+)\]', 'g') as m;
  return new;
end;
$$;
create or replace trigger templates_before_write before insert or update of subject, body on crm.templates
  for each row execute function crm.templates_before_write();

-- 6.3 Leads: Normalisierung, Stufenwechsel, Firma synchronisieren
create or replace function crm.leads_before_write() returns trigger
language plpgsql set search_path = '' as $$
declare c crm.companies;
begin
  new.first_name := nullif(btrim(coalesce(new.first_name, '')), '');
  new.last_name  := nullif(btrim(coalesce(new.last_name, '')), '');
  new.email      := nullif(lower(btrim(coalesce(new.email, ''))), '');
  new.linkedin_url := nullif(btrim(coalesce(new.linkedin_url, '')), '');
  if new.phone_e164 is not null and new.phone_e164 !~ '^\+[0-9]{7,16}$' then
    new.phone_e164 := crm.normalize_phone(new.phone_e164);
  end if;
  if new.company_id is not null then
    select * into c from crm.companies where id = new.company_id;
    if found then new.company_name := c.name; end if;
  end if;
  new.company_name := nullif(btrim(coalesce(new.company_name, '')), '');

  if tg_op = 'INSERT' then
    if new.stage = 'beendet' then new.ended_at := coalesce(new.ended_at, now()); end if;
    new.created_by := coalesce(new.created_by, auth.uid());
  else
    if new.stage is distinct from old.stage then
      -- im Import-Modus darf ein historisches Datum mitgegeben werden
      if not (crm.import_mode() and new.stage_changed_at is distinct from old.stage_changed_at) then
        new.stage_changed_at := now();
      end if;
      if new.stage = 'beendet' then
        if new.ended_reason is null then raise exception 'Beenden braucht einen Grund (ended_reason)'; end if;
        new.ended_at := coalesce(new.ended_at, now());
      elsif old.stage = 'beendet' then
        new.ended_reason := null; new.ended_at := null; new.ended_note := null;
      end if;
    end if;
    if new.owner_id is distinct from old.owner_id and new.owner_id is not null then
      new.released := false;
    end if;
    if new.released and not old.released then
      new.released_at := coalesce(new.released_at, now());
      new.owner_id := null;
    end if;
    if new.do_not_contact and not old.do_not_contact then
      new.objection_at := coalesce(new.objection_at, now());
      new.email_consent_basis := 'revoked';
    end if;
  end if;
  return new;
end;
$$;
create or replace trigger leads_before_write before insert or update on crm.leads
  for each row execute function crm.leads_before_write();

create or replace function crm.leads_after_insert() returns trigger
language plpgsql set search_path = '' as $$
begin
  perform crm.log_activity(new.id, coalesce(new.created_by, auth.uid()), 'sonstiges', 'angelegt', new.created_at,
                           p_metadata => jsonb_build_object('source', new.source, 'stage', new.stage), p_source => new.source);
  return new;
end;
$$;
create or replace trigger leads_after_insert after insert on crm.leads
  for each row execute function crm.leads_after_insert();

create or replace function crm.leads_after_update() returns trigger
language plpgsql set search_path = '' as $$
declare v_member uuid := auth.uid();
begin
  -- Stufenwechsel protokollieren (im Import-Modus schreibt der Import historisch datierte Einträge selbst);
  -- Beendet/Kunde stoppt Sequenzen und offene Aufgaben
  if new.stage is distinct from old.stage then
    if not crm.import_mode() then
      perform crm.log_activity(new.id, v_member, 'sonstiges', 'stage_wechsel', now(),
        p_outcome => new.stage::text,
        p_note => case when new.stage = 'beendet' then new.ended_note end,
        p_metadata => jsonb_build_object('from', old.stage, 'to', new.stage, 'ended_reason', new.ended_reason));
    end if;
    if new.stage in ('beendet', 'kunde') then
      perform crm.stop_enrollments(new.id, 'lead_beendet');
      update crm.tasks set status = 'abgebrochen' where lead_id = new.id and status = 'offen';
      update crm.leads set inbound_unanswered_since = null where id = new.id and inbound_unanswered_since is not null;
    end if;
  end if;

  -- Zuständigkeit: Übergabe/Freigabe protokollieren, laufende Arbeit mitnehmen
  if new.owner_id is distinct from old.owner_id then
    if new.owner_id is null then
      perform crm.log_activity(new.id, v_member, 'sonstiges', 'freigabe', now(), p_note => new.released_reason,
                               p_metadata => jsonb_build_object('from', old.owner_id));
    else
      perform crm.log_activity(new.id, v_member, 'sonstiges', 'uebergabe', now(),
                               p_metadata => jsonb_build_object('from', old.owner_id, 'to', new.owner_id));
      update crm.enrollments set member_id = new.owner_id where lead_id = new.id and status in ('aktiv', 'pausiert');
      update crm.tasks set member_id = new.owner_id where lead_id = new.id and status = 'offen';
    end if;
  end if;

  -- Widerspruch: alles stoppen, Sperrliste füllen
  if new.do_not_contact and not old.do_not_contact then
    perform crm.log_activity(new.id, v_member, 'sonstiges', 'widerspruch', coalesce(new.objection_at, now()), p_note => new.objection_note,
                             p_metadata => jsonb_build_object('channels', new.do_not_contact_channels));
    perform crm.stop_enrollments(new.id, 'widerspruch');
    update crm.tasks set status = 'abgebrochen' where lead_id = new.id and status = 'offen';
    insert into crm.sperrliste (linkedin_url_norm, email, phone_e164, name, company, reason, channels, note, lead_id, created_by)
    values (new.linkedin_url_norm, new.email, new.phone_e164, new.full_name, new.company_name, 'widerspruch',
            coalesce(new.do_not_contact_channels, array['linkedin', 'telefon', 'email']::crm.channel[]), new.objection_note, new.id, v_member)
    on conflict do nothing;
  end if;

  -- Erlaubnis-Grundlage E-Mail: Änderung revisionssicher protokollieren
  if new.email_consent_basis is distinct from old.email_consent_basis or new.email_consent_at is distinct from old.email_consent_at then
    perform crm.log_activity(new.id, v_member, 'email', 'einwilligung',
                             case when crm.import_mode() and new.email_consent_at is not null then crm.due_on(new.email_consent_at) else now() end,
                             p_outcome => new.email_consent_basis::text,
                             p_note => new.email_consent_note,
                             p_metadata => jsonb_build_object('from', old.email_consent_basis, 'to', new.email_consent_basis,
                                                              'at', new.email_consent_at, 'ref', new.email_consent_ref));
  end if;
  return new;
end;
$$;
create or replace trigger leads_after_update after update on crm.leads
  for each row execute function crm.leads_after_update();

-- 6.4 Aktivitäten: Lead-Spiegelfelder, Exit-Regel bei Antwort
create or replace function crm.activities_after_insert() returns trigger
language plpgsql set search_path = '' as $$
declare v_inbound boolean; v_outbound boolean;
begin
  v_inbound  := new.type in ('nachricht_erhalten', 'email_erhalten');
  v_outbound := new.type in ('gespraech_eroeffnet', 'nachricht_gesendet', 'pitch_gesendet', 'email_gesendet', 'anruf', 'vernetzung_gesendet');

  update crm.leads set
      last_activity_at   = greatest(coalesce(last_activity_at, new.occurred_at), new.occurred_at),
      last_activity_type = case when new.occurred_at >= coalesce(last_activity_at, new.occurred_at) then new.type else last_activity_type end,
      last_outbound_at   = case when v_outbound then greatest(coalesce(last_outbound_at, new.occurred_at), new.occurred_at) else last_outbound_at end,
      last_inbound_at    = case when v_inbound then greatest(coalesce(last_inbound_at, new.occurred_at), new.occurred_at) else last_inbound_at end,
      last_inbound_channel = case when v_inbound then new.channel else last_inbound_channel end,
      inbound_unanswered_since = case when v_inbound then coalesce(inbound_unanswered_since, new.occurred_at)
                                      when v_outbound and new.type <> 'vernetzung_gesendet' then null
                                      else inbound_unanswered_since end,
      follow_up_count    = follow_up_count + case when new.type = 'nachricht_gesendet' and new.channel = 'linkedin' and new.enrollment_id is not null then 1 else 0 end,
      url_verified       = url_verified or new.type in ('vernetzung_gesendet', 'gespraech_eroeffnet', 'nachricht_gesendet')
   where id = new.lead_id;

  -- Exit-Regel: jede eingehende Nachricht stoppt alle Sequenzen und hebt den Lead auf „Antwort erhalten“
  if v_inbound then
    perform crm.stop_enrollments(new.lead_id, 'antwort_erhalten');
    perform crm.raise_stage(new.lead_id, 'dm_beantwortet', new.member_id);
  end if;
  if new.type = 'pitch_gesendet' then perform crm.raise_stage(new.lead_id, 'pitch', new.member_id); end if;
  if new.type = 'gespraech_eroeffnet' then perform crm.raise_stage(new.lead_id, 'gespraech_eroeffnet', new.member_id); end if;
  return new;
end;
$$;
create or replace trigger activities_after_insert after insert on crm.activities
  for each row execute function crm.activities_after_insert();

-- 6.5 Vernetzungen: Aktivitäten, Zähler, Stufe, Auto-Sequenz
create or replace function crm.connections_after_write() returns trigger
language plpgsql set search_path = '' as $$
declare v_src crm.record_source := coalesce(new.source, crm.record_source_now()); v_seq text; v_auto boolean;
begin
  if tg_op = 'INSERT' and new.requested_at is not null then
    perform crm.log_activity(new.lead_id, new.member_id, 'linkedin', 'vernetzung_gesendet', new.requested_at,
                             p_metadata => jsonb_build_object('note_variant', new.note_variant), p_kpi_relevant => new.kpi_relevant, p_source => v_src);
    perform crm.raise_stage(new.lead_id, 'vernetzung_gesendet', new.member_id);
    if not crm.import_mode() and new.kpi_relevant then
      insert into crm.daily_counters (member_id, date, metric, period, value, source, updated_by)
      values (new.member_id, crm.berlin_date(new.requested_at), 'vernetzungen_versendet', 'tag', 1, 'auto', new.member_id)
      on conflict (member_id, date, metric, period) do update set value = crm.daily_counters.value + 1, updated_at = now();
    end if;
  end if;

  if new.accepted_at is not null and (tg_op = 'INSERT' or old.accepted_at is null) then
    perform crm.log_activity(new.lead_id, new.member_id, 'linkedin', 'vernetzung_angenommen', new.accepted_at,
                             p_metadata => jsonb_build_object('note_variant', new.note_variant), p_kpi_relevant => new.kpi_relevant, p_source => v_src);
    perform crm.raise_stage(new.lead_id, 'vernetzt', new.member_id);
    update crm.leads set owner_id = new.member_id where id = new.lead_id and owner_id is null and not released;
    v_auto := coalesce((crm.setting('linkedin', 'auto_enroll_on_accept'))::boolean, true);
    if v_auto and not crm.import_mode() then
      v_seq := case when new.note_variant = 'ohne' then coalesce(crm.setting('linkedin', 'default_sequence') #>> '{}', 'linkedin_standard')
                    else coalesce(crm.setting('linkedin', 'note_sequence') #>> '{}', 'linkedin_vernetzt_ohne_antwort') end;
      begin
        perform crm.enroll(new.lead_id, v_seq, new.member_id, new.accepted_at);
      exception when others then
        raise notice 'Auto-Sequenz nicht gestartet: %', sqlerrm;
      end;
    end if;
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status and new.status in ('zurueckgezogen', 'abgelaufen') then
    perform crm.log_activity(new.lead_id, new.member_id, 'linkedin',
                             case when new.status = 'zurueckgezogen' then 'vernetzung_zurueckgezogen'::crm.activity_type else 'vernetzung_abgelaufen'::crm.activity_type end,
                             coalesce(new.withdrawn_at, now()), p_source => v_src);
  end if;
  return new;
end;
$$;
create or replace trigger connections_after_write after insert or update on crm.linkedin_connections
  for each row execute function crm.connections_after_write();

create or replace function crm.connections_before_delete() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not crm.import_mode() and old.kpi_relevant and old.requested_at is not null then
    update crm.daily_counters set value = greatest(value - 1, 0), updated_at = now()
     where member_id = old.member_id and date = crm.berlin_date(old.requested_at) and metric = 'vernetzungen_versendet' and period = 'tag';
  end if;
  return old;
end;
$$;
create or replace trigger connections_before_delete before delete on crm.linkedin_connections
  for each row execute function crm.connections_before_delete();

-- 6.6 Enrollments: Kanal übernehmen, Ereignisse loggen, nächsten Schritt am Lead nachziehen
create or replace function crm.enrollments_before_write() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.channel is null then select channel into new.channel from crm.sequences where id = new.sequence_id; end if;
  if new.status in ('abgeschlossen', 'gestoppt') then new.next_due_at := null; end if;
  if new.status = 'gestoppt' then new.stopped_at := coalesce(new.stopped_at, now()); end if;
  if new.status = 'abgeschlossen' then new.completed_at := coalesce(new.completed_at, now()); end if;
  return new;
end;
$$;
create or replace trigger enrollments_before_write before insert or update on crm.enrollments
  for each row execute function crm.enrollments_before_write();

create or replace function crm.enrollments_after_write() returns trigger
language plpgsql set search_path = '' as $$
declare seq crm.sequences;
begin
  select * into seq from crm.sequences where id = new.sequence_id;
  if tg_op = 'INSERT' then
    perform crm.log_activity(new.lead_id, new.member_id, seq.channel, 'sequenz_gestartet', new.started_at,
                             p_enrollment_id => new.id, p_step_id => new.current_step_id,
                             p_metadata => jsonb_build_object('sequence', seq.key, 'position', new.current_position, 'next_due_at', new.next_due_at),
                             p_source => new.source);
  elsif new.status is distinct from old.status then
    if new.status = 'gestoppt' then
      perform crm.log_activity(new.lead_id, new.member_id, seq.channel, 'sequenz_gestoppt', now(), p_enrollment_id => new.id,
                               p_outcome => new.stopped_reason::text, p_note => new.note,
                               p_metadata => jsonb_build_object('sequence', seq.key, 'position', new.current_position, 'reason', new.stopped_reason));
    elsif new.status = 'abgeschlossen' then
      perform crm.log_activity(new.lead_id, new.member_id, seq.channel, 'sequenz_abgeschlossen', now(), p_enrollment_id => new.id,
                               p_metadata => jsonb_build_object('sequence', seq.key));
    elsif new.status = 'pausiert' then
      perform crm.log_activity(new.lead_id, new.member_id, seq.channel, 'sequenz_pausiert', now(), p_enrollment_id => new.id,
                               p_metadata => jsonb_build_object('sequence', seq.key, 'position', new.current_position));
    end if;
  end if;
  perform crm.recompute_lead_next_action(new.lead_id);
  return new;
end;
$$;
create or replace trigger enrollments_after_write after insert or update on crm.enrollments
  for each row execute function crm.enrollments_after_write();

create or replace function crm.recompute_after_delete() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.lead_id is not null then perform crm.recompute_lead_next_action(old.lead_id); end if;
  return old;
end;
$$;
create or replace trigger enrollments_after_delete after delete on crm.enrollments for each row execute function crm.recompute_after_delete();

-- 6.7 Aufgaben
create or replace function crm.tasks_after_write() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.status = 'erledigt' and old.status <> 'erledigt' and new.lead_id is not null then
    perform crm.log_activity(new.lead_id, coalesce(auth.uid(), new.member_id), case new.kind when 'rueckruf' then 'telefon'::crm.channel else 'sonstiges'::crm.channel end,
                             'aufgabe_erledigt', coalesce(new.done_at, now()), p_task_id => new.id, p_note => new.note,
                             p_metadata => jsonb_build_object('kind', new.kind, 'title', new.title));
  end if;
  if new.lead_id is not null then perform crm.recompute_lead_next_action(new.lead_id); end if;
  return new;
end;
$$;
create or replace trigger tasks_after_write after insert or update on crm.tasks for each row execute function crm.tasks_after_write();
create or replace trigger tasks_after_delete after delete on crm.tasks for each row execute function crm.recompute_after_delete();

-- 6.8 Meetings: Aktivitäten, Stufe, Exit-Regel „Meeting gebucht“, E-Mail-Nachbereitung
create or replace function crm.meetings_after_write() returns trigger
language plpgsql set search_path = '' as $$
declare v_member uuid := coalesce(auth.uid(), new.member_id); v_type_label text; v_auto boolean;
begin
  v_type_label := case new.type when 'erstgespraech' then 'Erstgespräch' when 'strategiegespraech' then 'Strategiegespräch' else 'Folgegespräch' end;

  if tg_op = 'INSERT' and new.status = 'geplant' then
    perform crm.log_activity(new.lead_id, v_member, 'sonstiges', 'meeting_geplant', new.booked_at, p_meeting_id => new.id,
                             p_metadata => jsonb_build_object('type', new.type, 'scheduled_at', new.scheduled_at), p_source => new.source);
    perform crm.raise_stage(new.lead_id, case new.type when 'erstgespraech' then 'erstgespraech_vereinbart'::crm.lead_stage
                                                        when 'strategiegespraech' then 'strategiegespraech_vereinbart'::crm.lead_stage
                                                        else 'sales_follow_up'::crm.lead_stage end, v_member);
    perform crm.stop_enrollments(new.lead_id, 'meeting_gebucht');
    update crm.leads set sales_owner_id = coalesce(sales_owner_id, new.member_id) where id = new.lead_id;
  end if;

  if (tg_op = 'INSERT' and new.status <> 'geplant') or (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    if new.status = 'stattgefunden' then
      perform crm.log_activity(new.lead_id, v_member, 'sonstiges', 'meeting_stattgefunden', new.scheduled_at, p_meeting_id => new.id,
                               p_note => new.outcome_note, p_metadata => jsonb_build_object('type', new.type), p_source => new.source);
      perform crm.raise_stage(new.lead_id, case new.type when 'erstgespraech' then 'erstgespraech'::crm.lead_stage
                                                          when 'strategiegespraech' then 'strategiegespraech'::crm.lead_stage
                                                          else 'sales_follow_up'::crm.lead_stage end, v_member);
      if new.type = 'erstgespraech' then
        -- Nachbereitung per E-Mail ist Kommunikation auf Wunsch des Leads (research/email.md §1.4 Nr. 3)
        update crm.leads set email_consent_basis = 'meeting_held', email_consent_at = crm.berlin_date(new.scheduled_at),
                             email_consent_note = coalesce(email_consent_note, 'Erstgespräch geführt (' || v_type_label || ')'),
                             email_consent_ref = jsonb_build_object('meeting_id', new.id)
         where id = new.lead_id and email_consent_basis = 'none';
        v_auto := coalesce((crm.setting('email', 'auto_enroll_after_erstgespraech'))::boolean, false);
        if v_auto and not crm.import_mode() then
          begin perform crm.enroll(new.lead_id, 'email_warm_after_erstgespraech', new.member_id, new.scheduled_at);
          exception when others then raise notice 'E-Mail-Sequenz nicht gestartet: %', sqlerrm; end;
        end if;
      end if;
    elsif new.status = 'no_show' then
      perform crm.log_activity(new.lead_id, v_member, 'sonstiges', 'meeting_no_show', new.scheduled_at, p_meeting_id => new.id,
                               p_metadata => jsonb_build_object('type', new.type), p_source => new.source);
    elsif new.status = 'abgesagt' then
      perform crm.log_activity(new.lead_id, v_member, 'sonstiges', 'meeting_abgesagt', now(), p_meeting_id => new.id,
                               p_note => new.outcome_note, p_metadata => jsonb_build_object('type', new.type), p_source => new.source);
    elsif new.status = 'verschoben' then
      perform crm.log_activity(new.lead_id, v_member, 'sonstiges', 'meeting_verschoben', now(), p_meeting_id => new.id,
                               p_metadata => jsonb_build_object('type', new.type), p_source => new.source);
    end if;
  end if;
  perform crm.recompute_lead_next_action(new.lead_id);
  return new;
end;
$$;
create or replace trigger meetings_after_write after insert or update on crm.meetings for each row execute function crm.meetings_after_write();
create or replace trigger meetings_after_delete after delete on crm.meetings for each row execute function crm.recompute_after_delete();

-- 6.9 Anrufe: Aktivität je Versuch, Stufe bei Entscheider-Gespräch
create or replace function crm.calls_before_insert() returns trigger
language plpgsql set search_path = '' as $$
declare d crm.call_outcome_defs;
begin
  select * into d from crm.call_outcome_defs where outcome = new.outcome;
  if new.attempt_no is null then
    select coalesce(max(c.attempt_no), 0) + 1 into new.attempt_no
      from crm.calls c join crm.call_outcome_defs cd on cd.outcome = c.outcome
     where c.lead_id = new.lead_id and cd.counts_attempt and c.direction = 'out'
       and c.started_at >= coalesce((select e.started_at from crm.enrollments e where e.id = new.enrollment_id), c.started_at - interval '0 seconds');
    if not coalesce(d.counts_attempt, true) then new.attempt_no := new.attempt_no - 1; end if;
  end if;
  if new.answered_at is null and coalesce(d.is_connect, false) then new.answered_at := new.started_at; end if;
  if new.ended_at is null and new.duration_sec is not null then new.ended_at := new.started_at + make_interval(secs => new.duration_sec); end if;
  if new.duration_sec is null and new.ended_at is not null then new.duration_sec := greatest(0, extract(epoch from new.ended_at - new.started_at)::int); end if;
  new.to_number := coalesce(crm.normalize_phone(new.to_number), new.to_number);
  new.from_number := coalesce(crm.normalize_phone(new.from_number), new.from_number);
  return new;
end;
$$;
create or replace trigger calls_before_insert before insert on crm.calls for each row execute function crm.calls_before_insert();

create or replace function crm.calls_after_insert() returns trigger
language plpgsql set search_path = '' as $$
declare d crm.call_outcome_defs;
begin
  select * into d from crm.call_outcome_defs where outcome = new.outcome;
  perform crm.log_activity(new.lead_id, new.member_id, 'telefon', 'anruf', new.started_at, new.template_id, new.outcome::text, new.note,
                           jsonb_build_object('direction', new.direction, 'reached_person', new.reached_person, 'reached_name', new.reached_name,
                                              'duration_sec', new.duration_sec, 'attempt_no', new.attempt_no, 'is_connect', d.is_connect, 'is_dm', d.is_dm),
                           new.enrollment_id, null, new.id, null, null, null, null, new.kpi_relevant, new.source);
  if coalesce(d.is_dm, false) then perform crm.raise_stage(new.lead_id, 'dm_beantwortet', new.member_id); end if;
  if new.direction = 'in' then
    update crm.leads set inbound_unanswered_since = null where id = new.lead_id;
  end if;
  return new;
end;
$$;
create or replace trigger calls_after_insert after insert on crm.calls for each row execute function crm.calls_after_insert();

-- 6.10 E-Mails: Aktivität bei Versand/Empfang, Erlaubnis-Snapshot
create or replace function crm.emails_before_write() returns trigger
language plpgsql set search_path = '' as $$
declare l crm.leads;
begin
  if new.direction = 'out' and new.consent_basis_snapshot is null then
    select * into l from crm.leads where id = new.lead_id;
    new.consent_basis_snapshot := l.email_consent_basis;
    new.consent_at_snapshot := l.email_consent_at;
    new.consent_note_snapshot := l.email_consent_note;
  end if;
  if new.direction = 'out' and new.status in ('sent', 'sent_confirmed', 'delivered') and new.sent_at is null then new.sent_at := now(); end if;
  if new.direction = 'in' and new.status = 'draft' then new.status := 'received'; end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status then new.status_at := now(); end if;
  new.to_address := nullif(lower(btrim(coalesce(new.to_address, ''))), '');
  return new;
end;
$$;
create or replace trigger emails_before_write before insert or update on crm.emails for each row execute function crm.emails_before_write();

create or replace function crm.emails_after_write() returns trigger
language plpgsql set search_path = '' as $$
declare v_sent_now boolean;
begin
  v_sent_now := new.direction = 'out' and new.status in ('sent', 'sent_confirmed')
                and (tg_op = 'INSERT' or old.status not in ('sent', 'sent_confirmed', 'delivered', 'replied', 'bounced'));
  if v_sent_now then
    perform crm.log_activity(new.lead_id, new.member_id, 'email', 'email_gesendet', coalesce(new.sent_at, now()), new.template_id, new.status::text, null,
                             jsonb_build_object('subject', new.subject, 'channel', new.channel, 'consent', new.consent_basis_snapshot),
                             new.enrollment_id, new.step_id, null, null, new.id, null, null, true, new.source);
    update crm.leads set privacy_notice_sent_at = coalesce(privacy_notice_sent_at, now()),
                         privacy_notice_version = coalesce(privacy_notice_version, crm.setting('email', 'privacy_notice_version') #>> '{}')
     where id = new.lead_id;
  end if;
  if tg_op = 'INSERT' and new.direction = 'in' then
    perform crm.log_activity(new.lead_id, new.member_id, 'email', 'email_erhalten', coalesce(new.sent_at, now()), null, null, null,
                             jsonb_build_object('subject', new.subject, 'from', new.from_address), null, null, null, null, new.id, null, null, true, new.source);
  end if;
  if tg_op = 'UPDATE' and new.status = 'bounced' and old.status <> 'bounced' and new.to_address is not null then
    insert into crm.sperrliste (email, name, reason, channels, note, lead_id) values (new.to_address, null, 'bounce', array['email']::crm.channel[], new.bounce_reason, new.lead_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;
create or replace trigger emails_after_write after insert or update on crm.emails for each row execute function crm.emails_after_write();

-- -----------------------------------------------------------------------------------------------------
-- 7. RPC-Funktionen (security invoker, plpgsql) – die API für das Frontend
-- -----------------------------------------------------------------------------------------------------

-- Antwort des Leads loggen (Exit-Regel läuft über den Aktivitäts-Trigger). Label steuert Folgeaktion.
create or replace function crm.log_reply(p_lead_id uuid, p_channel crm.channel default 'linkedin', p_label crm.reply_label default null,
                                         p_note text default null, p_occurred_at timestamptz default now())
returns bigint language plpgsql security invoker set search_path = '' as $$
declare v_me uuid := auth.uid(); v_id bigint; v_days int;
begin
  if not exists (select 1 from crm.leads where id = p_lead_id) then raise exception 'Lead % nicht gefunden', p_lead_id; end if;
  v_id := crm.log_activity(p_lead_id, v_me, p_channel,
                           case when p_channel = 'email' then 'email_erhalten'::crm.activity_type else 'nachricht_erhalten'::crm.activity_type end,
                           p_occurred_at, null, p_label::text, p_note, jsonb_build_object('label', p_label), p_reply_label => p_label);
  if p_label = 'widerspruch' then
    update crm.leads set do_not_contact = true, objection_note = coalesce(p_note, objection_note), objection_at = p_occurred_at,
                         stage = 'beendet', ended_reason = 'widerspruch', ended_note = coalesce(p_note, ended_note)
     where id = p_lead_id;
  elsif p_label = 'nicht_icp' then
    perform crm.set_stage(p_lead_id, 'beendet', v_me, 'nicht_icp', p_note);
  elsif p_label in ('spaeter', 'hat_partner') then
    v_days := coalesce((crm.setting('langfristig', case when p_label = 'hat_partner' then 'hat_partner_days' else 'default_days' end))::int, 60);
    perform crm.set_stage(p_lead_id, 'langfristig', v_me);
    insert into crm.tasks (lead_id, member_id, kind, title, due_at, note, created_by)
    select l.id, coalesce(l.owner_id, v_me), 'wiedervorlage', 'Langfristig nachfassen', crm.next_due(p_occurred_at, v_days, true), p_note, v_me
      from crm.leads l where l.id = p_lead_id;
  end if;
  return v_id;
end;
$$;

-- Sequenzschritt abschließen: Aktivität loggen, Stufe setzen, nächsten Schritt terminieren (oder Sequenz beenden)
create or replace function crm.complete_step(p_enrollment_id uuid, p_outcome crm.step_outcome default 'gesendet',
                                             p_note text default null, p_occurred_at timestamptz default now(), p_template_id uuid default null)
returns crm.enrollments language plpgsql security invoker set search_path = '' as $$
declare e crm.enrollments; s crm.sequence_steps; seq crm.sequences; v_me uuid; v_type crm.activity_type; v_phase crm.template_phase; v_tpl uuid;
begin
  select * into e from crm.enrollments where id = p_enrollment_id for update;
  if not found then raise exception 'Enrollment % nicht gefunden', p_enrollment_id; end if;
  if e.status not in ('aktiv', 'pausiert') then raise exception 'Sequenz ist nicht aktiv (Status %)', e.status; end if;
  select * into seq from crm.sequences where id = e.sequence_id;
  select * into s from crm.sequence_steps where id = e.current_step_id;
  v_me := coalesce(auth.uid(), e.member_id);
  v_tpl := coalesce(p_template_id, s.template_id);

  if p_outcome = 'antwort_erhalten' then
    perform crm.log_reply(e.lead_id, seq.channel, null, p_note, p_occurred_at);   -- stoppt die Sequenz über den Trigger
    select * into e from crm.enrollments where id = p_enrollment_id;
    return e;
  end if;

  if p_outcome = 'abgebrochen' then
    update crm.enrollments set status = 'gestoppt', stopped_reason = 'manuell', note = coalesce(p_note, note) where id = e.id returning * into e;
    return e;
  end if;

  if p_outcome = 'gesendet' then
    select phase into v_phase from crm.templates where id = v_tpl;
    v_type := case coalesce(s.kind, 'nachricht')
                when 'nachricht' then case when s.is_opener then 'gespraech_eroeffnet'::crm.activity_type
                                           when v_phase = 'pitch' then 'pitch_gesendet'::crm.activity_type
                                           else 'nachricht_gesendet'::crm.activity_type end
                when 'email' then 'email_gesendet'::crm.activity_type
                when 'anruf' then 'anruf'::crm.activity_type
                else 'aufgabe_erledigt'::crm.activity_type end;
    perform crm.log_activity(e.lead_id, v_me, coalesce(s.channel, seq.channel), v_type, p_occurred_at, v_tpl, 'gesendet', p_note,
                             jsonb_build_object('step', s.name, 'position', s.position, 'sequence', seq.key), e.id, s.id);
  else
    perform crm.log_activity(e.lead_id, v_me, coalesce(s.channel, seq.channel), 'schritt_uebersprungen', p_occurred_at, v_tpl, 'uebersprungen', p_note,
                             jsonb_build_object('step', s.name, 'position', s.position, 'sequence', seq.key), e.id, s.id);
  end if;

  return crm.advance_enrollment(e.id, p_occurred_at, p_outcome = 'gesendet');
end;
$$;

-- Schritt verschieben (Snooze): diesen Schritt auf neues Datum; Abstände der Folgeschritte bleiben, weil sie relativ geplant werden.
create or replace function crm.snooze_step(p_enrollment_id uuid, p_until timestamptz default null, p_days int default null, p_note text default null)
returns crm.enrollments language plpgsql security invoker set search_path = '' as $$
declare e crm.enrollments; seq crm.sequences; v_new timestamptz;
begin
  select * into e from crm.enrollments where id = p_enrollment_id for update;
  if not found then raise exception 'Enrollment % nicht gefunden', p_enrollment_id; end if;
  if e.status <> 'aktiv' then raise exception 'Nur aktive Sequenzen können verschoben werden'; end if;
  select * into seq from crm.sequences where id = e.sequence_id;
  v_new := coalesce(p_until, crm.next_due(greatest(e.next_due_at, now()), coalesce(p_days, 1), seq.weekdays_only));
  if seq.weekdays_only then v_new := crm.due_on(crm.roll_to_weekday(crm.berlin_date(v_new))) + (v_new - crm.due_on(crm.berlin_date(v_new))); end if;
  update crm.enrollments set next_due_at = v_new, snooze_count = snooze_count + 1, note = coalesce(p_note, note)
   where id = e.id returning * into e;
  perform crm.log_activity(e.lead_id, coalesce(auth.uid(), e.member_id), seq.channel, 'schritt_verschoben', now(), null, null, p_note,
                           jsonb_build_object('until', v_new, 'snooze_count', e.snooze_count, 'position', e.current_position), e.id, e.current_step_id);
  return e;
end;
$$;

create or replace function crm.snooze_task(p_task_id uuid, p_until timestamptz default null, p_days int default null)
returns crm.tasks language plpgsql security invoker set search_path = '' as $$
declare t crm.tasks;
begin
  update crm.tasks set due_at = coalesce(p_until, crm.next_due(greatest(due_at, now()), coalesce(p_days, 1), true)), snooze_count = snooze_count + 1
   where id = p_task_id and status = 'offen' returning * into t;
  if not found then raise exception 'Aufgabe % nicht gefunden oder nicht offen', p_task_id; end if;
  return t;
end;
$$;

create or replace function crm.complete_task(p_task_id uuid, p_note text default null)
returns crm.tasks language plpgsql security invoker set search_path = '' as $$
declare t crm.tasks;
begin
  update crm.tasks set status = 'erledigt', done_at = now(), note = coalesce(p_note, note)
   where id = p_task_id and status = 'offen' returning * into t;
  if not found then raise exception 'Aufgabe % nicht gefunden oder nicht offen', p_task_id; end if;
  return t;
end;
$$;

-- Vernetzungsanfrage erfassen (Schnellimport-Abhakliste, Taste E). Zähler wird vom Trigger erhöht.
create or replace function crm.log_request(p_lead_id uuid, p_member_id uuid default null, p_date date default null,
                                           p_note_variant crm.note_variant default 'ohne')
returns crm.linkedin_connections language plpgsql security invoker set search_path = '' as $$
declare v_member uuid := coalesce(p_member_id, auth.uid()); l crm.leads; c crm.linkedin_connections;
begin
  select * into l from crm.leads where id = p_lead_id;
  if not found then raise exception 'Lead % nicht gefunden', p_lead_id; end if;
  if l.do_not_contact or crm.is_blocked(l.linkedin_url_norm, l.email, l.phone_e164) then raise exception 'Lead steht auf der Sperrliste'; end if;
  if exists (select 1 from crm.linkedin_connections x where x.lead_id = p_lead_id and x.member_id <> v_member and x.status = 'ausstehend') then
    raise exception 'Die andere Person hat bereits eine offene Anfrage an diesen Lead – nur eine Anfrage je Lead';
  end if;
  insert into crm.linkedin_connections (lead_id, member_id, requested_at, status, note_variant)
  values (p_lead_id, v_member, crm.due_on(coalesce(p_date, crm.today())), 'ausstehend', p_note_variant)
  on conflict (lead_id, member_id) do update set requested_at = coalesce(crm.linkedin_connections.requested_at, excluded.requested_at),
                                                 note_variant = excluded.note_variant
  returning * into c;
  update crm.leads set owner_id = coalesce(owner_id, v_member), url_verified = true where id = p_lead_id;
  return c;
end;
$$;

-- Annahme abhaken (Taste in „Annahme prüfen“ oder aus LinkedIn-Export). Legt die Anfrage an, falls sie fehlt.
create or replace function crm.mark_accepted(p_lead_id uuid, p_member_id uuid default null, p_date date default null)
returns crm.linkedin_connections language plpgsql security invoker set search_path = '' as $$
declare v_member uuid := coalesce(p_member_id, auth.uid()); v_at timestamptz; c crm.linkedin_connections;
begin
  v_at := case when p_date is null or p_date = crm.today() then now() else crm.due_on(p_date) end;
  insert into crm.linkedin_connections (lead_id, member_id, requested_at, accepted_at, status)
  values (p_lead_id, v_member, null, v_at, 'angenommen')
  on conflict (lead_id, member_id) do update set accepted_at = coalesce(crm.linkedin_connections.accepted_at, excluded.accepted_at),
                                                 status = 'angenommen', withdrawn_at = null
  returning * into c;
  return c;
end;
$$;

-- Anruf verbuchen: legt den Anruf an (Trigger loggt die Aktivität) und führt die Standard-Folgeaktion des Ergebnisses aus.
create or replace function crm.log_call(
  p_lead_id uuid, p_outcome crm.call_outcome, p_note text default null,
  p_reached_person crm.reached_person default null, p_reached_name text default null,
  p_started_at timestamptz default now(), p_ended_at timestamptz default null, p_duration_sec int default null,
  p_callback_at timestamptz default null, p_meeting_at timestamptz default null,
  p_enrollment_id uuid default null, p_task_id uuid default null, p_template_id uuid default null,
  p_from_number text default null, p_to_number text default null, p_direction crm.call_direction default 'out',
  p_ended_reason crm.ended_reason default null)
returns crm.calls language plpgsql security invoker set search_path = '' as $$
declare v_me uuid := auth.uid(); l crm.leads; c crm.calls; d crm.call_outcome_defs; e crm.enrollments; v_days int; v_auto boolean; v_enr uuid;
begin
  select * into l from crm.leads where id = p_lead_id;
  if not found then raise exception 'Lead % nicht gefunden', p_lead_id; end if;
  if l.do_not_contact and p_direction = 'out' then raise exception 'Lead hat widersprochen – kein Anruf erlaubt'; end if;
  select * into d from crm.call_outcome_defs where outcome = p_outcome;
  v_me := coalesce(v_me, l.owner_id);

  v_enr := coalesce(p_enrollment_id, (select id from crm.enrollments where lead_id = p_lead_id and channel = 'telefon' and status in ('aktiv', 'pausiert') limit 1));

  insert into crm.calls (lead_id, member_id, direction, from_number, to_number, started_at, ended_at, duration_sec, outcome,
                         reached_person, reached_name, note, template_id, enrollment_id)
  values (p_lead_id, v_me, p_direction, coalesce(p_from_number, (select caller_number_e164 from crm.member_profiles where member_id = v_me)),
          coalesce(p_to_number, l.phone_e164), p_started_at, p_ended_at, p_duration_sec, p_outcome, p_reached_person, p_reached_name,
          p_note, p_template_id, v_enr)
  returning * into c;

  if p_task_id is not null then
    update crm.tasks set status = 'erledigt', done_at = now(), call_id = c.id where id = p_task_id and status = 'offen';
  end if;
  if p_reached_name is not null and p_reached_person = 'entscheider' and l.first_name is null then
    update crm.leads set notes = concat_ws(E'\n', notes, 'Gesprächspartner: ' || p_reached_name) where id = p_lead_id;
  end if;

  -- Folgeaktionen je Ergebnis (research/telefon.md §2.2)
  case p_outcome
    when 'busy' then
      if v_enr is not null then
        update crm.enrollments set status = 'aktiv', next_due_at = p_started_at + make_interval(mins => coalesce((crm.setting('telefon', 'busy_retry_minutes'))::int, 45)) where id = v_enr;
      end if;
    when 'no_answer', 'voicemail', 'voicemail_left' then
      if v_enr is not null then
        perform crm.advance_enrollment(v_enr, p_started_at, true);
      else
        v_auto := coalesce((crm.setting('telefon', 'auto_enroll_on_no_answer'))::boolean, true);
        if v_auto then
          begin perform crm.enroll(p_lead_id, coalesce(crm.setting('telefon', 'default_sequence') #>> '{}', 'telefon_standard'), v_me, p_started_at, 2);
          exception when others then raise notice 'Telefon-Sequenz nicht gestartet: %', sqlerrm; end;
        end if;
      end if;
    when 'wrong_number' then
      insert into crm.tasks (lead_id, member_id, kind, title, due_at, call_id, created_by)
      values (p_lead_id, v_me, 'aufgabe', 'Telefonnummer recherchieren', crm.next_due(p_started_at, 1, true), c.id, v_me);
      if v_enr is not null then update crm.enrollments set status = 'pausiert' where id = v_enr; end if;
    when 'gatekeeper', 'callback_scheduled', 'dm_interest', 'send_info' then
      insert into crm.tasks (lead_id, member_id, kind, title, due_at, call_id, note, created_by)
      values (p_lead_id, v_me, 'rueckruf',
              case p_outcome when 'send_info' then 'Rückruf nach Kurzinfo-Mail' when 'dm_interest' then 'Rückruf – Interesse, Termin anbieten' else 'Rückruf' end,
              coalesce(p_callback_at, crm.next_due(p_started_at, case p_outcome when 'send_info' then 3 else 1 end, true) + interval '1 hour'),
              c.id, p_note, v_me);
      if p_outcome = 'send_info' then
        insert into crm.tasks (lead_id, member_id, kind, title, due_at, call_id, created_by)
        values (p_lead_id, v_me, 'aufgabe', 'Kurzinfo per E-Mail senden (Erlaubnis im Lead eintragen)', p_started_at + interval '2 hours', c.id, v_me);
      end if;
      if v_enr is not null then update crm.enrollments set status = 'pausiert' where id = v_enr; end if;
    when 'gatekeeper_blocked' then
      insert into crm.tasks (lead_id, member_id, kind, title, due_at, call_id, created_by)
      values (p_lead_id, v_me, 'aufgabe', 'Kurzinfo an Zentrale/Entscheider mailen, dann Wiedervorlage', crm.next_due(p_started_at, 3, true), c.id, v_me);
      if v_enr is not null then perform crm.advance_enrollment(v_enr, p_started_at, true); end if;
    when 'meeting_booked' then
      if p_meeting_at is null then raise exception 'Termin vereinbart braucht p_meeting_at'; end if;
      insert into crm.meetings (lead_id, member_id, type, scheduled_at, status, location)
      values (p_lead_id, v_me, case when l.stage in ('erstgespraech', 'strategiegespraech_vereinbart', 'strategiegespraech', 'sales_follow_up') then 'strategiegespraech'::crm.meeting_type else 'erstgespraech'::crm.meeting_type end,
              p_meeting_at, 'geplant', 'Telefon');
    when 'not_now' then
      v_days := coalesce((crm.setting('langfristig', 'nicht_erreicht_days'))::int, 90);
      perform crm.stop_enrollments(p_lead_id, 'manuell', 'telefon');
      perform crm.set_stage(p_lead_id, 'langfristig', v_me);
      insert into crm.tasks (lead_id, member_id, kind, title, due_at, call_id, note, created_by)
      values (p_lead_id, v_me, 'wiedervorlage', 'Wiedervorlage nach „kein Bedarf aktuell“', coalesce(p_callback_at, crm.next_due(p_started_at, v_days, true)), c.id, p_note, v_me);
    when 'not_interested' then
      perform crm.set_stage(p_lead_id, 'beendet', v_me, coalesce(p_ended_reason, 'kein_interesse'), p_note);
    when 'not_icp' then
      perform crm.set_stage(p_lead_id, 'beendet', v_me, coalesce(p_ended_reason, 'nicht_icp'), p_note);
    when 'do_not_call' then
      update crm.leads set do_not_contact = true, do_not_contact_channels = coalesce(do_not_contact_channels, array['telefon']::crm.channel[]),
                           objection_note = coalesce(p_note, objection_note), objection_at = p_started_at,
                           stage = 'beendet', ended_reason = 'widerspruch', ended_note = coalesce(p_note, ended_note)
       where id = p_lead_id;
    else null;
  end case;
  return c;
end;
$$;

-- Lead an die andere Person übergeben (Pflichtnotiz); Trigger protokolliert und zieht Sequenzen/Aufgaben nach
create or replace function crm.transfer_lead(p_lead_id uuid, p_to_member uuid, p_note text)
returns crm.leads language plpgsql security invoker set search_path = '' as $$
declare l crm.leads;
begin
  if p_note is null or btrim(p_note) = '' then raise exception 'Übergabe braucht eine Notiz'; end if;
  update crm.leads set owner_id = p_to_member, released = false, notes = concat_ws(E'\n', notes, to_char(crm.today(), 'DD.MM.YYYY') || ' Übergabe: ' || p_note)
   where id = p_lead_id returning * into l;
  if not found then raise exception 'Lead % nicht gefunden', p_lead_id; end if;
  return l;
end;
$$;

-- Lead freigeben (Pool „Freigegeben“): Zuständigkeit auf Frei, Sequenzen pausieren
create or replace function crm.release_lead(p_lead_id uuid, p_reason text)
returns crm.leads language plpgsql security invoker set search_path = '' as $$
declare l crm.leads;
begin
  update crm.leads set released = true, released_reason = p_reason where id = p_lead_id returning * into l;
  if not found then raise exception 'Lead % nicht gefunden', p_lead_id; end if;
  update crm.enrollments set status = 'pausiert' where lead_id = p_lead_id and status = 'aktiv';
  return l;
end;
$$;

-- Zähler setzen oder erhöhen (Heute-Seite: ± / Direkteingabe)
create or replace function crm.set_counter(p_metric crm.metric, p_value int, p_date date default null, p_member_id uuid default null, p_delta boolean default false)
returns crm.daily_counters language plpgsql security invoker set search_path = '' as $$
declare r crm.daily_counters;
begin
  insert into crm.daily_counters (member_id, date, metric, period, value, source, updated_by)
  values (coalesce(p_member_id, auth.uid()), coalesce(p_date, crm.today()), p_metric, 'tag', greatest(p_value, 0), 'manuell', auth.uid())
  on conflict (member_id, date, metric, period) do update
    set value = greatest(case when p_delta then crm.daily_counters.value + p_value else p_value end, 0), updated_at = now(), updated_by = auth.uid()
  returning * into r;
  return r;
end;
$$;

-- Schnellimport / CSV: Upsert nach normalisierter LinkedIn-URL. Eingabe: JSON-Array von Zeilen
-- {first_name,last_name | name, salutation, company, role, role_title, linkedin_url, city, phone, email, notes, tags[]}
create or replace function crm.import_leads(p_rows jsonb, p_owner uuid default null, p_source crm.record_source default 'schnellimport',
                                            p_label text default null, p_dry_run boolean default false)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_me uuid := auth.uid(); v_owner uuid := coalesce(p_owner, auth.uid());
  v_batch uuid; r jsonb; v_norm text; v_first text; v_last text; v_name text; v_company text; v_company_id uuid;
  v_existing crm.leads; v_lead uuid; v_tag text;
  n_ins int := 0; n_upd int := 0; n_skip int := 0; n_block int := 0; n_invalid int := 0;
  v_rows jsonb := '[]'::jsonb; v_status text; v_sal crm.salutation; v_role crm.lead_role; v_phone text; v_email text; v_sales_nav text; v_url text;
  v_title text;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then raise exception 'p_rows muss ein JSON-Array sein'; end if;
  if not p_dry_run then
    insert into crm.import_batches (member_id, source, label, preset, row_count, payload)
    values (v_me, p_source, p_label, p_source::text, jsonb_array_length(p_rows), p_rows) returning id into v_batch;
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    v_name := nullif(btrim(coalesce(r->>'name', '')), '');
    v_first := nullif(btrim(coalesce(r->>'first_name', r->>'vorname', '')), '');
    v_last := nullif(btrim(coalesce(r->>'last_name', r->>'nachname', '')), '');
    v_title := nullif(btrim(coalesce(r->>'title', r->>'titel', '')), '');
    if v_first is null and v_last is null and v_name is not null then
      select sp.title, sp.first_name, sp.last_name into v_title, v_first, v_last from crm.split_person_name(v_name) sp;
      if v_name ~* '^(Herr|Hr\.)\s' and (r->>'salutation') is null and (r->>'anrede') is null then r := r || '{"salutation": "herr"}'::jsonb;
      elsif v_name ~* '^(Frau|Fr\.)\s' and (r->>'salutation') is null and (r->>'anrede') is null then r := r || '{"salutation": "frau"}'::jsonb;
      end if;
    end if;
    v_url := nullif(btrim(coalesce(r->>'linkedin_url', r->>'linkedin', r->>'url', '')), '');
    v_norm := crm.normalize_linkedin_url(v_url);
    v_sales_nav := case when v_url ~* 'linkedin\.com/sales/' then v_url end;
    if v_norm is null then v_url := null; end if;
    v_company := nullif(btrim(coalesce(r->>'company', r->>'unternehmen', r->>'firma', '')), '');
    v_phone := crm.normalize_phone(coalesce(r->>'phone', r->>'telefon'));
    v_email := nullif(lower(btrim(coalesce(r->>'email', ''))), '');
    v_sal := case lower(coalesce(r->>'salutation', r->>'anrede', '')) when 'herr' then 'herr'::crm.salutation when 'frau' then 'frau'::crm.salutation else 'neutral'::crm.salutation end;
    v_role := case
      when coalesce(r->>'role', r->>'role_title', r->>'position', '') ~* '(geschäftsführ|geschaeftsfuehr|ceo|managing director|\bgf\b)' then 'geschaeftsfuehrer'::crm.lead_role
      when coalesce(r->>'role', r->>'role_title', r->>'position', '') ~* '(inhaber|gründer|gruender|founder|owner)' then 'inhaber'::crm.lead_role
      when coalesce(r->>'role', r->>'role_title', r->>'position', '') ~* 'kundenbetreu' then 'kundenbetreuer'::crm.lead_role
      when coalesce(r->>'role', r->>'role_title', r->>'position', '') ~* 'innendienst' then 'innendienst'::crm.lead_role
      when coalesce(r->>'role', r->>'role_title', r->>'position', '') ~* '(vertrieb|sales)' then 'vertrieb'::crm.lead_role
      when coalesce(r->>'role', r->>'role_title', r->>'position', '') ~* 'projektleit' then 'projektleiter'::crm.lead_role
      when coalesce(r->>'role', r->>'role_title', r->>'position', '') <> '' then 'sonstiges'::crm.lead_role
      else 'unbekannt'::crm.lead_role end;

    if v_norm is null and v_first is null and v_last is null then
      n_invalid := n_invalid + 1; v_status := 'ungueltig';
    elsif crm.is_blocked(v_norm, v_email, v_phone) then
      n_block := n_block + 1; v_status := 'gesperrt';
    else
      v_existing := null;
      if v_norm is not null then select * into v_existing from crm.leads where linkedin_url_norm = v_norm; end if;
      if v_existing.id is null and v_norm is null and v_first is not null and v_last is not null and v_company is not null then
        select * into v_existing from crm.leads
         where lower(first_name) = lower(v_first) and lower(last_name) = lower(v_last) and crm.company_norm(company_name) = crm.company_norm(v_company) limit 1;
      end if;

      if v_existing.id is not null then
        if v_existing.stage = 'beendet' and v_existing.ended_reason in ('nicht_icp', 'nicht_qualifiziert', 'widerspruch') then
          n_skip := n_skip + 1; v_status := 'archiv';
        else
          n_upd := n_upd + 1; v_status := 'duplikat';
          if not p_dry_run then
            update crm.leads set
              first_name = coalesce(first_name, v_first), last_name = coalesce(last_name, v_last),
              company_name = coalesce(company_name, v_company), city = coalesce(city, r->>'city', r->>'ort'),
              role_title = coalesce(role_title, r->>'role_title', r->>'position', r->>'role'),
              role = case when role = 'unbekannt' then v_role else role end,
              phone_e164 = coalesce(phone_e164, v_phone), email = coalesce(email, v_email),
              sales_nav_url = coalesce(sales_nav_url, v_sales_nav),
              salutation = case when salutation = 'neutral' then v_sal else salutation end,
              notes = case when r->>'notes' is not null and (notes is null or position(r->>'notes' in notes) = 0) then concat_ws(E'\n', notes, r->>'notes') else notes end
            where id = v_existing.id;
          end if;
        end if;
      else
        n_ins := n_ins + 1; v_status := 'neu';
        if not p_dry_run then
          v_company_id := null;
          if v_company is not null then
            insert into crm.companies (name, city) values (v_company, r->>'city') on conflict (name_norm) do update set name = crm.companies.name returning id into v_company_id;
          end if;
          insert into crm.leads (salutation, title, first_name, last_name, role, role_title, company_id, company_name, city, linkedin_url, sales_nav_url,
                                 email, phone_e164, owner_id, stage, notes, source, source_batch_id, created_by, custom)
          values (v_sal, v_title, v_first, v_last, v_role, nullif(coalesce(r->>'role_title', r->>'position', r->>'role'), ''), v_company_id, v_company,
                  r->>'city', v_url, v_sales_nav, v_email, v_phone, v_owner, 'neu', r->>'notes', p_source, v_batch, v_me,
                  jsonb_build_object('import_row', r))
          returning id into v_lead;
          if jsonb_typeof(r->'tags') = 'array' then
            for v_tag in select jsonb_array_elements_text(r->'tags') loop
              insert into crm.tags (name) values (v_tag) on conflict (name) do nothing;
              insert into crm.lead_tags (lead_id, tag_id) select v_lead, id from crm.tags where name = v_tag on conflict do nothing;
            end loop;
          end if;
        end if;
      end if;
    end if;
    v_rows := v_rows || jsonb_build_object('status', v_status, 'name', concat_ws(' ', v_first, v_last), 'company', v_company, 'linkedin_url_norm', v_norm,
                                           'existing_id', v_existing.id, 'existing_stage', v_existing.stage, 'existing_owner', v_existing.owner_id);
  end loop;

  if not p_dry_run then
    update crm.import_batches set inserted = n_ins, updated = n_upd, skipped = n_skip + n_invalid, blocked = n_block,
                                  summary = jsonb_build_object('rows', v_rows) where id = v_batch;
  end if;
  return jsonb_build_object('batch_id', v_batch, 'dry_run', p_dry_run, 'inserted', n_ins, 'updated', n_upd, 'skipped', n_skip,
                            'blocked', n_block, 'invalid', n_invalid, 'rows', v_rows);
end;
$$;

-- Import rückgängig: löscht nur Leads des Batches, die seitdem keine echte Aktivität bekommen haben
create or replace function crm.undo_import(p_batch_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare n int;
begin
  delete from crm.leads l
   where l.source_batch_id = p_batch_id
     and not exists (select 1 from crm.activities a where a.lead_id = l.id and a.source = 'app' and a.type not in ('angelegt', 'import'));
  get diagnostics n = row_count;
  update crm.import_batches set undone_at = now(), summary = coalesce(summary, '{}'::jsonb) || jsonb_build_object('undone_leads', n) where id = p_batch_id;
  return jsonb_build_object('batch_id', p_batch_id, 'deleted_leads', n);
end;
$$;

-- -----------------------------------------------------------------------------------------------------
-- 8. Views
-- -----------------------------------------------------------------------------------------------------

-- Mitglieder-Sicht: public.members + Profil
create or replace view crm.members with (security_invoker = true) as
select m.user_id as id, m.email, m.display_name,
       coalesce(p.short_name, split_part(m.display_name, ' ', 1)) as short_name,
       upper(left(coalesce(p.short_name, m.display_name), 1)) as initial,
       p.linkedin_plan, p.linkedin_url, p.weekly_budget, p.daily_target, p.caller_number_e164, p.email_address, p.signature, p.calendly_url, p.preferences,
       m.created_at
  from public.members m
  left join crm.member_profiles p on p.member_id = m.user_id;
comment on view crm.members is 'Die beiden Nutzer (aus public.members) mit CRM-Profil.';

-- Heute-Queue: alle fälligen Dinge je Person, in festen Sektionen (research/linkedin.md §4.2). Frontend filtert member_id.
create or replace view crm.v_today_queue with (security_invoker = true) as
with heute as (select crm.today() as d),
items as (
  -- 1 Antworten: eingehende Nachricht ohne unsere Reaktion
  select l.owner_id as member_id, 'antworten'::text as item_kind, l.id::text as item_id, l.id as lead_id,
         l.inbound_unanswered_since as due_at, null::uuid as enrollment_id, null::uuid as step_id, null::uuid as task_id,
         null::uuid as meeting_id, null::uuid as connection_id, null::uuid as template_id,
         'Antwort ausstehend'::text as title, ('Seit ' || to_char(l.inbound_unanswered_since at time zone 'Europe/Berlin', 'DD.MM. HH24:MI'))::text as subtitle,
         coalesce(l.last_inbound_channel, 'linkedin'::crm.channel) as channel, 0 as snooze_count, true as is_must
    from crm.leads l
   where l.inbound_unanswered_since is not null and l.deleted_at is null and l.stage <> 'beendet'
  union all
  -- Sequenzschritte
  select e.member_id, 'sequenz_schritt', e.id::text, e.lead_id, e.next_due_at, e.id, s.id, null, null, null, s.template_id,
         s.name, seq.name, coalesce(s.channel, seq.channel), e.snooze_count, true
    from crm.enrollments e
    join crm.sequences seq on seq.id = e.sequence_id
    left join crm.sequence_steps s on s.id = e.current_step_id
   where e.status = 'aktiv' and e.next_due_at is not null
  union all
  -- Aufgaben (Rückruf, Wiedervorlage, Aufgabe)
  select t.member_id, t.kind::text, t.id::text, t.lead_id, t.due_at, null, null, t.id, null, null, t.template_id,
         t.title, case t.kind when 'rueckruf' then 'Rückruf' when 'wiedervorlage' then 'Wiedervorlage' else 'Aufgabe' end,
         case t.kind when 'rueckruf' then 'telefon'::crm.channel else 'sonstiges'::crm.channel end, t.snooze_count, true
    from crm.tasks t where t.status = 'offen'
  union all
  -- Meetings (geplant): heute/kommend; vergangene geplante = „Stattgefunden?“
  select m.member_id, 'meeting', m.id::text, m.lead_id, m.scheduled_at, null, null, null, m.id, null, null,
         case m.type when 'erstgespraech' then 'Erstgespräch' when 'strategiegespraech' then 'Strategiegespräch' else 'Folgegespräch' end,
         case when m.scheduled_at < now() then 'Stattgefunden? Status setzen' else to_char(m.scheduled_at at time zone 'Europe/Berlin', 'HH24:MI') || ' Uhr' end,
         'sonstiges'::crm.channel, 0, true
    from crm.meetings m where m.status = 'geplant'
  union all
  -- 4 Annahme prüfen: offene Anfragen der letzten 7 Tage
  select c.member_id, 'annahme_pruefen', c.id::text, c.lead_id, c.requested_at, null, null, null, null, c.id, null,
         'Angenommen?', 'Anfrage vom ' || to_char(c.requested_at at time zone 'Europe/Berlin', 'DD.MM.'), 'linkedin'::crm.channel, 0, false
    from crm.linkedin_connections c, heute
   where c.status = 'ausstehend' and c.requested_at is not null and crm.berlin_date(c.requested_at) >= heute.d - 7
  union all
  -- 6 Neue Anfragen: importierte Leads ohne Anfrage
  select l.owner_id, 'neue_anfrage', l.id::text, l.id, l.created_at, null, null, null, null, null, null,
         'Vernetzungsanfrage senden', coalesce(l.role_title, ''), 'linkedin'::crm.channel, 0, false
    from crm.leads l where l.stage = 'neu' and l.deleted_at is null and not l.do_not_contact
  union all
  -- 7 Zurückziehen: offene Anfragen älter als 21 Tage
  select c.member_id, 'zurueckziehen', c.id::text, c.lead_id, c.requested_at, null, null, null, null, c.id, null,
         'Anfrage zurückziehen', 'Offen seit ' || (heute.d - crm.berlin_date(c.requested_at)) || ' Tagen', 'linkedin'::crm.channel, 0, false
    from crm.linkedin_connections c, heute
   where c.status = 'ausstehend' and c.requested_at is not null
     and crm.berlin_date(c.requested_at) < heute.d - coalesce((crm.setting('linkedin', 'pending_withdraw_days'))::int, 21)
)
select i.member_id,
       case i.item_kind
         when 'antworten' then 'antworten'
         when 'annahme_pruefen' then 'annahme_pruefen'
         when 'neue_anfrage' then 'neue_anfragen'
         when 'zurueckziehen' then 'zurueckziehen'
         else case when crm.berlin_date(i.due_at) < heute.d then 'ueberfaellig'
                   when crm.berlin_date(i.due_at) = heute.d then 'heute'
                   else 'kommend' end
       end as section,
       case i.item_kind
         when 'antworten' then 1 when 'annahme_pruefen' then 4 when 'neue_anfrage' then 6 when 'zurueckziehen' then 7
         else case when crm.berlin_date(i.due_at) < heute.d then 2 when crm.berlin_date(i.due_at) = heute.d then 3 else 8 end
       end as section_order,
       i.item_kind, i.item_id, i.lead_id, l.full_name as lead_name, l.company_name, l.stage, crm.stage_rank(l.stage) as stage_rank,
       i.channel, i.due_at, crm.berlin_date(i.due_at) as due_date,
       greatest(heute.d - crm.berlin_date(i.due_at), 0) as days_overdue,
       i.title, i.subtitle, i.template_id, i.enrollment_id, i.step_id, i.task_id, i.meeting_id, i.connection_id, i.snooze_count,
       l.linkedin_url, l.phone_e164, l.email, l.salutation, l.first_name, l.last_name, l.owner_id, l.priority, l.do_not_contact,
       l.last_activity_at, l.last_activity_type, l.follow_up_count,
       -- deterministische Sortierung: Funnel-Tiefe ↓, Überfälligkeit ↓, Priorität ↓, Firma, Alter ↑
       (crm.stage_rank(l.stage) * 10000 + least(greatest(heute.d - crm.berlin_date(i.due_at), 0), 999) * 10 + l.priority) as rank_score,
       l.created_at as lead_created_at
  from items i
  join crm.leads l on l.id = i.lead_id
  cross join heute
 where l.deleted_at is null;
comment on view crm.v_today_queue is 'Heute-Queue je Person: Sektionen antworten · ueberfaellig · heute · annahme_pruefen · neue_anfragen · zurueckziehen · kommend; Sortierung über section_order, rank_score desc, lead_created_at.';

-- Kennzahl-Ereignisse: eine Zeile je Ereignis/Zähler (Basis für Monats- und Tagesansicht)
create or replace view crm.v_metric_events with (security_invoker = true) as
select c.member_id, c.date as day, c.metric, c.value, 'zaehler'::text as source, c.period
  from crm.daily_counters c
union all
select c.member_id, crm.berlin_date(c.accepted_at), 'vernetzungen_angenommen'::crm.metric, 1, 'ereignis', 'tag'::crm.counter_period
  from crm.linkedin_connections c where c.accepted_at is not null and c.kpi_relevant
union all
select c.member_id, crm.berlin_date(c.requested_at), 'ausstehend'::crm.metric, 1, 'ereignis', 'tag'
  from crm.linkedin_connections c where c.status = 'ausstehend' and c.requested_at is not null and c.kpi_relevant
union all
select a.member_id, crm.berlin_date(a.occurred_at), 'gespraeche_eroeffnet'::crm.metric, 1, 'ereignis', 'tag'
  from crm.activities a where a.type = 'gespraech_eroeffnet' and a.kpi_relevant
union all
select x.member_id, x.day, 'dm_beantwortet'::crm.metric, 1, 'ereignis', 'tag'
  from (select distinct on (a.lead_id) coalesce(a.member_id, l.owner_id) as member_id, crm.berlin_date(a.occurred_at) as day
          from crm.activities a join crm.leads l on l.id = a.lead_id
         where a.type in ('nachricht_erhalten') and a.kpi_relevant
         order by a.lead_id, a.occurred_at) x
union all
select x.member_id, x.day, 'erstgespraech_gepitcht'::crm.metric, 1, 'ereignis', 'tag'
  from (select distinct on (a.lead_id) coalesce(a.member_id, l.owner_id) as member_id, crm.berlin_date(a.occurred_at) as day
          from crm.activities a join crm.leads l on l.id = a.lead_id
         where a.type = 'pitch_gesendet' and a.kpi_relevant
         order by a.lead_id, a.occurred_at) x
union all
select coalesce(m.member_id, l.owner_id), crm.berlin_date(m.booked_at), 'erstgespraeche_vereinbart'::crm.metric, 1, 'ereignis', 'tag'
  from crm.meetings m join crm.leads l on l.id = m.lead_id where m.type = 'erstgespraech' and m.status <> 'verschoben'
union all
select coalesce(m.member_id, l.owner_id), crm.berlin_date(m.scheduled_at),
       case m.type when 'erstgespraech' then 'erstgespraeche'::crm.metric else 'strategiegespraeche'::crm.metric end, 1, 'ereignis', 'tag'
  from crm.meetings m join crm.leads l on l.id = m.lead_id where m.status = 'stattgefunden' and m.type in ('erstgespraech', 'strategiegespraech')
union all
select coalesce(m.member_id, l.owner_id), crm.berlin_date(m.scheduled_at),
       case when m.type = 'erstgespraech' and m.status = 'no_show' then 'erstgespraech_no_show'::crm.metric
            when m.type = 'erstgespraech' then 'erstgespraech_abgesagt'::crm.metric
            when m.status = 'no_show' then 'strategiegespraech_no_show'::crm.metric
            else 'strategiegespraech_abgesagt'::crm.metric end, 1, 'ereignis', 'tag'
  from crm.meetings m join crm.leads l on l.id = m.lead_id where m.status in ('no_show', 'abgesagt') and m.type in ('erstgespraech', 'strategiegespraech')
union all
select coalesce(a.member_id, l.owner_id), crm.berlin_date(a.occurred_at), 'kunden_gewonnen'::crm.metric, 1, 'ereignis', 'tag'
  from crm.activities a join crm.leads l on l.id = a.lead_id where a.type = 'stage_wechsel' and a.metadata->>'to' = 'kunde'
union all
select c.member_id, crm.berlin_date(c.started_at), 'anrufe'::crm.metric, 1, 'ereignis', 'tag'
  from crm.calls c where c.direction = 'out' and c.kpi_relevant and not c.corrected
union all
select c.member_id, crm.berlin_date(c.started_at), 'anrufe_erreicht'::crm.metric, 1, 'ereignis', 'tag'
  from crm.calls c join crm.call_outcome_defs d on d.outcome = c.outcome where c.direction = 'out' and c.kpi_relevant and not c.corrected and d.is_connect
union all
select c.member_id, crm.berlin_date(c.started_at), 'entscheider_gespraeche'::crm.metric, 1, 'ereignis', 'tag'
  from crm.calls c join crm.call_outcome_defs d on d.outcome = c.outcome where c.direction = 'out' and c.kpi_relevant and not c.corrected and d.is_dm
union all
select c.member_id, crm.berlin_date(c.started_at), 'termine_telefon'::crm.metric, 1, 'ereignis', 'tag'
  from crm.calls c where c.kpi_relevant and not c.corrected and c.outcome = 'meeting_booked'
union all
select e.member_id, crm.berlin_date(e.sent_at), 'emails_gesendet'::crm.metric, 1, 'ereignis', 'tag'
  from crm.emails e where e.direction = 'out' and e.sent_at is not null and e.status in ('sent', 'sent_confirmed', 'delivered', 'replied');
comment on view crm.v_metric_events is 'Alle KPI-Ereignisse und Zähler als Einzelzeilen (member, Tag, Kennzahl, Wert). Monats- und Tagesansichten summieren hierüber.';

-- Monats-Funnel je Person – exakt die Kennzahlen des KPI-Sheets plus Telefon/E-Mail; Quoten wie im Sheet (null statt Division durch 0)
create or replace view crm.v_funnel_monthly with (security_invoker = true) as
with m as (
  select member_id, date_trunc('month', day)::date as month, metric, sum(value)::int as value
    from crm.v_metric_events group by 1, 2, 3
), p as (
  select member_id, month,
         coalesce(sum(value) filter (where metric = 'vernetzungen_versendet'), 0) as vernetzungen_versendet,
         coalesce(sum(value) filter (where metric = 'vernetzungen_angenommen'), 0) as vernetzungen_angenommen,
         coalesce(sum(value) filter (where metric = 'ausstehend'), 0) as ausstehend,
         coalesce(sum(value) filter (where metric = 'gespraeche_eroeffnet'), 0) as gespraeche_eroeffnet,
         coalesce(sum(value) filter (where metric = 'dm_beantwortet'), 0) as dm_beantwortet,
         coalesce(sum(value) filter (where metric = 'erstgespraech_gepitcht'), 0) as erstgespraech_gepitcht,
         coalesce(sum(value) filter (where metric = 'erstgespraeche_vereinbart'), 0) as erstgespraeche_vereinbart,
         coalesce(sum(value) filter (where metric = 'erstgespraeche'), 0) as erstgespraeche,
         coalesce(sum(value) filter (where metric = 'strategiegespraeche'), 0) as strategiegespraeche,
         coalesce(sum(value) filter (where metric = 'kunden_gewonnen'), 0) as kunden_gewonnen,
         coalesce(sum(value) filter (where metric = 'erstgespraech_no_show'), 0) as erstgespraech_no_show,
         coalesce(sum(value) filter (where metric = 'erstgespraech_abgesagt'), 0) as erstgespraech_abgesagt,
         coalesce(sum(value) filter (where metric = 'strategiegespraech_no_show'), 0) as strategiegespraech_no_show,
         coalesce(sum(value) filter (where metric = 'strategiegespraech_abgesagt'), 0) as strategiegespraech_abgesagt,
         coalesce(sum(value) filter (where metric = 'anrufe'), 0) as anrufe,
         coalesce(sum(value) filter (where metric = 'anrufe_erreicht'), 0) as anrufe_erreicht,
         coalesce(sum(value) filter (where metric = 'entscheider_gespraeche'), 0) as entscheider_gespraeche,
         coalesce(sum(value) filter (where metric = 'termine_telefon'), 0) as termine_telefon,
         coalesce(sum(value) filter (where metric = 'emails_gesendet'), 0) as emails_gesendet
    from m group by member_id, month
)
select p.*, to_char(p.month, 'YYYY-MM') as month_key,
       round(p.vernetzungen_angenommen::numeric / nullif(p.vernetzungen_versendet, 0), 4) as annahme_quote,
       round(p.dm_beantwortet::numeric / nullif(p.gespraeche_eroeffnet, 0), 4) as antwort_quote,
       round(p.erstgespraech_gepitcht::numeric / nullif(p.dm_beantwortet, 0), 4) as pitch_quote,
       round(p.erstgespraeche::numeric / nullif(p.erstgespraech_gepitcht, 0), 4) as erstgespraech_quote,
       round(p.strategiegespraeche::numeric / nullif(p.erstgespraeche, 0), 4) as strategiegespraech_quote,
       round(p.kunden_gewonnen::numeric / nullif(p.strategiegespraeche, 0), 4) as kunden_quote,
       round(p.anrufe_erreicht::numeric / nullif(p.anrufe, 0), 4) as connect_rate,
       round(p.entscheider_gespraeche::numeric / nullif(p.anrufe, 0), 4) as entscheider_quote,
       round(p.termine_telefon::numeric * 100 / nullif(p.anrufe, 0), 2) as termine_pro_100_anrufe
  from p;
comment on view crm.v_funnel_monthly is 'KPI-Dashboard je Person und Monat (ersetzt das KPI-Sheet): Werte = Ereignisse (kpi_relevant) + Zähler; Quoten wie im Sheet (Angenommen/Versendet, Beantwortet/Eröffnet, Gepitcht/Beantwortet, Erstgespräche/Gepitcht, Strategie/Erstgespräche, Kunden/Strategie). No-Shows ohne Quote.';

-- Tagesübersicht je Person (Tages- & Wochenraster des Sheets)
create or replace view crm.v_daily_activity with (security_invoker = true) as
select member_id, day, date_trunc('week', day)::date as week_start, to_char(day, 'YYYY-MM') as month_key,
       coalesce(sum(value) filter (where metric = 'vernetzungen_versendet'), 0) as vernetzungen_versendet,
       coalesce(sum(value) filter (where metric = 'vernetzungen_angenommen'), 0) as vernetzungen_angenommen,
       coalesce(sum(value) filter (where metric = 'gespraeche_eroeffnet'), 0) as gespraeche_eroeffnet,
       coalesce(sum(value) filter (where metric = 'dm_beantwortet'), 0) as dm_beantwortet,
       coalesce(sum(value) filter (where metric = 'erstgespraech_gepitcht'), 0) as erstgespraech_gepitcht,
       coalesce(sum(value) filter (where metric = 'erstgespraeche'), 0) as erstgespraeche,
       coalesce(sum(value) filter (where metric = 'strategiegespraeche'), 0) as strategiegespraeche,
       coalesce(sum(value) filter (where metric = 'anrufe'), 0) as anrufe,
       coalesce(sum(value) filter (where metric = 'anrufe_erreicht'), 0) as anrufe_erreicht,
       coalesce(sum(value) filter (where metric = 'entscheider_gespraeche'), 0) as entscheider_gespraeche,
       coalesce(sum(value) filter (where metric = 'termine_telefon'), 0) as termine_telefon,
       coalesce(sum(value) filter (where metric = 'emails_gesendet'), 0) as emails_gesendet
  from crm.v_metric_events
 where period = 'tag'
 group by member_id, day;
comment on view crm.v_daily_activity is 'Tageswerte je Person (nur Tages-Ereignisse und Tageszähler, keine Monats-Importwerte) – für Tages-/Wochenraster und Sparklines.';

-- Antwortquote je Vorlage: Antwort (eingehend) innerhalb von 7 Tagen nach Versand; Meetings innerhalb von 14 Tagen
create or replace view crm.v_template_performance with (security_invoker = true) as
with sent as (
  select a.id, a.template_id, a.lead_id, a.occurred_at
    from crm.activities a
   where a.template_id is not null and a.type in ('gespraech_eroeffnet', 'nachricht_gesendet', 'pitch_gesendet', 'email_gesendet', 'anruf')
), scored as (
  select s.template_id, s.id,
         exists (select 1 from crm.activities r where r.lead_id = s.lead_id and r.type in ('nachricht_erhalten', 'email_erhalten')
                    and r.occurred_at > s.occurred_at and r.occurred_at <= s.occurred_at + interval '7 days') as replied,
         exists (select 1 from crm.meetings m where m.lead_id = s.lead_id and m.booked_at > s.occurred_at and m.booked_at <= s.occurred_at + interval '14 days') as booked,
         s.occurred_at
    from sent s
)
select t.id as template_id, t.key, t.name, t.channel, t.phase, t.active,
       count(sc.id)::int as gesendet,
       count(sc.id) filter (where sc.replied)::int as beantwortet,
       count(sc.id) filter (where sc.booked)::int as termine,
       round(count(sc.id) filter (where sc.replied)::numeric / nullif(count(sc.id), 0), 4) as antwort_quote,
       round(count(sc.id) filter (where sc.booked)::numeric / nullif(count(sc.id), 0), 4) as termin_quote,
       max(sc.occurred_at) as zuletzt_verwendet
  from crm.templates t
  left join scored sc on sc.template_id = t.id
 group by t.id;
comment on view crm.v_template_performance is 'Nutzung und Antwortquote je Vorlage (Antwort ≤ 7 Tage nach Versand, Termin ≤ 14 Tage).';

-- Pipeline-Zähler je Stufe und Zuständigkeit (Kanban-Spaltenköpfe)
create or replace view crm.v_pipeline_counts with (security_invoker = true) as
select l.owner_id, l.stage, crm.stage_rank(l.stage) as stage_rank, count(*)::int as leads,
       count(*) filter (where l.next_action_at < now())::int as ueberfaellig,
       count(*) filter (where l.next_action_at is null and l.stage not in ('beendet', 'kunde'))::int as ohne_naechsten_schritt,
       round(avg(extract(epoch from now() - l.stage_changed_at) / 86400)::numeric, 1) as tage_in_stufe
  from crm.leads l where l.deleted_at is null
 group by l.owner_id, l.stage;
comment on view crm.v_pipeline_counts is 'Anzahl Leads je Stufe und Zuständigkeit, davon überfällig und ohne nächsten Schritt; Ø Tage in der Stufe.';

-- -----------------------------------------------------------------------------------------------------
-- 9. RLS: nur angemeldete Mitglieder (private.is_member()), beide dürfen alles; calls ohne Löschen
-- -----------------------------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['settings', 'member_profiles', 'tags', 'templates', 'sequences', 'sequence_steps', 'companies', 'import_batches',
                           'leads', 'lead_tags', 'linkedin_connections', 'enrollments', 'call_outcome_defs', 'calls', 'tasks', 'meetings',
                           'emails', 'activities', 'daily_counters', 'saved_views', 'sperrliste'] loop
    execute format('alter table crm.%I enable row level security', t);
    execute format('drop policy if exists "Mitglieder lesen %s" on crm.%I', t, t);
    execute format('drop policy if exists "Mitglieder legen %s an" on crm.%I', t, t);
    execute format('drop policy if exists "Mitglieder bearbeiten %s" on crm.%I', t, t);
    execute format('drop policy if exists "Mitglieder löschen %s" on crm.%I', t, t);
    execute format('create policy "Mitglieder lesen %s" on crm.%I for select to authenticated using ((select private.is_member()))', t, t);
    execute format('create policy "Mitglieder legen %s an" on crm.%I for insert to authenticated with check ((select private.is_member()))', t, t);
    execute format('create policy "Mitglieder bearbeiten %s" on crm.%I for update to authenticated using ((select private.is_member())) with check ((select private.is_member()))', t, t);
    if t not in ('calls', 'activities') then
      execute format('create policy "Mitglieder löschen %s" on crm.%I for delete to authenticated using ((select private.is_member()))', t, t);
    end if;
  end loop;
  -- Aktivitäten: nur eigene Notizen löschen (Chronik bleibt sonst unantastbar)
  execute 'create policy "Mitglieder löschen activities" on crm.activities for delete to authenticated using ((select private.is_member()) and type = ''notiz'' and member_id = (select auth.uid()))';
end
$$;

-- -----------------------------------------------------------------------------------------------------
-- 10. Rechte: anon nichts; authenticated über RLS; service_role (Edge Functions) alles
-- -----------------------------------------------------------------------------------------------------
revoke all on schema crm from public, anon;
grant usage on schema crm to authenticated, service_role;
revoke all on all tables in schema crm from public, anon;
revoke all on all functions in schema crm from public, anon;
grant select, insert, update, delete on all tables in schema crm to authenticated;
grant all on all tables in schema crm to service_role;
grant usage, select on all sequences in schema crm to authenticated, service_role;
grant execute on all functions in schema crm to authenticated, service_role;
revoke delete on crm.calls, crm.call_outcome_defs from authenticated;
revoke truncate on all tables in schema crm from authenticated;
alter default privileges in schema crm grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema crm grant all on tables to service_role;
alter default privileges in schema crm grant usage, select on sequences to authenticated, service_role;
alter default privileges in schema crm grant execute on functions to authenticated, service_role;
alter default privileges in schema crm revoke execute on functions from public;

-- -----------------------------------------------------------------------------------------------------
-- 11. Realtime (Supabase): Haupttabellen in die Publikation, Replica Identity für Update/Delete-Events
-- -----------------------------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['leads', 'activities', 'enrollments', 'tasks', 'meetings', 'linkedin_connections', 'calls', 'emails', 'daily_counters', 'templates', 'settings'] loop
    execute format('alter table crm.%I replica identity full', t);
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
       and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'crm' and tablename = t) then
      execute format('alter publication supabase_realtime add table crm.%I', t);
    end if;
  end loop;
end
$$;

comment on schema crm is 'Steiner & Co. CRM (crm.steinerundco.de): Leads, Vernetzungen, Sequenzen, Anrufe, E-Mails, Meetings, KPIs. Zugriff nur für Mitglieder (private.is_member()).';
