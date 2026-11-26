-- Integrationstest KPI-Zahlen (Migrationen 29 bis 31) gegen die echte Datenbank – eine Transaktion, am Ende per Exception zurückgerollt
-- (es bleibt nichts zurück). Nur erfundene Namen und Adressen.
-- Aufruf: bash tools/db-query.sh -f supabase/tests/kpi_test.sql
-- Ergebnis steht in der Fehlermeldung „TESTERGEBNIS: …“ (oder „FEHLER: …“ bei einer verletzten Annahme).
-- Die Vergleiche lesen „angeschrieben/gespraech/im_geschaeft/verloren“ der angemeldeten Person für heute, jeweils als
-- Unterschied zum Stand vor dem Test.
do $$
declare
  v_me uuid := (select id from crm.members where display_name = 'Vincent' limit 1);
  v_mike uuid := (select id from crm.members where display_name = 'Mike' limit 1);
  v_heute date := crm.berlin_date(now());
  v_frueher date := crm.berlin_date(now() - interval '3 days');
  a0 int; g0 int; i0 int; v0 int; m0 int; f0 int; n int; n2 int;
  r jsonb; v_id uuid; v_alt uuid; v_alt2 uuid; v_r uuid; v_h uuid; v_seit timestamptz; s text;
  out text := '';
begin
  perform set_config('request.jwt.claims', json_build_object('sub', v_me, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select coalesce(sum(angeschrieben), 0), coalesce(sum(gespraech), 0), coalesce(sum(im_geschaeft), 0), coalesce(sum(verloren), 0)
    into a0, g0, i0, v0 from crm.v_kpi_tage where member_id = v_me and tag = v_heute and period = 'tag';
  select coalesce(sum(angeschrieben), 0) into m0 from crm.v_kpi_tage where member_id = v_mike and tag = v_heute and period = 'tag';
  select coalesce(sum(angeschrieben), 0) into f0 from crm.v_kpi_tage where member_id = v_me and tag = v_frueher and period = 'tag';

  -- 1. Karte anlegen zählt als „Angeschrieben“; ein Lauf entsteht
  r := crm.board_karte_anlegen('Karla', 'Kennzahl', 'https://www.linkedin.com/in/karla-kennzahl-kpi-test');
  v_id := (r ->> 'lead_id')::uuid;
  select format('%s/%s/%s/%s', coalesce(sum(angeschrieben), 0) - a0, coalesce(sum(gespraech), 0) - g0, coalesce(sum(im_geschaeft), 0) - i0, coalesce(sum(verloren), 0) - v0)
    into s from crm.v_kpi_tage where member_id = v_me and tag = v_heute and period = 'tag';
  if s <> '1/0/0/0' then raise exception 'FEHLER 1 anlegen: %', s; end if;
  select count(*) into n from crm.board_laeufe where lead_id = v_id and beendet_am is null and gespraech_am is null;
  if n <> 1 then raise exception 'FEHLER 1: % offene Läufe', n; end if;
  -- eine Änderung ohne Listenwechsel lässt den Lauf in Ruhe
  update crm.leads set notes = 'Probe' where id = v_id;
  select count(*) into n from crm.board_laeufe where lead_id = v_id;
  if n <> 1 then raise exception 'FEHLER 1: Notiz erzeugt einen Lauf'; end if;
  out := out || '1 Anlegen ok; ';

  -- 2. „Hat Interesse“ zählt als Gespräch; „Rückgängig“ nimmt es wieder heraus
  -- („Rückgängig“ erkennt der Trigger am alten Zeitstempel. In dieser einen Transaktion steht now() still, deshalb liegt die
  -- Karte für den Test „seit einer Stunde“ in ihrer Liste.)
  update crm.leads set board_seit = now() - interval '1 hour' where id = v_id;
  select board_seit into v_seit from crm.leads where id = v_id;
  update crm.leads set board_liste = 'gespraech' where id = v_id;
  select format('%s/%s/%s/%s', coalesce(sum(angeschrieben), 0) - a0, coalesce(sum(gespraech), 0) - g0, coalesce(sum(im_geschaeft), 0) - i0, coalesce(sum(verloren), 0) - v0)
    into s from crm.v_kpi_tage where member_id = v_me and tag = v_heute and period = 'tag';
  if s <> '1/1/0/0' then raise exception 'FEHLER 2 Gespräch: %', s; end if;
  update crm.leads set board_liste = 'angeschrieben', board_seit = v_seit where id = v_id;
  select format('%s/%s/%s/%s', coalesce(sum(angeschrieben), 0) - a0, coalesce(sum(gespraech), 0) - g0, coalesce(sum(im_geschaeft), 0) - i0, coalesce(sum(verloren), 0) - v0)
    into s from crm.v_kpi_tage where member_id = v_me and tag = v_heute and period = 'tag';
  if s <> '1/0/0/0' then raise exception 'FEHLER 2 Rückgängig: %', s; end if;
  select count(*) into n from crm.board_laeufe where lead_id = v_id and vorher is null and gespraech_am is null;
  if n <> 1 then raise exception 'FEHLER 2: Rückgängig lief nicht durch den Rückgängig-Zweig'; end if;
  out := out || '2 Gespräch/Rückgängig ok; ';

  -- 3. Sprung nach „Im Geschäft“ zählt das Gespräch mit; „Verloren“ behält beides; zurück nach „Gespräch“ hebt beides auf
  update crm.leads set board_liste = 'im_geschaeft' where id = v_id;
  select format('%s/%s/%s/%s', coalesce(sum(angeschrieben), 0) - a0, coalesce(sum(gespraech), 0) - g0, coalesce(sum(im_geschaeft), 0) - i0, coalesce(sum(verloren), 0) - v0)
    into s from crm.v_kpi_tage where member_id = v_me and tag = v_heute and period = 'tag';
  if s <> '1/1/1/0' then raise exception 'FEHLER 3 Im Geschäft: %', s; end if;
  update crm.leads set board_liste = 'verloren' where id = v_id;
  select format('%s/%s/%s/%s', coalesce(sum(angeschrieben), 0) - a0, coalesce(sum(gespraech), 0) - g0, coalesce(sum(im_geschaeft), 0) - i0, coalesce(sum(verloren), 0) - v0)
    into s from crm.v_kpi_tage where member_id = v_me and tag = v_heute and period = 'tag';
  if s <> '1/1/1/1' then raise exception 'FEHLER 3 Verloren: %', s; end if;
  update crm.leads set board_liste = 'gespraech' where id = v_id;
  select format('%s/%s/%s/%s', coalesce(sum(angeschrieben), 0) - a0, coalesce(sum(gespraech), 0) - g0, coalesce(sum(im_geschaeft), 0) - i0, coalesce(sum(verloren), 0) - v0)
    into s from crm.v_kpi_tage where member_id = v_me and tag = v_heute and period = 'tag';
  if s <> '1/1/0/0' then raise exception 'FEHLER 3 zurück: %', s; end if;
  update crm.leads set board_liste = 'verloren' where id = v_id;
  update crm.leads set board_liste = 'angeschrieben' where id = v_id;
  select format('%s/%s/%s/%s', coalesce(sum(angeschrieben), 0) - a0, coalesce(sum(gespraech), 0) - g0, coalesce(sum(im_geschaeft), 0) - i0, coalesce(sum(verloren), 0) - v0)
    into s from crm.v_kpi_tage where member_id = v_me and tag = v_heute and period = 'tag';
  if s <> '1/0/0/0' then raise exception 'FEHLER 3 ganz zurück: %', s; end if;
  out := out || '3 Stufen ok; ';

  -- 4. Die Zahl gehört der Person, der die Karte gehört
  update crm.leads set owner_id = v_mike where id = v_id;
  select coalesce(sum(angeschrieben), 0) - a0 into n from crm.v_kpi_tage where member_id = v_me and tag = v_heute and period = 'tag';
  select coalesce(sum(angeschrieben), 0) - m0 into n2 from crm.v_kpi_tage where member_id = v_mike and tag = v_heute and period = 'tag';
  if n <> 0 or n2 <> 1 then raise exception 'FEHLER 4 Zugehörigkeit: ich %, Mike %', n, n2; end if;
  update crm.leads set owner_id = v_me where id = v_id;
  out := out || '4 Zugehörigkeit ok; ';

  -- 5. Versehen: gerade angelegt und gleich wieder vom Board → zählt nicht. Neu anlegen zählt wieder einmal.
  update crm.leads set board_liste = null where id = v_id;
  select count(*) into n from crm.board_laeufe where lead_id = v_id;
  select coalesce(sum(angeschrieben), 0) - a0 into n2 from crm.v_kpi_tage where member_id = v_me and tag = v_heute and period = 'tag';
  if n <> 0 or n2 <> 0 then raise exception 'FEHLER 5 Versehen: % Läufe, Zahl %', n, n2; end if;
  r := crm.board_karte_anlegen('Karla', 'Kennzahl', 'linkedin.com/in/karla-kennzahl-kpi-test');
  if r ->> 'status' <> 'uebernommen' then raise exception 'FEHLER 5: %', r; end if;
  select coalesce(sum(angeschrieben), 0) - a0 into n2 from crm.v_kpi_tage where member_id = v_me and tag = v_heute and period = 'tag';
  if n2 <> 1 then raise exception 'FEHLER 5 wieder da: %', n2; end if;
  out := out || '5 Versehen ok; ';

  -- 6. Aufräumen ändert keine Zahlen: älterer Lauf, „Verloren“, vom Board → Zahlen bleiben; „Rückgängig“ führt denselben Lauf
  --    weiter; später neu aufs Board = neuer Lauf
  execute 'reset role';
  update crm.board_laeufe set angeschrieben_am = now() - interval '3 days' where lead_id = v_id and beendet_am is null;
  execute 'set local role authenticated';
  select coalesce(sum(angeschrieben), 0) - a0 into n from crm.v_kpi_tage where member_id = v_me and tag = v_heute and period = 'tag';
  select coalesce(sum(angeschrieben), 0) - f0 into n2 from crm.v_kpi_tage where member_id = v_me and tag = v_frueher and period = 'tag';
  if n <> 0 or n2 <> 1 then raise exception 'FEHLER 6 Tag: heute %, früher %', n, n2; end if;
  update crm.leads set board_liste = 'verloren' where id = v_id;
  -- „Rückgängig“ erkennt der Trigger am alten Zeitstempel. In dieser einen Transaktion steht now() still, deshalb liegt die
  -- Karte für den Test „seit einer Stunde“ in der Liste.
  update crm.leads set board_seit = now() - interval '1 hour' where id = v_id;
  select board_seit into v_seit from crm.leads where id = v_id;
  update crm.leads set board_liste = null where id = v_id;
  select count(*) into n from crm.board_laeufe where lead_id = v_id and beendet_am is not null;
  select format('%s/%s/%s/%s', coalesce(sum(angeschrieben), 0) - a0, coalesce(sum(gespraech), 0) - g0, coalesce(sum(im_geschaeft), 0) - i0, coalesce(sum(verloren), 0) - v0)
    into s from crm.v_kpi_tage where member_id = v_me and tag = v_heute and period = 'tag';
  if n <> 1 or s <> '0/0/0/1' then raise exception 'FEHLER 6 vom Board: % beendet, %', n, s; end if;
  update crm.leads set board_liste = 'verloren', board_seit = v_seit where id = v_id;
  select count(*) into n from crm.board_laeufe where lead_id = v_id;
  select count(*) into n2 from crm.board_laeufe where lead_id = v_id and beendet_am is null and verloren_am is not null;
  if n <> 1 or n2 <> 1 then raise exception 'FEHLER 6 Rückgängig: % Läufe, % offen', n, n2; end if;
  update crm.leads set board_liste = null where id = v_id;
  execute 'reset role';
  update crm.board_laeufe set beendet_am = now() - interval '1 hour' where lead_id = v_id;
  execute 'set local role authenticated';
  r := crm.board_karte_anlegen('Karla', 'Kennzahl', 'linkedin.com/in/karla-kennzahl-kpi-test');
  select count(*) into n from crm.board_laeufe where lead_id = v_id;
  select format('%s/%s/%s/%s', coalesce(sum(angeschrieben), 0) - a0, coalesce(sum(gespraech), 0) - g0, coalesce(sum(im_geschaeft), 0) - i0, coalesce(sum(verloren), 0) - v0)
    into s from crm.v_kpi_tage where member_id = v_me and tag = v_heute and period = 'tag';
  if n <> 2 or s <> '1/0/0/1' then raise exception 'FEHLER 6 neuer Lauf: % Läufe, %', n, s; end if;
  out := out || '6 Aufräumen ok; ';

  -- 7. Lead aus dem alten CRM mit schon eröffnetem Gespräch: zählt an seinem alten Tag, auf dem Board nicht noch einmal
  execute 'reset role';
  insert into crm.leads (first_name, last_name, linkedin_url, owner_id, stage)
  values ('Alma', 'Altbestand', 'https://www.linkedin.com/in/alma-altbestand-kpi-test', v_me, 'dm_follow_up') returning id into v_alt;
  insert into crm.activities (lead_id, member_id, channel, type, occurred_at)
  values (v_alt, v_me, 'linkedin', 'gespraech_eroeffnet', now() - interval '3 days');
  execute 'set local role authenticated';
  select coalesce(sum(angeschrieben), 0) - f0 into n from crm.v_kpi_tage where member_id = v_me and tag = v_frueher and period = 'tag';
  if n <> 2 then raise exception 'FEHLER 7 alter Tag: %', n; end if;
  r := crm.board_karte_anlegen('Alma', 'Altbestand', 'linkedin.com/in/alma-altbestand-kpi-test');
  if r ->> 'status' <> 'uebernommen' then raise exception 'FEHLER 7: %', r; end if;
  update crm.leads set board_liste = 'gespraech' where id = v_alt;
  select format('%s/%s/%s/%s', coalesce(sum(angeschrieben), 0) - a0, coalesce(sum(gespraech), 0) - g0, coalesce(sum(im_geschaeft), 0) - i0, coalesce(sum(verloren), 0) - v0)
    into s from crm.v_kpi_tage where member_id = v_me and tag = v_heute and period = 'tag';
  if s <> '1/1/0/1' then raise exception 'FEHLER 7 Altbestand: %', s; end if;
  -- war er im alten CRM schon Kunde, zählt „Im Geschäft“ auf dem Board nicht noch einmal
  execute 'reset role';
  insert into crm.activities (lead_id, member_id, channel, type, occurred_at, metadata)
  values (v_alt, v_me, 'linkedin', 'stage_wechsel', now() - interval '3 days', '{"from":"dm_follow_up","to":"kunde"}');
  execute 'set local role authenticated';
  update crm.leads set board_liste = 'im_geschaeft' where id = v_alt;
  select format('%s/%s/%s/%s', coalesce(sum(angeschrieben), 0) - a0, coalesce(sum(gespraech), 0) - g0, coalesce(sum(im_geschaeft), 0) - i0, coalesce(sum(verloren), 0) - v0)
    into s from crm.v_kpi_tage where member_id = v_me and tag = v_heute and period = 'tag';
  if s <> '1/1/0/1' then raise exception 'FEHLER 7 alter Kunde: %', s; end if;
  -- steht die alte Eröffnung nur in den importierten Sheet-Zahlen (kpi_relevant = false), zählt das Board sie auch nicht noch einmal
  execute 'reset role';
  insert into crm.leads (first_name, last_name, linkedin_url, owner_id, stage)
  values ('Selma', 'Sheetzahl', 'https://www.linkedin.com/in/selma-sheetzahl-kpi-test', v_me, 'dm_follow_up') returning id into v_alt2;
  insert into crm.activities (lead_id, member_id, channel, type, occurred_at, kpi_relevant)
  values (v_alt2, v_me, 'linkedin', 'gespraech_eroeffnet', now() - interval '60 days', false);
  execute 'set local role authenticated';
  r := crm.board_karte_anlegen('Selma', 'Sheetzahl', 'linkedin.com/in/selma-sheetzahl-kpi-test');
  select format('%s/%s/%s/%s', coalesce(sum(angeschrieben), 0) - a0, coalesce(sum(gespraech), 0) - g0, coalesce(sum(im_geschaeft), 0) - i0, coalesce(sum(verloren), 0) - v0)
    into s from crm.v_kpi_tage where member_id = v_me and tag = v_heute and period = 'tag';
  if r ->> 'status' <> 'uebernommen' or s <> '1/1/0/1' then raise exception 'FEHLER 7 Sheet-Lead: %, %', r, s; end if;
  out := out || '7 Altbestand ok; ';

  -- 8. Tageszähler: die Zahl des Tages, erneutes Eintragen ersetzt sie
  perform crm.set_counter('vernetzungen_versendet', 20, date '2031-01-15');
  perform crm.set_counter('vernetzungen_angenommen', 7, date '2031-01-15');
  perform crm.set_counter('vernetzungen_versendet', 25, date '2031-01-15');
  select coalesce(sum(vernetzungen_versendet), 0), coalesce(sum(vernetzungen_angenommen), 0) into n, n2
    from crm.v_kpi_tage where member_id = v_me and tag = date '2031-01-15' and period = 'tag';
  if n <> 25 or n2 <> 7 then raise exception 'FEHLER 8 Zähler: %/%', n, n2; end if;
  select count(*) into n from crm.v_kpi_tage where member_id = v_mike and tag = date '2031-01-15';
  if n <> 0 then raise exception 'FEHLER 8: Zähler bei der falschen Person'; end if;
  out := out || '8 Zähler ok; ';

  -- 9. Alte Zahlen sind da und stimmen mit dem alten Reiter überein (Oktober 2026, mit Monatszählern)
  select coalesce(sum(angeschrieben), 0), coalesce(sum(vernetzungen_versendet), 0) into n, n2
    from crm.v_kpi_tage where tag between date '2026-10-01' and date '2026-10-31';
  if n <> (select coalesce(sum(value), 0) from crm.v_metric_events where metric = 'gespraeche_eroeffnet' and day between date '2026-10-01' and date '2026-10-31')
     or n2 <> (select coalesce(sum(value), 0) from crm.v_metric_events where metric = 'vernetzungen_versendet' and day between date '2026-10-01' and date '2026-10-31')
     or n < 100 or n2 < 300 then
    raise exception 'FEHLER 9 alte Zahlen: angeschrieben %, versendet %', n, n2;
  end if;
  select count(*) into n from crm.v_kpi_tage where period = 'monat' and tag = date '2026-10-01' and vernetzungen_versendet > 0;
  if n < 1 then raise exception 'FEHLER 9: Monatszähler fehlen'; end if;
  out := out || '9 alte Zahlen ok; ';

  -- 10. „Rückgängig“ stellt den Lauf genau wieder her – auch die Stufen, die der versehentliche Zug geleert hat (Migration 30)
  r := crm.board_karte_anlegen('Rita', 'Rueckweg', 'https://www.linkedin.com/in/rita-rueckweg-kpi-test');
  v_r := (r ->> 'lead_id')::uuid;
  update crm.leads set board_liste = 'gespraech' where id = v_r;
  execute 'reset role';
  update crm.board_laeufe set angeschrieben_am = now() - interval '5 days', gespraech_am = now() - interval '3 days' where lead_id = v_r;
  execute 'set local role authenticated';
  update crm.leads set board_liste = 'verloren' where id = v_r;
  update crm.leads set board_seit = now() - interval '1 hour' where id = v_r;
  select board_seit into v_seit from crm.leads where id = v_r;
  update crm.leads set board_liste = 'angeschrieben' where id = v_r; -- Versehen
  select count(*) into n from crm.board_laeufe where lead_id = v_r and gespraech_am is null and verloren_am is null;
  if n <> 1 then raise exception 'FEHLER 10: der Zug nach vorn leert die späteren Stufen nicht'; end if;
  update crm.leads set board_liste = 'verloren', board_seit = v_seit where id = v_r; -- Rückgängig
  select count(*) into n from crm.board_laeufe
   where lead_id = v_r and gespraech_am = now() - interval '3 days' and verloren_am is not null and im_geschaeft_am is null and vorher is null;
  if n <> 1 then raise exception 'FEHLER 10 Rückgängig aus Verloren: %', (select row_to_json(x) from crm.board_laeufe x where x.lead_id = v_r); end if;
  -- Im Geschäft → versehentlich Angeschrieben → Rückgängig: das Gespräch behält seinen alten Tag
  update crm.leads set board_liste = 'im_geschaeft' where id = v_r;
  update crm.leads set board_seit = now() - interval '1 hour' where id = v_r;
  select board_seit into v_seit from crm.leads where id = v_r;
  update crm.leads set board_liste = 'angeschrieben' where id = v_r;
  update crm.leads set board_liste = 'im_geschaeft', board_seit = v_seit where id = v_r;
  select count(*) into n from crm.board_laeufe
   where lead_id = v_r and gespraech_am = now() - interval '3 days' and im_geschaeft_am is not null and verloren_am is null;
  if n <> 1 then raise exception 'FEHLER 10 Rückgängig aus Im Geschäft: %', (select row_to_json(x) from crm.board_laeufe x where x.lead_id = v_r); end if;
  out := out || '10 Rückgängig genau ok; ';

  -- 11. Entfernt und gleich neu angelegt: der alte Lauf bleibt, wie er war; die Neuanlage beginnt einen neuen
  update crm.leads set board_liste = 'verloren' where id = v_r;
  update crm.leads set board_liste = null where id = v_r;
  r := crm.board_karte_anlegen('Rita', 'Rueckweg', 'linkedin.com/in/rita-rueckweg-kpi-test');
  select count(*) into n from crm.board_laeufe where lead_id = v_r;
  select count(*) into n2 from crm.board_laeufe
   where lead_id = v_r and beendet_am is not null and gespraech_am is not null and im_geschaeft_am is not null and verloren_am is not null;
  if r ->> 'status' <> 'uebernommen' or n <> 2 or n2 <> 1 then raise exception 'FEHLER 11 Neuanlage: %, % Läufe, % alter Lauf', r, n, n2; end if;
  out := out || '11 Neuanlage ok; ';

  -- 12. E-Mail: gesendete Mail und als Antwort eingeordneter Eingang zählen; eine Abwesenheitsnotiz nicht
  execute 'reset role';
  -- verbucht wie der Mail-Motor (der prüft die Erlaubnis-Grundlage selbst, bevor er sendet)
  perform set_config('crm.mail_motor', 'buchen', true);
  insert into crm.emails (lead_id, member_id, direction, status, sent_at)
  values (v_id, v_me, 'out', 'sent', timestamptz '2031-01-15 12:00+01');
  perform set_config('crm.mail_motor', '', true);
  insert into crm.emails (lead_id, member_id, direction, status, sent_at, einordnung)
  values (v_id, v_me, 'in', 'received', timestamptz '2031-01-15 13:00+01', 'antwort'),
         (v_id, v_me, 'in', 'received', timestamptz '2031-01-15 14:00+01', 'abwesend');
  execute 'set local role authenticated';
  select coalesce(sum(emails_gesendet), 0), coalesce(sum(email_antworten), 0) into n, n2
    from crm.v_kpi_tage where member_id = v_me and tag = date '2031-01-15' and period = 'tag';
  if n <> 1 or n2 <> 1 then raise exception 'FEHLER 12 E-Mail: gesendet %, Antworten %', n, n2; end if;
  out := out || '12 E-Mail ok; ';

  -- 13. Fehlgriff von Hand zurück (ohne den Knopf „Rückgängig“): kein Kunde, den es nie gab; der alte Tag bleibt (Migration 31)
  r := crm.board_karte_anlegen('Hanna', 'Handkorrektur', 'https://www.linkedin.com/in/hanna-handkorrektur-kpi-test');
  v_h := (r ->> 'lead_id')::uuid;
  update crm.leads set board_liste = 'verloren' where id = v_h;
  execute 'reset role';
  update crm.board_laeufe set angeschrieben_am = now() - interval '5 days', verloren_am = now() - interval '2 days' where lead_id = v_h;
  execute 'set local role authenticated';
  update crm.leads set board_liste = 'im_geschaeft' where id = v_h; -- Fehlgriff
  update crm.leads set board_liste = 'verloren' where id = v_h;     -- gleich zurück
  select count(*) into n from crm.board_laeufe
   where lead_id = v_h and gespraech_am is null and im_geschaeft_am is null and verloren_am = now() - interval '2 days';
  if n <> 1 then raise exception 'FEHLER 13 von Hand zurück: %', (select row_to_json(x) from crm.board_laeufe x where x.lead_id = v_h); end if;
  out := out || '13 von Hand zurück ok; ';

  -- 14. Entfernt → neu angelegt → gleich wieder entfernt → „Rückgängig“ (Rita aus Schritt 11): der alte Lauf bleibt beendet
  execute 'reset role';
  update crm.board_laeufe set beendet_am = now() - interval '5 minutes' where lead_id = v_r and beendet_am is not null;
  update crm.board_laeufe set angeschrieben_am = now() - interval '1 minute' where lead_id = v_r and beendet_am is null;
  execute 'set local role authenticated';
  update crm.leads set board_seit = now() - interval '1 minute' where id = v_r;
  select board_seit into v_seit from crm.leads where id = v_r;
  update crm.leads set board_liste = null where id = v_r;
  update crm.leads set board_liste = 'angeschrieben', board_seit = v_seit where id = v_r;
  select count(*) into n from crm.board_laeufe
   where lead_id = v_r and beendet_am is not null and gespraech_am is not null and im_geschaeft_am is not null and verloren_am is not null;
  select count(*) into n2 from crm.board_laeufe where lead_id = v_r and beendet_am is null and gespraech_am is null;
  if n <> 1 or n2 <> 1 then raise exception 'FEHLER 14: alter Lauf %, neuer Lauf %', n, n2; end if;
  out := out || '14 falscher Lauf bleibt zu ok; ';

  -- 15. „Rückgängig“ nach „Karte entfernt“ auch nach 20 Minuten: derselbe Lauf, kein zweiter
  update crm.leads set board_liste = 'gespraech' where id = v_h;
  update crm.leads set board_seit = now() - interval '1 hour' where id = v_h;
  select board_seit into v_seit from crm.leads where id = v_h;
  update crm.leads set board_liste = null where id = v_h;
  execute 'reset role';
  update crm.board_laeufe set beendet_am = now() - interval '20 minutes' where lead_id = v_h;
  execute 'set local role authenticated';
  update crm.leads set board_liste = 'gespraech', board_seit = v_seit where id = v_h;
  select count(*) into n from crm.board_laeufe where lead_id = v_h;
  select count(*) into n2 from crm.board_laeufe where lead_id = v_h and beendet_am is null and gespraech_am is not null;
  if n <> 1 or n2 <> 1 then raise exception 'FEHLER 15 spätes Rückgängig: % Läufe, % offen', n, n2; end if;
  out := out || '15 spätes Rückgängig ok; ';

  -- 16. Veralteter Bildschirm und falsche Uhr: Karte entfernt, von einem alten Stand aus nach „Im Geschäft“ gelegt → derselbe
  --     Lauf; „Rückgängig“ mit einem Zeitstempel aus der Zukunft wird erkannt und schreibt nichts in die Zukunft
  update crm.leads set board_liste = null where id = v_h;
  update crm.leads set board_liste = 'im_geschaeft' where id = v_h;
  select count(*) into n from crm.board_laeufe where lead_id = v_h;
  select count(*) into n2 from crm.board_laeufe where lead_id = v_h and beendet_am is null and gespraech_am is not null and im_geschaeft_am is not null;
  if n <> 1 or n2 <> 1 then raise exception 'FEHLER 16 veralteter Bildschirm: % Läufe, % offen', n, n2; end if;
  update crm.leads set board_seit = now() - interval '1 hour' where id = v_h;
  update crm.leads set board_liste = 'verloren' where id = v_h;
  update crm.leads set board_liste = 'im_geschaeft', board_seit = now() + interval '30 seconds' where id = v_h;
  select count(*) into n from crm.board_laeufe
   where lead_id = v_h and beendet_am is null and verloren_am is null and im_geschaeft_am is not null
     and greatest(angeschrieben_am, gespraech_am, im_geschaeft_am) <= now();
  if n <> 1 then raise exception 'FEHLER 16 Uhr geht vor: %', (select row_to_json(x) from crm.board_laeufe x where x.lead_id = v_h); end if;
  out := out || '16 alter Stand/Uhr ok; ';

  -- 17. Schlussprüfung für ALLE Karten (auch die echten): jeder offene Lauf passt zur Liste seiner Karte.
  --     Eine Zeile hier hieße: der Trigger hat einen Zug verpasst – dann stimmen die KPI-Zahlen dieser Karte nicht.
  select count(*), string_agg(format('%s %s: Liste %s, Lauf %s', l.first_name, l.last_name, coalesce(l.board_liste, '–'),
                                   coalesce(format('g=%s i=%s v=%s', x.gespraech_am is not null, x.im_geschaeft_am is not null, x.verloren_am is not null), 'fehlt')), ' | ')
    into n, s
    from crm.leads l
    full join (select * from crm.board_laeufe where beendet_am is null) x on x.lead_id = l.id
   where (l.board_liste is not null or x.id is not null)
     and (   x.id is null
          or l.board_liste is null
          or (l.board_liste = 'angeschrieben' and (x.gespraech_am is not null or x.im_geschaeft_am is not null))
          or (l.board_liste = 'gespraech' and (x.gespraech_am is null or x.im_geschaeft_am is not null))
          or (l.board_liste = 'im_geschaeft' and (x.gespraech_am is null or x.im_geschaeft_am is null))
          or ((l.board_liste = 'verloren') <> (x.verloren_am is not null)));
  if n <> 0 then raise exception 'FEHLER 17: bei % Karten passt der Lauf nicht zur Liste (%)', n, s; end if;
  out := out || '17 Läufe passen ok; ';

  -- 18. Rechte: Mitglieder lesen die Läufe nur; ohne Anmeldung keine Zahlen
  begin
    insert into crm.board_laeufe (lead_id, angeschrieben_am) values (v_id, now());
    raise exception 'FEHLER 18: Mitglied schreibt einen Lauf';
  exception when insufficient_privilege then null;
  end;
  begin
    update crm.board_laeufe set gespraech_am = now() where lead_id = v_id;
    raise exception 'FEHLER 18: Mitglied ändert einen Lauf';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from crm.board_laeufe where lead_id = v_id;
    raise exception 'FEHLER 18: Mitglied löscht einen Lauf';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  begin
    perform 1 from crm.v_kpi_tage limit 1;
    raise exception 'FEHLER 18: ohne Anmeldung gelesen';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
  out := out || '18 Rechte ok; ';

  raise exception 'TESTERGEBNIS: %', out;
end
$$;
