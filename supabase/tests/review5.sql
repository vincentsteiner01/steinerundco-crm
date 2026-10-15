-- supabase/tests/review5.sql – prüft Migration 5 (Review Nr. 18 und 19), ohne pgTAP.
-- Aufruf: bash tools/db-query.sh -f supabase/tests/review5.sql   (eine Transaktion, endet mit rollback; DB bleibt unverändert)
begin;
create temp table pruef (nr int generated always as identity, fall text, ergebnis text) on commit drop;
create temp table ctx (k text primary key, v text) on commit drop;
grant all on pruef, ctx to authenticated;
select set_config('request.jwt.claim.sub', (select user_id::text from public.members where email = 'vincent@steinerundco.de'), true);
set local role authenticated;

create function pg_temp.lead(p text) returns uuid language sql as $$
  insert into crm.leads (first_name, last_name, linkedin_url, owner_id, notes)
  values ('E2E – ' || p, 'Review-Test', 'https://www.linkedin.com/in/e2e-review5-' || lower(regexp_replace(p, '[^a-z0-9]+', '-', 'gi')) || '/', auth.uid(), 'e2e')
  returning id $$;
create function pg_temp.ok(p_fall text) returns void language sql as $$ insert into pruef (fall, ergebnis) values (p_fall, 'pass') $$;

-- Nr. 19: Annahme mit Datum in der Vergangenheit → Undo entfernt auch die Auto-Sequenz
do $$
declare v_lead uuid;
begin
  v_lead := pg_temp.lead('annahme-rueckdatiert');
  perform crm.log_request(v_lead);
  insert into ctx values ('lead19', v_lead::text);
end $$;
reset role;
update crm.activities set created_at = created_at - interval '5 days' where lead_id = (select v::uuid from ctx where k = 'lead19');
set local role authenticated;
do $$
declare v_lead uuid := (select v::uuid from ctx where k = 'lead19'); v_act bigint; r jsonb;
begin
  perform crm.mark_accepted(v_lead, auth.uid(), (crm.today() - 3));
  if not exists (select 1 from crm.enrollments where lead_id = v_lead and status = 'aktiv') then raise exception 'FAIL 19: Auto-Sequenz nach rückdatierter Annahme fehlt'; end if;
  if (select min(started_at) from crm.enrollments where lead_id = v_lead) > now() - interval '1 day' then raise exception 'FAIL 19: Testannahme nicht rückdatiert (started_at)'; end if;
  select id into v_act from crm.activities where lead_id = v_lead and type = 'vernetzung_angenommen';
  r := crm.undo_activity(v_act); perform set_config('crm.undo_mode', '', true);
  if exists (select 1 from crm.enrollments where lead_id = v_lead) then raise exception 'FAIL 19: Enrollment nach Undo noch da'; end if;
  if exists (select 1 from crm.activities where lead_id = v_lead and type in ('sequenz_gestartet', 'vernetzung_angenommen')) then raise exception 'FAIL 19: sequenz_gestartet/vernetzung_angenommen nicht entfernt'; end if;
  perform pg_temp.ok('19 Undo „Angenommen“ mit Datum −3 T entfernt Auto-Sequenz');
end $$;

-- Nr. 18: E-Mail-Schritt: Composer bestätigt die Mail (Trigger schreibt email_gesendet), complete_step schreibt keinen zweiten Beleg
do $$
declare v_lead uuid; v_enr uuid; e crm.enrollments; v_mail uuid; n int;
begin
  v_lead := pg_temp.lead('email-schritt');
  update crm.leads set email = 'e2e-review5@beispiel.invalid', email_consent_basis = 'meeting_held', email_consent_at = now() where id = v_lead;
  v_enr := crm.enroll(v_lead, 'email_warm_after_erstgespraech', auth.uid());
  select * into e from crm.enrollments where id = v_enr;
  insert into crm.emails (lead_id, member_id, enrollment_id, step_id, to_address, subject, body_text, status)
  values (v_lead, auth.uid(), v_enr, e.current_step_id, 'e2e-review5@beispiel.invalid', 'E2E', 'E2E', 'draft') returning id into v_mail;
  update crm.emails set status = 'sent_confirmed', sent_at = now() where id = v_mail;
  perform crm.complete_step(v_enr, 'gesendet');
  select count(*) into n from crm.activities where enrollment_id = v_enr and type = 'email_gesendet';
  if n <> 1 then raise exception 'FAIL 18: % email_gesendet-Belege statt 1', n; end if;
  if (select current_position from crm.enrollments where id = v_enr) <> 2 then raise exception 'FAIL 18: Sequenz nicht auf Schritt 2 weitergeschaltet'; end if;
  perform pg_temp.ok('18 E-Mail-Schritt: genau ein email_gesendet-Beleg, Sequenz weitergeschaltet');
end $$;

-- Gegenprobe: E-Mail-Schritt ohne emails-Zeile (z. B. manuell erledigt) schreibt weiterhin seinen Beleg
do $$
declare v_lead uuid; v_enr uuid; n int;
begin
  v_lead := pg_temp.lead('email-ohne-zeile');
  update crm.leads set email = 'e2e-review5b@beispiel.invalid', email_consent_basis = 'meeting_held', email_consent_at = now() where id = v_lead;
  v_enr := crm.enroll(v_lead, 'email_warm_after_erstgespraech', auth.uid());
  perform crm.complete_step(v_enr, 'gesendet');
  select count(*) into n from crm.activities where enrollment_id = v_enr and type = 'email_gesendet';
  if n <> 1 then raise exception 'FAIL 18b: % email_gesendet-Belege statt 1', n; end if;
  perform pg_temp.ok('18b E-Mail-Schritt ohne Mail-Zeile: Beleg aus complete_step bleibt');
end $$;
reset role;

insert into pruef (fall, ergebnis) values ('alle Fälle', 'ok');
select nr, fall, ergebnis from pruef order by nr;
rollback;
