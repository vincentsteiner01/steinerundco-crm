-- =====================================================================================================
-- CRM Steiner & Co. · Migration 16 · Datenquelle „recherche“ (LinkedIn-Recherchelauf), idempotent.
-- Stand: 2026-10-29
--
-- Eigener Enum-Wert, damit Leads aus einem Recherchelauf als solche erkennbar sind (leads.source, import_batches.source).
-- Getrennt von Migration 17, weil ein neuer Enum-Wert erst nach dem Commit verwendet werden darf.
-- =====================================================================================================
alter type crm.record_source add value if not exists 'recherche';
