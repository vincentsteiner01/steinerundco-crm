-- =====================================================================================================
-- CRM Steiner & Co. · Migration 8 · Runde 3 – „Letzte Bewegung“ nur aus echten Kontakten, idempotent, additiv.
-- Stand: 2026-10-15
--
-- Befund (QA Runde 3, echte Daten): „Letzte Bewegung“ zeigte bei allen 216 Leads „Do 15.10.“. Ursache: activities_after_insert
-- setzte leads.last_activity_at bei JEDER Aktivität – auch bei System-Einträgen. Der Sheet-Import schreibt je Lead
--   · „angelegt“ (Trigger leads_after_insert, occurred_at = erstes Sheet-Datum 09:00, source import_sheet) und
--   · „import“ (import_sheet_leads Abschnitt 16, occurred_at = now() = Zeitpunkt des Imports, 15.10. 01:31, mit Sheet-Metadaten).
-- Die „import“-Zeile hob last_activity_at aller Leads auf den Importzeitpunkt und überdeckte die echte letzte Bewegung.
-- Beide Zeilen sind echte Belege und bleiben stehen; die Timeline blendet die technische „import“-Zeile aus, wenn derselbe Lead
-- eine „angelegt“-Zeile aus dem Sheet hat (Client: src/data/activities.ts ohneDoppeltenImport).
--
-- Neu:
--   1. crm.ist_kontakt(activity_type) – Kontakt-Ereignisse: vernetzung_*, gespraech_eroeffnet, nachricht_*, pitch_gesendet, anruf,
--      email_*, meeting_*. Nur sie zählen als „Bewegung“. System-Einträge (angelegt, import, stage_wechsel, sequenz_*, schritt_*,
--      notiz, uebergabe, freigabe, aufgabe_erledigt, einwilligung, widerspruch) lassen last_activity_at stehen.
--   2. crm.activities_after_insert – wie Migration 1, nur last_activity_at/last_activity_type ausschließlich bei Kontakten.
--   3. crm.lead_spiegel_berechnen(lead_id) + Trigger activities_after_delete – nach dem Löschen einer Kontakt-Aktivität
--      (Rückgängig, undo_activity) werden last_activity_*, last_outbound_at, last_inbound_at, last_inbound_channel aus den
--      verbliebenen Aktivitäten neu berechnet (vorher blieb z. B. eine zurückgenommene Nachricht „letzte Bewegung“).
--   4. Einmalige Neuberechnung von last_activity_at/last_activity_type für alle Leads aus den Kontakt-Aktivitäten
--      (historische Sheet-Daten bleiben, weil die Import-Aktivitäten rückdatiert sind).
--   5. crm.v_leads_ohne_bewegung – Leads ohne jeden Kontakt zählen ab created_at (vorher hielt „angelegt“ das Feld gefüllt).
-- Prüfung: supabase/tests/runde3.sql
-- =====================================================================================================

-- 1. Kontakt-Ereignisse -------------------------------------------------------------------------------------------------
create or replace function crm.ist_kontakt(p_type crm.activity_type) returns boolean
language sql immutable parallel safe set search_path = '' as $$
  select p_type in ('vernetzung_gesendet', 'vernetzung_angenommen', 'vernetzung_zurueckgezogen', 'vernetzung_abgelaufen',
                    'gespraech_eroeffnet', 'nachricht_gesendet', 'nachricht_erhalten', 'pitch_gesendet', 'anruf',
                    'email_gesendet', 'email_erhalten',
                    'meeting_geplant', 'meeting_stattgefunden', 'meeting_no_show', 'meeting_abgesagt', 'meeting_verschoben')
$$;
comment on function crm.ist_kontakt(crm.activity_type) is
  'Kontakt-Ereignis („Letzte Bewegung“): vernetzung_*, gespraech_eroeffnet, nachricht_*, pitch_gesendet, anruf, email_*, meeting_*. System-Einträge zählen nicht.';
grant execute on function crm.ist_kontakt(crm.activity_type) to authenticated, service_role;

-- 2. Spiegelfelder beim Einfügen – unverändert bis auf last_activity_* (nur Kontakte) ----------------------------------
create or replace function crm.activities_after_insert() returns trigger
language plpgsql set search_path = '' as $$
declare v_inbound boolean; v_outbound boolean; v_kontakt boolean;
begin
  v_inbound  := new.type in ('nachricht_erhalten', 'email_erhalten');
  v_outbound := new.type in ('gespraech_eroeffnet', 'nachricht_gesendet', 'pitch_gesendet', 'email_gesendet', 'anruf', 'vernetzung_gesendet');
  v_kontakt  := crm.ist_kontakt(new.type);

  update crm.leads set
      last_activity_at   = case when v_kontakt then greatest(coalesce(last_activity_at, new.occurred_at), new.occurred_at) else last_activity_at end,
      last_activity_type = case when v_kontakt and new.occurred_at >= coalesce(last_activity_at, new.occurred_at) then new.type else last_activity_type end,
      last_outbound_at   = case when v_outbound then greatest(coalesce(last_outbound_at, new.occurred_at), new.occurred_at) else last_outbound_at end,
      last_inbound_at    = case when v_inbound then greatest(coalesce(last_inbound_at, new.occurred_at), new.occurred_at) else last_inbound_at end,
      last_inbound_channel = case when v_inbound then new.channel else last_inbound_channel end,
      inbound_unanswered_since = case when v_inbound then coalesce(inbound_unanswered_since, new.occurred_at)
                                      when v_outbound and new.type <> 'vernetzung_gesendet' then null
                                      else inbound_unanswered_since end,
      follow_up_count    = follow_up_count + case when new.type = 'nachricht_gesendet' and new.channel = 'linkedin' and new.enrollment_id is not null then 1 else 0 end,
      url_verified       = url_verified or new.type in ('vernetzung_gesendet', 'gespraech_eroeffnet', 'nachricht_gesendet')
   where id = new.lead_id;

  -- Exit-Regel: jede eingehende Nachricht stoppt alle Sequenzen und hebt den Lead auf „Antwort erhalten“
  if v_inbound then
    perform crm.stop_enrollments(new.lead_id, 'antwort_erhalten');
    perform crm.raise_stage(new.lead_id, 'dm_beantwortet', new.member_id);
  end if;
  if new.type = 'pitch_gesendet' then perform crm.raise_stage(new.lead_id, 'pitch', new.member_id); end if;
  if new.type = 'gespraech_eroeffnet' then perform crm.raise_stage(new.lead_id, 'gespraech_eroeffnet', new.member_id); end if;
  return new;
end;
$$;

-- 3. Spiegelfelder aus den vorhandenen Aktivitäten neu berechnen (nach Löschen, für die Neuberechnung unten) -------------
create or replace function crm.lead_spiegel_berechnen(p_lead_id uuid) returns void
language plpgsql set search_path = '' as $$
declare k record; o timestamptz; i record;
begin
  select a.occurred_at, a.type into k from crm.activities a
   where a.lead_id = p_lead_id and crm.ist_kontakt(a.type) order by a.occurred_at desc, a.id desc limit 1;
  select max(a.occurred_at) into o from crm.activities a
   where a.lead_id = p_lead_id and a.type in ('gespraech_eroeffnet', 'nachricht_gesendet', 'pitch_gesendet', 'email_gesendet', 'anruf', 'vernetzung_gesendet');
  select a.occurred_at, a.channel into i from crm.activities a
   where a.lead_id = p_lead_id and a.type in ('nachricht_erhalten', 'email_erhalten') order by a.occurred_at desc, a.id desc limit 1;
  update crm.leads l
     set last_activity_at = k.occurred_at, last_activity_type = k.type,
         last_outbound_at = o, last_inbound_at = i.occurred_at, last_inbound_channel = i.channel
   where l.id = p_lead_id
     and (l.last_activity_at is distinct from k.occurred_at or l.last_activity_type is distinct from k.type
          or l.last_outbound_at is distinct from o or l.last_inbound_at is distinct from i.occurred_at
          or l.last_inbound_channel is distinct from i.channel);
end;
$$;
comment on function crm.lead_spiegel_berechnen(uuid) is
  'Berechnet leads.last_activity_at/_type (nur Kontakte), last_outbound_at, last_inbound_at, last_inbound_channel aus crm.activities neu; schreibt nur bei Abweichung.';
revoke all on function crm.lead_spiegel_berechnen(uuid) from public, anon;
grant execute on function crm.lead_spiegel_berechnen(uuid) to authenticated, service_role;

create or replace function crm.activities_after_delete() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Nur Kontakte bewegen die Spiegelfelder; der Lead selbst kann im selben Statement gelöscht sein (dann trifft das Update nichts)
  if crm.ist_kontakt(old.type) then perform crm.lead_spiegel_berechnen(old.lead_id); end if;
  return old;
end;
$$;
create or replace trigger activities_after_delete after delete on crm.activities
  for each row execute function crm.activities_after_delete();

-- 4. Einmalige Neuberechnung: letzte Bewegung = jüngster Kontakt (historische Sheet-Daten bleiben erhalten) ------------
with kontakt as (
  select distinct on (a.lead_id) a.lead_id, a.occurred_at, a.type
    from crm.activities a
   where crm.ist_kontakt(a.type)
   order by a.lead_id, a.occurred_at desc, a.id desc)
update crm.leads l
   set last_activity_at = k.occurred_at, last_activity_type = k.type
  from crm.leads l0
  left join kontakt k on k.lead_id = l0.id
 where l.id = l0.id
   and (l.last_activity_at is distinct from k.occurred_at or l.last_activity_type is distinct from k.type);

-- 5. „Ohne Bewegung“ – Leads ohne jeden Kontakt zählen ab Anlage (Spalten unverändert) ------------------------------------
create or replace view crm.v_leads_ohne_bewegung with (security_invoker = true) as
select l.id as lead_id, l.full_name, l.company_name, l.stage, l.owner_id, l.last_activity_at,
       (select count(*) from generate_series(crm.berlin_date(coalesce(l.last_activity_at, l.created_at)), crm.today() - 1, interval '1 day') d
         where extract(isodow from d) < 6 and not crm.is_holiday(d::date))::int as tage_ohne_bewegung
  from crm.leads l
 where l.deleted_at is null and l.stage in ('dm_beantwortet', 'bedarfsermittlung', 'pitch')
   and not exists (select 1 from crm.enrollments e where e.lead_id = l.id and e.status = 'aktiv')
   and coalesce(l.last_activity_at, l.created_at) < now() - interval '5 days';
comment on view crm.v_leads_ohne_bewegung is 'Leads in Beantwortet/Gepitcht ohne Kontakt seit ≥ 5 Werktagen (ohne Kontakt: seit Anlage) und ohne aktive Sequenz (ux § 4.5, Migration 8).';

notify pgrst, 'reload schema';
