-- supabase/tests/undo.sql – Undo-Fälle aus BAUPLAN § 4.4 (F-06), ohne pgTAP.
-- Aufruf: bash tools/db-query.sh -f supabase/tests/undo.sql   (eine Transaktion, endet mit rollback; DB bleibt unverändert)
-- Muster: siehe supabase/tests/_kopf.sql.txt. Zwischen den Blöcken wechselt die Rolle (postgres verschiebt created_at,
-- damit „derselbe Moment“ (±2 s) nur die jeweils zu prüfende Aktion trifft – in der App liegen Tage dazwischen).
begin;
create temp table pruef (nr int generated always as identity, fall text, ergebnis text) on commit drop;
create temp table ctx (k text primary key, v text) on commit drop;
grant all on pruef, ctx to authenticated;
select set_config('request.jwt.claim.sub', (select user_id::text from public.members where email = 'vincent@steinerundco.de'), true);
set local role authenticated;

-- Helfer: synthetischer Lead („E2E – …“, keine echten Personen), Zuständigkeit Vincent
create function pg_temp.lead(p text) returns uuid language sql as $$
  insert into crm.leads (first_name, last_name, linkedin_url, owner_id, notes)
  values ('E2E – ' || p, 'Undo-Test', 'https://www.linkedin.com/in/e2e-undo-' || lower(regexp_replace(p, '[^a-z0-9]+', '-', 'gi')) || '/', auth.uid(), 'e2e')
  returning id $$;
create function pg_temp.undo(p_id bigint) returns jsonb language plpgsql as $$
declare r jsonb; begin r := crm.undo_activity(p_id); perform set_config('crm.undo_mode', '', true); return r; end $$;
create function pg_temp.undo_fehler(p_id bigint) returns text language plpgsql as $$
declare v text := ''; begin
  begin perform crm.undo_activity(p_id); exception when others then v := sqlerrm; end;
  perform set_config('crm.undo_mode', '', true); return v; end $$;
create function pg_temp.ok(p_fall text) returns void language sql as $$ insert into pruef (fall, ergebnis) values (p_fall, 'pass') $$;

-- 1) complete_step → undo: Schritt, Fälligkeit, snooze_count, Stufe zurück; stage_wechsel des Moments weg
do $$
declare v_lead uuid; v_enr uuid; e0 crm.enrollments; e1 crm.enrollments; v_act bigint; v_stage crm.lead_stage;
begin
  v_lead := pg_temp.lead('complete');
  v_enr := crm.enroll(v_lead, 'linkedin_standard', auth.uid());
  select * into e0 from crm.enrollments where id = v_enr;
  select stage into v_stage from crm.leads where id = v_lead;
  perform crm.complete_step(v_enr, 'gesendet');
  select id into v_act from crm.activities where lead_id = v_lead and type = 'gespraech_eroeffnet';
  if v_act is null then raise exception 'FAIL undo-1: keine gespraech_eroeffnet-Aktivität'; end if;
  if (select stage from crm.leads where id = v_lead) <> 'gespraech_eroeffnet' then raise exception 'FAIL undo-1: Stufe nach Opener nicht gespraech_eroeffnet'; end if;
  if (select current_position from crm.enrollments where id = v_enr) <> 2 then raise exception 'FAIL undo-1: Position nach complete_step nicht 2'; end if;
  perform pg_temp.undo(v_act);
  select * into e1 from crm.enrollments where id = v_enr;
  if e1.current_step_id <> e0.current_step_id or e1.current_position <> 1 then raise exception 'FAIL undo-1: Schritt nicht zurückgesetzt'; end if;
  if e1.next_due_at <> e0.next_due_at then raise exception 'FAIL undo-1: next_due_at nicht zurückgesetzt (% vs %)', e1.next_due_at, e0.next_due_at; end if;
  if e1.snooze_count <> e0.snooze_count or e1.status <> 'aktiv' or e1.last_step_at is distinct from e0.last_step_at then raise exception 'FAIL undo-1: snooze_count/status/last_step_at'; end if;
  if (select stage from crm.leads where id = v_lead) <> v_stage then raise exception 'FAIL undo-1: Stufe nicht zurück auf %', v_stage; end if;
  if exists (select 1 from crm.activities where lead_id = v_lead and type in ('stage_wechsel', 'gespraech_eroeffnet')) then raise exception 'FAIL undo-1: stage_wechsel/gespraech_eroeffnet nicht gelöscht'; end if;
  perform pg_temp.ok('undo-1 complete_step zurück (Schritt, next_due_at, snooze_count, Stufe, stage_wechsel weg)');
end $$;

-- 2) snooze_step → undo: Fälligkeit und snooze_count zurück
do $$
declare v_lead uuid; v_enr uuid; e0 crm.enrollments; e1 crm.enrollments; v_act bigint;
begin
  v_lead := pg_temp.lead('snooze');
  v_enr := crm.enroll(v_lead, 'linkedin_standard', auth.uid());
  select * into e0 from crm.enrollments where id = v_enr;
  perform crm.snooze_step(v_enr, null, 2);
  if (select snooze_count from crm.enrollments where id = v_enr) <> 1 then raise exception 'FAIL undo-2: snooze_count nicht 1'; end if;
  select id into v_act from crm.activities where lead_id = v_lead and type = 'schritt_verschoben';
  perform pg_temp.undo(v_act);
  select * into e1 from crm.enrollments where id = v_enr;
  if e1.next_due_at <> e0.next_due_at or e1.snooze_count <> 0 then raise exception 'FAIL undo-2: next_due_at/snooze_count nicht zurück'; end if;
  perform pg_temp.ok('undo-2 snooze_step zurück');
end $$;

-- 3) Beenden → undo: Stufe, ended_reason, ended_at, ended_note, stage_changed_at zurück; Sequenz wieder aktiv
do $$
declare v_lead uuid; v_enr uuid; l0 crm.leads; l1 crm.leads; v_act bigint;
begin
  v_lead := pg_temp.lead('beenden');
  v_enr := crm.enroll(v_lead, 'linkedin_standard', auth.uid());
  select * into l0 from crm.leads where id = v_lead;
  update crm.leads set stage = 'beendet', ended_reason = 'kein_interesse', ended_note = 'Testgrund' where id = v_lead;
  if (select status from crm.enrollments where id = v_enr) <> 'gestoppt' then raise exception 'FAIL undo-3: Sequenz nicht gestoppt'; end if;
  select id into v_act from crm.activities where lead_id = v_lead and type = 'stage_wechsel' and metadata->>'to' = 'beendet';
  if (select metadata->>'prev_stage_changed_at' from crm.activities where id = v_act) is null then raise exception 'FAIL undo-3: prev_stage_changed_at fehlt in metadata'; end if;
  perform pg_temp.undo(v_act);
  select * into l1 from crm.leads where id = v_lead;
  if l1.stage <> l0.stage or l1.ended_reason is not null or l1.ended_at is not null or l1.ended_note is not null then raise exception 'FAIL undo-3: Stufe/ended_* nicht zurück (% % % %)', l1.stage, l1.ended_reason, l1.ended_at, l1.ended_note; end if;
  if l1.stage_changed_at <> l0.stage_changed_at then raise exception 'FAIL undo-3: stage_changed_at nicht zurück'; end if;
  if (select status from crm.enrollments where id = v_enr) <> 'aktiv' then raise exception 'FAIL undo-3: Sequenz nicht wieder aktiv (status %)', (select status from crm.enrollments where id = v_enr); end if;
  if (select next_due_at from crm.enrollments where id = v_enr) is null then raise exception 'FAIL undo-3: next_due_at nach Reaktivierung null'; end if;
  perform pg_temp.ok('undo-3 Beenden zurück (Stufe, ended_reason/at/note, stage_changed_at, Sequenz aktiv)');
end $$;

-- 4) Reaktivieren (beendet → dm_follow_up) → undo: zurück nach beendet MIT altem Grund und altem ended_at
do $$
declare v_lead uuid; v_act bigint; l1 crm.leads; v_alt timestamptz := now() - interval '3 days';
begin
  v_lead := pg_temp.lead('reaktivieren');
  update crm.leads set stage = 'beendet', ended_reason = 'kein_bedarf', ended_at = v_alt, ended_note = 'alt' where id = v_lead;
  update crm.leads set stage = 'dm_follow_up' where id = v_lead;
  select * into l1 from crm.leads where id = v_lead;
  if l1.ended_reason is not null or l1.ended_at is not null then raise exception 'FAIL undo-4: Reaktivieren hat ended_* nicht genullt'; end if;
  select id into v_act from crm.activities where lead_id = v_lead and type = 'stage_wechsel' and metadata->>'to' = 'dm_follow_up';
  perform pg_temp.undo(v_act);
  select * into l1 from crm.leads where id = v_lead;
  if l1.stage <> 'beendet' or l1.ended_reason <> 'kein_bedarf' or l1.ended_at <> v_alt or l1.ended_note <> 'alt' then
    raise exception 'FAIL undo-4: nicht zurück nach beendet mit altem Grund (% % % %)', l1.stage, l1.ended_reason, l1.ended_at, l1.ended_note; end if;
  perform pg_temp.ok('undo-4 Reaktivieren zurück nach beendet mit altem Grund/ended_at');
end $$;

-- 5) mark_accepted → undo: ausstehend, kein Enrollment, KEINE sequenz_gestartet-Zeile, Stufe zurück
--    (Setup: Anfrage, dann created_at einen Tag zurück – postgres-Block)
do $$
declare v_lead uuid;
begin
  v_lead := pg_temp.lead('annahme');
  perform crm.log_request(v_lead);
  insert into ctx values ('annahme', v_lead::text);
end $$;
reset role;
update crm.activities set created_at = created_at - interval '1 day' where lead_id = (select v::uuid from ctx where k = 'annahme');
set local role authenticated;
do $$
declare v_lead uuid := (select v::uuid from ctx where k = 'annahme'); v_act bigint; c crm.linkedin_connections;
begin
  perform crm.mark_accepted(v_lead);
  if not exists (select 1 from crm.enrollments where lead_id = v_lead and status = 'aktiv') then raise exception 'FAIL undo-5: Auto-Sequenz nach Annahme fehlt'; end if;
  if not exists (select 1 from crm.activities where lead_id = v_lead and type = 'sequenz_gestartet') then raise exception 'FAIL undo-5: sequenz_gestartet fehlt'; end if;
  select id into v_act from crm.activities where lead_id = v_lead and type = 'vernetzung_angenommen';
  perform pg_temp.undo(v_act);
  select * into c from crm.linkedin_connections where lead_id = v_lead and member_id = auth.uid();
  if c.status <> 'ausstehend' or c.accepted_at is not null then raise exception 'FAIL undo-5: Vernetzung nicht ausstehend'; end if;
  if exists (select 1 from crm.enrollments where lead_id = v_lead) then raise exception 'FAIL undo-5: Enrollment nicht entfernt'; end if;
  if exists (select 1 from crm.activities where lead_id = v_lead and type in ('sequenz_gestartet', 'vernetzung_angenommen')) then raise exception 'FAIL undo-5: sequenz_gestartet/vernetzung_angenommen nicht entfernt'; end if;
  if (select stage from crm.leads where id = v_lead) <> 'vernetzung_gesendet' then raise exception 'FAIL undo-5: Stufe nicht zurück auf vernetzung_gesendet'; end if;
  perform pg_temp.ok('undo-5 mark_accepted zurück (ausstehend, kein Enrollment, keine sequenz_gestartet-Zeile, Stufe)');
end $$;

-- 6) log_outbound(pitch) + enroll(C) → undo: Stufe dm_beantwortet, inbound_unanswered_since wieder gesetzt, Enrollment und sequenz_gestartet weg
do $$
declare v_lead uuid;
begin
  v_lead := pg_temp.lead('pitch');
  perform crm.log_reply(v_lead, 'linkedin', 'interessiert', 'Antwort');
  insert into ctx values ('pitch', v_lead::text);
end $$;
reset role;
update crm.activities set created_at = created_at - interval '1 day' where lead_id = (select v::uuid from ctx where k = 'pitch');
set local role authenticated;
do $$
declare v_lead uuid := (select v::uuid from ctx where k = 'pitch'); v_act bigint; v_inb timestamptz; l1 crm.leads;
begin
  select inbound_unanswered_since into v_inb from crm.leads where id = v_lead;
  if v_inb is null or (select stage from crm.leads where id = v_lead) <> 'dm_beantwortet' then raise exception 'FAIL undo-6: Setup (Antwort) fehlgeschlagen'; end if;
  v_act := crm.log_outbound(v_lead, 'linkedin', (select id from crm.templates where key = 'li_pitch_a'), 'pitch');
  perform crm.enroll(v_lead, 'linkedin_nachfassen_im_gespraech', auth.uid());
  select * into l1 from crm.leads where id = v_lead;
  if l1.stage <> 'pitch' or l1.inbound_unanswered_since is not null then raise exception 'FAIL undo-6: Pitch hat Stufe/Antwort-Flag nicht gesetzt'; end if;
  perform pg_temp.undo(v_act);
  select * into l1 from crm.leads where id = v_lead;
  if l1.stage <> 'dm_beantwortet' then raise exception 'FAIL undo-6: Stufe nicht dm_beantwortet (%)', l1.stage; end if;
  if l1.inbound_unanswered_since is distinct from v_inb then raise exception 'FAIL undo-6: inbound_unanswered_since nicht wiederhergestellt'; end if;
  if exists (select 1 from crm.enrollments where lead_id = v_lead) then raise exception 'FAIL undo-6: Sequenz C nicht entfernt'; end if;
  if exists (select 1 from crm.activities where lead_id = v_lead and type in ('sequenz_gestartet', 'pitch_gesendet', 'stage_wechsel') and created_at >= now() - interval '1 minute') then raise exception 'FAIL undo-6: Belege des Moments nicht entfernt'; end if;
  perform pg_temp.ok('undo-6 log_outbound(pitch) + enroll(C) zurück');
end $$;

-- 7) log_outbound + set_wiedervorlage → undo: Aufgabe weg, Stufe zurück
do $$
declare v_lead uuid; v_act bigint; t crm.tasks;
begin
  v_lead := pg_temp.lead('wiedervorlage');
  v_act := crm.log_outbound(v_lead, 'linkedin', null, 'nachricht', 'Später');
  t := crm.set_wiedervorlage(v_lead, crm.today() + 30, 'in einem Monat');
  if (select stage from crm.leads where id = v_lead) <> 'langfristig' then raise exception 'FAIL undo-7: Stufe nicht langfristig'; end if;
  perform pg_temp.undo(v_act);
  if exists (select 1 from crm.tasks where id = t.id) then raise exception 'FAIL undo-7: Wiedervorlage-Aufgabe nicht entfernt'; end if;
  if (select stage from crm.leads where id = v_lead) <> 'neu' then raise exception 'FAIL undo-7: Stufe nicht zurück auf neu'; end if;
  perform pg_temp.ok('undo-7 log_outbound + set_wiedervorlage zurück (Aufgabe weg, Stufe)');
end $$;

-- 8) release_lead → undo: Zuständigkeit zurück, pausierte Sequenz wieder aktiv
do $$
declare v_lead uuid; v_enr uuid; v_act bigint; l1 crm.leads;
begin
  v_lead := pg_temp.lead('freigabe');
  v_enr := crm.enroll(v_lead, 'linkedin_standard', auth.uid());
  perform crm.release_lead(v_lead, 'Urlaub');
  select * into l1 from crm.leads where id = v_lead;
  if l1.owner_id is not null or not l1.released then raise exception 'FAIL undo-8: Freigabe nicht wirksam'; end if;
  if (select status from crm.enrollments where id = v_enr) <> 'pausiert' then raise exception 'FAIL undo-8: Sequenz nicht pausiert'; end if;
  select id into v_act from crm.activities where lead_id = v_lead and type = 'freigabe';
  perform pg_temp.undo(v_act);
  select * into l1 from crm.leads where id = v_lead;
  if l1.owner_id is distinct from auth.uid() or l1.released then raise exception 'FAIL undo-8: Zuständigkeit nicht zurück'; end if;
  if (select status from crm.enrollments where id = v_enr) <> 'aktiv' then raise exception 'FAIL undo-8: Sequenz nicht wieder aktiv'; end if;
  if exists (select 1 from crm.activities where lead_id = v_lead and type in ('freigabe', 'uebergabe')) then raise exception 'FAIL undo-8: freigabe/uebergabe-Zeile übrig'; end if;
  perform pg_temp.ok('undo-8 release_lead zurück (owner, Sequenz aktiv, keine Zweitzeile)');
end $$;

-- 9) transfer_lead → genau eine uebergabe-Zeile vorher, null danach, Zuständigkeit zurück
do $$
declare v_lead uuid; v_mike uuid := (select user_id from public.members where email = 'mike@steinerundco.de'); v_act bigint; n int;
begin
  v_lead := pg_temp.lead('uebergabe');
  perform crm.transfer_lead(v_lead, v_mike, 'Bitte übernehmen');
  select count(*) into n from crm.activities where lead_id = v_lead and type = 'uebergabe';
  if n <> 1 then raise exception 'FAIL undo-9: % uebergabe-Zeilen statt 1', n; end if;
  select id into v_act from crm.activities where lead_id = v_lead and type = 'uebergabe';
  perform pg_temp.undo(v_act);
  select count(*) into n from crm.activities where lead_id = v_lead and type = 'uebergabe';
  if n <> 0 then raise exception 'FAIL undo-9: % uebergabe-Zeilen nach Undo', n; end if;
  if (select owner_id from crm.leads where id = v_lead) is distinct from auth.uid() then raise exception 'FAIL undo-9: owner nicht zurück'; end if;
  perform pg_temp.ok('undo-9 transfer_lead zurück (eine uebergabe-Zeile vorher, null danach)');
end $$;

-- 10) „Annahme prüfen X“ (zurueckgezogen, note abgelehnt) → undo: ausstehend
do $$
declare v_lead uuid;
begin
  v_lead := pg_temp.lead('ablehnen');
  perform crm.log_request(v_lead);
  insert into ctx values ('ablehnen', v_lead::text);
end $$;
reset role;
update crm.activities set created_at = created_at - interval '1 day' where lead_id = (select v::uuid from ctx where k = 'ablehnen');
set local role authenticated;
do $$
declare v_lead uuid := (select v::uuid from ctx where k = 'ablehnen'); v_act bigint; c crm.linkedin_connections;
begin
  update crm.linkedin_connections set status = 'zurueckgezogen', withdrawn_at = now(), note = 'abgelehnt' where lead_id = v_lead and member_id = auth.uid();
  select id into v_act from crm.activities where lead_id = v_lead and type = 'vernetzung_zurueckgezogen';
  if v_act is null then raise exception 'FAIL undo-10: vernetzung_zurueckgezogen fehlt'; end if;
  perform pg_temp.undo(v_act);
  select * into c from crm.linkedin_connections where lead_id = v_lead and member_id = auth.uid();
  if c.status <> 'ausstehend' or c.withdrawn_at is not null then raise exception 'FAIL undo-10: nicht wieder ausstehend'; end if;
  perform pg_temp.ok('undo-10 Annahme prüfen X zurück (ausstehend)');
end $$;

-- 11) log_call → Fehler „ist ein Beleg“; 12) sequenz_gestartet einzeln → Fehler; 13) nach 10 Minuten → Fehler
do $$
declare v_lead uuid; v_act bigint; v_msg text;
begin
  v_lead := pg_temp.lead('beleg');
  update crm.leads set phone_e164 = '+494012345678' where id = v_lead;
  perform crm.log_call(v_lead, 'no_answer');
  select id into v_act from crm.activities where lead_id = v_lead and type = 'anruf';
  v_msg := pg_temp.undo_fehler(v_act);
  if v_msg not like '%Beleg%' then raise exception 'FAIL undo-11: anruf-Undo nicht abgewiesen (%)', v_msg; end if;
  perform pg_temp.ok('undo-11 log_call → „' || v_msg || '“');
  select id into v_act from crm.activities where lead_id = v_lead and type = 'sequenz_gestartet';
  if v_act is null then raise exception 'FAIL undo-12: keine sequenz_gestartet-Zeile (Auto-Telefon-Sequenz)'; end if;
  v_msg := pg_temp.undo_fehler(v_act);
  if v_msg not like '%Beleg%' then raise exception 'FAIL undo-12: sequenz_gestartet-Undo nicht abgewiesen (%)', v_msg; end if;
  perform pg_temp.ok('undo-12 sequenz_gestartet einzeln → „' || v_msg || '“');
  v_act := crm.log_activity(v_lead, auth.uid(), 'sonstiges', 'notiz', now(), p_note => 'alt');
  insert into ctx values ('notiz', v_act::text);
end $$;
reset role;
update crm.activities set created_at = now() - interval '11 minutes' where id = (select v::bigint from ctx where k = 'notiz');
set local role authenticated;
do $$
declare v_msg text;
begin
  v_msg := pg_temp.undo_fehler((select v::bigint from ctx where k = 'notiz'));
  if v_msg not like '%zehn Minuten%' then raise exception 'FAIL undo-13: Undo nach 10 Minuten nicht abgewiesen (%)', v_msg; end if;
  perform pg_temp.ok('undo-13 nach 10 Minuten → „' || v_msg || '“');
end $$;
reset role;

insert into pruef (fall, ergebnis) values ('alle Fälle', 'ok');
select nr, fall, ergebnis from pruef order by nr;
rollback;
