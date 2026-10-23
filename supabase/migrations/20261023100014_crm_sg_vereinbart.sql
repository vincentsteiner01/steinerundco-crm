-- =====================================================================================================
-- CRM Steiner & Co. · Migration 14 · v_metric_events + „SG vereinbart“, idempotent.
-- Stand: 2026-10-23
--
-- Getrennt von Migration 13, weil ein neuer Enum-Wert (crm.metric 'strategiegespraeche_vereinbart') erst nach dem Commit
-- verwendet werden darf. Die View ist bis auf den letzten Zweig unverändert aus Migration 1 übernommen (gleiche Spalten,
-- security_invoker); v_funnel_monthly / v_daily_activity bleiben unberührt.
-- =====================================================================================================

create or replace view crm.v_metric_events with (security_invoker = true) as
select c.member_id, c.date as day, c.metric, c.value, 'zaehler'::text as source, c.period
  from crm.daily_counters c
union all
select c.member_id, crm.berlin_date(c.accepted_at), 'vernetzungen_angenommen'::crm.metric, 1, 'ereignis', 'tag'::crm.counter_period
  from crm.linkedin_connections c where c.accepted_at is not null and c.kpi_relevant
union all
select c.member_id, crm.berlin_date(c.requested_at), 'ausstehend'::crm.metric, 1, 'ereignis', 'tag'
  from crm.linkedin_connections c where c.status = 'ausstehend' and c.requested_at is not null and c.kpi_relevant
union all
select a.member_id, crm.berlin_date(a.occurred_at), 'gespraeche_eroeffnet'::crm.metric, 1, 'ereignis', 'tag'
  from crm.activities a where a.type = 'gespraech_eroeffnet' and a.kpi_relevant
union all
select x.member_id, x.day, 'dm_beantwortet'::crm.metric, 1, 'ereignis', 'tag'
  from (select distinct on (a.lead_id) coalesce(a.member_id, l.owner_id) as member_id, crm.berlin_date(a.occurred_at) as day
          from crm.activities a join crm.leads l on l.id = a.lead_id
         where a.type in ('nachricht_erhalten') and a.kpi_relevant
         order by a.lead_id, a.occurred_at) x
union all
select x.member_id, x.day, 'erstgespraech_gepitcht'::crm.metric, 1, 'ereignis', 'tag'
  from (select distinct on (a.lead_id) coalesce(a.member_id, l.owner_id) as member_id, crm.berlin_date(a.occurred_at) as day
          from crm.activities a join crm.leads l on l.id = a.lead_id
         where a.type = 'pitch_gesendet' and a.kpi_relevant
         order by a.lead_id, a.occurred_at) x
union all
select coalesce(m.member_id, l.owner_id), crm.berlin_date(m.booked_at), 'erstgespraeche_vereinbart'::crm.metric, 1, 'ereignis', 'tag'
  from crm.meetings m join crm.leads l on l.id = m.lead_id where m.type = 'erstgespraech' and m.status <> 'verschoben'
union all
select coalesce(m.member_id, l.owner_id), crm.berlin_date(m.scheduled_at),
       case m.type when 'erstgespraech' then 'erstgespraeche'::crm.metric else 'strategiegespraeche'::crm.metric end, 1, 'ereignis', 'tag'
  from crm.meetings m join crm.leads l on l.id = m.lead_id where m.status = 'stattgefunden' and m.type in ('erstgespraech', 'strategiegespraech')
union all
select coalesce(m.member_id, l.owner_id), crm.berlin_date(m.scheduled_at),
       case when m.type = 'erstgespraech' and m.status = 'no_show' then 'erstgespraech_no_show'::crm.metric
            when m.type = 'erstgespraech' then 'erstgespraech_abgesagt'::crm.metric
            when m.status = 'no_show' then 'strategiegespraech_no_show'::crm.metric
            else 'strategiegespraech_abgesagt'::crm.metric end, 1, 'ereignis', 'tag'
  from crm.meetings m join crm.leads l on l.id = m.lead_id where m.status in ('no_show', 'abgesagt') and m.type in ('erstgespraech', 'strategiegespraech')
union all
select coalesce(a.member_id, l.owner_id), crm.berlin_date(a.occurred_at), 'kunden_gewonnen'::crm.metric, 1, 'ereignis', 'tag'
  from crm.activities a join crm.leads l on l.id = a.lead_id where a.type = 'stage_wechsel' and a.metadata->>'to' = 'kunde'
union all
select c.member_id, crm.berlin_date(c.started_at), 'anrufe'::crm.metric, 1, 'ereignis', 'tag'
  from crm.calls c where c.direction = 'out' and c.kpi_relevant and not c.corrected
union all
select c.member_id, crm.berlin_date(c.started_at), 'anrufe_erreicht'::crm.metric, 1, 'ereignis', 'tag'
  from crm.calls c join crm.call_outcome_defs d on d.outcome = c.outcome where c.direction = 'out' and c.kpi_relevant and not c.corrected and d.is_connect
union all
select c.member_id, crm.berlin_date(c.started_at), 'entscheider_gespraeche'::crm.metric, 1, 'ereignis', 'tag'
  from crm.calls c join crm.call_outcome_defs d on d.outcome = c.outcome where c.direction = 'out' and c.kpi_relevant and not c.corrected and d.is_dm
union all
select c.member_id, crm.berlin_date(c.started_at), 'termine_telefon'::crm.metric, 1, 'ereignis', 'tag'
  from crm.calls c where c.kpi_relevant and not c.corrected and c.outcome = 'meeting_booked'
union all
select e.member_id, crm.berlin_date(e.sent_at), 'emails_gesendet'::crm.metric, 1, 'ereignis', 'tag'
  from crm.emails e where e.direction = 'out' and e.sent_at is not null and e.status in ('sent', 'sent_confirmed', 'delivered', 'replied')
union all
-- Migration 14: Strategiegespräch vereinbart (Buchungstag, ohne verschobene – wie „EG vereinbart“)
select coalesce(m.member_id, l.owner_id), crm.berlin_date(m.booked_at), 'strategiegespraeche_vereinbart'::crm.metric, 1, 'ereignis', 'tag'
  from crm.meetings m join crm.leads l on l.id = m.lead_id where m.type = 'strategiegespraech' and m.status <> 'verschoben';
comment on view crm.v_metric_events is 'Alle KPI-Ereignisse und Zähler als Einzelzeilen (member, Tag, Kennzahl, Wert). Monats- und Tagesansichten summieren hierüber.';
