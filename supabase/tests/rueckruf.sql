-- supabase/tests/rueckruf.sql – Rückruf-Kadenz (F-11, BAUPLAN § 4.4 Nr. 17, § 1.5 Nr. 38), ohne pgTAP.
--   callback_scheduled → Rückruf-Task; no_answer mit p_task_id → „Wiederholung 1“ (+1 Kalendertag, gerollt);
--   nochmals → „Wiederholung 2“ (+3); nochmals → Enrollment telefon_standard ab Position 3, kein weiterer Rückruf-Task;
--   no_answer OHNE p_task_id → alter Pfad (telefon_standard ab Position 2).
-- Aufruf: bash tools/db-query.sh -f supabase/tests/rueckruf.sql   (eine Transaktion, endet mit rollback)
begin;
create temp table pruef (nr int generated always as identity, fall text, ergebnis text) on commit drop;
grant all on pruef to authenticated;
select set_config('request.jwt.claim.sub', (select user_id::text from public.members where email = 'vincent@steinerundco.de'), true);
set local role authenticated;
create function pg_temp.ok(p_fall text) returns void language sql as $$ insert into pruef (fall, ergebnis) values (p_fall, 'pass') $$;

do $$
declare v_lead uuid; t1 crm.tasks; t2 crm.tasks; t3 crm.tasks; v_start timestamptz := now(); e crm.enrollments; n int;
begin
  insert into crm.leads (first_name, last_name, linkedin_url, phone_e164, owner_id, call_basis, notes)
  values ('E2E – Rückruf', 'Test', 'https://www.linkedin.com/in/e2e-rueckruf-test/', '+494011223344', auth.uid(), 'linkedin_vernetzt', 'e2e') returning id into v_lead;

  -- 1) Rückruf vereinbart
  perform crm.log_call(v_lead, 'callback_scheduled', 'ruft morgen zurück', p_started_at => v_start, p_callback_at => v_start + interval '1 day');
  select * into t1 from crm.tasks where lead_id = v_lead and kind = 'rueckruf' and status = 'offen';
  if t1.id is null then raise exception 'FAIL rueckruf-1: kein Rückruf-Task'; end if;
  if t1.title <> 'Rückruf' then raise exception 'FAIL rueckruf-1: Titel „%“', t1.title; end if;
  perform pg_temp.ok('rueckruf-1 callback_scheduled → Task „Rückruf“');

  -- 2) nicht erreicht → Wiederholung 1, +1 Kalendertag gerollt, 10:00
  perform crm.log_call(v_lead, 'no_answer', p_started_at => v_start, p_task_id => t1.id);
  if (select status from crm.tasks where id = t1.id) <> 'erledigt' then raise exception 'FAIL rueckruf-2: ursprünglicher Task nicht erledigt'; end if;
  select * into t2 from crm.tasks where lead_id = v_lead and kind = 'rueckruf' and status = 'offen';
  if t2.id is null or t2.title <> 'Rückruf – nicht erreicht (Wiederholung 1)' then raise exception 'FAIL rueckruf-2: Wiederholung 1 fehlt (%)', t2.title; end if;
  if t2.due_at <> crm.next_due(v_start, 1, true) + interval '1 hour' then raise exception 'FAIL rueckruf-2: due_at % statt %', t2.due_at, crm.next_due(v_start, 1, true) + interval '1 hour'; end if;
  if crm.berlin_date(t2.due_at) <> crm.roll_to_weekday(crm.berlin_date(v_start) + 1) then raise exception 'FAIL rueckruf-2: nicht auf Werktag gerollt'; end if;
  if exists (select 1 from crm.enrollments where lead_id = v_lead) then raise exception 'FAIL rueckruf-2: unerwartete Telefon-Sequenz nach Wiederholung 1'; end if;
  perform pg_temp.ok('rueckruf-2 no_answer(p_task_id) → „Wiederholung 1“ am ' || to_char(t2.due_at at time zone 'Europe/Berlin', 'DD.MM. HH24:MI'));

  -- 3) nochmals nicht erreicht → Wiederholung 2, +3
  perform crm.log_call(v_lead, 'no_answer', p_started_at => v_start, p_task_id => t2.id);
  select * into t3 from crm.tasks where lead_id = v_lead and kind = 'rueckruf' and status = 'offen';
  if t3.id is null or t3.title <> 'Rückruf – nicht erreicht (Wiederholung 2)' then raise exception 'FAIL rueckruf-3: Wiederholung 2 fehlt (%)', t3.title; end if;
  if t3.due_at <> crm.next_due(v_start, 3, true) + interval '1 hour' then raise exception 'FAIL rueckruf-3: due_at % statt %', t3.due_at, crm.next_due(v_start, 3, true) + interval '1 hour'; end if;
  perform pg_temp.ok('rueckruf-3 nochmals → „Wiederholung 2“ am ' || to_char(t3.due_at at time zone 'Europe/Berlin', 'DD.MM. HH24:MI'));

  -- 4) dritter Fehlversuch → telefon_standard ab Position 3, kein weiterer Rückruf-Task
  perform crm.log_call(v_lead, 'no_answer', p_started_at => v_start, p_task_id => t3.id);
  select * into e from crm.enrollments where lead_id = v_lead and channel = 'telefon' and status = 'aktiv';
  if e.id is null then raise exception 'FAIL rueckruf-4: keine aktive Telefon-Sequenz'; end if;
  if (select key from crm.sequences where id = e.sequence_id) <> 'telefon_standard' or e.current_position <> 3 then
    raise exception 'FAIL rueckruf-4: Sequenz/Position falsch (% / %)', (select key from crm.sequences where id = e.sequence_id), e.current_position; end if;
  select count(*) into n from crm.tasks where lead_id = v_lead and kind = 'rueckruf' and status = 'offen';
  if n <> 0 then raise exception 'FAIL rueckruf-4: % offene Rückruf-Tasks nach drittem Fehlversuch', n; end if;
  select count(*) into n from crm.calls where lead_id = v_lead;
  if n <> 4 then raise exception 'FAIL rueckruf-4: % Anrufe statt 4', n; end if;
  perform pg_temp.ok('rueckruf-4 dritter Fehlversuch → telefon_standard Position 3, kein Rückruf-Task mehr');
end $$;

-- 5) Kontrolle: no_answer ohne p_task_id nimmt den alten Pfad (telefon_standard ab Position 2)
do $$
declare v_lead uuid; e crm.enrollments;
begin
  insert into crm.leads (first_name, last_name, linkedin_url, phone_e164, owner_id, call_basis, notes)
  values ('E2E – Rückruf alt', 'Test', 'https://www.linkedin.com/in/e2e-rueckruf-alt-test/', '+494011223355', auth.uid(), 'linkedin_vernetzt', 'e2e') returning id into v_lead;
  perform crm.log_call(v_lead, 'no_answer');
  select * into e from crm.enrollments where lead_id = v_lead and channel = 'telefon' and status = 'aktiv';
  if e.id is null or e.current_position <> 2 then raise exception 'FAIL rueckruf-5: alter Pfad liefert nicht Position 2 (%)', e.current_position; end if;
  if exists (select 1 from crm.tasks where lead_id = v_lead and kind = 'rueckruf') then raise exception 'FAIL rueckruf-5: Rückruf-Task ohne vereinbarten Rückruf'; end if;
  perform pg_temp.ok('rueckruf-5 no_answer ohne p_task_id → telefon_standard Position 2 (alter Pfad)');
end $$;
reset role;

insert into pruef (fall, ergebnis) values ('alle Fälle', 'ok');
select nr, fall, ergebnis from pruef order by nr;
rollback;
