-- =====================================================================================================
-- CRM Steiner & Co. · Migration 3 = import-mapping.sql · Alt-Daten aus den Google Sheets → Schema „crm“
-- + genau zwei Patches (BAUPLAN § 3.1.2: Firmensperre § 1.5 Nr. 27, Sales-Verantwortlicher § 1.5 Nr. 42), sonst unverändert.
-- Stand: 2026-10-14 · Voraussetzung: schema.sql und seed.sql sind eingespielt.
--
-- Eingaben (von import/tools/parse_sheets.py erzeugt):
--   · import/kpi_monthly.json  – Objekt mit "months": [{person, month, tab, sections[{key, metrics[{key, value, cell}]}], daily[{date, gespraeche_eroeffnet}]}]
--   · import/crm_leads.json    – Objekt mit "crm": {"rows": [ …216 Zeilen… ]} (Spalten-Keys s. u.), inkl. "_note_signals" je Zeile
--
-- Reihenfolge (wichtig, weil der Lead-Import über crm.has_kpi_sheet() entscheidet, welche Alt-Ereignisse in die KPIs zählen):
--   1) select crm.import_sheet_kpis(<kpi_monthly.json>::jsonb);
--   2) select crm.import_sheet_leads(<crm_leads.json>::jsonb);          -- oder (…, p_dry_run => true) für eine Vorschau
--
-- Beide Funktionen sind idempotent: ein zweiter Lauf ersetzt die Sheet-Daten (Quelle import_sheet) und lässt alles,
-- was danach in der App entstanden ist, unangetastet.
--
-- Ausführung, Variante psql (Supabase-Verbindungsstring aus dem Dashboard):
--   \set kpi `cat scratchpad/crm/import/kpi_monthly.json`
--   select crm.import_sheet_kpis(:'kpi'::jsonb);
--   \set crm `cat scratchpad/crm/import/crm_leads.json`
--   select crm.import_sheet_leads(:'crm'::jsonb);
-- Variante Management-API (CLI-Token):  POST https://api.supabase.com/v1/projects/ekaqkfgvisdngsskzbai/database/query
--   body = {"query": "select crm.import_sheet_leads($j$" + <Dateiinhalt> + "$j$::jsonb)"}   (Dateiinhalt enthält kein „$j$“)
-- =====================================================================================================

-- -----------------------------------------------------------------------------------------------------
-- 0. Helfer: Notiz-Signale (Fallback, wenn _note_signals in der JSON-Zeile fehlt)
-- -----------------------------------------------------------------------------------------------------
-- crm.any_date() und crm.split_person_name() liegen in schema.sql (Abschnitt 2), weil auch der Schnellimport sie nutzt.

-- Gleiche Muster wie NOTE_PATTERNS in import/tools/parse_sheets.py
create or replace function crm.parse_legacy_note(p text) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare out jsonb := '[]'::jsonb; m text[];
begin
  if p is null or btrim(p) = '' then return out; end if;
  m := regexp_match(p, '(Kurzfristig|Langfristig)\s*(\d)\s*am\s*(\d{1,2}\.\d{1,2}\.\d{4})\s*gesendet', 'i');
  if m is not null then out := out || jsonb_build_object('kind', 'sequence_step_sent', 'sequence', initcap(m[1]), 'step', m[2]::int, 'date', crm.any_date(m[3])); end if;
  m := regexp_match(p, 'First Outreach am\s*(\d{1,2}\.\d{1,2}\.\d{4})\s*gesendet', 'i');
  if m is not null then out := out || jsonb_build_object('kind', 'first_outreach_sent', 'date', crm.any_date(m[1])); end if;
  if p ~* 'First Outreach ausstehend' then out := out || jsonb_build_object('kind', 'first_outreach_pending'); end if;
  m := regexp_match(p, 'Annahme am\s*(\d{1,2}\.\d{1,2}\.\d{4})', 'i');
  if m is not null then out := out || jsonb_build_object('kind', 'connection_accepted', 'date', crm.any_date(m[1])); end if;
  m := regexp_match(p, 'Vincent-Vernetzung am\s*(\d{1,2}\.\d{1,2}\.\d{4})\s*akzeptiert', 'i');
  if m is not null then out := out || jsonb_build_object('kind', 'connection_accepted_vincent', 'date', crm.any_date(m[1])); end if;
  m := regexp_match(p, 'Antwort am\s*(\d{1,2}\.\d{1,2}\.\d{4})', 'i');
  if m is not null then out := out || jsonb_build_object('kind', 'reply_received', 'date', crm.any_date(m[1])); end if;
  if p ~* '^Antwort:' then out := out || jsonb_build_object('kind', 'reply_received_undated'); end if;
  m := regexp_match(p, 'Am\s*(\d{1,2}\.\d{1,2}\.\d{4})\s*beendet', 'i');
  if m is not null then out := out || jsonb_build_object('kind', 'ended', 'date', crm.any_date(m[1])); end if;
  m := regexp_match(p, 'Erstgespr[äa]ch am\s*(\d{1,2}\.\d{1,2}\.\d{4})\s*gef[üu]hrt', 'i');
  if m is not null then out := out || jsonb_build_object('kind', 'first_call_held', 'date', crm.any_date(m[1])); end if;
  m := regexp_match(p, 'N[äa]chster Termin\s*(\d{1,2}\.\d{1,2}\.\d{4})', 'i');
  if m is not null then out := out || jsonb_build_object('kind', 'next_appointment', 'date', crm.any_date(m[1])); end if;
  if p ~* 'NICHT ANSCHREIBEN' then out := out || jsonb_build_object('kind', 'do_not_contact'); end if;
  if p ~* 'Kein (aktueller |konkreter )?Bedarf' then out := out || jsonb_build_object('kind', 'no_need'); end if;
  if p ~* 'Aktuell kein Interesse' then out := out || jsonb_build_object('kind', 'no_interest'); end if;
  if p ~* 'Nicht ICP' then out := out || jsonb_build_object('kind', 'not_icp'); end if;
  if p ~* 'Nicht qualifiziert' then out := out || jsonb_build_object('kind', 'not_qualified'); end if;
  if p ~* 'Kennt das Problem nicht' then out := out || jsonb_build_object('kind', 'problem_unknown'); end if;
  if p ~* 'Problem im Unternehmen nicht vorhanden' then out := out || jsonb_build_object('kind', 'problem_absent'); end if;
  m := regexp_match(p, '^(\d{1,2}\.\d{1,2}\.\d{4})\s*(\n|\|)');
  if m is not null then out := out || jsonb_build_object('kind', 'leading_date', 'date', crm.any_date(m[1])); end if;
  return out;
end;
$$;
comment on function crm.parse_legacy_note(text) is 'Import-Helfer: maschinenlesbare Signale aus den Sheet-Notizen (Kurzfristig 2 am … gesendet, Annahme am …, Antwort am …, Am … beendet …).';

-- -----------------------------------------------------------------------------------------------------
-- 1. KPI-Sheet (LinkedIn-KPIs VINCENT, Sept/Okt 2026) → crm.daily_counters
--    Monatswerte als period='monat' (Datum = Monatserster), „Gespräch eröffnet“ nur als Tageswerte (Summe = Monatswert).
--    Der Block SALES-CALLS spiegelt OUTREACH und wird übersprungen.
-- -----------------------------------------------------------------------------------------------------
create or replace function crm.import_sheet_kpis(p_doc jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  m jsonb; sec jsonb; met jsonb; d jsonb;
  v_member uuid; v_month date; v_metric crm.metric; v_person text;
  n_monat int := 0; n_tag int := 0; v_months text[] := '{}';
begin
  for m in select * from jsonb_array_elements(case when jsonb_typeof(p_doc) = 'array' then p_doc else p_doc -> 'months' end) loop
    v_person := coalesce(m ->> 'person', 'Vincent');
    v_member := crm.member_id_by_name(v_person);
    if v_member is null then raise exception 'Mitglied „%“ nicht gefunden – seed.sql (member_profiles) zuerst ausführen', v_person; end if;
    v_month := ((m ->> 'month') || '-01')::date;
    v_months := v_months || (m ->> 'month');

    for sec in select * from jsonb_array_elements(coalesce(m -> 'sections', '[]'::jsonb)) loop
      continue when sec ->> 'key' = 'sales_calls';
      for met in select * from jsonb_array_elements(coalesce(sec -> 'metrics', '[]'::jsonb)) loop
        v_metric := case met ->> 'key'
          when 'vernetzung_versendet'       then 'vernetzungen_versendet'::crm.metric
          when 'angenommene_vernetzungen'   then 'vernetzungen_angenommen'::crm.metric
          when 'ausstehend'                 then 'ausstehend'::crm.metric
          when 'dm_beantwortet'             then 'dm_beantwortet'::crm.metric
          when 'erstgespraech_gepitcht'     then 'erstgespraech_gepitcht'::crm.metric
          when 'erstgespraeche'             then 'erstgespraeche'::crm.metric
          when 'strategiegespraeche'        then 'strategiegespraeche'::crm.metric
          when 'kunden_gewonnen'            then 'kunden_gewonnen'::crm.metric
          when 'erstgespraech_no_show'      then 'erstgespraech_no_show'::crm.metric
          when 'erstgespraech_abgesagt'     then 'erstgespraech_abgesagt'::crm.metric
          when 'strategiegespraech_no_show' then 'strategiegespraech_no_show'::crm.metric
          when 'strategiegespraech_abgesagt' then 'strategiegespraech_abgesagt'::crm.metric
          else null end;                                   -- gespraech_eroeffnet kommt aus den Tageswerten
        continue when v_metric is null or nullif(met ->> 'value', '') is null;
        insert into crm.daily_counters (member_id, date, metric, period, value, source, note)
        values (v_member, v_month, v_metric, 'monat', round((met ->> 'value')::numeric)::int, 'kpi_sheet',
                'KPI-Sheet „' || coalesce(m ->> 'tab', m ->> 'month') || '“ · Zelle ' || coalesce(met ->> 'cell', '?'))
        on conflict (member_id, date, metric, period) do update
          set value = excluded.value, note = excluded.note, source = 'kpi_sheet', updated_at = now();
        n_monat := n_monat + 1;
      end loop;
    end loop;

    for d in select * from jsonb_array_elements(coalesce(m -> 'daily', '[]'::jsonb)) loop
      continue when nullif(d ->> 'gespraeche_eroeffnet', '') is null or (d ->> 'gespraeche_eroeffnet')::numeric <= 0;
      insert into crm.daily_counters (member_id, date, metric, period, value, source, note)
      values (v_member, (d ->> 'date')::date, 'gespraeche_eroeffnet', 'tag', round((d ->> 'gespraeche_eroeffnet')::numeric)::int, 'kpi_sheet',
              'KPI-Sheet „' || coalesce(m ->> 'tab', m ->> 'month') || '“ · Tageswert Zeile ' || coalesce(d ->> 'row', '?'))
      on conflict (member_id, date, metric, period) do update
        set value = excluded.value, note = excluded.note, source = 'kpi_sheet', updated_at = now();
      n_tag := n_tag + 1;
    end loop;
  end loop;

  insert into crm.import_batches (member_id, source, label, preset, row_count, inserted, summary)
  values (auth.uid(), 'import_sheet', 'KPI-Sheet „LinkedIn-KPIs (VINCENT)“', 'sheet_kpi', n_monat + n_tag, n_monat + n_tag,
          jsonb_build_object('monatswerte', n_monat, 'tageswerte', n_tag, 'monate', to_jsonb(v_months)));
  return jsonb_build_object('monatswerte', n_monat, 'tageswerte', n_tag, 'monate', to_jsonb(v_months));
end;
$$;
comment on function crm.import_sheet_kpis(jsonb) is 'Import des KPI-Sheets (kpi_monthly.json) in crm.daily_counters: Monatswerte (period monat) + Tageswerte „Gespräch eröffnet“ (period tag). Idempotent.';

-- -----------------------------------------------------------------------------------------------------
-- 2. CRM-Sheet (216 Zeilen) → leads, companies, linkedin_connections, activities, meetings, enrollments, tasks, tags
--
-- Spalten je Zeile (Keys aus parse_sheets.py): id, vor_und_nachname, linkedin_url, telefonnummer, unternehmen,
--   mike_anfrage_gesendet_am, mike_akzeptiert, vincent_anfrage_gesendet_am, vincent_akzeptiert, gespraechseroeffnung_am,
--   gespraech_eroeffnet_von, dm_zustaendigkeit, dm_zustaendigkeit_resolved, fuer_anderen_freigegeben, letztes_dm_follow_up_am,
--   dm_follow_ups_anzahl, erstgespraech_am, strategiegespraech_am, status, mitarbeiter, lead_phase, naechster_follow_up_am,
--   notizen, system_id, system_id_2, _note_signals[]
--
-- Ableitungsregeln (Kurzfassung – ausführlich in datenmodell.md §7):
--   Stufe:   Beendet/Nicht qualifiziert/Lead-Phase Beendet → beendet (Grund aus Notiz); mit zukünftigem Follow-up → langfristig
--            Kunde → kunde · SG-Datum/SG Folgebesprechung → strategiegespraech · SG vereinbart → strategiegespraech_vereinbart
--            Follow-Up → sales_follow_up · „Erstgespräch am … geführt“ oder EG-Datum in der Vergangenheit (Status ≠ EG vereinbart) → erstgespraech
--            EG-Datum/EG vereinbart → erstgespraech_vereinbart · Pitch → pitch · In Gespräch → dm_beantwortet
--            DM Follow-Up/Keine Antwort → dm_follow_up (bei Follow-up > 45 Tage in der Zukunft → langfristig)
--            Eröffnung/Offen/Eröffnungsdatum → gespraech_eroeffnet · nur angenommen → vernetzt
--   Zuständigkeit: DM-Zuständigkeit (Mike/Vincent); „Frei“ ohne Freigabe → Mitarbeiter; „Für anderen freigegeben = Ja“ → released, owner null
--   Vernetzung je Person: akzeptiert = Ja → status angenommen; Annahmedatum = Notiz „Annahme am …“, sonst Anfrage+1 (max. Eröffnungstag),
--            sonst Eröffnungstag (geschätzt, im note vermerkt)
--   Aktivitäten: gespraech_eroeffnet am Eröffnungstag · nachricht_gesendet je DM-Follow-up (letzter exakt, frühere gleichmäßig geschätzt) ·
--            nachricht_erhalten bei Antwort-Signal oder Status In Gespräch (Datum: „Antwort am …“, sonst Leitdatum/letzter Follow-up/geschätzt) ·
--            meeting_* über die Meeting-Tabelle · stage_wechsel für beendet/langfristig mit historischem Datum · import (Zusammenfassung)
--   Sequenz: aktive LinkedIn-Leads mit „Nächster Follow-Up am“ → linkedin_standard, aktueller Schritt = Follow-up-Anzahl + 2
--            (Kurzfristig 2 gesendet → nächster Schritt Kurzfristig 3), next_due_at = Sheet-Datum (auch wenn überfällig)
--   Sonst:   „Nächster Follow-Up am“ → Wiedervorlage-Aufgabe (Langfristig: Vorlage Langfristig 1)
--   KPI:     Ereignisse eines Mitglieds in Monaten mit KPI-Sheet-Werten sind kpi_relevant = false (die Sheet-Zahlen gelten),
--            alle anderen zählen (Mike hat kein KPI-Sheet).
-- -----------------------------------------------------------------------------------------------------
create or replace function crm.import_sheet_leads(p_doc jsonb, p_dry_run boolean default false)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_rows jsonb; r jsonb; sig jsonb; sigs jsonb;
  v_vincent uuid; v_mike uuid; v_batch uuid; v_me uuid := auth.uid();
  -- Zeile
  v_legacy_id int; v_name text; v_title text; v_first text; v_last text; v_url text; v_norm text; v_company text; v_company_id uuid;
  v_status text; v_phase text; v_mitarbeiter text; v_zust text; v_opened_by text; v_notes text;
  d_req_mike date; d_req_vin date; d_opened date; d_last_fu date; d_eg date; d_sg date; d_next date; v_fu_count int;
  v_acc_mike boolean; v_acc_vin boolean;
  -- Signale
  d_annahme date; d_annahme_vin date; d_fo_sent date; d_reply_sig date; d_reply date; d_ended date; d_fc_held date; d_next_appt date; d_leading date;
  v_step_seq text; v_step_no int; v_dnc boolean; v_reply_evidence boolean;
  k_no_need boolean; k_not_icp boolean; k_not_qual boolean; k_no_interest boolean; k_problem boolean;
  -- Ableitungen
  v_mitarbeiter_id uuid; v_owner uuid; v_opened_by_id uuid; v_released boolean; v_created date;
  v_stage crm.lead_stage; v_reason crm.ended_reason; v_lang boolean; v_label crm.reply_label; v_stage_date date;
  v_lead uuid; v_existing uuid; v_has_app boolean; v_pos int; v_enr uuid; d_acc date; v_i int; d_i date; v_tpl uuid;
  n_new int := 0; n_upd int := 0; n_skip int := 0; n_conn int := 0; n_act int := 0; n_enr int := 0; n_task int := 0; n_meet int := 0; n_dry int := 0;
  v_warn jsonb := '[]'::jsonb;
begin
  perform set_config('crm.import_mode', 'on', true);
  v_rows := case when jsonb_typeof(p_doc) = 'array' then p_doc else coalesce(p_doc #> '{crm,rows}', p_doc -> 'rows') end;
  if v_rows is null or jsonb_typeof(v_rows) <> 'array' then
    raise exception 'Erwartet crm_leads.json (Objekt mit crm.rows) oder ein JSON-Array von Zeilen';
  end if;
  v_vincent := crm.member_id_by_name('Vincent');
  v_mike := crm.member_id_by_name('Mike');
  if v_vincent is null or v_mike is null then raise exception 'Mitglieder Vincent/Mike nicht gefunden – seed.sql (member_profiles) zuerst ausführen'; end if;

  if not p_dry_run then
    insert into crm.import_batches (member_id, source, label, preset, row_count, payload)
    values (v_me, 'import_sheet', 'CRM-Sheet „CRM - Steiner & Co.“ (Tab CRM)', 'sheet_crm', jsonb_array_length(v_rows), p_doc -> 'source')
    returning id into v_batch;
  end if;

  for r in select * from jsonb_array_elements(v_rows) loop
    -- 1) Felder --------------------------------------------------------------------------------------
    v_legacy_id := nullif(regexp_replace(coalesce(r ->> 'id', ''), '[^0-9]', '', 'g'), '')::int;
    v_name := nullif(btrim(coalesce(r ->> 'vor_und_nachname', '')), '');
    v_url := nullif(btrim(coalesce(r ->> 'linkedin_url', '')), '');
    v_norm := crm.normalize_linkedin_url(v_url);
    if v_name is null and v_norm is null then
      n_skip := n_skip + 1;
      v_warn := v_warn || jsonb_build_object('id', v_legacy_id, 'warnung', 'weder Name noch LinkedIn-URL – übersprungen');
      continue;
    end if;
    select sp.title, sp.first_name, sp.last_name into v_title, v_first, v_last from crm.split_person_name(v_name) sp;
    v_company := nullif(btrim(coalesce(r ->> 'unternehmen', '')), '');
    v_status := nullif(btrim(coalesce(r ->> 'status', '')), '');
    if v_status = 'None' then v_status := null; end if;
    v_phase := nullif(btrim(coalesce(r ->> 'lead_phase', '')), '');
    v_mitarbeiter := r ->> 'mitarbeiter';
    v_zust := coalesce(r ->> 'dm_zustaendigkeit_resolved', r ->> 'dm_zustaendigkeit');
    v_opened_by := r ->> 'gespraech_eroeffnet_von';
    v_notes := nullif(r ->> 'notizen', '');
    d_req_mike := crm.any_date(r ->> 'mike_anfrage_gesendet_am');
    d_req_vin := crm.any_date(r ->> 'vincent_anfrage_gesendet_am');
    v_acc_mike := coalesce((r ->> 'mike_akzeptiert') = 'Ja', false);
    v_acc_vin := coalesce((r ->> 'vincent_akzeptiert') = 'Ja', false);
    d_opened := crm.any_date(r ->> 'gespraechseroeffnung_am');
    d_last_fu := crm.any_date(r ->> 'letztes_dm_follow_up_am');
    d_eg := crm.any_date(r ->> 'erstgespraech_am');
    d_sg := crm.any_date(r ->> 'strategiegespraech_am');
    d_next := crm.any_date(r ->> 'naechster_follow_up_am');
    v_fu_count := nullif(regexp_replace(coalesce(r ->> 'dm_follow_ups_anzahl', ''), '[^0-9]', '', 'g'), '')::int;
    sigs := case when jsonb_typeof(r -> '_note_signals') = 'array' then r -> '_note_signals' else crm.parse_legacy_note(v_notes) end;

    -- 2) Signale aus der Notiz -------------------------------------------------------------------------
    d_annahme := null; d_annahme_vin := null; d_fo_sent := null; d_reply_sig := null; d_ended := null; d_fc_held := null; d_next_appt := null; d_leading := null;
    v_step_seq := null; v_step_no := null; v_dnc := false; v_reply_evidence := false;
    k_no_need := false; k_not_icp := false; k_not_qual := false; k_no_interest := false; k_problem := false;
    for sig in select * from jsonb_array_elements(coalesce(sigs, '[]'::jsonb)) loop
      case sig ->> 'kind'
        when 'connection_accepted' then d_annahme := crm.any_date(sig ->> 'date');
        when 'connection_accepted_vincent' then d_annahme_vin := crm.any_date(sig ->> 'date');
        when 'first_outreach_sent' then d_fo_sent := crm.any_date(sig ->> 'date');
        when 'sequence_step_sent' then v_step_seq := sig ->> 'sequence'; v_step_no := nullif(sig ->> 'step', '')::int;
        when 'reply_received', 'reply_received_undated' then v_reply_evidence := true; d_reply_sig := coalesce(d_reply_sig, crm.any_date(sig ->> 'date'));
        when 'ended' then d_ended := crm.any_date(sig ->> 'date');
        when 'first_call_held' then d_fc_held := crm.any_date(sig ->> 'date');
        when 'next_appointment' then d_next_appt := crm.any_date(sig ->> 'date');
        when 'leading_date' then d_leading := crm.any_date(sig ->> 'date');
        when 'do_not_contact' then v_dnc := true;
        when 'no_need' then k_no_need := true; v_reply_evidence := true;
        when 'problem_unknown', 'problem_absent' then k_problem := true; v_reply_evidence := true;
        when 'no_interest' then k_no_interest := true; v_reply_evidence := true;
        when 'not_icp' then k_not_icp := true;
        when 'not_qualified' then k_not_qual := true;
        else null;
      end case;
    end loop;

    -- 3) Personen & Zuständigkeit ----------------------------------------------------------------------
    v_mitarbeiter_id := case v_mitarbeiter when 'Mike' then v_mike when 'Vincent' then v_vincent else null end;
    v_opened_by_id := case v_opened_by when 'Mike' then v_mike when 'Vincent' then v_vincent else null end;
    v_released := coalesce((r ->> 'fuer_anderen_freigegeben') = 'Ja', false);
    v_owner := case v_zust when 'Mike' then v_mike when 'Vincent' then v_vincent else coalesce(v_opened_by_id, v_mitarbeiter_id) end;
    if v_owner is null then v_owner := case when v_acc_vin then v_vincent when v_acc_mike then v_mike end; end if;
    if v_released then v_owner := null; end if;
    v_created := least(d_req_mike, d_req_vin, d_annahme, d_annahme_vin, d_opened, d_leading, crm.today());

    -- 4) Stufe ableiten ----------------------------------------------------------------------------------
    v_lang := d_next is not null and d_next > crm.today() + 45;
    v_reason := null;
    if v_status in ('Beendet', 'Nicht qualifiziert') or v_phase = 'Beendet' then
      if d_next is not null and d_next > crm.today() then
        v_stage := 'langfristig';
      else
        v_stage := 'beendet';
        v_reason := case when k_not_icp then 'nicht_icp'::crm.ended_reason
                         when k_not_qual or v_status = 'Nicht qualifiziert' then 'nicht_qualifiziert'::crm.ended_reason
                         when k_no_need or k_problem then 'kein_bedarf'::crm.ended_reason
                         when k_no_interest then 'kein_interesse'::crm.ended_reason
                         else 'sonstiges'::crm.ended_reason end;
      end if;
    elsif v_status = 'Kunde' then v_stage := 'kunde';
    elsif d_sg is not null or v_status = 'SG Folgebesprechung' then v_stage := 'strategiegespraech';
    elsif v_status in ('SG vereinbart', 'SG neu terminieren') then v_stage := 'strategiegespraech_vereinbart';
    elsif v_status = 'Follow-Up' then v_stage := 'sales_follow_up';
    elsif d_fc_held is not null or (d_eg is not null and d_eg < crm.today() and coalesce(v_status, '') not in ('EG vereinbart', 'EG neu terminieren')) then v_stage := 'erstgespraech';
    elsif d_eg is not null or v_status in ('EG vereinbart', 'EG neu terminieren') then v_stage := 'erstgespraech_vereinbart';
    elsif v_status = 'Pitch' then v_stage := 'pitch';
    elsif v_status = 'In Gespräch' then v_stage := case when v_lang then 'langfristig'::crm.lead_stage else 'dm_beantwortet'::crm.lead_stage end;
    elsif v_status in ('DM Follow-Up', 'Keine Antwort') then v_stage := case when v_lang then 'langfristig'::crm.lead_stage else 'dm_follow_up'::crm.lead_stage end;
    elsif v_status in ('Eröffnung', 'Offen') or d_opened is not null then v_stage := 'gespraech_eroeffnet';
    elsif v_acc_mike or v_acc_vin then v_stage := 'vernetzt';
    else v_stage := 'neu';
    end if;

    if p_dry_run then
      n_dry := n_dry + 1;
      v_warn := v_warn || jsonb_build_object('id', v_legacy_id, 'name', v_name, 'stufe', v_stage, 'grund', v_reason, 'owner', v_owner, 'naechster', d_next);
      continue;
    end if;

    -- 5) Firma -------------------------------------------------------------------------------------------
    v_company_id := null;
    if v_company is not null then
      -- Patch BAUPLAN § 3.1.2 / § 1.5 Nr. 27: Firmensperre „NICHT ANSCHREIBEN“ auf die erkannte Firma (v_dnc aus den Notiz-Signalen)
      insert into crm.companies (name, do_not_contact) values (v_company, v_dnc)
      on conflict (name_norm) do update set name = crm.companies.name,
                                            do_not_contact = crm.companies.do_not_contact or excluded.do_not_contact
      returning id into v_company_id;
    end if;

    -- 6) Lead anlegen oder aktualisieren -------------------------------------------------------------------
    v_existing := null;
    select id into v_existing from crm.leads
     where (v_norm is not null and linkedin_url_norm = v_norm) or (v_legacy_id is not null and legacy_id = v_legacy_id)
     order by (linkedin_url_norm = v_norm) desc nulls last limit 1;

    if v_existing is not null then
      v_has_app := exists (select 1 from crm.activities a where a.lead_id = v_existing and a.source = 'app' and a.type not in ('angelegt', 'import'));
      if v_has_app then
        update crm.leads set legacy_id = coalesce(legacy_id, v_legacy_id),
                             legacy_system_id = coalesce(legacy_system_id, nullif(r ->> 'system_id', '')::uuid),
                             legacy_system_id_2 = coalesce(legacy_system_id_2, nullif(r ->> 'system_id_2', '')::uuid),
                             notes = coalesce(notes, v_notes), company_id = coalesce(company_id, v_company_id), company_name = coalesce(company_name, v_company),
                             custom = custom || jsonb_build_object('legacy', r - '_note_signals')
         where id = v_existing;
        n_skip := n_skip + 1;
        v_warn := v_warn || jsonb_build_object('id', v_legacy_id, 'warnung', 'Lead hat bereits App-Aktivitäten – nur Lücken gefüllt, Historie nicht ersetzt');
        continue;
      end if;
      -- Sheet-Daten des Leads entfernen und Spiegelfelder zurücksetzen (Re-Run)
      delete from crm.activities where lead_id = v_existing and source = 'import_sheet';
      delete from crm.enrollments where lead_id = v_existing and source = 'import_sheet';
      delete from crm.tasks where lead_id = v_existing and source = 'import_sheet';
      delete from crm.meetings where lead_id = v_existing and source = 'import_sheet';
      delete from crm.linkedin_connections where lead_id = v_existing and source = 'import_sheet';
      update crm.leads set stage = 'neu', ended_reason = null, ended_at = null, ended_note = null, follow_up_count = 0,
                           last_activity_at = null, last_activity_type = null, last_outbound_at = null, last_inbound_at = null,
                           last_inbound_channel = null, inbound_unanswered_since = null,
                           title = v_title, first_name = v_first, last_name = v_last, linkedin_url = coalesce(v_url, linkedin_url),
                           company_id = v_company_id, company_name = v_company, owner_id = v_owner, opened_by_id = v_opened_by_id,
                           released = v_released, released_at = case when v_released then crm.due_on(v_created) end, notes = v_notes,
                           legacy_id = v_legacy_id, legacy_system_id = nullif(r ->> 'system_id', '')::uuid, legacy_system_id_2 = nullif(r ->> 'system_id_2', '')::uuid,
                           custom = custom || jsonb_build_object('legacy', r - '_note_signals'), source = 'import_sheet', source_batch_id = v_batch,
                           created_at = crm.due_on(v_created)
       where id = v_existing;
      v_lead := v_existing;
      n_upd := n_upd + 1;
    else
      insert into crm.leads (salutation, title, first_name, last_name, role, company_id, company_name, linkedin_url, owner_id, opened_by_id,
                             released, released_at, stage, notes, source, source_batch_id, legacy_id, legacy_system_id, legacy_system_id_2,
                             custom, created_by, created_at)
      values ('neutral', v_title, v_first, v_last, 'unbekannt', v_company_id, v_company, v_url, v_owner, v_opened_by_id,
              v_released, case when v_released then crm.due_on(v_created) end, 'neu', v_notes, 'import_sheet', v_batch, v_legacy_id,
              nullif(r ->> 'system_id', '')::uuid, nullif(r ->> 'system_id_2', '')::uuid,
              jsonb_build_object('legacy', r - '_note_signals'), v_me, crm.due_on(v_created))
      returning id into v_lead;
      n_new := n_new + 1;
    end if;

    -- 7) Vernetzungen je Person (beide können dieselbe Person angefragt haben) ----------------------------
    if v_acc_mike or d_req_mike is not null then
      d_acc := case when v_acc_mike then coalesce(case when v_mitarbeiter = 'Mike' then d_annahme end,
                                                case when d_req_mike is not null then least(d_req_mike + 1, coalesce(d_opened, d_req_mike + 1)) end,
                                                d_opened, v_created) end;
      insert into crm.linkedin_connections (lead_id, member_id, requested_at, accepted_at, status, source, kpi_relevant, note)
      values (v_lead, v_mike, case when d_req_mike is not null then crm.due_on(d_req_mike) end, case when d_acc is not null then crm.due_on(d_acc) end,
              case when v_acc_mike then 'angenommen'::crm.connection_status else 'ausstehend'::crm.connection_status end, 'import_sheet',
              not crm.has_kpi_sheet(v_mike, coalesce(d_acc, d_req_mike, v_created)),
              'Import CRM-Sheet' || case when v_acc_mike and (v_mitarbeiter <> 'Mike' or d_annahme is null) then ' (Annahmedatum geschätzt)' else '' end)
      on conflict (lead_id, member_id) do nothing;
      n_conn := n_conn + 1;
    end if;
    if v_acc_vin or d_req_vin is not null then
      d_acc := case when v_acc_vin then coalesce(d_annahme_vin, case when v_mitarbeiter = 'Vincent' then d_annahme end,
                                               case when d_req_vin is not null then least(d_req_vin + 1, coalesce(d_opened, d_req_vin + 1)) end,
                                               d_opened, v_created) end;
      insert into crm.linkedin_connections (lead_id, member_id, requested_at, accepted_at, status, source, kpi_relevant, note)
      values (v_lead, v_vincent, case when d_req_vin is not null then crm.due_on(d_req_vin) end, case when d_acc is not null then crm.due_on(d_acc) end,
              case when v_acc_vin then 'angenommen'::crm.connection_status else 'ausstehend'::crm.connection_status end, 'import_sheet',
              not crm.has_kpi_sheet(v_vincent, coalesce(d_acc, d_req_vin, v_created)),
              'Import CRM-Sheet' || case when v_acc_vin and d_annahme_vin is null and (v_mitarbeiter <> 'Vincent' or d_annahme is null) then ' (Annahmedatum geschätzt)' else '' end)
      on conflict (lead_id, member_id) do nothing;
      n_conn := n_conn + 1;
    end if;

    -- 8) Gesprächseröffnung --------------------------------------------------------------------------------
    if d_opened is not null then
      perform crm.log_activity(v_lead, coalesce(v_opened_by_id, v_owner), 'linkedin', 'gespraech_eroeffnet', crm.due_on(d_opened) + interval '1 hour',
                               null, 'gesendet', null, jsonb_build_object('legacy', true, 'step', 'Opener', 'position', 1),
                               p_kpi_relevant => not crm.has_kpi_sheet(coalesce(v_opened_by_id, v_owner), d_opened), p_source => 'import_sheet');
      n_act := n_act + 1;
    end if;

    -- 9) DM-Follow-ups: letzter exakt (Sheet-Datum), frühere gleichmäßig zwischen Eröffnung und letztem geschätzt ---
    if d_last_fu is not null then
      v_fu_count := greatest(coalesce(v_fu_count, 1), 1);
      for v_i in 1..v_fu_count loop
        d_i := case when v_i = v_fu_count then d_last_fu
                    else coalesce(d_opened, d_last_fu - 3 * v_fu_count) + ((d_last_fu - coalesce(d_opened, d_last_fu - 3 * v_fu_count)) * v_i / v_fu_count) end;
        select id into v_tpl from crm.templates where key = 'li_fu_kurz_' || least(v_i, 3);
        perform crm.log_activity(v_lead, v_owner, 'linkedin', 'nachricht_gesendet', crm.due_on(d_i) + interval '2 hours', v_tpl, 'gesendet', null,
                                 jsonb_build_object('legacy', true, 'step', 'Kurzfristig ' || least(v_i, 3), 'position', v_i + 1, 'estimated', v_i < v_fu_count),
                                 p_kpi_relevant => not crm.has_kpi_sheet(v_owner, d_i), p_source => 'import_sheet');
        n_act := n_act + 1;
      end loop;
      update crm.leads set follow_up_count = v_fu_count where id = v_lead;
    end if;

    -- 10) Antwort des Leads ---------------------------------------------------------------------------------
    if v_reply_evidence or v_status = 'In Gespräch'
       or v_stage in ('dm_beantwortet', 'pitch', 'erstgespraech_vereinbart', 'erstgespraech', 'strategiegespraech_vereinbart', 'strategiegespraech', 'sales_follow_up', 'kunde') then
      d_reply := coalesce(d_reply_sig, d_leading, d_last_fu, d_fo_sent, d_ended, d_opened + 2, v_created);
      v_label := case when k_not_icp then 'nicht_icp'::crm.reply_label
                      when k_no_need or k_problem then 'kein_bedarf'::crm.reply_label
                      when k_no_interest then 'spaeter'::crm.reply_label
                      when coalesce(v_notes, '') ~* '(bereits|schon)[^.;|]*(KI|Lösung|Partner|Tool)' then 'hat_partner'::crm.reply_label
                      when coalesce(v_notes, '') ~* 'fragt' then 'frage'::crm.reply_label
                      when v_stage in ('pitch', 'erstgespraech_vereinbart', 'erstgespraech', 'strategiegespraech_vereinbart', 'strategiegespraech', 'sales_follow_up', 'kunde') then 'interessiert'::crm.reply_label
                      else 'sonstiges'::crm.reply_label end;
      perform crm.log_activity(v_lead, v_owner, 'linkedin', 'nachricht_erhalten', crm.due_on(d_reply) + interval '3 hours', null, v_label::text,
                               case when v_reply_evidence then v_notes end,
                               jsonb_build_object('legacy', true, 'estimated', d_reply_sig is null),
                               p_reply_label => v_label, p_kpi_relevant => not crm.has_kpi_sheet(v_owner, d_reply), p_source => 'import_sheet');
      n_act := n_act + 1;
    end if;

    -- 11) Meetings ------------------------------------------------------------------------------------------
    if d_eg is not null then
      insert into crm.meetings (lead_id, member_id, type, scheduled_at, duration_min, status, booked_at, source, outcome_note)
      values (v_lead, coalesce(v_mitarbeiter_id, v_owner), 'erstgespraech', crm.due_on(d_eg) + interval '1 hour', 15,
              case when d_fc_held is not null or (d_eg < crm.today() and coalesce(v_status, '') not in ('EG vereinbart', 'EG neu terminieren'))
                   then 'stattgefunden'::crm.meeting_status else 'geplant'::crm.meeting_status end,
              crm.due_on(coalesce(d_reply, d_opened, d_eg)), 'import_sheet', case when d_fc_held is not null then v_notes end);
      n_meet := n_meet + 1;
    end if;
    if d_sg is not null then
      insert into crm.meetings (lead_id, member_id, type, scheduled_at, duration_min, status, booked_at, source)
      values (v_lead, coalesce(v_mitarbeiter_id, v_owner), 'strategiegespraech', crm.due_on(d_sg) + interval '1 hour', 30,
              case when d_sg < crm.today() then 'stattgefunden'::crm.meeting_status else 'geplant'::crm.meeting_status end,
              crm.due_on(coalesce(d_eg, d_reply, d_opened, d_sg)), 'import_sheet');
      n_meet := n_meet + 1;
    end if;

    -- Patch 2 BAUPLAN § 3.1.2 / § 1.5 Nr. 42
    -- Sales-Verantwortlicher = Spalte „Mitarbeiter“ (INFO-Tab § 3: DM-Zuständigkeit und Sales-Verantwortlicher dürfen abweichen)
    if v_phase = 'Sales Lead' or d_eg is not null or d_sg is not null then
      update crm.leads set sales_owner_id = coalesce(v_mitarbeiter_id, v_owner) where id = v_lead;
    end if;

    -- 12) Endgültige Stufe mit historischem Datum (Import-Modus: Trigger loggt nicht; wir loggen für beendet/langfristig selbst) -----
    v_stage_date := coalesce(d_ended, case when v_stage = 'langfristig' then coalesce(d_reply, d_last_fu) end, d_next_appt, d_reply, d_eg, d_last_fu, d_opened, v_created);
    update crm.leads set stage = v_stage, ended_reason = v_reason,
                         ended_note = case when v_stage = 'beendet' then v_notes end,
                         ended_at = case when v_stage = 'beendet' then crm.due_on(coalesce(d_ended, v_stage_date)) + interval '4 hours' end,
                         stage_changed_at = crm.due_on(v_stage_date) + interval '4 hours'
     where id = v_lead and stage is distinct from v_stage;
    if v_stage in ('beendet', 'langfristig', 'kunde') then
      perform crm.log_activity(v_lead, v_owner, 'sonstiges', 'stage_wechsel', crm.due_on(v_stage_date) + interval '4 hours', null, v_stage::text,
                               case when v_stage = 'beendet' then v_notes end,
                               jsonb_build_object('legacy', true, 'to', v_stage, 'ended_reason', v_reason), p_source => 'import_sheet');
      n_act := n_act + 1;
    end if;

    -- 13) „Antwort offen“ nur, wenn die Notiz es sagt („Antwort von Vincent offen“, „individuelle Antwort ausstehend“) ---------
    update crm.leads
       set inbound_unanswered_since = case when coalesce(v_notes, '') ~* 'Antwort (von \w+ )?(offen|ausstehend)' then inbound_unanswered_since else null end
     where id = v_lead;

    -- 14) Sequenz oder Wiedervorlage -----------------------------------------------------------------------
    if v_stage in ('vernetzt', 'gespraech_eroeffnet', 'dm_follow_up') and d_next is not null then
      v_pos := case when v_stage = 'vernetzt' then 1
                    when v_step_seq = 'Langfristig' and v_step_no is not null then least(v_step_no + 5, 6)
                    when v_step_no is not null then least(v_step_no + 2, 6)
                    else least(coalesce(v_fu_count, 0) + 2, 6) end;
      v_enr := crm.enroll(v_lead, 'linkedin_standard', v_owner, crm.due_on(coalesce(d_opened, d_annahme, v_created)), v_pos, crm.due_on(d_next), 'Import CRM-Sheet');
      update crm.enrollments set last_step_at = crm.due_on(coalesce(d_last_fu, d_opened)), source = 'import_sheet' where id = v_enr;
      n_enr := n_enr + 1;
    elsif d_next is not null and v_stage not in ('beendet', 'kunde') then
      insert into crm.tasks (lead_id, member_id, kind, title, due_at, template_id, note, source, created_by)
      values (v_lead, v_owner, 'wiedervorlage',
              case when v_stage = 'langfristig' then 'Langfristig nachfassen' else 'Follow-up (aus Sheet)' end, crm.due_on(d_next),
              case when v_stage = 'langfristig' then (select id from crm.templates where key = 'li_fu_lang_1') end, v_notes, 'import_sheet', v_me);
      n_task := n_task + 1;
    elsif v_stage not in ('beendet', 'kunde', 'langfristig', 'neu') then
      v_warn := v_warn || jsonb_build_object('id', v_legacy_id, 'name', v_name, 'stufe', v_stage, 'warnung', 'kein nächster Schritt im Sheet („Nächster Follow-Up am“ leer)');
    end if;

    -- 15) Schlagworte -----------------------------------------------------------------------------------------
    insert into crm.lead_tags (lead_id, tag_id) select v_lead, id from crm.tags where name = 'Aus Sheet importiert' on conflict do nothing;
    if v_dnc then
      insert into crm.tags (name, color) values ('Nicht anschreiben', '#ff5b52') on conflict (name) do nothing;
      insert into crm.lead_tags (lead_id, tag_id) select v_lead, id from crm.tags where name = 'Nicht anschreiben' on conflict do nothing;
    end if;
    if coalesce(v_notes, '') ~* 'Empfehlungsgeber' then
      insert into crm.tags (name, color) values ('Empfehlungsgeber', '#86c79f') on conflict (name) do nothing;
      insert into crm.lead_tags (lead_id, tag_id) select v_lead, id from crm.tags where name = 'Empfehlungsgeber' on conflict do nothing;
    end if;

    -- 16) Import-Eintrag in der Chronik ---------------------------------------------------------------------
    perform crm.log_activity(v_lead, v_me, 'sonstiges', 'import', now(), null, null, null,
                             jsonb_build_object('quelle', 'CRM-Sheet', 'legacy_id', v_legacy_id, 'status', v_status, 'lead_phase', v_phase,
                                                'naechster_follow_up', d_next, 'dm_follow_ups', v_fu_count, 'stufe', v_stage, 'grund', v_reason,
                                                'beide_akzeptiert', v_acc_mike and v_acc_vin, 'batch', v_batch),
                             p_source => 'import_sheet');
    if v_acc_mike and v_acc_vin then
      v_warn := v_warn || jsonb_build_object('id', v_legacy_id, 'name', v_name, 'hinweis', 'Mike und Vincent sind beide vernetzt – nur eine Zuständigkeit (' || coalesce(v_zust, '?') || ')');
    end if;
    if v_company is null then
      v_warn := v_warn || jsonb_build_object('id', v_legacy_id, 'name', v_name, 'hinweis', 'Unternehmen fehlt');
    end if;
  end loop;

  if not p_dry_run then
    update crm.import_batches
       set inserted = n_new, updated = n_upd, skipped = n_skip,
           summary = jsonb_build_object('leads_neu', n_new, 'leads_aktualisiert', n_upd, 'uebersprungen', n_skip, 'vernetzungen', n_conn,
                                        'aktivitaeten', n_act, 'sequenzen', n_enr, 'aufgaben', n_task, 'meetings', n_meet, 'hinweise', v_warn)
     where id = v_batch;
  end if;

  return jsonb_build_object('batch_id', v_batch, 'dry_run', p_dry_run, 'vorschau', n_dry, 'leads_neu', n_new, 'leads_aktualisiert', n_upd,
                            'uebersprungen', n_skip, 'vernetzungen', n_conn, 'aktivitaeten', n_act, 'sequenzen', n_enr, 'aufgaben', n_task,
                            'meetings', n_meet, 'firmen', (select count(*) from crm.companies), 'hinweise', v_warn);
end;
$$;
comment on function crm.import_sheet_leads(jsonb, boolean) is 'Import des CRM-Sheets (crm_leads.json) nach crm.*: Leads, Firmen, Vernetzungen je Person, Aktivitäten (Opener, Follow-ups, Antworten, Stufenwechsel), Meetings, Sequenz-Enrollments mit richtigem Schritt und Fälligkeit, Wiedervorlagen. Idempotent; p_dry_run liefert nur die abgeleiteten Stufen.';

-- -----------------------------------------------------------------------------------------------------
-- 3. Prüfabfragen nach dem Import (manuell ausführen)
-- -----------------------------------------------------------------------------------------------------
-- Stufenverteilung je Zuständigkeit (Soll laut Sheet: DM Follow-Up 145 · Eröffnung/Offen 43 · Beendet 15 · In Gespräch 7 · ohne Status 3 · EG vereinbart 2 · Nicht qualifiziert 1):
--   select m.short_name, l.stage, count(*) from crm.leads l left join crm.members m on m.id = l.owner_id group by 1, 2 order by 1, crm.stage_rank(l.stage);
-- Heute-Queue je Person (Soll: Vincents Workspace 98 Zeilen, Mikes 80; ÜBERFÄLLIG Mike 74 / KOMMEND 6 am Stand des Sheets):
--   select m.short_name, q.section, count(*) from crm.v_today_queue q left join crm.members m on m.id = q.member_id group by 1, 2 order by 1, min(q.section_order);
-- KPI-Monat Vincent (Soll Sept: 288 / 55 / 51 / 10 / 1 / 1 · Okt: 305 / 93 / 82 / 19 / 0 / 0):
--   select short_name, month_key, vernetzungen_versendet, vernetzungen_angenommen, gespraeche_eroeffnet, dm_beantwortet, erstgespraech_gepitcht, erstgespraeche, annahme_quote, antwort_quote
--     from crm.v_funnel_monthly f join crm.members m on m.id = f.member_id order by 1, 2;
-- Leads ohne nächsten Schritt (Sheet-IDs 87, 88, 111, 138, 139 erwartet):
--   select legacy_id, full_name, stage, owner_id from crm.leads where next_action_at is null and stage not in ('beendet', 'kunde') order by legacy_id;
-- Rückgängig (nur Sheet-Leads ohne App-Aktivität): select crm.undo_import('<batch_id>');
