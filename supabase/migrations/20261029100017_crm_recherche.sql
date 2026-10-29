-- =====================================================================================================
-- CRM Steiner & Co. · Migration 17 · LinkedIn-Recherchelauf (Play-Button auf /auftrag), idempotent, additiv.
-- Stand: 2026-10-29
--
-- Vincent, 29.10.2026: Recherche → Unternehmens- und Personenqualifizierung → Dublettenprüfung → Vernetzung ohne Nachricht
-- → CRM-Dokumentation, bis zu 30 gesendete Anfragen je Lauf, aus dem CRM startbar. Ausgeführt wird auf LinkedIn von einem
-- beaufsichtigten Browser-Agenten im eigenen, angemeldeten Browser (keine LinkedIn-API, kein Server-Bot); das CRM legt die
-- Regeln fest und erzwingt sie hier serverseitig:
--   · crm.recherche_laeufe  – ein Lauf je Start (Zähler, Status, Meldung); höchstens EIN aktiver Lauf je Person
--   · crm.recherche_profile – jedes geprüfte Profil mit Ergebnis (gesendet · dublette · nicht_qualifiziert · unklar · fehler)
--   · recherche_starten()   – neuer Lauf oder der schon aktive (Doppelklick startet nichts doppelt)
--   · recherche_pruefen()   – Dublettenprüfung (LinkedIn-URL als Schlüssel, dazu Name + Firma, Sperrliste, frühere Absagen)
--   · recherche_eintragen() – Ergebnis buchen; „gesendet“ legt den Lead an bzw. nutzt ihn, ruft log_request (Verbindung
--                             „ausstehend“, Aktivität, KPI „Vernetzungen versendet“) – nur bis zum Ziel, nur ohne Dublette,
--                             nur mit Kontrollpunkt alle 10 Profile
--   · recherche_kontrolle() – Kontrollpunkt bestätigen · recherche_status() – pausieren, fortsetzen, beenden, Fehler
-- Bestehende Strukturen werden genutzt: leads (qualification.recherche, source 'recherche', source_batch_id), import_batches
-- (ein Batch je Lauf = „Quelle“ in der Leads-Liste), linkedin_connections + Trigger (Aktivität, Phase, KPI-Zähler).
-- =====================================================================================================

-- -----------------------------------------------------------------------------------------------------
-- 1. Tabellen
-- -----------------------------------------------------------------------------------------------------
create table if not exists crm.recherche_laeufe (
  id              uuid primary key default gen_random_uuid(),
  member_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status          text not null default 'laeuft'
                  check (status in ('laeuft', 'pausiert', 'abgeschlossen', 'abgebrochen', 'fehler')),
  ziel            integer not null default 30 check (ziel between 1 and 30),
  geprueft        integer not null default 0,
  qualifiziert    integer not null default 0,
  gesendet        integer not null default 0,
  dubletten       integer not null default 0,
  abgelehnt       integer not null default 0,
  unklar          integer not null default 0,
  fehler          integer not null default 0,
  kontrollen      integer not null default 0,
  aktuelles_profil text,
  meldung         text check (meldung is null or char_length(meldung) <= 2000),
  batch_id        uuid references crm.import_batches (id) on delete set null,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  updated_at      timestamptz not null default now()
);

comment on table crm.recherche_laeufe is 'LinkedIn-Recherchelauf (Play-Button /auftrag): Zähler, Status, Meldung; je Person höchstens ein aktiver Lauf.';
comment on column crm.recherche_laeufe.kontrollen is 'Bestätigte Kontrollpunkte (alle 10 geprüften Profile einer).';
comment on column crm.recherche_laeufe.batch_id is 'Import-Batch des Laufs = Quelle der angelegten Leads (/leads?quelle=…).';

create unique index if not exists recherche_ein_aktiver_lauf
  on crm.recherche_laeufe (member_id) where status in ('laeuft', 'pausiert');
create index if not exists recherche_laeufe_start_idx on crm.recherche_laeufe (started_at desc);

create table if not exists crm.recherche_profile (
  id                uuid primary key default gen_random_uuid(),
  lauf_id           uuid not null references crm.recherche_laeufe (id) on delete cascade,
  member_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  linkedin_url      text not null,
  linkedin_url_norm text generated always as (crm.normalize_linkedin_url(linkedin_url)) stored,
  vorname           text,
  nachname          text,
  firma             text,
  position          text,
  kategorie         text check (kategorie in ('A', 'B', 'C', 'bedingt')),
  ergebnis          text not null check (ergebnis in ('gesendet', 'dublette', 'nicht_qualifiziert', 'unklar', 'fehler')),
  grund             text check (grund is null or char_length(grund) <= 1000),
  ausgangspunkt     text check (ausgangspunkt is null or char_length(ausgangspunkt) <= 500),
  firma_website     text check (firma_website is null or char_length(firma_website) <= 500),
  lead_id           uuid references crm.leads (id) on delete set null,
  created_at        timestamptz not null default now()
);

comment on table crm.recherche_profile is 'Jedes in einem Recherchelauf geprüfte LinkedIn-Profil mit Ergebnis und Grund (auch Absagen und Dubletten).';

create unique index if not exists recherche_profil_einmal_je_lauf on crm.recherche_profile (lauf_id, linkedin_url_norm);
create index if not exists recherche_profile_norm_idx on crm.recherche_profile (linkedin_url_norm);

create or replace trigger recherche_laeufe_set_updated_at before update on crm.recherche_laeufe
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------------------------------
-- 2. RLS: Mitglieder lesen alles, schreiben über die Funktionen (Invoker) – kein Löschen
-- -----------------------------------------------------------------------------------------------------
alter table crm.recherche_laeufe enable row level security;
alter table crm.recherche_profile enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['recherche_laeufe', 'recherche_profile'] loop
    if not exists (select 1 from pg_policies where schemaname = 'crm' and tablename = t and policyname = 'Mitglieder lesen ' || t) then
      execute format('create policy %I on crm.%I for select to authenticated using ((select private.is_member()))',
        'Mitglieder lesen ' || t, t);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'crm' and tablename = t and policyname = 'Mitglieder legen ' || t || ' an') then
      execute format('create policy %I on crm.%I for insert to authenticated with check ((select private.is_member()) and member_id = (select auth.uid()))',
        'Mitglieder legen ' || t || ' an', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'crm' and tablename = t and policyname = 'Mitglieder bearbeiten ' || t) then
      execute format('create policy %I on crm.%I for update to authenticated using ((select private.is_member())) with check ((select private.is_member()))',
        'Mitglieder bearbeiten ' || t, t);
    end if;
  end loop;
end
$$;

revoke all on crm.recherche_laeufe, crm.recherche_profile from public, anon;
grant select, insert, update on crm.recherche_laeufe, crm.recherche_profile to authenticated;
revoke delete, truncate on crm.recherche_laeufe, crm.recherche_profile from authenticated;
grant all on crm.recherche_laeufe, crm.recherche_profile to service_role;

-- -----------------------------------------------------------------------------------------------------
-- 3. Hilfsfunktion: Zielrolle aus dem Positionstext (lead_role für Opener-Wahl, Filter)
-- -----------------------------------------------------------------------------------------------------
create or replace function crm.recherche_rolle(p_position text) returns crm.lead_role
language sql immutable set search_path = '' as $$
  select case
    when p_position is null or btrim(p_position) = '' then 'unbekannt'::crm.lead_role
    when p_position ~* '(gesch(ä|ae)ftsf(ü|ue)hr|managing director|\mceo\M|vorstand)' then 'geschaeftsfuehrer'
    when p_position ~* '(inhaber|gr(ü|ue)nder|founder|owner|eigent(ü|ue)mer)' then 'inhaber'
    when p_position ~* '(vertrieb|\msales\M)' then 'vertrieb'
    when p_position ~* '(kunden|customer|service|after.?sales|support|reklamation)' then 'kundenbetreuer'
    when p_position ~* '(projekt|project|technische|technical|meister|montage|installation|elektrotechni|betriebsleit|operations)' then 'projektleiter'
    when p_position ~* '(innendienst|disponent|einsatzplan|office|assistenz)' then 'innendienst'
    else 'sonstiges'
  end
$$;
comment on function crm.recherche_rolle(text) is 'Recherchelauf: Positionstext → lead_role (Geschäftsführung, Inhaber, Vertrieb, Kundenbetreuung, Projekt/Technik, Innendienst).';

-- -----------------------------------------------------------------------------------------------------
-- 4. Lauf starten
-- -----------------------------------------------------------------------------------------------------
create or replace function crm.recherche_starten(p_ziel integer default 30) returns crm.recherche_laeufe
language plpgsql set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  l crm.recherche_laeufe;
  b uuid;
begin
  if v_me is null or not private.is_member() then raise exception 'Nur für angemeldete Mitglieder'; end if;
  select * into l from crm.recherche_laeufe where member_id = v_me and status in ('laeuft', 'pausiert') limit 1;
  if found then return l; end if;
  begin
    insert into crm.import_batches (member_id, source, label, row_count)
    values (v_me, 'recherche', 'LinkedIn-Recherche ' || to_char(now() at time zone 'Europe/Berlin', 'DD.MM.YYYY HH24:MI'), 0)
    returning id into b;
    insert into crm.recherche_laeufe (member_id, ziel, batch_id)
    values (v_me, least(greatest(coalesce(p_ziel, 30), 1), 30), b)
    returning * into l;
  exception when unique_violation then
    -- zwei Klicks gleichzeitig: der andere hat gewonnen
    select * into l from crm.recherche_laeufe where member_id = v_me and status in ('laeuft', 'pausiert') limit 1;
  end;
  return l;
end;
$$;
comment on function crm.recherche_starten(integer) is 'Recherchelauf starten – oder den schon aktiven (laeuft/pausiert) zurückgeben; nie zwei parallel.';

-- -----------------------------------------------------------------------------------------------------
-- 5. Dublettenprüfung (schreibt nichts)
-- -----------------------------------------------------------------------------------------------------
create or replace function crm.recherche_pruefen(
  p_lauf uuid, p_url text, p_vorname text default null, p_nachname text default null, p_firma text default null
) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  v_norm text := crm.normalize_linkedin_url(p_url);
  v_name text := lower(btrim(coalesce(p_vorname, '') || ' ' || coalesce(p_nachname, '')));
  l crm.leads;
  c crm.linkedin_connections;
  p crm.recherche_profile;
  wer text;
begin
  if v_norm is null then
    return jsonb_build_object('frei', false, 'art', 'url', 'grund', 'Keine gültige LinkedIn-Profil-URL (https://www.linkedin.com/in/…).');
  end if;

  select * into p from crm.recherche_profile where lauf_id = p_lauf and linkedin_url_norm = v_norm limit 1;
  if found then
    return jsonb_build_object('frei', false, 'art', 'lauf', 'grund', 'In diesem Lauf schon eingetragen (' || p.ergebnis || ').');
  end if;

  if crm.is_blocked(v_norm, null, null) then
    return jsonb_build_object('frei', false, 'art', 'sperrliste', 'grund', 'Steht auf der Sperrliste – nicht kontaktieren.');
  end if;

  select * into l from crm.leads where linkedin_url_norm = v_norm limit 1;
  if found then
    if l.deleted_at is not null then
      return jsonb_build_object('frei', false, 'art', 'crm', 'lead_id', l.id, 'grund', 'Im CRM im Papierkorb – nicht anfragen.');
    end if;
    if l.do_not_contact or exists (select 1 from crm.companies x where x.id = l.company_id and x.do_not_contact) then
      return jsonb_build_object('frei', false, 'art', 'crm', 'lead_id', l.id, 'grund', 'Im CRM als „nicht kontaktieren“ markiert.');
    end if;
    select * into c from crm.linkedin_connections where lead_id = l.id order by coalesce(requested_at, accepted_at, created_at) desc limit 1;
    if found then
      select coalesce(m.display_name, 'jemand') into wer from crm.members m where m.id = c.member_id;
      return jsonb_build_object('frei', false, 'art', 'verbindung', 'lead_id', l.id, 'grund',
        case c.status
          when 'angenommen' then 'Schon vernetzt (' || coalesce(wer, 'jemand') || ').'
          when 'ausstehend' then 'Anfrage schon offen (' || coalesce(wer, 'jemand') || ', ' || coalesce(to_char(c.requested_at at time zone 'Europe/Berlin', 'DD.MM.YYYY'), 'ohne Datum') || ').'
          else 'Schon einmal angefragt (' || c.status || ') – nicht erneut.'
        end);
    end if;
    if l.stage <> 'neu' then
      return jsonb_build_object('frei', false, 'art', 'crm', 'lead_id', l.id, 'grund', 'Schon im CRM in Bearbeitung (Stufe ' || l.stage || ').');
    end if;
    return jsonb_build_object('frei', true, 'art', 'bekannt', 'lead_id', l.id,
      'grund', 'Im CRM als neuer Lead ohne Anfrage – darf angefragt werden (der vorhandene Datensatz wird genutzt).');
  end if;

  -- gleicher Name bei gleicher Firma, aber anderes/kein LinkedIn-Profil im CRM
  if v_name <> '' then
    select * into l from crm.leads x
     where x.deleted_at is null and lower(x.full_name) = v_name
       and (p_firma is null or btrim(p_firma) = '' or crm.company_norm(x.company_name) = crm.company_norm(p_firma))
     limit 1;
    if found then
      return jsonb_build_object('frei', false, 'art', 'name', 'lead_id', l.id,
        'grund', 'Gleicher Name' || case when coalesce(btrim(p_firma), '') <> '' then ' bei gleicher Firma' else '' end
                 || ' schon im CRM (' || coalesce(l.company_name, 'ohne Firma') || ') – vermutlich dieselbe Person.');
    end if;
  end if;

  select * into p from crm.recherche_profile where linkedin_url_norm = v_norm and ergebnis = 'nicht_qualifiziert'
   order by created_at desc limit 1;
  if found then
    return jsonb_build_object('frei', false, 'art', 'abgelehnt',
      'grund', 'Am ' || to_char(p.created_at at time zone 'Europe/Berlin', 'DD.MM.YYYY') || ' als nicht qualifiziert abgelehnt: ' || coalesce(p.grund, 'ohne Grund') || '.');
  end if;

  return jsonb_build_object('frei', true, 'art', 'neu', 'grund', 'Neu – noch nicht im CRM, keine Anfrage bekannt.');
end;
$$;
comment on function crm.recherche_pruefen(uuid, text, text, text, text) is 'Recherchelauf: darf dieses Profil angefragt werden? LinkedIn-URL als Schlüssel, dazu Sperrliste, Verbindungen, Stufe, Name+Firma, frühere Absagen.';

-- -----------------------------------------------------------------------------------------------------
-- 6. Ergebnis eintragen
-- -----------------------------------------------------------------------------------------------------
create or replace function crm.recherche_eintragen(
  p_lauf uuid,
  p_url text,
  p_ergebnis text,
  p_vorname text default null,
  p_nachname text default null,
  p_firma text default null,
  p_position text default null,
  p_kategorie text default null,
  p_grund text default null,
  p_ausgangspunkt text default null,
  p_firma_website text default null
) returns crm.recherche_laeufe
language plpgsql set search_path = '' as $$
declare
  r crm.recherche_laeufe;
  v_me uuid;
  v_norm text := crm.normalize_linkedin_url(p_url);
  chk jsonb;
  v_lead uuid;
  v_quali jsonb;
  leer constant text := '';
begin
  select * into r from crm.recherche_laeufe where id = p_lauf for update;
  if not found then raise exception 'Recherchelauf nicht gefunden'; end if;
  v_me := coalesce(auth.uid(), r.member_id);
  if v_me <> r.member_id then raise exception 'Dieser Lauf gehört einer anderen Person'; end if;
  if r.status <> 'laeuft' then raise exception 'Der Lauf ist %, erst fortsetzen', r.status; end if;
  if v_norm is null then raise exception 'Keine gültige LinkedIn-Profil-URL (https://www.linkedin.com/in/…)'; end if;
  if p_ergebnis not in ('gesendet', 'dublette', 'nicht_qualifiziert', 'unklar', 'fehler') then
    raise exception 'Unbekanntes Ergebnis %', p_ergebnis;
  end if;
  if p_kategorie is not null and p_kategorie not in ('A', 'B', 'C', 'bedingt') then raise exception 'Kategorie A, B, C oder bedingt'; end if;
  -- Kontrollpunkt: nach je 10 geprüften Profilen erst die Kriterien bestätigen
  if r.geprueft >= (r.kontrollen + 1) * 10 then
    raise exception 'Kontrollpunkt: Nach % geprüften Profilen erst die ICP-Kriterien prüfen und bestätigen', r.geprueft;
  end if;
  if exists (select 1 from crm.recherche_profile x where x.lauf_id = p_lauf and x.linkedin_url_norm = v_norm) then
    raise exception 'Dieses Profil ist in diesem Lauf schon eingetragen';
  end if;
  if p_ergebnis in ('nicht_qualifiziert', 'unklar') and coalesce(btrim(p_grund), leer) = leer then
    raise exception 'Bitte einen Grund angeben';
  end if;

  if p_ergebnis = 'gesendet' then
    if r.gesendet >= r.ziel then raise exception 'Ziel von % Anfragen erreicht – Lauf beenden', r.ziel; end if;
    if coalesce(btrim(p_vorname), leer) = leer or coalesce(btrim(p_nachname), leer) = leer
       or coalesce(btrim(p_firma), leer) = leer or coalesce(btrim(p_position), leer) = leer
       or p_kategorie is null or coalesce(btrim(p_grund), leer) = leer then
      raise exception 'Für eine gesendete Anfrage fehlen Angaben: Vorname, Nachname, Firma, Position, Kategorie und Qualifizierungsgrund';
    end if;
    chk := crm.recherche_pruefen(p_lauf, p_url, p_vorname, p_nachname, p_firma);
    if not coalesce((chk ->> 'frei')::boolean, false) then raise exception 'Nicht anfragen: %', chk ->> 'grund'; end if;

    v_quali := jsonb_build_object('recherche', jsonb_strip_nulls(jsonb_build_object(
      'kategorie', p_kategorie,
      'grund', btrim(p_grund),
      'position', btrim(p_position),
      'firma_website', nullif(btrim(coalesce(p_firma_website, leer)), leer),
      'ausgangspunkt', nullif(btrim(coalesce(p_ausgangspunkt, leer)), leer),
      'lauf_id', p_lauf,
      'am', to_char(now() at time zone 'Europe/Berlin', 'YYYY-MM-DD')
    )));
    v_lead := (chk ->> 'lead_id')::uuid;
    if v_lead is null then
      insert into crm.leads (first_name, last_name, linkedin_url, company_name, role_title, role, owner_id, source,
                             source_batch_id, url_verified, qualification, created_by)
      values (btrim(p_vorname), btrim(p_nachname), btrim(p_url), btrim(p_firma), btrim(p_position),
              crm.recherche_rolle(p_position), v_me, 'recherche', r.batch_id, true, v_quali, v_me)
      returning id into v_lead;
      update crm.import_batches set row_count = row_count + 1, inserted = inserted + 1 where id = r.batch_id;
    else
      update crm.leads
         set role_title = coalesce(role_title, btrim(p_position)),
             company_name = coalesce(company_name, btrim(p_firma)),
             role = case when role in ('unbekannt', 'sonstiges') then crm.recherche_rolle(p_position) else role end,
             owner_id = coalesce(owner_id, v_me),
             qualification = coalesce(qualification, '{}'::jsonb) || v_quali
       where id = v_lead;
      update crm.import_batches set row_count = row_count + 1, updated = updated + 1 where id = r.batch_id;
    end if;
    -- Verbindung „ausstehend“ + Aktivität + Phase + KPI-Zähler „Vernetzungen versendet“ (Trigger connections_after_write)
    perform crm.log_request(v_lead, v_me, null, 'ohne');
  end if;

  insert into crm.recherche_profile (lauf_id, member_id, linkedin_url, vorname, nachname, firma, position, kategorie,
                                     ergebnis, grund, ausgangspunkt, firma_website, lead_id)
  values (p_lauf, v_me, btrim(p_url), nullif(btrim(coalesce(p_vorname, leer)), leer), nullif(btrim(coalesce(p_nachname, leer)), leer),
          nullif(btrim(coalesce(p_firma, leer)), leer), nullif(btrim(coalesce(p_position, leer)), leer), p_kategorie, p_ergebnis,
          nullif(btrim(coalesce(p_grund, leer)), leer), nullif(btrim(coalesce(p_ausgangspunkt, leer)), leer),
          nullif(btrim(coalesce(p_firma_website, leer)), leer), v_lead);

  update crm.recherche_laeufe
     set geprueft = geprueft + 1,
         qualifiziert = qualifiziert + (p_ergebnis in ('gesendet', 'fehler'))::int,
         gesendet = gesendet + (p_ergebnis = 'gesendet')::int,
         dubletten = dubletten + (p_ergebnis = 'dublette')::int,
         abgelehnt = abgelehnt + (p_ergebnis = 'nicht_qualifiziert')::int,
         unklar = unklar + (p_ergebnis = 'unklar')::int,
         fehler = fehler + (p_ergebnis = 'fehler')::int,
         aktuelles_profil = nullif(btrim(coalesce(p_vorname, leer) || ' ' || coalesce(p_nachname, leer)), leer)
                            || coalesce(' · ' || nullif(btrim(coalesce(p_firma, leer)), leer), leer),
         status = case when p_ergebnis = 'gesendet' and gesendet + 1 >= ziel then 'abgeschlossen' else status end,
         finished_at = case when p_ergebnis = 'gesendet' and gesendet + 1 >= ziel then now() else finished_at end,
         meldung = case when p_ergebnis = 'gesendet' and gesendet + 1 >= ziel
                        then 'Ziel erreicht: ' || ziel || ' Vernetzungsanfragen gesendet.' else meldung end
   where id = p_lauf
  returning * into r;
  return r;
end;
$$;
comment on function crm.recherche_eintragen(uuid, text, text, text, text, text, text, text, text, text, text) is
  'Recherchelauf: Ergebnis eines Profils buchen. „gesendet“ = Lead anlegen/nutzen + log_request (KPI); erzwingt Ziel, Dublettenfreiheit, Pflichtangaben und Kontrollpunkt.';

-- -----------------------------------------------------------------------------------------------------
-- 7. Kontrollpunkt und Status
-- -----------------------------------------------------------------------------------------------------
create or replace function crm.recherche_kontrolle(p_lauf uuid) returns crm.recherche_laeufe
language plpgsql set search_path = '' as $$
declare r crm.recherche_laeufe;
begin
  update crm.recherche_laeufe set kontrollen = geprueft / 10
   where id = p_lauf and member_id = coalesce(auth.uid(), member_id)
  returning * into r;
  if not found then raise exception 'Recherchelauf nicht gefunden'; end if;
  return r;
end;
$$;
comment on function crm.recherche_kontrolle(uuid) is 'Recherchelauf: Kontrollpunkt (alle 10 Profile) bestätigt.';

create or replace function crm.recherche_status(p_lauf uuid, p_status text, p_meldung text default null) returns crm.recherche_laeufe
language plpgsql set search_path = '' as $$
declare r crm.recherche_laeufe;
begin
  select * into r from crm.recherche_laeufe where id = p_lauf for update;
  if not found then raise exception 'Recherchelauf nicht gefunden'; end if;
  if r.member_id <> coalesce(auth.uid(), r.member_id) then raise exception 'Dieser Lauf gehört einer anderen Person'; end if;
  if p_status not in ('laeuft', 'pausiert', 'abgeschlossen', 'abgebrochen', 'fehler') then raise exception 'Unbekannter Status %', p_status; end if;
  if r.status in ('abgeschlossen', 'abgebrochen') then raise exception 'Der Lauf ist schon beendet – bitte einen neuen starten'; end if;
  update crm.recherche_laeufe
     set status = p_status,
         meldung = coalesce(nullif(btrim(coalesce(p_meldung, '')), ''), case when p_status = 'laeuft' then null else meldung end),
         finished_at = case when p_status in ('abgeschlossen', 'abgebrochen') then now() else null end
   where id = p_lauf
  returning * into r;
  return r;
exception when unique_violation then
  raise exception 'Es läuft schon ein anderer Recherchelauf – erst diesen beenden';
end;
$$;
comment on function crm.recherche_status(uuid, text, text) is 'Recherchelauf: pausieren, fortsetzen, beenden, abbrechen oder Fehler (z. B. LinkedIn-Einschränkung) melden.';

revoke all on function crm.recherche_starten(integer), crm.recherche_pruefen(uuid, text, text, text, text),
  crm.recherche_eintragen(uuid, text, text, text, text, text, text, text, text, text, text),
  crm.recherche_kontrolle(uuid), crm.recherche_status(uuid, text, text), crm.recherche_rolle(text) from public, anon;
grant execute on function crm.recherche_starten(integer), crm.recherche_pruefen(uuid, text, text, text, text),
  crm.recherche_eintragen(uuid, text, text, text, text, text, text, text, text, text, text),
  crm.recherche_kontrolle(uuid), crm.recherche_status(uuid, text, text), crm.recherche_rolle(text) to authenticated, service_role;
