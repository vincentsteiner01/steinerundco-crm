-- tools/e2e-cleanup.sql – räumt Reste lokaler Playwright-/SQL-Smoke-Läufe auf (architektur A11/§ 8.2, BAUPLAN E21).
--   bash tools/db-query.sh -f tools/e2e-cleanup.sql
-- Konfliktentscheid M0 (BAUPLAN E21 „source = 'e2e'“ vs. schema.sql: crm.record_source kennt kein 'e2e'):
--   Markierung ist der Name „E2E – <timestamp>“ (architektur § 8.2) bzw. notes = 'e2e'; ein Enum-Wert 'e2e' wäre eine Schema-
--   erweiterung außerhalb der vier Migrationen → Entscheidung des Leads (v1.1). Kinder (activities, calls, tasks, enrollments,
--   linkedin_connections, emails, meetings, lead_tags) hängen per on delete cascade am Lead.
-- Läuft als postgres (bypassrls); nie gegen echte Leads: nur Namen mit dem Präfix „E2E – “ oder notes = 'e2e'.
begin;
delete from crm.leads
 where first_name like 'E2E – %' or last_name like 'E2E – %' or notes = 'e2e';
delete from crm.companies c
 where c.name like 'E2E – %' and not exists (select 1 from crm.leads l where l.company_id = c.id);
delete from crm.import_batches where label like 'E2E – %';
select (select count(*) from crm.leads where first_name like 'E2E – %' or last_name like 'E2E – %' or notes = 'e2e') as verbleibende_e2e_leads;
commit;
