-- =====================================================================================================
-- CRM Steiner & Co. · Migration 9 · Feedback ca8111ad – überholte Termine schließen, idempotent.
-- Stand: 2026-10-17
--
-- Befund (Vincent, Pipeline): Lead im Strategiegespräch zeigte als nächsten Schritt „Erstgespräch · 07.10. (−9 T)“.
-- Ursache: Das Erstgespräch kam per Sheet-Import als „geplant“; beim Buchen des Strategiegesprächs blieb es offen, und
-- recompute_lead_next_action nimmt den frühesten offenen Termin.
--
-- Neu:
--   1. crm.meeting_rang(type) – Erstgespräch 1 · Strategiegespräch 2 · Folgegespräch 3.
--   2. crm.meetings_after_write – wie Migration 1, plus:
--      a) Wird ein Termin gebucht, gelten vergangene, noch offene Termine niedrigeren Rangs desselben Leads als
--         stattgefunden (Notiz „Automatisch: … gebucht“). Das löst „meeting_stattgefunden“ mit dem alten Datum aus (KPI richtig).
--      b) Die E-Mail-Sequenz nach einem Termin startet nicht, wenn es schon einen Termin höheren Rangs gibt
--         (sonst bekäme ein Lead mit gebuchtem Strategiegespräch die Nachfass-Mails zum Erstgespräch).
--   3. Einmalige Bereinigung der bestehenden Fälle (Stand 17.10.: 1 Termin).
-- =====================================================================================================

-- 1. Rang -------------------------------------------------------------------------------------------------------------
create or replace function crm.meeting_rang(p_type crm.meeting_type) returns int
language sql immutable parallel safe set search_path = '' as $$
  select case p_type when 'erstgespraech' then 1 when 'strategiegespraech' then 2 else 3 end
$$;

-- 2. Trigger-Funktion -------------------------------------------------------------------------------------------------
create or replace function crm.meetings_after_write() returns trigger
language plpgsql set search_path = '' as $function$
declare v_member uuid := coalesce(auth.uid(), new.member_id); v_type_label text; v_auto boolean; v_spaeter boolean;
begin
  v_type_label := case new.type when 'erstgespraech' then 'Erstgespräch' when 'strategiegespraech' then 'Strategiegespräch' else 'Folgegespräch' end;

  if tg_op = 'INSERT' and new.status = 'geplant' then
    perform crm.log_activity(new.lead_id, v_member, 'sonstiges', 'meeting_geplant', new.booked_at, p_meeting_id => new.id,
                             p_metadata => jsonb_build_object('type', new.type, 'scheduled_at', new.scheduled_at), p_source => new.source);
    perform crm.raise_stage(new.lead_id, case new.type when 'erstgespraech' then 'erstgespraech_vereinbart'::crm.lead_stage
                                                        when 'strategiegespraech' then 'strategiegespraech_vereinbart'::crm.lead_stage
                                                        else 'sales_follow_up'::crm.lead_stage end, v_member);
    perform crm.stop_enrollments(new.lead_id, 'meeting_gebucht');
    update crm.leads set sales_owner_id = coalesce(sales_owner_id, new.member_id) where id = new.lead_id;
    -- 2a: überholte Termine (Feedback ca8111ad)
    update crm.meetings m
       set status = 'stattgefunden', outcome_note = coalesce(m.outcome_note, 'Automatisch: ' || v_type_label || ' gebucht')
     where m.lead_id = new.lead_id and m.id <> new.id and m.status = 'geplant'
       and crm.meeting_rang(m.type) < crm.meeting_rang(new.type)
       and m.scheduled_at <= now() and m.scheduled_at < new.scheduled_at;
  end if;

  if (tg_op = 'INSERT' and new.status <> 'geplant') or (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    if new.status = 'stattgefunden' then
      perform crm.log_activity(new.lead_id, v_member, 'sonstiges', 'meeting_stattgefunden', new.scheduled_at, p_meeting_id => new.id,
                               p_note => new.outcome_note, p_metadata => jsonb_build_object('type', new.type), p_source => new.source);
      perform crm.raise_stage(new.lead_id, case new.type when 'erstgespraech' then 'erstgespraech'::crm.lead_stage
                                                          when 'strategiegespraech' then 'strategiegespraech'::crm.lead_stage
                                                          else 'sales_follow_up'::crm.lead_stage end, v_member);
      if new.type in ('erstgespraech', 'strategiegespraech') then
        -- Nachbereitung per E-Mail ist Kommunikation auf Wunsch des Leads (research/email.md §1.4 Nr. 3)
        update crm.leads set email_consent_basis = 'meeting_held', email_consent_at = crm.berlin_date(new.scheduled_at),
                             email_consent_note = coalesce(email_consent_note, v_type_label || ' geführt'),
                             email_consent_ref = jsonb_build_object('meeting_id', new.id)
         where id = new.lead_id and email_consent_basis = 'none';
        v_auto := coalesce((crm.setting('email', case new.type when 'erstgespraech' then 'auto_enroll_after_erstgespraech'
                                                       else 'auto_enroll_after_strategiegespraech' end))::boolean, false);
        -- 2b: kein Nachfassen zu einem Termin, der schon von einem späteren überholt ist
        v_spaeter := exists (select 1 from crm.meetings m2
                              where m2.lead_id = new.lead_id and m2.id <> new.id and m2.status in ('geplant', 'stattgefunden')
                                and crm.meeting_rang(m2.type) > crm.meeting_rang(new.type));
        if v_auto and not v_spaeter and not crm.import_mode() then
          begin perform crm.enroll(new.lead_id, case new.type when 'erstgespraech' then 'email_warm_after_erstgespraech'
                                              else 'email_warm_after_strategiegespraech' end, new.member_id, new.scheduled_at);
          exception when others then raise notice 'E-Mail-Sequenz nicht gestartet: %', sqlerrm; end;
        end if;
      end if;
    elsif new.status = 'no_show' then
      perform crm.log_activity(new.lead_id, v_member, 'sonstiges', 'meeting_no_show', new.scheduled_at, p_meeting_id => new.id,
                               p_metadata => jsonb_build_object('type', new.type), p_source => new.source);
    elsif new.status = 'abgesagt' then
      perform crm.log_activity(new.lead_id, v_member, 'sonstiges', 'meeting_abgesagt', now(), p_meeting_id => new.id,
                               p_note => new.outcome_note, p_metadata => jsonb_build_object('type', new.type), p_source => new.source);
    elsif new.status = 'verschoben' then
      perform crm.log_activity(new.lead_id, v_member, 'sonstiges', 'meeting_verschoben', now(), p_meeting_id => new.id,
                               p_metadata => jsonb_build_object('type', new.type), p_source => new.source);
    end if;
  end if;
  perform crm.recompute_lead_next_action(new.lead_id);
  return new;
end;
$function$;

-- 3. Bestehende Fälle ---------------------------------------------------------------------------------------------------
update crm.meetings m
   set status = 'stattgefunden', outcome_note = coalesce(m.outcome_note, 'Automatisch: späterer Termin gebucht')
 where m.status = 'geplant' and m.scheduled_at <= now()
   and exists (select 1 from crm.meetings s
                where s.lead_id = m.lead_id and s.id <> m.id and s.status in ('geplant', 'stattgefunden')
                  and crm.meeting_rang(s.type) > crm.meeting_rang(m.type) and s.scheduled_at > m.scheduled_at);
