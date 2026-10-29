-- Integrationstest Recherchelauf (Migration 17) gegen die echte Datenbank – läuft vollständig in EINER Transaktion, die am Ende
-- per Exception zurückgerollt wird (es bleibt nichts zurück). Aufruf: bash tools/db-query.sh -f supabase/tests/recherche_test.sql
-- Ergebnis steht in der Fehlermeldung „TESTERGEBNIS: …“ (oder „FEHLER: …“ bei einer verletzten Annahme).
do $$
declare
  v_me uuid := (select id from crm.members where display_name = 'Vincent' limit 1);
  r crm.recherche_laeufe;
  r2 crm.recherche_laeufe;
  chk jsonb;
  url1 text := 'https://www.linkedin.com/in/claude-recherche-test-eins/';
  url2 text := 'https://de.linkedin.com/in/claude-recherche-test-zwei?trk=xyz';
  url_alt text;
  n int;
  z0 int;
  z1 int;
  l crm.leads;
  c crm.linkedin_connections;
  out text := '';
  i int;
  fehler text;
begin
  -- als angemeldetes Mitglied (RLS, auth.uid())
  perform set_config('request.jwt.claims', json_build_object('sub', v_me, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  -- 1. Start + Doppelstart
  r := crm.recherche_starten(30);
  r2 := crm.recherche_starten(30);
  if r2.id <> r.id then raise exception 'FEHLER: zweiter Start legte einen zweiten Lauf an'; end if;
  if r.status <> 'laeuft' or r.ziel <> 30 or r.batch_id is null then raise exception 'FEHLER: Startwerte %', row_to_json(r); end if;
  out := out || '1 Start/Doppelstart ok; ';

  -- 2. Prüfen: neu · ungültig · bestehende Verbindung · gleicher Name+Firma
  chk := crm.recherche_pruefen(r.id, url1, 'Testa', 'Recherchetest', 'Testfirma Solar GmbH');
  if not (chk ->> 'frei')::boolean then raise exception 'FEHLER: neues Profil nicht frei: %', chk; end if;
  chk := crm.recherche_pruefen(r.id, 'https://www.linkedin.com/company/irgendwas', null, null, null);
  if (chk ->> 'frei')::boolean or chk ->> 'art' <> 'url' then raise exception 'FEHLER: Firmen-URL nicht abgelehnt: %', chk; end if;
  select l2.linkedin_url into url_alt from crm.leads l2 join crm.linkedin_connections c2 on c2.lead_id = l2.id
   where l2.linkedin_url_norm is not null and l2.deleted_at is null limit 1;
  chk := crm.recherche_pruefen(r.id, url_alt, null, null, null);
  if (chk ->> 'frei')::boolean or chk ->> 'art' <> 'verbindung' then raise exception 'FEHLER: bestehende Verbindung nicht erkannt: %', chk; end if;
  out := out || '2 Prüfen neu/URL/Verbindung ok (' || (chk ->> 'grund') || '); ';

  -- 3. Gesendet: Lead + Verbindung + Aktivität + KPI-Zähler
  select coalesce(sum(value), 0) into z0 from crm.daily_counters
   where member_id = v_me and metric = 'vernetzungen_versendet' and date = crm.berlin_date(now());
  r := crm.recherche_eintragen(r.id, url1, 'gesendet', 'Testa', 'Recherchetest', 'Testfirma Solar GmbH',
                               'Geschäftsführer', 'A', 'PV für Privatdächer, 25 MA, eigener Kundendienst', 'CRM-Startprofil', 'https://testfirma.example');
  if r.gesendet <> 1 or r.geprueft <> 1 or r.qualifiziert <> 1 then raise exception 'FEHLER: Zähler nach gesendet %', row_to_json(r); end if;
  select * into l from crm.leads where linkedin_url_norm = crm.normalize_linkedin_url(url1);
  if l.id is null or l.source <> 'recherche' or l.role <> 'geschaeftsfuehrer' or l.stage <> 'vernetzung_gesendet'
     or l.owner_id <> v_me or l.source_batch_id <> r.batch_id or l.qualification -> 'recherche' ->> 'kategorie' <> 'A' then
    raise exception 'FEHLER: Lead falsch %', row_to_json(l);
  end if;
  select * into c from crm.linkedin_connections where lead_id = l.id;
  if c.status <> 'ausstehend' or c.note_variant <> 'ohne' or c.requested_at is null or c.member_id <> v_me then
    raise exception 'FEHLER: Verbindung falsch %', row_to_json(c);
  end if;
  select count(*) into n from crm.activities where lead_id = l.id and type = 'vernetzung_gesendet';
  select coalesce(sum(value), 0) into z1 from crm.daily_counters
   where member_id = v_me and metric = 'vernetzungen_versendet' and date = crm.berlin_date(now());
  if n <> 1 or z1 <> z0 + 1 then raise exception 'FEHLER: Aktivität % / KPI % → %', n, z0, z1; end if;
  out := out || '3 gesendet → Lead, Verbindung ausstehend, Aktivität, KPI +1 ok; ';

  -- 4. Dasselbe Profil nicht zweimal; Prüfen erkennt es im Lauf
  begin
    perform crm.recherche_eintragen(r.id, url1, 'gesendet', 'Testa', 'Recherchetest', 'Testfirma Solar GmbH', 'GF', 'A', 'x');
    raise exception 'FEHLER: doppelt eingetragen';
  exception when others then
    if sqlerrm like 'FEHLER:%' then raise; end if;
    out := out || '4 doppelt blockiert („' || sqlerrm || '“); ';
  end;
  chk := crm.recherche_pruefen(r.id, url1, null, null, null);
  if chk ->> 'art' <> 'lauf' then raise exception 'FEHLER: Lauf-Dublette nicht erkannt %', chk; end if;

  -- 5. Pflichtangaben und Grund
  begin
    perform crm.recherche_eintragen(r.id, url2, 'gesendet', 'Testb', 'Recherchetest', null, 'Projektleiter', 'B', 'x');
    raise exception 'FEHLER: gesendet ohne Firma angenommen';
  exception when others then
    if sqlerrm like 'FEHLER:%' then raise; end if;
  end;
  begin
    perform crm.recherche_eintragen(r.id, url2, 'nicht_qualifiziert');
    raise exception 'FEHLER: Absage ohne Grund angenommen';
  exception when others then
    if sqlerrm like 'FEHLER:%' then raise; end if;
  end;
  out := out || '5 Pflichtangaben erzwungen; ';

  -- 6. Kontrollpunkt nach 10 Profilen
  r := crm.recherche_eintragen(r.id, url2, 'nicht_qualifiziert', 'Testb', 'Recherchetest', 'Großhandel Test AG', 'Einkauf', null, 'Großhändler, kein Endkunde');
  for i in 3..10 loop
    r := crm.recherche_eintragen(r.id, 'https://www.linkedin.com/in/claude-recherche-test-' || i, 'unklar', null, null, null, null, null, 'Firma nicht prüfbar');
  end loop;
  if r.geprueft <> 10 or r.abgelehnt <> 1 or r.unklar <> 8 then raise exception 'FEHLER: Zähler nach 10 %', row_to_json(r); end if;
  begin
    perform crm.recherche_eintragen(r.id, 'https://www.linkedin.com/in/claude-recherche-test-11', 'unklar', null, null, null, null, null, 'x');
    raise exception 'FEHLER: Kontrollpunkt nicht erzwungen';
  exception when others then
    if sqlerrm like 'FEHLER:%' then raise; end if;
    out := out || '6 Kontrollpunkt erzwungen; ';
  end;
  r := crm.recherche_kontrolle(r.id);
  r := crm.recherche_eintragen(r.id, 'https://www.linkedin.com/in/claude-recherche-test-11', 'dublette', null, null, null, null, null, 'Schon vernetzt');
  if r.dubletten <> 1 or r.geprueft <> 11 then raise exception 'FEHLER: nach Kontrollpunkt %', row_to_json(r); end if;

  -- 7. Pause blockiert, Fortsetzen geht
  r := crm.recherche_status(r.id, 'pausiert', 'Mittagspause');
  begin
    perform crm.recherche_eintragen(r.id, 'https://www.linkedin.com/in/claude-recherche-test-12', 'unklar', null, null, null, null, null, 'x');
    raise exception 'FEHLER: Eintrag im pausierten Lauf';
  exception when others then
    if sqlerrm like 'FEHLER:%' then raise; end if;
  end;
  r := crm.recherche_status(r.id, 'laeuft');
  out := out || '7 Pause/Fortsetzen ok; ';

  -- 8. Ziel erreicht → abgeschlossen, danach nichts mehr
  update crm.recherche_laeufe set ziel = 2 where id = r.id;
  r := crm.recherche_eintragen(r.id, 'https://www.linkedin.com/in/claude-recherche-test-zwoelf', 'gesendet', 'Testc', 'Recherchetest',
                               'Zweite Solar GmbH', 'Leiter Kundenservice', 'A', 'B2C-Installateur, Kundendienst');
  if r.status <> 'abgeschlossen' or r.gesendet <> 2 or r.finished_at is null then raise exception 'FEHLER: Ziel nicht abgeschlossen %', row_to_json(r); end if;
  select * into l from crm.leads where linkedin_url_norm = crm.normalize_linkedin_url('https://www.linkedin.com/in/claude-recherche-test-zwoelf');
  if l.role <> 'kundenbetreuer' then raise exception 'FEHLER: Rolle Leiter Kundenservice → %', l.role; end if;
  begin
    perform crm.recherche_eintragen(r.id, 'https://www.linkedin.com/in/claude-recherche-test-13', 'unklar', null, null, null, null, null, 'x');
    raise exception 'FEHLER: Eintrag nach Abschluss';
  exception when others then
    if sqlerrm like 'FEHLER:%' then raise; end if;
  end;
  out := out || '8 Ziel → abgeschlossen ok; ';

  -- 9. Neuer Lauf: Dubletten über Läufe hinweg (gesendet → Verbindung; abgelehnt → frühere Absage)
  r2 := crm.recherche_starten(30);
  if r2.id = r.id then raise exception 'FEHLER: kein neuer Lauf nach Abschluss'; end if;
  chk := crm.recherche_pruefen(r2.id, url1, 'Testa', 'Recherchetest', 'Testfirma Solar GmbH');
  if chk ->> 'art' <> 'verbindung' then raise exception 'FEHLER: Anfrage aus Lauf 1 nicht erkannt %', chk; end if;
  chk := crm.recherche_pruefen(r2.id, url2, null, null, null);
  if chk ->> 'art' <> 'abgelehnt' then raise exception 'FEHLER: frühere Absage nicht erkannt %', chk; end if;
  chk := crm.recherche_pruefen(r2.id, 'https://www.linkedin.com/in/anderes-profil-gleicher-name', 'Testa', 'Recherchetest', 'Testfirma Solar GmbH');
  if chk ->> 'art' <> 'name' then raise exception 'FEHLER: Name+Firma nicht erkannt %', chk; end if;
  out := out || '9 Dubletten über Läufe (Verbindung, Absage, Name+Firma) ok; ';

  -- 10. Abbruch: bereits gebuchte Leads bleiben, Status final
  r2 := crm.recherche_eintragen(r2.id, 'https://www.linkedin.com/in/claude-recherche-test-dreizehn', 'gesendet', 'Testd', 'Recherchetest',
                                'Dritte Energie GmbH', 'Projektleiter', 'B', 'PV+Wärmepumpen für Privatkunden');
  r2 := crm.recherche_status(r2.id, 'abgebrochen', 'Test-Abbruch');
  select count(*) into n from crm.leads where source = 'recherche' and last_name = 'Recherchetest';
  if n <> 3 or r2.status <> 'abgebrochen' then raise exception 'FEHLER: nach Abbruch % Leads, Status %', n, r2.status; end if;
  begin
    perform crm.recherche_status(r2.id, 'laeuft');
    raise exception 'FEHLER: abgebrochener Lauf wieder gestartet';
  exception when others then
    if sqlerrm like 'FEHLER:%' then raise; end if;
  end;
  out := out || '10 Abbruch behält 3 Leads, Lauf bleibt beendet ok';

  raise exception 'TESTERGEBNIS: %', out;
end
$$;
