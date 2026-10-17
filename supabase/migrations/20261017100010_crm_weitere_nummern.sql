-- =====================================================================================================
-- CRM Steiner & Co. · Migration 10 · Feedback 9f9301ea – mehrere Telefonnummern je Person, idempotent, additiv.
-- Stand: 2026-10-17
--
-- Wunsch (Vincent): „Man sollte bei Personen auch mehrere Telefonnummern angeben können, also Zentrale, Durchwahl, Mobil.“
-- Die Hauptnummer bleibt leads.phone_e164 + phone_type – daran hängen Anrufliste, Telefon-Gate, Sperrliste und log_call.
-- Weitere Nummern stehen in leads.phone_numbers als Liste [{ "e164": "+43…", "typ": "zentrale|durchwahl|mobil|sonstige" }].
-- Die App tauscht bei „Als Hauptnummer“ beide Felder in einem Update.
-- =====================================================================================================

alter table crm.leads add column if not exists phone_numbers jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leads_phone_numbers_liste') then
    alter table crm.leads add constraint leads_phone_numbers_liste
      check (jsonb_typeof(phone_numbers) = 'array' and jsonb_array_length(phone_numbers) <= 10);
  end if;
end $$;

comment on column crm.leads.phone_numbers is
  'Weitere Nummern neben phone_e164: [{"e164": "+49…", "typ": "zentrale|durchwahl|mobil|sonstige"}] (Feedback 9f9301ea)';
