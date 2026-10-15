-- supabase/tests/eingang.sql – Migration 7 (crm.eingang, crm.eingang_tokens, eingang_verarbeiten …), ohne pgTAP.
--   anon abgewiesen · Schlüssel erzeugen/widerrufen (nur Hash gespeichert) · Rechte der Mitglieder (kein direktes UPDATE) ·
--   Annahme per Slug (startet Sequenz) · zweite Annahme ohne Doppel · Antwort per Name (stoppt Sequenz) · Doppel-Schutz nach
--   Gesprächszug (A später gedrückt + schon geantwortet, neue Runde, alte beantwortete Nachricht, blinder Sequenzschritt) ·
--   unbekannt · mehrdeutig (eigene Leads zuerst) · Name ohne Vernetzung/ohne offene Anfrage · eigener Slug · Name + Vernetzung bei
--   abweichendem Link · anderer Profil-Link · Titel im Namen · Einladung · sonstiges · Datensparsamkeit · zuordnen · ignorieren ·
--   set_reply_label · Löschfrist · Fehlerpfad.
-- Aufruf: bash tools/db-query.sh -f supabase/tests/eingang.sql   (eine Transaktion, endet mit rollback; DB bleibt unverändert)
-- Muster: siehe supabase/tests/_kopf.sql.txt. Alle Test-Leads heißen „E2E – …“.
begin;
create temp table pruef (nr int generated always as identity, fall text, ergebnis text) on commit drop;
create temp table ctx (k text primary key, v text) on commit drop;
grant all on pruef, ctx to authenticated, anon, service_role;
create function pg_temp.ok(p_fall text) returns void language sql as $$ insert into pruef (fall, ergebnis) values (p_fall, 'pass') $$;
create function pg_temp.v(p_k text) returns text language sql stable as $$ select v from ctx where k = p_k $$;
grant execute on function pg_temp.ok(text), pg_temp.v(text) to authenticated, anon, service_role;

-- Testdaten (als postgres): Mitglieder und E2E-Leads
insert into ctx values
  ('vincent', (select user_id::text from public.members where email = 'vincent@steinerundco.de')),
  ('mike',    (select user_id::text from public.members where email = 'mike@steinerundco.de'));
with neu (k, vor, nach, url, owner) as (values
  ('lead_a', 'E2E – Anna',  'Slugtest',   'https://www.linkedin.com/in/e2e-eingang-a/',       'vincent'),
  ('lead_b', 'E2E – Bernd', 'Namenstest', null,                                               'vincent'),
  ('lead_c1','E2E – Clara', 'Doppelt',    null,                                               'mike'),
  ('lead_c2','E2E – Clara', 'Doppelt',    null,                                               null),
  ('lead_d', 'E2E – Dora',  'Profiltest', 'https://de.linkedin.com/in/e2e-eingang-d-echt',    'vincent'),
  ('lead_e', 'E2E – Emil',  'Fehlertest', 'https://www.linkedin.com/in/e2e-eingang-e',        'vincent'),
  ('lead_f', 'E2E – Fritz', 'Zuordnung',  null,                                               'vincent'),
  ('lead_g', 'E2E – Gustav','Zugtest',    'https://www.linkedin.com/in/e2e-eingang-g',        'vincent'),
  ('lead_h', 'E2E – Hanna', 'Altnachricht','https://www.linkedin.com/in/e2e-eingang-h',       'vincent'),
  ('lead_j', 'E2E – Jana',  'Anfragetest', null,                                              'vincent')),
ins as (
  insert into crm.leads (first_name, last_name, linkedin_url, owner_id)
  select vor, nach, url, (select v::uuid from ctx where k = neu.owner) from neu
  returning id, first_name, last_name)
insert into ctx select n.k, i.id::text from ins i join neu n on n.vor = i.first_name and n.nach = i.last_name
  where n.k not in ('lead_c1', 'lead_c2');
insert into ctx select 'lead_c1', id::text from crm.leads where first_name = 'E2E – Clara' and owner_id = pg_temp.v('mike')::uuid;
insert into ctx select 'lead_c2', id::text from crm.leads where first_name = 'E2E – Clara' and owner_id is null;

-- 1) anon: weder lesen noch Schlüssel erzeugen noch verarbeiten
set local role anon;
do $$
declare v_a text := ''; v_b text := ''; v_c text := ''; v_d text := ''; v_e text := '';
begin
  begin perform crm.set_reply_label(1, 'interessiert'); exception when others then v_e := sqlerrm; end;
  if v_e = '' then raise exception 'FAIL eingang-1: anon darf set_reply_label'; end if;
  begin perform count(*) from crm.eingang; exception when others then v_a := sqlerrm; end;
  begin perform count(*) from crm.eingang_tokens; exception when others then v_b := sqlerrm; end;
  begin perform crm.eingang_token_erzeugen('anon'); exception when others then v_c := sqlerrm; end;
  begin perform crm.eingang_verarbeiten(gen_random_uuid()); exception when others then v_d := sqlerrm; end;
  if v_a = '' or v_b = '' or v_c = '' or v_d = '' then
    raise exception 'FAIL eingang-1: anon nicht abgewiesen (eingang „%“, tokens „%“, erzeugen „%“, verarbeiten „%“)', v_a, v_b, v_c, v_d;
  end if;
  perform pg_temp.ok('eingang-1 anon abgewiesen: ' || v_c);
end $$;
reset role;

-- 2) Vincent: Schlüssel erzeugen (43 Zeichen, url-sicher, nur Hash gespeichert), zweiter widerruft den ersten, widerrufen
select set_config('request.jwt.claim.sub', pg_temp.v('vincent'), true);
set local role authenticated;
do $$
declare t1 text; t2 text; n int; v_hash text := ''; v_ins text := '';
begin
  t1 := crm.eingang_token_erzeugen('E2E – eins');
  if t1 !~ '^[A-Za-z0-9_-]{43}$' then raise exception 'FAIL eingang-2: Schlüssel hat falsches Format (%)', length(t1); end if;
  t2 := crm.eingang_token_erzeugen('E2E – zwei');
  if t1 = t2 then raise exception 'FAIL eingang-2: zwei gleiche Schlüssel'; end if;
  select count(*) into n from crm.eingang_tokens where member_id = auth.uid() and revoked_at is null;
  if n <> 1 then raise exception 'FAIL eingang-2: % aktive Schlüssel statt 1', n; end if;
  if (select label from crm.eingang_tokens where member_id = auth.uid() and revoked_at is null) <> 'E2E – zwei' then
    raise exception 'FAIL eingang-2: aktiver Schlüssel ist nicht der neue';
  end if;
  begin perform token_hash from crm.eingang_tokens; exception when others then v_hash := sqlerrm; end;
  if v_hash = '' then raise exception 'FAIL eingang-2: Mitglied kann token_hash lesen'; end if;
  begin insert into crm.eingang_tokens (member_id, token_hash) values (auth.uid(), repeat('a', 64)); exception when others then v_ins := sqlerrm; end;
  if v_ins = '' then raise exception 'FAIL eingang-2: Mitglied kann Schlüssel direkt anlegen'; end if;
  insert into ctx values ('t1', t1), ('t2', t2);
  n := crm.eingang_token_widerrufen();
  if n <> 1 or exists (select 1 from crm.eingang_tokens where member_id = auth.uid() and revoked_at is null) then
    raise exception 'FAIL eingang-2: widerrufen traf % Schlüssel', n;
  end if;
  perform pg_temp.ok('eingang-2 Schlüssel 43 Zeichen url-sicher, neuer widerruft alten, widerrufen; Hash nicht lesbar: ' || v_hash);
end $$;
reset role;
do $$
begin
  if (select count(*) from crm.eingang_tokens
       where token_hash in (encode(sha256(convert_to(pg_temp.v('t1'), 'UTF8')), 'hex'), encode(sha256(convert_to(pg_temp.v('t2'), 'UTF8')), 'hex'))) <> 2 then
    raise exception 'FAIL eingang-3: gespeicherter Hash ist nicht sha256(Schlüssel)';
  end if;
  if exists (select 1 from crm.eingang_tokens where token_hash in (pg_temp.v('t1'), pg_temp.v('t2'))) then
    raise exception 'FAIL eingang-3: Klartext gespeichert';
  end if;
  perform pg_temp.ok('eingang-3 nur sha256-Hex gespeichert, kein Klartext');
end $$;

-- Pending-Anfrage an Lead A (wie Taste E) und laufende Sequenz bei Lead B (Annahme von Hand) – beide im Namen von Vincent
select set_config('request.jwt.claim.sub', pg_temp.v('vincent'), true);
set local role authenticated;
select crm.log_request(pg_temp.v('lead_a')::uuid);
select crm.mark_accepted(pg_temp.v('lead_b')::uuid);
select crm.mark_accepted(pg_temp.v('lead_g')::uuid);
select crm.mark_accepted(pg_temp.v('lead_h')::uuid);
reset role;

-- 4) Edge Function (service_role, ohne auth.uid()): Annahme per Slug (Groß-/Kleinschreibung egal) → angenommen, Sequenz läuft
select set_config('request.jwt.claim.sub', '', true);
set local role service_role;
do $$
declare e crm.eingang; c crm.linkedin_connections; v_lead uuid := pg_temp.v('lead_a')::uuid; v_me uuid := pg_temp.v('vincent')::uuid;
begin
  insert into crm.eingang (member_id, quelle, external_id, art, empfangen_at, absender_name, linkedin_slug, roh)
  values (v_me, 'gmail_linkedin', 'e2e-msg-1', 'annahme', now(), 'E2E – Anna Slugtest', 'E2E-Eingang-A', '{"betreff":"E2E"}')
  returning * into e;
  e := crm.eingang_verarbeiten(e.id);
  if e.status <> 'verarbeitet' or e.lead_id is distinct from v_lead or e.ergebnis <> 'Annahme verbucht – Sequenz gestartet' then
    raise exception 'FAIL eingang-4: status %, lead %, ergebnis „%“', e.status, e.lead_id, e.ergebnis;
  end if;
  select * into c from crm.linkedin_connections where lead_id = v_lead and member_id = v_me;
  if c.status <> 'angenommen' or c.requested_at is null then raise exception 'FAIL eingang-4: Vernetzung %', c.status; end if;
  if not exists (select 1 from crm.activities where id = e.activity_id and type = 'vernetzung_angenommen' and member_id = v_me) then
    raise exception 'FAIL eingang-4: activity_id % ist keine vernetzung_angenommen von Vincent', e.activity_id;
  end if;
  if not exists (select 1 from crm.enrollments where lead_id = v_lead and status = 'aktiv' and member_id = v_me) then
    raise exception 'FAIL eingang-4: keine aktive Sequenz';
  end if;
  if (select stage from crm.leads where id = v_lead) <> 'vernetzt' then raise exception 'FAIL eingang-4: Stufe nicht vernetzt'; end if;
  if auth.uid() is not null then raise exception 'FAIL eingang-4: auth.uid() nach Verarbeitung nicht zurückgesetzt (%)', auth.uid(); end if;
  if e.verarbeitet_at is null then raise exception 'FAIL eingang-4: verarbeitet_at fehlt'; end if;
  insert into ctx values ('e_annahme', e.id::text), ('act_annahme', e.activity_id::text);
  perform pg_temp.ok('eingang-4 Annahme per Slug: angenommen, vernetzung_angenommen von Vincent, Sequenz gestartet, auth.uid() wieder leer');
end $$;

-- 5) Zweite Annahme-Mail (andere Message-ID) → nichts doppelt; gleiche Message-ID → on conflict do nothing
do $$
declare e crm.eingang; n int;
begin
  insert into crm.eingang (member_id, quelle, external_id, art, empfangen_at, absender_name, linkedin_slug)
  values (pg_temp.v('vincent')::uuid, 'gmail_linkedin', 'e2e-msg-2', 'annahme', now(), 'E2E – Anna Slugtest', 'e2e-eingang-a')
  returning * into e;
  e := crm.eingang_verarbeiten(e.id);
  if e.status <> 'verarbeitet' or e.ergebnis <> 'Vernetzung war schon als angenommen erfasst' or e.activity_id::text <> pg_temp.v('act_annahme') then
    raise exception 'FAIL eingang-5: status %, ergebnis „%“, activity %', e.status, e.ergebnis, e.activity_id;
  end if;
  select count(*) into n from crm.activities where lead_id = pg_temp.v('lead_a')::uuid and type = 'vernetzung_angenommen';
  if n <> 1 then raise exception 'FAIL eingang-5: % vernetzung_angenommen statt 1', n; end if;
  insert into crm.eingang (member_id, quelle, external_id, art) values (pg_temp.v('vincent')::uuid, 'gmail_linkedin', 'e2e-msg-1', 'annahme')
  on conflict (quelle, external_id) do nothing;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL eingang-5: doppelte Message-ID angelegt'; end if;
  if (select count(*) from crm.enrollments where lead_id = pg_temp.v('lead_a')::uuid) <> 1 then raise exception 'FAIL eingang-5: zweite Sequenz'; end if;
  perform pg_temp.ok('eingang-5 zweite Annahme: keine zweite Aktivität/Sequenz; doppelte Message-ID abgewiesen');
end $$;

-- 6) Nachricht per Name (klein geschrieben, ohne Slug) → nachricht_erhalten von Vincent mit Text, Sequenz gestoppt, Stufe dm_beantwortet
do $$
declare e crm.eingang; a crm.activities; v_lead uuid := pg_temp.v('lead_b')::uuid;
begin
  insert into crm.eingang (member_id, quelle, external_id, art, empfangen_at, absender_name, text)
  values (pg_temp.v('vincent')::uuid, 'gmail_linkedin', 'e2e-msg-3', 'nachricht', now(), 'e2e – bernd  namenstest', 'E2E – Danke, gern mehr Infos.')
  returning * into e;
  e := crm.eingang_verarbeiten(e.id);
  if e.status <> 'verarbeitet' or e.lead_id is distinct from v_lead or e.ergebnis <> 'Antwort verbucht – Sequenz gestoppt' then
    raise exception 'FAIL eingang-6: status %, lead %, ergebnis „%“', e.status, e.lead_id, e.ergebnis;
  end if;
  select * into a from crm.activities where id = e.activity_id;
  if a.type <> 'nachricht_erhalten' or a.member_id::text <> pg_temp.v('vincent') or a.note <> 'E2E – Danke, gern mehr Infos.' or a.channel <> 'linkedin' then
    raise exception 'FAIL eingang-6: Aktivität % / % / „%“', a.type, a.member_id, a.note;
  end if;
  if exists (select 1 from crm.enrollments where lead_id = v_lead and status = 'aktiv') then raise exception 'FAIL eingang-6: Sequenz läuft weiter'; end if;
  if (select stage from crm.leads where id = v_lead) <> 'dm_beantwortet' then raise exception 'FAIL eingang-6: Stufe nicht dm_beantwortet'; end if;
  perform pg_temp.ok('eingang-6 Antwort per Name: nachricht_erhalten (Vincent, Text), Sequenz gestoppt, Stufe dm_beantwortet');
end $$;
reset role;

-- 7) Doppel-Schutz nach Gesprächszug (now() ist in der Transaktion fest – Zeiten relativ dazu)
--    7a: A vor 3 Minuten, Mail jetzt → schon erfasst
--    7b: Mail vor 3 h, A erst vor 1 h, dann Antwort gesendet und „Nachfassen im Gespräch“ gestartet → schon erfasst,
--        Lead NICHT wieder „Antwort offen“, Nachfassen läuft weiter (Review-Blocker)
--    7c: neue Mail nach der eigenen Antwort → neue Runde, verbucht, Nachfassen gestoppt
--    7d: alte Mail (vor 2 h), danach schon geschrieben, nie erfasst → nichts verbucht
--    7e: Mail nach einem blind weiterlaufenden Sequenzschritt → verbucht (der Schritt war keine Antwort)
select set_config('request.jwt.claim.sub', pg_temp.v('vincent'), true);
set local role authenticated;
select crm.log_reply(pg_temp.v('lead_a')::uuid, 'linkedin', null, 'E2E – per Hand erfasst', now() - interval '3 minutes');
select crm.log_reply(pg_temp.v('lead_g')::uuid, 'linkedin', 'interessiert', null, now() - interval '1 hour');
select crm.log_outbound(pg_temp.v('lead_g')::uuid, 'linkedin', null, 'nachricht', null, now() - interval '50 minutes');
select crm.enroll(pg_temp.v('lead_g')::uuid, 'linkedin_nachfassen_im_gespraech');
select crm.log_outbound(pg_temp.v('lead_h')::uuid, 'linkedin', null, 'nachricht', null, now() - interval '1 hour');
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role service_role;
do $$
declare e crm.eingang; n int; v_a uuid := pg_temp.v('lead_a')::uuid; v_g uuid := pg_temp.v('lead_g')::uuid; v_me uuid := pg_temp.v('vincent')::uuid;
begin
  -- 7a
  insert into crm.eingang (member_id, quelle, external_id, art, empfangen_at, absender_name, linkedin_slug, text)
  values (v_me, 'gmail_linkedin', 'e2e-msg-4', 'nachricht', now(), 'E2E – Anna Slugtest', 'e2e-eingang-a', 'E2E – anderer Mailtext')
  returning * into e;
  e := crm.eingang_verarbeiten(e.id);
  if e.status <> 'verarbeitet' or e.ergebnis <> 'Antwort war schon erfasst'
     or e.activity_id <> (select id from crm.activities where lead_id = v_a and type = 'nachricht_erhalten') then
    raise exception 'FAIL eingang-7a: status %, ergebnis „%“', e.status, e.ergebnis;
  end if;
  -- 7b
  if (select inbound_unanswered_since from crm.leads where id = v_g) is not null then raise exception 'FAIL eingang-7b: Vorbedingung – Antwort noch offen'; end if;
  insert into crm.eingang (member_id, quelle, external_id, art, empfangen_at, absender_name, linkedin_slug, text)
  values (v_me, 'gmail_linkedin', 'e2e-msg-14', 'nachricht', now() - interval '3 hours', 'E2E – Gustav Zugtest', 'e2e-eingang-g', 'E2E – Klingt interessant, erzähl mehr.')
  returning * into e;
  e := crm.eingang_verarbeiten(e.id);
  select count(*) into n from crm.activities where lead_id = v_g and type = 'nachricht_erhalten';
  if e.status <> 'verarbeitet' or e.ergebnis <> 'Antwort war schon erfasst' or n <> 1
     or e.activity_id <> (select id from crm.activities where lead_id = v_g and type = 'nachricht_erhalten') then
    raise exception 'FAIL eingang-7b: status %, ergebnis „%“, % Antworten', e.status, e.ergebnis, n;
  end if;
  if (select inbound_unanswered_since from crm.leads where id = v_g) is not null then raise exception 'FAIL eingang-7b: Lead wieder „Antwort offen“'; end if;
  if not exists (select 1 from crm.enrollments x join crm.sequences q on q.id = x.sequence_id
                  where x.lead_id = v_g and x.status = 'aktiv' and q.key = 'linkedin_nachfassen_im_gespraech') then
    raise exception 'FAIL eingang-7b: Nachfassen im Gespräch wurde gestoppt';
  end if;
  -- 7c
  insert into crm.eingang (member_id, quelle, external_id, art, empfangen_at, linkedin_slug, text)
  values (v_me, 'gmail_linkedin', 'e2e-msg-5', 'nachricht', now(), 'e2e-eingang-g', 'E2E – zweite Nachricht')
  returning * into e;
  e := crm.eingang_verarbeiten(e.id);
  select count(*) into n from crm.activities where lead_id = v_g and type = 'nachricht_erhalten';
  if e.ergebnis <> 'Antwort verbucht – Sequenz gestoppt' or n <> 2 or (select inbound_unanswered_since from crm.leads where id = v_g) <> now() then
    raise exception 'FAIL eingang-7c: „%“, % Antworten', e.ergebnis, n;
  end if;
  perform pg_temp.ok('eingang-7a–c Doppel-Schutz: ±10 min · A später + schon geantwortet → nichts doppelt, nicht wieder offen, Nachfassen läuft · neue Runde verbucht');
end $$;
do $$
declare e crm.eingang; v_h uuid := pg_temp.v('lead_h')::uuid; v_me uuid := pg_temp.v('vincent')::uuid; v_enr uuid;
begin
  -- 7d
  insert into crm.eingang (member_id, quelle, external_id, art, empfangen_at, absender_name, linkedin_slug, text)
  values (v_me, 'gmail_linkedin', 'e2e-msg-15', 'nachricht', now() - interval '2 hours', 'E2E – Hanna Altnachricht', 'e2e-eingang-h', 'E2E – Alte Nachricht')
  returning * into e;
  e := crm.eingang_verarbeiten(e.id);
  if e.status <> 'verarbeitet' or e.ergebnis not like 'Ältere Nachricht%' or e.activity_id is not null or e.lead_id <> v_h
     or exists (select 1 from crm.activities where lead_id = v_h and type = 'nachricht_erhalten')
     or (select inbound_unanswered_since from crm.leads where id = v_h) is not null then
    raise exception 'FAIL eingang-7d: % „%“', e.status, e.ergebnis;
  end if;
  -- 7e: Sequenzschritt um now() - 30 min aus einer Sequenz, die vor 5 Tagen startete (blind weitergelaufen)
  select id into v_enr from crm.enrollments where lead_id = v_h and status = 'aktiv';
  if v_enr is null then raise exception 'FAIL eingang-7e: Vorbedingung – keine aktive Sequenz bei H'; end if;
  insert into ctx values ('enr_h', v_enr::text);
end $$;
reset role;
update crm.enrollments set created_at = now() - interval '5 days' where id = pg_temp.v('enr_h')::uuid;
select crm.log_activity(pg_temp.v('lead_h')::uuid, pg_temp.v('vincent')::uuid, 'linkedin', 'nachricht_gesendet', now() - interval '30 minutes',
                        p_enrollment_id => pg_temp.v('enr_h')::uuid);
set local role service_role;
do $$
declare e crm.eingang; v_h uuid := pg_temp.v('lead_h')::uuid;
begin
  insert into crm.eingang (member_id, quelle, external_id, art, empfangen_at, absender_name, linkedin_slug, text)
  values (pg_temp.v('vincent')::uuid, 'gmail_linkedin', 'e2e-msg-16', 'nachricht', now() - interval '45 minutes', 'E2E – Hanna Altnachricht', 'e2e-eingang-h', 'E2E – Antwort auf den Opener')
  returning * into e;
  e := crm.eingang_verarbeiten(e.id);
  if e.ergebnis <> 'Antwort verbucht – Sequenz gestoppt' or (select inbound_unanswered_since from crm.leads where id = v_h) <> now() - interval '45 minutes' then
    raise exception 'FAIL eingang-7e: „%“', e.ergebnis;
  end if;
  insert into ctx values ('act_h', e.activity_id::text);
  perform pg_temp.ok('eingang-7d–e alte beantwortete Nachricht → nichts verbucht · blinder Sequenzschritt zählt nicht als Antwort → verbucht');
end $$;

-- 8) unbekannt · mehrdeutig (eigene Leads zuerst) · anderer Profil-Link · Titel im Namen + Einladung · Einladung/sonstiges ohne Lead
do $$
declare e crm.eingang; v_me uuid := pg_temp.v('vincent')::uuid;
begin
  insert into crm.eingang (member_id, quelle, external_id, art, empfangen_at, absender_name, linkedin_slug, text)
  values (v_me, 'gmail_linkedin', 'e2e-msg-6', 'nachricht', now(), 'E2E – Niemand Bekannt', 'e2e-eingang-gibt-es-nicht', 'E2E – Hallo')
  returning * into e;
  e := crm.eingang_verarbeiten(e.id);
  if e.status <> 'unbekannt' or e.lead_id is not null or e.activity_id is not null then raise exception 'FAIL eingang-8a: % / %', e.status, e.lead_id; end if;
  insert into ctx values ('e_unbekannt', e.id::text);

  insert into crm.eingang (member_id, quelle, external_id, art, empfangen_at, absender_name)
  values (v_me, 'gmail_linkedin', 'e2e-msg-7', 'nachricht', now(), 'E2E – Clara Doppelt') returning * into e;
  e := crm.eingang_verarbeiten(e.id);
  if e.status <> 'unbekannt' or e.ergebnis not like '%passt zu 2 Leads%' then raise exception 'FAIL eingang-8b: % „%“', e.status, e.ergebnis; end if;

  update crm.leads set owner_id = v_me where id = pg_temp.v('lead_c2')::uuid;
  insert into crm.eingang (member_id, quelle, external_id, art, empfangen_at, absender_name)
  values (v_me, 'gmail_linkedin', 'e2e-msg-8', 'nachricht', now(), 'E2E – Clara Doppelt') returning * into e;
  e := crm.eingang_verarbeiten(e.id);
  if e.status <> 'unbekannt' or e.lead_id is not null or e.ergebnis not like '%nicht vernetzt%' then
    raise exception 'FAIL eingang-8c: ohne Vernetzung % / % „%“', e.status, e.lead_id, e.ergebnis;
  end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub', pg_temp.v('vincent'), true);
set local role authenticated;
select crm.mark_accepted(pg_temp.v('lead_c2')::uuid);
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role service_role;
do $$
declare e crm.eingang; v_me uuid := pg_temp.v('vincent')::uuid;
begin
  insert into crm.eingang (member_id, quelle, external_id, art, empfangen_at, absender_name)
  values (v_me, 'gmail_linkedin', 'e2e-msg-8b', 'nachricht', now(), 'E2E – Clara Doppelt') returning * into e;
  e := crm.eingang_verarbeiten(e.id);
  if e.status <> 'verarbeitet' or e.lead_id::text <> pg_temp.v('lead_c2') then raise exception 'FAIL eingang-8c: % / %', e.status, e.lead_id; end if;

  insert into crm.eingang (member_id, quelle, external_id, art, empfangen_at, absender_name, linkedin_slug)
  values (v_me, 'gmail_linkedin', 'e2e-msg-9', 'nachricht', now(), 'E2E – Dora Profiltest', 'e2e-eingang-d-anders') returning * into e;
  e := crm.eingang_verarbeiten(e.id);
  if e.status <> 'unbekannt' or e.ergebnis not like '%anderes LinkedIn-Profil%' then raise exception 'FAIL eingang-8d: % „%“', e.status, e.ergebnis; end if;
  insert into ctx values ('e_profil', e.id::text);

  insert into crm.eingang (member_id, quelle, external_id, art, empfangen_at, absender_name, text)
  values (v_me, 'gmail_linkedin', 'e2e-msg-10', 'einladung', now(), 'Dr. E2E – Bernd Namenstest', 'E2E – Einladungsnotiz') returning * into e;
  e := crm.eingang_verarbeiten(e.id);
  if e.status <> 'neu' or e.lead_id::text <> pg_temp.v('lead_b') or e.verarbeitet_at is not null then
    raise exception 'FAIL eingang-8e: % / % / %', e.status, e.lead_id, e.verarbeitet_at;
  end if;

  insert into crm.eingang (member_id, quelle, external_id, art, empfangen_at, absender_name)
  values (v_me, 'gmail_linkedin', 'e2e-msg-11', 'einladung', now(), 'E2E – Fremde Person') returning * into e;
  update crm.eingang set roh = '{"betreff":"E2E – Fremde Person möchte sich vernetzen","parser":{"regel":"betreff:de-einladung-moechte"}}', text = 'E2E – Notiz'
   where id = e.id;
  e := crm.eingang_verarbeiten(e.id);
  if e.status <> 'ignoriert' then raise exception 'FAIL eingang-8f: Einladung ohne Lead %', e.status; end if;
  if e.absender_name is not null or e.text is not null or e.roh ? 'betreff' or not (e.roh ? 'parser') then
    raise exception 'FAIL eingang-8f: Daten Dritter bleiben stehen (%, %, %)', e.absender_name, e.text, e.roh;
  end if;
  insert into crm.eingang (member_id, quelle, external_id, art, empfangen_at, absender_name)
  values (v_me, 'gmail_linkedin', 'e2e-msg-12', 'sonstiges', now(), 'E2E – Anna Slugtest') returning * into e;
  e := crm.eingang_verarbeiten(e.id);
  if e.status <> 'ignoriert' or e.activity_id is not null then raise exception 'FAIL eingang-8g: sonstiges %', e.status; end if;
  perform pg_temp.ok('eingang-8 unbekannt · mehrdeutig · eigener Lead ohne Vernetzung unbekannt, mit Vernetzung verbucht · anderer Profil-Link · Titel „Dr.“ + Einladung (neu) · Einladung Fremder ohne Name/Text/Betreff · sonstiges');
end $$;

-- 8h) Annahme nur über den Namen: ohne offene Anfrage unbekannt (keine Vernetzung angelegt), mit Anfrage verbucht
-- 8i) eigener Slug (member_profiles.linkedin_url) zählt nicht → Name über alle Leads (Dora hat eine URL)
-- 8j) Slug weicht vom Lead ab, Name + Vernetzung passen → verbucht mit Prüf-Hinweis
select set_config('request.jwt.claim.sub', '', true);
set local role service_role;
do $$
declare e crm.eingang; v_me uuid := pg_temp.v('vincent')::uuid; v_j uuid := pg_temp.v('lead_j')::uuid; v_d uuid := pg_temp.v('lead_d')::uuid;
begin
  insert into crm.eingang (member_id, quelle, external_id, art, empfangen_at, absender_name)
  values (v_me, 'gmail_linkedin', 'e2e-msg-17', 'annahme', now(), 'E2E – Jana Anfragetest') returning * into e;
  e := crm.eingang_verarbeiten(e.id);
  if e.status <> 'unbekannt' or e.ergebnis not like '%keine offene Anfrage%'
     or exists (select 1 from crm.linkedin_connections where lead_id = v_j) then
    raise exception 'FAIL eingang-8h: ohne Anfrage % „%“', e.status, e.ergebnis;
  end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub', pg_temp.v('vincent'), true);
set local role authenticated;
select crm.log_request(pg_temp.v('lead_j')::uuid);
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role service_role;
do $$
declare e crm.eingang; v_me uuid := pg_temp.v('vincent')::uuid; v_j uuid := pg_temp.v('lead_j')::uuid; v_d uuid := pg_temp.v('lead_d')::uuid;
begin
  insert into crm.eingang (member_id, quelle, external_id, art, empfangen_at, absender_name)
  values (v_me, 'gmail_linkedin', 'e2e-msg-18', 'annahme', now(), 'E2E – Jana Anfragetest') returning * into e;
  e := crm.eingang_verarbeiten(e.id);
  if e.status <> 'verarbeitet' or e.lead_id <> v_j or e.ergebnis <> 'Annahme verbucht – Sequenz gestartet' then
    raise exception 'FAIL eingang-8h: mit Anfrage % „%“', e.status, e.ergebnis;
  end if;

  update crm.member_profiles set linkedin_url = 'https://www.linkedin.com/in/e2e-eigenes-profil' where member_id = v_me;
  insert into crm.eingang (member_id, quelle, external_id, art, empfangen_at, absender_name, linkedin_slug)
  values (v_me, 'gmail_linkedin', 'e2e-msg-19', 'einladung', now(), 'E2E – Dora Profiltest', 'E2E-Eigenes-Profil') returning * into e;
  e := crm.eingang_verarbeiten(e.id);
  if e.status <> 'neu' or e.lead_id is distinct from v_d then raise exception 'FAIL eingang-8i: eigener Slug % / %', e.status, e.lead_id; end if;

end $$;
reset role;
select set_config('request.jwt.claim.sub', pg_temp.v('vincent'), true);
set local role authenticated;
select crm.mark_accepted(pg_temp.v('lead_d')::uuid);
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role service_role;
do $$
declare e crm.eingang; v_me uuid := pg_temp.v('vincent')::uuid; v_d uuid := pg_temp.v('lead_d')::uuid;
begin
  insert into crm.eingang (member_id, quelle, external_id, art, empfangen_at, absender_name, linkedin_slug, text)
  values (v_me, 'gmail_linkedin', 'e2e-msg-20', 'nachricht', now(), 'E2E – Dora Profiltest', 'e2e-eingang-d-anders', 'E2E – Hallo zurück')
  returning * into e;
  e := crm.eingang_verarbeiten(e.id);
  if e.status <> 'verarbeitet' or e.lead_id is distinct from v_d or e.ergebnis not like 'Antwort verbucht%weicht vom Lead ab%' then
    raise exception 'FAIL eingang-8j: % / % „%“', e.status, e.lead_id, e.ergebnis;
  end if;
  perform pg_temp.ok('eingang-8h–j Annahme per Name nur mit offener Anfrage · eigener Slug zählt nicht · Name + Vernetzung bei abweichendem Link (mit Hinweis)');
end $$;
reset role;
insert into ctx select 'anzahl', count(*)::text from crm.eingang where external_id like 'e2e-msg-%';

-- 9) Rechte der Mitglieder: lesen ja; anlegen, verarbeiten, ändern (auch Status/Lead), Löschfrist auslösen nein – nur über die RPCs
select set_config('request.jwt.claim.sub', pg_temp.v('vincent'), true);
set local role authenticated;
do $$
declare n int; v_ins text := ''; v_ver text := ''; v_txt text := ''; v_upd text := ''; v_lead text := ''; v_auf text := '';
begin
  select count(*) into n from crm.eingang where external_id like 'e2e-msg-%';
  if n <> pg_temp.v('anzahl')::int then raise exception 'FAIL eingang-9: Mitglied sieht % statt % Eingänge', n, pg_temp.v('anzahl'); end if;
  begin insert into crm.eingang (member_id, quelle, external_id) values (auth.uid(), 'erweiterung', 'e2e-x'); exception when others then v_ins := sqlerrm; end;
  begin perform crm.eingang_verarbeiten(pg_temp.v('e_profil')::uuid); exception when others then v_ver := sqlerrm; end;
  begin update crm.eingang set text = 'E2E – geändert' where id = pg_temp.v('e_profil')::uuid; exception when others then v_txt := sqlerrm; end;
  begin update crm.eingang set status = 'neu' where id = pg_temp.v('e_annahme')::uuid; exception when others then v_upd := sqlerrm; end;
  begin update crm.eingang set lead_id = pg_temp.v('lead_f')::uuid where id = pg_temp.v('e_annahme')::uuid; exception when others then v_lead := sqlerrm; end;
  begin perform crm.eingang_aufraeumen(); exception when others then v_auf := sqlerrm; end;
  if v_ins = '' or v_ver = '' or v_txt = '' or v_upd = '' or v_lead = '' or v_auf = '' then
    raise exception 'FAIL eingang-9: anlegen „%“, verarbeiten „%“, Text „%“, Status „%“, Lead „%“, Löschfrist „%“', v_ins, v_ver, v_txt, v_upd, v_lead, v_auf;
  end if;
  if (select status from crm.eingang where id = pg_temp.v('e_annahme')::uuid) <> 'verarbeitet' then raise exception 'FAIL eingang-9: Status doch geändert'; end if;
  perform pg_temp.ok('eingang-9 Mitglied liest; anlegen/verarbeiten/Text/Status/Lead/Löschfrist abgewiesen: ' || v_upd);
end $$;

-- 10) zuordnen (unbekannt → Lead F, Antwort verbucht im Namen des Postfach-Inhabers), erneutes Umhängen abgewiesen, ignorieren
do $$
declare e crm.eingang; v_um text := ''; v_ign text := '';
begin
  e := crm.eingang_zuordnen(pg_temp.v('e_unbekannt')::uuid, pg_temp.v('lead_f')::uuid);
  if e.status <> 'verarbeitet' or e.lead_id::text <> pg_temp.v('lead_f') or e.activity_id is null then
    raise exception 'FAIL eingang-10: zuordnen % / % / %', e.status, e.lead_id, e.activity_id;
  end if;
  if (select member_id::text from crm.activities where id = e.activity_id) <> pg_temp.v('vincent') then raise exception 'FAIL eingang-10: falsches Mitglied'; end if;
  if auth.uid()::text <> pg_temp.v('vincent') then raise exception 'FAIL eingang-10: auth.uid() nicht wiederhergestellt'; end if;
  begin perform crm.eingang_zuordnen(e.id, pg_temp.v('lead_a')::uuid); exception when others then v_um := sqlerrm; end;
  if v_um = '' then raise exception 'FAIL eingang-10: verarbeiteter Eingang ließ sich umhängen'; end if;
  begin perform crm.eingang_ignorieren(e.id); exception when others then v_ign := sqlerrm; end;
  if v_ign = '' then raise exception 'FAIL eingang-10: verarbeiteter Eingang ließ sich ignorieren'; end if;
  e := crm.eingang_ignorieren((select id from crm.eingang where external_id = 'e2e-msg-7'));
  if e.status <> 'ignoriert' or e.ergebnis <> 'Von Hand ignoriert' or e.absender_name is not null then
    raise exception 'FAIL eingang-10: ignorieren % / %', e.status, e.absender_name;
  end if;
  perform pg_temp.ok('eingang-10 zuordnen verbucht (Vincent), auth.uid() bleibt; umhängen/ignorieren nach Verarbeitung abgewiesen; ignorieren');
end $$;
reset role;

-- 10b) Reaktion nachtragen: Antwort aus der Mail (ohne Reaktion) bekommt das Label – keine zweite nachricht_erhalten
select set_config('request.jwt.claim.sub', pg_temp.v('vincent'), true);
set local role authenticated;
do $$
declare v_act bigint; r bigint; a crm.activities; n int; v_x text := ''; v_y text := ''; v_lead uuid := pg_temp.v('lead_b')::uuid;
begin
  select activity_id into v_act from crm.eingang where external_id = 'e2e-msg-3';
  r := crm.set_reply_label(v_act, 'interessiert', 'E2E – Zitat aus der Seitenleiste');
  select * into a from crm.activities where id = v_act;
  select count(*) into n from crm.activities where lead_id = v_lead and type = 'nachricht_erhalten';
  if r <> v_act or a.reply_label <> 'interessiert' or a.outcome <> 'interessiert' or a.note <> 'E2E – Danke, gern mehr Infos.' or n <> 1 then
    raise exception 'FAIL eingang-10b: % / % / „%“ / % Antworten', r, a.reply_label, a.note, n;
  end if;
  if crm.set_reply_label(v_act, 'interessiert') <> v_act then raise exception 'FAIL eingang-10b: nicht idempotent'; end if;
  begin perform crm.set_reply_label(v_act, 'spaeter'); exception when others then v_x := sqlerrm; end;
  begin perform crm.set_reply_label(pg_temp.v('act_annahme')::bigint, 'interessiert'); exception when others then v_y := sqlerrm; end;
  if v_x = '' or v_y = '' then raise exception 'FAIL eingang-10b: anderes Label „%“ / falscher Typ „%“', v_x, v_y; end if;
  r := crm.set_reply_label(pg_temp.v('act_h')::bigint, 'nicht_icp');
  if (select stage::text || '/' || ended_reason::text from crm.leads where id = pg_temp.v('lead_h')::uuid) <> 'beendet/nicht_icp' then
    raise exception 'FAIL eingang-10b: nicht_icp beendet den Lead nicht';
  end if;
  perform pg_temp.ok('eingang-10b set_reply_label: Label an vorhandener Antwort, Mail-Text bleibt, keine zweite Antwort, idempotent; nicht_icp beendet: ' || v_x);
end $$;
reset role;

-- 10c) Löschfrist: ignorierte Einträge älter als 30 Tage weg, frische bleiben
insert into crm.eingang (member_id, quelle, external_id, art, status, created_at, verarbeitet_at)
values (pg_temp.v('vincent')::uuid, 'gmail_linkedin', 'e2e-msg-alt', 'sonstiges', 'ignoriert', now() - interval '40 days', now() - interval '40 days'),
       (pg_temp.v('vincent')::uuid, 'gmail_linkedin', 'e2e-msg-frisch', 'sonstiges', 'ignoriert', now() - interval '2 days', now() - interval '2 days');
set local role service_role;
do $$
declare n int;
begin
  n := crm.eingang_aufraeumen();
  if n < 1 or exists (select 1 from crm.eingang where external_id = 'e2e-msg-alt')
     or not exists (select 1 from crm.eingang where external_id = 'e2e-msg-frisch') then
    raise exception 'FAIL eingang-10c: Löschfrist (% gelöscht)', n;
  end if;
  perform pg_temp.ok('eingang-10c Löschfrist: ignoriert > 30 Tage gelöscht, frische bleiben');
end $$;
reset role;

-- 11) Nicht-Mitglied: sieht nichts, darf nichts
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000f00d', true);
set local role authenticated;
do $$
declare n int; v_a text := ''; v_b text := ''; v_c text := '';
begin
  select count(*) into n from crm.eingang;
  if n <> 0 then raise exception 'FAIL eingang-11: Nicht-Mitglied sieht % Eingänge', n; end if;
  begin perform crm.set_reply_label(pg_temp.v('act_annahme')::bigint, 'interessiert'); exception when others then v_c := sqlerrm; end;
  if v_c = '' then raise exception 'FAIL eingang-11: Nicht-Mitglied darf set_reply_label'; end if;
  begin perform crm.eingang_token_erzeugen('fremd'); exception when others then v_a := sqlerrm; end;
  begin perform crm.eingang_zuordnen(pg_temp.v('e_profil')::uuid, pg_temp.v('lead_a')::uuid); exception when others then v_b := sqlerrm; end;
  if v_a = '' or v_b = '' then raise exception 'FAIL eingang-11: Nicht-Mitglied nicht abgewiesen'; end if;
  perform pg_temp.ok('eingang-11 Nicht-Mitglied: 0 Zeilen, Schlüssel/Zuordnen abgewiesen: ' || v_a);
end $$;
reset role;

-- 12) Realtime-Publikation
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'crm' and tablename = 'eingang') then
    raise exception 'FAIL eingang-12: crm.eingang nicht in supabase_realtime';
  end if;
  perform pg_temp.ok('eingang-12 crm.eingang in supabase_realtime');
end $$;

-- 13) Fehlerpfad (zuletzt, weil der Test-Trigger crm.linkedin_connections bis zum rollback sperrt):
--     Fehler in mark_accepted → status fehler mit Text, keine halbe Verbuchung, auth.uid() wieder leer
do $do$
begin
  execute format($f$create function crm.e2e_fehler_test() returns trigger language plpgsql set search_path = '' as $b$
    begin
      if new.lead_id = %L::uuid then raise exception 'E2E – absichtlicher Fehler'; end if;
      return new;
    end $b$ $f$, pg_temp.v('lead_e'));
end $do$;
create trigger e2e_fehler_test before insert or update on crm.linkedin_connections for each row execute function crm.e2e_fehler_test();
select set_config('request.jwt.claim.sub', '', true);
set local role service_role;
do $$
declare e crm.eingang; v_lead uuid := pg_temp.v('lead_e')::uuid;
begin
  insert into crm.eingang (member_id, quelle, external_id, art, empfangen_at, linkedin_slug)
  values (pg_temp.v('vincent')::uuid, 'gmail_linkedin', 'e2e-msg-13', 'annahme', now(), 'e2e-eingang-e') returning * into e;
  e := crm.eingang_verarbeiten(e.id);
  if e.status <> 'fehler' or e.ergebnis <> 'E2E – absichtlicher Fehler' or e.lead_id is distinct from v_lead then
    raise exception 'FAIL eingang-13: % „%“', e.status, e.ergebnis;
  end if;
  if exists (select 1 from crm.activities where lead_id = v_lead and type = 'vernetzung_angenommen') then raise exception 'FAIL eingang-13: halbe Verbuchung'; end if;
  if auth.uid() is not null then raise exception 'FAIL eingang-13: auth.uid() nach Fehler %', auth.uid(); end if;
  perform pg_temp.ok('eingang-13 Fehler → status fehler mit Text, nichts verbucht, auth.uid() leer');
end $$;
reset role;

insert into pruef (fall, ergebnis) values ('alle Fälle', 'ok');
select nr, fall, ergebnis from pruef order by nr;
rollback;
