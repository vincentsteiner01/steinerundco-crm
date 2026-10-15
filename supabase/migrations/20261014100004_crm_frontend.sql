-- =====================================================================================================
-- CRM Steiner & Co. · Migration 4 · Frontend-Ergänzungen = BAUPLAN § 4.4 (Nr. 1–17), idempotent.
-- Die Kommentarblöcke „M0 kopiert …“ sind unverändert aus dem BAUPLAN; direkt darunter steht jeweils die realisierte Kopie aus schema.sql.
-- =====================================================================================================

-- 1) Undo-Modus (unterdrückt stage_wechsel-Protokoll beim Zurücksetzen) + Hilfsfunktion
create or replace function crm.undo_mode() returns boolean language sql stable set search_path = '' as $$
  select coalesce(current_setting('crm.undo_mode', true), '') = 'on'; $$;

-- 2) stop_enrollments behält next_due_at (für Undo); Signatur unverändert
create or replace function crm.stop_enrollments(p_lead_id uuid, p_reason crm.stop_reason, p_channel crm.channel default null, p_note text default null)
returns int language plpgsql set search_path = '' as $$
declare n int;
begin
  update crm.enrollments set status = 'gestoppt', stopped_at = now(), stopped_reason = p_reason, note = coalesce(p_note, note)
   where lead_id = p_lead_id and status in ('aktiv', 'pausiert') and (p_channel is null or channel = p_channel);
  get diagnostics n = row_count; return n;
end; $$;

-- 2b) Konfliktentscheid M0 (BAUPLAN § 4.4 Nr. 2 + F-06 „Beenden → Sequenz wieder aktiv“ > schema.sql Zeile 1274): der Before-Trigger
--     nullte next_due_at auch bei 'gestoppt' und machte Nr. 2 wirkungslos (undo_activity verlangt next_due_at is not null).
--     Jetzt nur noch bei 'abgeschlossen'; alle Leser von next_due_at filtern status = 'aktiv' (Queue, next_action, Index, Check-Constraint).
create or replace function crm.enrollments_before_write() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.channel is null then select channel into new.channel from crm.sequences where id = new.sequence_id; end if;
  if new.status = 'abgeschlossen' then new.next_due_at := null; end if;
  if new.status = 'gestoppt' then new.stopped_at := coalesce(new.stopped_at, now()); end if;
  if new.status = 'abgeschlossen' then new.completed_at := coalesce(new.completed_at, now()); end if;
  return new;
end;
$$;

-- 3) leads_after_update: identischer Body wie Migration 1 mit genau drei Änderungen (§ 1.5 Nr. 29, 43):
--    a) erste Bedingung: if not crm.import_mode() and not crm.undo_mode() then … (stage_wechsel-Protokoll), und das
--       p_metadata dieses Aufrufs wird zu
--         jsonb_build_object('from', old.stage, 'to', new.stage, 'ended_reason', new.ended_reason,
--                            'prev_ended_reason', old.ended_reason, 'prev_ended_at', old.ended_at,
--                            'prev_ended_note', old.ended_note, 'prev_stage_changed_at', old.stage_changed_at)
--    b) Zuständigkeits-Zweig: die beiden log_activity-Aufrufe (freigabe / uebergabe) stehen jeweils in
--       if not crm.undo_mode() then … end if;  – das Umhängen von enrollments/tasks auf new.owner_id bleibt unbedingt.
--    → M0 kopiert den Funktionskörper aus schema.sql (Zeilen 1118–1175) und ändert genau diese Stellen.
-- 3c) leads_before_write: identischer Body wie schema.sql Zeilen 1056–1104 mit genau einer Änderung: die Bedingung
--       if not (crm.import_mode() and new.stage_changed_at is distinct from old.stage_changed_at) then
--     wird zu
--       if not ((crm.import_mode() or crm.undo_mode()) and new.stage_changed_at is distinct from old.stage_changed_at) then
--     (im Undo-Modus darf undo_activity das alte stage_changed_at zurückschreiben; der Rückweg nach 'beendet' bringt
--      ended_reason/ended_at/ended_note aus den prev_*-Schlüsseln mit, der Rückweg aus 'beendet' nullt sie wie bisher).

-- 3) realisiert (Kopie aus schema.sql mit den drei Änderungen a, b; 3c mit einer Änderung):
create or replace function crm.leads_after_update() returns trigger
language plpgsql set search_path = '' as $$
declare v_member uuid := auth.uid();
begin
  -- Stufenwechsel protokollieren (im Import-Modus schreibt der Import historisch datierte Einträge selbst);
  -- Beendet/Kunde stoppt Sequenzen und offene Aufgaben
  if new.stage is distinct from old.stage then
    if not crm.import_mode() and not crm.undo_mode() then
      perform crm.log_activity(new.id, v_member, 'sonstiges', 'stage_wechsel', now(),
        p_outcome => new.stage::text,
        p_note => case when new.stage = 'beendet' then new.ended_note end,
        p_metadata => jsonb_build_object('from', old.stage, 'to', new.stage, 'ended_reason', new.ended_reason,
                                         'prev_ended_reason', old.ended_reason, 'prev_ended_at', old.ended_at,
                                         'prev_ended_note', old.ended_note, 'prev_stage_changed_at', old.stage_changed_at));
    end if;
    if new.stage in ('beendet', 'kunde') then
      perform crm.stop_enrollments(new.id, 'lead_beendet');
      update crm.tasks set status = 'abgebrochen' where lead_id = new.id and status = 'offen';
      update crm.leads set inbound_unanswered_since = null where id = new.id and inbound_unanswered_since is not null;
    end if;
  end if;

  -- Zuständigkeit: Übergabe/Freigabe protokollieren, laufende Arbeit mitnehmen
  if new.owner_id is distinct from old.owner_id then
    if new.owner_id is null then
      if not crm.undo_mode() then
        perform crm.log_activity(new.id, v_member, 'sonstiges', 'freigabe', now(), p_note => new.released_reason,
                                 p_metadata => jsonb_build_object('from', old.owner_id));
      end if;
    else
      if not crm.undo_mode() then
        perform crm.log_activity(new.id, v_member, 'sonstiges', 'uebergabe', now(),
                                 p_metadata => jsonb_build_object('from', old.owner_id, 'to', new.owner_id));
      end if;
      update crm.enrollments set member_id = new.owner_id where lead_id = new.id and status in ('aktiv', 'pausiert');
      update crm.tasks set member_id = new.owner_id where lead_id = new.id and status = 'offen';
    end if;
  end if;

  -- Widerspruch: alles stoppen, Sperrliste füllen
  if new.do_not_contact and not old.do_not_contact then
    perform crm.log_activity(new.id, v_member, 'sonstiges', 'widerspruch', coalesce(new.objection_at, now()), p_note => new.objection_note,
                             p_metadata => jsonb_build_object('channels', new.do_not_contact_channels));
    perform crm.stop_enrollments(new.id, 'widerspruch');
    update crm.tasks set status = 'abgebrochen' where lead_id = new.id and status = 'offen';
    insert into crm.sperrliste (linkedin_url_norm, email, phone_e164, name, company, reason, channels, note, lead_id, created_by)
    values (new.linkedin_url_norm, new.email, new.phone_e164, new.full_name, new.company_name, 'widerspruch',
            coalesce(new.do_not_contact_channels, array['linkedin', 'telefon', 'email']::crm.channel[]), new.objection_note, new.id, v_member)
    on conflict do nothing;
  end if;

  -- Erlaubnis-Grundlage E-Mail: Änderung revisionssicher protokollieren
  if new.email_consent_basis is distinct from old.email_consent_basis or new.email_consent_at is distinct from old.email_consent_at then
    perform crm.log_activity(new.id, v_member, 'email', 'einwilligung',
                             case when crm.import_mode() and new.email_consent_at is not null then crm.due_on(new.email_consent_at) else now() end,
                             p_outcome => new.email_consent_basis::text,
                             p_note => new.email_consent_note,
                             p_metadata => jsonb_build_object('from', old.email_consent_basis, 'to', new.email_consent_basis,
                                                              'at', new.email_consent_at, 'ref', new.email_consent_ref));
  end if;
  return new;
end;
$$;

create or replace function crm.leads_before_write() returns trigger
language plpgsql set search_path = '' as $$
declare c crm.companies;
begin
  new.first_name := nullif(btrim(coalesce(new.first_name, '')), '');
  new.last_name  := nullif(btrim(coalesce(new.last_name, '')), '');
  new.email      := nullif(lower(btrim(coalesce(new.email, ''))), '');
  new.linkedin_url := nullif(btrim(coalesce(new.linkedin_url, '')), '');
  if new.phone_e164 is not null and new.phone_e164 !~ '^\+[0-9]{7,16}$' then
    new.phone_e164 := crm.normalize_phone(new.phone_e164);
  end if;
  if new.company_id is not null then
    select * into c from crm.companies where id = new.company_id;
    if found then new.company_name := c.name; end if;
  end if;
  new.company_name := nullif(btrim(coalesce(new.company_name, '')), '');

  if tg_op = 'INSERT' then
    if new.stage = 'beendet' then new.ended_at := coalesce(new.ended_at, now()); end if;
    new.created_by := coalesce(new.created_by, auth.uid());
  else
    if new.stage is distinct from old.stage then
      -- im Import-Modus darf ein historisches Datum mitgegeben werden
      if not ((crm.import_mode() or crm.undo_mode()) and new.stage_changed_at is distinct from old.stage_changed_at) then
        new.stage_changed_at := now();
      end if;
      if new.stage = 'beendet' then
        if new.ended_reason is null then raise exception 'Beenden braucht einen Grund (ended_reason)'; end if;
        new.ended_at := coalesce(new.ended_at, now());
      elsif old.stage = 'beendet' then
        new.ended_reason := null; new.ended_at := null; new.ended_note := null;
      end if;
    end if;
    if new.owner_id is distinct from old.owner_id and new.owner_id is not null then
      new.released := false;
    end if;
    if new.released and not old.released then
      new.released_at := coalesce(new.released_at, now());
      new.owner_id := null;
    end if;
    if new.do_not_contact and not old.do_not_contact then
      new.objection_at := coalesce(new.objection_at, now());
      new.email_consent_basis := 'revoked';
    end if;
  end if;
  return new;
end;
$$;

-- 4) complete_step / snooze_step: vor dem log_activity-Aufruf wird p_metadata erweitert um
--    'prev_next_due_at', e.next_due_at, 'prev_snooze_count', e.snooze_count, 'prev_last_step_at', e.last_step_at,
--    'prev_stage', (select stage from crm.leads where id = e.lead_id), 'prev_status', e.status
--    → M0 kopiert beide Funktionen aus schema.sql (Zeilen 1512–1573) und ergänzt die fünf Schlüssel. Sonst keine Änderung.

-- 4) realisiert (Kopie aus schema.sql, fünf prev_*-Schlüssel ergänzt):
create or replace function crm.complete_step(p_enrollment_id uuid, p_outcome crm.step_outcome default 'gesendet',
                                             p_note text default null, p_occurred_at timestamptz default now(), p_template_id uuid default null)
returns crm.enrollments language plpgsql security invoker set search_path = '' as $$
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
    perform crm.log_activity(e.lead_id, v_me, coalesce(s.channel, seq.channel), v_type, p_occurred_at, v_tpl, 'gesendet', p_note,
                             jsonb_build_object('step', s.name, 'position', s.position, 'sequence', seq.key,
                                                'prev_next_due_at', e.next_due_at, 'prev_snooze_count', e.snooze_count, 'prev_last_step_at', e.last_step_at,
                                                'prev_stage', (select stage from crm.leads where id = e.lead_id), 'prev_status', e.status), e.id, s.id);
  else
    perform crm.log_activity(e.lead_id, v_me, coalesce(s.channel, seq.channel), 'schritt_uebersprungen', p_occurred_at, v_tpl, 'uebersprungen', p_note,
                             jsonb_build_object('step', s.name, 'position', s.position, 'sequence', seq.key,
                                                'prev_next_due_at', e.next_due_at, 'prev_snooze_count', e.snooze_count, 'prev_last_step_at', e.last_step_at,
                                                'prev_stage', (select stage from crm.leads where id = e.lead_id), 'prev_status', e.status), e.id, s.id);
  end if;

  return crm.advance_enrollment(e.id, p_occurred_at, p_outcome = 'gesendet');
end;
$$;

create or replace function crm.snooze_step(p_enrollment_id uuid, p_until timestamptz default null, p_days int default null, p_note text default null)
returns crm.enrollments language plpgsql security invoker set search_path = '' as $$
declare e crm.enrollments; seq crm.sequences; v_new timestamptz; e0 crm.enrollments;   -- e0 = Zustand vor dem Update (für prev_*; § 4.4 Nr. 4)
begin
  select * into e from crm.enrollments where id = p_enrollment_id for update;
  if not found then raise exception 'Enrollment % nicht gefunden', p_enrollment_id; end if;
  if e.status <> 'aktiv' then raise exception 'Nur aktive Sequenzen können verschoben werden'; end if;
  select * into seq from crm.sequences where id = e.sequence_id;
  v_new := coalesce(p_until, crm.next_due(greatest(e.next_due_at, now()), coalesce(p_days, 1), seq.weekdays_only));
  if seq.weekdays_only then v_new := crm.due_on(crm.roll_to_weekday(crm.berlin_date(v_new))) + (v_new - crm.due_on(crm.berlin_date(v_new))); end if;
  e0 := e;   -- Konfliktentscheid (BAUPLAN § 4.4 Nr. 4 > schema.sql): prev_* müssen die Werte VOR dem Update tragen, e ist danach überschrieben
  update crm.enrollments set next_due_at = v_new, snooze_count = snooze_count + 1, note = coalesce(p_note, note)
   where id = e.id returning * into e;
  perform crm.log_activity(e.lead_id, coalesce(auth.uid(), e.member_id), seq.channel, 'schritt_verschoben', now(), null, null, p_note,
                           jsonb_build_object('until', v_new, 'snooze_count', e.snooze_count, 'position', e.current_position,
                                              'prev_next_due_at', e0.next_due_at, 'prev_snooze_count', e0.snooze_count, 'prev_last_step_at', e0.last_step_at,
                                              'prev_stage', (select stage from crm.leads where id = e.lead_id), 'prev_status', e0.status), e.id, e.current_step_id);
  return e;
end;
$$;

-- 5) Policy: eigene, REVERSIBLE Aktivitäten ≤ 10 Minuten löschen (Undo). Belege bleiben append-only:
--    anruf, einwilligung, widerspruch, email_gesendet, meeting_*, sequenz_gestoppt/_abgeschlossen/_pausiert, angelegt, import, vernetzung_abgelaufen.
--    sequenz_gestartet steht in der Liste, damit undo_activity die im selben Moment entstandene Zeile mitlöschen kann (§ 1.5 Nr. 43);
--    einzeln ist sie NICHT rückgängig machbar (undo_activity lehnt sie als Einstieg ab, Nr. 6). Die bestehende Notiz-Policy bleibt.
drop policy if exists "Mitglieder löschen eigene Aktivitäten kurzfristig" on crm.activities;
create policy "Mitglieder löschen eigene Aktivitäten kurzfristig" on crm.activities for delete to authenticated
  using ((select private.is_member()) and member_id = (select auth.uid()) and created_at > now() - interval '10 minutes'
         and type in ('notiz', 'stage_wechsel', 'uebergabe', 'freigabe', 'vernetzung_gesendet', 'vernetzung_angenommen', 'vernetzung_zurueckgezogen',
                      'nachricht_erhalten', 'email_erhalten', 'schritt_verschoben', 'schritt_uebersprungen', 'aufgabe_erledigt',
                      'gespraech_eroeffnet', 'nachricht_gesendet', 'pitch_gesendet', 'sequenz_gestartet'));

-- 6) undo_activity
create or replace function crm.undo_activity(p_activity_id bigint) returns jsonb
language plpgsql security invoker set search_path = '' as $$
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
      delete from crm.enrollments where lead_id = a.lead_id and source = 'app' and started_at between a.created_at - interval '2 seconds' and a.created_at + interval '5 seconds';
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
      delete from crm.enrollments where lead_id = a.lead_id and source = 'app' and started_at between a.created_at - interval '2 seconds' and a.created_at + interval '2 seconds';
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
end; $$;

-- 6b) Nachricht oder Pitch außerhalb einer Sequenz (Antworten-Karte, Kanal-Karte, Palette; § 1.5 Nr. 25).
--     Der Trigger activities_after_insert setzt danach die Stufe (pitch_gesendet → pitch) und löscht inbound_unanswered_since.
create or replace function crm.log_outbound(p_lead_id uuid, p_channel crm.channel default 'linkedin', p_template_id uuid default null,
                                            p_kind text default 'nachricht', p_note text default null, p_occurred_at timestamptz default now())
returns bigint language plpgsql security invoker set search_path = '' as $$
declare l crm.leads; v_type crm.activity_type; v_phase crm.template_phase; v_id bigint;
begin
  select * into l from crm.leads where id = p_lead_id;
  if not found then raise exception 'Lead % nicht gefunden', p_lead_id; end if;
  if p_kind not in ('nachricht', 'pitch') then raise exception 'p_kind muss nachricht oder pitch sein'; end if;
  if p_channel = 'email' then raise exception 'E-Mails werden über die Tabelle emails verbucht'; end if;
  if l.do_not_contact or crm.is_blocked(l.linkedin_url_norm, l.email, l.phone_e164) then raise exception 'Lead steht auf der Sperrliste'; end if;
  if crm.company_blocked(p_lead_id) then raise exception 'Firma ist gesperrt („Nicht anschreiben“) – keine Nachricht möglich'; end if;
  select phase into v_phase from crm.templates where id = p_template_id;
  v_type := case when p_kind = 'pitch' or v_phase = 'pitch' then 'pitch_gesendet'::crm.activity_type else 'nachricht_gesendet'::crm.activity_type end;
  v_id := crm.log_activity(p_lead_id, auth.uid(), p_channel, v_type, p_occurred_at, p_template_id, 'gesendet', p_note,
                           jsonb_build_object('kind', p_kind, 'phase', v_phase, 'prev_stage', l.stage,
                                              'prev_inbound_unanswered_since', l.inbound_unanswered_since));
  if v_type = 'nachricht_gesendet' and v_phase = 'bedarfsermittlung' then
    perform crm.raise_stage(p_lead_id, 'bedarfsermittlung', auth.uid());   -- Feinstufe innerhalb der Phase „Beantwortet“ (§ 1.5 Nr. 1)
  end if;
  return v_id;
end; $$;

-- 6c) log_reply OHNE Auto-Park (§ 1.5 Nr. 26): identischer Body wie schema.sql Zeilen 1485–1509, nur der Zweig
--     `elsif p_label in ('spaeter', 'hat_partner') then … end if;` (Stufe langfristig + Aufgabe „Langfristig nachfassen“) entfällt.
--     → M0 kopiert die Funktion und löscht genau diesen Zweig (die Variable v_days wird damit unbenutzt und ebenfalls entfernt).
--     Das Parken übernimmt der Client nach dem Senden der Antwort über set_wiedervorlage (§ 3.2).

-- 6c) realisiert (Kopie aus schema.sql ohne den spaeter/hat_partner-Zweig, v_days entfernt):
create or replace function crm.log_reply(p_lead_id uuid, p_channel crm.channel default 'linkedin', p_label crm.reply_label default null,
                                         p_note text default null, p_occurred_at timestamptz default now())
returns bigint language plpgsql security invoker set search_path = '' as $$
declare v_me uuid := auth.uid(); v_id bigint;
begin
  if not exists (select 1 from crm.leads where id = p_lead_id) then raise exception 'Lead % nicht gefunden', p_lead_id; end if;
  v_id := crm.log_activity(p_lead_id, v_me, p_channel,
                           case when p_channel = 'email' then 'email_erhalten'::crm.activity_type else 'nachricht_erhalten'::crm.activity_type end,
                           p_occurred_at, null, p_label::text, p_note, jsonb_build_object('label', p_label), p_reply_label => p_label);
  if p_label = 'widerspruch' then
    update crm.leads set do_not_contact = true, objection_note = coalesce(p_note, objection_note), objection_at = p_occurred_at,
                         stage = 'beendet', ended_reason = 'widerspruch', ended_note = coalesce(p_note, ended_note)
     where id = p_lead_id;
  elsif p_label = 'nicht_icp' then
    perform crm.set_stage(p_lead_id, 'beendet', v_me, 'nicht_icp', p_note);
  end if;
  return v_id;
end;
$$;

-- 7) Wiedervorlage atomar (Stufe langfristig + Aufgabe)
create or replace function crm.set_wiedervorlage(p_lead_id uuid, p_due date, p_note text default null, p_template_id uuid default null)
returns crm.tasks language plpgsql security invoker set search_path = '' as $$
declare t crm.tasks; l crm.leads;
begin
  select * into l from crm.leads where id = p_lead_id;
  if not found then raise exception 'Lead % nicht gefunden', p_lead_id; end if;
  perform crm.stop_enrollments(p_lead_id, 'manuell', null, 'Wiedervorlage');
  perform crm.set_stage(p_lead_id, 'langfristig', auth.uid());
  insert into crm.tasks (lead_id, member_id, kind, title, due_at, note, template_id, created_by)
  values (p_lead_id, coalesce(l.owner_id, auth.uid()), 'wiedervorlage', 'Wiedervorlage', crm.due_on(crm.roll_to_weekday(p_due)), p_note,
          coalesce(p_template_id, (select id from crm.templates where key = 'li_fu_lang_1')), auth.uid())
  returning * into t;
  return t;
end; $$;

-- 8) Voll-Backup als JSON (nur Mitglieder; alle crm-Tabellen)
create or replace function crm.export_backup() returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('exported_at', now(), 'version', 1, 'tables', jsonb_build_object(
    'settings', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from crm.settings x),
    'member_profiles', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from crm.member_profiles x),
    'tags', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from crm.tags x),
    'templates', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from crm.templates x),
    'sequences', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from crm.sequences x),
    'sequence_steps', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from crm.sequence_steps x),
    'companies', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from crm.companies x),
    'import_batches', (select coalesce(jsonb_agg(to_jsonb(x) - 'payload'), '[]') from crm.import_batches x),
    'leads', (select coalesce(jsonb_agg(to_jsonb(x) - 'search'), '[]') from crm.leads x),
    'lead_tags', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from crm.lead_tags x),
    'linkedin_connections', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from crm.linkedin_connections x),
    'enrollments', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from crm.enrollments x),
    'calls', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from crm.calls x),
    'tasks', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from crm.tasks x),
    'meetings', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from crm.meetings x),
    'emails', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from crm.emails x),
    'activities', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from crm.activities x),
    'daily_counters', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from crm.daily_counters x),
    'saved_views', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from crm.saved_views x),
    'sperrliste', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from crm.sperrliste x))); $$;

-- 9) Leitfäden-Preset: Upsert nach legacy_phase + legacy_order (Keys stabil)
create or replace function crm.import_templates(p_rows jsonb) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare r jsonb; n_ins int := 0; n_upd int := 0; v_phase crm.template_phase; v_key text; v_id uuid;
begin
  for r in select * from jsonb_array_elements(p_rows) loop
    v_phase := case (r->>'legacy_phase')::int when 1 then 'eroeffnung' when 2 then 'bedarfsermittlung' when 3 then 'pitch' else 'follow_up' end;
    if (r->>'legacy_phase')::int = 1 and r->>'name' ~* '^Vernetzung' then v_phase := 'vernetzung'; end if;
    if (r->>'legacy_phase')::int = 4 and r->>'name' ~* '^Langfristig' then v_phase := 'langfristig'; end if;
    select id into v_id from crm.templates where channel = 'linkedin' and legacy_phase = (r->>'legacy_phase')::int and legacy_order = (r->>'legacy_order')::int;
    if v_id is null then
      v_key := 'li_' || (r->>'legacy_phase') || '_' || (r->>'legacy_order');
      insert into crm.templates (key, channel, phase, name, when_to_use, body, notes, active, legacy_phase, legacy_order, sort_order, created_by)
      values (v_key, 'linkedin', v_phase, r->>'name', r->>'when_to_use', coalesce(r->>'body', ''), r->>'notes', coalesce(r->>'body', '') <> '',
              (r->>'legacy_phase')::int, (r->>'legacy_order')::int, (r->>'legacy_phase')::int * 100 + (r->>'legacy_order')::int, auth.uid());
      n_ins := n_ins + 1;
    else
      update crm.templates set name = r->>'name', when_to_use = r->>'when_to_use', body = coalesce(r->>'body', ''), notes = r->>'notes',
             active = active and coalesce(r->>'body', '') <> '' where id = v_id;
      n_upd := n_upd + 1;
    end if;
  end loop;
  return jsonb_build_object('inserted', n_ins, 'updated', n_upd);
end; $$;

-- 10) Views für KPIs
create or replace view crm.v_antwortzeit with (security_invoker = true) as
with inbound as (
  select a.lead_id, a.occurred_at as inbound_at, l.owner_id as member_id
    from crm.activities a join crm.leads l on l.id = a.lead_id where a.type in ('nachricht_erhalten', 'email_erhalten')),
answered as (
  select i.lead_id, i.member_id, i.inbound_at,
         (select min(o.occurred_at) from crm.activities o where o.lead_id = i.lead_id and o.occurred_at > i.inbound_at
             and o.type in ('nachricht_gesendet', 'pitch_gesendet', 'email_gesendet', 'anruf')) as outbound_at
    from inbound i)
select member_id, lead_id, inbound_at, outbound_at,
       case when outbound_at is null then null else
         (select count(*) from generate_series(crm.berlin_date(inbound_at), crm.berlin_date(outbound_at) - 1, interval '1 day') d
           where extract(isodow from d) < 6 and not crm.is_holiday(d::date))::numeric end as werktage
  from answered;
comment on view crm.v_antwortzeit is 'Je eingehender Nachricht: erste ausgehende Reaktion und Antwortzeit in Werktagen (KPI Ø Antwortzeit).';

create or replace view crm.v_leads_ohne_bewegung with (security_invoker = true) as
select l.id as lead_id, l.full_name, l.company_name, l.stage, l.owner_id, l.last_activity_at,
       (select count(*) from generate_series(crm.berlin_date(l.last_activity_at), crm.today() - 1, interval '1 day') d
         where extract(isodow from d) < 6 and not crm.is_holiday(d::date))::int as tage_ohne_bewegung
  from crm.leads l
 where l.deleted_at is null and l.stage in ('dm_beantwortet', 'bedarfsermittlung', 'pitch')
   and not exists (select 1 from crm.enrollments e where e.lead_id = l.id and e.status = 'aktiv')
   and l.last_activity_at < now() - interval '5 days';
comment on view crm.v_leads_ohne_bewegung is 'Leads in Beantwortet/Gepitcht ohne Ereignis seit ≥ 5 Werktagen und ohne aktive Sequenz (ux § 4.5).';

-- 11) Keep-alive
create or replace function crm.ping() returns text language sql stable security definer set search_path = '' as $$ select 'pong' $$;
revoke all on function crm.ping() from public; grant execute on function crm.ping() to anon, authenticated;
-- Konfliktentscheid M0 (BAUPLAN F-07/E24 > schema.sql Zeile 2176 „revoke all on schema crm from anon“): ohne USAGE auf dem Schema
-- bekäme anon bei rpc/ping „permission denied for schema crm“. Tabellen/Funktionen bleiben für anon ohne Rechte (RLS + revoke in Migration 1).
grant usage on schema crm to anon;

-- 12) Wortlaut Wiedervorlage (ux-Glossar)
update crm.settings set value = jsonb_set(jsonb_set(value, '{langfristig,label}', '"Wiedervorlage"'), '{langfristig,short}', '"Wiedervorlage"')
 where key = 'stage_labels';

-- (vorgezogen aus Nr. 15, Assembly-Entscheid M0: der Grant in Nr. 13 braucht die Funktion bereits – sonst „function does not exist“)
create or replace function crm.company_blocked(p_lead_id uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from crm.leads l join crm.companies c on c.id = l.company_id where l.id = p_lead_id and c.do_not_contact);
$$;

-- 13) Rechte für neue Objekte (Default-Privileges greifen, explizit zur Sicherheit)
grant execute on function crm.undo_activity(bigint), crm.set_wiedervorlage(uuid, date, text, uuid), crm.export_backup(), crm.import_templates(jsonb),
                          crm.log_outbound(uuid, crm.channel, uuid, text, text, timestamptz), crm.company_blocked(uuid) to authenticated;
grant select on crm.v_antwortzeit, crm.v_leads_ohne_bewegung to authenticated;
revoke all on function crm.export_backup() from anon;

-- 14) E-Mail-Gate serverseitig (§ 1.5 Nr. 33): Body wie schema.sql Zeilen 1434–1450, ergänzt um den Block nach dem Snapshot.
create or replace function crm.emails_before_write() returns trigger
language plpgsql set search_path = '' as $$
declare l crm.leads; v_phase crm.template_phase;
begin
  if new.direction = 'out' and new.consent_basis_snapshot is null then
    select * into l from crm.leads where id = new.lead_id;
    new.consent_basis_snapshot := l.email_consent_basis;
    new.consent_at_snapshot := l.email_consent_at;
    new.consent_note_snapshot := l.email_consent_note;
  end if;
  new.to_address := nullif(lower(btrim(coalesce(new.to_address, ''))), '');
  -- Gate: nur beim Übergang in einen „gesendet“-Status, nie im Import-Modus
  if new.direction = 'out' and new.status in ('sent', 'sent_confirmed', 'delivered') and not crm.import_mode()
     and (tg_op = 'INSERT' or old.status not in ('sent', 'sent_confirmed', 'delivered')) then
    select phase into v_phase from crm.templates where id = new.template_id;
    if coalesce(new.consent_basis_snapshot, 'none') in ('none', 'revoked') and coalesce(v_phase::text, '') <> 'transaktional' then
      raise exception 'Keine Erlaubnis-Grundlage – die E-Mail darf nicht als gesendet verbucht werden'; end if;
    if new.to_address is null then raise exception 'Empfängeradresse fehlt'; end if;
    if crm.is_blocked(null, new.to_address, null) then raise exception 'Adresse steht auf der Sperrliste'; end if;
    if crm.company_blocked(new.lead_id) then raise exception 'Firma ist gesperrt („Nicht anschreiben“)'; end if;
  end if;
  if new.direction = 'out' and new.status in ('sent', 'sent_confirmed', 'delivered') and new.sent_at is null then new.sent_at := now(); end if;
  if new.direction = 'in' and new.status = 'draft' then new.status := 'received'; end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status then new.status_at := now(); end if;
  return new;
end;
$$;

-- 15) Firmensperre (§ 1.5 Nr. 27): companies.do_not_contact blockt neue Kontaktaufnahme – intern, kein Widerspruch
create or replace function crm.company_blocked(p_lead_id uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from crm.leads l join crm.companies c on c.id = l.company_id where l.id = p_lead_id and c.do_not_contact);
$$;

create or replace function crm.block_company_contact() returns trigger
language plpgsql set search_path = '' as $$
begin
  if crm.import_mode() then return new; end if;
  -- Assembly-Entscheid M0: die Bedingung aus § 4.4 Nr. 15 stand als EIN Ausdruck; PL/pgSQL löst new.requested_at/new.direction aber für jede
  -- Tabelle auf (enrollments-Zeile → „record new has no field requested_at“). Deshalb je Tabelle ein eigener Ausdruck, Logik unverändert.
  if tg_table_name = 'enrollments' then
    if new.status in ('aktiv', 'pausiert') and crm.company_blocked(new.lead_id) then
      raise exception 'Firma ist gesperrt („Nicht anschreiben“) – keine Kontaktaufnahme'; end if;
  elsif tg_table_name = 'linkedin_connections' then
    if new.requested_at is not null and new.accepted_at is null and crm.company_blocked(new.lead_id) then
      raise exception 'Firma ist gesperrt („Nicht anschreiben“) – keine Kontaktaufnahme'; end if;
  elsif tg_table_name = 'calls' then
    if new.direction = 'out' and crm.company_blocked(new.lead_id) then
      raise exception 'Firma ist gesperrt („Nicht anschreiben“) – keine Kontaktaufnahme'; end if;
  end if;
  return new;
end;
$$;
create or replace trigger enrollments_block_company  before insert on crm.enrollments          for each row execute function crm.block_company_contact();
create or replace trigger connections_block_company  before insert on crm.linkedin_connections for each row execute function crm.block_company_contact();
create or replace trigger calls_block_company        before insert on crm.calls                for each row execute function crm.block_company_contact();
-- Hinweis: enroll() aus connections_after_write (Auto-Sequenz nach Annahme) ist dort bereits in einen exception-Block gekapselt → nur Notice.

-- v_today_queue: identischer Body wie schema.sql Zeilen 1911–1988; am Ende wird
--     from items i join crm.leads l on l.id = i.lead_id cross join heute where l.deleted_at is null;
--   ersetzt durch
--     from items i join crm.leads l on l.id = i.lead_id left join crm.companies co on co.id = l.company_id cross join heute
--    where l.deleted_at is null and not coalesce(co.do_not_contact, false);
--   (Spaltenliste unverändert → create or replace view ist zulässig.)

-- 15b) v_today_queue realisiert (Kopie aus schema.sql, nur die from/where-Zeilen am Ende geändert):
create or replace view crm.v_today_queue with (security_invoker = true) as
with heute as (select crm.today() as d),
items as (
  -- 1 Antworten: eingehende Nachricht ohne unsere Reaktion
  select l.owner_id as member_id, 'antworten'::text as item_kind, l.id::text as item_id, l.id as lead_id,
         l.inbound_unanswered_since as due_at, null::uuid as enrollment_id, null::uuid as step_id, null::uuid as task_id,
         null::uuid as meeting_id, null::uuid as connection_id, null::uuid as template_id,
         'Antwort ausstehend'::text as title, ('Seit ' || to_char(l.inbound_unanswered_since at time zone 'Europe/Berlin', 'DD.MM. HH24:MI'))::text as subtitle,
         coalesce(l.last_inbound_channel, 'linkedin'::crm.channel) as channel, 0 as snooze_count, true as is_must
    from crm.leads l
   where l.inbound_unanswered_since is not null and l.deleted_at is null and l.stage <> 'beendet'
  union all
  -- Sequenzschritte
  select e.member_id, 'sequenz_schritt', e.id::text, e.lead_id, e.next_due_at, e.id, s.id, null, null, null, s.template_id,
         s.name, seq.name, coalesce(s.channel, seq.channel), e.snooze_count, true
    from crm.enrollments e
    join crm.sequences seq on seq.id = e.sequence_id
    left join crm.sequence_steps s on s.id = e.current_step_id
   where e.status = 'aktiv' and e.next_due_at is not null
  union all
  -- Aufgaben (Rückruf, Wiedervorlage, Aufgabe)
  select t.member_id, t.kind::text, t.id::text, t.lead_id, t.due_at, null, null, t.id, null, null, t.template_id,
         t.title, case t.kind when 'rueckruf' then 'Rückruf' when 'wiedervorlage' then 'Wiedervorlage' else 'Aufgabe' end,
         case t.kind when 'rueckruf' then 'telefon'::crm.channel else 'sonstiges'::crm.channel end, t.snooze_count, true
    from crm.tasks t where t.status = 'offen'
  union all
  -- Meetings (geplant): heute/kommend; vergangene geplante = „Stattgefunden?“
  select m.member_id, 'meeting', m.id::text, m.lead_id, m.scheduled_at, null, null, null, m.id, null, null,
         case m.type when 'erstgespraech' then 'Erstgespräch' when 'strategiegespraech' then 'Strategiegespräch' else 'Folgegespräch' end,
         case when m.scheduled_at < now() then 'Stattgefunden? Status setzen' else to_char(m.scheduled_at at time zone 'Europe/Berlin', 'HH24:MI') || ' Uhr' end,
         'sonstiges'::crm.channel, 0, true
    from crm.meetings m where m.status = 'geplant'
  union all
  -- 4 Annahme prüfen: offene Anfragen der letzten 7 Tage
  select c.member_id, 'annahme_pruefen', c.id::text, c.lead_id, c.requested_at, null, null, null, null, c.id, null,
         'Angenommen?', 'Anfrage vom ' || to_char(c.requested_at at time zone 'Europe/Berlin', 'DD.MM.'), 'linkedin'::crm.channel, 0, false
    from crm.linkedin_connections c, heute
   where c.status = 'ausstehend' and c.requested_at is not null and crm.berlin_date(c.requested_at) >= heute.d - 7
  union all
  -- 6 Neue Anfragen: importierte Leads ohne Anfrage
  select l.owner_id, 'neue_anfrage', l.id::text, l.id, l.created_at, null, null, null, null, null, null,
         'Vernetzungsanfrage senden', coalesce(l.role_title, ''), 'linkedin'::crm.channel, 0, false
    from crm.leads l where l.stage = 'neu' and l.deleted_at is null and not l.do_not_contact
  union all
  -- 7 Zurückziehen: offene Anfragen älter als 21 Tage
  select c.member_id, 'zurueckziehen', c.id::text, c.lead_id, c.requested_at, null, null, null, null, c.id, null,
         'Anfrage zurückziehen', 'Offen seit ' || (heute.d - crm.berlin_date(c.requested_at)) || ' Tagen', 'linkedin'::crm.channel, 0, false
    from crm.linkedin_connections c, heute
   where c.status = 'ausstehend' and c.requested_at is not null
     and crm.berlin_date(c.requested_at) < heute.d - coalesce((crm.setting('linkedin', 'pending_withdraw_days'))::int, 21)
)
select i.member_id,
       case i.item_kind
         when 'antworten' then 'antworten'
         when 'annahme_pruefen' then 'annahme_pruefen'
         when 'neue_anfrage' then 'neue_anfragen'
         when 'zurueckziehen' then 'zurueckziehen'
         else case when crm.berlin_date(i.due_at) < heute.d then 'ueberfaellig'
                   when crm.berlin_date(i.due_at) = heute.d then 'heute'
                   else 'kommend' end
       end as section,
       case i.item_kind
         when 'antworten' then 1 when 'annahme_pruefen' then 4 when 'neue_anfrage' then 6 when 'zurueckziehen' then 7
         else case when crm.berlin_date(i.due_at) < heute.d then 2 when crm.berlin_date(i.due_at) = heute.d then 3 else 8 end
       end as section_order,
       i.item_kind, i.item_id, i.lead_id, l.full_name as lead_name, l.company_name, l.stage, crm.stage_rank(l.stage) as stage_rank,
       i.channel, i.due_at, crm.berlin_date(i.due_at) as due_date,
       greatest(heute.d - crm.berlin_date(i.due_at), 0) as days_overdue,
       i.title, i.subtitle, i.template_id, i.enrollment_id, i.step_id, i.task_id, i.meeting_id, i.connection_id, i.snooze_count,
       l.linkedin_url, l.phone_e164, l.email, l.salutation, l.first_name, l.last_name, l.owner_id, l.priority, l.do_not_contact,
       l.last_activity_at, l.last_activity_type, l.follow_up_count,
       -- deterministische Sortierung: Funnel-Tiefe ↓, Überfälligkeit ↓, Priorität ↓, Firma, Alter ↑
       (crm.stage_rank(l.stage) * 10000 + least(greatest(heute.d - crm.berlin_date(i.due_at), 0), 999) * 10 + l.priority) as rank_score,
       l.created_at as lead_created_at
  from items i
  join crm.leads l on l.id = i.lead_id
  left join crm.companies co on co.id = l.company_id
  cross join heute
 where l.deleted_at is null and not coalesce(co.do_not_contact, false);

-- 16) meetings_after_write: Strategiegespräch wie Erstgespräch (§ 1.5 Nr. 28). Body wie schema.sql Zeilen 1339–1388 mit vier Änderungen:
--    a) `if new.type = 'erstgespraech' then`  →  `if new.type in ('erstgespraech', 'strategiegespraech') then`
--    b) `email_consent_note = coalesce(email_consent_note, 'Erstgespräch geführt (' || v_type_label || ')')`
--         →  `email_consent_note = coalesce(email_consent_note, v_type_label || ' geführt')`
--    c) `v_auto := coalesce((crm.setting('email', 'auto_enroll_after_erstgespraech'))::boolean, false);`
--         →  `v_auto := coalesce((crm.setting('email', case new.type when 'erstgespraech' then 'auto_enroll_after_erstgespraech'
--                                                                 else 'auto_enroll_after_strategiegespraech' end))::boolean, false);`
--    d) `perform crm.enroll(new.lead_id, 'email_warm_after_erstgespraech', new.member_id, new.scheduled_at);`
--         →  `perform crm.enroll(new.lead_id, case new.type when 'erstgespraech' then 'email_warm_after_erstgespraech'
--                                                        else 'email_warm_after_strategiegespraech' end, new.member_id, new.scheduled_at);`
--    No-Show löst in der DB nichts aus (Vorschlag-Toast im Client, § 3.2/§ 3.3).

-- 16) realisiert (Kopie aus schema.sql mit den vier Änderungen a–d):
create or replace function crm.meetings_after_write() returns trigger
language plpgsql set search_path = '' as $$
declare v_member uuid := coalesce(auth.uid(), new.member_id); v_type_label text; v_auto boolean;
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
        if v_auto and not crm.import_mode() then
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
$$;

-- 17) Rückruf-Kadenz (ux § 3.5.4, § 1.5 Nr. 38): log_call – Body wie schema.sql Zeilen 1635–1727 mit drei Änderungen.
--    a) declare zusätzlich:  v_task crm.tasks; v_retry int;
--    b) direkt nach `select * into d from crm.call_outcome_defs …`:
--         if p_task_id is not null then select * into v_task from crm.tasks where id = p_task_id; end if;
--    c) der Zweig `when 'no_answer', 'voicemail', 'voicemail_left' then … ` wird vollständig ersetzt durch:
--
--    when 'no_answer', 'voicemail', 'voicemail_left' then
--      if v_task.id is not null and v_task.kind = 'rueckruf' then
--        -- vereinbarter Rückruf nicht erreicht: +1 Kalendertag gerollt, dann +3, dann Telefon-Standard ab Versuch 3
--        v_retry := case when v_task.title ~ 'Wiederholung 2' then 2 when v_task.title ~ 'Wiederholung 1' then 1 else 0 end;
--        if v_retry < 2 then
--          insert into crm.tasks (lead_id, member_id, kind, title, due_at, call_id, note, template_id, created_by)
--          values (p_lead_id, v_me, 'rueckruf', 'Rückruf – nicht erreicht (Wiederholung ' || (v_retry + 1) || ')',
--                  crm.next_due(p_started_at, case v_retry when 0 then 1 else 3 end, true) + interval '1 hour',
--                  c.id, v_task.note, v_task.template_id, v_me);
--        else
--          if v_enr is not null then
--            update crm.enrollments set status = 'gestoppt', stopped_at = now(), stopped_reason = 'ersetzt', note = 'Rückruf-Kadenz erschöpft' where id = v_enr;
--          end if;
--          begin perform crm.enroll(p_lead_id, coalesce(crm.setting('telefon', 'default_sequence') #>> '{}', 'telefon_standard'), v_me, p_started_at, 3);
--          exception when others then raise notice 'Telefon-Sequenz nicht gestartet: %', sqlerrm; end;
--        end if;
--      elsif v_enr is not null then
--        perform crm.advance_enrollment(v_enr, p_started_at, true);
--      else
--        v_auto := coalesce((crm.setting('telefon', 'auto_enroll_on_no_answer'))::boolean, true);
--        if v_auto then
--          begin perform crm.enroll(p_lead_id, coalesce(crm.setting('telefon', 'default_sequence') #>> '{}', 'telefon_standard'), v_me, p_started_at, 2);
--          exception when others then raise notice 'Telefon-Sequenz nicht gestartet: %', sqlerrm; end;
--        end if;
--      end if;
--
--    Der Wiederholungszähler steckt im Task-Titel (keine neue Spalte); die ursprüngliche Rückruf-Aufgabe wird wie bisher
--    über p_task_id erledigt. busy bleibt +45 min ohne Zählung; Rückruf-Tasks mit Uhrzeit rollen weiterhin nicht,
--    die Wiederholungen nutzen 10:00 des gerollten Tages (next_due + 1 h, wie die bestehenden Rückruf-Defaults).

-- 17) realisiert (Kopie aus schema.sql mit den drei Änderungen a–c):
create or replace function crm.log_call(
  p_lead_id uuid, p_outcome crm.call_outcome, p_note text default null,
  p_reached_person crm.reached_person default null, p_reached_name text default null,
  p_started_at timestamptz default now(), p_ended_at timestamptz default null, p_duration_sec int default null,
  p_callback_at timestamptz default null, p_meeting_at timestamptz default null,
  p_enrollment_id uuid default null, p_task_id uuid default null, p_template_id uuid default null,
  p_from_number text default null, p_to_number text default null, p_direction crm.call_direction default 'out',
  p_ended_reason crm.ended_reason default null)
returns crm.calls language plpgsql security invoker set search_path = '' as $$
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
        update crm.enrollments set status = 'aktiv', next_due_at = p_started_at + make_interval(mins => coalesce((crm.setting('telefon', 'busy_retry_minutes'))::int, 45)) where id = v_enr;
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
$$;
