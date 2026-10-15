-- =====================================================================================================
-- CRM Steiner & Co. · Migration 7 · Eingang (LinkedIn-Benachrichtigungen automatisch erfassen), idempotent, rein additiv.
-- Stand: 2026-10-15
--
-- Warum: „Ich will nix doppelt pflegen.“ LinkedIn hat keine Nachrichten-API, Bots/Scraper verstoßen gegen die
-- Nutzungsvereinbarung (8.2). Deshalb liest das CRM NIE LinkedIn selbst, sondern nur die Benachrichtigungs-Mails,
-- die LinkedIn ohnehin an das private Postfach schickt („Anna hat Ihre Einladung angenommen“, „Neue Nachricht von …“).
-- Ein Google Apps Script im eigenen Gmail-Konto (tools/apps-script/LinkedIn-ins-CRM.gs) schickt alle 5 Minuten nur die
-- Metadaten dieser Mails an die Edge Function linkedin-eingang; die legt je Mail eine Zeile in crm.eingang an und ruft
-- crm.eingang_verarbeiten auf: Lead finden (Profil-Slug, sonst eindeutiger Name) → Annahme verbuchen (mark_accepted startet
-- die Auto-Sequenz) bzw. Antwort verbuchen (log_reply stoppt die Sequenzen). Was nicht zugeordnet werden kann, bleibt als
-- „unbekannt“ im Eingang und wird per crm.eingang_zuordnen einem Lead zugewiesen (Erweiterung → Eingang; CRM-App folgt).
--
-- Konventionen wie Migration 1/6: Schema crm, RLS über private.is_member(), deutsche Kommentare, set search_path = ''.
--   · Tabelle crm.eingang         – je Benachrichtigung eine Zeile (unique quelle + external_id = Gmail-Message-ID)
--   · Tabelle crm.eingang_tokens  – Eingangs-Schlüssel je Mitglied, nur der SHA-256-Hash wird gespeichert
--   · RPCs  eingang_token_erzeugen(p_label) · eingang_token_widerrufen() · eingang_zuordnen(p_id, p_lead_id) · eingang_ignorieren(p_id)
--   · Funktion eingang_verarbeiten(p_id) – nur service_role (Edge Function) und intern (eingang_zuordnen)
--   · Realtime-Publikation für crm.eingang
--   · Abschnitt 7 (am Ende): Korrekturen nach dem Review – live als eigener Block nachgezogen (Doppel-Schutz nach Gesprächszug,
--     eigener Slug, Name nur mit Vernetzung/Anfrage, set_reply_label, Löschfrist, kein direktes UPDATE, Datensparsamkeit)
-- Nichts Bestehendes wird verändert oder gelöscht.
-- =====================================================================================================

-- -----------------------------------------------------------------------------------------------------
-- 1. Tabellen
-- -----------------------------------------------------------------------------------------------------
create table if not exists crm.eingang (
  id             uuid primary key default gen_random_uuid(),
  member_id      uuid not null references public.members (user_id) on delete cascade,
  quelle         text not null check (quelle in ('gmail_linkedin', 'erweiterung')),
  external_id    text not null check (char_length(external_id) between 1 and 300),
  art            text not null default 'sonstiges' check (art in ('nachricht', 'annahme', 'einladung', 'sonstiges')),
  empfangen_at   timestamptz not null default now(),
  absender_name  text check (absender_name is null or char_length(absender_name) <= 200),
  linkedin_slug  text check (linkedin_slug is null or char_length(linkedin_slug) <= 200),
  lead_id        uuid references crm.leads (id) on delete cascade,
  text           text check (text is null or char_length(text) <= 2000),
  roh            jsonb not null default '{}'::jsonb check (jsonb_typeof(roh) = 'object' and octet_length(roh::text) <= 4096),
  status         text not null default 'neu' check (status in ('neu', 'verarbeitet', 'unbekannt', 'ignoriert', 'fehler')),
  ergebnis       text check (ergebnis is null or char_length(ergebnis) <= 1000),
  activity_id    bigint references crm.activities (id) on delete set null,
  verarbeitet_at timestamptz,
  created_at     timestamptz not null default now(),
  unique (quelle, external_id)
);

comment on table crm.eingang is 'Eingang: LinkedIn-Benachrichtigungen aus dem eigenen Postfach (Apps Script → Edge Function linkedin-eingang) oder aus der Browser-Erweiterung. Je Ereignis eine Zeile; crm.eingang_verarbeiten verbucht Annahmen und Antworten am Lead.';
comment on column crm.eingang.member_id is 'In wessen Postfach/LinkedIn das Ereignis ankam (Vincent oder Mike) – in dessen Namen wird verbucht.';
comment on column crm.eingang.quelle is 'gmail_linkedin (Benachrichtigungs-Mail) · erweiterung (Chrome-Erweiterung, nur Lesen auf Klick)';
comment on column crm.eingang.external_id is 'Gmail-Message-ID bzw. Kennung der Erweiterung – zusammen mit quelle eindeutig (Doppel-Schutz).';
comment on column crm.eingang.art is 'nachricht · annahme (Einladung angenommen) · einladung (jemand lädt ein) · sonstiges';
comment on column crm.eingang.linkedin_slug is 'Profil-Slug aus den Links der Mail (linkedin.com/in/<slug>), klein und dekodiert.';
comment on column crm.eingang.lead_id is 'Zugeordneter Lead (automatisch oder per eingang_zuordnen). Endgültiges Löschen des Leads löscht auch den Eingang (DSGVO).';
comment on column crm.eingang.text is 'Nachrichtentext aus der Mail (ohne Fußzeilen), höchstens 2000 Zeichen.';
comment on column crm.eingang.roh is 'Metadaten (Betreff, Absender, bereinigte Links ohne Query, Parser-Entscheidung roh.parser) – nie der volle Mail-Text, ≤ 4 kB.';
comment on column crm.eingang.status is 'neu (wartet, z. B. Einladung eines Leads) · verarbeitet · unbekannt (kein/mehrdeutiger Lead – zuordnen) · ignoriert · fehler (ergebnis = Fehlertext)';
comment on column crm.eingang.ergebnis is 'Was passiert ist, in Klartext („Annahme verbucht – Sequenz gestartet“, „Antwort war schon erfasst“ …).';
comment on column crm.eingang.activity_id is 'Die verbuchte (oder schon vorhandene) Aktivität: vernetzung_angenommen bzw. nachricht_erhalten.';

create index if not exists eingang_member_status_idx on crm.eingang (member_id, status, empfangen_at desc);
create index if not exists eingang_offen_idx on crm.eingang (empfangen_at desc) where status in ('neu', 'unbekannt', 'fehler');
create index if not exists eingang_lead_idx on crm.eingang (lead_id) where lead_id is not null;
create index if not exists eingang_activity_idx on crm.eingang (activity_id) where activity_id is not null;

create table if not exists crm.eingang_tokens (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references public.members (user_id) on delete cascade,
  token_hash   text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  label        text check (label is null or char_length(label) <= 100),
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);
comment on table crm.eingang_tokens is 'Eingangs-Schlüssel je Mitglied für die Edge Function linkedin-eingang. Gespeichert wird nur sha256(token) als Hex; der Klartext wird bei der Erzeugung genau einmal angezeigt.';
comment on column crm.eingang_tokens.last_used_at is 'Letzter erfolgreicher Aufruf der Edge Function (zeigt in der App, ob das Apps Script läuft).';
create index if not exists eingang_tokens_member_idx on crm.eingang_tokens (member_id) where revoked_at is null;

-- -----------------------------------------------------------------------------------------------------
-- 2. Trigger: Herkunft bleibt fest, verarbeitet_at beim Abschluss
-- -----------------------------------------------------------------------------------------------------
create or replace function crm.eingang_before_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.member_id   := old.member_id;
  new.quelle      := old.quelle;
  new.external_id := old.external_id;
  new.created_at  := old.created_at;
  if new.status is distinct from old.status and new.status in ('verarbeitet', 'ignoriert', 'unbekannt', 'fehler') then
    new.verarbeitet_at := coalesce(new.verarbeitet_at, now());
  end if;
  return new;
end;
$$;
comment on function crm.eingang_before_update() is 'Eingang: member_id/quelle/external_id/created_at bleiben fest; verarbeitet_at wird beim Statuswechsel gesetzt.';

create or replace trigger eingang_before_update before update on crm.eingang
  for each row execute function crm.eingang_before_update();

-- -----------------------------------------------------------------------------------------------------
-- 3. Verarbeitung (security definer – läuft für service_role ohne auth.uid(); verbucht im Kontext von eingang.member_id)
-- -----------------------------------------------------------------------------------------------------
create or replace function crm.eingang_verarbeiten(p_id uuid) returns crm.eingang
language plpgsql security definer set search_path = '' as $$
declare
  e crm.eingang;
  v_lead uuid;
  v_name text;
  v_kern text;
  v_slug_norm text;
  v_n int;
  v_eigene int;
  v_conn crm.linkedin_connections;
  v_act bigint;
  v_status text;
  v_ergebnis text;
  v_prev_sub text;
  v_fenster interval := interval '10 minutes';
begin
  -- Aufrufer: Edge Function (service_role, auth.uid() leer) oder Mitglied über eingang_zuordnen
  if auth.uid() is not null and not private.is_member() then
    raise exception 'Nur Mitglieder dürfen den Eingang verarbeiten' using errcode = '42501';
  end if;
  select * into e from crm.eingang where id = p_id for update;
  if not found then raise exception 'Eingang % nicht gefunden', p_id; end if;
  if e.status in ('verarbeitet', 'ignoriert') then return e; end if;

  begin
    -- 1) Lead finden: Profil-Slug → eindeutiger Name (eigene Leads zuerst)
    v_lead := e.lead_id;
    if nullif(btrim(e.linkedin_slug), '') is not null then
      v_slug_norm := crm.normalize_linkedin_url('linkedin.com/in/' || btrim(e.linkedin_slug));
    end if;
    if v_lead is null and v_slug_norm is not null then
      select l.id into v_lead from crm.leads l where l.linkedin_url_norm = v_slug_norm and l.deleted_at is null;
    end if;
    v_name := lower(btrim(regexp_replace(coalesce(e.absender_name, ''), '\s+', ' ', 'g')));
    if v_lead is null and v_name <> '' then
      -- Titel (Dr., Prof. …) und Anrede abtrennen: „Dr. Anna Beispiel“ trifft auch den Lead „Anna Beispiel“
      select lower(btrim(coalesce(s.first_name, '') || ' ' || coalesce(s.last_name, ''))) into v_kern
        from crm.split_person_name(e.absender_name) s;
      v_kern := coalesce(nullif(v_kern, ''), v_name);
      -- Hat die Mail einen Profil-Link, kommen nur Leads ohne eigenes Profil in Frage (sonst ist es eine andere Person gleichen Namens)
      select count(*), count(*) filter (where l.owner_id = e.member_id)
        into v_n, v_eigene
        from crm.leads l
       where l.deleted_at is null and lower(l.full_name) in (v_name, v_kern)
         and (v_slug_norm is null or l.linkedin_url_norm is null);
      if v_eigene = 1 then
        select l.id into v_lead from crm.leads l
         where l.deleted_at is null and lower(l.full_name) in (v_name, v_kern)
           and (v_slug_norm is null or l.linkedin_url_norm is null) and l.owner_id = e.member_id;
      elsif v_n = 1 then
        select l.id into v_lead from crm.leads l
         where l.deleted_at is null and lower(l.full_name) in (v_name, v_kern)
           and (v_slug_norm is null or l.linkedin_url_norm is null);
      elsif v_n > 1 then
        v_ergebnis := format('Name „%s“ passt zu %s Leads – bitte zuordnen', e.absender_name, v_n);
      elsif v_slug_norm is not null and exists (select 1 from crm.leads l where l.deleted_at is null and lower(l.full_name) in (v_name, v_kern)) then
        v_ergebnis := format('Ein Lead heißt „%s“, hat aber ein anderes LinkedIn-Profil – bitte prüfen', e.absender_name);
      end if;
    end if;

    if v_lead is null then
      if e.art = 'einladung' then
        v_status := 'ignoriert';
        v_ergebnis := 'Einladung von einer Person, die nicht im CRM ist';
      elsif e.art = 'sonstiges' then
        v_status := 'ignoriert';
        v_ergebnis := 'Keine Aktion nötig';
      else
        v_status := 'unbekannt';
        v_ergebnis := coalesce(v_ergebnis, 'Kein passender Lead gefunden – bitte zuordnen');
      end if;
    else
      -- 2) Verbuchen im Namen des Postfach-Inhabers (log_reply/undo nutzen auth.uid())
      v_prev_sub := current_setting('request.jwt.claim.sub', true);
      perform set_config('request.jwt.claim.sub', e.member_id::text, true);

      if e.art = 'annahme' then
        select * into v_conn from crm.linkedin_connections where lead_id = v_lead and member_id = e.member_id;
        if found and v_conn.status = 'angenommen' then
          v_status := 'verarbeitet';
          v_ergebnis := 'Vernetzung war schon als angenommen erfasst';
        else
          perform crm.mark_accepted(v_lead, e.member_id, crm.berlin_date(e.empfangen_at));
          v_status := 'verarbeitet';
          v_ergebnis := 'Annahme verbucht' ||
            case when exists (select 1 from crm.enrollments x where x.lead_id = v_lead and x.status = 'aktiv' and x.created_at = now())
                 then ' – Sequenz gestartet' else '' end;
        end if;
        select a.id into v_act from crm.activities a
         where a.lead_id = v_lead and a.member_id = e.member_id and a.type = 'vernetzung_angenommen'
         order by a.occurred_at desc, a.id desc limit 1;

      elsif e.art = 'nachricht' then
        -- Schon erfasst? (A-Taste ±10 Minuten um den Mail-Eingang, oder derselbe Text innerhalb von 3 Tagen)
        select a.id into v_act from crm.activities a
         where a.lead_id = v_lead and a.type = 'nachricht_erhalten'
           and (a.occurred_at between e.empfangen_at - v_fenster and e.empfangen_at + v_fenster
                or (nullif(btrim(e.text), '') is not null and btrim(a.note) = btrim(e.text)
                    and a.occurred_at between e.empfangen_at - interval '3 days' and e.empfangen_at + interval '3 days'))
         order by abs(extract(epoch from a.occurred_at - e.empfangen_at)) limit 1;
        if v_act is not null then
          v_status := 'verarbeitet';
          v_ergebnis := 'Antwort war schon erfasst';
        else
          v_act := crm.log_reply(v_lead, 'linkedin', null, nullif(btrim(e.text), ''), e.empfangen_at);
          v_status := 'verarbeitet';
          v_ergebnis := 'Antwort verbucht' ||
            case when exists (select 1 from crm.enrollments x where x.lead_id = v_lead and x.status = 'gestoppt'
                                 and x.stopped_reason = 'antwort_erhalten' and x.stopped_at = now())
                 then ' – Sequenz gestoppt' else '' end;
        end if;

      elsif e.art = 'einladung' then
        v_status := 'neu';
        v_ergebnis := 'Einladung von diesem Lead – auf LinkedIn selbst annehmen, dann im CRM „Angenommen“ setzen';

      else
        v_status := 'ignoriert';
        v_ergebnis := 'Keine Aktion nötig';
      end if;

      perform set_config('request.jwt.claim.sub', coalesce(v_prev_sub, ''), true);
    end if;

    update crm.eingang
       set lead_id = v_lead, status = v_status, ergebnis = v_ergebnis, activity_id = v_act,
           verarbeitet_at = case when v_status = 'neu' then null else now() end
     where id = p_id
     returning * into e;
  exception when others then
    -- Teiltransaktion ist zurückgerollt (auch set_config); Eingang bleibt mit Fehlertext stehen
    update crm.eingang
       set status = 'fehler', ergebnis = left(sqlerrm, 1000), lead_id = coalesce(v_lead, lead_id), verarbeitet_at = now()
     where id = p_id
     returning * into e;
  end;
  return e;
end;
$$;
comment on function crm.eingang_verarbeiten(uuid) is 'Ordnet einen Eingang einem Lead zu (Slug, sonst eindeutiger Name, eigene Leads zuerst) und verbucht: annahme → mark_accepted (startet Auto-Sequenz), nachricht → log_reply (außer schon erfasst ±10 min). Fehler → status fehler.';

-- -----------------------------------------------------------------------------------------------------
-- 4. RPCs für die App
-- -----------------------------------------------------------------------------------------------------
-- Lead von Hand zuordnen und verarbeiten (unbekannt / fehler / neu / ignoriert)
create or replace function crm.eingang_zuordnen(p_id uuid, p_lead_id uuid) returns crm.eingang
language plpgsql security definer set search_path = '' as $$
declare e crm.eingang;
begin
  if auth.uid() is null or not private.is_member() then
    raise exception 'Nur Mitglieder dürfen den Eingang zuordnen' using errcode = '42501';
  end if;
  select * into e from crm.eingang where id = p_id for update;
  if not found then raise exception 'Eingang % nicht gefunden', p_id; end if;
  if e.status = 'verarbeitet' then
    if e.lead_id is not distinct from p_lead_id then return e; end if;
    raise exception 'Schon verarbeitet – die Zuordnung lässt sich nicht mehr ändern';
  end if;
  if not exists (select 1 from crm.leads l where l.id = p_lead_id and l.deleted_at is null) then
    raise exception 'Lead % nicht gefunden', p_lead_id;
  end if;
  update crm.eingang set lead_id = p_lead_id, status = 'neu', ergebnis = null, verarbeitet_at = null where id = p_id;
  return crm.eingang_verarbeiten(p_id);
end;
$$;
comment on function crm.eingang_zuordnen(uuid, uuid) is 'Eingang einem Lead zuordnen und sofort verbuchen (Annahme/Antwort im Namen des Postfach-Inhabers).';

create or replace function crm.eingang_ignorieren(p_id uuid) returns crm.eingang
language plpgsql security definer set search_path = '' as $$
declare e crm.eingang;
begin
  if auth.uid() is null or not private.is_member() then
    raise exception 'Nur Mitglieder dürfen den Eingang bearbeiten' using errcode = '42501';
  end if;
  select * into e from crm.eingang where id = p_id for update;
  if not found then raise exception 'Eingang % nicht gefunden', p_id; end if;
  if e.status = 'verarbeitet' then raise exception 'Schon verarbeitet – Ignorieren macht nichts rückgängig'; end if;
  update crm.eingang set status = 'ignoriert', ergebnis = 'Von Hand ignoriert', verarbeitet_at = now()
   where id = p_id returning * into e;
  return e;
end;
$$;
comment on function crm.eingang_ignorieren(uuid) is 'Eingang als erledigt ohne Aktion markieren.';

-- Eingangs-Schlüssel: 32 Zufallsbytes, url-sicheres Base64 (43 Zeichen); gespeichert wird nur der SHA-256-Hash.
-- Widerruft den bisherigen Schlüssel des Mitglieds. Der Klartext wird genau einmal zurückgegeben.
create or replace function crm.eingang_token_erzeugen(p_label text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_token text;
begin
  if v_me is null or not private.is_member() then
    raise exception 'Nur Mitglieder können einen Eingangs-Schlüssel erzeugen' using errcode = '42501';
  end if;
  update crm.eingang_tokens set revoked_at = now() where member_id = v_me and revoked_at is null;
  v_token := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
  insert into crm.eingang_tokens (member_id, token_hash, label)
  values (v_me, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), left(nullif(btrim(coalesce(p_label, '')), ''), 100));
  return v_token;
end;
$$;
comment on function crm.eingang_token_erzeugen(text) is 'Neuer Eingangs-Schlüssel für das Apps Script (Klartext nur in dieser Antwort); der bisherige Schlüssel wird widerrufen.';

create or replace function crm.eingang_token_widerrufen() returns int
language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); n int;
begin
  if v_me is null or not private.is_member() then
    raise exception 'Nur Mitglieder können Eingangs-Schlüssel widerrufen' using errcode = '42501';
  end if;
  update crm.eingang_tokens set revoked_at = now() where member_id = v_me and revoked_at is null;
  get diagnostics n = row_count;
  return n;
end;
$$;
comment on function crm.eingang_token_widerrufen() is 'Widerruft alle aktiven Eingangs-Schlüssel des angemeldeten Mitglieds; gibt die Anzahl zurück.';

-- -----------------------------------------------------------------------------------------------------
-- 5. RLS und Rechte
-- -----------------------------------------------------------------------------------------------------
alter table crm.eingang enable row level security;
alter table crm.eingang_tokens enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'crm' and tablename = 'eingang' and policyname = 'Mitglieder lesen eingang') then
    create policy "Mitglieder lesen eingang" on crm.eingang
      for select to authenticated using ((select private.is_member()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'crm' and tablename = 'eingang' and policyname = 'Mitglieder bearbeiten eingang') then
    create policy "Mitglieder bearbeiten eingang" on crm.eingang
      for update to authenticated using ((select private.is_member())) with check ((select private.is_member()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'crm' and tablename = 'eingang_tokens' and policyname = 'Mitglieder sehen eigene Schlüssel') then
    create policy "Mitglieder sehen eigene Schlüssel" on crm.eingang_tokens
      for select to authenticated using ((select private.is_member()) and member_id = (select auth.uid()));
  end if;
end
$$;

-- eingang: lesen; ändern nur Status und Lead (Ignorieren/Zuordnen – üblicher Weg sind die RPCs); anlegen nur service_role
revoke all on crm.eingang from public, anon, authenticated;
grant select on crm.eingang to authenticated;
grant update (status, lead_id) on crm.eingang to authenticated;
grant all on crm.eingang to service_role;
-- eingang_tokens: eigene Zeilen ohne Hash lesen; erzeugen/widerrufen nur über die RPCs
revoke all on crm.eingang_tokens from public, anon, authenticated;
grant select (id, member_id, label, created_at, last_used_at, revoked_at) on crm.eingang_tokens to authenticated;
grant all on crm.eingang_tokens to service_role;

revoke all on function crm.eingang_before_update() from public, anon, authenticated;
revoke all on function crm.eingang_verarbeiten(uuid) from public, anon, authenticated;
grant execute on function crm.eingang_verarbeiten(uuid) to service_role;
revoke all on function crm.eingang_zuordnen(uuid, uuid) from public, anon;
revoke all on function crm.eingang_ignorieren(uuid) from public, anon;
revoke all on function crm.eingang_token_erzeugen(text) from public, anon;
revoke all on function crm.eingang_token_widerrufen() from public, anon;
grant execute on function crm.eingang_zuordnen(uuid, uuid), crm.eingang_ignorieren(uuid),
                           crm.eingang_token_erzeugen(text), crm.eingang_token_widerrufen() to authenticated, service_role;

-- -----------------------------------------------------------------------------------------------------
-- 6. Realtime: neue Eingänge erscheinen live in der App
-- -----------------------------------------------------------------------------------------------------
do $$
begin
  alter table crm.eingang replica identity full;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'crm' and tablename = 'eingang') then
    alter publication supabase_realtime add table crm.eingang;
  end if;
end
$$;

notify pgrst, 'reload schema';

-- =====================================================================================================
-- 7. Korrekturen nach dem Review (2026-10-15, nach dem ersten Einspielen) – idempotent; live wurde nur dieser Block ausgeführt.
--   7.1 crm.eingang_textgleich – Textvergleich Mail ↔ erfasste Antwort (Leerraum, Groß/klein, Anfang ≥ 30 Zeichen)
--       crm.eingang_eigene_antwort – gab es zwischen zwei Zeitpunkten eine eigene LinkedIn-Antwort (nicht blinder Sequenzschritt)?
--   7.2 crm.eingang_verarbeiten v2
--       · Doppel-Schutz für Nachrichten nach Gesprächszug statt ±10 Minuten: schon erfasst, wenn eine nachricht_erhalten
--         ab 24 h vor der Mail ohne eigene LinkedIn-Nachricht dazwischen liegt (A später gedrückt, Rückstand beim ersten Lauf),
--         oder ±10 Minuten, oder derselbe Text in ±3 Tagen. Liegt nach der Mail schon eine eigene Nachricht und keine erfasste
--         Antwort, wird nichts verbucht (alte, schon beantwortete Nachricht – sonst stünde der Lead wieder als „Antwort offen“
--         in Heute und die Exit-Regel stoppte z. B. „Nachfassen im Gespräch“).
--       · Der eigene Profil-Slug (member_profiles.linkedin_url) zählt nicht als Lead-Profil.
--       · Findet der Slug keinen Lead, entscheidet der Name zusammen mit der Vernetzung dieses Mitglieds.
--       · Zuordnung nur über den Namen: Annahme nur bei offener Anfrage dieses Mitglieds, Antwort nur bei bestehender Vernetzung
--         (sonst „unbekannt“ – eine andere Person gleichen Namens bekäme sonst Opener-Aufgaben).
--       · Ignorierte Einträge ohne Lead behalten nur die Parser-Entscheidung (keine Namen Dritter).
--   7.3 crm.eingang_ignorieren v2 (Datensparsamkeit wie 7.2)
--   7.4 crm.set_reply_label – Reaktion an einer schon erfassten Antwort nachtragen (statt einer zweiten nachricht_erhalten)
--   7.5 crm.eingang_aufraeumen – ignorierte Einträge nach 30 Tagen löschen (ruft die Edge Function bei jedem Aufruf auf)
--   7.6 Rechte: kein direktes UPDATE mehr auf crm.eingang – Schreiben nur über die RPCs
-- =====================================================================================================

-- 7.1 -------------------------------------------------------------------------------------------------
create or replace function crm.eingang_textgleich(p_a text, p_b text) returns boolean
language sql immutable set search_path = '' as $$
  select case
           when x = '' or y = '' then false
           when x = y then true
           when least(length(x), length(y)) >= 30 then left(x, least(80, length(x), length(y))) = left(y, least(80, length(x), length(y)))
           else false
         end
    from (select lower(btrim(regexp_replace(coalesce(p_a, ''), '[\s„“”"‚‘’'']+', ' ', 'g'))) as x,
                 lower(btrim(regexp_replace(coalesce(p_b, ''), '[\s„“”"‚‘’'']+', ' ', 'g'))) as y) s;
$$;
comment on function crm.eingang_textgleich(text, text) is 'Eingang: gleicher Nachrichtentext? Leerraum/Anführungszeichen/Groß-klein egal; ab 30 Zeichen reicht der gleiche Anfang (bis 80 Zeichen).';

-- Eigene Antwort = gespraech_eroeffnet/nachricht_gesendet/pitch_gesendet ohne Sequenz oder aus einer Sequenz, die erst nach p_von
-- gestartet wurde (z. B. „Nachfassen im Gespräch“). Ein blind weiterlaufender Sequenzschritt (Sequenz älter als die Nachricht)
-- beantwortet nichts.
create or replace function crm.eingang_eigene_antwort(p_lead_id uuid, p_von timestamptz, p_bis timestamptz default null) returns boolean
language sql stable set search_path = '' as $$
  select exists (
    select 1 from crm.activities o
     where o.lead_id = p_lead_id
       and o.type in ('gespraech_eroeffnet', 'nachricht_gesendet', 'pitch_gesendet')
       and o.occurred_at > p_von and (p_bis is null or o.occurred_at < p_bis)
       and (o.enrollment_id is null or exists (select 1 from crm.enrollments x where x.id = o.enrollment_id and x.created_at > p_von)));
$$;
comment on function crm.eingang_eigene_antwort(uuid, timestamptz, timestamptz) is 'Eingang: eigene LinkedIn-Antwort an den Lead zwischen p_von und p_bis (ohne blind weiterlaufende Sequenzschritte)?';

-- 7.2 -------------------------------------------------------------------------------------------------
create or replace function crm.eingang_verarbeiten(p_id uuid) returns crm.eingang
language plpgsql security definer set search_path = '' as $$
declare
  e crm.eingang;
  v_lead uuid;
  v_weg text;                 -- manuell · slug · name
  v_name text;
  v_kern text;
  v_slug_norm text;
  v_eigen_norm text;
  v_n int := 0;
  v_eigene int := 0;
  v_ids uuid[];
  v_conn crm.linkedin_connections;
  v_hat_conn boolean;
  v_act bigint;
  v_status text;
  v_ergebnis text;
  v_hinweis text := '';
  v_prev_sub text;
  v_text text;
begin
  -- Aufrufer: Edge Function (service_role, auth.uid() leer) oder Mitglied über eingang_zuordnen
  if auth.uid() is not null and not private.is_member() then
    raise exception 'Nur Mitglieder dürfen den Eingang verarbeiten' using errcode = '42501';
  end if;
  select * into e from crm.eingang where id = p_id for update;
  if not found then raise exception 'Eingang % nicht gefunden', p_id; end if;
  if e.status in ('verarbeitet', 'ignoriert') then return e; end if;

  begin
    v_lead := e.lead_id;
    if v_lead is not null then v_weg := 'manuell'; end if;

    -- 1) Profil-Slug; der eigene Slug des Mitglieds (Kopf/Fuß jeder Mail) zählt nicht
    if nullif(btrim(e.linkedin_slug), '') is not null then
      v_slug_norm := crm.normalize_linkedin_url('linkedin.com/in/' || btrim(e.linkedin_slug));
      select crm.normalize_linkedin_url(p.linkedin_url) into v_eigen_norm from crm.member_profiles p where p.member_id = e.member_id;
      if v_slug_norm is not null and v_slug_norm = v_eigen_norm then v_slug_norm := null; end if;
    end if;
    if v_lead is null and v_slug_norm is not null then
      select l.id into v_lead from crm.leads l where l.linkedin_url_norm = v_slug_norm and l.deleted_at is null;
      if v_lead is not null then v_weg := 'slug'; end if;
    end if;

    -- 2) Name (Titel/Anrede abgetrennt: „Dr. Anna Beispiel“ trifft auch „Anna Beispiel“)
    v_name := lower(btrim(regexp_replace(coalesce(e.absender_name, ''), '\s+', ' ', 'g')));
    if v_lead is null and v_name <> '' then
      select lower(btrim(coalesce(s.first_name, '') || ' ' || coalesce(s.last_name, ''))) into v_kern
        from crm.split_person_name(e.absender_name) s;
      v_kern := coalesce(nullif(v_kern, ''), v_name);
      -- 2a) Hat die Mail einen fremden Profil-Link, zuerst nur Leads ohne eigenes Profil; eigene Leads zuerst
      select count(*), count(*) filter (where l.owner_id = e.member_id)
        into v_n, v_eigene
        from crm.leads l
       where l.deleted_at is null and lower(l.full_name) in (v_name, v_kern)
         and (v_slug_norm is null or l.linkedin_url_norm is null);
      if v_eigene = 1 then
        select l.id into v_lead from crm.leads l
         where l.deleted_at is null and lower(l.full_name) in (v_name, v_kern)
           and (v_slug_norm is null or l.linkedin_url_norm is null) and l.owner_id = e.member_id;
      elsif v_n = 1 then
        select l.id into v_lead from crm.leads l
         where l.deleted_at is null and lower(l.full_name) in (v_name, v_kern)
           and (v_slug_norm is null or l.linkedin_url_norm is null);
      end if;
      -- 2b) Sonst: gleicher Name und eine Vernetzung/Anfrage dieses Mitglieds (z. B. Lead-URL ohne Nachnamen, abweichender Link)
      if v_lead is null then
        select array_agg(distinct l.id) into v_ids
          from crm.leads l
          join crm.linkedin_connections c on c.lead_id = l.id and c.member_id = e.member_id
         where l.deleted_at is null and lower(l.full_name) in (v_name, v_kern)
           and (e.art <> 'annahme' or c.status in ('ausstehend', 'angenommen'));
        if coalesce(array_length(v_ids, 1), 0) = 1 then
          v_lead := v_ids[1];
          if v_slug_norm is not null then v_hinweis := ' · Profil-Link der Mail weicht vom Lead ab, bitte prüfen'; end if;
        elsif coalesce(array_length(v_ids, 1), 0) > 1 or v_n > 1 then
          v_ergebnis := format('Name „%s“ passt zu %s Leads – bitte zuordnen', e.absender_name, greatest(v_n, coalesce(array_length(v_ids, 1), 0)));
        elsif v_slug_norm is not null and exists (select 1 from crm.leads l where l.deleted_at is null and lower(l.full_name) in (v_name, v_kern)) then
          v_ergebnis := format('Ein Lead heißt „%s“, hat aber ein anderes LinkedIn-Profil – bitte prüfen', e.absender_name);
        end if;
      end if;
      if v_lead is not null then v_weg := 'name'; end if;
    end if;

    -- 3) Nur über den Namen gefunden: buchen nur, wenn die Vernetzung dieses Mitglieds dazu passt
    if v_weg = 'name' and e.art in ('annahme', 'nachricht') then
      select * into v_conn from crm.linkedin_connections where lead_id = v_lead and member_id = e.member_id;
      v_hat_conn := found;
      if e.art = 'annahme' and not (v_hat_conn and v_conn.status in ('ausstehend', 'angenommen')) then
        v_ergebnis := format('Name „%s“ passt, aber du hast keine offene Anfrage an diesen Lead – bitte prüfen', e.absender_name);
        v_lead := null;
      elsif e.art = 'nachricht' and not v_hat_conn then
        v_ergebnis := format('Name „%s“ passt, aber du bist mit diesem Lead nicht vernetzt – bitte prüfen', e.absender_name);
        v_lead := null;
      end if;
    end if;

    if v_lead is null then
      if e.art = 'einladung' then
        v_status := 'ignoriert';
        v_ergebnis := 'Einladung von einer Person, die nicht im CRM ist';
      elsif e.art = 'sonstiges' then
        v_status := 'ignoriert';
        v_ergebnis := 'Keine Aktion nötig';
      else
        v_status := 'unbekannt';
        v_ergebnis := coalesce(v_ergebnis, 'Kein passender Lead gefunden – bitte zuordnen');
      end if;
    else
      -- 4) Verbuchen im Namen des Postfach-Inhabers (log_reply/mark_accepted nutzen auth.uid())
      v_prev_sub := current_setting('request.jwt.claim.sub', true);
      perform set_config('request.jwt.claim.sub', e.member_id::text, true);

      if e.art = 'annahme' then
        select * into v_conn from crm.linkedin_connections where lead_id = v_lead and member_id = e.member_id;
        if found and v_conn.status = 'angenommen' then
          v_status := 'verarbeitet';
          v_ergebnis := 'Vernetzung war schon als angenommen erfasst';
        else
          perform crm.mark_accepted(v_lead, e.member_id, crm.berlin_date(e.empfangen_at));
          v_status := 'verarbeitet';
          v_ergebnis := 'Annahme verbucht' ||
            case when exists (select 1 from crm.enrollments x where x.lead_id = v_lead and x.status = 'aktiv' and x.created_at = now())
                 then ' – Sequenz gestartet' else '' end;
        end if;
        select a.id into v_act from crm.activities a
         where a.lead_id = v_lead and a.member_id = e.member_id and a.type = 'vernetzung_angenommen'
         order by a.occurred_at desc, a.id desc limit 1;

      elsif e.art = 'nachricht' then
        v_text := nullif(btrim(e.text), '');
        -- Schon erfasst? (a) derselbe Gesprächszug: erfasste Antwort ab 24 h vor der Mail ohne eigene LinkedIn-Antwort
        -- dazwischen (A wird zum Zeitpunkt des Tastendrucks gebucht, meist ohne Zitat) · (b) ±10 Minuten (A gedrückt, sofort
        -- geantwortet, Mail kam später) · (c) derselbe Text innerhalb von ±3 Tagen
        select a.id into v_act from crm.activities a
         where a.lead_id = v_lead and a.type = 'nachricht_erhalten'
           and (   (a.occurred_at >= e.empfangen_at - interval '24 hours'
                    and not crm.eingang_eigene_antwort(v_lead, least(a.occurred_at, e.empfangen_at), greatest(a.occurred_at, e.empfangen_at)))
                or abs(extract(epoch from a.occurred_at - e.empfangen_at)) <= 600
                or (v_text is not null and a.note is not null
                    and a.occurred_at between e.empfangen_at - interval '3 days' and e.empfangen_at + interval '3 days'
                    and crm.eingang_textgleich(a.note, v_text)))
         order by abs(extract(epoch from a.occurred_at - e.empfangen_at)), a.id limit 1;
        if v_act is not null then
          v_status := 'verarbeitet';
          v_ergebnis := 'Antwort war schon erfasst';
        elsif crm.eingang_eigene_antwort(v_lead, e.empfangen_at) then
          -- Nach der Mail hast du schon geschrieben: alte, beantwortete Nachricht – nicht wieder „Antwort offen“, keine Exit-Regel
          v_status := 'verarbeitet';
          v_ergebnis := 'Ältere Nachricht – du hast danach schon geschrieben, nichts verbucht';
        else
          v_act := crm.log_reply(v_lead, 'linkedin', null, v_text, e.empfangen_at);
          v_status := 'verarbeitet';
          v_ergebnis := 'Antwort verbucht' ||
            case when exists (select 1 from crm.enrollments x where x.lead_id = v_lead and x.status = 'gestoppt'
                                 and x.stopped_reason = 'antwort_erhalten' and x.stopped_at = now())
                 then ' – Sequenz gestoppt' else '' end;
        end if;

      elsif e.art = 'einladung' then
        v_status := 'neu';
        v_ergebnis := 'Einladung von diesem Lead – auf LinkedIn selbst annehmen, dann im CRM „Angenommen“ setzen';

      else
        v_status := 'ignoriert';
        v_ergebnis := 'Keine Aktion nötig';
      end if;

      perform set_config('request.jwt.claim.sub', coalesce(v_prev_sub, ''), true);
    end if;

    v_ergebnis := left(v_ergebnis || case when v_status = 'verarbeitet' then v_hinweis else '' end, 1000);
    update crm.eingang
       set lead_id = v_lead, status = v_status, ergebnis = v_ergebnis, activity_id = v_act,
           verarbeitet_at = case when v_status = 'neu' then null else now() end,
           -- Datensparsamkeit: ohne Lead und ohne Aktion keine Namen, Texte und Links Dritter aufheben
           absender_name = case when v_status = 'ignoriert' and v_lead is null then null else absender_name end,
           linkedin_slug = case when v_status = 'ignoriert' and v_lead is null then null else linkedin_slug end,
           text          = case when v_status = 'ignoriert' and v_lead is null then null else text end,
           roh           = case when v_status = 'ignoriert' and v_lead is null
                                then jsonb_strip_nulls(jsonb_build_object('parser', roh -> 'parser')) else roh end
     where id = p_id
     returning * into e;
  exception when others then
    -- Teiltransaktion ist zurückgerollt (auch set_config); Eingang bleibt mit Fehlertext stehen
    update crm.eingang
       set status = 'fehler', ergebnis = left(sqlerrm, 1000), lead_id = coalesce(v_lead, lead_id), verarbeitet_at = now()
     where id = p_id
     returning * into e;
  end;
  return e;
end;
$$;
comment on function crm.eingang_verarbeiten(uuid) is 'Ordnet einen Eingang einem Lead zu (Slug ohne eigenen Slug, sonst eindeutiger Name, eigene Leads zuerst, sonst Name + Vernetzung) und verbucht: annahme → mark_accepted (nur über den Namen: nur bei offener Anfrage), nachricht → log_reply (nur über den Namen: nur bei Vernetzung; nicht, wenn im selben Gesprächszug schon erfasst oder danach schon geantwortet). Fehler → status fehler.';

-- 7.3 -------------------------------------------------------------------------------------------------
create or replace function crm.eingang_ignorieren(p_id uuid) returns crm.eingang
language plpgsql security definer set search_path = '' as $$
declare e crm.eingang;
begin
  if auth.uid() is null or not private.is_member() then
    raise exception 'Nur Mitglieder dürfen den Eingang bearbeiten' using errcode = '42501';
  end if;
  select * into e from crm.eingang where id = p_id for update;
  if not found then raise exception 'Eingang % nicht gefunden', p_id; end if;
  if e.status = 'verarbeitet' then raise exception 'Schon verarbeitet – Ignorieren macht nichts rückgängig'; end if;
  update crm.eingang
     set status = 'ignoriert', ergebnis = 'Von Hand ignoriert', verarbeitet_at = now(),
         absender_name = case when lead_id is null then null else absender_name end,
         linkedin_slug = case when lead_id is null then null else linkedin_slug end,
         text          = case when lead_id is null then null else text end,
         roh           = case when lead_id is null then jsonb_strip_nulls(jsonb_build_object('parser', roh -> 'parser')) else roh end
   where id = p_id returning * into e;
  return e;
end;
$$;
comment on function crm.eingang_ignorieren(uuid) is 'Eingang als erledigt ohne Aktion markieren (ohne Lead: Name, Text und Links werden dabei entfernt).';

-- 7.4 -------------------------------------------------------------------------------------------------
-- Reaktion an einer schon erfassten Antwort nachtragen (z. B. aus der Mail verbucht, dann in der Seitenleiste/mit A bewertet).
-- Folgeaktionen wie log_reply: widerspruch → Sperre + beendet, nicht_icp → beendet. Keine zweite nachricht_erhalten.
create or replace function crm.set_reply_label(p_activity_id bigint, p_label crm.reply_label, p_note text default null)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare a crm.activities; v_me uuid := auth.uid(); v_note text;
begin
  if v_me is null or not private.is_member() then
    raise exception 'Nur Mitglieder dürfen Reaktionen erfassen' using errcode = '42501';
  end if;
  if p_label is null then raise exception 'Die Reaktion fehlt'; end if;
  select * into a from crm.activities where id = p_activity_id for update;
  if not found then raise exception 'Aktivität % nicht gefunden', p_activity_id; end if;
  if a.type not in ('nachricht_erhalten', 'email_erhalten') then
    raise exception 'Eine Reaktion gibt es nur für eingegangene Nachrichten';
  end if;
  if not exists (select 1 from crm.leads l where l.id = a.lead_id and l.deleted_at is null) then
    raise exception 'Lead % nicht gefunden', a.lead_id;
  end if;
  if a.reply_label is not null then
    if a.reply_label = p_label then return a.id; end if;
    raise exception 'Die Reaktion ist schon erfasst – ändern lässt sie sich im CRM';
  end if;
  v_note := coalesce(nullif(btrim(a.note), ''), nullif(btrim(p_note), ''));
  update crm.activities
     set reply_label = p_label, outcome = p_label::text, note = v_note,
         metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('label', p_label, 'label_nachgetragen_at', now(), 'label_nachgetragen_von', v_me)
   where id = a.id;
  if p_label = 'widerspruch' then
    update crm.leads set do_not_contact = true, objection_note = coalesce(v_note, objection_note), objection_at = a.occurred_at,
                         stage = 'beendet', ended_reason = 'widerspruch', ended_note = coalesce(v_note, ended_note)
     where id = a.lead_id;
  elsif p_label = 'nicht_icp' then
    perform crm.set_stage(a.lead_id, 'beendet', v_me, 'nicht_icp', v_note);
  end if;
  return a.id;
end;
$$;
comment on function crm.set_reply_label(bigint, crm.reply_label, text) is 'Reaktion (reply_label) an einer schon erfassten eingegangenen Nachricht nachtragen; Folgeaktionen wie log_reply (widerspruch, nicht_icp). Notiz nur, wenn die Aktivität noch keinen Text hat. Gibt die Aktivitäts-ID zurück.';

-- 7.5 -------------------------------------------------------------------------------------------------
create or replace function crm.eingang_aufraeumen() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  delete from crm.eingang where status = 'ignoriert' and coalesce(verarbeitet_at, created_at) < now() - interval '30 days';
  get diagnostics n = row_count;
  return n;
end;
$$;
comment on function crm.eingang_aufraeumen() is 'Löschfrist: ignorierte Eingänge (Werbung, Hinweise, Einladungen Fremder, von Hand ignoriert) nach 30 Tagen löschen. Ruft die Edge Function linkedin-eingang bei jedem Aufruf auf.';

-- 7.6 -------------------------------------------------------------------------------------------------
revoke update (status, lead_id) on crm.eingang from authenticated;
revoke update on crm.eingang from authenticated;
drop policy if exists "Mitglieder bearbeiten eingang" on crm.eingang;

revoke all on function crm.eingang_textgleich(text, text) from public, anon, authenticated;
revoke all on function crm.eingang_eigene_antwort(uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function crm.eingang_verarbeiten(uuid) from public, anon, authenticated;
grant execute on function crm.eingang_verarbeiten(uuid) to service_role;
revoke all on function crm.eingang_ignorieren(uuid) from public, anon;
grant execute on function crm.eingang_ignorieren(uuid) to authenticated, service_role;
revoke all on function crm.eingang_aufraeumen() from public, anon, authenticated;
grant execute on function crm.eingang_aufraeumen() to service_role;
revoke all on function crm.set_reply_label(bigint, crm.reply_label, text) from public, anon;
grant execute on function crm.set_reply_label(bigint, crm.reply_label, text) to authenticated, service_role;

notify pgrst, 'reload schema';
