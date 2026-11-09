-- LinkedIn-Recherche: Agent selbst wählen – ChatGPT oder Claude (09.11.2026, Vincent: „im Recherche-Tab einen Toggle, dass ich
-- selber entscheiden kann, ob ich Claude oder ChatGPT verwenden will“).
-- Die Wahl gilt je Person für alle ihre Rechner (wie der Schalter claude_ersatz) und greift bei jedem Agent-Start: neuer Lauf,
-- „Agent neu starten“, „Fortsetzen“. Ein Lauf, dessen Agent noch nicht abgeholt ist, wechselt sofort mit; ein arbeitender Agent
-- arbeitet seine Runde zu Ende. Claude gilt nur, solange ein Recherche-Dienst der Person ein angemeldetes Claude Code meldet –
-- sonst startet ChatGPT. Der Ersatz bei ChatGPT-Limit (Migration 20) bleibt unverändert.

alter table crm.recherche_dienste
  add column if not exists anbieter text not null default 'chatgpt' check (anbieter in ('chatgpt', 'claude'));
comment on column crm.recherche_dienste.anbieter is
  'Gewählter Agent der Person (für alle ihre Rechner gleich): chatgpt (Codex) oder claude (Claude Code mit Claude in Chrome).';

-- Wer den nächsten Agenten stellt: Claude nur, wenn gewählt UND auf einem Rechner der Person angemeldet
create or replace function private.recherche_anbieter(p_member uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when exists (select 1 from crm.recherche_dienste where member_id = p_member and anbieter = 'claude')
     and exists (select 1 from crm.recherche_dienste where member_id = p_member and claude is not null)
    then 'claude' else 'chatgpt' end;
$$;
revoke all on function private.recherche_anbieter(uuid) from public, anon;
grant execute on function private.recherche_anbieter(uuid) to authenticated, service_role;

create or replace function crm.recherche_anbieter_waehlen(p_anbieter text) returns text
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_member() then raise exception 'Nur für angemeldete Mitglieder'; end if;
  if p_anbieter is null or p_anbieter not in ('chatgpt', 'claude') then raise exception 'Unbekannter Agent %', p_anbieter; end if;
  if not exists (select 1 from crm.recherche_dienste where member_id = auth.uid()) then
    raise exception 'Erst den Recherche-Dienst einrichten';
  end if;
  if p_anbieter = 'claude' and not exists (select 1 from crm.recherche_dienste where member_id = auth.uid() and claude is not null) then
    raise exception 'Auf keinem deiner Rechner ist Claude angemeldet – erst die Claude-App öffnen und anmelden';
  end if;
  update crm.recherche_dienste set anbieter = p_anbieter where member_id = auth.uid();
  -- noch nicht abgeholter Agent startet gleich mit der neuen Wahl
  update crm.recherche_laeufe set agent_anbieter = p_anbieter
   where member_id = auth.uid() and status = 'laeuft' and agent_status = 'wartet';
  return p_anbieter;
end;
$$;
comment on function crm.recherche_anbieter_waehlen(text) is
  'Schalter „Agent: ChatGPT | Claude“ der Rechercheseite – für alle Recherche-Dienste der Person, ab dem nächsten Agent-Start.';
revoke all on function crm.recherche_anbieter_waehlen(text) from public, anon;
grant execute on function crm.recherche_anbieter_waehlen(text) to authenticated, service_role;

-- Starts nehmen die Wahl der Person statt fest ChatGPT (sonst unverändert gegenüber Migration 19/20)
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
    insert into crm.recherche_laeufe (member_id, ziel, batch_id, agent_auftrag, agent_anbieter)
    values (v_me, least(greatest(coalesce(p_ziel, 30), 1), 30), b, nullif(btrim(coalesce(p_auftrag, '')), ''),
            private.recherche_anbieter(v_me))
    returning * into l;
  exception when unique_violation then
    select * into l from crm.recherche_laeufe where member_id = v_me and status in ('laeuft', 'pausiert') limit 1;
  end;
  return l;
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
         agent_sitzung = null, agent_anbieter = private.recherche_anbieter(r.member_id),
         agent_auftrag = coalesce(nullif(btrim(coalesce(p_auftrag, '')), ''), agent_auftrag)
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
         agent_anbieter = case when neu then private.recherche_anbieter(r.member_id) else agent_anbieter end
   where id = p_lauf
  returning * into r;
  return r;
exception when unique_violation then
  raise exception 'Es läuft schon ein anderer Recherchelauf – erst diesen beenden';
end;
$$;

comment on column crm.recherche_laeufe.agent_anbieter is
  'Wer den Agenten stellt: chatgpt (Codex) · claude – beim Start die Wahl der Person (recherche_dienste.anbieter), bei ChatGPT-Limit wechselt der Dienst auf claude.';
