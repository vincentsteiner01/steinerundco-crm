-- =====================================================================================================
-- CRM Steiner & Co. · Migration 21 · Kanal „smtp“ für E-Mails des Mail-Motors. Stand: 2026-11-01
-- Eigene Migration, weil ein neuer Enum-Wert erst nach dem Festschreiben benutzt werden darf (Migration 22 und ihr Test
-- schreiben channel = 'smtp' in derselben Transaktion).
-- =====================================================================================================
alter type crm.email_channel add value if not exists 'smtp';
