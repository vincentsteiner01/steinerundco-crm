-- =====================================================================================================
-- CRM Steiner & Co. · Migration 11 · Feedback 9959e426 – Leitfäden in Outreach und Sales, idempotent, additiv.
-- Stand: 2026-10-17
--
-- Wunsch (Vincent): Leitfäden kategorisieren in Outreach (LinkedIn, Telefon, Mail) und Sales (Sales-Leitfäden,
-- Einwandbehandlungen etc.). Sales-Leitfäden sind an keinen Outreach-Kanal gebunden – sie liegen im Kanal „sonstiges“,
-- der bisher keine Vorlagen hatte, mit eigenen Phasen. Outreach-Auswahllisten (Nachrichten, Anruf-Skript, KPIs) filtern
-- nach linkedin/telefon/email und bleiben unverändert.
-- =====================================================================================================

alter type crm.template_phase add value if not exists 'erstgespraech';
alter type crm.template_phase add value if not exists 'strategiegespraech';
alter type crm.template_phase add value if not exists 'einwandbehandlung';
alter type crm.template_phase add value if not exists 'angebot';
