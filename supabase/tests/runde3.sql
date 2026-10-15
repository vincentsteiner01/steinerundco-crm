-- supabase/tests/runde3.sql – Migration 8 („Letzte Bewegung“ nur aus Kontakten), ohne pgTAP.
--   ist_kontakt · System-Einträge (angelegt, import, stage_wechsel, notiz, sequenz_gestartet) lassen last_activity_at leer ·
--   Kontakt setzt last_activity_at/_type · älterer Kontakt überschreibt nicht · Löschen rechnet zurück (inkl. last_inbound_*) ·
--   Rückgängig (log_reply → undo_activity) als Vincent unter RLS · Neuberechnung aller Leads stimmt · v_leads_ohne_bewegung zählt
--   Leads ohne Kontakt ab Anlage · Lead endgültig löschen (Kaskade) läuft durch · Sheet-Import: je Lead angelegt + import.
-- Aufruf: bash tools/db-query.sh -f supabase/tests/runde3.sql   (eine Transaktion, endet mit rollback; DB bleibt unverändert)
-- Muster: siehe supabase/tests/_kopf.sql.txt. Alle Test-Leads heißen „E2E – …“.
begin;
create temp table pruef (nr int generated always as identity, fall text, ergebnis text) on commit drop;
create temp table ctx (k text primary key, v text) on commit drop;
grant all on pruef, ctx to authenticated;
create function pg_temp.ok(p_fall text) returns void language sql as $$ insert into pruef (fall, ergebnis) values (p_fall, 'pass') $$;
create function pg_temp.v(p_k text) returns text language sql stable as $$ select v from ctx where k = p_k $$;
grant execute on function pg_temp.ok(text), pg_temp.v(text) to authenticated;
select set_config('request.jwt.claim.sub', (select user_id::text from public.members where email = 'vincent@steinerundco.de'), true);

-- 1) ist_kontakt: Kontakte ja, System-Einträge nein
do $$
declare t crm.activity_type; v_kontakt text[] := '{}'; v_system text[] := '{}';
begin
  for t in select unnest(enum_range(null::crm.activity_type)) loop
    if crm.ist_kontakt(t) then v_kontakt := v_kontakt || t::text; else v_system := v_system || t::text; end if;
  end loop;
  if not ('nachricht_erhalten' = any (v_kontakt) and 'anruf' = any (v_kontakt) and 'email_gesendet' = any (v_kontakt)
          and 'meeting_stattgefunden' = any (v_kontakt) and 'vernetzung_angenommen' = any (v_kontakt) and 'pitch_gesendet' = any (v_kontakt)) then
    raise exception 'FAIL r3-1: Kontakt fehlt (%)', v_kontakt;
  end if;
  if not ('angelegt' = any (v_system) and 'import' = any (v_system) and 'stage_wechsel' = any (v_system) and 'notiz' = any (v_system)
          and 'sequenz_gestartet' = any (v_system) and 'aufgabe_erledigt' = any (v_system) and 'uebergabe' = any (v_system)) then
    raise exception 'FAIL r3-1: System-Eintrag zählt als Kontakt (%)', v_system;
  end if;
  if cardinality(v_kontakt) <> 16 then raise exception 'FAIL r3-1: % Kontakt-Typen statt 16 (%)', cardinality(v_kontakt), v_kontakt; end if;
  perform pg_temp.ok('r3-1 ist_kontakt: 16 Kontakt-Typen, System-Einträge nicht');
end $$;

-- 2) System-Einträge: angelegt (Anlage), import (jetzt), stage_wechsel, notiz, sequenz_gestartet → last_activity_at bleibt leer
set local role authenticated;
do $$
declare v_lead uuid; l crm.leads;
begin
  insert into crm.leads (first_name, last_name, linkedin_url, owner_id, created_at)
  values ('E2E – Rita', 'Bewegungstest', 'https://www.linkedin.com/in/e2e-runde3-rita/', auth.uid(), now() - interval '20 days')
  returning id into v_lead;
  insert into ctx values ('rita', v_lead::text);
  if not exists (select 1 from crm.activities where lead_id = v_lead and type = 'angelegt') then raise exception 'FAIL r3-2: kein angelegt'; end if;
  perform crm.log_activity(v_lead, auth.uid(), 'sonstiges', 'import', now(), p_source => 'import_sheet');
  perform crm.log_activity(v_lead, auth.uid(), 'sonstiges', 'notiz', now(), p_note => 'E2E – Notiz');
  perform crm.log_activity(v_lead, auth.uid(), 'linkedin', 'sequenz_gestartet', now());
  update crm.leads set stage = 'vernetzt' where id = v_lead;
  if not exists (select 1 from crm.activities where lead_id = v_lead and type = 'stage_wechsel') then raise exception 'FAIL r3-2: kein stage_wechsel'; end if;
  select * into l from crm.leads where id = v_lead;
  if l.last_activity_at is not null or l.last_activity_type is not null then
    raise exception 'FAIL r3-2: System-Eintrag setzt last_activity (% %)', l.last_activity_at, l.last_activity_type;
  end if;
  perform pg_temp.ok('r3-2 angelegt, import, notiz, sequenz_gestartet, stage_wechsel lassen last_activity_at leer');
end $$;

-- 3) Kontakt setzt last_activity_at/_type (historisch datiert), jüngerer Kontakt gewinnt, älterer überschreibt nicht, System danach ändert nichts
do $$
declare v_lead uuid := pg_temp.v('rita')::uuid; l crm.leads; v_alt bigint; v_neu bigint;
begin
  v_alt := crm.log_activity(v_lead, auth.uid(), 'linkedin', 'vernetzung_angenommen', timestamptz '2026-10-01 09:00+02');
  select * into l from crm.leads where id = v_lead;
  if l.last_activity_at <> timestamptz '2026-10-01 09:00+02' or l.last_activity_type <> 'vernetzung_angenommen' then
    raise exception 'FAIL r3-3: nach Annahme % %', l.last_activity_at, l.last_activity_type;
  end if;
  v_neu := crm.log_activity(v_lead, auth.uid(), 'linkedin', 'nachricht_erhalten', timestamptz '2026-10-08 10:00+02', p_note => 'E2E – Antwort');
  perform crm.log_activity(v_lead, auth.uid(), 'linkedin', 'gespraech_eroeffnet', timestamptz '2026-10-05 09:00+02');
  perform crm.log_activity(v_lead, auth.uid(), 'sonstiges', 'notiz', now(), p_note => 'E2E – später');
  select * into l from crm.leads where id = v_lead;
  if l.last_activity_at <> timestamptz '2026-10-08 10:00+02' or l.last_activity_type <> 'nachricht_erhalten' then
    raise exception 'FAIL r3-3: jüngster Kontakt nicht übernommen (% %)', l.last_activity_at, l.last_activity_type;
  end if;
  if l.last_inbound_at <> timestamptz '2026-10-08 10:00+02' or l.last_inbound_channel <> 'linkedin' then
    raise exception 'FAIL r3-3: last_inbound_* falsch (% %)', l.last_inbound_at, l.last_inbound_channel;
  end if;
  insert into ctx values ('rita_antwort', v_neu::text);
  perform pg_temp.ok('r3-3 Kontakt setzt last_activity_at (08.10.), älterer Kontakt und spätere Notiz ändern nichts');
end $$;
reset role;

-- 4) Löschen einer Kontakt-Aktivität (als postgres, wie Kaskade/Re-Import) rechnet last_activity_* und last_inbound_* zurück
do $$
declare v_lead uuid := pg_temp.v('rita')::uuid; l crm.leads;
begin
  delete from crm.activities where id = pg_temp.v('rita_antwort')::bigint;
  select * into l from crm.leads where id = v_lead;
  if l.last_activity_at <> timestamptz '2026-10-05 09:00+02' or l.last_activity_type <> 'gespraech_eroeffnet' then
    raise exception 'FAIL r3-4: nach Löschen % %', l.last_activity_at, l.last_activity_type;
  end if;
  if l.last_inbound_at is not null or l.last_inbound_channel is not null then
    raise exception 'FAIL r3-4: last_inbound_* nicht zurückgesetzt (% %)', l.last_inbound_at, l.last_inbound_channel;
  end if;
  if l.last_outbound_at <> timestamptz '2026-10-05 09:00+02' then raise exception 'FAIL r3-4: last_outbound_at %', l.last_outbound_at; end if;
  -- alle Kontakte weg → leer
  delete from crm.activities where lead_id = v_lead and crm.ist_kontakt(type);
  select * into l from crm.leads where id = v_lead;
  if l.last_activity_at is not null or l.last_activity_type is not null or l.last_outbound_at is not null then
    raise exception 'FAIL r3-4: ohne Kontakte nicht leer (% % %)', l.last_activity_at, l.last_activity_type, l.last_outbound_at;
  end if;
  perform pg_temp.ok('r3-4 Löschen rechnet zurück: 08.10. → 05.10. → leer (inkl. last_inbound_*, last_outbound_at)');
end $$;

-- 5) Rückgängig in der App: Vincent erfasst eine Antwort (log_reply) und nimmt sie zurück (undo_activity, RLS) → letzte Bewegung zurück
select set_config('request.jwt.claim.sub', (select user_id::text from public.members where email = 'vincent@steinerundco.de'), true);
set local role authenticated;
do $$
declare v_lead uuid := pg_temp.v('rita')::uuid; l crm.leads; v_act bigint;
begin
  perform crm.log_activity(v_lead, auth.uid(), 'linkedin', 'vernetzung_angenommen', timestamptz '2026-10-02 09:00+02');
  v_act := crm.log_reply(v_lead, 'linkedin', null, 'E2E – frische Antwort');
  select * into l from crm.leads where id = v_lead;
  if l.last_activity_at < now() - interval '1 minute' or l.last_activity_type <> 'nachricht_erhalten' then
    raise exception 'FAIL r3-5: Antwort setzt last_activity_at nicht (% %)', l.last_activity_at, l.last_activity_type;
  end if;
  perform crm.undo_activity(v_act);
  perform set_config('crm.undo_mode', '', true);
  select * into l from crm.leads where id = v_lead;
  if l.last_activity_at <> timestamptz '2026-10-02 09:00+02' or l.last_activity_type <> 'vernetzung_angenommen' or l.last_inbound_at is not null then
    raise exception 'FAIL r3-5: nach Rückgängig % % %', l.last_activity_at, l.last_activity_type, l.last_inbound_at;
  end if;
  perform pg_temp.ok('r3-5 Antwort erfasst + Rückgängig (RLS): letzte Bewegung wieder 02.10., last_inbound_at leer');
end $$;
reset role;

-- 6) Neuberechnung: bei allen Leads ist last_activity_at = jüngster Kontakt (auch die Sheet-Leads, historische Daten)
do $$
declare n_abw int; n_heute int; n_ges int;
begin
  select count(*) filter (where l.last_activity_at is distinct from k.kt), count(*) filter (where l.source = 'import_sheet'
           and l.last_activity_at >= (select min(a.occurred_at) from crm.activities a where a.type = 'import' and a.source = 'import_sheet')),
         count(*)
    into n_abw, n_heute, n_ges
    from crm.leads l
    left join lateral (select max(a.occurred_at) kt from crm.activities a where a.lead_id = l.id and crm.ist_kontakt(a.type)) k on true;
  if n_abw > 0 then raise exception 'FAIL r3-6: % von % Leads mit falscher letzter Bewegung', n_abw, n_ges; end if;
  if n_heute > 0 then raise exception 'FAIL r3-6: % Sheet-Leads stehen noch auf dem Importzeitpunkt', n_heute; end if;
  perform pg_temp.ok('r3-6 alle ' || n_ges || ' Leads: letzte Bewegung = jüngster Kontakt, kein Sheet-Lead auf dem Importzeitpunkt');
end $$;

-- 7) v_leads_ohne_bewegung: Lead in „Gepitcht“ ohne jeden Kontakt, vor 20 Tagen angelegt → erscheint (ab Anlage gezählt)
do $$
declare v_lead uuid := pg_temp.v('rita')::uuid; r record;
begin
  delete from crm.activities where lead_id = v_lead and crm.ist_kontakt(type);
  update crm.enrollments set status = 'gestoppt', stopped_at = now(), stopped_reason = 'manuell' where lead_id = v_lead and status = 'aktiv';
  update crm.leads set stage = 'pitch' where id = v_lead;
  select * into r from crm.v_leads_ohne_bewegung where lead_id = v_lead;
  if not found then raise exception 'FAIL r3-7: Lead ohne Kontakt fehlt in v_leads_ohne_bewegung'; end if;
  if r.last_activity_at is not null or r.tage_ohne_bewegung < 10 then
    raise exception 'FAIL r3-7: % / % Werktage', r.last_activity_at, r.tage_ohne_bewegung;
  end if;
  perform pg_temp.ok('r3-7 ohne Bewegung: Lead ohne Kontakt erscheint, ' || r.tage_ohne_bewegung || ' Werktage seit Anlage');
end $$;

-- 8) Lead endgültig löschen: Kaskade auf activities läuft mit dem Lösch-Trigger durch
do $$
declare v_lead uuid := pg_temp.v('rita')::uuid;
begin
  perform crm.log_activity(v_lead, null, 'linkedin', 'nachricht_gesendet', now() - interval '1 day');
  delete from crm.leads where id = v_lead;
  if exists (select 1 from crm.activities where lead_id = v_lead) then raise exception 'FAIL r3-8: Aktivitäten nicht gelöscht'; end if;
  perform pg_temp.ok('r3-8 Lead löschen (Kaskade) mit Lösch-Trigger ohne Fehler');
end $$;

-- 9) Sheet-Import: je Lead genau ein „angelegt“ (rückdatiert) + ein „import“ (Importzeitpunkt) – die Timeline blendet „import“ aus
do $$
declare n_leads int; n_paar int;
begin
  select count(*) into n_leads from crm.leads where source = 'import_sheet' and deleted_at is null;
  select count(*) into n_paar from crm.leads l
   where l.source = 'import_sheet' and l.deleted_at is null
     and (select count(*) from crm.activities a where a.lead_id = l.id and a.type = 'angelegt' and a.source = 'import_sheet') = 1
     and (select count(*) from crm.activities a where a.lead_id = l.id and a.type = 'import' and a.source = 'import_sheet') = 1;
  if n_paar <> n_leads then raise exception 'FAIL r3-9: % von % Sheet-Leads mit genau einem angelegt + import', n_paar, n_leads; end if;
  perform pg_temp.ok('r3-9 Sheet-Import: ' || n_leads || ' Leads mit je einem angelegt + import (beide bleiben als Beleg)');
end $$;

insert into pruef (fall, ergebnis) values ('alle Fälle', 'ok');
select nr, fall, ergebnis from pruef order by nr;
rollback;
