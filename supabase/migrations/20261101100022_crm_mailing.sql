-- =====================================================================================================
-- CRM Steiner & Co. · Migration 22 · Mailing: Domains, Postfächer, Hochlauf, Kampagnen, Antworten, Platzierungstests.
-- Idempotent, additiv. Stand: 2026-11-01
--
-- Vincent, 01.11.2026: „Instantly bzw. Mailchimp im CRM – E-Mail-Outreach mit Warmup-Stufen, Kampagnen, mehreren Domains.“
-- Entscheidungen aus der Recherche (Scratchpad mailing/research 01–05):
--   · KEIN Aufwärm-Netz: künstliche Mails/Öffnungen/„kein Spam“-Klicks führen seit 09/2026 auf Validitys Heatwave-Blockliste
--     (dauerhaft), M3AAWG und Spamhaus werten es als Täuschung. Stattdessen ein VERDIENTER HOCHLAUF mit echten Mails
--     (Woche 1–2: 10/Tag, 3–4: 15, 5–6: 25, danach Tageslimit ≤ 50) und Schonung/Pause bei Bounces und Ablehnungen.
--   · Passive Platzierungstests an eigene Prüf-Postfächer (GMX, WEB.DE, T-Online, Gmail …): nur nachsehen, nie anfassen.
--   · Recht: Kampagnenmails nur mit Erlaubnis-Grundlage (§ 7 Abs. 2 Nr. 2 UWG) – dieselben Regeln wie bei Einzelmails
--     (lib/gates), serverseitig in crm.mail_gate(). Keine Kaltakquise-Sequenzen für DACH (Rechtsgutachten 03, Kap. 9 Nr. 7).
-- Bausteine:
--   · crm.mail_domains / mail_postfaecher (Passwort im Supabase Vault, nur der Mail-Motor liest es) / mail_mx (Anbieter der
--     Empfänger-Domains) / mail_kampagnen + _schritte + _varianten + _empfaenger + _kampagne_postfaecher / mail_platzierung /
--     mail_sperrdomains; crm.emails bekommt Kampagnen-/Postfach-Bezug (Chronik, KPIs und Gate wie bei jeder E-Mail).
--   · Mail-Motor = Edge Function mail-motor, jede Minute per pg_cron (nur wenn ein Postfach bereit ist), Schlüssel im Vault.
-- =====================================================================================================

-- -----------------------------------------------------------------------------------------------------
-- 1. Erweiterungen (der Kanal-Wert 'smtp' kommt aus Migration 21 – neue Enum-Werte müssen vor ihrer Nutzung festgeschrieben sein)
-- -----------------------------------------------------------------------------------------------------
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- -----------------------------------------------------------------------------------------------------
-- 2. Tabellen
-- -----------------------------------------------------------------------------------------------------
create table if not exists crm.mail_domains (
  id              uuid primary key default gen_random_uuid(),
  domain          text not null unique check (domain = lower(btrim(domain)) and domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$'),
  zweck           text not null default 'versand' check (zweck in ('haupt', 'versand')),
  anbieter        text not null default 'google'
                  check (anbieter in ('google', 'microsoft', 'ionos', 'strato', 'gmx', 'webde', 'tonline', 'sonstige')),
  registriert_am  date,
  website         text check (website is null or char_length(website) <= 300),
  dns             jsonb not null default '{}'::jsonb,
  dns_geprueft_at timestamptz,
  notiz           text check (notiz is null or char_length(notiz) <= 2000),
  created_by      uuid default auth.uid() references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
comment on table crm.mail_domains is 'Versand-Domains mit letzter DNS-Prüfung aus dem Browser (dns.ok = SPF, DKIM, DMARC und MX vorhanden) und Registrierungsdatum (mind. 30 Tage vor dem ersten Versand).';

create table if not exists crm.mail_postfaecher (
  id                    uuid primary key default gen_random_uuid(),
  adresse               text not null unique check (adresse = lower(btrim(adresse)) and adresse ~ '^[^@\s]+@[a-z0-9.-]+\.[a-z]{2,}$'),
  domain                text generated always as (split_part(adresse, '@', 2)) stored,
  absender_name         text not null check (char_length(btrim(absender_name)) between 1 and 120),
  member_id             uuid references auth.users (id) on delete set null,
  anbieter              text not null default 'google'
                        check (anbieter in ('google', 'microsoft', 'ionos', 'strato', 'gmx', 'webde', 'tonline', 'sonstige')),
  rolle                 text not null default 'versand' check (rolle in ('versand', 'saat')),
  smtp_host             text check (smtp_host is null or smtp_host ~ '^[a-z0-9.-]+$'),
  smtp_port             integer check (smtp_port is null or smtp_port in (465, 587)),
  smtp_sicherheit       text check (smtp_sicherheit is null or smtp_sicherheit in ('ssl', 'starttls')),
  imap_host             text not null check (imap_host ~ '^[a-z0-9.-]+$'),
  imap_port             integer not null default 993 check (imap_port = 993),
  benutzer              text not null check (char_length(benutzer) between 3 and 200),
  geheimnis_id          uuid,
  status                text not null default 'neu' check (status in ('neu', 'bereit', 'pausiert', 'fehler')),
  status_text           text check (status_text is null or char_length(status_text) <= 500),
  status_at             timestamptz not null default now(),
  fehler_folge          integer not null default 0,
  hochlauf              boolean not null default true,
  hochlauf_start        date,
  tageslimit            integer not null default 25 check (tageslimit between 0 and 50),
  mindestabstand_min    integer not null default 5 check (mindestabstand_min between 2 and 120),
  signatur              text check (signatur is null or char_length(signatur) <= 2000),
  naechster_versand_at  timestamptz,
  gesperrt_bis          timestamptz,
  abruf_at              timestamptz,
  abruf_ok_at           timestamptz,
  abruf_stand           jsonb not null default '{}'::jsonb,
  test_ergebnis         jsonb,
  created_by            uuid default auth.uid() references auth.users (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint mail_postfach_versand_braucht_smtp
    check (rolle = 'saat' or (smtp_host is not null and smtp_port is not null and smtp_sicherheit is not null))
);
comment on table crm.mail_postfaecher is 'Postfächer: versand = echte Person auf einer Versand-Domain; saat = eigenes Prüf-Postfach (GMX, WEB.DE, T-Online …) nur für passive Platzierungstests. Passwort im Vault (geheimnis_id), lesbar nur für den Mail-Motor.';
comment on column crm.mail_postfaecher.hochlauf is 'true = verdienter Hochlauf ab dem ersten Versand (10 → 15 → 25 → Tageslimit); false = Postfach ist schon lange im Einsatz.';
comment on column crm.mail_postfaecher.gesperrt_bis is 'Sendelimit/Drosselung des Anbieters – bis dahin sendet das Postfach nichts.';
create index if not exists mail_postfaecher_domain_idx on crm.mail_postfaecher (domain);

create table if not exists crm.mail_mx (
  domain      text primary key check (domain = lower(domain)),
  klasse      text not null check (klasse in ('google', 'microsoft', 'ionos', 'strato', 'tonline', 'gmx_webde', 'allinkl', 'gateway', 'sonstige', 'kein_mx')),
  hosts       text[] not null default '{}',
  geprueft_at timestamptz not null default now()
);
comment on table crm.mail_mx is 'Mail-Anbieter der Empfänger-Domains (MX per DNS-over-HTTPS durch den Mail-Motor). kein_mx = wird nicht angeschrieben.';

create table if not exists crm.mail_kampagnen (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (char_length(btrim(name)) between 1 and 120),
  status            text not null default 'entwurf' check (status in ('entwurf', 'aktiv', 'pausiert', 'beendet')),
  status_text       text check (status_text is null or char_length(status_text) <= 500),
  member_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  zeitplan          jsonb not null default '{"tage": [1, 2, 3, 4, 5], "von": "08:00", "bis": "16:00"}'::jsonb,
  tageslimit        integer not null default 50 check (tageslimit between 1 and 1000),
  neue_pro_tag      integer not null default 20 check (neue_pro_tag between 1 and 500),
  stopp_firma       boolean not null default true,
  abmelde_satz      boolean not null default true,
  abmelde_kopf      boolean not null default true,
  datenschutz_satz  boolean not null default true,
  bounce_schutz     boolean not null default true,
  notiz             text check (notiz is null or char_length(notiz) <= 2000),
  gestartet_at      timestamptz,
  beendet_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint mail_kampagnen_zeitplan check (
    jsonb_typeof(zeitplan -> 'tage') = 'array' and (zeitplan ->> 'von') ~ '^\d{2}:\d{2}$' and (zeitplan ->> 'bis') ~ '^\d{2}:\d{2}$'
    and (zeitplan ->> 'von') < (zeitplan ->> 'bis'))
);
comment on table crm.mail_kampagnen is 'E-Mail-Kampagnen (Sequenz aus Schritten mit A/B-Varianten) an Leads mit Erlaubnis-Grundlage: Zeitplan in Berliner Zeit, Tageslimits, Stopp bei Antwort (immer) und für die ganze Firma, Bounce-Schutz.';

create table if not exists crm.mail_kampagne_postfaecher (
  kampagne_id uuid not null references crm.mail_kampagnen (id) on delete cascade,
  postfach_id uuid not null references crm.mail_postfaecher (id) on delete cascade,
  primary key (kampagne_id, postfach_id)
);

create table if not exists crm.mail_schritte (
  id          uuid primary key default gen_random_uuid(),
  kampagne_id uuid not null references crm.mail_kampagnen (id) on delete cascade,
  position    smallint not null check (position between 0 and 9),
  wartetage   smallint not null default 3 check (wartetage between 0 and 60),
  im_thread   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (kampagne_id, position)
);
comment on column crm.mail_schritte.wartetage is 'Tage nach dem vorigen Schritt; fällt der Tag nicht in den Zeitplan (Wochenende, Feiertag), gilt der nächste passende.';

create table if not exists crm.mail_varianten (
  id         uuid primary key default gen_random_uuid(),
  schritt_id uuid not null references crm.mail_schritte (id) on delete cascade,
  kennung    text not null check (kennung ~ '^[A-E]$'),
  betreff    text not null default '' check (char_length(betreff) <= 200),
  text       text not null default '' check (char_length(text) <= 10000),
  aktiv      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (schritt_id, kennung)
);
comment on table crm.mail_varianten is 'A/B-Varianten je Schritt. Leerer Betreff bei Folgeschritten = „Re: <Betreff der ersten Mail>“ im selben Verlauf (echter Verlauf, kein vorgetäuschtes Re:).';

create table if not exists crm.mail_empfaenger (
  id                    uuid primary key default gen_random_uuid(),
  kampagne_id           uuid not null references crm.mail_kampagnen (id) on delete cascade,
  lead_id               uuid not null references crm.leads (id) on delete cascade,
  email                 text not null check (email = lower(btrim(email))),
  postfach_id           uuid references crm.mail_postfaecher (id) on delete set null,
  status                text not null default 'wartet'
                        check (status in ('wartet', 'aktiv', 'beantwortet', 'fertig', 'abgemeldet', 'bounce', 'gestoppt', 'fehler')),
  schritt               smallint not null default 0,
  naechster_versand_at  timestamptz,
  variablen             jsonb not null default '{}'::jsonb,
  betreff_start         text,
  letzte_message_id     text,
  referenzen            text,
  in_arbeit             uuid,
  in_arbeit_seit        timestamptz,
  versuche              smallint not null default 0,
  gestartet_at          timestamptz,
  letzter_versand_at    timestamptz,
  beantwortet_at        timestamptz,
  stopp_grund           text check (stopp_grund is null or char_length(stopp_grund) <= 300),
  abmelde_token         uuid not null default gen_random_uuid(),
  hinzugefuegt_von      uuid default auth.uid() references auth.users (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (kampagne_id, lead_id)
);
comment on table crm.mail_empfaenger is 'Leads einer Kampagne mit Fortschritt (nächster Schritt, Fälligkeit, festes Postfach) und Ausgang (beantwortet, Bounce, abgemeldet, gestoppt mit Grund).';
-- Reihenfolge der Aufnahme (in einem Zug hinzugefügte Empfänger haben dasselbe created_at)
alter table crm.mail_empfaenger add column if not exists nr bigint generated always as identity;
create index if not exists mail_empfaenger_faellig_idx on crm.mail_empfaenger (kampagne_id, status, naechster_versand_at);
create index if not exists mail_empfaenger_email_idx on crm.mail_empfaenger (email);
create index if not exists mail_empfaenger_lead_idx on crm.mail_empfaenger (lead_id);
create index if not exists mail_empfaenger_domain_idx on crm.mail_empfaenger ((split_part(email, '@', 2)), status);
create unique index if not exists mail_empfaenger_token_uidx on crm.mail_empfaenger (abmelde_token);

create table if not exists crm.mail_platzierung (
  id           uuid primary key default gen_random_uuid(),
  test         uuid not null,
  von_id       uuid not null references crm.mail_postfaecher (id) on delete cascade,
  saat_id      uuid not null references crm.mail_postfaecher (id) on delete cascade,
  message_id   text not null unique check (message_id = lower(message_id)),
  betreff      text not null check (char_length(betreff) <= 200),
  text         text not null check (char_length(text) <= 10000),
  status       text not null default 'geplant' check (status in ('geplant', 'in_arbeit', 'gesendet', 'fehler')),
  fehler       text check (fehler is null or char_length(fehler) <= 500),
  ordner       text check (ordner is null or ordner in ('posteingang', 'spam', 'fehlt')),
  gesendet_at  timestamptz,
  geprueft_at  timestamptz,
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);
comment on table crm.mail_platzierung is 'Passive Platzierungstests: eine echte Mail an jedes eigene Prüf-Postfach, danach wird nur nachgesehen, ob sie im Posteingang oder im Spam liegt (fehlt = nach 2 Stunden nicht gefunden).';
create index if not exists mail_platzierung_test_idx on crm.mail_platzierung (test);
create index if not exists mail_platzierung_offen_idx on crm.mail_platzierung (saat_id) where status = 'gesendet' and ordner is null;

create table if not exists crm.mail_sperrdomains (
  domain     text primary key check (domain = lower(btrim(domain)) and domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  grund      text check (grund is null or char_length(grund) <= 300),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
comment on table crm.mail_sperrdomains is 'Domains, an die Kampagnen nie senden (Kunden, Partner, Wettbewerber, nach einer Abmahnung die ganze Firma).';

alter table crm.emails
  add column if not exists kampagne_id   uuid references crm.mail_kampagnen (id) on delete set null,
  add column if not exists empfaenger_id uuid references crm.mail_empfaenger (id) on delete set null,
  add column if not exists schritt_id    uuid references crm.mail_schritte (id) on delete set null,
  add column if not exists variante_id   uuid references crm.mail_varianten (id) on delete set null,
  add column if not exists postfach_id   uuid references crm.mail_postfaecher (id) on delete set null,
  add column if not exists einordnung    text,
  add column if not exists hinweis       text,
  add column if not exists label         crm.reply_label,
  add column if not exists gelesen_at    timestamptz,
  add column if not exists erledigt_at   timestamptz,
  add column if not exists sofort        boolean not null default false;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'emails_einordnung_check') then
    alter table crm.emails add constraint emails_einordnung_check
      check ((einordnung is null or einordnung in ('antwort', 'abwesend', 'automatisch', 'unzustellbar'))
         and (hinweis is null or hinweis in ('abmeldung', 'kein_interesse', 'interessiert')));
  end if;
end
$$;
create index if not exists emails_kampagne_idx on crm.emails (kampagne_id, direction, status) where kampagne_id is not null;
create index if not exists emails_postfach_idx on crm.emails (postfach_id, direction, sent_at desc) where postfach_id is not null;
create index if not exists emails_sofort_idx on crm.emails (postfach_id) where sofort and status = 'draft';

do $$
declare t text;
begin
  foreach t in array array['mail_domains', 'mail_postfaecher', 'mail_kampagnen', 'mail_schritte', 'mail_varianten', 'mail_empfaenger'] loop
    execute format('create or replace trigger %I_set_updated_at before update on crm.%I for each row execute function private.set_updated_at()', t, t);
  end loop;
end
$$;

-- -----------------------------------------------------------------------------------------------------
-- 3. RLS: Mitglieder lesen alles und bearbeiten Domains, Kampagnen, Schritte, Varianten, Sperr-Domains direkt;
--    Postfächer/Empfänger nur in freigegebenen Spalten (Zugang über crm.mail_postfach_speichern). Der Motor = service_role.
-- -----------------------------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['mail_domains', 'mail_postfaecher', 'mail_mx', 'mail_kampagnen', 'mail_kampagne_postfaecher',
                           'mail_schritte', 'mail_varianten', 'mail_empfaenger', 'mail_platzierung', 'mail_sperrdomains'] loop
    execute format('alter table crm.%I enable row level security', t);
    if not exists (select 1 from pg_policies where schemaname = 'crm' and tablename = t and policyname = 'Mitglieder lesen ' || t) then
      execute format('create policy %I on crm.%I for select to authenticated using ((select private.is_member()))', 'Mitglieder lesen ' || t, t);
    end if;
    if t not in ('mail_mx', 'mail_platzierung')
       and not exists (select 1 from pg_policies where schemaname = 'crm' and tablename = t and policyname = 'Mitglieder schreiben ' || t) then
      execute format('create policy %I on crm.%I for all to authenticated using ((select private.is_member())) with check ((select private.is_member()))',
                     'Mitglieder schreiben ' || t, t);
    end if;
  end loop;
end
$$;

revoke all on crm.mail_domains, crm.mail_postfaecher, crm.mail_mx, crm.mail_kampagnen, crm.mail_kampagne_postfaecher, crm.mail_schritte,
              crm.mail_varianten, crm.mail_empfaenger, crm.mail_platzierung, crm.mail_sperrdomains from public, anon;
grant select on crm.mail_domains, crm.mail_postfaecher, crm.mail_mx, crm.mail_kampagnen, crm.mail_kampagne_postfaecher, crm.mail_schritte,
               crm.mail_varianten, crm.mail_empfaenger, crm.mail_platzierung, crm.mail_sperrdomains to authenticated;
grant insert, update, delete on crm.mail_domains, crm.mail_kampagnen, crm.mail_kampagne_postfaecher, crm.mail_schritte,
                               crm.mail_varianten, crm.mail_sperrdomains to authenticated;
grant update (absender_name, member_id, hochlauf, tageslimit, mindestabstand_min, signatur, status) on crm.mail_postfaecher to authenticated;
grant delete on crm.mail_postfaecher to authenticated;
grant update (status, stopp_grund, variablen, naechster_versand_at) on crm.mail_empfaenger to authenticated;
grant delete on crm.mail_empfaenger to authenticated;
grant all on crm.mail_domains, crm.mail_postfaecher, crm.mail_mx, crm.mail_kampagnen, crm.mail_kampagne_postfaecher, crm.mail_schritte,
             crm.mail_varianten, crm.mail_empfaenger, crm.mail_platzierung, crm.mail_sperrdomains to service_role;
-- Unibox: gelesen/erledigt/Label an eingegangenen Mails
grant update (gelesen_at, erledigt_at, label) on crm.emails to authenticated;

-- -----------------------------------------------------------------------------------------------------
-- 4. Helfer
-- -----------------------------------------------------------------------------------------------------
create or replace function private.mail_tagesbeginn(p date default null) returns timestamptz
language sql stable set search_path = '' as $$
  select (coalesce(p, (now() at time zone 'Europe/Berlin')::date)::timestamp) at time zone 'Europe/Berlin';
$$;

create or replace function private.mail_message_id(p_adresse text) returns text
language sql volatile set search_path = '' as $$
  select '<' || replace(gen_random_uuid()::text, '-', '') || '@' || lower(split_part(p_adresse, '@', 2)) || '>';
$$;

-- Sendefenster (Berliner Zeit, Wochentage 1 = Mo … 7 = So, ohne Feiertage aus crm.settings.feiertage)
create or replace function private.mail_im_fenster(p_zeitplan jsonb, p_zeit timestamptz default now()) returns boolean
language sql stable set search_path = '' as $$
  with l as (select p_zeit at time zone 'Europe/Berlin' as t)
  select (p_zeitplan -> 'tage') @> to_jsonb(extract(isodow from l.t)::int)
     and l.t::time >= (p_zeitplan ->> 'von')::time and l.t::time < (p_zeitplan ->> 'bis')::time
     and not crm.is_holiday(l.t::date)
  from l;
$$;

-- Zufälliger Zeitpunkt im Sendefenster am frühesten passenden Tag ab p_tag (Folgemails sollen nicht alle um 8:00 rausgehen)
create or replace function private.mail_naechstes_fenster(p_zeitplan jsonb, p_tag date) returns timestamptz
language plpgsql volatile set search_path = '' as $$
declare d date := p_tag; v_von time := (p_zeitplan ->> 'von')::time; v_bis time := (p_zeitplan ->> 'bis')::time; i int := 0;
begin
  while i < 21 and (not ((p_zeitplan -> 'tage') @> to_jsonb(extract(isodow from d)::int)) or crm.is_holiday(d)) loop
    d := d + 1; i := i + 1;
  end loop;
  return (d + v_von + (v_bis - v_von) * (random() * 0.8)) at time zone 'Europe/Berlin';
end;
$$;

-- Ende des heutigen Sendefensters (für die gleichmäßige Verteilung über den Tag)
create or replace function private.mail_fensterende(p_zeitplan jsonb) returns timestamptz
language sql stable set search_path = '' as $$
  select ((now() at time zone 'Europe/Berlin')::date + (p_zeitplan ->> 'bis')::time) at time zone 'Europe/Berlin';
$$;

-- Platzhalter füllen wie src/lib/platzhalter (Teilmenge für Kampagnen); Unbekanntes bleibt stehen → Motor sendet dann nicht
create or replace function crm.mail_fuellen(p_text text, p_lead uuid, p_variablen jsonb, p_postfach uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare l crm.leads; pf crm.mail_postfaecher; r text := coalesce(p_text, ''); k text; v text; v_anrede text;
begin
  select * into l from crm.leads where id = p_lead;
  select * into pf from crm.mail_postfaecher where id = p_postfach;
  v_anrede := case l.salutation::text when 'herr' then 'Herr' when 'frau' then 'Frau' else null end;
  for k, v in select key, value from jsonb_each_text(coalesce(p_variablen, '{}'::jsonb)) loop
    if nullif(btrim(v), '') is not null then r := replace(r, '[' || k || ']', btrim(v)); end if;
  end loop;
  if nullif(btrim(l.first_name), '') is not null then r := replace(r, '[Vorname]', btrim(l.first_name)); end if;
  if nullif(btrim(l.last_name), '') is not null then r := replace(r, '[Nachname]', btrim(l.last_name)); end if;
  if nullif(btrim(l.company_name), '') is not null then r := replace(r, '[Unternehmen]', btrim(l.company_name)); end if;
  if nullif(btrim(l.city), '') is not null then r := replace(r, '[Stadt]', btrim(l.city)); end if;
  if v_anrede is not null then r := replace(r, '[Anrede]', v_anrede); end if;
  if nullif(btrim(l.title), '') is not null then r := replace(r, '[Titel]', btrim(l.title)); end if;
  if nullif(btrim(l.last_name), '') is not null then
    r := replace(r, '[Briefanrede]', case l.salutation::text
      when 'herr' then 'Sehr geehrter Herr ' || coalesce(nullif(btrim(l.title), '') || ' ', '') || btrim(l.last_name)
      when 'frau' then 'Sehr geehrte Frau ' || coalesce(nullif(btrim(l.title), '') || ' ', '') || btrim(l.last_name)
      else 'Guten Tag ' || btrim(coalesce(l.first_name, '') || ' ' || l.last_name) end);
  end if;
  if pf.id is not null then
    r := replace(r, '[Absender Vorname]', split_part(btrim(pf.absender_name), ' ', 1));
    r := replace(r, '[Absender Nachname]', btrim(substr(btrim(pf.absender_name), length(split_part(btrim(pf.absender_name), ' ', 1)) + 1)));
    r := replace(r, '[Absender]', btrim(pf.absender_name));
    r := replace(r, '[Signatur]', coalesce(pf.signatur, ''));
  end if;
  return r;
end;
$$;

create or replace function private.mail_offen(p_text text) returns text[]
language sql immutable set search_path = '' as $$
  select coalesce(array_agg(distinct m[1]), '{}') from regexp_matches(coalesce(p_text, ''), '\[([^\[\]\n]{1,40})\]', 'g') as m;
$$;

-- -----------------------------------------------------------------------------------------------------
-- 5. Hochlauf und Gate
-- -----------------------------------------------------------------------------------------------------
-- Stufe eines Versand-Postfachs: vorbereitung (Domain/DNS/Verbindung fehlt) · stufe_1 (Woche 1–2, 10/Tag) · stufe_2 (Woche
-- 3–4, 15) · stufe_3 (Woche 5–6, 25) · plateau (Tageslimit) · schonung (≤ 10) · pause (0). Schonung/Pause aus den echten
-- Ergebnissen der letzten Tage: Bounce-Quote, Ablehnungen wegen Spam/Policy, letzter Platzierungstest (Recherche 02 § 7).
create or replace function crm.mail_hochlauf(p_postfach uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  p crm.mail_postfaecher; d crm.mail_domains;
  v_heute date := (now() at time zone 'Europe/Berlin')::date;
  v_woche int; v_stufe text; v_limit int; v_gruende text[] := '{}';
  v_sends14 int; v_bounces14 int; v_abgelehnt7 int; v_test uuid; v_test_ein int; v_test_n int; v_quote numeric;
  v_heute_n int;
begin
  select * into p from crm.mail_postfaecher where id = p_postfach;
  if not found then return null; end if;
  select count(*) filter (where e.status in ('sent', 'delivered', 'replied', 'bounced')), count(*) filter (where e.status = 'bounced')
    into v_sends14, v_bounces14
    from crm.emails e where e.postfach_id = p.id and e.direction = 'out' and e.sent_at > now() - interval '14 days';
  select count(*) into v_abgelehnt7 from crm.emails e
   where e.postfach_id = p.id and e.direction = 'out' and e.bounce_reason like 'Abgelehnt:%' and e.sent_at > now() - interval '7 days';
  select t.test into v_test from crm.mail_platzierung t
   where t.von_id = p.id and t.gesendet_at > now() - interval '14 days' order by t.created_at desc limit 1;
  select count(*) filter (where t.ordner = 'posteingang'), count(*) filter (where t.ordner is not null)
    into v_test_ein, v_test_n from crm.mail_platzierung t where t.test = v_test;
  select count(*) into v_heute_n from crm.emails e
   where e.postfach_id = p.id and e.direction = 'out' and e.status in ('draft', 'sent', 'delivered', 'replied', 'bounced')
     and e.created_at >= private.mail_tagesbeginn();
  v_quote := case when v_sends14 >= 20 then round(v_bounces14::numeric / v_sends14, 3) end;

  if p.rolle = 'saat' then
    v_stufe := 'saat'; v_limit := 0;
  else
    select * into d from crm.mail_domains where domain = p.domain;
    if p.status <> 'bereit' then v_gruende := v_gruende || 'Postfach ist nicht verbunden'::text; end if;
    if d.id is null then v_gruende := v_gruende || 'Domain noch nicht geprüft'::text;
    elsif not coalesce((d.dns ->> 'ok')::boolean, false) then v_gruende := v_gruende || 'DNS unvollständig (SPF, DKIM, DMARC oder MX)'::text;
    end if;
    if d.registriert_am is not null and d.registriert_am > v_heute - 30 then
      v_gruende := v_gruende || ('Domain erst ' || (v_heute - d.registriert_am) || ' Tage alt – Versand ab Tag 30')::text;
    end if;
    if cardinality(v_gruende) > 0 then
      v_stufe := 'vorbereitung'; v_limit := 0;
    else
      v_woche := (greatest(v_heute - coalesce(p.hochlauf_start, v_heute), 0)) / 7 + 1;
      if not p.hochlauf then v_stufe := 'plateau'; v_limit := p.tageslimit;
      elsif v_woche <= 2 then v_stufe := 'stufe_1'; v_limit := least(10, p.tageslimit);
      elsif v_woche <= 4 then v_stufe := 'stufe_2'; v_limit := least(15, p.tageslimit);
      elsif v_woche <= 6 then v_stufe := 'stufe_3'; v_limit := least(25, p.tageslimit);
      else v_stufe := 'plateau'; v_limit := p.tageslimit;
      end if;
      if v_abgelehnt7 >= 3 or coalesce(v_quote, 0) > 0.05 then
        v_stufe := 'pause'; v_limit := 0;
        v_gruende := array[case when v_abgelehnt7 >= 3 then v_abgelehnt7 || ' Ablehnungen wegen Spam/Richtlinien in 7 Tagen'
                                else 'Bounce-Quote ' || round(v_quote * 100, 1) || ' % in 14 Tagen (Grenze 5 %)' end];
      elsif v_abgelehnt7 >= 1 or coalesce(v_quote, 0) > 0.02 or (v_test_n >= 3 and v_test_ein::numeric / v_test_n < 0.8) then
        v_stufe := 'schonung'; v_limit := least(v_limit, 10);
        if v_abgelehnt7 >= 1 then v_gruende := v_gruende || (v_abgelehnt7 || ' Ablehnung(en) wegen Spam/Richtlinien in 7 Tagen')::text; end if;
        if coalesce(v_quote, 0) > 0.02 then v_gruende := v_gruende || ('Bounce-Quote ' || round(v_quote * 100, 1) || ' % (Ziel unter 2 %)')::text; end if;
        if v_test_n >= 3 and v_test_ein::numeric / v_test_n < 0.8 then
          v_gruende := v_gruende || ('Platzierungstest: nur ' || v_test_ein || ' von ' || v_test_n || ' im Posteingang')::text;
        end if;
      end if;
    end if;
  end if;
  return jsonb_build_object('stufe', v_stufe, 'woche', coalesce(v_woche, 0), 'limit', v_limit, 'heute', v_heute_n,
                            'gruende', to_jsonb(v_gruende), 'sends_14', v_sends14, 'bounces_14', v_bounces14,
                            'bounce_quote', v_quote, 'abgelehnt_7', v_abgelehnt7,
                            'platzierung', case when v_test_n > 0 then jsonb_build_object('posteingang', v_test_ein, 'geprueft', v_test_n) end);
end;
$$;

-- Darf dieser Empfänger jetzt eine Kampagnenmail bekommen? null = ja, sonst der Grund. Gleiche Regeln wie lib/gates.emailGate
-- (Widerspruch, Sperrliste, Firmensperre, Adresse, Erlaubnis-Grundlage, höchstens N Mails ohne Antwort) plus Domain-Sperre,
-- abgelaufene Grundlage und Löschung. Kampagnen haben keinen „Trotzdem“-Knopf – Warnungen werden hier zu Sperren.
create or replace function crm.mail_gate(p_empfaenger uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare r crm.mail_empfaenger; l crm.leads; v_monate int; v_max int; v_n int; v_seit timestamptz;
begin
  select * into r from crm.mail_empfaenger where id = p_empfaenger;
  if not found then return 'Empfänger fehlt'; end if;
  select * into l from crm.leads where id = r.lead_id;
  if not found or l.deleted_at is not null then return 'Lead gelöscht'; end if;
  if l.email_consent_basis = 'revoked'
     or (l.do_not_contact and (l.do_not_contact_channels is null or 'email' = any (l.do_not_contact_channels))) then
    return 'Widerspruch'; end if;
  if r.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' then return 'Keine gültige Adresse'; end if;
  if crm.is_blocked(null, r.email, null) then return 'Sperrliste'; end if;
  if exists (select 1 from crm.mail_sperrdomains s where s.domain = split_part(r.email, '@', 2)) then return 'Domain gesperrt'; end if;
  if exists (select 1 from crm.mail_mx m where m.domain = split_part(r.email, '@', 2) and m.klasse = 'kein_mx') then
    return 'Domain hat keinen Mailserver'; end if;
  if crm.company_blocked(l.id) then return 'Firma gesperrt'; end if;
  if l.email_consent_basis = 'none' then return 'Keine Erlaubnis-Grundlage'; end if;
  v_monate := coalesce((crm.setting('email', 'consent_max_age_months') #>> '{}')::int, 12);
  if l.email_consent_at is not null and l.email_consent_at + make_interval(months => v_monate) < (now() at time zone 'Europe/Berlin')::date
     and coalesce(crm.berlin_date(l.last_inbound_at), '-infinity'::date) <= l.email_consent_at then
    return 'Erlaubnis älter als ' || v_monate || ' Monate'; end if;
  v_max := coalesce((crm.setting('email', 'max_followups_per_consent') #>> '{}')::int, 3);
  v_seit := greatest(coalesce(l.email_consent_at::timestamp at time zone 'Europe/Berlin', '-infinity'::timestamptz),
                     coalesce(l.last_inbound_at, '-infinity'::timestamptz));
  select count(*) into v_n from crm.emails e
   where e.lead_id = l.id and e.direction = 'out' and e.status in ('sent_confirmed', 'sent', 'delivered')
     and coalesce(e.sent_at, e.status_at) > v_seit;
  if v_n >= v_max then return 'Schon ' || v_n || ' Mails ohne Antwort (Grenze ' || v_max || ')'; end if;
  return null;
end;
$$;

-- Gate der emails-Tabelle: Buchungen des Mail-Motors (Versand ist schon passiert bzw. Antwort auf eine Mail der Person) dürfen
-- nie am Gate scheitern – geprüft wird VOR dem Versand (crm.mail_gate). Sonst unverändert gegenüber Migration 4.
create or replace function crm.emails_before_write() returns trigger
language plpgsql set search_path = '' as $$
declare l crm.leads; v_phase crm.template_phase;
begin
  if new.direction = 'out' and new.consent_basis_snapshot is null then
    select * into l from crm.leads where id = new.lead_id;
    new.consent_basis_snapshot := l.email_consent_basis;
    new.consent_at_snapshot := l.email_consent_at;
    new.consent_note_snapshot := l.email_consent_note;
  end if;
  new.to_address := nullif(lower(btrim(coalesce(new.to_address, ''))), '');
  if new.direction = 'out' and new.status in ('sent', 'sent_confirmed', 'delivered') and not crm.import_mode()
     and coalesce(current_setting('crm.mail_motor', true), '') <> 'buchen'
     and (tg_op = 'INSERT' or old.status not in ('sent', 'sent_confirmed', 'delivered')) then
    select phase into v_phase from crm.templates where id = new.template_id;
    if coalesce(new.consent_basis_snapshot, 'none') in ('none', 'revoked') and coalesce(v_phase::text, '') <> 'transaktional' then
      raise exception 'Keine Erlaubnis-Grundlage – die E-Mail darf nicht als gesendet verbucht werden'; end if;
    if new.to_address is null then raise exception 'Empfängeradresse fehlt'; end if;
    if crm.is_blocked(null, new.to_address, null) then raise exception 'Adresse steht auf der Sperrliste'; end if;
    if crm.company_blocked(new.lead_id) then raise exception 'Firma ist gesperrt („Nicht anschreiben“)'; end if;
  end if;
  if new.direction = 'out' and new.status in ('sent', 'sent_confirmed', 'delivered') and new.sent_at is null then new.sent_at := now(); end if;
  if new.direction = 'in' and new.status = 'draft' then new.status := 'received'; end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status then new.status_at := now(); end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------------------------------
-- 6. Postfach speichern (Passwort in den Vault), Zugang für den Motor, Ergebnis von „Verbindung testen“
-- -----------------------------------------------------------------------------------------------------
create or replace function crm.mail_postfach_speichern(p jsonb, p_passwort text default null) returns crm.mail_postfaecher
language plpgsql security definer set search_path = '' as $$
declare r crm.mail_postfaecher; v_id uuid := nullif(p ->> 'id', '')::uuid;
begin
  if auth.uid() is null or not private.is_member() then raise exception 'Nur für angemeldete Mitglieder'; end if;
  if p_passwort is not null and char_length(btrim(p_passwort)) not between 4 and 300 then raise exception 'Passwort ungültig'; end if;
  if v_id is null then
    if p_passwort is null then raise exception 'Für ein neues Postfach fehlt das Passwort'; end if;
    insert into crm.mail_postfaecher (adresse, absender_name, member_id, anbieter, rolle, smtp_host, smtp_port, smtp_sicherheit,
                                      imap_host, imap_port, benutzer, signatur, tageslimit, hochlauf)
    values (lower(btrim(p ->> 'adresse')), btrim(p ->> 'absender_name'), coalesce(nullif(p ->> 'member_id', '')::uuid, auth.uid()),
            coalesce(nullif(p ->> 'anbieter', ''), 'google'), coalesce(nullif(p ->> 'rolle', ''), 'versand'),
            nullif(lower(btrim(p ->> 'smtp_host')), ''), nullif(p ->> 'smtp_port', '')::int, nullif(p ->> 'smtp_sicherheit', ''),
            lower(btrim(p ->> 'imap_host')), coalesce(nullif(p ->> 'imap_port', '')::int, 993),
            btrim(coalesce(nullif(p ->> 'benutzer', ''), p ->> 'adresse')), nullif(p ->> 'signatur', ''),
            coalesce(nullif(p ->> 'tageslimit', '')::int, 25), coalesce((p ->> 'hochlauf')::boolean, true))
    returning * into r;
  else
    update crm.mail_postfaecher set
        absender_name   = coalesce(nullif(btrim(p ->> 'absender_name'), ''), absender_name),
        smtp_host       = case when p ? 'smtp_host' then nullif(lower(btrim(p ->> 'smtp_host')), '') else smtp_host end,
        smtp_port       = case when p ? 'smtp_port' then nullif(p ->> 'smtp_port', '')::int else smtp_port end,
        smtp_sicherheit = case when p ? 'smtp_sicherheit' then nullif(p ->> 'smtp_sicherheit', '') else smtp_sicherheit end,
        imap_host       = coalesce(nullif(lower(btrim(p ->> 'imap_host')), ''), imap_host),
        benutzer        = coalesce(nullif(btrim(p ->> 'benutzer'), ''), benutzer),
        status          = case when p_passwort is not null and status = 'fehler' then 'neu' else status end,
        status_text     = case when p_passwort is not null and status = 'fehler' then 'Neues Passwort – bitte „Verbindung testen“' else status_text end
     where id = v_id returning * into r;
    if not found then raise exception 'Postfach nicht gefunden'; end if;
  end if;
  if p_passwort is not null then
    if r.geheimnis_id is null then
      update crm.mail_postfaecher
         set geheimnis_id = vault.create_secret(btrim(p_passwort), 'crm-postfach-' || r.id::text, 'CRM Mail-Motor: ' || r.adresse)
       where id = r.id returning * into r;
    else
      perform vault.update_secret(r.geheimnis_id, btrim(p_passwort));
    end if;
  end if;
  return r;
end;
$$;
comment on function crm.mail_postfach_speichern(jsonb, text) is
  'Postfach anlegen oder Zugang ändern; das (App-)Passwort geht direkt in den Supabase Vault und ist danach nur für den Mail-Motor lesbar.';

create or replace function private.mail_postfach_geloescht() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.geheimnis_id is not null then delete from vault.secrets where id = old.geheimnis_id; end if;
  return old;
end;
$$;
drop trigger if exists mail_postfach_geloescht on crm.mail_postfaecher;
create trigger mail_postfach_geloescht after delete on crm.mail_postfaecher for each row execute function private.mail_postfach_geloescht();

create or replace function crm.mail_motor_zugang(p_postfach uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', p.id, 'adresse', p.adresse, 'rolle', p.rolle, 'smtp_host', p.smtp_host, 'smtp_port', p.smtp_port,
                            'smtp_sicherheit', p.smtp_sicherheit, 'imap_host', p.imap_host, 'imap_port', p.imap_port,
                            'benutzer', p.benutzer, 'passwort', s.decrypted_secret, 'abruf_stand', p.abruf_stand)
    from crm.mail_postfaecher p join vault.decrypted_secrets s on s.id = p.geheimnis_id
   where p.id = p_postfach;
$$;

create or replace function crm.mail_motor_test_ergebnis(p_postfach uuid, p_ergebnis jsonb) returns crm.mail_postfaecher
language plpgsql security definer set search_path = '' as $$
declare r crm.mail_postfaecher; v_ok boolean := coalesce((p_ergebnis ->> 'ok')::boolean, false);
begin
  update crm.mail_postfaecher set
      test_ergebnis = p_ergebnis || jsonb_build_object('at', now()),
      status = case when v_ok and status in ('neu', 'fehler') then 'bereit' when not v_ok and status <> 'pausiert' then 'fehler' else status end,
      status_text = case when v_ok then null else left(coalesce(p_ergebnis ->> 'fehler', 'Verbindung fehlgeschlagen'), 500) end,
      status_at = now(),
      fehler_folge = case when v_ok then 0 else fehler_folge end,
      gesperrt_bis = case when v_ok then null else gesperrt_bis end
   where id = p_postfach returning * into r;
  return r;
end;
$$;

-- -----------------------------------------------------------------------------------------------------
-- 7. Mail-Motor: Aufträge vergeben (je Postfach höchstens einer pro Takt)
-- -----------------------------------------------------------------------------------------------------
-- Einzelmail (Antwort aus der Unibox): sofort, ohne Fenster und Kontingent – Antworten auf eine Nachricht der Person
create or replace function private.mail_auftrag_einzeln(pf crm.mail_postfaecher) returns jsonb
language plpgsql set search_path = '' as $$
declare e crm.emails;
begin
  select * into e from crm.emails where postfach_id = pf.id and sofort and status = 'draft' and direction = 'out'
   order by created_at limit 1 for update skip locked;
  if not found then return null; end if;
  update crm.emails set status_at = now() where id = e.id;
  return jsonb_build_object('art', 'einzeln', 'id', e.id, 'an', e.to_address, 'an_name', null, 'betreff', e.subject, 'text', e.body_text,
                            'message_id', e.message_id_header, 'in_reply_to', e.in_reply_to, 'references', e.references_header,
                            'kopf', '{}'::jsonb);
end;
$$;

-- Platzierungstest: geplante Test-Mail dieses Postfachs
create or replace function private.mail_auftrag_platzierung(pf crm.mail_postfaecher) returns jsonb
language plpgsql set search_path = '' as $$
declare t crm.mail_platzierung; s crm.mail_postfaecher;
begin
  select * into t from crm.mail_platzierung where von_id = pf.id and status = 'geplant' order by created_at limit 1 for update skip locked;
  if not found then return null; end if;
  select * into s from crm.mail_postfaecher where id = t.saat_id;
  update crm.mail_platzierung set status = 'in_arbeit' where id = t.id;
  return jsonb_build_object('art', 'platzierung', 'id', t.id, 'an', s.adresse, 'an_name', s.absender_name, 'betreff', t.betreff,
                            'text', t.text, 'message_id', t.message_id, 'in_reply_to', null, 'references', null, 'kopf', '{}'::jsonb);
end;
$$;

-- Kampagnenmail: fällige Folgemail dieses Postfachs oder neuer Empfänger (eine laufende Sequenz je Firma), Gate, Text füllen,
-- emails-Zeile als Entwurf. Das Kontingent kommt aus dem Hochlauf; der Abstand verteilt den Rest gleichmäßig auf das Fenster.
create or replace function private.mail_auftrag_kampagne(pf crm.mail_postfaecher, p_hochlauf jsonb, out o_job jsonb, out o_abstand interval)
language plpgsql set search_path = '' as $$
declare
  v_limit int := coalesce((p_hochlauf ->> 'limit')::int, 0);
  v_heute int := coalesce((p_hochlauf ->> 'heute')::int, 0);
  v_tag timestamptz := private.mail_tagesbeginn();
  k crm.mail_kampagnen; r crm.mail_empfaenger; s crm.mail_schritte; va crm.mail_varianten; l crm.leads;
  v_grund text; v_betreff text; v_text text; v_offen text[]; v_mid text; v_email uuid; v_kopf jsonb; v_fuss text;
  v_versuche int := 0; v_rest_s numeric; v_frei text[] := array['gmail.com', 'googlemail.com', 'gmx.de', 'gmx.net', 'web.de', 't-online.de',
    'outlook.com', 'outlook.de', 'hotmail.com', 'hotmail.de', 'yahoo.com', 'yahoo.de', 'icloud.com', 'freenet.de', 'aol.com', 'aol.de',
    'arcor.de', 'posteo.de', 'mailbox.org', 'live.de', 'msn.com'];
begin
  o_job := null;
  if pf.rolle <> 'versand' or v_heute >= v_limit then return; end if;
  for k in
    select c.* from crm.mail_kampagnen c join crm.mail_kampagne_postfaecher kp on kp.kampagne_id = c.id and kp.postfach_id = pf.id
     where c.status = 'aktiv' and private.mail_im_fenster(c.zeitplan)
     order by random()
  loop
    if (select count(*) from crm.emails e where e.kampagne_id = k.id and e.direction = 'out'
          and e.status in ('draft', 'sent', 'delivered', 'replied', 'bounced') and e.created_at >= v_tag) >= k.tageslimit then
      continue;
    end if;
    <<suche>>
    loop
      v_versuche := v_versuche + 1;
      exit when v_versuche > 10;
      r := null;
      -- 1) fällige Folgemail eines Empfängers dieses Postfachs (Folgemails haben Vorrang)
      select * into r from crm.mail_empfaenger
       where kampagne_id = k.id and postfach_id = pf.id and status = 'aktiv' and in_arbeit is null and naechster_versand_at <= now()
       order by naechster_versand_at limit 1 for update skip locked;
      -- 2) neuer Empfänger: Tageskontingent für Neue, MX bekannt, keine andere laufende Sequenz bei derselben Firma
      if r.id is null and (select count(*) from crm.mail_empfaenger x where x.kampagne_id = k.id and x.gestartet_at >= v_tag) < k.neue_pro_tag then
        select e.* into r from crm.mail_empfaenger e
         where e.kampagne_id = k.id and e.status = 'wartet' and e.in_arbeit is null and (e.postfach_id is null or e.postfach_id = pf.id)
           and (e.naechster_versand_at is null or e.naechster_versand_at <= now())
           and exists (select 1 from crm.mail_mx m where m.domain = split_part(e.email, '@', 2))
           and (split_part(e.email, '@', 2) = any (v_frei) or not exists (
                 select 1 from crm.mail_empfaenger o where o.id <> e.id and o.status = 'aktiv'
                    and split_part(o.email, '@', 2) = split_part(e.email, '@', 2)))
         order by e.nr limit 1 for update skip locked;
      end if;
      exit suche when r.id is null;

      v_grund := crm.mail_gate(r.id);
      if v_grund is not null then
        update crm.mail_empfaenger set status = case when v_grund = 'Domain hat keinen Mailserver' then 'bounce' else 'gestoppt' end,
               stopp_grund = v_grund, naechster_versand_at = null where id = r.id;
        continue suche;
      end if;
      select * into s from crm.mail_schritte where kampagne_id = k.id and position = r.schritt;
      if not found then
        update crm.mail_empfaenger set status = 'fertig', naechster_versand_at = null where id = r.id;
        continue suche;
      end if;
      select v.* into va from crm.mail_varianten v
       where v.schritt_id = s.id and v.aktiv and btrim(v.text) <> ''
       order by (select count(*) from crm.emails e where e.variante_id = v.id), random() limit 1;
      if not found then
        update crm.mail_empfaenger set status = 'fehler', stopp_grund = 'Schritt ' || (s.position + 1) || ' hat keinen aktiven Text' where id = r.id;
        continue suche;
      end if;
      select * into l from crm.leads where id = r.lead_id;
      v_betreff := btrim(crm.mail_fuellen(va.betreff, r.lead_id, r.variablen, pf.id));
      if v_betreff = '' and r.betreff_start is not null then
        v_betreff := 'Re: ' || regexp_replace(r.betreff_start, '^\s*((re|aw|antw)\s*:\s*)+', '', 'i');
      end if;
      v_text := rtrim(crm.mail_fuellen(va.text, r.lead_id, r.variablen, pf.id));
      -- Signatur, Abmelde-Satz (Art. 21 Abs. 4 DSGVO) und beim Erstkontakt der Datenschutz-Hinweis (Art. 14) – nur Text
      if nullif(btrim(coalesce(pf.signatur, '')), '') is not null and position('[Signatur]' in va.text) = 0 then
        v_text := v_text || E'\n\n' || btrim(pf.signatur);
      end if;
      v_fuss := '';
      if k.abmelde_satz then
        v_fuss := coalesce(crm.setting('email', 'objection_sentence') #>> '{}',
                           'Wenn Sie keine weiteren E-Mails von mir möchten, genügt eine kurze Antwort.');
      end if;
      if k.datenschutz_satz and r.schritt = 0 and coalesce(crm.setting('email', 'privacy_url') #>> '{}', '') <> '' then
        v_fuss := v_fuss || case when v_fuss <> '' then E'\n' else '' end
                  || 'Hinweise zum Datenschutz: ' || (crm.setting('email', 'privacy_url') #>> '{}');
      end if;
      if v_fuss <> '' then v_text := v_text || E'\n\n' || v_fuss; end if;
      v_offen := private.mail_offen(coalesce(v_betreff, '') || E'\n' || v_text);
      if coalesce(v_betreff, '') = '' or cardinality(v_offen) > 0 then
        update crm.mail_empfaenger set status = 'fehler',
               stopp_grund = case when coalesce(v_betreff, '') = '' then 'Betreff fehlt'
                                  else left('Offene Platzhalter: ' || array_to_string(v_offen, ', '), 300) end
         where id = r.id;
        continue suche;
      end if;
      v_mid := private.mail_message_id(pf.adresse);
      v_kopf := '{}'::jsonb;
      if k.abmelde_kopf then
        v_kopf := jsonb_build_object(
          'List-Unsubscribe', '<https://ekaqkfgvisdngsskzbai.supabase.co/functions/v1/mail-motor/abmelden?t=' || r.abmelde_token
                              || '>, <mailto:' || pf.adresse || '?subject=Abmelden>',
          'List-Unsubscribe-Post', 'List-Unsubscribe=One-Click');
      end if;
      insert into crm.emails (lead_id, member_id, direction, channel, from_address, to_address, subject, body_text, message_id_header,
                              in_reply_to, references_header, status, source, kampagne_id, empfaenger_id, schritt_id, variante_id, postfach_id)
      values (r.lead_id, pf.member_id, 'out', 'smtp', pf.adresse, r.email, left(v_betreff, 300), v_text, v_mid,
              case when s.im_thread and r.schritt > 0 then r.letzte_message_id end,
              case when s.im_thread and r.schritt > 0 then r.referenzen end,
              'draft', 'app', k.id, r.id, s.id, va.id, pf.id)
      returning id into v_email;
      update crm.mail_empfaenger
         set in_arbeit = v_email, in_arbeit_seit = now(), postfach_id = pf.id,
             status = case when status = 'wartet' then 'aktiv' else status end,
             gestartet_at = coalesce(gestartet_at, now())
       where id = r.id;
      o_job := jsonb_build_object('art', 'kampagne', 'id', v_email, 'an', r.email,
                                  'an_name', nullif(btrim(coalesce(l.first_name, '') || ' ' || coalesce(l.last_name, '')), ''),
                                  'betreff', left(v_betreff, 300), 'text', v_text, 'message_id', v_mid,
                                  'in_reply_to', case when s.im_thread and r.schritt > 0 then r.letzte_message_id end,
                                  'references', case when s.im_thread and r.schritt > 0 then r.referenzen end, 'kopf', v_kopf);
      -- Rest des Kontingents gleichmäßig auf das restliche Fenster verteilen (± 15 %), nie unter dem Mindestabstand
      v_rest_s := greatest(extract(epoch from (private.mail_fensterende(k.zeitplan) - now())), 0);
      o_abstand := make_interval(secs => greatest(pf.mindestabstand_min * 60, v_rest_s / greatest(v_limit - v_heute, 1)) * (0.85 + random() * 0.3));
      return;
    end loop suche;
  end loop;
end;
$$;

-- Hängengebliebene Aufträge (Motor abgebrochen) nach 10 Minuten freigeben; Platzierungstests nach 2 Stunden abschließen
create or replace function private.mail_aufraeumen() returns void
language plpgsql set search_path = '' as $$
begin
  with alt as (
    select r.id, r.in_arbeit from crm.mail_empfaenger r where r.in_arbeit is not null and r.in_arbeit_seit < now() - interval '10 minutes'
  ), weg as (
    delete from crm.emails e using alt where e.id = alt.in_arbeit and e.status = 'draft' returning e.id
  )
  update crm.mail_empfaenger r set in_arbeit = null, in_arbeit_seit = null, versuche = versuche + 1,
         status = case when versuche + 1 >= 3 then 'fehler' else status end,
         stopp_grund = case when versuche + 1 >= 3 then 'Versand dreimal abgebrochen' else stopp_grund end
    from alt where r.id = alt.id;
  update crm.mail_platzierung set status = 'fehler', fehler = 'Abgebrochen'
   where status = 'in_arbeit' and created_at < now() - interval '15 minutes';
  update crm.mail_platzierung set ordner = 'fehlt', geprueft_at = now()
   where status = 'gesendet' and ordner is null and gesendet_at < now() - interval '2 hours';
  update crm.emails set status = 'failed', bounce_reason = 'Versand abgebrochen', sofort = false
   where sofort and status = 'draft' and status_at < now() - interval '30 minutes' and created_at < now() - interval '30 minutes';
end;
$$;

create or replace function crm.mail_motor_auftraege(p_max int default 8) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare pf crm.mail_postfaecher; v_jobs jsonb := '[]'::jsonb; v_job jsonb; v_abstand interval; v_hochlauf jsonb;
begin
  perform private.mail_aufraeumen();
  for pf in
    select p.* from crm.mail_postfaecher p
     where p.status = 'bereit' and p.smtp_host is not null and p.rolle = 'versand'
       and (p.gesperrt_bis is null or p.gesperrt_bis < now())
       and (p.naechster_versand_at is null or p.naechster_versand_at <= now()
            or exists (select 1 from crm.emails e where e.postfach_id = p.id and e.sofort and e.status = 'draft'))
     order by random()
     limit greatest(p_max, 1)
     for update of p skip locked
  loop
    v_abstand := make_interval(mins => pf.mindestabstand_min);
    v_job := private.mail_auftrag_einzeln(pf);
    if v_job is null and (pf.naechster_versand_at is null or pf.naechster_versand_at <= now()) then
      v_job := private.mail_auftrag_platzierung(pf);
      if v_job is null then
        v_hochlauf := crm.mail_hochlauf(pf.id);
        select o_job, o_abstand into v_job, v_abstand from private.mail_auftrag_kampagne(pf, v_hochlauf);
      end if;
    end if;
    if v_job is not null then
      v_jobs := v_jobs || jsonb_build_array(v_job || jsonb_build_object('postfach_id', pf.id, 'von', pf.adresse, 'von_name', pf.absender_name));
      update crm.mail_postfaecher set naechster_versand_at = now() + coalesce(v_abstand, make_interval(mins => pf.mindestabstand_min))
       where id = pf.id;
    end if;
  end loop;
  return v_jobs;
end;
$$;
comment on function crm.mail_motor_auftraege(int) is
  'Mail-Motor: je Postfach höchstens ein Auftrag pro Takt (Antwort aus der Unibox > Platzierungstest > Kampagne), Kontingent aus dem Hochlauf.';

-- -----------------------------------------------------------------------------------------------------
-- 8. Mail-Motor: Ergebnis eines Versands buchen
-- -----------------------------------------------------------------------------------------------------
create or replace function crm.mail_motor_ergebnis(p_art text, p_id uuid, p_ok boolean, p_fehlerart text default null, p_fehler text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare e crm.emails; r crm.mail_empfaenger; k crm.mail_kampagnen; t crm.mail_platzierung; v_postfach uuid; v_naechster crm.mail_schritte;
begin
  if p_art = 'platzierung' then
    select * into t from crm.mail_platzierung where id = p_id for update;
    if not found then return; end if;
    v_postfach := t.von_id;
    update crm.mail_platzierung set status = case when p_ok then 'gesendet' else 'fehler' end,
           gesendet_at = case when p_ok then now() end, fehler = case when p_ok then null else left(p_fehler, 500) end
     where id = t.id;
  else
    select * into e from crm.emails where id = p_id for update;
    if not found then return; end if;
    v_postfach := e.postfach_id;
    if p_ok then
      perform set_config('crm.mail_motor', 'buchen', true);
      update crm.emails set status = 'sent', sent_at = now(), sofort = false where id = e.id;
      perform set_config('crm.mail_motor', '', true);
      update crm.mail_postfaecher set hochlauf_start = coalesce(hochlauf_start, (now() at time zone 'Europe/Berlin')::date)
       where id = v_postfach and hochlauf_start is null;
      if e.empfaenger_id is not null then
        select * into r from crm.mail_empfaenger where id = e.empfaenger_id for update;
        select * into k from crm.mail_kampagnen where id = r.kampagne_id;
        select * into v_naechster from crm.mail_schritte where kampagne_id = r.kampagne_id and position = r.schritt + 1;
        update crm.mail_empfaenger set
            in_arbeit = null, in_arbeit_seit = null, versuche = 0, schritt = r.schritt + 1,
            betreff_start = coalesce(betreff_start, e.subject), letzte_message_id = e.message_id_header,
            referenzen = btrim(coalesce(referenzen, '') || ' ' || e.message_id_header), letzter_versand_at = now(),
            status = case when status = 'aktiv' and v_naechster.id is null then 'fertig' else status end,
            naechster_versand_at = case when v_naechster.id is null then null
                                        else private.mail_naechstes_fenster(k.zeitplan, crm.berlin_date(now()) + greatest(v_naechster.wartetage, 1)) end
         where id = r.id;
      end if;
    else
      if e.empfaenger_id is not null then
        update crm.mail_empfaenger set
            in_arbeit = null, in_arbeit_seit = null, versuche = versuche + 1,
            status = case when p_fehlerart = 'empfaenger' then 'bounce' when versuche + 1 >= 3 then 'fehler' else status end,
            stopp_grund = case when p_fehlerart = 'empfaenger' then left('Adresse abgelehnt: ' || coalesce(p_fehler, ''), 300)
                               when versuche + 1 >= 3 then left('Versand dreimal fehlgeschlagen: ' || coalesce(p_fehler, ''), 300)
                               else stopp_grund end,
            naechster_versand_at = now() + interval '30 minutes'
         where id = e.empfaenger_id;
        if p_fehlerart = 'empfaenger' then
          insert into crm.sperrliste (email, reason, channels, note, lead_id)
          values (e.to_address, 'bounce', array['email']::crm.channel[], left(p_fehler, 500), e.lead_id) on conflict do nothing;
        end if;
        delete from crm.emails where id = e.id and status = 'draft';
      elsif p_fehlerart in ('voruebergehend', 'drossel', 'limit') and e.sofort then
        null; -- Einzelmail bleibt Entwurf und geht im nächsten möglichen Takt raus
      else
        update crm.emails set status = 'failed', bounce_reason = left(p_fehler, 500), sofort = false where id = e.id;
      end if;
    end if;
  end if;
  if p_ok then
    update crm.mail_postfaecher set fehler_folge = 0 where id = v_postfach and fehler_folge <> 0;
  elsif p_fehlerart = 'anmeldung' then
    update crm.mail_postfaecher set status = 'fehler', status_at = now(),
           status_text = left('Anmeldung abgelehnt – App-Passwort prüfen: ' || coalesce(p_fehler, ''), 500)
     where id = v_postfach;
  elsif p_fehlerart = 'limit' then
    update crm.mail_postfaecher set gesperrt_bis = private.mail_tagesbeginn() + interval '1 day 7 hours', status_at = now(),
           status_text = left('Sendelimit des Anbieters erreicht – Pause bis morgen 7 Uhr: ' || coalesce(p_fehler, ''), 500)
     where id = v_postfach;
  elsif p_fehlerart = 'drossel' then
    update crm.mail_postfaecher set gesperrt_bis = now() + interval '1 hour', status_at = now(),
           status_text = left('Anbieter drosselt – eine Stunde Pause: ' || coalesce(p_fehler, ''), 500)
     where id = v_postfach;
  elsif p_fehlerart = 'abgelehnt' then
    update crm.mail_postfaecher set gesperrt_bis = now() + interval '1 day', status_at = now(),
           status_text = left('Vom Server abgelehnt (Spam/Richtlinie) – 24 Stunden Pause, Texte und DNS prüfen: ' || coalesce(p_fehler, ''), 500)
     where id = v_postfach;
  elsif coalesce(p_fehlerart, '') <> 'empfaenger' then
    update crm.mail_postfaecher set fehler_folge = fehler_folge + 1,
           status = case when fehler_folge + 1 >= 5 then 'fehler' else status end,
           status_text = case when fehler_folge + 1 >= 5 then left('Fünfmal hintereinander fehlgeschlagen: ' || coalesce(p_fehler, ''), 500) else status_text end,
           status_at = case when fehler_folge + 1 >= 5 then now() else status_at end
     where id = v_postfach;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------------------------------
-- 9. Mail-Motor: MX der Empfänger-Domains
-- -----------------------------------------------------------------------------------------------------
create or replace function crm.mail_motor_mx_offen(p_max int default 30) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(d), '{}') from (
    select distinct split_part(r.email, '@', 2) as d from crm.mail_empfaenger r
     where r.status in ('wartet', 'aktiv')
       and not exists (select 1 from crm.mail_mx m where m.domain = split_part(r.email, '@', 2) and m.geprueft_at > now() - interval '30 days')
     limit greatest(p_max, 1)
  ) x;
$$;

create or replace function crm.mail_motor_mx_setzen(p_eintraege jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into crm.mail_mx (domain, klasse, hosts, geprueft_at)
  select lower(x ->> 'domain'), x ->> 'klasse', coalesce(array(select jsonb_array_elements_text(x -> 'hosts')), '{}'), now()
    from jsonb_array_elements(coalesce(p_eintraege, '[]'::jsonb)) x
  on conflict (domain) do update set klasse = excluded.klasse, hosts = excluded.hosts, geprueft_at = now();
$$;

-- -----------------------------------------------------------------------------------------------------
-- 10. Mail-Motor: Abruf (IMAP) – welche Postfächer, und was mit eingegangenen Mails passiert
-- -----------------------------------------------------------------------------------------------------
create or replace function crm.mail_motor_abruf_liste(p_max int default 3) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  with faellig as (
    select p.id from crm.mail_postfaecher p
     where p.status = 'bereit' and p.geheimnis_id is not null
       and (p.rolle = 'versand' or exists (select 1 from crm.mail_platzierung t where t.saat_id = p.id and t.status = 'gesendet' and t.ordner is null))
       and (p.abruf_at is null or p.abruf_at < now() - case when p.rolle = 'saat' then interval '3 minutes' else interval '4 minutes' end)
     order by p.abruf_at nulls first limit greatest(p_max, 1) for update skip locked
  ), gesetzt as (
    update crm.mail_postfaecher p set abruf_at = now() from faellig f where p.id = f.id returning p.id
  ) select coalesce(jsonb_agg(id), '[]'::jsonb) into v from gesetzt;
  return v;
end;
$$;

create or replace function crm.mail_motor_eingang(p_postfach uuid, p_posten jsonb, p_stand jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  pf crm.mail_postfaecher; x jsonb; v_aktionen jsonb := '[]'::jsonb; v_art text; v_ein jsonb; v_bezug text[];
  aus crm.emails; r crm.mail_empfaenger; k crm.mail_kampagnen; v_aktion text; v_hinweis text; v_mid text; v_von text; v_bis date;
  v_quote numeric; v_n int;
begin
  select * into pf from crm.mail_postfaecher where id = p_postfach for update;
  if not found then return '[]'::jsonb; end if;
  for x in select * from jsonb_array_elements(coalesce(p_posten, '[]'::jsonb)) loop
    v_aktion := 'nichts';
    v_ein := x -> 'einordnung';
    v_art := v_ein ->> 'art';
    v_mid := nullif(lower(x ->> 'message_id'), '');
    v_von := lower(coalesce(x ->> 'von', ''));
    select coalesce(array_agg(lower(t)), '{}') into v_bezug from jsonb_array_elements_text(coalesce(x -> 'bezug', '[]'::jsonb)) t;
    aus := null; r := null; k := null;

    -- Bezug zu einer eigenen ausgehenden Mail (Kampagne oder Antwort aus der Unibox über dieses Postfach)
    select * into aus from crm.emails e
     where e.direction = 'out' and e.message_id_header = any (v_bezug) order by e.sent_at desc nulls last limit 1;
    if aus.id is null and v_art = 'unzustellbar' and nullif(v_ein ->> 'empfaenger', '') is not null then
      select * into aus from crm.emails e
       where e.direction = 'out' and e.postfach_id = pf.id and e.to_address = lower(v_ein ->> 'empfaenger')
         and e.sent_at > now() - interval '14 days' order by e.sent_at desc limit 1;
    end if;
    if aus.id is null and v_art in ('antwort', 'abwesend') and v_von <> '' then
      select * into aus from crm.emails e
       where e.direction = 'out' and e.postfach_id = pf.id and e.to_address = v_von and e.sent_at > now() - interval '60 days'
       order by e.sent_at desc limit 1;
    end if;
    if aus.id is null or (v_mid is not null and exists (select 1 from crm.emails e where e.message_id_header = v_mid)) then
      v_aktionen := v_aktionen || jsonb_build_array(jsonb_build_object('ordner', x ->> 'ordner', 'uid', (x ->> 'uid')::bigint, 'aktion', 'nichts'));
      continue;
    end if;
    if aus.empfaenger_id is not null then select * into r from crm.mail_empfaenger where id = aus.empfaenger_id for update; end if;
    if r.id is not null then select * into k from crm.mail_kampagnen where id = r.kampagne_id; end if;

    if v_art = 'unzustellbar' then
      if coalesce((v_ein ->> 'hart')::boolean, false) and (v_ein ->> 'grund') in ('adresse_ungueltig', 'domain_ungueltig', 'sonstiges') then
        update crm.emails set status = 'bounced', bounce_reason = left(coalesce(v_ein ->> 'meldung', v_ein ->> 'status', 'Unzustellbar'), 500)
         where id = aus.id and status in ('sent', 'delivered');
        if r.id is not null then
          update crm.mail_empfaenger set status = 'bounce', naechster_versand_at = null,
                 stopp_grund = left('Unzustellbar: ' || coalesce(v_ein ->> 'status', '') || ' ' || coalesce(v_ein ->> 'meldung', ''), 300)
           where id = r.id and status in ('wartet', 'aktiv', 'fertig');
          -- Bounce-Schutz: Kampagne anhalten, wenn mehr als 3 % unzustellbar (ab 30 Mails) – Liste prüfen
          if k.bounce_schutz then
            select count(*) filter (where e.status = 'bounced')::numeric / nullif(count(*), 0), count(*) into v_quote, v_n
              from crm.emails e where e.kampagne_id = k.id and e.direction = 'out' and e.status in ('sent', 'delivered', 'replied', 'bounced');
            if v_n >= 30 and v_quote > 0.03 and k.status = 'aktiv' then
              update crm.mail_kampagnen set status = 'pausiert',
                     status_text = 'Automatisch angehalten: ' || round(v_quote * 100, 1) || ' % unzustellbar (Grenze 3 %) – Adressen prüfen, dann fortsetzen'
               where id = k.id;
            end if;
          end if;
        end if;
      elsif coalesce((v_ein ->> 'hart')::boolean, false) and (v_ein ->> 'grund') = 'abgelehnt' then
        -- Der Empfänger-Server hat UNS abgelehnt (Spam/Ruf): Adresse nicht sperren, Empfänger anhalten, Hochlauf schont
        update crm.emails set bounce_reason = left('Abgelehnt: ' || coalesce(v_ein ->> 'meldung', ''), 500) where id = aus.id;
        if r.id is not null then
          update crm.mail_empfaenger set status = 'gestoppt', naechster_versand_at = null,
                 stopp_grund = left('Vom Empfänger-Server abgelehnt: ' || coalesce(v_ein ->> 'meldung', ''), 300)
           where id = r.id and status in ('wartet', 'aktiv', 'fertig');
        end if;
      end if;
    elsif v_art = 'abwesend' then
      if coalesce((v_ein ->> 'ausgeschieden')::boolean, false) then
        if r.id is not null then
          update crm.mail_empfaenger set status = 'gestoppt', naechster_versand_at = null,
                 stopp_grund = 'Nicht mehr im Unternehmen (automatische Antwort)' where id = r.id and status in ('wartet', 'aktiv');
        end if;
      else
        v_bis := nullif(v_ein ->> 'bis', '')::date;
        if r.id is not null and r.status = 'aktiv' and v_bis is not null then
          update crm.mail_empfaenger set naechster_versand_at = greatest(naechster_versand_at, private.mail_naechstes_fenster(k.zeitplan, v_bis + 1))
           where id = r.id;
        end if;
      end if;
    elsif v_art = 'antwort' then
      v_hinweis := nullif(v_ein ->> 'hinweis', '');
      insert into crm.emails (lead_id, member_id, direction, channel, from_address, to_address, subject, body_text, message_id_header,
                              in_reply_to, references_header, status, sent_at, source, kampagne_id, empfaenger_id, postfach_id, einordnung, hinweis)
      values (aus.lead_id, coalesce(pf.member_id, aus.member_id), 'in', 'smtp', v_von, pf.adresse, left(x ->> 'betreff', 300),
              left(v_ein ->> 'neuerText', 4000), v_mid, aus.message_id_header, array_to_string(v_bezug, ' '), 'received',
              coalesce((x ->> 'datum')::timestamptz, now()), 'email_sync', aus.kampagne_id, aus.empfaenger_id, pf.id, 'antwort', v_hinweis);
      update crm.emails set status = 'replied', replied_at = now() where id = aus.id and status in ('sent', 'delivered');
      if r.id is not null then
        update crm.mail_empfaenger set status = case when v_hinweis = 'abmeldung' then 'abgemeldet' else 'beantwortet' end,
               beantwortet_at = now(), naechster_versand_at = null,
               stopp_grund = case when v_hinweis = 'abmeldung' then 'Abmeldung per Antwort' else null end
         where id = r.id;
        if k.stopp_firma and split_part(r.email, '@', 2) not in
             ('gmail.com', 'googlemail.com', 'gmx.de', 'gmx.net', 'web.de', 't-online.de', 'outlook.com', 'outlook.de', 'hotmail.com',
              'hotmail.de', 'yahoo.com', 'yahoo.de', 'icloud.com', 'freenet.de', 'aol.com', 'aol.de', 'arcor.de', 'posteo.de', 'mailbox.org') then
          update crm.mail_empfaenger set status = 'gestoppt', naechster_versand_at = null, stopp_grund = 'Jemand aus der Firma hat geantwortet'
           where id <> r.id and status in ('wartet', 'aktiv') and split_part(email, '@', 2) = split_part(r.email, '@', 2);
        end if;
      end if;
      if v_hinweis = 'abmeldung' then
        insert into crm.sperrliste (email, reason, channels, note, lead_id)
        values (coalesce(nullif(v_von, ''), aus.to_address), 'abmeldung', array['email']::crm.channel[],
                left('Abmeldung per Antwort: ' || coalesce(x ->> 'betreff', ''), 500), aus.lead_id)
        on conflict do nothing;
        update crm.mail_empfaenger set status = 'abgemeldet', naechster_versand_at = null, stopp_grund = 'Abmeldung per Antwort'
         where email in (v_von, aus.to_address) and status in ('wartet', 'aktiv');
      end if;
      if x ->> 'ordner' = 'spam' then v_aktion := 'retten'; end if;
    end if;
    v_aktionen := v_aktionen || jsonb_build_array(jsonb_build_object('ordner', x ->> 'ordner', 'uid', (x ->> 'uid')::bigint, 'aktion', v_aktion));
  end loop;
  update crm.mail_postfaecher set abruf_stand = coalesce(p_stand, abruf_stand), abruf_ok_at = now() where id = pf.id;
  return v_aktionen;
end;
$$;

create or replace function crm.mail_motor_abruf_fehler(p_postfach uuid, p_fehler text, p_anmeldung boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update crm.mail_postfaecher set
      status = case when p_anmeldung then 'fehler' else status end,
      status_text = left(case when p_anmeldung then 'Abruf: Anmeldung abgelehnt – App-Passwort prüfen: ' else 'Abruf fehlgeschlagen: ' end
                         || coalesce(p_fehler, ''), 500),
      status_at = case when p_anmeldung then now() else status_at end
   where id = p_postfach;
end;
$$;

-- Platzierungstests: gesuchte Message-IDs je Prüf-Postfach und Funde melden
create or replace function crm.mail_motor_platzierung_offen(p_postfach uuid) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(t.message_id), '{}') from crm.mail_platzierung t
   where t.saat_id = p_postfach and t.status = 'gesendet' and t.ordner is null;
$$;

create or replace function crm.mail_motor_platzierung_melden(p_postfach uuid, p_funde jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update crm.mail_platzierung t set ordner = f.ordner, geprueft_at = now()
    from (select lower(x ->> 'message_id') as mid, x ->> 'ordner' as ordner from jsonb_array_elements(coalesce(p_funde, '[]'::jsonb)) x) f
   where t.saat_id = p_postfach and t.message_id = f.mid and t.ordner is null;
  update crm.mail_postfaecher set abruf_ok_at = now() where id = p_postfach;
end;
$$;

-- Schlüssel des Takts (pg_cron → Edge Function), liegt im Vault
create or replace function crm.mail_motor_schluessel() returns text
language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'crm_mail_motor' limit 1;
$$;

-- -----------------------------------------------------------------------------------------------------
-- 11. Funktionen für die Oberfläche
-- -----------------------------------------------------------------------------------------------------
-- Kampagne mit Schritten, Varianten und Postfächern in einem Zug speichern (Editor). Varianten mit Sendungen werden beim
-- Entfernen nur deaktiviert, damit die A/B-Zahlen bleiben.
create or replace function crm.mail_kampagne_speichern(p jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare v_id uuid := nullif(p ->> 'id', '')::uuid; s jsonb; v jsonb; v_schritt uuid; v_pos int := 0; v_kennungen text[];
begin
  if auth.uid() is null or not private.is_member() then raise exception 'Nur für angemeldete Mitglieder'; end if;
  if v_id is null then
    insert into crm.mail_kampagnen (name) values (btrim(p ->> 'name')) returning id into v_id;
  end if;
  update crm.mail_kampagnen set
      name = coalesce(nullif(btrim(p ->> 'name'), ''), name),
      zeitplan = coalesce(p -> 'zeitplan', zeitplan),
      tageslimit = coalesce((p ->> 'tageslimit')::int, tageslimit),
      neue_pro_tag = coalesce((p ->> 'neue_pro_tag')::int, neue_pro_tag),
      stopp_firma = coalesce((p ->> 'stopp_firma')::boolean, stopp_firma),
      abmelde_satz = coalesce((p ->> 'abmelde_satz')::boolean, abmelde_satz),
      abmelde_kopf = coalesce((p ->> 'abmelde_kopf')::boolean, abmelde_kopf),
      datenschutz_satz = coalesce((p ->> 'datenschutz_satz')::boolean, datenschutz_satz),
      bounce_schutz = coalesce((p ->> 'bounce_schutz')::boolean, bounce_schutz),
      notiz = case when p ? 'notiz' then nullif(btrim(p ->> 'notiz'), '') else notiz end
   where id = v_id;
  if not found then raise exception 'Kampagne nicht gefunden'; end if;
  if p ? 'postfaecher' then
    delete from crm.mail_kampagne_postfaecher where kampagne_id = v_id
       and postfach_id not in (select (jsonb_array_elements_text(p -> 'postfaecher'))::uuid);
    insert into crm.mail_kampagne_postfaecher (kampagne_id, postfach_id)
    select v_id, (x)::uuid from jsonb_array_elements_text(p -> 'postfaecher') x on conflict do nothing;
  end if;
  if p ? 'schritte' then
    for s in select * from jsonb_array_elements(p -> 'schritte') loop
      insert into crm.mail_schritte (kampagne_id, position, wartetage, im_thread)
      values (v_id, v_pos, coalesce((s ->> 'wartetage')::int, 3), coalesce((s ->> 'im_thread')::boolean, true))
      on conflict (kampagne_id, position) do update set wartetage = excluded.wartetage, im_thread = excluded.im_thread
      returning id into v_schritt;
      v_kennungen := '{}';
      for v in select * from jsonb_array_elements(coalesce(s -> 'varianten', '[]'::jsonb)) loop
        insert into crm.mail_varianten (schritt_id, kennung, betreff, text, aktiv)
        values (v_schritt, v ->> 'kennung', coalesce(v ->> 'betreff', ''), coalesce(v ->> 'text', ''), coalesce((v ->> 'aktiv')::boolean, true))
        on conflict (schritt_id, kennung) do update set betreff = excluded.betreff, text = excluded.text, aktiv = excluded.aktiv;
        v_kennungen := v_kennungen || (v ->> 'kennung');
      end loop;
      update crm.mail_varianten mv set aktiv = false
       where mv.schritt_id = v_schritt and not (mv.kennung = any (v_kennungen))
         and exists (select 1 from crm.emails e where e.variante_id = mv.id);
      delete from crm.mail_varianten mv
       where mv.schritt_id = v_schritt and not (mv.kennung = any (v_kennungen))
         and not exists (select 1 from crm.emails e where e.variante_id = mv.id);
      v_pos := v_pos + 1;
    end loop;
    delete from crm.mail_schritte ms where ms.kampagne_id = v_id and ms.position >= v_pos
       and not exists (select 1 from crm.emails e where e.schritt_id = ms.id);
  end if;
  return v_id;
end;
$$;

-- Leads in eine Kampagne aufnehmen (mit E-Mail-Adresse; schon enthaltene werden übersprungen)
create or replace function crm.mail_empfaenger_hinzufuegen(p_kampagne uuid, p_leads uuid[]) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_neu int; v_ohne_adresse int; v_gesperrt int;
begin
  if auth.uid() is null or not private.is_member() then raise exception 'Nur für angemeldete Mitglieder'; end if;
  if not exists (select 1 from crm.mail_kampagnen where id = p_kampagne and status <> 'beendet') then
    raise exception 'Kampagne nicht gefunden oder beendet'; end if;
  select count(*) into v_ohne_adresse from crm.leads where id = any (p_leads) and nullif(btrim(email), '') is null;
  -- in der gewählten Reihenfolge (nr), damit die Kampagne sie so abarbeitet
  with neu as (
    insert into crm.mail_empfaenger (kampagne_id, lead_id, email)
    select p_kampagne, l.id, lower(btrim(l.email))
      from unnest(p_leads) with ordinality u (id, i) join crm.leads l on l.id = u.id
     where l.deleted_at is null and nullif(btrim(l.email), '') is not null
     order by u.i
    on conflict (kampagne_id, lead_id) do nothing
    returning id
  ) select count(*) into v_neu from neu;
  select count(*) into v_gesperrt from crm.mail_empfaenger r
   where r.kampagne_id = p_kampagne and r.lead_id = any (p_leads) and r.status = 'wartet' and crm.mail_gate(r.id) is not null;
  return jsonb_build_object('neu', v_neu, 'ohne_adresse', v_ohne_adresse, 'gesperrt', v_gesperrt);
end;
$$;

-- Gate-Gründe der offenen Empfänger einer Kampagne (Vorschau vor dem Start)
create or replace function crm.mail_kampagne_pruefen(p_kampagne uuid) returns table (empfaenger_id uuid, grund text)
language sql stable security invoker set search_path = '' as $$
  select x.id, x.grund from (
    select r.id, crm.mail_gate(r.id) as grund from crm.mail_empfaenger r where r.kampagne_id = p_kampagne and r.status in ('wartet', 'aktiv')
  ) x where x.grund is not null;
$$;

create or replace function crm.mail_kampagne_status(p_kampagne uuid, p_status text) returns crm.mail_kampagnen
language plpgsql security invoker set search_path = '' as $$
declare k crm.mail_kampagnen;
begin
  if auth.uid() is null or not private.is_member() then raise exception 'Nur für angemeldete Mitglieder'; end if;
  if p_status not in ('aktiv', 'pausiert', 'beendet') then raise exception 'Unbekannter Status %', p_status; end if;
  select * into k from crm.mail_kampagnen where id = p_kampagne for update;
  if not found then raise exception 'Kampagne nicht gefunden'; end if;
  if k.status = 'beendet' then raise exception 'Die Kampagne ist beendet'; end if;
  if p_status = 'aktiv' then
    if not exists (select 1 from crm.mail_kampagne_postfaecher kp join crm.mail_postfaecher p on p.id = kp.postfach_id
                    where kp.kampagne_id = k.id and p.rolle = 'versand') then
      raise exception 'Erst mindestens ein Versand-Postfach auswählen'; end if;
    if not exists (select 1 from crm.mail_schritte s join crm.mail_varianten v on v.schritt_id = s.id
                    where s.kampagne_id = k.id and s.position = 0 and v.aktiv and btrim(v.text) <> '' and btrim(v.betreff) <> '') then
      raise exception 'Der erste Schritt braucht Betreff und Text'; end if;
    if not exists (select 1 from crm.mail_empfaenger where kampagne_id = k.id and status in ('wartet', 'aktiv')) then
      raise exception 'Die Kampagne hat keine offenen Empfänger'; end if;
  end if;
  update crm.mail_kampagnen set status = p_status, status_text = null,
         gestartet_at = case when p_status = 'aktiv' then coalesce(gestartet_at, now()) else gestartet_at end,
         beendet_at = case when p_status = 'beendet' then now() else beendet_at end
   where id = k.id returning * into k;
  if p_status = 'beendet' then
    update crm.mail_empfaenger set status = 'gestoppt', stopp_grund = 'Kampagne beendet', naechster_versand_at = null
     where kampagne_id = k.id and status in ('wartet', 'aktiv') and in_arbeit is null;
  end if;
  return k;
end;
$$;

-- Antwort aus der Unibox: Entwurf über dasselbe Postfach im selben Verlauf, der Motor sendet im nächsten Takt
create or replace function crm.mail_antworten(p_eingang uuid, p_text text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare ein crm.emails; pf crm.mail_postfaecher; v_id uuid;
begin
  if auth.uid() is null or not private.is_member() then raise exception 'Nur für angemeldete Mitglieder'; end if;
  if char_length(btrim(coalesce(p_text, ''))) < 2 then raise exception 'Der Text ist leer'; end if;
  select * into ein from crm.emails where id = p_eingang and direction = 'in';
  if not found or ein.postfach_id is null then raise exception 'Eingegangene Mail nicht gefunden'; end if;
  select * into pf from crm.mail_postfaecher where id = ein.postfach_id;
  if pf.status <> 'bereit' or pf.smtp_host is null then raise exception 'Das Postfach % kann gerade nicht senden', pf.adresse; end if;
  if crm.is_blocked(null, ein.from_address, null) then raise exception 'Die Adresse steht auf der Sperrliste'; end if;
  insert into crm.emails (lead_id, member_id, direction, channel, from_address, to_address, subject, body_text, message_id_header,
                          in_reply_to, references_header, status, source, kampagne_id, empfaenger_id, postfach_id, sofort,
                          consent_basis_snapshot, consent_note_snapshot)
  values (ein.lead_id, auth.uid(), 'out', 'smtp', pf.adresse, ein.from_address,
          left('Re: ' || regexp_replace(coalesce(ein.subject, ''), '^\s*((re|aw|antw)\s*:\s*)+', '', 'i'), 300),
          btrim(p_text) || case when nullif(btrim(coalesce(pf.signatur, '')), '') is not null then E'\n\n' || btrim(pf.signatur) else '' end,
          private.mail_message_id(pf.adresse), ein.message_id_header,
          btrim(coalesce(ein.references_header, '') || ' ' || coalesce(ein.message_id_header, '')),
          'draft', 'app', ein.kampagne_id, ein.empfaenger_id, pf.id, true,
          coalesce((select l.email_consent_basis from crm.leads l where l.id = ein.lead_id and l.email_consent_basis not in ('none', 'revoked')),
                   'requested_email'),
          'Antwort auf die Nachricht vom ' || to_char(ein.sent_at at time zone 'Europe/Berlin', 'DD.MM.YYYY'))
  returning id into v_id;
  update crm.emails set erledigt_at = coalesce(erledigt_at, now()), gelesen_at = coalesce(gelesen_at, now()) where id = ein.id;
  return v_id;
end;
$$;

-- Platzierungstest: eine echte Mail von diesem Postfach an jedes bereite Prüf-Postfach
create or replace function crm.mail_platzierung_starten(p_postfach uuid, p_betreff text, p_text text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_test uuid := gen_random_uuid(); pf crm.mail_postfaecher; v_n int;
begin
  if auth.uid() is null or not private.is_member() then raise exception 'Nur für angemeldete Mitglieder'; end if;
  select * into pf from crm.mail_postfaecher where id = p_postfach and rolle = 'versand';
  if not found then raise exception 'Versand-Postfach nicht gefunden'; end if;
  if pf.status <> 'bereit' then raise exception 'Das Postfach ist nicht verbunden'; end if;
  if char_length(btrim(coalesce(p_betreff, ''))) < 2 or char_length(btrim(coalesce(p_text, ''))) < 10 then
    raise exception 'Betreff und Text fehlen'; end if;
  if private.mail_offen(p_betreff || E'\n' || p_text) <> '{}' then raise exception 'Bitte erst die Platzhalter füllen'; end if;
  insert into crm.mail_platzierung (test, von_id, saat_id, message_id, betreff, text)
  select v_test, pf.id, s.id, private.mail_message_id(pf.adresse), left(btrim(p_betreff), 200), left(p_text, 10000)
    from crm.mail_postfaecher s where s.rolle = 'saat' and s.status = 'bereit';
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'Es ist noch kein Prüf-Postfach verbunden'; end if;
  return v_test;
end;
$$;

-- Abmelden per Link/Kopfzeile (Token je Empfänger) – auch ohne Anmeldung (Seite /abmelden, Edge Function)
create or replace function crm.mail_abmelden(p_token uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare r crm.mail_empfaenger;
begin
  select * into r from crm.mail_empfaenger where abmelde_token = p_token;
  if not found then return false; end if;
  insert into crm.sperrliste (email, reason, channels, note, lead_id)
  values (r.email, 'abmeldung', array['email']::crm.channel[], 'Abmeldung per Link', r.lead_id) on conflict do nothing;
  update crm.mail_empfaenger set status = 'abgemeldet', naechster_versand_at = null, stopp_grund = 'Abmeldung per Link'
   where email = r.email and status in ('wartet', 'aktiv', 'fertig');
  return true;
end;
$$;

-- -----------------------------------------------------------------------------------------------------
-- 12. Lage-Ansichten (security_invoker, damit RLS greift)
-- -----------------------------------------------------------------------------------------------------
create or replace view crm.v_mail_postfaecher with (security_invoker = true) as
select p.id, p.adresse, p.domain, p.absender_name, p.member_id, p.anbieter, p.rolle, p.status, p.status_text, p.status_at,
       p.hochlauf, p.hochlauf_start, p.tageslimit, p.mindestabstand_min, p.gesperrt_bis, p.abruf_ok_at, p.test_ergebnis,
       p.signatur, p.smtp_host, p.imap_host, p.benutzer, p.created_at,
       crm.mail_hochlauf(p.id) as hochlauf_lage,
       (select count(*) from crm.emails e where e.postfach_id = p.id and e.direction = 'in' and e.sent_at > now() - interval '30 days')::int as monat_antworten
  from crm.mail_postfaecher p;

create or replace view crm.v_mail_kampagnen with (security_invoker = true) as
select k.*,
       (select count(*) from crm.mail_empfaenger r where r.kampagne_id = k.id)::int as empfaenger,
       (select count(*) from crm.mail_empfaenger r where r.kampagne_id = k.id and r.status = 'wartet')::int as wartend,
       (select count(*) from crm.mail_empfaenger r where r.kampagne_id = k.id and r.status = 'aktiv')::int as laufend,
       (select count(*) from crm.mail_empfaenger r where r.kampagne_id = k.id and r.status = 'fertig')::int as fertig,
       (select count(*) from crm.mail_empfaenger r where r.kampagne_id = k.id and r.status = 'beantwortet')::int as beantwortet,
       (select count(*) from crm.mail_empfaenger r where r.kampagne_id = k.id and r.status = 'bounce')::int as bounces,
       (select count(*) from crm.mail_empfaenger r where r.kampagne_id = k.id and r.status = 'abgemeldet')::int as abgemeldet,
       (select count(*) from crm.mail_empfaenger r where r.kampagne_id = k.id and r.status in ('gestoppt', 'fehler'))::int as gestoppt,
       (select count(*) from crm.emails e where e.kampagne_id = k.id and e.direction = 'out'
          and e.status in ('sent', 'delivered', 'replied', 'bounced'))::int as gesendet,
       (select count(*) from crm.emails e where e.kampagne_id = k.id and e.direction = 'out'
          and e.status in ('sent', 'delivered', 'replied', 'bounced') and e.sent_at >= private.mail_tagesbeginn())::int as heute,
       (select count(*) from crm.emails e where e.kampagne_id = k.id and e.direction = 'in')::int as antworten,
       (select count(*) from crm.emails e where e.kampagne_id = k.id and e.direction = 'in'
          and (e.label = 'interessiert' or (e.label is null and e.hinweis = 'interessiert')))::int as interessiert
  from crm.mail_kampagnen k;

create or replace view crm.v_mail_varianten with (security_invoker = true) as
select v.id as variante_id, v.schritt_id, s.kampagne_id, s.position, v.kennung, v.aktiv,
       (select count(*) from crm.emails e where e.variante_id = v.id and e.direction = 'out'
          and e.status in ('sent', 'delivered', 'replied', 'bounced'))::int as gesendet,
       (select count(*) from crm.emails e where e.variante_id = v.id and e.direction = 'out' and e.status = 'replied')::int as beantwortet,
       (select count(*) from crm.emails e where e.variante_id = v.id and e.direction = 'out' and e.status = 'bounced')::int as bounces
  from crm.mail_varianten v join crm.mail_schritte s on s.id = v.schritt_id;

-- Kennzahlen je Anbieter der Empfänger (T-Online, GMX/WEB.DE, IONOS … filtern anders als Gmail)
create or replace view crm.v_mail_anbieter with (security_invoker = true) as
select coalesce(m.klasse, 'unbekannt') as klasse,
       count(*) filter (where e.direction = 'out' and e.status in ('sent', 'delivered', 'replied', 'bounced'))::int as gesendet,
       count(*) filter (where e.direction = 'out' and e.status = 'bounced')::int as bounces,
       count(*) filter (where e.direction = 'out' and e.status = 'replied')::int as beantwortet
  from crm.emails e left join crm.mail_mx m on m.domain = split_part(e.to_address, '@', 2)
 where e.kampagne_id is not null and e.created_at > now() - interval '90 days'
 group by 1;

create or replace view crm.v_mail_tests with (security_invoker = true) as
select t.test, t.von_id, min(t.created_at) as gestartet_at, min(t.betreff) as betreff,
       count(*)::int as gesamt,
       count(*) filter (where t.ordner = 'posteingang')::int as posteingang,
       count(*) filter (where t.ordner = 'spam')::int as spam,
       count(*) filter (where t.ordner = 'fehlt')::int as fehlt,
       count(*) filter (where t.status = 'fehler')::int as fehler,
       count(*) filter (where t.ordner is null and t.status <> 'fehler')::int as offen,
       jsonb_agg(jsonb_build_object('saat', s.adresse, 'anbieter', s.anbieter, 'ordner', t.ordner, 'status', t.status) order by s.adresse) as details
  from crm.mail_platzierung t join crm.mail_postfaecher s on s.id = t.saat_id
 group by t.test, t.von_id;

grant select on crm.v_mail_postfaecher, crm.v_mail_kampagnen, crm.v_mail_varianten, crm.v_mail_anbieter, crm.v_mail_tests to authenticated, service_role;

-- -----------------------------------------------------------------------------------------------------
-- 13. Rechte an den Funktionen
-- -----------------------------------------------------------------------------------------------------
revoke all on function crm.mail_motor_zugang(uuid), crm.mail_motor_test_ergebnis(uuid, jsonb), crm.mail_motor_auftraege(int),
                       crm.mail_motor_ergebnis(text, uuid, boolean, text, text), crm.mail_motor_mx_offen(int), crm.mail_motor_mx_setzen(jsonb),
                       crm.mail_motor_abruf_liste(int), crm.mail_motor_eingang(uuid, jsonb, jsonb), crm.mail_motor_abruf_fehler(uuid, text, boolean),
                       crm.mail_motor_platzierung_offen(uuid), crm.mail_motor_platzierung_melden(uuid, jsonb), crm.mail_motor_schluessel()
  from public, anon, authenticated;
grant execute on function crm.mail_motor_zugang(uuid), crm.mail_motor_test_ergebnis(uuid, jsonb), crm.mail_motor_auftraege(int),
                          crm.mail_motor_ergebnis(text, uuid, boolean, text, text), crm.mail_motor_mx_offen(int), crm.mail_motor_mx_setzen(jsonb),
                          crm.mail_motor_abruf_liste(int), crm.mail_motor_eingang(uuid, jsonb, jsonb), crm.mail_motor_abruf_fehler(uuid, text, boolean),
                          crm.mail_motor_platzierung_offen(uuid), crm.mail_motor_platzierung_melden(uuid, jsonb), crm.mail_motor_schluessel()
  to service_role;

revoke all on function crm.mail_postfach_speichern(jsonb, text), crm.mail_kampagne_speichern(jsonb), crm.mail_empfaenger_hinzufuegen(uuid, uuid[]),
                       crm.mail_kampagne_pruefen(uuid), crm.mail_kampagne_status(uuid, text), crm.mail_antworten(uuid, text),
                       crm.mail_platzierung_starten(uuid, text, text), crm.mail_hochlauf(uuid), crm.mail_gate(uuid),
                       crm.mail_fuellen(text, uuid, jsonb, uuid)
  from public, anon;
grant execute on function crm.mail_postfach_speichern(jsonb, text), crm.mail_kampagne_speichern(jsonb), crm.mail_empfaenger_hinzufuegen(uuid, uuid[]),
                          crm.mail_kampagne_pruefen(uuid), crm.mail_kampagne_status(uuid, text), crm.mail_antworten(uuid, text),
                          crm.mail_platzierung_starten(uuid, text, text), crm.mail_hochlauf(uuid), crm.mail_gate(uuid),
                          crm.mail_fuellen(text, uuid, jsonb, uuid)
  to authenticated, service_role;

revoke all on function crm.mail_abmelden(uuid) from public;
grant execute on function crm.mail_abmelden(uuid) to anon, authenticated, service_role;

revoke all on function private.mail_tagesbeginn(date), private.mail_message_id(text), private.mail_im_fenster(jsonb, timestamptz),
                       private.mail_naechstes_fenster(jsonb, date), private.mail_fensterende(jsonb), private.mail_offen(text),
                       private.mail_auftrag_einzeln(crm.mail_postfaecher), private.mail_auftrag_platzierung(crm.mail_postfaecher),
                       private.mail_auftrag_kampagne(crm.mail_postfaecher, jsonb), private.mail_aufraeumen(), private.mail_postfach_geloescht()
  from public, anon, authenticated;
grant execute on function private.mail_tagesbeginn(date), private.mail_offen(text) to authenticated, service_role;

-- -----------------------------------------------------------------------------------------------------
-- 14. Takt: Schlüssel im Vault, pg_cron jede Minute (nur wenn ein Postfach bereit ist), Aufräumen der Cron-Protokolle
-- -----------------------------------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'crm_mail_motor') then
    perform vault.create_secret(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
                                'crm_mail_motor', 'Schlüssel für den Takt des Mail-Motors (pg_cron → Edge Function mail-motor)');
  end if;
end
$$;

select cron.schedule('crm-mail-motor', '* * * * *', $cron$
  select net.http_post(
    url := 'https://ekaqkfgvisdngsskzbai.supabase.co/functions/v1/mail-motor',
    headers := jsonb_build_object('content-type', 'application/json', 'x-region', 'eu-central-1',
                                  'x-motor', (select decrypted_secret from vault.decrypted_secrets where name = 'crm_mail_motor')),
    body := '{"aktion":"takt"}'::jsonb,
    timeout_milliseconds := 5000)
  where exists (select 1 from crm.mail_postfaecher where status = 'bereit');
$cron$);

select cron.schedule('crm-mail-motor-aufraeumen', '17 3 * * *', $cron$
  delete from cron.job_run_details where end_time < now() - interval '3 days';
$cron$);
