-- =====================================================================================================
-- CRM Steiner & Co. · Migration 13 · Umsatz (Aufträge + Zahlungseingänge) und Kennzahl „SG vereinbart“, idempotent, additiv.
-- Stand: 2026-10-23
--
-- Aus Mikes „Sales Hub“ übernommen (Vincent, 23.10.2026: „Umsatz packen wir rein“): Ein Auftrag hat einen einmaligen Betrag,
-- einen wiederkehrenden Betrag mit Rhythmus und optional eine Laufzeit in Monaten (ohne Laufzeit = unbefristet). Zahlungen werden
-- separat erfasst, sobald Geld eingeht. Geplante Monatsumsätze rechnet die App aus den Aufträgen (keine eigene Tabelle).
--
-- Konventionen wie Migration 1/6: Schema crm, RLS ausschließlich über private.is_member(), deutsche Kommentare.
--   · crm.contracts  – Aufträge (optional mit Lead/Firma verknüpft)
--   · crm.payments   – Zahlungseingänge je Auftrag (löschen mit dem Auftrag)
--   · Mitglieder lesen, legen an, bearbeiten und löschen (Mike: „Bearbeiten / Löschen“ je Zeile)
--   · Realtime-Publikation supabase_realtime
--   · Enum crm.metric + 'strategiegespraeche_vereinbart' (Sales-KPIs „SG vereinbart“; die View folgt in Migration 14,
--     ein neuer Enum-Wert darf in derselben Transaktion nicht verwendet werden)
-- =====================================================================================================

-- -----------------------------------------------------------------------------------------------------
-- 1. Aufträge
-- -----------------------------------------------------------------------------------------------------
create table if not exists crm.contracts (
  id               uuid primary key default gen_random_uuid(),
  lead_id          uuid references crm.leads (id) on delete set null,
  company_id       uuid references crm.companies (id) on delete set null,
  customer         text not null check (char_length(btrim(customer)) between 1 and 200),
  product          text check (product is null or char_length(product) <= 200),
  start_date       date not null,
  setup_amount     numeric(12, 2) not null default 0 check (setup_amount >= 0),
  recurring_amount numeric(12, 2) not null default 0 check (recurring_amount >= 0),
  frequency        text not null default 'monatlich'
                   check (frequency in ('monatlich', 'vierteljaehrlich', 'halbjaehrlich', 'jaehrlich')),
  term_months      integer check (term_months is null or term_months between 1 and 600),
  notes            text check (notes is null or char_length(notes) <= 5000),
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table crm.contracts is 'Aufträge (Umsatz): einmaliger Betrag + wiederkehrender Betrag je Rhythmus, optional mit Laufzeit; Volumen und Plan rechnet die App.';
comment on column crm.contracts.customer is 'Kunde / Unternehmen, wie er in der Umsatzliste erscheint (auch ohne verknüpften Lead).';
comment on column crm.contracts.setup_amount is 'Einmaliger Betrag in Euro (fällig im Startmonat).';
comment on column crm.contracts.recurring_amount is 'Wiederkehrender Betrag in Euro je Rhythmus (z. B. 1.500 € monatlich).';
comment on column crm.contracts.frequency is 'monatlich · vierteljaehrlich · halbjaehrlich · jaehrlich';
comment on column crm.contracts.term_months is 'Vereinbarte Laufzeit in Monaten; null = unbefristet (Volumen = nur einmaliger Betrag + laufend).';

create index if not exists contracts_start_idx on crm.contracts (start_date desc);
create index if not exists contracts_lead_idx on crm.contracts (lead_id) where lead_id is not null;

-- -----------------------------------------------------------------------------------------------------
-- 2. Zahlungseingänge
-- -----------------------------------------------------------------------------------------------------
create table if not exists crm.payments (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid not null references crm.contracts (id) on delete cascade,
  paid_on     date not null,
  amount      numeric(12, 2) not null check (amount > 0),
  notes       text check (notes is null or char_length(notes) <= 500),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table crm.payments is 'Tatsächlich erhaltene Zahlungen je Auftrag (Umsatz „erhalten“); geplante Beträge stehen nicht hier.';
comment on column crm.payments.notes is 'Art / Notiz, z. B. „Rechnung 2026-014“ oder „Einrichtung“.';

create index if not exists payments_contract_idx on crm.payments (contract_id);
create index if not exists payments_paid_on_idx on crm.payments (paid_on desc);

-- -----------------------------------------------------------------------------------------------------
-- 3. Trigger: updated_at · created_by fest
-- -----------------------------------------------------------------------------------------------------
create or replace function crm.umsatz_before_write() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
    return new;
  end if;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  return new;
end;
$$;
comment on function crm.umsatz_before_write() is 'Umsatz: created_by beim Anlegen; created_by und created_at bleiben fest.';

create or replace trigger contracts_before_write before insert or update on crm.contracts
  for each row execute function crm.umsatz_before_write();
create or replace trigger contracts_set_updated_at before update on crm.contracts
  for each row execute function private.set_updated_at();
create or replace trigger payments_before_write before insert or update on crm.payments
  for each row execute function crm.umsatz_before_write();
create or replace trigger payments_set_updated_at before update on crm.payments
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------------------------------
-- 4. RLS: nur Mitglieder (lesen, anlegen, bearbeiten, löschen)
-- -----------------------------------------------------------------------------------------------------
alter table crm.contracts enable row level security;
alter table crm.payments enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['contracts', 'payments'] loop
    if not exists (select 1 from pg_policies where schemaname = 'crm' and tablename = t and policyname = 'Mitglieder lesen ' || t) then
      execute format('create policy %I on crm.%I for select to authenticated using ((select private.is_member()))',
        'Mitglieder lesen ' || t, t);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'crm' and tablename = t and policyname = 'Mitglieder legen ' || t || ' an') then
      execute format('create policy %I on crm.%I for insert to authenticated with check ((select private.is_member()))',
        'Mitglieder legen ' || t || ' an', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'crm' and tablename = t and policyname = 'Mitglieder bearbeiten ' || t) then
      execute format('create policy %I on crm.%I for update to authenticated using ((select private.is_member())) with check ((select private.is_member()))',
        'Mitglieder bearbeiten ' || t, t);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'crm' and tablename = t and policyname = 'Mitglieder löschen ' || t) then
      execute format('create policy %I on crm.%I for delete to authenticated using ((select private.is_member()))',
        'Mitglieder löschen ' || t, t);
    end if;
  end loop;
end
$$;

revoke all on crm.contracts, crm.payments from public, anon;
grant select, insert, update, delete on crm.contracts, crm.payments to authenticated;
revoke truncate on crm.contracts, crm.payments from authenticated;
grant all on crm.contracts, crm.payments to service_role;
revoke all on function crm.umsatz_before_write() from public, anon;

-- -----------------------------------------------------------------------------------------------------
-- 5. Realtime: Aufträge und Zahlungen erscheinen bei beiden live
-- -----------------------------------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['contracts', 'payments'] loop
    execute format('alter table crm.%I replica identity full', t);
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
       and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'crm' and tablename = t) then
      execute format('alter publication supabase_realtime add table crm.%I', t);
    end if;
  end loop;
end
$$;

-- -----------------------------------------------------------------------------------------------------
-- 6. Kennzahl „SG vereinbart“ (Sales-KPIs, Mikes Spalte „SG vereinbart“ + Show-Rate SG)
-- -----------------------------------------------------------------------------------------------------
alter type crm.metric add value if not exists 'strategiegespraeche_vereinbart';
