-- Integrationstest Reiter „Ziele“ (Migration 32) gegen die echte Datenbank – eine Transaktion, am Ende per Exception
-- zurückgerollt (es bleibt nichts zurück). Nur erfundene Inhalte.
-- Aufruf: bash tools/db-query.sh -f supabase/tests/okr_test.sql
-- Ergebnis steht in der Fehlermeldung „TESTERGEBNIS: …“ (oder „FEHLER: …“ bei einer verletzten Annahme).
do $$
declare
  v_me uuid := (select id from crm.members where display_name = 'Vincent' limit 1);
  v_mike uuid := (select id from crm.members where display_name = 'Mike' limit 1);
  v_heute date := crm.today();
  v_ziel uuid; v_kr uuid; v_kr2 uuid; v_todo uuid; n int; x numeric;
  out text := '';
begin
  perform set_config('request.jwt.claims', json_build_object('sub', v_me, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  -- 1. Ziel, Key Results und To-do anlegen
  insert into crm.okr_ziele (titel, ebene, von, bis) values ('Probeziel Vertrieb', 'monat', date '2031-03-01', date '2031-03-31') returning id into v_ziel;
  insert into crm.okr_ergebnisse (ziel_id, titel, zielwert, takt, je_person, quelle)
  values (v_ziel, 'Probe-Beiträge', 4, 'zeitraum', true, 'manuell') returning id into v_kr;
  insert into crm.okr_ergebnisse (ziel_id, titel, zielwert, takt, je_person, quelle)
  values (v_ziel, 'Probe-Nachrichten', 20, 'tag', true, 'angeschrieben') returning id into v_kr2;
  insert into crm.okr_todos (ergebnis_id, text, member_id) values (v_kr, 'Probe-Aufgabe erledigen', v_mike) returning id into v_todo;
  if (select created_by from crm.okr_ziele where id = v_ziel) <> v_me then raise exception 'FEHLER 1: created_by fehlt'; end if;
  out := out || '1 Anlegen ok; ';

  -- 2. Eingaben prüfen
  begin
    insert into crm.okr_ziele (titel, ebene, von, bis) values (' ', 'monat', date '2031-03-01', date '2031-03-31');
    raise exception 'FEHLER 2: leerer Titel angenommen';
  exception when check_violation then null;
  end;
  begin
    insert into crm.okr_ziele (titel, ebene, von, bis) values ('Probe', 'woche', date '2031-03-01', date '2031-03-31');
    raise exception 'FEHLER 2: unbekannte Ebene angenommen';
  exception when check_violation then null;
  end;
  begin
    insert into crm.okr_ziele (titel, ebene, von, bis) values ('Probe', 'monat', date '2031-03-31', date '2031-03-01');
    raise exception 'FEHLER 2: Ende vor Anfang angenommen';
  exception when check_violation then null;
  end;
  begin
    insert into crm.okr_ergebnisse (ziel_id, titel, zielwert) values (v_ziel, 'Probe', 0);
    raise exception 'FEHLER 2: Zielwert 0 angenommen';
  exception when check_violation then null;
  end;
  begin
    insert into crm.okr_ergebnisse (ziel_id, titel, zielwert, quelle) values (v_ziel, 'Probe', 5, 'irgendwas');
    raise exception 'FEHLER 2: unbekannte Quelle angenommen';
  exception when check_violation then null;
  end;
  out := out || '2 Eingaben ok; ';

  -- 3. Von Hand zählen: +1 bucht auf heute, mehrere Klicks addieren sich, je Person getrennt
  x := crm.okr_zaehlen(v_kr);
  x := crm.okr_zaehlen(v_kr, null, 2);
  if x <> 3 then raise exception 'FEHLER 3: Summe % statt 3', x; end if;
  select count(*) into n from crm.okr_eintraege where ergebnis_id = v_kr and member_id = v_me and tag = v_heute and wert = 3;
  if n <> 1 then raise exception 'FEHLER 3: Eintrag von heute fehlt'; end if;
  x := crm.okr_zaehlen(v_kr, v_mike, 1);
  if x <> 1 or (select sum(wert) from crm.okr_eintraege where ergebnis_id = v_kr) <> 4 then raise exception 'FEHLER 3: Personen nicht getrennt'; end if;
  out := out || '3 Zählen ok; ';

  -- 4. −1 nimmt vom jüngsten Eintrag weg, auch über Tage hinweg; unter 0 geht es nicht
  insert into crm.okr_eintraege (ergebnis_id, member_id, tag, wert) values (v_kr, v_me, v_heute - 2, 1);
  x := crm.okr_zaehlen(v_kr, null, -1);
  if x <> 3 or (select wert from crm.okr_eintraege where ergebnis_id = v_kr and member_id = v_me and tag = v_heute) <> 2 then
    raise exception 'FEHLER 4: −1 trifft nicht den jüngsten Eintrag (%)', x; end if;
  x := crm.okr_zaehlen(v_kr, null, -3);
  if x <> 0 or exists (select 1 from crm.okr_eintraege where ergebnis_id = v_kr and member_id = v_me) then
    raise exception 'FEHLER 4: nach −3 bleibt % übrig', x; end if;
  x := crm.okr_zaehlen(v_kr, null, -1);
  if x <> 0 then raise exception 'FEHLER 4: unter 0 gezählt (%)', x; end if;
  begin
    x := crm.okr_zaehlen(gen_random_uuid());
    raise exception 'FEHLER 4: unbekanntes Key Result gezählt';
  exception when raise_exception then null;
  end;
  out := out || '4 Zurücknehmen ok; ';

  -- 5. To-do abhaken
  update crm.okr_todos set erledigt_at = now() where id = v_todo;
  if (select erledigt_at from crm.okr_todos where id = v_todo) is null then raise exception 'FEHLER 5: nicht abgehakt'; end if;
  out := out || '5 To-do ok; ';

  -- 6. Monat übernehmen: Ziele und Key Results, ohne Fortschritt und To-dos; nicht doppelt
  x := crm.okr_zaehlen(v_kr, null, 2);
  n := crm.okr_monat_uebernehmen(date '2031-03-15', date '2031-04-10');
  if n <> 1 then raise exception 'FEHLER 6: % Ziele kopiert', n; end if;
  select count(*) into n from crm.okr_ergebnisse e join crm.okr_ziele z on z.id = e.ziel_id
   where z.ebene = 'monat' and z.von = date '2031-04-01' and z.bis = date '2031-04-30' and z.titel = 'Probeziel Vertrieb';
  if n <> 2 then raise exception 'FEHLER 6: % Key Results im neuen Monat', n; end if;
  select count(*) into n from crm.okr_eintraege t join crm.okr_ergebnisse e on e.id = t.ergebnis_id join crm.okr_ziele z on z.id = e.ziel_id
   where z.von = date '2031-04-01';
  if n <> 0 then raise exception 'FEHLER 6: Fortschritt mitkopiert'; end if;
  select count(*) into n from crm.okr_todos t join crm.okr_ergebnisse e on e.id = t.ergebnis_id join crm.okr_ziele z on z.id = e.ziel_id
   where z.von = date '2031-04-01';
  if n <> 0 then raise exception 'FEHLER 6: To-dos mitkopiert'; end if;
  begin
    n := crm.okr_monat_uebernehmen(date '2031-03-01', date '2031-04-01');
    raise exception 'FEHLER 6: zweimal übernommen';
  exception when raise_exception then null;
  end;
  out := out || '6 Monat übernehmen ok; ';

  -- 7. Löschen räumt auf: Key Results, Einträge und To-dos gehen mit dem Ziel
  delete from crm.okr_ziele where id = v_ziel;
  if exists (select 1 from crm.okr_ergebnisse where id in (v_kr, v_kr2)) or exists (select 1 from crm.okr_eintraege where ergebnis_id = v_kr)
     or exists (select 1 from crm.okr_todos where id = v_todo) then
    raise exception 'FEHLER 7: Reste nach dem Löschen';
  end if;
  out := out || '7 Löschen ok; ';

  -- 8. Rechte: ohne Anmeldung nichts
  execute 'reset role';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  begin
    perform 1 from crm.okr_ziele limit 1;
    raise exception 'FEHLER 8: ohne Anmeldung gelesen';
  exception when insufficient_privilege then null;
  end;
  begin
    x := crm.okr_zaehlen(gen_random_uuid());
    raise exception 'FEHLER 8: ohne Anmeldung gezählt';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
  out := out || '8 Rechte ok; ';

  raise exception 'TESTERGEBNIS: %', out;
end
$$;
