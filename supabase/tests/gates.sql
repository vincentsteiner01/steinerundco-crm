-- supabase/tests/gates.sql – E-Mail-Gate-Trigger (F-09, § 4.4 Nr. 14) und Firmensperre (F-10, § 4.4 Nr. 15), ohne pgTAP.
-- Aufruf: bash tools/db-query.sh -f supabase/tests/gates.sql   (eine Transaktion, endet mit rollback)
begin;
create temp table pruef (nr int generated always as identity, fall text, ergebnis text) on commit drop;
grant all on pruef to authenticated;
select set_config('request.jwt.claim.sub', (select user_id::text from public.members where email = 'vincent@steinerundco.de'), true);
set local role authenticated;
create function pg_temp.ok(p_fall text) returns void language sql as $$ insert into pruef (fall, ergebnis) values (p_fall, 'pass') $$;

-- 1) E-Mail sent_confirmed bei Grundlage none → Fehler; mit Vorlage em_terminbestaetigung_erstgespraech (transaktional) → ok
do $$
declare v_lead uuid; v_msg text := ''; v_tpl uuid; v_mail uuid;
begin
  insert into crm.leads (first_name, last_name, email, owner_id, notes)
  values ('E2E – Gate', 'Test', 'e2e-gate@example.invalid', auth.uid(), 'e2e') returning id into v_lead;
  if (select email_consent_basis from crm.leads where id = v_lead) <> 'none' then raise exception 'FAIL gates-1: Grundlage nicht none'; end if;
  begin
    insert into crm.emails (lead_id, member_id, direction, to_address, subject, body_text, status)
    values (v_lead, auth.uid(), 'out', 'e2e-gate@example.invalid', 'Test', 'Hallo', 'sent_confirmed');
  exception when others then v_msg := sqlerrm;
  end;
  if v_msg not like '%Erlaubnis%' then raise exception 'FAIL gates-1: sent_confirmed ohne Grundlage nicht abgewiesen (%)', v_msg; end if;
  perform pg_temp.ok('gates-1a E-Mail ohne Grundlage abgewiesen: „' || v_msg || '“');
  select id into v_tpl from crm.templates where key = 'em_terminbestaetigung_erstgespraech';
  if v_tpl is null then raise exception 'FAIL gates-1: Vorlage em_terminbestaetigung_erstgespraech fehlt (seed-privat eingespielt?)'; end if;
  insert into crm.emails (lead_id, member_id, direction, to_address, subject, body_text, status, template_id)
  values (v_lead, auth.uid(), 'out', 'e2e-gate@example.invalid', 'Terminbestätigung', 'Hallo', 'sent_confirmed', v_tpl) returning id into v_mail;
  if (select consent_basis_snapshot from crm.emails where id = v_mail) <> 'none' then raise exception 'FAIL gates-1: Snapshot nicht none'; end if;
  if (select sent_at from crm.emails where id = v_mail) is null then raise exception 'FAIL gates-1: sent_at nicht gesetzt'; end if;
  if not exists (select 1 from crm.activities where lead_id = v_lead and type = 'email_gesendet') then raise exception 'FAIL gates-1: email_gesendet-Aktivität fehlt'; end if;
  perform pg_temp.ok('gates-1b transaktionale Vorlage ohne Grundlage akzeptiert (sent_confirmed, Snapshot none)');
  -- Entwurf ohne Grundlage bleibt erlaubt (Gate greift erst beim Senden)
  insert into crm.emails (lead_id, member_id, direction, to_address, subject, body_text, status)
  values (v_lead, auth.uid(), 'out', 'e2e-gate@example.invalid', 'Entwurf', 'Hallo', 'draft');
  perform pg_temp.ok('gates-1c Entwurf ohne Grundlage erlaubt');
end $$;

-- 2) Firmensperre: enroll, log_request, log_call, log_outbound → Fehler; v_today_queue leer; mark_accepted ok
do $$
declare v_co uuid; v_lead uuid; v_msg text; n int;
begin
  insert into crm.companies (name, do_not_contact) values ('E2E – Gesperrte Firma GmbH', true) returning id into v_co;
  insert into crm.leads (first_name, last_name, linkedin_url, phone_e164, company_id, owner_id, notes)
  values ('E2E – Sperre', 'Test', 'https://www.linkedin.com/in/e2e-sperre-test/', '+494098765432', v_co, auth.uid(), 'e2e') returning id into v_lead;
  if not crm.company_blocked(v_lead) then raise exception 'FAIL gates-2: company_blocked() ist false'; end if;

  v_msg := ''; begin perform crm.enroll(v_lead, 'linkedin_standard', auth.uid()); exception when others then v_msg := sqlerrm; end;
  if v_msg not like '%gesperrt%' then raise exception 'FAIL gates-2: enroll nicht abgewiesen (%)', v_msg; end if;
  perform pg_temp.ok('gates-2a enroll abgewiesen: „' || v_msg || '“');

  v_msg := ''; begin perform crm.log_request(v_lead); exception when others then v_msg := sqlerrm; end;
  if v_msg not like '%gesperrt%' then raise exception 'FAIL gates-2: log_request nicht abgewiesen (%)', v_msg; end if;
  perform pg_temp.ok('gates-2b log_request abgewiesen');

  v_msg := ''; begin perform crm.log_call(v_lead, 'no_answer'); exception when others then v_msg := sqlerrm; end;
  if v_msg not like '%gesperrt%' then raise exception 'FAIL gates-2: log_call nicht abgewiesen (%)', v_msg; end if;
  perform pg_temp.ok('gates-2c log_call (ausgehend) abgewiesen');

  v_msg := ''; begin perform crm.log_outbound(v_lead, 'linkedin', null, 'nachricht'); exception when others then v_msg := sqlerrm; end;
  if v_msg not like '%gesperrt%' then raise exception 'FAIL gates-2: log_outbound nicht abgewiesen (%)', v_msg; end if;
  perform pg_temp.ok('gates-2d log_outbound abgewiesen');

  v_msg := '';
  begin
    insert into crm.emails (lead_id, member_id, direction, to_address, subject, body_text, status, template_id)
    values (v_lead, auth.uid(), 'out', 'e2e-sperre@example.invalid', 'x', 'y', 'sent_confirmed', (select id from crm.templates where key = 'em_terminbestaetigung_erstgespraech'));
  exception when others then v_msg := sqlerrm;
  end;
  if v_msg not like '%gesperrt%' then raise exception 'FAIL gates-2: E-Mail an gesperrte Firma nicht abgewiesen (%)', v_msg; end if;
  perform pg_temp.ok('gates-2e emails_before_write prüft Firmensperre');

  -- offene Aufgabe anlegen (geht am Trigger vorbei) – der Lead darf trotzdem nicht in der Heute-Queue erscheinen
  insert into crm.tasks (lead_id, member_id, kind, title, due_at, created_by) values (v_lead, auth.uid(), 'aufgabe', 'E2E', now(), auth.uid());
  select count(*) into n from crm.v_today_queue where lead_id = v_lead;
  if n <> 0 then raise exception 'FAIL gates-2: v_today_queue enthält % Einträge des gesperrten Leads', n; end if;
  perform pg_temp.ok('gates-2f v_today_queue ohne gesperrten Lead');

  perform crm.mark_accepted(v_lead);   -- Annahme ist kein Kontakt; Auto-Sequenz scheitert nur als Notice
  if (select status from crm.linkedin_connections where lead_id = v_lead and member_id = auth.uid()) <> 'angenommen' then raise exception 'FAIL gates-2: mark_accepted nicht möglich'; end if;
  if exists (select 1 from crm.enrollments where lead_id = v_lead) then raise exception 'FAIL gates-2: Auto-Sequenz trotz Firmensperre'; end if;
  perform pg_temp.ok('gates-2g mark_accepted ok, keine Auto-Sequenz');
end $$;
reset role;

insert into pruef (fall, ergebnis) values ('alle Fälle', 'ok');
select nr, fall, ergebnis from pruef order by nr;
rollback;
