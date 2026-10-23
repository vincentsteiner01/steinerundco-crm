-- =====================================================================================================
-- CRM Steiner & Co. · Migration 15 · Bewertung der Leitfäden (1–3 Sterne), idempotent, additiv.
-- Stand: 2026-10-23
--
-- Aus Mikes Sales Hub (Vincent, 23.10.2026: „1:1 übernehmen“): jede Karte in den Leitfäden trägt 1–3 Sterne, „Noch nicht
-- bewertet“ = null. Eine gemeinsame Bewertung je Leitfaden (wie bei Mike), änderbar im Lesefenster.
-- =====================================================================================================

alter table crm.templates add column if not exists rating smallint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'templates_rating_check' and conrelid = 'crm.templates'::regclass) then
    alter table crm.templates add constraint templates_rating_check check (rating is null or rating between 1 and 3);
  end if;
end
$$;

comment on column crm.templates.rating is 'Bewertung 1–3 Sterne (Leitfäden-Karten); null = noch nicht bewertet.';
