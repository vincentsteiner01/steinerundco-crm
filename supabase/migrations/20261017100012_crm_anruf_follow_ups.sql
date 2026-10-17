-- =====================================================================================================
-- CRM Steiner & Co. · Migration 12 · Feedback 886113f4 – Follow-ups nach Anrufen, idempotent.
-- Stand: 2026-10-17
--
-- Wunsch (Vincent): „Follow-ups gelten nicht nur für Nachrichten, sondern auch für Gespräche – Person ist nicht rangegangen,
-- nochmal terminieren.“ crm.log_call wie bisher (Live-Stand), zwei Ergänzungen:
--   1. Nicht erreicht · Mailbox · Mailbox mit Nachricht: Ist p_callback_at gesetzt („Nochmal anrufen am …“), gilt dieser
--      Zeitpunkt statt des Kadenz-Termins – für den nächsten Sequenzschritt bzw. die Rückruf-Wiederholung.
--   2. Besetzt: ohne laufende Telefon-Sequenz entsteht ein Rückruf (bisher keine Folgeaktion); p_callback_at wird übernommen.
-- =====================================================================================================

CREATE OR REPLACE FUNCTION crm.log_call(p_lead_id uuid, p_outcome crm.call_outcome, p_note text DEFAULT NULL::text, p_reached_person crm.reached_person DEFAULT NULL::crm.reached_person, p_reached_name text DEFAULT NULL::text, p_started_at timestamp with time zone DEFAULT now(), p_ended_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_duration_sec integer DEFAULT NULL::integer, p_callback_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_meeting_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_enrollment_id uuid DEFAULT NULL::uuid, p_task_id uuid DEFAULT NULL::uuid, p_template_id uuid DEFAULT NULL::uuid, p_from_number text DEFAULT NULL::text, p_to_number text DEFAULT NULL::text, p_direction crm.call_direction DEFAULT 'out'::crm.call_direction, p_ended_reason crm.ended_reason DEFAULT NULL::crm.ended_reason)
 RETURNS crm.calls
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_me uuid := auth.uid(); l crm.leads; c crm.calls; d crm.call_outcome_defs; e crm.enrollments; v_days int; v_auto boolean; v_enr uuid;
        v_task crm.tasks; v_retry int;
begin
  select * into l from crm.leads where id = p_lead_id;
  if not found then raise exception 'Lead % nicht gefunden', p_lead_id; end if;
  if l.do_not_contact and p_direction = 'out' then raise exception 'Lead hat widersprochen – kein Anruf erlaubt'; end if;
  select * into d from crm.call_outcome_defs where outcome = p_outcome;
  if p_task_id is not null then select * into v_task from crm.tasks where id = p_task_id; end if;
  v_me := coalesce(v_me, l.owner_id);

  v_enr := coalesce(p_enrollment_id, (select id from crm.enrollments where lead_id = p_lead_id and channel = 'telefon' and status in ('aktiv', 'pausiert') limit 1));

  insert into crm.calls (lead_id, member_id, direction, from_number, to_number, started_at, ended_at, duration_sec, outcome,
                         reached_person, reached_name, note, template_id, enrollment_id)
  values (p_lead_id, v_me, p_direction, coalesce(p_from_number, (select caller_number_e164 from crm.member_profiles where member_id = v_me)),
          coalesce(p_to_number, l.phone_e164), p_started_at, p_ended_at, p_duration_sec, p_outcome, p_reached_person, p_reached_name,
          p_note, p_template_id, v_enr)
  returning * into c;

  if p_task_id is not null then
    update crm.tasks set status = 'erledigt', done_at = now(), call_id = c.id where id = p_task_id and status = 'offen';
  end if;
  if p_reached_name is not null and p_reached_person = 'entscheider' and l.first_name is null then
    update crm.leads set notes = concat_ws(E'\n', notes, 'Gesprächspartner: ' || p_reached_name) where id = p_lead_id;
  end if;

  -- Folgeaktionen je Ergebnis (research/telefon.md §2.2)
  case p_outcome
    when 'busy' then
      if v_enr is not null then
        update crm.enrollments set status = 'aktiv', next_due_at = coalesce(p_callback_at, p_started_at + make_interval(mins => coalesce((crm.setting('telefon', 'busy_retry_minutes'))::int, 45))) where id = v_enr;
      else
        -- Feedback 886113f4: ohne Telefon-Sequenz blieb „Besetzt“ ohne Folgeaktion
        insert into crm.tasks (lead_id, member_id, kind, title, due_at, call_id, note, created_by)
        values (p_lead_id, v_me, 'rueckruf', 'Besetzt – erneut anrufen',
                coalesce(p_callback_at, p_started_at + make_interval(mins => coalesce((crm.setting('telefon', 'busy_retry_minutes'))::int, 45))),
                c.id, p_note, v_me);
      end if;
    when 'no_answer', 'voicemail', 'voicemail_left' then
      if v_task.id is not null and v_task.kind = 'rueckruf' then
        -- vereinbarter Rückruf nicht erreicht: +1 Kalendertag gerollt, dann +3, dann Telefon-Standard ab Versuch 3
        v_retry := case when v_task.title ~ 'Wiederholung 2' then 2 when v_task.title ~ 'Wiederholung 1' then 1 else 0 end;
        if v_retry < 2 then
          insert into crm.tasks (lead_id, member_id, kind, title, due_at, call_id, note, template_id, created_by)
          values (p_lead_id, v_me, 'rueckruf', 'Rückruf – nicht erreicht (Wiederholung ' || (v_retry + 1) || ')',
                  crm.next_due(p_started_at, case v_retry when 0 then 1 else 3 end, true) + interval '1 hour',
                  c.id, v_task.note, v_task.template_id, v_me);
        else
          if v_enr is not null then
            update crm.enrollments set status = 'gestoppt', stopped_at = now(), stopped_reason = 'ersetzt', note = 'Rückruf-Kadenz erschöpft' where id = v_enr;
          end if;
          begin perform crm.enroll(p_lead_id, coalesce(crm.setting('telefon', 'default_sequence') #>> '{}', 'telefon_standard'), v_me, p_started_at, 3);
          exception when others then raise notice 'Telefon-Sequenz nicht gestartet: %', sqlerrm; end;
        end if;
      elsif v_enr is not null then
        perform crm.advance_enrollment(v_enr, p_started_at, true);
      else
        v_auto := coalesce((crm.setting('telefon', 'auto_enroll_on_no_answer'))::boolean, true);
        if v_auto then
          begin perform crm.enroll(p_lead_id, coalesce(crm.setting('telefon', 'default_sequence') #>> '{}', 'telefon_standard'), v_me, p_started_at, 2);
          exception when others then raise notice 'Telefon-Sequenz nicht gestartet: %', sqlerrm; end;
        end if;
      end if;
      -- Feedback 886113f4: „Nochmal anrufen am …“ – gewählter Zeitpunkt statt Kadenz-Termin
      if p_callback_at is not null then
        update crm.tasks set due_at = p_callback_at where call_id = c.id and kind = 'rueckruf' and status = 'offen';
        update crm.enrollments set next_due_at = p_callback_at
         where lead_id = p_lead_id and channel = 'telefon' and status = 'aktiv';
      end if;
    when 'wrong_number' then
      insert into crm.tasks (lead_id, member_id, kind, title, due_at, call_id, created_by)
      values (p_lead_id, v_me, 'aufgabe', 'Telefonnummer recherchieren', crm.next_due(p_started_at, 1, true), c.id, v_me);
      if v_enr is not null then update crm.enrollments set status = 'pausiert' where id = v_enr; end if;
    when 'gatekeeper', 'callback_scheduled', 'dm_interest', 'send_info' then
      insert into crm.tasks (lead_id, member_id, kind, title, due_at, call_id, note, created_by)
      values (p_lead_id, v_me, 'rueckruf',
              case p_outcome when 'send_info' then 'Rückruf nach Kurzinfo-Mail' when 'dm_interest' then 'Rückruf – Interesse, Termin anbieten' else 'Rückruf' end,
              coalesce(p_callback_at, crm.next_due(p_started_at, case p_outcome when 'send_info' then 3 else 1 end, true) + interval '1 hour'),
              c.id, p_note, v_me);
      if p_outcome = 'send_info' then
        insert into crm.tasks (lead_id, member_id, kind, title, due_at, call_id, created_by)
        values (p_lead_id, v_me, 'aufgabe', 'Kurzinfo per E-Mail senden (Erlaubnis im Lead eintragen)', p_started_at + interval '2 hours', c.id, v_me);
      end if;
      if v_enr is not null then update crm.enrollments set status = 'pausiert' where id = v_enr; end if;
    when 'gatekeeper_blocked' then
      insert into crm.tasks (lead_id, member_id, kind, title, due_at, call_id, created_by)
      values (p_lead_id, v_me, 'aufgabe', 'Kurzinfo an Zentrale/Entscheider mailen, dann Wiedervorlage', crm.next_due(p_started_at, 3, true), c.id, v_me);
      if v_enr is not null then perform crm.advance_enrollment(v_enr, p_started_at, true); end if;
    when 'meeting_booked' then
      if p_meeting_at is null then raise exception 'Termin vereinbart braucht p_meeting_at'; end if;
      insert into crm.meetings (lead_id, member_id, type, scheduled_at, status, location)
      values (p_lead_id, v_me, case when l.stage in ('erstgespraech', 'strategiegespraech_vereinbart', 'strategiegespraech', 'sales_follow_up') then 'strategiegespraech'::crm.meeting_type else 'erstgespraech'::crm.meeting_type end,
              p_meeting_at, 'geplant', 'Telefon');
    when 'not_now' then
      v_days := coalesce((crm.setting('langfristig', 'nicht_erreicht_days'))::int, 90);
      perform crm.stop_enrollments(p_lead_id, 'manuell', 'telefon');
      perform crm.set_stage(p_lead_id, 'langfristig', v_me);
      insert into crm.tasks (lead_id, member_id, kind, title, due_at, call_id, note, created_by)
      values (p_lead_id, v_me, 'wiedervorlage', 'Wiedervorlage nach „kein Bedarf aktuell“', coalesce(p_callback_at, crm.next_due(p_started_at, v_days, true)), c.id, p_note, v_me);
    when 'not_interested' then
      perform crm.set_stage(p_lead_id, 'beendet', v_me, coalesce(p_ended_reason, 'kein_interesse'), p_note);
    when 'not_icp' then
      perform crm.set_stage(p_lead_id, 'beendet', v_me, coalesce(p_ended_reason, 'nicht_icp'), p_note);
    when 'do_not_call' then
      update crm.leads set do_not_contact = true, do_not_contact_channels = coalesce(do_not_contact_channels, array['telefon']::crm.channel[]),
                           objection_note = coalesce(p_note, objection_note), objection_at = p_started_at,
                           stage = 'beendet', ended_reason = 'widerspruch', ended_note = coalesce(p_note, ended_note)
       where id = p_lead_id;
    else null;
  end case;
  return c;
end;
$function$;
