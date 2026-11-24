-- Integrationstest tägliches Aufwärmen (Migration 27) gegen die echte Datenbank – eine Transaktion, am Ende per Exception
-- zurückgerollt (es bleibt nichts zurück, auch keine Vault-Geheimnisse und keine geänderte Einstellung). Nur erfundene Adressen.
-- Aufruf: bash tools/db-query.sh -f supabase/tests/mailing_aufwaermen_test.sql
-- Ergebnis steht in der Fehlermeldung „TESTERGEBNIS: …“ (oder „FEHLER: …“ bei einer verletzten Annahme).
do $$
declare
  v_me uuid := (select id from crm.members where display_name = 'Vincent' limit 1);
  pf crm.mail_postfaecher; saat crm.mail_postfaecher;
  jobs jsonb; job jsonb; n int; v_ziele text[]; v_id uuid; v_werktag date; v_samstag date;
  out text := '';
begin
  -- Werktag/Samstag dieser Woche (Planen bekommt den Tag explizit)
  v_werktag := crm.berlin_date(now());
  while extract(isodow from v_werktag) > 5 or crm.is_holiday(v_werktag) loop v_werktag := v_werktag + 1; end loop;
  v_samstag := v_werktag + (6 - extract(isodow from v_werktag))::int;

  -- 0. Testdaten: Versand-Postfach (bereit, Domain alt genug) + ein Prüf-Postfach; nur sie stehen in der Einstellung
  perform set_config('request.jwt.claims', json_build_object('sub', v_me, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  pf := crm.mail_postfach_speichern(jsonb_build_object('adresse', 'warm@aufwaerm-test.test', 'absender_name', 'Warm Testnutzer',
          'anbieter', 'google', 'smtp_host', 'smtp.gmail.com', 'smtp_port', 465, 'smtp_sicherheit', 'ssl', 'imap_host', 'imap.gmail.com'),
          'abcd efgh ijkl mnop');
  insert into crm.mail_domains (domain, dns, registriert_am) values ('aufwaerm-test.test', '{"ok": true}', crm.berlin_date(now()) - 90);
  saat := crm.mail_postfach_speichern(jsonb_build_object('adresse', 'pruef@aufwaerm-gmx.test', 'absender_name', 'Prüf', 'anbieter', 'gmx',
            'rolle', 'saat', 'imap_host', 'imap.gmx.net'), 'geheim1234');
  execute 'set local role service_role';
  perform crm.mail_motor_test_ergebnis(pf.id, '{"ok": true}');
  perform crm.mail_motor_test_ergebnis(saat.id, '{"ok": true}');
  execute 'reset role';
  -- nur das Test-Prüf-Postfach zählt (echte Prüf-Postfächer in dieser Transaktion beiseite)
  update crm.mail_postfaecher set status = 'pausiert' where rolle = 'saat' and id <> saat.id;
  update crm.settings set value = jsonb_set(value, '{aufwaermen}', jsonb_build_object(
    'aktiv', true, 'je_postfach', 5, 'postfaecher', jsonb_build_array('Warm@Aufwaerm-Test.test'),
    'empfaenger', jsonb_build_array('ich@eigen-a.test', 'ich@eigen-b.test', 'warm@aufwaerm-test.test', 'keine-adresse'),
    'betreff', 'Kurzer Test', 'text', 'Ein realistischer Text für den Platzierungstest.'))
   where key = 'email';

  -- 1. Wochenende/aus → nichts
  if crm.mail_aufwaermen_planen(v_samstag) <> 0 then raise exception 'FEHLER: plant am Samstag'; end if;
  update crm.settings set value = jsonb_set(value, '{aufwaermen,aktiv}', 'false') where key = 'email';
  if crm.mail_aufwaermen_planen(v_werktag) <> 0 then raise exception 'FEHLER: plant, obwohl aus'; end if;
  update crm.settings set value = jsonb_set(value, '{aufwaermen,aktiv}', 'true') where key = 'email';
  out := out || '1 Wochenende/aus ok; ';

  -- 2. Werktag: 1 Platzierungstest + 4 Testmails reihum an die eigenen Adressen, nie an sich selbst, ungültige fallen weg
  n := crm.mail_aufwaermen_planen(v_werktag);
  if n <> 5 then raise exception 'FEHLER: % statt 5 geplant', n; end if;
  if (select count(*) from crm.mail_platzierung where von_id = pf.id and status = 'geplant' and betreff = 'Kurzer Test') <> 1 then
    raise exception 'FEHLER: Platzierungstest fehlt'; end if;
  v_ziele := array(select an from crm.mail_aufwaermen where von_id = pf.id order by created_at, an);
  if (select count(*) from unnest(v_ziele) z where z = 'ich@eigen-a.test') <> 2 or (select count(*) from unnest(v_ziele) z where z = 'ich@eigen-b.test') <> 2
     or cardinality(v_ziele) <> 4 then raise exception 'FEHLER: Empfänger %', v_ziele; end if;
  if exists (select 1 from crm.mail_aufwaermen where von_id = pf.id and (betreff <> 'Testmail aus dem CRM' or tag <> v_werktag)) then
    raise exception 'FEHLER: Betreff/Tag der Testmails'; end if;
  if crm.mail_aufwaermen_planen(v_werktag) <> 0 then raise exception 'FEHLER: plant denselben Tag doppelt'; end if;
  out := out || '2 Plan ok; ';

  -- 3. Motor: erst Platzierungstest, dann (nächster Takt) Aufwärmen; Ergebnis buchen; zählt nicht für den Hochlauf
  execute 'set local role service_role';
  update crm.mail_aufwaermen set tag = crm.berlin_date(now()) where von_id = pf.id;   -- Auftrag gilt nur am geplanten Tag
  jobs := crm.mail_motor_auftraege(50);
  select j into job from jsonb_array_elements(jobs) j where j ->> 'postfach_id' = pf.id::text;
  if job ->> 'art' <> 'platzierung' then raise exception 'FEHLER: erster Auftrag %', job; end if;
  update crm.mail_postfaecher set naechster_versand_at = null where id = pf.id;
  jobs := crm.mail_motor_auftraege(50);
  select j into job from jsonb_array_elements(jobs) j where j ->> 'postfach_id' = pf.id::text;
  if job ->> 'art' <> 'aufwaermen' or job ->> 'betreff' <> 'Testmail aus dem CRM' or job ->> 'an' not like 'ich@eigen-%' then
    raise exception 'FEHLER: Aufwärm-Auftrag %', job; end if;
  v_id := (job ->> 'id')::uuid;
  if (select status from crm.mail_aufwaermen where id = v_id) <> 'in_arbeit' then raise exception 'FEHLER: nicht in Arbeit'; end if;
  perform crm.mail_motor_ergebnis('aufwaermen', v_id, true);
  if (select status from crm.mail_aufwaermen where id = v_id) <> 'gesendet' then raise exception 'FEHLER: nicht als gesendet gebucht'; end if;
  if (select hochlauf_start from crm.mail_postfaecher where id = pf.id) is not null then raise exception 'FEHLER: Aufwärmen startet den Hochlauf'; end if;
  out := out || '3 Motor/Ergebnis ok; ';

  -- 4. Anmeldefehler setzt das Postfach auf Fehler; verfallene Planung vom Vortag wird aufgeräumt
  update crm.mail_postfaecher set naechster_versand_at = null where id = pf.id;
  jobs := crm.mail_motor_auftraege(50);
  select j into job from jsonb_array_elements(jobs) j where j ->> 'postfach_id' = pf.id::text;
  perform crm.mail_motor_ergebnis('aufwaermen', (job ->> 'id')::uuid, false, 'anmeldung', '535 5.7.8 Username and Password not accepted');
  if (select status from crm.mail_postfaecher where id = pf.id) <> 'fehler' then raise exception 'FEHLER: Anmeldefehler ohne Folgen'; end if;
  if (select status from crm.mail_aufwaermen where id = (job ->> 'id')::uuid) <> 'fehler' then raise exception 'FEHLER: Fehlversand nicht gebucht'; end if;
  update crm.mail_aufwaermen set tag = crm.berlin_date(now()) - 1 where von_id = pf.id and status = 'geplant';
  perform crm.mail_motor_auftraege(1);
  if exists (select 1 from crm.mail_aufwaermen where von_id = pf.id and status = 'geplant') then raise exception 'FEHLER: Vortag nicht verfallen'; end if;
  out := out || '4 Fehler/Verfallen ok; ';

  -- 5. Bremse: Postfach in Pause bekommt keinen Plan
  execute 'reset role';
  update crm.mail_postfaecher set status = 'bereit' where id = pf.id;
  delete from crm.mail_aufwaermen where von_id = pf.id;
  delete from crm.mail_platzierung where von_id = pf.id;
  insert into crm.leads (salutation, first_name, last_name, company_name, email, email_consent_basis, email_consent_at, owner_id)
  values ('herr', 'Paul', 'Prellbock', 'Prellbock GmbH', 'paul@prellbock.test', 'meeting_held', crm.berlin_date(now()), v_me) returning id into v_id;
  insert into crm.emails (lead_id, direction, channel, to_address, subject, status, postfach_id, sent_at, bounce_reason)
  select v_id, 'out', 'smtp', 'paul@prellbock.test', 'x', 'sent', pf.id, now(), 'Abgelehnt: 550 spam' from generate_series(1, 3);
  if crm.mail_hochlauf(pf.id) ->> 'stufe' <> 'pause' then raise exception 'FEHLER: Testaufbau – keine Pause (%)', crm.mail_hochlauf(pf.id); end if;
  if crm.mail_aufwaermen_planen(v_werktag) <> 0 then raise exception 'FEHLER: plant trotz Pause'; end if;
  out := out || '5 Pause ok; ';

  -- 6. Rechte: Mitglieder lesen, planen nicht
  perform set_config('request.jwt.claims', json_build_object('sub', v_me, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform count(*) from crm.mail_aufwaermen;
  begin
    perform crm.mail_aufwaermen_planen(v_werktag);
    raise exception 'FEHLER: Mitglied darf planen';
  exception when insufficient_privilege then null;
  end;
  out := out || '6 Rechte ok; ';

  raise exception 'TESTERGEBNIS: %', out;
end
$$;
