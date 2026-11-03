-- Recherche: höchstens 2 Personen je Unternehmen und 30 verschiedene Firmen als Ausgangspunkte (03.11.2026, Vincent: „der added
-- auch viele Leute vom selben Unternehmen … maximal 2 Personen pro Unternehmen, dann die wichtigsten bzw. die, die am aktivsten
-- auf LinkedIn posten“ · „Ausgangsliste … um die 30, sodass eine Varianz entsteht“).
--
-- Firmengruppe statt Firmenname: „Lichtfang AC GmbH“ und „Lichtfang Projekt GmbH“ sind für den Kunden dieselbe Firma. Die
-- Gruppe ist das erste Wort des Namens ohne Rechtsform – außer es ist ein Gattungswort („Solar- & Elektrotechnik Testmann“ bleibt
-- ganz). Dieselbe Regel steht in src/features/recherche/logik.ts (firmaGruppe) für die Freigabeliste und die Ausgangspunkte.
-- Gezählt wird CRM-weit (alle Läufe, Mike und Vincent): Kontakte der Gruppe mit einer LinkedIn-Anfrage oder Verbindung.
-- Durchgesetzt in recherche_pruefen (vor der Freigabeliste und – laut Auftrag – direkt vor jedem Klick auf „Vernetzen“);
-- recherche_eintragen bucht eine trotzdem schon gesendete Anfrage, damit das CRM zeigt, was auf LinkedIn passiert ist.

create or replace function crm.recherche_je_firma() returns int
language sql immutable set search_path = '' as $$ select 2 $$;
comment on function crm.recherche_je_firma() is 'Recherche: höchstens so viele Personen je Unternehmen (Firmengruppe) anfragen.';

create or replace function crm.firma_gruppe(p text) returns text
language sql immutable set search_path = '' as $$
  with k as (
    select btrim(regexp_replace(regexp_replace(regexp_replace(
             translate(lower(coalesce(p, '')), 'ÄÖÜÉÈÁÀ', 'äöüéèáà'),
             '&\s*co\.?(\s*(kg|ohg))?', ' ', 'g'),
             '\m(gmbh|mbh|ag|kg|ug|ohg|gbr|se|ltd|inc|haftungsbeschränkt|holding|gruppe|group)\M', ' ', 'g'),
             '[^a-z0-9äöüßéèáà]+', ' ', 'g')) as kern
  )
  select nullif(case
           when char_length(split_part(kern, ' ', 1)) >= 4
            and split_part(kern, ' ', 1) <> all (array[
              'solar', 'solare', 'solaranlagen', 'solartechnik', 'solarenergie', 'solarsysteme', 'solarservice', 'solarstrom',
              'photovoltaik', 'energie', 'energy', 'energien', 'energietechnik', 'energiesysteme', 'elektro', 'elektrotechnik',
              'elektrik', 'elektroinstallation', 'haustechnik', 'gebäudetechnik', 'gebaeudetechnik', 'sonnen', 'sonne', 'green',
              'grün', 'gruen', 'neue', 'deutsche', 'deutschland', 'german', 'dach', 'dachtechnik', 'strom', 'power', 'smart',
              'stadtwerke', 'nord', 'north', 'süd', 'sued', 'south', 'west', 'east', 'team', 'service', 'technik', 'tech', 'home',
              'haus', 'zukunft', 'future'])
           then split_part(kern, ' ', 1)
           else kern
         end, '')
    from k;
$$;
comment on function crm.firma_gruppe(text) is
  'Firmengruppe für die Grenze je Unternehmen: erstes Wort ohne Rechtsform, bei Gattungswörtern der ganze Name (gleiche Regel wie logik.ts firmaGruppe).';

create or replace function crm.recherche_firma_belegt(p_firma text, p_ohne_url_norm text default null) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('anzahl', count(*), 'namen', coalesce(jsonb_agg(x.full_name order by x.full_name), '[]'::jsonb))
    from (select l.id, l.full_name
            from crm.leads l
           where l.deleted_at is null
             and crm.firma_gruppe(l.company_name) = crm.firma_gruppe(p_firma)
             and l.linkedin_url_norm is distinct from p_ohne_url_norm
             and exists (select 1 from crm.linkedin_connections c where c.lead_id = l.id)) x;
$$;
comment on function crm.recherche_firma_belegt(text, text) is
  'Recherche: Kontakte derselben Firmengruppe mit LinkedIn-Anfrage oder -Verbindung (alle Läufe, alle Personen) – Anzahl und Namen.';

create or replace function crm.recherche_firma_grund(p_firma text, p_belegt jsonb) returns text
language sql immutable set search_path = '' as $$
  select 'Bei „' || coalesce(nullif(btrim(p_firma), ''), 'dieser Firma') || '“ sind schon ' || (p_belegt ->> 'anzahl')
         || ' Personen angefragt oder vernetzt (' || coalesce((select string_agg(n, ', ') from jsonb_array_elements_text(p_belegt -> 'namen') n), '')
         || ') – höchstens ' || crm.recherche_je_firma() || ' je Unternehmen.';
$$;

revoke all on function crm.recherche_je_firma(), crm.firma_gruppe(text), crm.recherche_firma_belegt(text, text),
  crm.recherche_firma_grund(text, jsonb) from public, anon;
grant execute on function crm.recherche_je_firma(), crm.firma_gruppe(text), crm.recherche_firma_belegt(text, text),
  crm.recherche_firma_grund(text, jsonb) to authenticated, service_role;

create or replace function crm.recherche_pruefen(
  p_lauf uuid, p_url text, p_vorname text default null, p_nachname text default null, p_firma text default null
) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  v_norm text := crm.normalize_linkedin_url(p_url);
  v_name text := lower(btrim(coalesce(p_vorname, '') || ' ' || coalesce(p_nachname, '')));
  l crm.leads;
  c crm.linkedin_connections;
  p crm.recherche_profile;
  wer text;
  belegt jsonb;
begin
  if v_norm is null then
    return jsonb_build_object('frei', false, 'art', 'url', 'grund', 'Keine gültige LinkedIn-Profil-URL (https://www.linkedin.com/in/…).');
  end if;

  select * into p from crm.recherche_profile where lauf_id = p_lauf and linkedin_url_norm = v_norm limit 1;
  if found then
    return jsonb_build_object('frei', false, 'art', 'lauf', 'grund', 'In diesem Lauf schon eingetragen (' || p.ergebnis || ').');
  end if;

  if crm.is_blocked(v_norm, null, null) then
    return jsonb_build_object('frei', false, 'art', 'sperrliste', 'grund', 'Steht auf der Sperrliste – nicht kontaktieren.');
  end if;

  select * into l from crm.leads where linkedin_url_norm = v_norm limit 1;
  if found then
    if l.deleted_at is not null then
      return jsonb_build_object('frei', false, 'art', 'crm', 'lead_id', l.id, 'grund', 'Im CRM im Papierkorb – nicht anfragen.');
    end if;
    if l.do_not_contact or exists (select 1 from crm.companies x where x.id = l.company_id and x.do_not_contact) then
      return jsonb_build_object('frei', false, 'art', 'crm', 'lead_id', l.id, 'grund', 'Im CRM als „nicht kontaktieren“ markiert.');
    end if;
    select * into c from crm.linkedin_connections where lead_id = l.id order by coalesce(requested_at, accepted_at, created_at) desc limit 1;
    if found then
      select coalesce(m.display_name, 'jemand') into wer from crm.members m where m.id = c.member_id;
      return jsonb_build_object('frei', false, 'art', 'verbindung', 'lead_id', l.id, 'grund',
        case c.status
          when 'angenommen' then 'Schon vernetzt (' || coalesce(wer, 'jemand') || ').'
          when 'ausstehend' then 'Anfrage schon offen (' || coalesce(wer, 'jemand') || ', ' || coalesce(to_char(c.requested_at at time zone 'Europe/Berlin', 'DD.MM.YYYY'), 'ohne Datum') || ').'
          else 'Schon einmal angefragt (' || c.status || ') – nicht erneut.'
        end);
    end if;
    if l.stage <> 'neu' then
      return jsonb_build_object('frei', false, 'art', 'crm', 'lead_id', l.id, 'grund', 'Schon im CRM in Bearbeitung (Stufe ' || l.stage || ').');
    end if;
    belegt := crm.recherche_firma_belegt(coalesce(nullif(btrim(p_firma), ''), l.company_name), v_norm);
    if (belegt ->> 'anzahl')::int >= crm.recherche_je_firma() then
      return jsonb_build_object('frei', false, 'art', 'firma', 'lead_id', l.id, 'firma_belegt', belegt -> 'anzahl',
        'grund', crm.recherche_firma_grund(coalesce(nullif(btrim(p_firma), ''), l.company_name), belegt));
    end if;
    return jsonb_build_object('frei', true, 'art', 'bekannt', 'lead_id', l.id, 'firma_belegt', belegt -> 'anzahl',
      'grund', 'Im CRM als neuer Lead ohne Anfrage – darf angefragt werden (der vorhandene Datensatz wird genutzt).');
  end if;

  -- gleicher Name bei gleicher Firma, aber anderes/kein LinkedIn-Profil im CRM
  if v_name <> '' then
    select * into l from crm.leads x
     where x.deleted_at is null and lower(x.full_name) = v_name
       and (p_firma is null or btrim(p_firma) = '' or crm.company_norm(x.company_name) = crm.company_norm(p_firma))
     limit 1;
    if found then
      return jsonb_build_object('frei', false, 'art', 'name', 'lead_id', l.id,
        'grund', 'Gleicher Name' || case when coalesce(btrim(p_firma), '') <> '' then ' bei gleicher Firma' else '' end
                 || ' schon im CRM (' || coalesce(l.company_name, 'ohne Firma') || ') – vermutlich dieselbe Person.');
    end if;
  end if;

  select * into p from crm.recherche_profile where linkedin_url_norm = v_norm and ergebnis = 'nicht_qualifiziert'
   order by created_at desc limit 1;
  if found then
    return jsonb_build_object('frei', false, 'art', 'abgelehnt',
      'grund', 'Am ' || to_char(p.created_at at time zone 'Europe/Berlin', 'DD.MM.YYYY') || ' als nicht qualifiziert abgelehnt: ' || coalesce(p.grund, 'ohne Grund') || '.');
  end if;

  belegt := crm.recherche_firma_belegt(p_firma, v_norm);
  if (belegt ->> 'anzahl')::int >= crm.recherche_je_firma() then
    return jsonb_build_object('frei', false, 'art', 'firma', 'firma_belegt', belegt -> 'anzahl',
      'grund', crm.recherche_firma_grund(p_firma, belegt));
  end if;
  return jsonb_build_object('frei', true, 'art', 'neu', 'firma_belegt', belegt -> 'anzahl',
    'grund', 'Neu – noch nicht im CRM, keine Anfrage bekannt.');
end;
$$;

create or replace function crm.recherche_eintragen(
  p_lauf uuid,
  p_url text,
  p_ergebnis text,
  p_vorname text default null,
  p_nachname text default null,
  p_firma text default null,
  p_position text default null,
  p_kategorie text default null,
  p_grund text default null,
  p_ausgangspunkt text default null,
  p_firma_website text default null
) returns crm.recherche_laeufe
language plpgsql set search_path = '' as $$
declare
  r crm.recherche_laeufe;
  v_me uuid;
  v_norm text := crm.normalize_linkedin_url(p_url);
  chk jsonb;
  v_lead uuid;
  v_quali jsonb;
  leer constant text := '';
begin
  select * into r from crm.recherche_laeufe where id = p_lauf for update;
  if not found then raise exception 'Recherchelauf nicht gefunden'; end if;
  v_me := coalesce(auth.uid(), r.member_id);
  if v_me <> r.member_id then raise exception 'Dieser Lauf gehört einer anderen Person'; end if;
  if r.status <> 'laeuft' then raise exception 'Der Lauf ist %, erst fortsetzen', r.status; end if;
  if v_norm is null then raise exception 'Keine gültige LinkedIn-Profil-URL (https://www.linkedin.com/in/…)'; end if;
  if p_ergebnis not in ('gesendet', 'dublette', 'nicht_qualifiziert', 'unklar', 'fehler') then
    raise exception 'Unbekanntes Ergebnis %', p_ergebnis;
  end if;
  if p_kategorie is not null and p_kategorie not in ('A', 'B', 'C', 'bedingt') then raise exception 'Kategorie A, B, C oder bedingt'; end if;
  -- Kontrollpunkt: nach je 10 geprüften Profilen erst die Kriterien bestätigen
  if r.geprueft >= (r.kontrollen + 1) * 10 then
    raise exception 'Kontrollpunkt: Nach % geprüften Profilen erst die ICP-Kriterien prüfen und bestätigen', r.geprueft;
  end if;
  if exists (select 1 from crm.recherche_profile x where x.lauf_id = p_lauf and x.linkedin_url_norm = v_norm) then
    raise exception 'Dieses Profil ist in diesem Lauf schon eingetragen';
  end if;
  if p_ergebnis in ('nicht_qualifiziert', 'unklar') and coalesce(btrim(p_grund), leer) = leer then
    raise exception 'Bitte einen Grund angeben';
  end if;

  if p_ergebnis = 'gesendet' then
    if r.gesendet >= r.ziel then raise exception 'Ziel von % Anfragen erreicht – Lauf beenden', r.ziel; end if;
    if coalesce(btrim(p_vorname), leer) = leer or coalesce(btrim(p_nachname), leer) = leer
       or coalesce(btrim(p_firma), leer) = leer or coalesce(btrim(p_position), leer) = leer
       or p_kategorie is null or coalesce(btrim(p_grund), leer) = leer then
      raise exception 'Für eine gesendete Anfrage fehlen Angaben: Vorname, Nachname, Firma, Position, Kategorie und Qualifizierungsgrund';
    end if;
    chk := crm.recherche_pruefen(p_lauf, p_url, p_vorname, p_nachname, p_firma);
    -- Firmengrenze: Der Agent prüft direkt vor dem Klick erneut. Ist die Anfrage trotzdem schon raus, wird sie gebucht –
    -- das CRM soll zeigen, was auf LinkedIn wirklich passiert ist.
    if not coalesce((chk ->> 'frei')::boolean, false) and chk ->> 'art' is distinct from 'firma' then
      raise exception 'Nicht anfragen: %', chk ->> 'grund';
    end if;

    v_quali := jsonb_build_object('recherche', jsonb_strip_nulls(jsonb_build_object(
      'kategorie', p_kategorie,
      'grund', btrim(p_grund),
      'position', btrim(p_position),
      'firma_website', nullif(btrim(coalesce(p_firma_website, leer)), leer),
      'ausgangspunkt', nullif(btrim(coalesce(p_ausgangspunkt, leer)), leer),
      'lauf_id', p_lauf,
      'am', to_char(now() at time zone 'Europe/Berlin', 'YYYY-MM-DD')
    )));
    v_lead := (chk ->> 'lead_id')::uuid;
    if v_lead is null then
      insert into crm.leads (first_name, last_name, linkedin_url, company_name, role_title, role, owner_id, source,
                             source_batch_id, url_verified, qualification, created_by)
      values (btrim(p_vorname), btrim(p_nachname), btrim(p_url), btrim(p_firma), btrim(p_position),
              crm.recherche_rolle(p_position), v_me, 'recherche', r.batch_id, true, v_quali, v_me)
      returning id into v_lead;
      update crm.import_batches set row_count = row_count + 1, inserted = inserted + 1 where id = r.batch_id;
    else
      update crm.leads
         set role_title = coalesce(role_title, btrim(p_position)),
             company_name = coalesce(company_name, btrim(p_firma)),
             role = case when role in ('unbekannt', 'sonstiges') then crm.recherche_rolle(p_position) else role end,
             owner_id = coalesce(owner_id, v_me),
             qualification = coalesce(qualification, '{}'::jsonb) || v_quali
       where id = v_lead;
      update crm.import_batches set row_count = row_count + 1, updated = updated + 1 where id = r.batch_id;
    end if;
    -- Verbindung „ausstehend“ + Aktivität + Phase + KPI-Zähler „Vernetzungen versendet“ (Trigger connections_after_write)
    perform crm.log_request(v_lead, v_me, null, 'ohne');
  end if;

  insert into crm.recherche_profile (lauf_id, member_id, linkedin_url, vorname, nachname, firma, position, kategorie,
                                     ergebnis, grund, ausgangspunkt, firma_website, lead_id)
  values (p_lauf, v_me, btrim(p_url), nullif(btrim(coalesce(p_vorname, leer)), leer), nullif(btrim(coalesce(p_nachname, leer)), leer),
          nullif(btrim(coalesce(p_firma, leer)), leer), nullif(btrim(coalesce(p_position, leer)), leer), p_kategorie, p_ergebnis,
          nullif(btrim(coalesce(p_grund, leer)), leer), nullif(btrim(coalesce(p_ausgangspunkt, leer)), leer),
          nullif(btrim(coalesce(p_firma_website, leer)), leer), v_lead);

  update crm.recherche_laeufe
     set geprueft = geprueft + 1,
         qualifiziert = qualifiziert + (p_ergebnis in ('gesendet', 'fehler'))::int,
         gesendet = gesendet + (p_ergebnis = 'gesendet')::int,
         dubletten = dubletten + (p_ergebnis = 'dublette')::int,
         abgelehnt = abgelehnt + (p_ergebnis = 'nicht_qualifiziert')::int,
         unklar = unklar + (p_ergebnis = 'unklar')::int,
         fehler = fehler + (p_ergebnis = 'fehler')::int,
         aktuelles_profil = nullif(btrim(coalesce(p_vorname, leer) || ' ' || coalesce(p_nachname, leer)), leer)
                            || coalesce(' · ' || nullif(btrim(coalesce(p_firma, leer)), leer), leer),
         status = case when p_ergebnis = 'gesendet' and gesendet + 1 >= ziel then 'abgeschlossen' else status end,
         finished_at = case when p_ergebnis = 'gesendet' and gesendet + 1 >= ziel then now() else finished_at end,
         meldung = case when p_ergebnis = 'gesendet' and gesendet + 1 >= ziel
                        then 'Ziel erreicht: ' || ziel || ' Vernetzungsanfragen gesendet.' else meldung end
   where id = p_lauf
  returning * into r;
  return r;
end;
$$;

create or replace function crm.recherche_dienst(p_schluessel text, p_aktion text, p_daten jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  d crm.recherche_dienste;
  r crm.recherche_laeufe;
  ids uuid[];
  st text;
  fr text;
  ergebnis jsonb;
  leer constant text := '';
begin
  select * into d from crm.recherche_dienste where schluessel_hash = encode(sha256(convert_to(coalesce(p_schluessel, leer), 'UTF8')), 'hex');
  if not found then raise exception 'Unbekannter Dienst-Schlüssel – bitte im CRM neu einrichten'; end if;
  -- als die Person des Schlüssels handeln (auth.uid() in den Recherche-Funktionen, created_by, Aktivitäten)
  perform set_config('request.jwt.claims', json_build_object('sub', d.member_id, 'role', 'authenticated')::text, true);
  update crm.recherche_dienste
     set zuletzt_gesehen = now(),
         rechner = coalesce(left(nullif(p_daten ->> 'rechner', leer), 100), rechner),
         version = coalesce(left(nullif(p_daten ->> 'version', leer), 40), version),
         -- Claude Code auf diesem Mac angemeldet? (Version; leer = nein) – meldet der Dienst beim Abholen
         claude = case when p_daten ? 'claude' then left(nullif(p_daten ->> 'claude', leer), 60) else claude end
   where id = d.id;

  if p_daten ? 'lauf' then
    select * into r from crm.recherche_laeufe where id = (p_daten ->> 'lauf')::uuid;
    if not found or r.member_id <> d.member_id then raise exception 'Recherchelauf nicht gefunden'; end if;
  end if;

  case p_aktion
  -- ---- Dienst ----
  when 'abholen' then
    ids := coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(p_daten -> 'ids', '[]'::jsonb)) x), '{}');
    return jsonb_build_object('laeufe', coalesce((
      select jsonb_agg(jsonb_build_object('id', l.id, 'status', l.status, 'agent_status', l.agent_status) order by l.started_at)
        from crm.recherche_laeufe l
       where l.member_id = d.member_id
         and ((l.status = 'laeuft' and l.agent_status in ('wartet', 'antwort')) or l.id = any(ids))), '[]'::jsonb));

  when 'uebernehmen' then
    st := r.agent_status;
    fr := r.agent_frage; -- die gerade beantwortete Frage – braucht die Übergabe an Claude
    update crm.recherche_laeufe
       set agent_status = 'arbeitet', agent_rechner = coalesce(left(nullif(p_daten ->> 'rechner', leer), 100), agent_rechner),
           agent_heartbeat = now(), agent_starts = agent_starts + (st = 'wartet')::int, agent_meldung = null, agent_frage = null
     where id = r.id and status = 'laeuft' and agent_status in ('wartet', 'antwort')
    returning * into r;
    if not found then return jsonb_build_object('ok', false); end if;
    return jsonb_build_object('ok', true, 'art', case when st = 'antwort' and r.agent_sitzung is not null then 'weiter' else 'neu' end,
      'auftrag', r.agent_auftrag, 'antwort', r.agent_antwort, 'sitzung', r.agent_sitzung, 'starts', r.agent_starts,
      'frage', fr, 'anbieter', r.agent_anbieter, 'claude_ersatz', d.claude_ersatz);

  when 'sitzung' then
    update crm.recherche_laeufe set agent_sitzung = left(p_daten ->> 'sitzung', 100) where id = r.id and agent_status = 'arbeitet';
    return jsonb_build_object('ok', true);

  -- ChatGPT hat sein Nutzungslimit erreicht: Claude übernimmt den Lauf (neue Sitzung, Agent arbeitet weiter)
  when 'wechsel' then
    if not d.claude_ersatz then raise exception 'Claude als Ersatz ist ausgeschaltet'; end if;
    update crm.recherche_laeufe
       set agent_anbieter = 'claude', agent_sitzung = null, agent_heartbeat = now(),
           agent_meldung = left(nullif(p_daten ->> 'meldung', leer), 2000)
     where id = r.id and status = 'laeuft' and agent_status = 'arbeitet' and agent_anbieter = 'chatgpt';
    return jsonb_build_object('ok', found);

  when 'lebenszeichen' then
    ids := coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(p_daten -> 'ids', '[]'::jsonb)) x), '{}');
    update crm.recherche_laeufe set agent_heartbeat = now()
     where member_id = d.member_id and id = any(ids) and agent_status = 'arbeitet';
    return jsonb_build_object('ok', true);

  when 'melden' then
    st := p_daten ->> 'agent_status';
    if st not in ('beendet', 'fehler', 'frage') then raise exception 'Unbekannter Agent-Status %', st; end if;
    update crm.recherche_laeufe
       set agent_status = case when st = 'frage' and status <> 'laeuft' then 'beendet' else st end,
           agent_meldung = case when st = 'frage' then agent_meldung else left(coalesce(p_daten ->> 'meldung', leer), 2000) end,
           agent_frage = case when st = 'frage' and status = 'laeuft' then left(p_daten ->> 'frage', 4000) end,
           agent_sitzung = coalesce(left(nullif(p_daten ->> 'sitzung', leer), 100), agent_sitzung),
           agent_heartbeat = now()
     where id = r.id and agent_status = 'arbeitet';
    return jsonb_build_object('ok', found);

  when 'aufraeumen' then
    update crm.recherche_laeufe set agent_status = 'beendet', agent_meldung = left(coalesce(p_daten ->> 'grund', leer), 2000)
     where member_id = d.member_id and agent_status = 'arbeitet' and agent_rechner = left(p_daten ->> 'rechner', 100);
    return jsonb_build_object('ok', true);

  -- ---- Werkzeuge des Agenten ----
  when 'lauf_status' then
    return jsonb_build_object(
      'status', r.status, 'ziel', r.ziel, 'gesendet', r.gesendet, 'noch', greatest(0, r.ziel - r.gesendet),
      'geprueft', r.geprueft, 'dubletten', r.dubletten, 'nicht_qualifiziert', r.abgelehnt, 'unklar', r.unklar,
      'senden_fehlgeschlagen', r.fehler, 'kontrollpunkt_faellig', r.geprueft >= (r.kontrollen + 1) * 10,
      'bearbeitete_profile', coalesce((
        select jsonb_agg(jsonb_build_object('url', p.linkedin_url, 'name', btrim(coalesce(p.vorname, leer) || ' ' || coalesce(p.nachname, leer)),
                                            'firma', p.firma, 'ergebnis', p.ergebnis) order by p.created_at desc)
          from (select * from crm.recherche_profile where lauf_id = r.id order by created_at desc limit 60) p), '[]'::jsonb));

  when 'ausgangspunkte' then
    -- je Firma(-gruppe) ein Kontakt – vernetzte und passende Positionen zuerst –, dann 30 Firmen je Lauf neu gemischt
    return (
      with kandidaten as (
        select l.id, l.full_name, l.role_title, l.company_name, l.linkedin_url, crm.firma_gruppe(l.company_name) as gruppe,
               coalesce(l.role_title, leer) ~* '(gesch(ä|ae)ftsf|inhaber|gr(ü|ue)nder|founder|owner|ceo|leit|head|projekt|vertrieb|sales|kunden|service|support|meister|techni|disponent|betrieb)' as icp,
               l.stage::text <> 'vernetzung_gesendet' as vernetzt
          from crm.leads l
         where l.deleted_at is null and l.linkedin_url is not null and l.company_name is not null and not l.do_not_contact
           and not exists (select 1 from crm.companies x where x.id = l.company_id and x.do_not_contact)
           and l.stage::text in ('vernetzung_gesendet', 'vernetzt', 'gespraech_eroeffnet', 'dm_follow_up', 'dm_beantwortet',
                                 'bedarfsermittlung', 'pitch', 'erstgespraech_vereinbart', 'erstgespraech',
                                 'strategiegespraech_vereinbart', 'strategiegespraech', 'sales_follow_up', 'kunde', 'langfristig')
      ), je_firma as (
        select distinct on (k.gruppe) k.*
          from kandidaten k
         where k.gruppe is not null
         order by k.gruppe, k.vernetzt desc, k.icp desc, md5(k.id::text || r.id::text)
      ), auswahl as (
        select * from je_firma order by md5(gruppe || r.id::text) limit 30
      )
      select jsonb_build_object(
        'hinweis', 'Jede Zeile ist eine andere Firma. Höchstens ' || crm.recherche_je_firma()
                   || ' Personen je Unternehmen anfragen – zählt über alle Läufe und beide Personen; profil_pruefen achtet darauf.',
        'personen', coalesce(jsonb_agg(jsonb_build_object('name', a.full_name, 'position', a.role_title, 'firma', a.company_name,
                                                          'url', a.linkedin_url)), '[]'::jsonb),
        'firmen', coalesce(jsonb_agg(a.company_name), '[]'::jsonb))
        from auswahl a);

  when 'pruefen' then
    if coalesce(btrim(p_daten ->> 'firma'), leer) = leer then
      return jsonb_build_object('frei', false, 'art', 'firma_fehlt',
        'grund', 'Firma (aktuellen Arbeitgeber) mit angeben – damit prüft das CRM die Grenze von höchstens '
                 || crm.recherche_je_firma() || ' Personen je Unternehmen.');
    end if;
    return crm.recherche_pruefen(r.id, p_daten ->> 'url', p_daten ->> 'vorname', p_daten ->> 'nachname', p_daten ->> 'firma');

  when 'eintragen' then
    r := crm.recherche_eintragen(r.id, p_daten ->> 'url', p_daten ->> 'ergebnis', p_daten ->> 'vorname', p_daten ->> 'nachname',
                                 p_daten ->> 'firma', p_daten ->> 'position', p_daten ->> 'kategorie', p_daten ->> 'grund',
                                 p_daten ->> 'ausgangspunkt', p_daten ->> 'firma_website');
    return jsonb_build_object('ok', true, 'status', r.status, 'gesendet', r.gesendet, 'ziel', r.ziel, 'geprueft', r.geprueft,
                              'kontrollpunkt_faellig', r.geprueft >= (r.kontrollen + 1) * 10, 'meldung', r.meldung);

  when 'kontrolle' then
    r := crm.recherche_kontrolle(r.id);
    return jsonb_build_object('ok', true, 'kontrollen', r.kontrollen, 'geprueft', r.geprueft);

  when 'einschraenkung' then
    r := crm.recherche_status(r.id, 'fehler', coalesce(nullif(btrim(p_daten ->> 'wortlaut'), leer), 'LinkedIn-Einschränkung (ohne Wortlaut)'));
    return jsonb_build_object('ok', true, 'status', r.status);

  else
    raise exception 'Unbekannte Aktion %', p_aktion;
  end case;
end;
$$;
