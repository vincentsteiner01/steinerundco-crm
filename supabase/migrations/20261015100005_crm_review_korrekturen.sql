-- Migration 5 · Review-Korrekturen (15.10.2026)
-- Nr. 18: complete_step schreibt bei E-Mail-Schritten keinen zweiten email_gesendet-Beleg, wenn emails_after_write
--         ihn für dieselbe Sequenz und denselben Schritt bereits geschrieben hat (Timeline, KPIs, v_template_performance).
-- Nr. 19: undo_activity findet die im selben Moment gestarteten Enrollments über created_at statt started_at –
--         bei „Angenommen am <vergangenes Datum>“ liegt started_at in der Vergangenheit, das Undo ließ die Sequenz laufen.
-- Idempotent (create or replace), Signaturen unverändert.

CREATE OR REPLACE FUNCTION crm.complete_step(p_enrollment_id uuid, p_outcome crm.step_outcome DEFAULT 'gesendet'::crm.step_outcome, p_note text DEFAULT NULL::text, p_occurred_at timestamp with time zone DEFAULT now(), p_template_id uuid DEFAULT NULL::uuid)
 RETURNS crm.enrollments
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare e crm.enrollments; s crm.sequence_steps; seq crm.sequences; v_me uuid; v_type crm.activity_type; v_phase crm.template_phase; v_tpl uuid;
begin
  select * into e from crm.enrollments where id = p_enrollment_id for update;
  if not found then raise exception 'Enrollment % nicht gefunden', p_enrollment_id; end if;
  if e.status not in ('aktiv', 'pausiert') then raise exception 'Sequenz ist nicht aktiv (Status %)', e.status; end if;
  select * into seq from crm.sequences where id = e.sequence_id;
  select * into s from crm.sequence_steps where id = e.current_step_id;
  v_me := coalesce(auth.uid(), e.member_id);
  v_tpl := coalesce(p_template_id, s.template_id);

  if p_outcome = 'antwort_erhalten' then
    perform crm.log_reply(e.lead_id, seq.channel, null, p_note, p_occurred_at);   -- stoppt die Sequenz über den Trigger
    select * into e from crm.enrollments where id = p_enrollment_id;
    return e;
  end if;

  if p_outcome = 'abgebrochen' then
    update crm.enrollments set status = 'gestoppt', stopped_reason = 'manuell', note = coalesce(p_note, note) where id = e.id returning * into e;
    return e;
  end if;

  if p_outcome = 'gesendet' then
    select phase into v_phase from crm.templates where id = v_tpl;
    v_type := case coalesce(s.kind, 'nachricht')
                when 'nachricht' then case when s.is_opener then 'gespraech_eroeffnet'::crm.activity_type
                                           when v_phase = 'pitch' then 'pitch_gesendet'::crm.activity_type
                                           else 'nachricht_gesendet'::crm.activity_type end
                when 'email' then 'email_gesendet'::crm.activity_type
                when 'anruf' then 'anruf'::crm.activity_type
                else 'aufgabe_erledigt'::crm.activity_type end;
    -- Review Nr. 18: E-Mail-Schritte belegt emails_after_write bereits (email_gesendet mit email_id, enrollment_id, step_id).
    -- Dann keinen zweiten Beleg schreiben, nur weiterschalten.
    if v_type = 'email_gesendet' and exists (select 1 from crm.activities x where x.enrollment_id = e.id and x.step_id = s.id
                                                   and x.type = 'email_gesendet' and x.email_id is not null) then
      null;
    else
    perform crm.log_activity(e.lead_id, v_me, coalesce(s.channel, seq.channel), v_type, p_occurred_at, v_tpl, 'gesendet', p_note,
                             jsonb_build_object('step', s.name, 'position', s.position, 'sequence', seq.key,
                                                'prev_next_due_at', e.next_due_at, 'prev_snooze_count', e.snooze_count, 'prev_last_step_at', e.last_step_at,
                                                'prev_stage', (select stage from crm.leads where id = e.lead_id), 'prev_status', e.status), e.id, s.id);
    end if;
  else
    perform crm.log_activity(e.lead_id, v_me, coalesce(s.channel, seq.channel), 'schritt_uebersprungen', p_occurred_at, v_tpl, 'uebersprungen', p_note,
                             jsonb_build_object('step', s.name, 'position', s.position, 'sequence', seq.key,
                                                'prev_next_due_at', e.next_due_at, 'prev_snooze_count', e.snooze_count, 'prev_last_step_at', e.last_step_at,
                                                'prev_stage', (select stage from crm.leads where id = e.lead_id), 'prev_status', e.status), e.id, s.id);
  end if;

  return crm.advance_enrollment(e.id, p_occurred_at, p_outcome = 'gesendet');
end;
$function$;

CREATE OR REPLACE FUNCTION crm.undo_activity(p_activity_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare a crm.activities; v_restored text[] := '{}'; v_from crm.lead_stage; v_pos int; r record;
begin
  select * into a from crm.activities where id = p_activity_id;
  if not found then raise exception 'Aktivität % nicht gefunden', p_activity_id; end if;
  if a.member_id is distinct from auth.uid() then raise exception 'Nur eigene Aktionen lassen sich rückgängig machen'; end if;
  if a.created_at < now() - interval '10 minutes' then raise exception 'Rückgängig ist nur zehn Minuten lang möglich'; end if;
  -- Liste wie Policy Nr. 5 OHNE sequenz_gestartet (nur als Mitläufer löschbar, nie als Einstieg; § 1.5 Nr. 43);
  -- sonst würde das abschließende delete unter RLS still 0 Zeilen treffen
  if a.type not in ('notiz', 'stage_wechsel', 'uebergabe', 'freigabe', 'vernetzung_gesendet', 'vernetzung_angenommen', 'vernetzung_zurueckgezogen',
                    'nachricht_erhalten', 'email_erhalten', 'schritt_verschoben', 'schritt_uebersprungen', 'aufgabe_erledigt',
                    'gespraech_eroeffnet', 'nachricht_gesendet', 'pitch_gesendet') then
    raise exception 'Diese Aktion (%) ist ein Beleg und lässt sich nicht rückgängig machen', a.type; end if;
  perform set_config('crm.undo_mode', 'on', true);

  -- Review Nr. 19: Enrollments desselben Moments über created_at (started_at folgt bei Annahmen dem Annahmedatum)
  case
    -- Schritt erledigt/übersprungen → Enrollment auf den Schritt zurück (email_gesendet ist Beleg, nie hier)
    when a.type in ('gespraech_eroeffnet', 'nachricht_gesendet', 'pitch_gesendet', 'schritt_uebersprungen') and a.enrollment_id is not null then
      select position into v_pos from crm.sequence_steps where id = a.step_id;
      update crm.enrollments set status = coalesce((a.metadata->>'prev_status')::crm.enrollment_status, 'aktiv'), current_step_id = a.step_id, current_position = v_pos,
             next_due_at = coalesce((a.metadata->>'prev_next_due_at')::timestamptz, now()), completed_at = null,
             last_step_at = (a.metadata->>'prev_last_step_at')::timestamptz, snooze_count = coalesce((a.metadata->>'prev_snooze_count')::int, 0)
       where id = a.enrollment_id;
      if a.type = 'nachricht_gesendet' and a.channel = 'linkedin' then
        update crm.leads set follow_up_count = greatest(follow_up_count - 1, 0) where id = a.lead_id; end if;
      -- vom Trigger im selben Moment geschriebene stage_wechsel-Zeile entfernen, dann Stufe zurück
      for r in select * from crm.activities x where x.lead_id = a.lead_id and x.type = 'stage_wechsel' and x.created_at between a.created_at - interval '2 seconds' and a.created_at + interval '2 seconds' loop
        delete from crm.activities where id = r.id; end loop;
      if a.metadata ? 'prev_stage' then
        update crm.leads set stage = (a.metadata->>'prev_stage')::crm.lead_stage where id = a.lead_id and stage <> (a.metadata->>'prev_stage')::crm.lead_stage; end if;
      v_restored := array['enrollment', 'stage'];
    -- Nachricht/Pitch außerhalb einer Sequenz (log_outbound, § 1.5 Nr. 25) → Stufe und Antwort-Flag zurück,
    -- in demselben Moment gestartete Sequenz C bzw. Wiedervorlage (set_wiedervorlage) entfernen
    when a.type in ('nachricht_gesendet', 'pitch_gesendet') and a.enrollment_id is null then
      for r in select * from crm.activities x where x.lead_id = a.lead_id and x.type = 'stage_wechsel' and x.created_at between a.created_at - interval '2 seconds' and a.created_at + interval '5 seconds' loop
        delete from crm.activities where id = r.id; end loop;
      delete from crm.enrollments where lead_id = a.lead_id and source = 'app' and created_at between a.created_at - interval '2 seconds' and a.created_at + interval '5 seconds';
      -- die vom Enrollment-Trigger geschriebene „Sequenz C gestartet“-Zeile desselben Moments entfernen (§ 1.5 Nr. 43)
      delete from crm.activities x where x.lead_id = a.lead_id and x.type = 'sequenz_gestartet'
         and x.created_at between a.created_at - interval '2 seconds' and a.created_at + interval '5 seconds';
      delete from crm.tasks where lead_id = a.lead_id and kind = 'wiedervorlage' and status = 'offen' and created_at between a.created_at - interval '2 seconds' and a.created_at + interval '5 seconds';
      -- (die durch die Antwort gestoppten Sequenzen bleiben gestoppt – das Undo betrifft nur das Senden)
      update crm.leads set stage = coalesce((a.metadata->>'prev_stage')::crm.lead_stage, stage),
                           inbound_unanswered_since = (a.metadata->>'prev_inbound_unanswered_since')::timestamptz
       where id = a.lead_id;
      v_restored := array['stage', 'inbound', 'enrollment', 'task'];
    -- Schritt verschoben → Fälligkeit zurück
    when a.type = 'schritt_verschoben' and a.enrollment_id is not null then
      update crm.enrollments set next_due_at = coalesce((a.metadata->>'prev_next_due_at')::timestamptz, next_due_at), snooze_count = greatest(snooze_count - 1, 0)
       where id = a.enrollment_id and status = 'aktiv';
      v_restored := array['enrollment'];
    -- Aufgabe erledigt → wieder offen
    when a.type = 'aufgabe_erledigt' and a.task_id is not null then
      update crm.tasks set status = 'offen', done_at = null where id = a.task_id; v_restored := array['task'];
    -- Stufenwechsel (Beenden, Phase per Tabelle/Pipeline, Wiedervorlage) → alte Stufe, gestoppte Sequenzen/Aufgaben des Moments zurück
    when a.type = 'stage_wechsel' then
      v_from := (a.metadata->>'from')::crm.lead_stage;
      -- Stufe UND Beendet-Felder UND stage_changed_at zurück (§ 1.5 Nr. 43; leads_before_write lässt das im Undo-Modus zu, Nr. 3c)
      update crm.leads
         set stage = v_from,
             ended_reason = case when v_from = 'beendet' then coalesce((a.metadata->>'prev_ended_reason')::crm.ended_reason, ended_reason) else null end,
             ended_at = case when v_from = 'beendet' then coalesce((a.metadata->>'prev_ended_at')::timestamptz, ended_at) else null end,
             ended_note = case when v_from = 'beendet' then coalesce(a.metadata->>'prev_ended_note', ended_note) else null end,
             stage_changed_at = coalesce((a.metadata->>'prev_stage_changed_at')::timestamptz, stage_changed_at)
       where id = a.lead_id;
      update crm.enrollments set status = 'aktiv', stopped_at = null, stopped_reason = null
       where lead_id = a.lead_id and status = 'gestoppt' and stopped_reason = 'lead_beendet' and stopped_at between a.created_at - interval '2 seconds' and a.created_at + interval '2 seconds' and next_due_at is not null;
      update crm.tasks set status = 'offen' where lead_id = a.lead_id and status = 'abgebrochen' and updated_at between a.created_at - interval '2 seconds' and a.created_at + interval '2 seconds';
      -- Wiedervorlage-Aufgabe desselben Moments entfernen
      delete from crm.tasks where lead_id = a.lead_id and kind = 'wiedervorlage' and status = 'offen' and created_at between a.created_at - interval '2 seconds' and a.created_at + interval '2 seconds';
      v_restored := array['stage', 'enrollments', 'tasks'];
    -- Übergabe/Freigabe → Zuständigkeit zurück; leads_after_update schreibt im Undo-Modus keine zweite uebergabe/freigabe-Zeile (Nr. 3b),
    -- hängt Enrollments/Aufgaben aber auf den wiederhergestellten owner um. Freigabe: von release_lead pausierte Sequenzen wieder aktiv.
    when a.type in ('uebergabe', 'freigabe') then
      update crm.leads set owner_id = nullif(a.metadata->>'from', '')::uuid, released = (a.type = 'uebergabe' and (a.metadata->>'from') is null), released_reason = null where id = a.lead_id;
      if a.type = 'freigabe' then
        update crm.enrollments set status = 'aktiv'
         where lead_id = a.lead_id and status = 'pausiert' and next_due_at is not null
           and updated_at between a.created_at - interval '2 seconds' and a.created_at + interval '2 seconds';
      end if;
      v_restored := array['owner', 'enrollments'];
    -- Annahme prüfen X / Zurückziehen E → Vernetzung wieder ausstehend (§ 1.5 Nr. 34)
    when a.type = 'vernetzung_zurueckgezogen' then
      update crm.linkedin_connections set status = 'ausstehend', withdrawn_at = null, note = null
       where lead_id = a.lead_id and member_id = a.member_id and status = 'zurueckgezogen';
      v_restored := array['connection'];
    -- Annahme abgehakt → Vernetzung zurück auf ausstehend, Auto-Sequenz entfernen
    when a.type = 'vernetzung_angenommen' then
      update crm.linkedin_connections set accepted_at = null, status = 'ausstehend' where lead_id = a.lead_id and member_id = a.member_id;
      delete from crm.enrollments where lead_id = a.lead_id and source = 'app' and created_at between a.created_at - interval '2 seconds' and a.created_at + interval '2 seconds';
      -- Auto-Sequenz-Beleg „Sequenz A/B gestartet“ desselben Moments entfernen (§ 1.5 Nr. 43)
      delete from crm.activities x where x.lead_id = a.lead_id and x.type = 'sequenz_gestartet'
         and x.created_at between a.created_at - interval '2 seconds' and a.created_at + interval '2 seconds';
      for r in select * from crm.activities x where x.lead_id = a.lead_id and x.type = 'stage_wechsel' and x.created_at between a.created_at - interval '2 seconds' and a.created_at + interval '2 seconds' loop
        update crm.leads set stage = (r.metadata->>'from')::crm.lead_stage where id = a.lead_id; delete from crm.activities where id = r.id; end loop;
      v_restored := array['connection', 'enrollment', 'stage'];
    -- Anfrage gesendet (Neue Anfragen E) → Vernetzung löschen (Zähler −1 per Trigger), Stufe zurück
    when a.type = 'vernetzung_gesendet' then
      delete from crm.linkedin_connections where lead_id = a.lead_id and member_id = a.member_id and accepted_at is null;
      for r in select * from crm.activities x where x.lead_id = a.lead_id and x.type = 'stage_wechsel' and x.created_at between a.created_at - interval '2 seconds' and a.created_at + interval '2 seconds' loop
        update crm.leads set stage = (r.metadata->>'from')::crm.lead_stage where id = a.lead_id; delete from crm.activities where id = r.id; end loop;
      v_restored := array['connection', 'stage'];
    -- Antwort erhalten → Aktivität weg, gestoppte Sequenzen zurück, Antwort-Flag löschen
    when a.type in ('nachricht_erhalten', 'email_erhalten') then
      update crm.enrollments set status = 'aktiv', stopped_at = null, stopped_reason = null
       where lead_id = a.lead_id and status = 'gestoppt' and stopped_reason = 'antwort_erhalten' and stopped_at between a.created_at - interval '2 seconds' and a.created_at + interval '2 seconds' and next_due_at is not null;
      update crm.leads set inbound_unanswered_since = null where id = a.lead_id and inbound_unanswered_since = a.occurred_at;
      for r in select * from crm.activities x where x.lead_id = a.lead_id and x.type = 'stage_wechsel' and x.created_at between a.created_at - interval '2 seconds' and a.created_at + interval '2 seconds' loop
        update crm.leads set stage = (r.metadata->>'from')::crm.lead_stage where id = a.lead_id; delete from crm.activities where id = r.id; end loop;
      delete from crm.tasks where lead_id = a.lead_id and kind = 'wiedervorlage' and status = 'offen' and created_at between a.created_at - interval '2 seconds' and a.created_at + interval '2 seconds';
      v_restored := array['enrollments', 'stage', 'inbound'];
    when a.type = 'notiz' then v_restored := array['notiz'];
    else raise exception 'Diese Aktion (%) lässt sich nicht rückgängig machen', a.type;
  end case;

  delete from crm.activities where id = a.id;
  perform crm.recompute_lead_next_action(a.lead_id);
  return jsonb_build_object('activity_id', p_activity_id, 'type', a.type, 'restored', to_jsonb(v_restored));
end; $function$;
