-- LinkedIn-Recherche mit ChatGPT (29.10.2026, Vincent: „Nutze ChatGPT, nicht Claude – Mike hat kein Claude“).
-- Der Recherche-Dienst auf dem Mac der Person startet Codex (ChatGPT-App) mit Chrome. OpenAI lässt Handlungen im Namen der Person
-- (Vernetzen) nur nach Bestätigung zu: der Agent fragt gesammelt („Freigabe nötig“), die Frage steht im CRM, die Antwort geht in
-- dieselbe Codex-Sitzung zurück. Der Dienst meldet sich mit einem persönlichen Dienst-Schlüssel je Mac (kein Passwort, kein
-- Entwicklerzugang) – so richtet jede Person ihn selbst ein. Das CRM bedient der Agent über recherche_dienst (Werkzeuge), nicht
-- über Webformulare.

-- -----------------------------------------------------------------------------------------------------
-- 1. Lauf: Auftrag (Prompt aus regeln.ts, beim Start vom CRM mitgegeben), Sitzung, Frage, Antwort
-- -----------------------------------------------------------------------------------------------------
alter table crm.recherche_laeufe
  add column if not exists agent_auftrag text,
  add column if not exists agent_sitzung text,
  add column if not exists agent_frage   text,
  add column if not exists agent_antwort text;

alter table crm.recherche_laeufe drop constraint if exists recherche_laeufe_agent_status_check;
alter table crm.recherche_laeufe add constraint recherche_laeufe_agent_status_check
  check (agent_status in ('manuell', 'wartet', 'arbeitet', 'frage', 'antwort', 'beendet', 'fehler'));
alter table crm.recherche_laeufe drop constraint if exists recherche_laeufe_agent_text_check;
alter table crm.recherche_laeufe add constraint recherche_laeufe_agent_text_check
  check ((agent_meldung is null or char_length(agent_meldung) <= 2000)
     and (agent_rechner is null or char_length(agent_rechner) <= 100)
     and (agent_auftrag is null or char_length(agent_auftrag) <= 30000)
     and (agent_sitzung is null or char_length(agent_sitzung) <= 100)
     and (agent_frage is null or char_length(agent_frage) <= 4000)
     and (agent_antwort is null or char_length(agent_antwort) <= 2000));

comment on column crm.recherche_laeufe.agent_status is
  'Agent: manuell · wartet (angefordert) · arbeitet · frage (wartet auf Freigabe im CRM) · antwort (Freigabe gegeben, Dienst setzt fort) · beendet · fehler.';
comment on column crm.recherche_laeufe.agent_auftrag is 'Vollständiger Auftrag an den Agenten (regeln.ts → agentAuftrag), beim Start vom CRM mitgegeben.';
comment on column crm.recherche_laeufe.agent_sitzung is 'Codex-Sitzung (thread id) – nach einer Antwort wird sie fortgesetzt.';

create or replace function private.recherche_laeufe_updated_at() returns trigger
language plpgsql set search_path = '' as $$
declare
  agent constant text[] := array['agent_status', 'agent_angefordert', 'agent_heartbeat', 'agent_rechner', 'agent_meldung',
    'agent_starts', 'agent_auftrag', 'agent_sitzung', 'agent_frage', 'agent_antwort', 'updated_at'];
begin
  if (to_jsonb(new) - agent) is distinct from (to_jsonb(old) - agent) then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------------------------------
-- 2. Dienst-Schlüssel je Mac (nur der Hash wird gespeichert)
-- -----------------------------------------------------------------------------------------------------
create table if not exists crm.recherche_dienste (
  id              uuid primary key default gen_random_uuid(),
  member_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  schluessel_hash text not null unique,
  rechner         text check (rechner is null or char_length(rechner) <= 100),
  version         text check (version is null or char_length(version) <= 40),
  zuletzt_gesehen timestamptz,
  created_at      timestamptz not null default now()
);
comment on table crm.recherche_dienste is 'Recherche-Dienst je Mac: Hash des Dienst-Schlüssels, Rechnername, letzte Meldung (alle 10 s).';

alter table crm.recherche_dienste enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'crm' and tablename = 'recherche_dienste' and policyname = 'Mitglieder lesen recherche_dienste') then
    create policy "Mitglieder lesen recherche_dienste" on crm.recherche_dienste for select to authenticated using ((select private.is_member()));
  end if;
end
$$;
revoke all on crm.recherche_dienste from public, anon, authenticated;
grant select on crm.recherche_dienste to authenticated;
grant all on crm.recherche_dienste to service_role;

-- Neuen Schlüssel für diesen Mac – der Klartext kommt genau einmal zurück (Einrichtungsbefehl im CRM).
create or replace function crm.recherche_dienst_einrichten() returns text
language plpgsql security definer set search_path = '' as $$
declare k text := 'rd_' || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if auth.uid() is null or not private.is_member() then raise exception 'Nur für angemeldete Mitglieder'; end if;
  -- nie eingesetzte Schlüssel älter als ein Tag aufräumen
  delete from crm.recherche_dienste where member_id = auth.uid() and zuletzt_gesehen is null and created_at < now() - interval '1 day';
  insert into crm.recherche_dienste (member_id, schluessel_hash) values (auth.uid(), encode(sha256(convert_to(k, 'UTF8')), 'hex'));
  return k;
end;
$$;
comment on function crm.recherche_dienst_einrichten() is 'Recherche-Dienst: neuen Dienst-Schlüssel für einen Mac erzeugen (Klartext nur in dieser Antwort).';

-- -----------------------------------------------------------------------------------------------------
-- 3. Start, Neustart, Fortsetzen nehmen den Auftrag mit; Antwort auf eine Frage
-- -----------------------------------------------------------------------------------------------------
drop function if exists crm.recherche_starten(integer);
create or replace function crm.recherche_starten(p_ziel integer default 30, p_auftrag text default null) returns crm.recherche_laeufe
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
    insert into crm.recherche_laeufe (member_id, ziel, batch_id, agent_auftrag)
    values (v_me, least(greatest(coalesce(p_ziel, 30), 1), 30), b, nullif(btrim(coalesce(p_auftrag, '')), ''))
    returning * into l;
  exception when unique_violation then
    select * into l from crm.recherche_laeufe where member_id = v_me and status in ('laeuft', 'pausiert') limit 1;
  end;
  return l;
end;
$$;
comment on function crm.recherche_starten(integer, text) is 'Recherchelauf starten (mit Agent-Auftrag) – oder den schon aktiven zurückgeben; nie zwei parallel.';

drop function if exists crm.recherche_agent_starten(uuid);
create or replace function crm.recherche_agent_starten(p_lauf uuid, p_auftrag text default null) returns crm.recherche_laeufe
language plpgsql set search_path = '' as $$
declare r crm.recherche_laeufe;
begin
  if auth.uid() is null or not private.is_member() then raise exception 'Nur für angemeldete Mitglieder'; end if;
  select * into r from crm.recherche_laeufe where id = p_lauf for update;
  if not found then raise exception 'Recherchelauf nicht gefunden'; end if;
  if r.member_id <> auth.uid() then raise exception 'Dieser Lauf gehört einer anderen Person'; end if;
  if r.status <> 'laeuft' then raise exception 'Der Agent startet nur bei laufender Recherche – erst „Fortsetzen“'; end if;
  if r.agent_status = 'arbeitet' and r.agent_heartbeat > now() - interval '90 seconds' then
    raise exception 'Der Agent arbeitet bereits';
  end if;
  update crm.recherche_laeufe
     set agent_status = 'wartet', agent_angefordert = now(), agent_meldung = null, agent_frage = null, agent_antwort = null,
         agent_sitzung = null, agent_auftrag = coalesce(nullif(btrim(coalesce(p_auftrag, '')), ''), agent_auftrag)
   where id = p_lauf
  returning * into r;
  return r;
end;
$$;
comment on function crm.recherche_agent_starten(uuid, text) is 'Recherchelauf: Agent neu anfordern (frische Sitzung) – der Recherche-Dienst übernimmt binnen Sekunden.';

create or replace function crm.recherche_status(p_lauf uuid, p_status text, p_meldung text default null) returns crm.recherche_laeufe
language plpgsql set search_path = '' as $$
declare
  r crm.recherche_laeufe;
  neu boolean;
begin
  select * into r from crm.recherche_laeufe where id = p_lauf for update;
  if not found then raise exception 'Recherchelauf nicht gefunden'; end if;
  if r.member_id <> coalesce(auth.uid(), r.member_id) then raise exception 'Dieser Lauf gehört einer anderen Person'; end if;
  if p_status not in ('laeuft', 'pausiert', 'abgeschlossen', 'abgebrochen', 'fehler') then raise exception 'Unbekannter Status %', p_status; end if;
  if r.status in ('abgeschlossen', 'abgebrochen') then raise exception 'Der Lauf ist schon beendet – bitte einen neuen starten'; end if;
  neu := p_status = 'laeuft' and r.status <> 'laeuft';
  update crm.recherche_laeufe
     set status = p_status,
         meldung = coalesce(nullif(btrim(coalesce(p_meldung, '')), ''), case when p_status = 'laeuft' then null else meldung end),
         finished_at = case when p_status in ('abgeschlossen', 'abgebrochen') then now() else null end,
         -- Fortsetzen startet eine frische Agentensitzung; offene Fragen verfallen
         agent_status = case when neu then 'wartet' when p_status <> 'laeuft' and agent_status in ('frage', 'antwort', 'wartet') then 'beendet' else agent_status end,
         agent_angefordert = case when neu then now() else agent_angefordert end,
         agent_meldung = case when neu then null else agent_meldung end,
         agent_frage = case when neu or p_status <> 'laeuft' then null else agent_frage end,
         agent_antwort = case when neu then null else agent_antwort end,
         agent_sitzung = case when neu then null else agent_sitzung end
   where id = p_lauf
  returning * into r;
  return r;
exception when unique_violation then
  raise exception 'Es läuft schon ein anderer Recherchelauf – erst diesen beenden';
end;
$$;

create or replace function crm.recherche_agent_antworten(p_lauf uuid, p_freigabe boolean, p_text text default null) returns crm.recherche_laeufe
language plpgsql set search_path = '' as $$
declare
  r crm.recherche_laeufe;
  v text;
begin
  if auth.uid() is null or not private.is_member() then raise exception 'Nur für angemeldete Mitglieder'; end if;
  select * into r from crm.recherche_laeufe where id = p_lauf for update;
  if not found then raise exception 'Recherchelauf nicht gefunden'; end if;
  if r.member_id <> auth.uid() then raise exception 'Dieser Lauf gehört einer anderen Person'; end if;
  if r.status <> 'laeuft' or r.agent_status <> 'frage' then raise exception 'Der Agent wartet gerade auf keine Antwort'; end if;
  -- Freigabe ja/nein (mit optionaler Anmerkung) oder – bei einer anderen Frage – nur der Antworttext
  v := btrim(case when p_freigabe then 'Freigegeben.' when not p_freigabe then 'Nicht freigegeben.' else '' end
             || coalesce(' ' || nullif(btrim(coalesce(p_text, '')), ''), ''));
  if v = '' then raise exception 'Bitte eine Antwort eingeben'; end if;
  update crm.recherche_laeufe
     set agent_status = 'antwort', agent_angefordert = now(), agent_antwort = left(v, 2000)
   where id = p_lauf
  returning * into r;
  return r;
end;
$$;
comment on function crm.recherche_agent_antworten(uuid, boolean, text) is
  'Recherchelauf: Antwort auf die Frage des Agenten (Freigabe ja/nein oder Text) – der Dienst setzt dieselbe Sitzung fort.';

-- -----------------------------------------------------------------------------------------------------
-- 4. Schnittstelle für Dienst und Agent-Werkzeuge (anon + Dienst-Schlüssel; handelt als die Person des Schlüssels)
-- -----------------------------------------------------------------------------------------------------
create or replace function crm.recherche_dienst(p_schluessel text, p_aktion text, p_daten jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  d crm.recherche_dienste;
  r crm.recherche_laeufe;
  ids uuid[];
  st text;
  ergebnis jsonb;
  leer constant text := '';
begin
  select * into d from crm.recherche_dienste where schluessel_hash = encode(sha256(convert_to(coalesce(p_schluessel, leer), 'UTF8')), 'hex');
  if not found then raise exception 'Unbekannter Dienst-Schlüssel – bitte im CRM neu einrichten'; end if;
  -- als die Person des Schlüssels handeln (auth.uid() in den Recherche-Funktionen, created_by, Aktivitäten)
  perform set_config('request.jwt.claims', json_build_object('sub', d.member_id, 'role', 'authenticated')::text, true);
  update crm.recherche_dienste
     set zuletzt_gesehen = now(),
         rechner = coalesce(left(nullif(p_daten ->> 'rechner', leer), 100), rechner),
         version = coalesce(left(nullif(p_daten ->> 'version', leer), 40), version)
   where id = d.id;

  if p_daten ? 'lauf' then
    select * into r from crm.recherche_laeufe where id = (p_daten ->> 'lauf')::uuid;
    if not found or r.member_id <> d.member_id then raise exception 'Recherchelauf nicht gefunden'; end if;
  end if;

  case p_aktion
  -- ---- Dienst ----
  when 'abholen' then
    ids := coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(p_daten -> 'ids', '[]'::jsonb)) x), '{}');
    return jsonb_build_object('laeufe', coalesce((
      select jsonb_agg(jsonb_build_object('id', l.id, 'status', l.status, 'agent_status', l.agent_status) order by l.started_at)
        from crm.recherche_laeufe l
       where l.member_id = d.member_id
         and ((l.status = 'laeuft' and l.agent_status in ('wartet', 'antwort')) or l.id = any(ids))), '[]'::jsonb));

  when 'uebernehmen' then
    st := r.agent_status;
    update crm.recherche_laeufe
       set agent_status = 'arbeitet', agent_rechner = coalesce(left(nullif(p_daten ->> 'rechner', leer), 100), agent_rechner),
           agent_heartbeat = now(), agent_starts = agent_starts + (st = 'wartet')::int, agent_meldung = null, agent_frage = null
     where id = r.id and status = 'laeuft' and agent_status in ('wartet', 'antwort')
    returning * into r;
    if not found then return jsonb_build_object('ok', false); end if;
    return jsonb_build_object('ok', true, 'art', case when st = 'antwort' and r.agent_sitzung is not null then 'weiter' else 'neu' end,
      'auftrag', r.agent_auftrag, 'antwort', r.agent_antwort, 'sitzung', r.agent_sitzung, 'starts', r.agent_starts);

  when 'sitzung' then
    update crm.recherche_laeufe set agent_sitzung = left(p_daten ->> 'sitzung', 100) where id = r.id and agent_status = 'arbeitet';
    return jsonb_build_object('ok', true);

  when 'lebenszeichen' then
    ids := coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(p_daten -> 'ids', '[]'::jsonb)) x), '{}');
    update crm.recherche_laeufe set agent_heartbeat = now()
     where member_id = d.member_id and id = any(ids) and agent_status = 'arbeitet';
    return jsonb_build_object('ok', true);

  when 'melden' then
    st := p_daten ->> 'agent_status';
    if st not in ('beendet', 'fehler', 'frage') then raise exception 'Unbekannter Agent-Status %', st; end if;
    update crm.recherche_laeufe
       set agent_status = case when st = 'frage' and status <> 'laeuft' then 'beendet' else st end,
           agent_meldung = case when st = 'frage' then agent_meldung else left(coalesce(p_daten ->> 'meldung', leer), 2000) end,
           agent_frage = case when st = 'frage' and status = 'laeuft' then left(p_daten ->> 'frage', 4000) end,
           agent_sitzung = coalesce(left(nullif(p_daten ->> 'sitzung', leer), 100), agent_sitzung),
           agent_heartbeat = now()
     where id = r.id and agent_status = 'arbeitet';
    return jsonb_build_object('ok', found);

  when 'aufraeumen' then
    update crm.recherche_laeufe set agent_status = 'beendet', agent_meldung = left(coalesce(p_daten ->> 'grund', leer), 2000)
     where member_id = d.member_id and agent_status = 'arbeitet' and agent_rechner = left(p_daten ->> 'rechner', 100);
    return jsonb_build_object('ok', true);

  -- ---- Werkzeuge des Agenten ----
  when 'lauf_status' then
    return jsonb_build_object(
      'status', r.status, 'ziel', r.ziel, 'gesendet', r.gesendet, 'noch', greatest(0, r.ziel - r.gesendet),
      'geprueft', r.geprueft, 'dubletten', r.dubletten, 'nicht_qualifiziert', r.abgelehnt, 'unklar', r.unklar,
      'senden_fehlgeschlagen', r.fehler, 'kontrollpunkt_faellig', r.geprueft >= (r.kontrollen + 1) * 10,
      'bearbeitete_profile', coalesce((
        select jsonb_agg(jsonb_build_object('url', p.linkedin_url, 'name', btrim(coalesce(p.vorname, leer) || ' ' || coalesce(p.nachname, leer)),
                                            'firma', p.firma, 'ergebnis', p.ergebnis) order by p.created_at desc)
          from (select * from crm.recherche_profile where lauf_id = r.id order by created_at desc limit 60) p), '[]'::jsonb));

  when 'ausgangspunkte' then
    return jsonb_build_object('personen', coalesce((
      select jsonb_agg(jsonb_build_object('name', x.full_name, 'position', x.role_title, 'firma', x.company_name, 'url', x.linkedin_url))
        from (select l.full_name, l.role_title, l.company_name, l.linkedin_url
                from crm.leads l
               where l.deleted_at is null and l.linkedin_url is not null and l.company_name is not null
                 and l.stage::text in ('vernetzt', 'gespraech_eroeffnet', 'dm_follow_up', 'dm_beantwortet', 'bedarfsermittlung', 'pitch',
                                       'erstgespraech_vereinbart', 'erstgespraech', 'strategiegespraech_vereinbart', 'strategiegespraech',
                                       'sales_follow_up', 'kunde', 'langfristig')
               order by (coalesce(l.role_title, leer) ~* '(gesch(ä|ae)ftsf|inhaber|gr(ü|ue)nder|founder|owner|ceo|leit|head|projekt|vertrieb|sales|kunden|service|support|meister|techni|disponent|betrieb)') desc,
                        md5(l.id::text || r.id::text)
               limit 15) x), '[]'::jsonb));

  when 'pruefen' then
    return crm.recherche_pruefen(r.id, p_daten ->> 'url', p_daten ->> 'vorname', p_daten ->> 'nachname', p_daten ->> 'firma');

  when 'eintragen' then
    r := crm.recherche_eintragen(r.id, p_daten ->> 'url', p_daten ->> 'ergebnis', p_daten ->> 'vorname', p_daten ->> 'nachname',
                                 p_daten ->> 'firma', p_daten ->> 'position', p_daten ->> 'kategorie', p_daten ->> 'grund',
                                 p_daten ->> 'ausgangspunkt', p_daten ->> 'firma_website');
    return jsonb_build_object('ok', true, 'status', r.status, 'gesendet', r.gesendet, 'ziel', r.ziel, 'geprueft', r.geprueft,
                              'kontrollpunkt_faellig', r.geprueft >= (r.kontrollen + 1) * 10, 'meldung', r.meldung);

  when 'kontrolle' then
    r := crm.recherche_kontrolle(r.id);
    return jsonb_build_object('ok', true, 'kontrollen', r.kontrollen, 'geprueft', r.geprueft);

  when 'einschraenkung' then
    r := crm.recherche_status(r.id, 'fehler', coalesce(nullif(btrim(p_daten ->> 'wortlaut'), leer), 'LinkedIn-Einschränkung (ohne Wortlaut)'));
    return jsonb_build_object('ok', true, 'status', r.status);

  else
    raise exception 'Unbekannte Aktion %', p_aktion;
  end case;
end;
$$;
comment on function crm.recherche_dienst(text, text, jsonb) is
  'Recherche-Dienst und Agent-Werkzeuge: abholen, uebernehmen, sitzung, lebenszeichen, melden, aufraeumen · lauf_status, ausgangspunkte, pruefen, eintragen, kontrolle, einschraenkung – nur mit gültigem Dienst-Schlüssel, nur eigene Läufe.';

revoke all on function crm.recherche_dienst_einrichten(), crm.recherche_starten(integer, text), crm.recherche_agent_starten(uuid, text),
  crm.recherche_agent_antworten(uuid, boolean, text), crm.recherche_dienst(text, text, jsonb) from public, anon;
grant execute on function crm.recherche_dienst_einrichten(), crm.recherche_starten(integer, text), crm.recherche_agent_starten(uuid, text),
  crm.recherche_agent_antworten(uuid, boolean, text) to authenticated, service_role;
grant execute on function crm.recherche_dienst(text, text, jsonb) to anon, authenticated, service_role;
