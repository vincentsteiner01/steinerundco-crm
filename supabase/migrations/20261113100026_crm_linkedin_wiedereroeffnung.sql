-- LinkedIn: Wiedereröffnung nach Stellenanzeige (13.11.2026, Vincent: „drei neue Gesprächsöffnungen von Mike, die wir ab heute
-- testen – stelle sicher, dass mit den nächsten Aufträgen genau diese Nachrichten rausgehen“).
-- Bestandskontakte ohne Antwort werden noch einmal angeschrieben. Welche Vorlage, entscheidet die Stellenanzeige der Firma:
-- Projektleiter · Büro · Elektriker – sonst „Keine Mitarbeitersuche“ (Standard-Vorlage des Schritts). Auf der Auftragsseite muss
-- der Agent die Stelle wählen, bevor „Gesendet“ frei wird (src/lib/vorlagenKeys.ts STELLEN_WAHL). Danach läuft der Kontakt wie
-- im Standard weiter: Kurzfristig 1 → Breakup → Langfristig 1 → Langfristig 2. Die Vorlagentexte selbst sind privat
-- (supabase/seed-privat, im CRM unter Leitfäden gepflegt) – hier stehen nur ihre Schlüssel.

insert into crm.sequences (key, name, channel, description, trigger_kind, weekdays_only, active) values
  ('linkedin_wiedereroeffnung', 'LinkedIn Wiedereröffnung (Stellenanzeige)', 'linkedin',
   'Bestandskontakte ohne Antwort noch einmal anschreiben, Vorlage nach Stellenanzeige der Firma (Projektleiter · Büro · Elektriker · sonst „Keine Mitarbeitersuche“): Wiedereröffnung (Tag 0) → Kurzfristig 1 (+4) → Kurzfristig 3 (+7, Breakup) → Langfristig 1 (+70) → Langfristig 2 (+84).',
   'manuell', true, true)
on conflict (key) do update set name = excluded.name, channel = excluded.channel, description = excluded.description,
  trigger_kind = excluded.trigger_kind, weekdays_only = excluded.weekdays_only;

with steps (seq_key, position, name, kind, delay_days, template_key, is_opener, sets_stage, instructions) as (values
  ('linkedin_wiedereroeffnung', 1, 'Wiedereröffnung',          'nachricht', 0,  'li_keine_mitarbeitersuche_neue_eroeffnung', false, 'dm_follow_up',
   'Vorlage nach Stellenanzeige der Firma: Projektleiter · Büro · Elektriker – sonst „Keine Mitarbeitersuche“. Auf der Auftragsseite wählt der Agent die Stelle.'),
  ('linkedin_wiedereroeffnung', 2, 'Kurzfristig 1',            'nachricht', 4,  'li_fu_kurz_1', false, 'dm_follow_up', null),
  ('linkedin_wiedereroeffnung', 3, 'Kurzfristig 3 (Breakup)',  'nachricht', 7,  'li_fu_kurz_3', false, 'dm_follow_up', 'Letzter kurzfristiger Follow-up.'),
  ('linkedin_wiedereroeffnung', 4, 'Langfristig 1',            'nachricht', 70, 'li_fu_lang_1', false, 'langfristig',  null),
  ('linkedin_wiedereroeffnung', 5, 'Langfristig 2',            'nachricht', 84, 'li_fu_lang_2', false, 'langfristig',  'Letzter Touch.')
)
insert into crm.sequence_steps (sequence_id, position, name, kind, delay_days, template_id, is_opener, sets_stage, instructions)
select s.id, st.position, st.name, st.kind::crm.step_kind, st.delay_days, t.id, st.is_opener, st.sets_stage::crm.lead_stage, st.instructions
  from steps st
  join crm.sequences s on s.key = st.seq_key
  left join crm.templates t on t.key = st.template_key
on conflict (sequence_id, position) do update set name = excluded.name, kind = excluded.kind, delay_days = excluded.delay_days,
  template_id = excluded.template_id, is_opener = excluded.is_opener, sets_stage = excluded.sets_stage, instructions = excluded.instructions;
