-- LinkedIn-Recherche: Claude springt ein, wenn ChatGPT sein Nutzungslimit erreicht (30.10.2026, Vincent: „fallback switch auf
-- meinen Claude-Account … dass sich dann der Prozess einfach mit Claude weiterführen lässt, voll automatisch“).
-- Meldet Codex „You’ve hit your usage limit …“, startet der Recherche-Dienst im selben Lauf Claude Code (Claude in Chrome, dieselben
-- CRM-Werkzeuge) mit Übergabe: Auftrag, Stand aus lauf_status und die zuletzt beantwortete Frage samt Freigabe. Der Schalter gilt je
-- Person für alle ihre Macs; wirksam nur, wo der Dienst ein angemeldetes Claude Code meldet (recherche_dienste.claude).

alter table crm.recherche_laeufe add column if not exists agent_anbieter text not null default 'chatgpt';
alter table crm.recherche_laeufe drop constraint if exists recherche_laeufe_agent_anbieter_check;
alter table crm.recherche_laeufe add constraint recherche_laeufe_agent_anbieter_check check (agent_anbieter in ('chatgpt', 'claude'));
comment on column crm.recherche_laeufe.agent_anbieter is
  'Wer den Agenten stellt: chatgpt (Codex) · claude (nach ChatGPT-Nutzungslimit) – „Agent neu starten“ und „Fortsetzen“ beginnen wieder mit chatgpt.';
comment on column crm.recherche_laeufe.agent_sitzung is 'Sitzung des Agenten (Codex-Thread bzw. Claude-Session) – nach einer Antwort wird sie fortgesetzt.';

alter table crm.recherche_dienste
  add column if not exists claude text check (claude is null or char_length(claude) <= 60),
  add column if not exists claude_ersatz boolean not null default true;
comment on column crm.recherche_dienste.claude is 'Claude Code auf diesem Mac angemeldet (Version) – null: nicht vorhanden oder nicht angemeldet.';
comment on column crm.recherche_dienste.claude_ersatz is 'Schalter: bei ChatGPT-Nutzungslimit automatisch mit Claude weitermachen.';

create or replace function private.recherche_laeufe_updated_at() returns trigger
language plpgsql set search_path = '' as $$
declare
  agent constant text[] := array['agent_status', 'agent_angefordert', 'agent_heartbeat', 'agent_rechner', 'agent_meldung',
    'agent_starts', 'agent_auftrag', 'agent_sitzung', 'agent_frage', 'agent_antwort', 'agent_anbieter', 'updated_at'];
begin
  if (to_jsonb(new) - agent) is distinct from (to_jsonb(old) - agent) then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;
  return new;
end;
$$;

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
         agent_sitzung = null, agent_anbieter = 'chatgpt', agent_auftrag = coalesce(nullif(btrim(coalesce(p_auftrag, '')), ''), agent_auftrag)
   where id = p_lauf
  returning * into r;
  return r;
end;
$$;

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
         agent_sitzung = case when neu then null else agent_sitzung end,
         agent_anbieter = case when neu then 'chatgpt' else agent_anbieter end
   where id = p_lauf
  returning * into r;
  return r;
exception when unique_violation then
  raise exception 'Es läuft schon ein anderer Recherchelauf – erst diesen beenden';
end;
$$;

create or replace function crm.recherche_dienst(p_schluessel text, p_aktion text, p_daten jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  d crm.recherche_dienste;
  r crm.recherche_laeufe;
  ids uuid[];
  st text;
  fr text;
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
         version = coalesce(left(nullif(p_daten ->> 'version', leer), 40), version),
         -- Claude Code auf diesem Mac angemeldet? (Version; leer = nein) – meldet der Dienst beim Abholen
         claude = case when p_daten ? 'claude' then left(nullif(p_daten ->> 'claude', leer), 60) else claude end
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
    fr := r.agent_frage; -- die gerade beantwortete Frage – braucht die Übergabe an Claude
    update crm.recherche_laeufe
       set agent_status = 'arbeitet', agent_rechner = coalesce(left(nullif(p_daten ->> 'rechner', leer), 100), agent_rechner),
           agent_heartbeat = now(), agent_starts = agent_starts + (st = 'wartet')::int, agent_meldung = null, agent_frage = null
     where id = r.id and status = 'laeuft' and agent_status in ('wartet', 'antwort')
    returning * into r;
    if not found then return jsonb_build_object('ok', false); end if;
    return jsonb_build_object('ok', true, 'art', case when st = 'antwort' and r.agent_sitzung is not null then 'weiter' else 'neu' end,
      'auftrag', r.agent_auftrag, 'antwort', r.agent_antwort, 'sitzung', r.agent_sitzung, 'starts', r.agent_starts,
      'frage', fr, 'anbieter', r.agent_anbieter, 'claude_ersatz', d.claude_ersatz);

  when 'sitzung' then
    update crm.recherche_laeufe set agent_sitzung = left(p_daten ->> 'sitzung', 100) where id = r.id and agent_status = 'arbeitet';
    return jsonb_build_object('ok', true);

  -- ChatGPT hat sein Nutzungslimit erreicht: Claude übernimmt den Lauf (neue Sitzung, Agent arbeitet weiter)
  when 'wechsel' then
    if not d.claude_ersatz then raise exception 'Claude als Ersatz ist ausgeschaltet'; end if;
    update crm.recherche_laeufe
       set agent_anbieter = 'claude', agent_sitzung = null, agent_heartbeat = now(),
           agent_meldung = left(nullif(p_daten ->> 'meldung', leer), 2000)
     where id = r.id and status = 'laeuft' and agent_status = 'arbeitet' and agent_anbieter = 'chatgpt';
    return jsonb_build_object('ok', found);

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

create or replace function crm.recherche_claude_ersatz(p_an boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_member() then raise exception 'Nur für angemeldete Mitglieder'; end if;
  update crm.recherche_dienste set claude_ersatz = coalesce(p_an, true) where member_id = auth.uid();
end;
$$;
comment on function crm.recherche_claude_ersatz(boolean) is 'Schalter „Bei ChatGPT-Limit mit Claude weitermachen“ – für alle Recherche-Dienste der Person.';
revoke all on function crm.recherche_claude_ersatz(boolean) from public, anon;
grant execute on function crm.recherche_claude_ersatz(boolean) to authenticated, service_role;

comment on function crm.recherche_dienst(text, text, jsonb) is
  'Recherche-Dienst und Agent-Werkzeuge: abholen, uebernehmen, sitzung, wechsel (Claude nach ChatGPT-Limit), lebenszeichen, melden, aufraeumen · lauf_status, ausgangspunkte, pruefen, eintragen, kontrolle, einschraenkung – nur mit gültigem Dienst-Schlüssel, nur eigene Läufe.';
