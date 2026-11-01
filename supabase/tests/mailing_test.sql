-- Integrationstest Mailing (Migration 21) gegen die echte Datenbank – läuft vollständig in EINER Transaktion, die am Ende per
-- Exception zurückgerollt wird (es bleibt nichts zurück, auch keine Vault-Geheimnisse). Nur erfundene Namen und Adressen.
-- Aufruf: bash tools/db-query.sh -f supabase/tests/mailing_test.sql
-- Ergebnis steht in der Fehlermeldung „TESTERGEBNIS: …“ (oder „FEHLER: …“ bei einer verletzten Annahme).
do $$
declare
  v_me uuid := (select id from crm.members where display_name = 'Vincent' limit 1);
  pf crm.mail_postfaecher; saat crm.mail_postfaecher;
  v_k uuid; v_a uuid; v_b uuid; v_c uuid; v_d uuid;
  ra crm.mail_empfaenger; rb crm.mail_empfaenger; rc crm.mail_empfaenger; rd crm.mail_empfaenger;
  jobs jsonb; job jsonb; h jsonb; akt jsonb; e crm.emails; l crm.leads; v_test uuid; v_ids text[]; v_ein uuid; n int;
  out text := ''; fehler text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', v_me, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  -- 0. Testdaten: drei Leads mit Erlaubnis (zwei bei derselben Firma), einer ohne
  insert into crm.leads (salutation, first_name, last_name, company_name, email, email_consent_basis, email_consent_at, owner_id)
  values ('herr', 'Lukas', 'Feldhaus', 'Feldhaus Solar GmbH', 'lukas@feldhaus-solar.test', 'requested_phone', crm.berlin_date(now()), v_me)
  returning id into v_a;
  insert into crm.leads (salutation, first_name, last_name, company_name, email, owner_id)
  values ('frau', 'Jana', 'Ohnegrund', 'Kalt GmbH', 'jana@kalt-gmbh.test', v_me) returning id into v_b;
  insert into crm.leads (salutation, first_name, last_name, company_name, email, email_consent_basis, email_consent_at, owner_id)
  values ('herr', 'Jonas', 'Bergfeld', 'Feldhaus Solar GmbH', 'jonas@feldhaus-solar.test', 'requested_linkedin', crm.berlin_date(now()), v_me)
  returning id into v_c;
  insert into crm.leads (salutation, first_name, last_name, company_name, email, email_consent_basis, email_consent_at, owner_id)
  values ('frau', 'Mia', 'Unzustellbar', 'Weg AG', 'mia@weg-ag.test', 'meeting_held', crm.berlin_date(now()), v_me)
  returning id into v_d;

  -- 1. Postfach (Passwort in den Vault) + Domain + Verbindungstest → bereit
  pf := crm.mail_postfach_speichern(jsonb_build_object('adresse', 'Vincent@Versand-Test.test', 'absender_name', 'Vincent Testnutzer',
          'anbieter', 'google', 'smtp_host', 'smtp.gmail.com', 'smtp_port', 465, 'smtp_sicherheit', 'ssl', 'imap_host', 'imap.gmail.com',
          'signatur', E'Vincent Testnutzer\nTestfirma'), 'abcd efgh ijkl mnop');
  if pf.adresse <> 'vincent@versand-test.test' or pf.geheimnis_id is null or pf.status <> 'neu' then raise exception 'FEHLER: Postfach %', row_to_json(pf); end if;
  begin
    perform 1 from vault.decrypted_secrets;
    raise exception 'FEHLER: Mitglied kann den Vault lesen';
  exception when insufficient_privilege then null;
  end;
  insert into crm.mail_domains (domain, dns, registriert_am) values ('versand-test.test', '{"ok": true}', crm.berlin_date(now()) - 90);
  execute 'set local role service_role';
  if (crm.mail_motor_zugang(pf.id) ->> 'passwort') <> 'abcd efgh ijkl mnop' then raise exception 'FEHLER: Zugang liefert Passwort nicht'; end if;
  pf := crm.mail_motor_test_ergebnis(pf.id, '{"ok": true}');
  if pf.status <> 'bereit' then raise exception 'FEHLER: Test ok, aber Status %', pf.status; end if;
  h := crm.mail_hochlauf(pf.id);
  if h ->> 'stufe' <> 'stufe_1' or (h ->> 'limit')::int <> 10 then raise exception 'FEHLER: Hochlauf %', h; end if;
  out := out || '1 Postfach/Vault/Hochlauf ok; ';

  -- 2. Kampagne speichern (2 Schritte, A/B), Empfänger, MX, starten
  execute 'set local role authenticated';
  v_k := crm.mail_kampagne_speichern(jsonb_build_object(
    'name', 'Test Nachfassen', 'zeitplan', '{"tage":[1,2,3,4,5,6,7],"von":"00:00","bis":"23:59"}'::jsonb, 'postfaecher', jsonb_build_array(pf.id),
    'schritte', jsonb_build_array(
      jsonb_build_object('wartetage', 0, 'varianten', jsonb_build_array(
        jsonb_build_object('kennung', 'A', 'betreff', 'Unterlagen für [Unternehmen]', 'text', E'[Briefanrede],\n\nwie besprochen die Unterlagen.\n\nViele Grüße\n[Absender Vorname]'),
        jsonb_build_object('kennung', 'B', 'betreff', 'Wie besprochen, [Vorname]', 'text', E'Hallo [Vorname],\n\nhier die Unterlagen.\n\n[Absender]'))),
      jsonb_build_object('wartetage', 3, 'varianten', jsonb_build_array(
        jsonb_build_object('kennung', 'A', 'betreff', '', 'text', E'[Briefanrede],\n\nkurze Rückfrage zu meiner Mail.'))))));
  h := crm.mail_empfaenger_hinzufuegen(v_k, array[v_a, v_b, v_c, v_d]);
  if (h ->> 'neu')::int <> 4 or (h ->> 'gesperrt')::int <> 1 then raise exception 'FEHLER: Empfänger hinzufügen %', h; end if;
  select count(*) into n from crm.mail_kampagne_pruefen(v_k);
  if n <> 1 then raise exception 'FEHLER: Prüfen meldet % gesperrte statt 1', n; end if;
  perform crm.mail_kampagne_status(v_k, 'aktiv');
  execute 'set local role service_role';
  perform crm.mail_motor_mx_setzen('[{"domain":"feldhaus-solar.test","klasse":"ionos","hosts":["mx00.ionos.de"]},
                                    {"domain":"kalt-gmbh.test","klasse":"google","hosts":["smtp.google.com"]},
                                    {"domain":"weg-ag.test","klasse":"tonline","hosts":["mx00.t-online.de"]}]');
  out := out || '2 Kampagne/Empfänger/Prüfen ok; ';

  -- 3. Erster Auftrag: Lead A, Text gefüllt, Fuß, List-Unsubscribe, Entwurf in crm.emails
  jobs := crm.mail_motor_auftraege(8);
  if jsonb_array_length(jobs) <> 1 then raise exception 'FEHLER: erwartet 1 Auftrag, bekommen %', jobs; end if;
  job := jobs -> 0;
  if job ->> 'art' <> 'kampagne' or job ->> 'an' <> 'lukas@feldhaus-solar.test' then raise exception 'FEHLER: Auftrag %', job; end if;
  if job ->> 'betreff' not in ('Unterlagen für Feldhaus Solar GmbH', 'Wie besprochen, Lukas')
     or position('Wenn Sie keine weiteren E-Mails' in job ->> 'text') = 0 or position('Hinweise zum Datenschutz' in job ->> 'text') = 0
     or position('Vincent Testnutzer' in job ->> 'text') = 0 or position('[' in job ->> 'text') > 0 then
    raise exception 'FEHLER: Text/Betreff %', job;
  end if;
  if (job -> 'kopf' ->> 'List-Unsubscribe') not like '<https://%abmelden?t=%>, <mailto:vincent@versand-test.test?subject=Abmelden>' then
    raise exception 'FEHLER: List-Unsubscribe %', job -> 'kopf';
  end if;
  select * into ra from crm.mail_empfaenger where kampagne_id = v_k and lead_id = v_a;
  if ra.status <> 'aktiv' or ra.in_arbeit is null or ra.postfach_id <> pf.id then raise exception 'FEHLER: Empfänger A nach Auftrag %', row_to_json(ra); end if;
  -- gleicher Takt noch einmal: Postfach wartet (Abstand) → nichts
  if jsonb_array_length(crm.mail_motor_auftraege(8)) <> 0 then raise exception 'FEHLER: Abstand nicht eingehalten'; end if;
  out := out || '3 Auftrag/Platzhalter/Fuß/Kopf/Abstand ok; ';

  -- 4. Ergebnis ok → gesendet, Schritt 2 geplant, Hochlauf-Start, Aktivität
  perform crm.mail_motor_ergebnis('kampagne', (job ->> 'id')::uuid, true);
  select * into e from crm.emails where id = (job ->> 'id')::uuid;
  select * into ra from crm.mail_empfaenger where id = ra.id;
  if e.status <> 'sent' or e.channel <> 'smtp' or e.consent_basis_snapshot <> 'requested_phone' then raise exception 'FEHLER: Mail nach Versand %', row_to_json(e); end if;
  if ra.schritt <> 1 or ra.status <> 'aktiv' or ra.naechster_versand_at <= now() or ra.letzte_message_id <> e.message_id_header then
    raise exception 'FEHLER: Empfänger A nach Versand %', row_to_json(ra);
  end if;
  if not exists (select 1 from crm.activities a where a.email_id = e.id and a.type = 'email_gesendet') then raise exception 'FEHLER: keine Aktivität'; end if;
  if (select hochlauf_start from crm.mail_postfaecher where id = pf.id) is null then raise exception 'FEHLER: Hochlauf-Start fehlt'; end if;
  out := out || '4 Versand gebucht/Folgeschritt/Chronik ok; ';

  -- 5. Nächster Takt: B ohne Erlaubnis wird gestoppt, C (gleiche Firma wie A, A läuft) wartet → D bekommt die Mail
  update crm.mail_postfaecher set naechster_versand_at = now() - interval '1 second' where id = pf.id;
  jobs := crm.mail_motor_auftraege(8);
  select * into rb from crm.mail_empfaenger where kampagne_id = v_k and lead_id = v_b;
  select * into rc from crm.mail_empfaenger where kampagne_id = v_k and lead_id = v_c;
  if rb.status <> 'gestoppt' or rb.stopp_grund <> 'Keine Erlaubnis-Grundlage' then raise exception 'FEHLER: B %', row_to_json(rb); end if;
  if rc.status <> 'wartet' then raise exception 'FEHLER: C sollte warten (eine Sequenz je Firma) %', row_to_json(rc); end if;
  if jsonb_array_length(jobs) <> 1 or jobs -> 0 ->> 'an' <> 'mia@weg-ag.test' then raise exception 'FEHLER: erwartet D, bekommen %', jobs; end if;
  perform crm.mail_motor_ergebnis('kampagne', (jobs -> 0 ->> 'id')::uuid, true);
  out := out || '5 Gate (ohne Erlaubnis gestoppt)/eine Sequenz je Firma ok; ';

  -- 6. Antwort von A im Spam → Eingang, beantwortet, Firma gestoppt, „retten“
  akt := crm.mail_motor_eingang(pf.id, jsonb_build_array(jsonb_build_object(
    'ordner', 'spam', 'uid', 5, 'message_id', '<antwort-1@feldhaus-solar.test>', 'bezug', jsonb_build_array(e.message_id_header),
    'von', 'lukas@feldhaus-solar.test', 'von_name', 'Lukas Feldhaus', 'betreff', 'Re: Unterlagen', 'datum', now(),
    'einordnung', jsonb_build_object('art', 'antwort', 'hinweis', 'interessiert', 'neuerText', 'Gerne, rufen Sie mich an.',
                                     'bezug', jsonb_build_array(e.message_id_header)))),
    '{"posteingang":{"pfad":"INBOX","validity":"1","uid":4}}');
  if akt -> 0 ->> 'aktion' <> 'retten' then raise exception 'FEHLER: Spam-Antwort nicht gerettet %', akt; end if;
  select * into ra from crm.mail_empfaenger where id = ra.id;
  select * into rc from crm.mail_empfaenger where id = rc.id;
  if ra.status <> 'beantwortet' then raise exception 'FEHLER: A nicht beantwortet %', row_to_json(ra); end if;
  if rc.status <> 'gestoppt' or rc.stopp_grund <> 'Jemand aus der Firma hat geantwortet' then raise exception 'FEHLER: Firma nicht gestoppt %', row_to_json(rc); end if;
  select * into e from crm.emails where id = e.id;
  if e.status <> 'replied' then raise exception 'FEHLER: Original nicht replied %', e.status; end if;
  select id into v_ein from crm.emails where direction = 'in' and message_id_header = '<antwort-1@feldhaus-solar.test>';
  if v_ein is null then raise exception 'FEHLER: Eingang fehlt'; end if;
  select * into l from crm.leads where id = v_a;
  if l.stage <> 'dm_beantwortet' or l.inbound_unanswered_since is null then raise exception 'FEHLER: Lead nach Antwort % %', l.stage, l.inbound_unanswered_since; end if;
  -- doppelt eingelesen → nichts Neues
  perform crm.mail_motor_eingang(pf.id, jsonb_build_array(jsonb_build_object('ordner', 'posteingang', 'uid', 6,
    'message_id', '<antwort-1@feldhaus-solar.test>', 'bezug', jsonb_build_array(e.message_id_header), 'von', 'lukas@feldhaus-solar.test',
    'betreff', 'Re: Unterlagen', 'einordnung', jsonb_build_object('art', 'antwort', 'neuerText', 'x', 'bezug', '[]'::jsonb))), null);
  select count(*) into n from crm.emails where message_id_header = '<antwort-1@feldhaus-solar.test>';
  if n <> 1 then raise exception 'FEHLER: Antwort doppelt gebucht (%)', n; end if;
  out := out || '6 Antwort aus Spam/Stopp Firma/Lead-Stufe/keine Doppelbuchung ok; ';

  -- 7. Unzustellbar-Meldung zu D → bounced, Sperrliste, Empfänger bounce
  select * into rd from crm.mail_empfaenger where kampagne_id = v_k and lead_id = v_d;
  perform crm.mail_motor_eingang(pf.id, jsonb_build_array(jsonb_build_object('ordner', 'posteingang', 'uid', 7,
    'message_id', '<bounce-1@mx.test>', 'bezug', jsonb_build_array(rd.letzte_message_id), 'von', 'mailer-daemon@googlemail.com',
    'betreff', 'Delivery Status Notification (Failure)', 'einordnung', jsonb_build_object('art', 'unzustellbar', 'hart', true,
    'grund', 'adresse_ungueltig', 'empfaenger', 'mia@weg-ag.test', 'status', '5.1.1', 'meldung', 'user unknown',
    'bezug', jsonb_build_array(rd.letzte_message_id)))), null);
  select * into rd from crm.mail_empfaenger where id = rd.id;
  if rd.status <> 'bounce' then raise exception 'FEHLER: D nicht bounce %', row_to_json(rd); end if;
  if not exists (select 1 from crm.sperrliste where email = 'mia@weg-ag.test' and reason = 'bounce') then raise exception 'FEHLER: Bounce nicht auf Sperrliste'; end if;
  out := out || '7 Bounce/Sperrliste ok; ';

  -- 8. Abmelde-Token (anonym) → Sperrliste + abgemeldet
  execute 'set local role anon';
  if not crm.mail_abmelden(rc.abmelde_token) then raise exception 'FEHLER: Abmelden per Token'; end if;
  execute 'set local role service_role';
  if not exists (select 1 from crm.sperrliste where email = 'jonas@feldhaus-solar.test' and reason = 'abmeldung') then raise exception 'FEHLER: Abmeldung fehlt'; end if;
  out := out || '8 Abmelden per Token ok; ';

  -- 9. Unibox-Antwort: sofort, ohne Abstand, Gate-Buchung über den Motor
  execute 'set local role authenticated';
  perform crm.mail_antworten(v_ein, 'Danke, ich rufe Sie morgen um 10 an.');
  execute 'set local role service_role';
  jobs := crm.mail_motor_auftraege(8);
  if jsonb_array_length(jobs) <> 1 or jobs -> 0 ->> 'art' <> 'einzeln' or jobs -> 0 ->> 'betreff' <> 'Re: Re: Unterlagen' and jobs -> 0 ->> 'betreff' <> 'Re: Unterlagen' then
    raise exception 'FEHLER: Einzelmail %', jobs;
  end if;
  if position('Vincent Testnutzer' in jobs -> 0 ->> 'text') = 0 or jobs -> 0 ->> 'in_reply_to' <> '<antwort-1@feldhaus-solar.test>' then
    raise exception 'FEHLER: Einzelmail Signatur/Verlauf %', jobs -> 0;
  end if;
  perform crm.mail_motor_ergebnis('einzeln', (jobs -> 0 ->> 'id')::uuid, true);
  if (select status from crm.emails where id = (jobs -> 0 ->> 'id')::uuid) <> 'sent' then raise exception 'FEHLER: Einzelmail nicht gesendet'; end if;
  out := out || '9 Unibox-Antwort ok; ';

  -- 10. Platzierungstest: Prüf-Postfach, Versand, passives Finden
  execute 'set local role authenticated';
  saat := crm.mail_postfach_speichern(jsonb_build_object('adresse', 'pruef@gmx-test.test', 'absender_name', 'Prüf GMX', 'anbieter', 'gmx',
            'rolle', 'saat', 'imap_host', 'imap.gmx.net'), 'geheim1234');
  execute 'set local role service_role';
  perform crm.mail_motor_test_ergebnis(saat.id, '{"ok": true}');
  execute 'set local role authenticated';
  v_test := crm.mail_platzierung_starten(pf.id, 'Kurze Frage', 'Hallo, das ist ein Platzierungstest.');
  execute 'set local role service_role';
  update crm.mail_postfaecher set naechster_versand_at = now() - interval '1 second' where id = pf.id;
  jobs := crm.mail_motor_auftraege(8);
  if jsonb_array_length(jobs) <> 1 or jobs -> 0 ->> 'art' <> 'platzierung' or jobs -> 0 ->> 'an' <> 'pruef@gmx-test.test' then
    raise exception 'FEHLER: Platzierungsauftrag %', jobs;
  end if;
  perform crm.mail_motor_ergebnis('platzierung', (jobs -> 0 ->> 'id')::uuid, true);
  v_ids := crm.mail_motor_platzierung_offen(saat.id);
  if cardinality(v_ids) <> 1 then raise exception 'FEHLER: offene Platzierung %', v_ids; end if;
  perform crm.mail_motor_platzierung_melden(saat.id, jsonb_build_array(jsonb_build_object('message_id', v_ids[1], 'ordner', 'spam')));
  if (select spam from crm.v_mail_tests where test = v_test) <> 1 then raise exception 'FEHLER: Testergebnis fehlt'; end if;
  out := out || '10 Platzierungstest ok; ';

  -- 11. Hochlauf schont bei Ablehnung; Fehlerarten; normales Gate der emails-Tabelle bleibt
  update crm.emails set bounce_reason = 'Abgelehnt: 5.7.1 spam' where id = e.id;
  h := crm.mail_hochlauf(pf.id);
  if h ->> 'stufe' <> 'schonung' or (h ->> 'limit')::int > 10 then raise exception 'FEHLER: Schonung %', h; end if;
  perform crm.mail_motor_ergebnis('platzierung', (jobs -> 0 ->> 'id')::uuid, false, 'drossel', '421 4.7.28 try later');
  if (select gesperrt_bis from crm.mail_postfaecher where id = pf.id) < now() + interval '50 minutes' then raise exception 'FEHLER: Drossel-Pause fehlt'; end if;
  begin
    insert into crm.emails (lead_id, direction, channel, to_address, subject, status) values (v_b, 'out', 'manual', 'jana@kalt-gmbh.test', 'x', 'sent');
    raise exception 'FEHLER: Gate ließ Mail ohne Erlaubnis durch';
  exception when raise_exception then
    get stacked diagnostics fehler = message_text;
    if fehler not like 'Keine Erlaubnis-Grundlage%' then raise exception 'FEHLER: falscher Gate-Fehler %', fehler; end if;
  end;
  out := out || '11 Schonung/Drossel/Gate ok; ';

  raise exception 'TESTERGEBNIS: %', out;
end
$$;
