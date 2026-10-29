-- LinkedIn-Recherche: Play startet den Agenten selbst (29.10.2026, Rückmeldung Vincent „wenn ich auf Play drücke passiert nix“).
-- Der Play-Button legt den Lauf an UND fordert den Agenten an (agent_status = 'wartet'). Der Recherche-Dienst auf dem Mac der
-- startenden Person (tools/recherche-dienst) übernimmt den Lauf, startet Claude Code mit Chrome und schreibt Lebenszeichen hierher.
-- Kein eigenes Objekt: der Agent-Zustand hängt am Lauf. Lebenszeichen zählen nicht als Bearbeitung (updated_at bleibt stehen).

alter table crm.recherche_laeufe
  add column if not exists agent_status      text not null default 'manuell',
  add column if not exists agent_angefordert timestamptz,
  add column if not exists agent_heartbeat   timestamptz,
  add column if not exists agent_rechner     text,
  add column if not exists agent_meldung     text,
  add column if not exists agent_starts      integer not null default 0;

-- Bestehende Läufe stammen aus der Zeit vor dem Dienst: 'manuell' (Agent erst auf Knopfdruck). Neue Läufe fordern ihn an.
alter table crm.recherche_laeufe alter column agent_status set default 'wartet';
alter table crm.recherche_laeufe alter column agent_angefordert set default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'recherche_laeufe_agent_status_check') then
    alter table crm.recherche_laeufe add constraint recherche_laeufe_agent_status_check
      check (agent_status in ('manuell', 'wartet', 'arbeitet', 'beendet', 'fehler'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'recherche_laeufe_agent_text_check') then
    alter table crm.recherche_laeufe add constraint recherche_laeufe_agent_text_check
      check ((agent_meldung is null or char_length(agent_meldung) <= 2000) and (agent_rechner is null or char_length(agent_rechner) <= 100));
  end if;
end
$$;

comment on column crm.recherche_laeufe.agent_status is
  'Agent des Laufs: manuell (kein Dienst angefordert) · wartet (angefordert, Dienst übernimmt) · arbeitet · beendet · fehler.';
comment on column crm.recherche_laeufe.agent_heartbeat is 'Letzte Ausgabe des Agenten, gemeldet vom Recherche-Dienst (alle 30 s).';
comment on column crm.recherche_laeufe.agent_meldung is 'Schlussbericht oder Fehlergrund des letzten Agenten (vom Recherche-Dienst).';

-- updated_at („Zuletzt bearbeitet“) nur bei echten Änderungen am Lauf, nicht bei Lebenszeichen des Agenten.
create or replace function private.recherche_laeufe_updated_at() returns trigger
language plpgsql set search_path = '' as $$
declare
  agent constant text[] := array['agent_status', 'agent_angefordert', 'agent_heartbeat', 'agent_rechner', 'agent_meldung',
    'agent_starts', 'updated_at'];
begin
  if (to_jsonb(new) - agent) is distinct from (to_jsonb(old) - agent) then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;
  return new;
end;
$$;

drop trigger if exists recherche_laeufe_set_updated_at on crm.recherche_laeufe;
create trigger recherche_laeufe_set_updated_at before update on crm.recherche_laeufe
  for each row execute function private.recherche_laeufe_updated_at();

-- Fortsetzen (pausiert/fehler → laeuft) fordert den Agenten neu an; sonst unverändert gegenüber Migration 17.
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
         finished_at = case when p_status in ('abgeschlossen', 'abgebrochen') then now() else null end,
         agent_status = case when p_status = 'laeuft' and r.status <> 'laeuft' then 'wartet' else agent_status end,
         agent_angefordert = case when p_status = 'laeuft' and r.status <> 'laeuft' then now() else agent_angefordert end,
         agent_meldung = case when p_status = 'laeuft' and r.status <> 'laeuft' then null else agent_meldung end
   where id = p_lauf
  returning * into r;
  return r;
exception when unique_violation then
  raise exception 'Es läuft schon ein anderer Recherchelauf – erst diesen beenden';
end;
$$;

-- „Agent starten“ / „Agent neu starten“ auf der Laufseite.
create or replace function crm.recherche_agent_starten(p_lauf uuid) returns crm.recherche_laeufe
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
     set agent_status = 'wartet', agent_angefordert = now(), agent_meldung = null
   where id = p_lauf
  returning * into r;
  return r;
end;
$$;
comment on function crm.recherche_agent_starten(uuid) is
  'Recherchelauf: Agent (neu) anfordern – der Recherche-Dienst auf dem Mac der Person übernimmt ihn innerhalb von Sekunden.';

revoke all on function crm.recherche_agent_starten(uuid) from public, anon;
grant execute on function crm.recherche_agent_starten(uuid) to authenticated, service_role;
