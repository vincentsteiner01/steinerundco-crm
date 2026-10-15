-- supabase/tests/feedback.sql – Migration 6 (crm.feedback + Bucket crm-feedback), ohne pgTAP.
--   anon abgewiesen · Nicht-Mitglied sieht nichts · Mitglied legt an, liest, ändert Status/Notiz · Trigger setzt antwort_at/notiz_at
--   · member_id bleibt fest · kein Löschen · Anlegen im Namen der anderen Person abgewiesen · Storage-Policies des Buckets.
-- Aufruf: bash tools/db-query.sh -f supabase/tests/feedback.sql   (eine Transaktion, endet mit rollback; DB bleibt unverändert)
-- Muster: siehe supabase/tests/_kopf.sql.txt
begin;
create temp table pruef (nr int generated always as identity, fall text, ergebnis text) on commit drop;
create temp table ctx (k text primary key, v text) on commit drop;
grant all on pruef, ctx to authenticated, anon;
create function pg_temp.ok(p_fall text) returns void language sql as $$ insert into pruef (fall, ergebnis) values (p_fall, 'pass') $$;
grant execute on function pg_temp.ok(text) to authenticated, anon;

-- 1) anon: weder lesen noch anlegen
set local role anon;
do $$
declare v_lesen text := ''; v_anlegen text := '';
begin
  begin perform count(*) from crm.feedback; exception when others then v_lesen := sqlerrm; end;
  begin insert into crm.feedback (beschreibung) values ('anon'); exception when others then v_anlegen := sqlerrm; end;
  if v_lesen = '' or v_anlegen = '' then raise exception 'FAIL feedback-1: anon nicht abgewiesen (lesen „%“, anlegen „%“)', v_lesen, v_anlegen; end if;
  perform pg_temp.ok('feedback-1 anon abgewiesen: ' || v_lesen);
end $$;
reset role;

-- 2) authenticated ohne Mitgliedschaft: 0 Zeilen, Anlegen abgewiesen
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000f00d', true);
set local role authenticated;
do $$
declare n int; v_msg text := '';
begin
  select count(*) into n from crm.feedback;
  if n <> 0 then raise exception 'FAIL feedback-2: Nicht-Mitglied sieht % Meldungen', n; end if;
  begin insert into crm.feedback (beschreibung) values ('fremd'); exception when others then v_msg := sqlerrm; end;
  if v_msg = '' then raise exception 'FAIL feedback-2: Nicht-Mitglied konnte anlegen'; end if;
  perform pg_temp.ok('feedback-2 Nicht-Mitglied: 0 Zeilen, Anlegen abgewiesen');
end $$;
reset role;

-- 3) Vincent legt an (member_id = auth.uid() per Default), liest, ändert Status und Notiz
select set_config('request.jwt.claim.sub', (select user_id::text from public.members where email = 'vincent@steinerundco.de'), true);
set local role authenticated;
do $$
declare f crm.feedback;
begin
  insert into crm.feedback (art, titel, beschreibung, route, url, viewport, user_agent, app_version, konsole, screenshot_path)
  values ('fehler', 'E2E – Test', 'E2E – Pipeline-Karte bricht um', '/pipeline', 'http://localhost:8768/pipeline', '1440×900 @2x',
          'E2E', 'dev', '[{"zeit":"2026-10-15T10:00:00Z","art":"error","text":"E2E"}]'::jsonb, null)
  returning * into f;
  if f.member_id is distinct from auth.uid() then raise exception 'FAIL feedback-3: member_id % statt auth.uid()', f.member_id; end if;
  if f.status <> 'neu' then raise exception 'FAIL feedback-3: Status % statt neu', f.status; end if;
  if not exists (select 1 from crm.feedback where id = f.id) then raise exception 'FAIL feedback-3: eigene Meldung nicht lesbar'; end if;
  insert into ctx values ('id', f.id::text);
  update crm.feedback set status = 'in_arbeit', notiz = 'E2E – Nachtrag' where id = f.id returning * into f;
  if f.status <> 'in_arbeit' or f.notiz_at is null or f.notiz_von is distinct from auth.uid() then
    raise exception 'FAIL feedback-3: Status/Notiz nicht gespeichert (status %, notiz_at %, notiz_von %)', f.status, f.notiz_at, f.notiz_von;
  end if;
  perform pg_temp.ok('feedback-3 Mitglied legt an, liest, setzt Status in_arbeit + Notiz (notiz_at/notiz_von per Trigger)');
end $$;

-- 4) member_id bleibt fest, Löschen abgewiesen, Anlegen im Namen von Mike abgewiesen, ungültige Werte abgewiesen
do $$
declare v_id uuid := (select v::uuid from ctx where k = 'id'); v_mike uuid := (select user_id from public.members where email = 'mike@steinerundco.de');
        v_del text := ''; v_fremd text := ''; v_art text := ''; v_leer text := ''; n int;
begin
  update crm.feedback set member_id = v_mike where id = v_id;
  if (select member_id from crm.feedback where id = v_id) is distinct from auth.uid() then raise exception 'FAIL feedback-4: member_id änderbar'; end if;
  begin delete from crm.feedback where id = v_id; get diagnostics n = row_count; exception when others then v_del := sqlerrm; end;
  if v_del = '' then raise exception 'FAIL feedback-4: Löschen nicht abgewiesen (% Zeilen)', n; end if;
  begin insert into crm.feedback (member_id, beschreibung) values (v_mike, 'E2E – als Mike'); exception when others then v_fremd := sqlerrm; end;
  if v_fremd = '' then raise exception 'FAIL feedback-4: Anlegen im Namen von Mike nicht abgewiesen'; end if;
  begin insert into crm.feedback (art, beschreibung) values ('lob', 'E2E'); exception when others then v_art := sqlerrm; end;
  begin insert into crm.feedback (beschreibung) values ('   '); exception when others then v_leer := sqlerrm; end;
  if v_art = '' or v_leer = '' then raise exception 'FAIL feedback-4: ungültige Art oder leere Beschreibung angenommen'; end if;
  perform pg_temp.ok('feedback-4 member_id fest · Löschen abgewiesen: ' || v_del || ' · fremde member_id, Art „lob“ und leere Beschreibung abgewiesen');
end $$;
reset role;

-- 5) Claude antwortet (tools/feedback.sh läuft als postgres): antwort_at setzt der Trigger, Mitglied sieht die Antwort
update crm.feedback set status = 'erledigt', antwort = 'E2E – behoben' where id = (select v::uuid from ctx where k = 'id');
set local role authenticated;
do $$
declare f crm.feedback;
begin
  select * into f from crm.feedback where id = (select v::uuid from ctx where k = 'id');
  if f.status <> 'erledigt' or f.antwort is distinct from 'E2E – behoben' or f.antwort_at is null then
    raise exception 'FAIL feedback-5: Antwort nicht sichtbar (status %, antwort_at %)', f.status, f.antwort_at;
  end if;
  if f.updated_at < f.created_at then raise exception 'FAIL feedback-5: updated_at vor created_at'; end if;
  perform pg_temp.ok('feedback-5 Antwort mit antwort_at für Mitglied sichtbar, Status erledigt');
end $$;

-- 6) Storage: Mitglied lädt in crm-feedback hoch und liest; Bucket privat, ≤ 5 MB, nur PNG/JPEG/WebP
do $$
declare v_name text := (select v from ctx where k = 'id') || '.png'; b storage.buckets;
begin
  insert into storage.objects (bucket_id, name, metadata) values ('crm-feedback', v_name, '{"mimetype":"image/png","size":1}'::jsonb);
  if not exists (select 1 from storage.objects where bucket_id = 'crm-feedback' and name = v_name) then raise exception 'FAIL feedback-6: hochgeladenes Objekt nicht lesbar'; end if;
  select * into b from storage.buckets where id = 'crm-feedback';
  if b.public or b.file_size_limit <> 5242880 or b.allowed_mime_types <> array['image/png', 'image/jpeg', 'image/webp'] then
    raise exception 'FAIL feedback-6: Bucket-Einstellungen falsch (public %, limit %, mime %)', b.public, b.file_size_limit, b.allowed_mime_types;
  end if;
  perform pg_temp.ok('feedback-6 Mitglied lädt in crm-feedback hoch und liest; Bucket privat, 5 MB, PNG/JPEG/WebP');
end $$;
reset role;

-- 7) anon sieht keine Objekte im Bucket
set local role anon;
do $$
declare n int := 0; v_msg text := '';
begin
  begin select count(*) into n from storage.objects where bucket_id = 'crm-feedback'; exception when others then v_msg := sqlerrm; end;
  if v_msg = '' and n <> 0 then raise exception 'FAIL feedback-7: anon sieht % Objekte', n; end if;
  perform pg_temp.ok('feedback-7 anon sieht keine Screenshots' || case when v_msg <> '' then ': ' || v_msg else ' (0 Zeilen)' end);
end $$;
reset role;

insert into pruef (fall, ergebnis) values ('alle Fälle', 'ok');
select nr, fall, ergebnis from pruef order by nr;
rollback;
