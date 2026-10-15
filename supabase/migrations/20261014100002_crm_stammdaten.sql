-- =====================================================================================================
-- CRM Steiner & Co. · Migration 2 · Stammdaten = seed.sql Abschnitte 1, 2, 4, 5, 6, 7 (ohne Abschnitt 3 „Vorlagen“ → supabase/seed-privat/vorlagen.sql, BAUPLAN § 1.5 Nr. 9)
-- + Ergänzung BAUPLAN § 4.5 (am Ende). Idempotent; läuft im Runbook § 9.2 ein zweites Mal nach dem privaten Vorlagen-Seed (verknüpft sequence_steps.template_id).
-- Stand: 2026-10-14 · Generiert aus import/leitfaeden.json, research/telefon-leitfaeden.json, research/email-vorlagen.json
-- durch tools/gen_seed.py – Texte byte-genau. Nach schema.sql ausführen. Enthält KEINE Lead-Daten (siehe import-mapping.sql).
-- =====================================================================================================

-- -----------------------------------------------------------------------------------------------------
-- 1. Mitglieder-Profile (Vincent, Mike) – Kurzname = erstes Wort des Anzeigenamens
-- -----------------------------------------------------------------------------------------------------
insert into crm.member_profiles (member_id, short_name, email_address, linkedin_plan, weekly_budget, daily_target)
select m.user_id, split_part(m.display_name, ' ', 1), m.email, 'premium', 150, 30
  from public.members m
on conflict (member_id) do update set short_name = coalesce(crm.member_profiles.short_name, excluded.short_name),
                                      email_address = coalesce(crm.member_profiles.email_address, excluded.email_address);

-- -----------------------------------------------------------------------------------------------------
-- 2. Ergebnis-Taxonomie Telefon (research/telefon.md §2.2)
-- -----------------------------------------------------------------------------------------------------
insert into crm.call_outcome_defs (outcome, label, hotkey, group_label, is_connect, is_dm, counts_attempt, default_next_action, sort_order) values
  ('no_answer',          'Nicht erreicht',                                      '1', 'A Niemand erreicht',                 false, false, true,  'Nächster Versuch laut Kadenz', 1),
  ('busy',               'Besetzt',                                             '2', 'A Niemand erreicht',                 false, false, false, 'Erneut in 30–60 min (gleicher Tag)', 2),
  ('voicemail',          'Mailbox (keine Nachricht)',                           '3', 'A Niemand erreicht',                 false, false, true,  'Nächster Versuch laut Kadenz', 3),
  ('voicemail_left',     'Mailbox – Nachricht hinterlassen',                    '4', 'A Niemand erreicht',                 false, false, true,  'Nächster Versuch laut Kadenz + Hinweis „LinkedIn-DM senden?“', 4),
  ('wrong_number',       'Falsche / ungültige Nummer',                          'X', 'A Niemand erreicht',                 false, false, false, 'Nummer recherchieren (Aufgabe), Lead nicht beenden', 5),
  ('gatekeeper',         'Zentrale / Vorzimmer – Entscheider nicht erreichbar', '5', 'B Erreicht, nicht der Entscheider',  true,  false, true,  'Rückruf zum erfragten Zeitfenster (bester Zeitpunkt + Durchwahl)', 6),
  ('gatekeeper_blocked', 'Zentrale blockt – Infos per E-Mail gewünscht',        '6', 'B Erreicht, nicht der Entscheider',  true,  false, true,  'E-Mail „Kurzinfo“ senden + Wiedervorlage +3 Werktage', 7),
  ('callback_scheduled', 'Rückruf vereinbart',                                  '7', 'B Erreicht, nicht der Entscheider',  true,  false, true,  'Termin (Datum/Uhrzeit Pflicht) → oben in Queue', 8),
  ('dm_interest',        'Entscheider – Interesse, noch kein Termin',           '8', 'C Entscheider gesprochen',           true,  true,  true,  'Wiedervorlage ≤ 3 Werktage / Pitch erneut', 9),
  ('meeting_booked',     'Termin (Erstgespräch) vereinbart',                    '9', 'C Entscheider gesprochen',           true,  true,  true,  'Kalender-Einladung + E-Mail mit Datenschutz-Link; Lead-Phase → Erstgespräch', 10),
  ('send_info',          '„Schicken Sie mal was“ – Info per E-Mail',            '0', 'C Entscheider gesprochen',           true,  true,  true,  'E-Mail „Kurzinfo“ + Rückruf vereinbaren (Datum Pflicht)', 11),
  ('not_now',            'Kein Bedarf aktuell – Wiedervorlage',                 'W', 'C Entscheider gesprochen',           true,  true,  true,  'Langfristig (Standard +3 Monate, Datum editierbar)', 12),
  ('not_interested',     'Kein Interesse – beendet',                            'K', 'C Entscheider gesprochen',           true,  true,  true,  'Lead-Status Beendet (Grund-Pflichtfeld)', 13),
  ('not_icp',            'Nicht ICP / nicht qualifiziert',                      'Q', 'C Entscheider gesprochen',           true,  false, true,  'Beendet (Grund: zu klein / kein Innendienst / Projektentwickler …)', 14),
  ('do_not_call',        'Werbewiderspruch – nicht mehr kontaktieren',          'D', 'C Entscheider gesprochen',           true,  false, true,  'Sperrliste (Kanal-Umfang Pflicht), Lead-Status Beendet, Bestätigungsdialog', 15)
on conflict (outcome) do update set label = excluded.label, hotkey = excluded.hotkey, group_label = excluded.group_label,
  is_connect = excluded.is_connect, is_dm = excluded.is_dm, counts_attempt = excluded.counts_attempt,
  default_next_action = excluded.default_next_action, sort_order = excluded.sort_order;

-- -----------------------------------------------------------------------------------------------------
-- 4. Sequenzen (Kadenzen). delay_days = Kalendertage ab dem vorherigen erledigten Schritt; Sa/So/Feiertag → nächster Werktag.
--    Exit-Regeln gelten immer: Antwort erhalten · Meeting gebucht · Beendet/Kunde · Widerspruch (siehe Trigger).
-- -----------------------------------------------------------------------------------------------------
insert into crm.sequences (key, name, channel, description, trigger_kind, weekdays_only, active) values
  ('linkedin_standard', 'LinkedIn Standard (ohne Notiz)', 'linkedin',
   'Nach Annahme der Vernetzung: Opener (Tag 0) → Kurzfristig 1 (+3) → Kurzfristig 2 (+7, wichtigster Touch) → Kurzfristig 3 (+10, Breakup) → Langfristig 1 (+70) → Langfristig 2 (+84). Danach Lead „Langfristig“.',
   'vernetzung_angenommen', true, true),
  ('linkedin_vernetzt_ohne_antwort', 'LinkedIn „Vernetzt ohne Antwort“ (Anfrage mit Notiz)', 'linkedin',
   'Vernetzung mit Nachricht angenommen, keine Antwort: Re-Opener (+2) → Kurzfristig 1 (+4) → Kurzfristig 2 (+7) → Kurzfristig 3 (+10) → Langfristig 1 (+70) → Langfristig 2 (+84).',
   'vernetzung_mit_notiz_angenommen', true, true),
  ('linkedin_nachfassen_im_gespraech', 'LinkedIn Nachfassen im Gespräch', 'linkedin',
   'Lead hat geantwortet, wir haben geantwortet (Bedarfsermittlung oder Pitch), dann Stille: Nachfassen (+3) → Abhaken oder weiter? (+7) → Langfristig (+70).',
   'antwort_gesendet', true, true),
  ('telefon_standard', 'Telefon Standard (5 Versuche)', 'telefon',
   '5 Versuche in ca. 3 Wochen zu wechselnden Tageszeiten; Mailbox-Nachricht bei Versuch 2 und 4; danach Langfristig (+90 Tage). Besetzt und falsche Nummer zählen nicht als Versuch.',
   'telefon_nicht_erreicht', true, true),
  ('email_warm_after_erstgespraech', 'E-Mail Nachbereitung Erstgespräch', 'email',
   'E0 Zusammenfassung (Tag 0, ≤ 2 h) → E1 Nachfassen (+3) → E2 Mehrwert (+7 = Tag 10) → E3 Abhaken (+11 = Tag 21) → E4 Langfristig (+69 = Tag 90). Nur mit Erlaubnis-Grundlage meeting_held; Folgemails im selben Thread („Re:“).',
   'erstgespraech_stattgefunden', true, true),
  ('email_info_nach_linkedin_zusage', 'E-Mail Infomail nach LinkedIn-Zusage', 'email',
   'I0 Infomail (≤ 24 h) → I1 Nachfassen (+4) → I2 Abhaken (+8). Maximal 3 Mails je Erlaubnis-Grundlage requested_linkedin.',
   'info_zugesagt_linkedin', true, true),
  ('email_info_nach_telefonat', 'E-Mail Infomail nach Telefonat', 'email',
   'I0 Infomail am selben Tag → I1 Nachfassen (+4) → I2 Abhaken (+8). Maximal 3 Mails je Erlaubnis-Grundlage requested_phone.',
   'info_zugesagt_telefon', true, true)
on conflict (key) do update set name = excluded.name, channel = excluded.channel, description = excluded.description,
  trigger_kind = excluded.trigger_kind, weekdays_only = excluded.weekdays_only;

with steps (seq_key, position, name, kind, delay_days, template_key, is_opener, sets_stage, instructions) as (values
  -- Sequenz A – LinkedIn Standard (research/linkedin.md §5.2)
  ('linkedin_standard', 1, 'Opener',                   'nachricht', 0,  'li_eroeffnung_v1', true,  'gespraech_eroeffnet', 'Vorlage nach Rolle: V1 (Standard) · V3 (Zeitaufwand) · ZG-Kundenbetreuer (du-Form). Am Tag der Annahme, spätestens +2.'),
  ('linkedin_standard', 2, 'Kurzfristig 1',            'nachricht', 3,  'li_fu_kurz_1',     false, 'dm_follow_up',        null),
  ('linkedin_standard', 3, 'Kurzfristig 2',            'nachricht', 7,  'li_fu_kurz_2',     false, 'dm_follow_up',        'Wichtigster Touch – nicht überspringen.'),
  ('linkedin_standard', 4, 'Kurzfristig 3 (Breakup)',  'nachricht', 10, 'li_fu_kurz_3',     false, 'dm_follow_up',        'Letzter kurzfristiger Follow-up.'),
  ('linkedin_standard', 5, 'Langfristig 1',            'nachricht', 70, 'li_fu_lang_1',     false, 'langfristig',         'Nach ca. 10 Wochen.'),
  ('linkedin_standard', 6, 'Langfristig 2',            'nachricht', 84, 'li_fu_lang_2',     false, 'langfristig',         'Letzter Touch. Danach Archiv „Kein Ergebnis“.'),
  -- Sequenz B – Vernetzung mit Notiz angenommen, keine Antwort (§5.3)
  ('linkedin_vernetzt_ohne_antwort', 1, 'Re-Opener',                  'nachricht', 2,  'li_bedarf_vernetzt_ohne_antwort', true,  'gespraech_eroeffnet', 'Erst, wenn 2 Tage nach Annahme keine Antwort kam.'),
  ('linkedin_vernetzt_ohne_antwort', 2, 'Kurzfristig 1',              'nachricht', 4,  'li_fu_kurz_1', false, 'dm_follow_up', null),
  ('linkedin_vernetzt_ohne_antwort', 3, 'Kurzfristig 2',              'nachricht', 7,  'li_fu_kurz_2', false, 'dm_follow_up', null),
  ('linkedin_vernetzt_ohne_antwort', 4, 'Kurzfristig 3 (Breakup)',    'nachricht', 10, 'li_fu_kurz_3', false, 'dm_follow_up', null),
  ('linkedin_vernetzt_ohne_antwort', 5, 'Langfristig 1',              'nachricht', 70, 'li_fu_lang_1', false, 'langfristig',  null),
  ('linkedin_vernetzt_ohne_antwort', 6, 'Langfristig 2',              'nachricht', 84, 'li_fu_lang_2', false, 'langfristig',  null),
  -- Sequenz C – Nachfassen im Gespräch (§5.4)
  ('linkedin_nachfassen_im_gespraech', 1, 'Nachfassen',            'nachricht', 3,  'li_fu_kurz_1', false, null,          'Nach Pitch stattdessen „Pitch B“ mit zwei neuen Slots.'),
  ('linkedin_nachfassen_im_gespraech', 2, 'Abhaken oder weiter?',  'nachricht', 7,  'li_fu_kurz_3', false, null,          null),
  ('linkedin_nachfassen_im_gespraech', 3, 'Langfristig',           'nachricht', 70, 'li_fu_lang_2', false, 'langfristig', null),
  -- Telefon Standard (research/telefon.md §2.3)
  ('telefon_standard', 1, 'Versuch 1 · Slot A 09:30–11:30',                'anruf', 0,  'tel_einstieg_1', false, null,          'Erster Versuch. Anrufgrund (call_basis) muss gesetzt sein.'),
  ('telefon_standard', 2, 'Versuch 2 · Slot B 14:00–16:00 · Mailbox 1',    'anruf', 2,  'tel_mailbox_1',  false, null,          'Bei Mailbox: Nachricht „Mailbox 1“ hinterlassen. Parallel: LinkedIn-DM „Kurzfristig 1“ oder E-Mail, falls Erlaubnis vorhanden.'),
  ('telefon_standard', 3, 'Versuch 3 · Slot C 16:00–17:30',                'anruf', 3,  'tel_einstieg_1', false, null,          null),
  ('telefon_standard', 4, 'Versuch 4 · Slot D 08:00–09:30 · Mailbox 2',    'anruf', 4,  'tel_mailbox_2',  false, null,          'Letzte Mailbox-Nachricht. Parallel: E-Mail „Kurzinfo“, falls Erlaubnis vorhanden.'),
  ('telefon_standard', 5, 'Versuch 5 · anderer Wochentag, Slot A',         'anruf', 5,  'tel_einstieg_1', false, 'langfristig', 'Nach Versuch 5 ohne Erfolg → Langfristig.'),
  ('telefon_standard', 6, 'Langfristig – neuer Anlauf',                    'anruf', 90, 'tel_einstieg_1', false, null,          'Kadenz startet neu mit 3 Versuchen.'),
  -- E-Mail: Nachbereitung Erstgespräch (research/email.md §5.2)
  ('email_warm_after_erstgespraech', 1, 'E0 Zusammenfassung',     'email', 0,  'em_erstgespraech_zusammenfassung', false, null,          'Am Tag des Gesprächs, ≤ 2 h. [Punkt 1–3] sind Pflicht.'),
  ('email_warm_after_erstgespraech', 2, 'E1 Nachfassen',          'email', 3,  'em_nachfassen_3_tage',             false, null,          'Im selben Thread („Re:“).'),
  ('email_warm_after_erstgespraech', 3, 'E2 Mehrwert / Einwand',  'email', 7,  'em_nachfassen_10_tage_mehrwert',   false, null,          'Mehrwert-Absatz pro Lead schreiben.'),
  ('email_warm_after_erstgespraech', 4, 'E3 Abhaken oder weiter?','email', 11, 'em_nachfassen_abhaken',            false, null,          null),
  ('email_warm_after_erstgespraech', 5, 'E4 Langfristig',         'email', 69, 'em_langfristig',                   false, 'langfristig', 'Neuer Thread (neuer Betreff).'),
  -- E-Mail: Infomail nach LinkedIn-Zusage / Telefonat (§5.3)
  ('email_info_nach_linkedin_zusage', 1, 'I0 Infomail',   'email', 0, 'em_info_nach_linkedin_zusage', false, null, 'Innerhalb von 24 h nach der Zusage; Erlaubnis mit Zitat erfassen.'),
  ('email_info_nach_linkedin_zusage', 2, 'I1 Nachfassen', 'email', 4, 'em_nachfassen_3_tage',         false, null, 'Sinngemäß anpassen („meine Infos“ statt „Zusammenfassung“).'),
  ('email_info_nach_linkedin_zusage', 3, 'I2 Abhaken?',   'email', 8, 'em_nachfassen_abhaken',        false, null, 'Letzte Mail unter dieser Grundlage.'),
  ('email_info_nach_telefonat', 1, 'I0 Infomail',   'email', 0, 'em_info_nach_telefonat', false, null, 'Am selben Tag wie das Telefonat.'),
  ('email_info_nach_telefonat', 2, 'I1 Nachfassen', 'email', 4, 'em_nachfassen_3_tage',   false, null, null),
  ('email_info_nach_telefonat', 3, 'I2 Abhaken?',   'email', 8, 'em_nachfassen_abhaken',  false, null, 'Letzte Mail unter dieser Grundlage.')
)
insert into crm.sequence_steps (sequence_id, position, name, kind, delay_days, template_id, is_opener, sets_stage, instructions)
select s.id, st.position, st.name, st.kind::crm.step_kind, st.delay_days, t.id, st.is_opener, st.sets_stage::crm.lead_stage, st.instructions
  from steps st
  join crm.sequences s on s.key = st.seq_key
  left join crm.templates t on t.key = st.template_key
on conflict (sequence_id, position) do update set name = excluded.name, kind = excluded.kind, delay_days = excluded.delay_days,
  template_id = excluded.template_id, is_opener = excluded.is_opener, sets_stage = excluded.sets_stage, instructions = excluded.instructions;

-- -----------------------------------------------------------------------------------------------------
-- 5. Einstellungen (Objekte werden gemergt: neue Schlüssel kommen dazu, bestehende Werte bleiben)
-- -----------------------------------------------------------------------------------------------------
insert into crm.settings (key, value, description) values
  ('zeitzone', '"Europe/Berlin"'::jsonb, 'Zeitzone der Fachlogik (Fälligkeiten, Tageszähler).'),
  ('linkedin', '{
      "weekly_budget_default": {"basic": 100, "premium": 150, "sales_navigator": 150},
      "daily_target_default": 30,
      "warn_at_pct": 90,
      "pending_withdraw_days": 21,
      "pending_expire_days": 180,
      "acceptance_warn_below": 0.20,
      "auto_enroll_on_accept": true,
      "default_sequence": "linkedin_standard",
      "note_sequence": "linkedin_vernetzt_ohne_antwort",
      "note_variant_share_max": 0.20
    }'::jsonb, 'LinkedIn-Hygiene: rollierendes Wochenbudget, Tagesziel, Zurückziehen offener Anfragen, Auto-Sequenz bei Annahme.'),
  ('queue', '{
      "due_time": "09:00",
      "weekdays_only": true,
      "snooze_options": ["+1", "+3", "montag", "+7", "datum", "+60"],
      "snooze_warn_after": 3,
      "withdraw_weekday": 5,
      "kommend_days": 7,
      "sections": ["antworten", "ueberfaellig", "heute", "annahme_pruefen", "neue_anfragen", "zurueckziehen", "kommend"]
    }'::jsonb, 'Heute-Queue: Fälligkeitsuhrzeit, Snooze-Optionen, Sektionen.'),
  ('telefon', '{
      "max_attempts": 5,
      "auto_enroll_on_no_answer": true,
      "default_sequence": "telefon_standard",
      "busy_retry_minutes": 45,
      "callback_default_time": "10:00",
      "slots": {"A": "09:30-11:30", "B": "14:00-16:00", "C": "16:00-17:30", "D": "08:00-09:30"},
      "require_call_basis": true
    }'::jsonb, 'Telefonie: Versuche, Slots, Auto-Kadenz bei Nicht-erreicht, Pflichtfeld Anrufgrund.'),
  ('email', '{
      "sending_enabled": false,
      "provider": "gmail_compose",
      "max_followups_per_consent": 3,
      "consent_max_age_months": 12,
      "auto_enroll_after_erstgespraech": true,
      "privacy_notice_version": "1.0",
      "privacy_url": "https://steinerundco.de/datenschutz-geschaeftskontakte",
      "objection_sentence": "Wenn Sie keine weiteren E-Mails von mir möchten, genügt eine kurze Antwort – dann melde ich mich nicht mehr.",
      "send_window": {"days": [2, 3, 4], "from": "08:30", "to": "16:30"}
    }'::jsonb, 'E-Mail: Versand aus (Compose-Link/mailto), Erlaubnis-Regeln, Pflichtbausteine.'),
  ('langfristig', '{"default_days": 60, "hat_partner_days": 180, "nicht_erreicht_days": 90, "kein_bedarf_days": 60}'::jsonb,
   'Standard-Wiedervorlagen in Tagen (INFO-Tab: kein Interesse / nicht qualifiziert → 60 Tage).'),
  ('kpi_targets', '{
      "annahme_quote": 0.28, "antwort_quote": 0.15, "pitch_quote": 0.40, "erstgespraech_quote": 0.50,
      "connect_rate": 0.15, "entscheider_quote": 0.08, "termine_pro_100_anrufe": 2, "antwortzeit_werktage": 1
    }'::jsonb, 'Zielwerte für das KPI-Dashboard (research/linkedin.md §3.1, telefon.md §5).'),
  ('feiertage', '["2026-10-03","2026-10-31","2026-12-25","2026-12-26","2027-01-01","2027-03-26","2027-03-29","2027-05-01","2027-05-06","2027-05-17","2027-10-03","2027-10-31","2027-12-25","2027-12-26"]'::jsonb,
   'Gesetzliche Feiertage Hamburg 2026/2027 (Fälligkeit rollt auf den nächsten Werktag).'),
  ('retention', '{"anonymize_no_reaction_months": 12, "anonymize_contact_months": 24, "calls_keep_years": 5}'::jsonb,
   'Löschfristen (DSGVO): ohne Reaktion 12 Monate, mit Kontakt 24 Monate; Anrufprotokolle 5 Jahre (angelehnt an § 7a UWG).'),
  ('stage_labels', '{
      "neu": {"label": "Neu", "short": "Neu", "group": "linkedin"},
      "vernetzung_gesendet": {"label": "Vernetzung gesendet", "short": "Angefragt", "group": "linkedin"},
      "vernetzt": {"label": "Vernetzt", "short": "Vernetzt", "group": "linkedin"},
      "gespraech_eroeffnet": {"label": "Gespräch eröffnet", "short": "Eröffnet", "group": "linkedin"},
      "dm_follow_up": {"label": "DM Follow-up", "short": "Follow-up", "group": "linkedin"},
      "dm_beantwortet": {"label": "Antwort erhalten", "short": "Im Gespräch", "group": "linkedin"},
      "bedarfsermittlung": {"label": "Bedarfsermittlung", "short": "Bedarf", "group": "linkedin"},
      "pitch": {"label": "Erstgespräch gepitcht", "short": "Pitch", "group": "linkedin"},
      "erstgespraech_vereinbart": {"label": "Erstgespräch vereinbart", "short": "EG vereinbart", "group": "sales"},
      "erstgespraech": {"label": "Erstgespräch geführt", "short": "EG geführt", "group": "sales"},
      "strategiegespraech_vereinbart": {"label": "Strategiegespräch vereinbart", "short": "SG vereinbart", "group": "sales"},
      "strategiegespraech": {"label": "Strategiegespräch geführt", "short": "SG geführt", "group": "sales"},
      "sales_follow_up": {"label": "Sales Follow-up", "short": "Follow-up", "group": "sales"},
      "kunde": {"label": "Kunde gewonnen", "short": "Kunde", "group": "sales"},
      "langfristig": {"label": "Langfristig", "short": "Langfristig", "group": "parkend"},
      "beendet": {"label": "Beendet", "short": "Beendet", "group": "parkend"}
    }'::jsonb, 'Anzeigetexte der Stufen (Frontend liest sie, damit DB und UI dieselbe Wahrheit zeigen).'),
  ('ended_reason_labels', '{
      "kein_bedarf": "Kein Bedarf", "nicht_icp": "Nicht ICP", "nicht_qualifiziert": "Nicht qualifiziert", "kein_interesse": "Kein Interesse",
      "falsche_nummer": "Falsche Nummer / Kontakt ungültig", "duplikat": "Duplikat", "widerspruch": "Widerspruch (nicht mehr kontaktieren)", "sonstiges": "Sonstiges"
    }'::jsonb, 'Anzeigetexte der Beendet-Gründe.')
on conflict (key) do update set
  value = case when jsonb_typeof(crm.settings.value) = 'object' and jsonb_typeof(excluded.value) = 'object'
               then excluded.value || crm.settings.value else crm.settings.value end,
  description = excluded.description;

-- -----------------------------------------------------------------------------------------------------
-- 6. Schlagworte
-- -----------------------------------------------------------------------------------------------------
insert into crm.tags (name, color, sort_order) values
  ('Nicht anschreiben', '#ff5b52', 1), ('Empfehlungsgeber', '#86c79f', 2), ('Kundenbetreuer', '#69e7df', 3),
  ('Geschäftsführer', '#caff68', 4), ('Notiz-Variante', '#ffb269', 5), ('Aus Sheet importiert', '#9aa0ad', 9)
on conflict (name) do nothing;

-- -----------------------------------------------------------------------------------------------------
-- 7. Gemeinsame Ansichten (member_id null = für beide). Filter-Konvention: {"feld": wert | [werte] | {"op": "...", "value": ...}}, "owner": "me"
-- -----------------------------------------------------------------------------------------------------
insert into crm.saved_views (member_id, entity, name, filters, sort, columns, is_default, sort_order)
select null, v.entity, v.name, v.filters::jsonb, v.sort::jsonb, v.columns::jsonb, v.is_default, v.sort_order
  from (values
    ('leads', 'Meine aktiven Leads',    '{"owner": "me", "stage": {"op": "not_in", "value": ["beendet", "kunde", "langfristig"]}}', '[{"field": "next_action_at", "dir": "asc", "nulls": "last"}]', '["full_name", "company_name", "stage", "next_action_label", "next_action_at", "last_activity_at"]', true, 1),
    ('leads', 'Ohne nächsten Schritt',  '{"stage": {"op": "not_in", "value": ["beendet", "kunde"]}, "next_action_at": {"op": "is_null"}}', '[{"field": "last_activity_at", "dir": "asc"}]', '["full_name", "company_name", "stage", "owner_id", "last_activity_at"]', false, 2),
    ('leads', 'Langfristig',            '{"stage": ["langfristig"]}', '[{"field": "next_action_at", "dir": "asc"}]', '["full_name", "company_name", "owner_id", "next_action_at", "notes"]', false, 3),
    ('leads', 'Sales-Leads',            '{"stage": ["erstgespraech_vereinbart", "erstgespraech", "strategiegespraech_vereinbart", "strategiegespraech", "sales_follow_up"]}', '[{"field": "stage_changed_at", "dir": "desc"}]', '["full_name", "company_name", "stage", "sales_owner_id", "next_action_at"]', false, 4),
    ('leads', 'Freigegeben (Pool)',     '{"released": true, "stage": {"op": "not_in", "value": ["beendet", "kunde"]}}', '[{"field": "released_at", "dir": "desc"}]', '["full_name", "company_name", "stage", "released_reason", "opened_by_id"]', false, 5),
    ('leads', 'Beendet',                '{"stage": ["beendet"]}', '[{"field": "ended_at", "dir": "desc"}]', '["full_name", "company_name", "ended_reason", "ended_at", "owner_id"]', false, 6),
    ('calls', 'Anrufliste heute',       '{"owner": "me", "kind": ["rueckruf"], "due": "today"}', '[{"field": "due_at", "dir": "asc"}]', '["lead_name", "company_name", "phone_e164", "due_at", "title"]', true, 7)
  ) as v(entity, name, filters, sort, columns, is_default, sort_order)
 where not exists (select 1 from crm.saved_views x where x.member_id is null and x.entity = v.entity and x.name = v.name);

-- -----------------------------------------------------------------------------------------------------
-- 8. Ergänzung BAUPLAN § 4.5 (§ 1.5 Nr. 28, 35): drei Sequenzen, ein Settings-Key (idempotent)
-- -----------------------------------------------------------------------------------------------------
-- Sequenzen: Strategiegespräch-Nachbereitung, No-Show Erstgespräch (transaktional), Sheet-Regel „A alt“ (inaktiv)
insert into crm.sequences (key, name, channel, description, trigger_kind, weekdays_only, active) values
  ('email_warm_after_strategiegespraech', 'E-Mail Nachbereitung Strategiegespräch', 'email',
   'S0 Zusammenfassung + nächste Schritte (Tag 0, ≤ 24 h) → S1 Nachfassen (+5) → S2 Entscheidung? (+9 = Tag 14). Grundlage meeting_held; Folgemails im Thread („Re:“). Start automatisch nach Strategiegespräch „stattgefunden“.',
   'manuell', true, true),
  ('email_noshow_erstgespraech', 'E-Mail No-Show Erstgespräch (transaktional)', 'email',
   'N0 „Wir haben uns verpasst – neuer Termin?“ (Tag 0) → N1 Nachfrage mit zwei Slots (+3). Organisatorisch, keine Werbeinhalte, keine Erlaubnis-Grundlage nötig. Start per Vorschlag nach Status No-Show.',
   'manuell', true, true),
  ('linkedin_sheet_regel', 'LinkedIn „A alt“ (Sheet-Regel INFO-Tab)', 'linkedin',
   'Alte Regel aus dem INFO-Tab: Opener → 3 Follow-ups im Abstand von je 3 Tagen → danach alle 30 Tage. Inaktiv; in Einstellungen → Sequenzen aktivierbar.',
   'manuell', true, false)
on conflict (key) do update set name = excluded.name, channel = excluded.channel, description = excluded.description,
  trigger_kind = excluded.trigger_kind, weekdays_only = excluded.weekdays_only;
-- (Enum sequence_trigger bleibt unverändert – 'manuell' ist Dokumentation; Erweiterung v1.1 Nr. 16.)

with steps (seq_key, position, name, kind, delay_days, template_key, is_opener, sets_stage, instructions) as (values
  ('email_warm_after_strategiegespraech', 1, 'S0 Zusammenfassung + nächste Schritte', 'email', 0, 'em_strategiegespraech_zusammenfassung', false, null, 'Am Tag des Gesprächs, ≤ 24 h. [Punkt 1–3] und [Nächster Schritt] sind Pflicht.'),
  ('email_warm_after_strategiegespraech', 2, 'S1 Nachfassen',                          'email', 5, 'em_nachfassen_3_tage',                  false, null, 'Im selben Thread („Re:“); „Zusammenfassung“ sinngemäß.'),
  ('email_warm_after_strategiegespraech', 3, 'S2 Entscheidung?',                       'email', 9, 'em_nachfassen_abhaken',                 false, null, 'Letzte Mail unter dieser Grundlage ohne neuen Anlass.'),
  ('email_noshow_erstgespraech', 1, 'N0 Verpasst – neuer Termin?', 'email', 0, 'em_noshow_erstgespraech', false, null, 'Sofort nach dem verpassten Termin (≤ 1 h). Transaktional: kein Widerspruchssatz, kein Produktabsatz.'),
  ('email_noshow_erstgespraech', 2, 'N1 Nachfrage',                'email', 3, 'em_noshow_erstgespraech', false, null, 'Betreff „Re: …“, zwei neue Slots als [Tag/Uhrzeit 1]/[Tag/Uhrzeit 2]. Danach Wiedervorlage oder Beenden.'),
  ('linkedin_sheet_regel', 1, 'Opener',                  'nachricht', 0,  'li_eroeffnung_v1', true,  'gespraech_eroeffnet', 'Vorlage nach Rolle wie Sequenz A.'),
  ('linkedin_sheet_regel', 2, 'Follow-up 1',             'nachricht', 3,  'li_fu_kurz_1',     false, 'dm_follow_up',        null),
  ('linkedin_sheet_regel', 3, 'Follow-up 2',             'nachricht', 3,  'li_fu_kurz_2',     false, 'dm_follow_up',        null),
  ('linkedin_sheet_regel', 4, 'Follow-up 3',             'nachricht', 3,  'li_fu_kurz_3',     false, 'dm_follow_up',        'Letzter kurzfristiger Follow-up (INFO-Tab Abschnitt 5).'),
  ('linkedin_sheet_regel', 5, 'Langfristig 1 (30 Tage)', 'nachricht', 30, 'li_fu_lang_1',     false, 'langfristig',         null),
  ('linkedin_sheet_regel', 6, 'Langfristig 2 (30 Tage)', 'nachricht', 30, 'li_fu_lang_2',     false, 'langfristig',         'Danach manuell alle 30 Tage (Wiedervorlage) oder Beenden.')
)
insert into crm.sequence_steps (sequence_id, position, name, kind, delay_days, template_id, is_opener, sets_stage, instructions)
select s.id, st.position, st.name, st.kind::crm.step_kind, st.delay_days, t.id, st.is_opener, st.sets_stage::crm.lead_stage, st.instructions
  from steps st
  join crm.sequences s on s.key = st.seq_key
  left join crm.templates t on t.key = st.template_key
on conflict (sequence_id, position) do update set name = excluded.name, kind = excluded.kind, delay_days = excluded.delay_days,
  template_id = excluded.template_id, is_opener = excluded.is_opener, sets_stage = excluded.sets_stage, instructions = excluded.instructions;

-- Settings: Auto-Enroll nach Strategiegespräch (Objekt-Merge, bestehende Werte bleiben)
update crm.settings set value = value || '{"auto_enroll_after_strategiegespraech": true}'::jsonb
 where key = 'email' and not (value ? 'auto_enroll_after_strategiegespraech');
