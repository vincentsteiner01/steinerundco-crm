-- supabase/tests/rls.sql – RLS-Smoke ohne pgTAP (architektur § 8.3, BAUPLAN § 3.1.2):
--   anon wird auf crm.leads abgewiesen, anon darf rpc ping (F-07), authenticated-Mitglied liest leads,
--   authenticated ohne Mitgliedschaft sieht 0 Zeilen, calls sind für Mitglieder nicht löschbar.
-- Aufruf: bash tools/db-query.sh -f supabase/tests/rls.sql   (eine Transaktion, endet mit rollback)
begin;
create temp table pruef (nr int generated always as identity, fall text, ergebnis text) on commit drop;
grant all on pruef to authenticated, anon;

-- 1) anon: kein Lesezugriff auf crm.leads
set local role anon;
do $$
declare n int; v_msg text := '';
begin
  begin
    select count(*) into n from crm.leads;
  exception when others then v_msg := sqlerrm;
  end;
  if v_msg = '' then raise exception 'FAIL rls-1: anon konnte crm.leads lesen (% Zeilen)', n; end if;
  insert into pruef (fall, ergebnis) values ('rls-1 anon auf crm.leads abgewiesen: ' || v_msg, 'pass');
end $$;

-- 2) anon: rpc ping liefert pong (Keep-alive, F-07)
do $$
begin
  if crm.ping() <> 'pong' then raise exception 'FAIL rls-2: ping ohne pong'; end if;
  insert into pruef (fall, ergebnis) values ('rls-2 anon crm.ping() = pong', 'pass');
end $$;
reset role;

-- 3) authenticated ohne JWT-Subjekt: kein Mitglied → 0 Zeilen (RLS), kein Fehler
select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;
do $$
declare n int;
begin
  select count(*) into n from crm.leads;
  if n <> 0 then raise exception 'FAIL rls-3: Nicht-Mitglied sieht % Leads', n; end if;
  insert into pruef (fall, ergebnis) values ('rls-3 authenticated ohne Mitgliedschaft sieht 0 Leads', 'pass');
end $$;
reset role;

-- 4) authenticated als Vincent: liest leads, darf Lead anlegen, darf calls nicht löschen
select set_config('request.jwt.claim.sub', (select user_id::text from public.members where email = 'vincent@steinerundco.de'), true);
set local role authenticated;
do $$
declare n int; v_lead uuid; v_msg text := '';
begin
  if not private.is_member() then raise exception 'FAIL rls-4: is_member() ist false für vincent@steinerundco.de'; end if;
  select count(*) into n from crm.leads;   -- darf nicht werfen
  insert into crm.leads (first_name, last_name, linkedin_url, owner_id)
  values ('RLS', 'E2E – Test', 'https://www.linkedin.com/in/rls-e2e-test/', auth.uid()) returning id into v_lead;
  if not exists (select 1 from crm.leads where id = v_lead) then raise exception 'FAIL rls-4: eigener Lead nicht lesbar'; end if;
  begin
    delete from crm.calls where lead_id = v_lead;
  exception when others then v_msg := sqlerrm;
  end;
  if v_msg = '' then raise exception 'FAIL rls-4: delete auf crm.calls wurde nicht abgewiesen'; end if;
  insert into pruef (fall, ergebnis) values ('rls-4 Mitglied liest ' || n || ' Leads, legt an, delete calls abgewiesen: ' || v_msg, 'pass');
end $$;
reset role;

insert into pruef (fall, ergebnis) values ('alle Fälle', 'ok');
select nr, fall, ergebnis from pruef order by nr;
rollback;
