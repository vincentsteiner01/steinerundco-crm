-- Integrationstest Board (Migrationen 28 und 33) gegen die echte Datenbank – eine Transaktion, am Ende per Exception zurückgerollt
-- (es bleibt nichts zurück). Nur erfundene Namen und Adressen.
-- Aufruf: bash tools/db-query.sh -f supabase/tests/board_test.sql
-- Ergebnis steht in der Fehlermeldung „TESTERGEBNIS: …“ (oder „FEHLER: …“ bei einer verletzten Annahme).
do $$
declare
  v_me uuid := (select id from crm.members where display_name = 'Vincent' limit 1);
  v_mike uuid := (select id from crm.members where display_name = 'Mike' limit 1);
  r jsonb; l crm.leads; v_id uuid; v_alt uuid; v_lf uuid; v_seit timestamptz; n int; fehler text;
  out text := '';
begin
  perform set_config('request.jwt.claims', json_build_object('sub', v_me, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  -- 1. Neue Karte: landet in „Angeschrieben“, Zeitstempel gesetzt, Zugehörigkeit = ich
  r := crm.board_karte_anlegen('  Petra ', 'Probelauf', 'https://www.linkedin.com/in/petra-probelauf-board-test/?utm=x');
  if r ->> 'status' <> 'neu' or r ->> 'liste' <> 'angeschrieben' then raise exception 'FEHLER: neu %', r; end if;
  v_id := (r ->> 'lead_id')::uuid;
  select * into l from crm.leads where id = v_id;
  if l.first_name <> 'Petra' or l.owner_id <> v_me or l.created_by <> v_me or l.board_seit is null or l.stage <> 'neu'
     or l.linkedin_url_norm <> 'linkedin.com/in/petra-probelauf-board-test' then raise exception 'FEHLER: Zeile %', row_to_json(l); end if;
  -- dieselbe Person noch einmal → nichts doppelt
  r := crm.board_karte_anlegen('Petra', 'Probelauf', 'linkedin.com/in/petra-probelauf-board-test', v_mike);
  if r ->> 'status' <> 'schon_da' or (r ->> 'lead_id')::uuid <> v_id or (r ->> 'owner_id')::uuid <> v_me then raise exception 'FEHLER: schon_da %', r; end if;
  -- ohne Link geht es auch; Zugehörigkeit wählbar; Anrede wird übernommen
  r := crm.board_karte_anlegen('Otto', 'Ohnelink', null, v_mike, 'herr');
  select * into l from crm.leads where id = (r ->> 'lead_id')::uuid;
  if r ->> 'status' <> 'neu' or l.owner_id <> v_mike or l.salutation <> 'herr' or l.linkedin_url is not null then raise exception 'FEHLER: ohne Link %', row_to_json(l); end if;
  out := out || '1 Anlegen ok; ';

  -- 2. Eingaben prüfen
  begin
    perform crm.board_karte_anlegen(' ', null, null);
    raise exception 'FEHLER: ohne Namen angelegt';
  exception when raise_exception then
    get stacked diagnostics fehler = message_text;
    if fehler not like 'Bitte einen Namen%' then raise exception 'FEHLER: %', fehler; end if;
  end;
  begin
    perform crm.board_karte_anlegen('Firma', 'Seite', 'https://www.linkedin.com/company/beispiel');
    raise exception 'FEHLER: Firmenlink angenommen';
  exception when raise_exception then
    get stacked diagnostics fehler = message_text;
    if fehler not like 'Das ist kein LinkedIn-Profil-Link%' then raise exception 'FEHLER: %', fehler; end if;
  end;
  begin
    update crm.leads set board_liste = 'irgendwas' where id = v_id;
    raise exception 'FEHLER: unbekannte Liste angenommen';
  exception when check_violation then null;
  end;
  out := out || '2 Eingaben ok; ';

  -- 3. Verschieben: Zeitstempel neu; Rückgängig mit altem Zeitstempel; vom Board nehmen; stage bleibt unberührt
  select board_seit into v_seit from crm.leads where id = v_id;
  update crm.leads set board_seit = v_seit - interval '2 days' where id = v_id;
  select board_seit into v_seit from crm.leads where id = v_id;
  update crm.leads set board_liste = 'gespraech' where id = v_id returning * into l;
  if l.board_liste <> 'gespraech' or l.board_seit <= v_seit or l.stage <> 'neu' then raise exception 'FEHLER: verschieben %', row_to_json(l); end if;
  update crm.leads set board_liste = 'angeschrieben', board_seit = v_seit where id = v_id returning * into l;
  if l.board_seit <> v_seit then raise exception 'FEHLER: Rückgängig behält den Zeitstempel nicht (% statt %)', l.board_seit, v_seit; end if;
  update crm.leads set board_liste = 'verloren' where id = v_id returning * into l;
  if l.board_seit <= v_seit or l.stage <> 'neu' or l.ended_reason is not null then raise exception 'FEHLER: verloren %', row_to_json(l); end if;
  update crm.leads set board_liste = null where id = v_id returning * into l;
  if l.board_seit is not null or l.deleted_at is not null then raise exception 'FEHLER: vom Board nehmen %', row_to_json(l); end if;
  -- entfernte Karte wieder anlegen → derselbe Lead kommt zurück
  r := crm.board_karte_anlegen('Petra', 'Probelauf', 'linkedin.com/in/petra-probelauf-board-test');
  if r ->> 'status' <> 'uebernommen' or (r ->> 'lead_id')::uuid <> v_id then raise exception 'FEHLER: zurück aufs Board %', r; end if;
  out := out || '3 Verschieben ok; ';

  -- 4. Alter Lead (nicht auf dem Board) und Papierkorb: Person war schon gespeichert → kommt aufs Board, nichts doppelt
  insert into crm.leads (first_name, last_name, linkedin_url, owner_id, stage)
  values ('Alt', 'Bestand', 'https://www.linkedin.com/in/alt-bestand-board-test', v_mike, 'dm_follow_up') returning id into v_alt;
  if (select board_liste from crm.leads where id = v_alt) is not null then raise exception 'FEHLER: alter Lead steht auf dem Board'; end if;
  r := crm.board_karte_anlegen('Alt', 'Bestand', 'https://linkedin.com/in/alt-bestand-board-test/', v_me, 'frau');
  select * into l from crm.leads where id = v_alt;
  if r ->> 'status' <> 'uebernommen' or l.board_liste <> 'angeschrieben' or l.owner_id <> v_me or l.stage <> 'dm_follow_up' or l.salutation <> 'frau' then
    raise exception 'FEHLER: alter Lead % %', r, row_to_json(l); end if;
  update crm.leads set deleted_at = now(), board_liste = null where id = v_alt;
  r := crm.board_karte_anlegen('Alt', 'Bestand', 'linkedin.com/in/alt-bestand-board-test');
  select * into l from crm.leads where id = v_alt;
  if r ->> 'status' <> 'uebernommen' or l.deleted_at is not null or l.board_liste <> 'angeschrieben' then raise exception 'FEHLER: Papierkorb %', row_to_json(l); end if;
  select count(*) into n from crm.leads where linkedin_url_norm = 'linkedin.com/in/alt-bestand-board-test';
  if n <> 1 then raise exception 'FEHLER: % Zeilen statt 1', n; end if;
  out := out || '4 Bestand/Papierkorb ok; ';

  -- 5. Widerspruch und Sperrliste: keine Karte
  update crm.leads set board_liste = null where id = v_alt;
  update crm.leads set do_not_contact = true where id = v_alt;
  begin
    perform crm.board_karte_anlegen('Alt', 'Bestand', 'linkedin.com/in/alt-bestand-board-test');
    raise exception 'FEHLER: Karte trotz Widerspruch';
  exception when raise_exception then
    get stacked diagnostics fehler = message_text;
    if fehler not like '%widersprochen%' and fehler not like '%Sperrliste%' then raise exception 'FEHLER: %', fehler; end if;
  end;
  out := out || '5 Widerspruch ok; ';

  -- 6. Archiv ist da und vollständig; die alten E-Mail- und Telefon-Vorlagen sind unverändert (der E-Mail-Composer braucht
  --    seine – LinkedIn-Leitfäden dürfen die Inhaber weiter deaktivieren oder löschen, das Original liegt im Archiv)
  execute 'reset role';
  if (select count(*) from crm_archiv.leads) < 800 or (select count(*) from crm_archiv.activities) < 5000 then raise exception 'FEHLER: Archiv unvollständig'; end if;
  select count(*) into n from unnest(array['leads', 'activities', 'enrollments', 'tasks', 'templates', 'sequences', 'sequence_steps', 'emails',
                                            'meetings', 'calls', 'linkedin_connections', 'companies', 'settings', 'mail_postfaecher']) t
   where to_regclass(format('crm_archiv.%I', t)) is null;
  if n <> 0 then raise exception 'FEHLER: % Tabellen fehlen im Archiv', n; end if;
  select count(*) into n from crm.templates t join crm_archiv.templates a on a.id = t.id
   where a.channel <> 'linkedin' and (t.active is distinct from a.active or t.key <> a.key);
  if n <> 0 then raise exception 'FEHLER: % alte E-Mail-/Telefon-Vorlagen verändert', n; end if;
  select count(*) into n from crm_archiv.templates a
   where a.channel <> 'linkedin' and not exists (select 1 from crm.templates t where t.id = a.id);
  if n <> 0 then raise exception 'FEHLER: % alte E-Mail-/Telefon-Vorlagen fehlen', n; end if;
  select count(*) into n from crm.templates where channel = 'email' and active;
  if n < 10 then raise exception 'FEHLER: nur % aktive E-Mail-Vorlagen', n; end if;
  out := out || '6 Archiv ok; ';

  -- 7. Rechte: Mitglieder kommen nicht ans Archiv; ohne Anmeldung keine Karte
  perform set_config('request.jwt.claims', json_build_object('sub', v_me, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    perform 1 from crm_archiv.leads limit 1;
    raise exception 'FEHLER: Mitglied liest das Archiv';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  begin
    perform crm.board_karte_anlegen('Anna', 'Anonym', null);
    raise exception 'FEHLER: ohne Anmeldung angelegt';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
  out := out || '7 Rechte ok; ';

  -- 8. Leitfaden (Migration 33): beim Anlegen festgehalten; ein unbekannter wird abgelehnt; beim erneuten Anlegen ohne Angabe
  --    bleibt der gesetzte stehen; im Lead-Blatt lässt er sich wieder leeren
  perform set_config('request.jwt.claims', json_build_object('sub', v_me, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select id into v_lf from crm.templates where channel <> 'email' order by created_at desc limit 1;
  if v_lf is null then raise exception 'FEHLER: kein Leitfaden zum Testen'; end if;
  r := crm.board_karte_anlegen('Lena', 'Leitfaden', 'https://www.linkedin.com/in/lena-leitfaden-board-test', p_leitfaden => v_lf);
  select * into l from crm.leads where id = (r ->> 'lead_id')::uuid;
  if r ->> 'status' <> 'neu' or l.board_leitfaden_id is distinct from v_lf then raise exception 'FEHLER: Leitfaden nicht gespeichert %', row_to_json(l); end if;
  begin
    perform crm.board_karte_anlegen('Lars', 'Leitfaden', null, p_leitfaden => gen_random_uuid());
    raise exception 'FEHLER: unbekannter Leitfaden angenommen';
  exception when raise_exception then
    get stacked diagnostics fehler = message_text;
    if fehler not like 'Diesen Leitfaden gibt es nicht mehr%' then raise exception 'FEHLER: %', fehler; end if;
  end;
  update crm.leads set board_liste = null where id = l.id;
  r := crm.board_karte_anlegen('Lena', 'Leitfaden', 'linkedin.com/in/lena-leitfaden-board-test');
  if r ->> 'status' <> 'uebernommen' or (select board_leitfaden_id from crm.leads where id = l.id) is distinct from v_lf then
    raise exception 'FEHLER: Leitfaden beim erneuten Anlegen verloren'; end if;
  update crm.leads set board_leitfaden_id = null where id = l.id;
  if (select board_leitfaden_id from crm.leads where id = l.id) is not null then raise exception 'FEHLER: Leitfaden nicht geleert'; end if;
  execute 'reset role';
  out := out || '8 Leitfaden ok; ';

  raise exception 'TESTERGEBNIS: %', out;
end
$$;
