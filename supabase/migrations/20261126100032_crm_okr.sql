-- Reiter „Ziele“ (OKR; 26.11.2026, Vincent: „Mike und ich arbeiten gerade daran, OKR zu implementieren. Kannst du uns einen
-- Tab bauen …“). Vorlage war ihr Zieldokument: Jahresziele → Quartalsziel → Monat („Was muss im Dezember passieren“, nach
-- Vektoren Sales und Selbstdarstellung) → Wochenziele → Tagesziel → konkrete To-dos.
--
-- Aufbau wie in OKR-Werkzeugen:
--   crm.okr_ziele       ein Ziel (Objective) mit Ebene (Jahr | Quartal | Monat) und Zeitraum
--   crm.okr_ergebnisse  seine Key Results: Zielwert, Takt (für den ganzen Zeitraum | je Woche | je Tag), je Person oder fürs Team,
--                       und die Quelle der Zahl – „manuell“ oder eine Kennzahl aus crm.v_kpi_tage (dann zählt das CRM selbst)
--   crm.okr_eintraege   von Hand gezählte Fortschritte, je Key Result, Person und Tag (so stimmen auch Woche und Heute)
--   crm.okr_todos       konkrete To-dos zu einem Key Result
-- Woche und Tag sind keine eigenen Ziele: Die Oberfläche rechnet sie aus Zielwert und Takt aus (zählende Tage).

-- -----------------------------------------------------------------------------------------------------
-- 1. Tabellen
-- -----------------------------------------------------------------------------------------------------
create table if not exists crm.okr_ziele (
  id uuid primary key default gen_random_uuid(),
  titel text not null check (btrim(titel) <> ''),
  ebene text not null check (ebene in ('jahr', 'quartal', 'monat')),
  von date not null,
  bis date not null,
  position integer not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint okr_ziele_zeitraum_check check (bis >= von)
);
comment on table crm.okr_ziele is
  'Reiter „Ziele“: ein Ziel (Objective) mit Ebene jahr | quartal | monat und Zeitraum (von/bis, beide inklusive). Monatsziele heißen bei den Inhabern „Vektor“ (Sales, Selbstdarstellung).';
create index if not exists okr_ziele_zeitraum_idx on crm.okr_ziele (von, bis);

create table if not exists crm.okr_ergebnisse (
  id uuid primary key default gen_random_uuid(),
  ziel_id uuid not null references crm.okr_ziele (id) on delete cascade,
  titel text not null check (btrim(titel) <> ''),
  zielwert numeric not null check (zielwert > 0),
  takt text not null default 'zeitraum' check (takt in ('zeitraum', 'woche', 'tag')),
  je_person boolean not null default false,
  quelle text not null default 'manuell'
    check (quelle in ('manuell', 'angeschrieben', 'vernetzungen_versendet', 'vernetzungen_angenommen', 'gespraech',
                      'im_geschaeft', 'emails_gesendet', 'email_antworten')),
  faktor numeric not null default 1 check (faktor > 0),
  einheit text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table crm.okr_ergebnisse is
  'Key Results eines Ziels. zielwert gilt je takt: für den ganzen Zeitraum, je Woche oder je (zählendem) Tag. je_person = der Zielwert gilt für jede Person einzeln. quelle: manuell (crm.okr_eintraege) oder eine Spalte von crm.v_kpi_tage; faktor rechnet die Zahl um (z. B. Neukunden × Kundenwert = Umsatz).';
create index if not exists okr_ergebnisse_ziel_idx on crm.okr_ergebnisse (ziel_id);

create table if not exists crm.okr_eintraege (
  ergebnis_id uuid not null references crm.okr_ergebnisse (id) on delete cascade,
  member_id uuid not null,
  tag date not null,
  wert numeric not null check (wert > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (ergebnis_id, member_id, tag)
);
comment on table crm.okr_eintraege is
  'Von Hand gezählter Fortschritt eines Key Results: je Person und Tag eine Zeile. Schreibt crm.okr_zaehlen.';

create table if not exists crm.okr_todos (
  id uuid primary key default gen_random_uuid(),
  ergebnis_id uuid not null references crm.okr_ergebnisse (id) on delete cascade,
  text text not null check (btrim(text) <> ''),
  member_id uuid,
  erledigt_at timestamptz,
  position integer not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
comment on table crm.okr_todos is
  'Konkrete To-dos zu einem Key Result. member_id = wer es erledigt (leer = beide); erledigt_at gesetzt = abgehakt.';
create index if not exists okr_todos_ergebnis_idx on crm.okr_todos (ergebnis_id);

create or replace trigger okr_ziele_set_updated_at before update on crm.okr_ziele
  for each row execute function private.set_updated_at();
create or replace trigger okr_ergebnisse_set_updated_at before update on crm.okr_ergebnisse
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------------------------------
-- 2. Rechte: Mitglieder lesen und schreiben alles (wie crm.settings); Realtime für beide Geräte
-- -----------------------------------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['okr_ziele', 'okr_ergebnisse', 'okr_eintraege', 'okr_todos'] loop
    execute format('alter table crm.%I enable row level security', t);
    execute format('revoke all on crm.%I from public, anon', t);
    execute format('grant select, insert, update, delete on crm.%I to authenticated', t);
    if not exists (select 1 from pg_policies where schemaname = 'crm' and tablename = t and policyname = 'Mitglieder lesen ' || t) then
      execute format('create policy %I on crm.%I for select to authenticated using ((select private.is_member()))',
                     'Mitglieder lesen ' || t, t);
      execute format('create policy %I on crm.%I for insert to authenticated with check ((select private.is_member()))',
                     'Mitglieder legen ' || t || ' an', t);
      execute format('create policy %I on crm.%I for update to authenticated using ((select private.is_member())) with check ((select private.is_member()))',
                     'Mitglieder bearbeiten ' || t, t);
      execute format('create policy %I on crm.%I for delete to authenticated using ((select private.is_member()))',
                     'Mitglieder löschen ' || t, t);
    end if;
    execute format('alter table crm.%I replica identity full', t);
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
       and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'crm' and tablename = t) then
      execute format('alter publication supabase_realtime add table crm.%I', t);
    end if;
  end loop;
end
$$;

-- -----------------------------------------------------------------------------------------------------
-- 3. Von Hand zählen: +1 bucht auf heute, −1 nimmt den jüngsten Eintrag zurück
-- -----------------------------------------------------------------------------------------------------
create or replace function crm.okr_zaehlen(p_ergebnis uuid, p_member uuid default null, p_delta integer default 1)
returns numeric
language plpgsql set search_path = '' as $$
declare
  v_member uuid := coalesce(p_member, auth.uid());
  v_rest numeric := -p_delta;
  z record;
begin
  if auth.uid() is null or not private.is_member() then raise exception 'Nur für angemeldete Mitglieder'; end if;
  if v_member is null then raise exception 'Unbekannte Person'; end if;
  if not exists (select 1 from crm.okr_ergebnisse e where e.id = p_ergebnis) then raise exception 'Dieses Key Result gibt es nicht mehr'; end if;

  if p_delta > 0 then
    insert into crm.okr_eintraege as e (ergebnis_id, member_id, tag, wert)
    values (p_ergebnis, v_member, crm.today(), p_delta)
    on conflict (ergebnis_id, member_id, tag)
      do update set wert = e.wert + excluded.wert, updated_at = now(), updated_by = auth.uid();
  elsif p_delta < 0 then
    for z in select e.tag, e.wert from crm.okr_eintraege e
              where e.ergebnis_id = p_ergebnis and e.member_id = v_member
              order by e.tag desc for update loop
      exit when v_rest <= 0;
      if z.wert <= v_rest then
        delete from crm.okr_eintraege e where e.ergebnis_id = p_ergebnis and e.member_id = v_member and e.tag = z.tag;
        v_rest := v_rest - z.wert;
      else
        update crm.okr_eintraege e set wert = e.wert - v_rest, updated_at = now(), updated_by = auth.uid()
         where e.ergebnis_id = p_ergebnis and e.member_id = v_member and e.tag = z.tag;
        v_rest := 0;
      end if;
    end loop;
  end if;

  return (select coalesce(sum(e.wert), 0) from crm.okr_eintraege e where e.ergebnis_id = p_ergebnis and e.member_id = v_member);
end;
$$;
comment on function crm.okr_zaehlen(uuid, uuid, integer) is
  'Reiter „Ziele“: Fortschritt eines von Hand gezählten Key Results ändern. Positives p_delta bucht auf heute (Berliner Tag), negatives nimmt vom jüngsten Eintrag weg. Rückgabe: Summe der Person.';
revoke all on function crm.okr_zaehlen(uuid, uuid, integer) from public, anon;
grant execute on function crm.okr_zaehlen(uuid, uuid, integer) to authenticated, service_role;

-- -----------------------------------------------------------------------------------------------------
-- 4. Monat übernehmen: die Monatsziele samt Key Results in einen anderen Monat kopieren (ohne Fortschritt, ohne To-dos)
-- -----------------------------------------------------------------------------------------------------
create or replace function crm.okr_monat_uebernehmen(p_von date, p_nach date)
returns integer
language plpgsql set search_path = '' as $$
declare
  v_von date := date_trunc('month', p_von)::date;
  v_nach date := date_trunc('month', p_nach)::date;
  v_neu uuid;
  v_n integer := 0;
  z crm.okr_ziele;
begin
  if auth.uid() is null or not private.is_member() then raise exception 'Nur für angemeldete Mitglieder'; end if;
  if v_von = v_nach then raise exception 'Das ist derselbe Monat'; end if;
  if exists (select 1 from crm.okr_ziele where ebene = 'monat' and von = v_nach) then
    raise exception 'In diesem Monat gibt es schon Ziele';
  end if;
  for z in select * from crm.okr_ziele where ebene = 'monat' and von = v_von order by position, created_at loop
    insert into crm.okr_ziele (titel, ebene, von, bis, position)
    values (z.titel, 'monat', v_nach, (v_nach + interval '1 month' - interval '1 day')::date, z.position)
    returning id into v_neu;
    insert into crm.okr_ergebnisse (ziel_id, titel, zielwert, takt, je_person, quelle, faktor, einheit, position)
    select v_neu, e.titel, e.zielwert, e.takt, e.je_person, e.quelle, e.faktor, e.einheit, e.position
      from crm.okr_ergebnisse e where e.ziel_id = z.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
comment on function crm.okr_monat_uebernehmen(date, date) is
  'Reiter „Ziele“: kopiert die Monatsziele samt Key Results eines Monats in einen anderen (ohne Fortschritt und To-dos). Rückgabe: Zahl der kopierten Ziele.';
revoke all on function crm.okr_monat_uebernehmen(date, date) from public, anon;
grant execute on function crm.okr_monat_uebernehmen(date, date) to authenticated, service_role;
