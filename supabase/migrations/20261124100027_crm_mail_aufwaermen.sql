-- Tägliches Aufwärmen mit eigenen Adressen (24.11.2026, Vincent: „das soll bitte jeden Tag so gemacht werden … richte einen
-- daily trigger ein“ – ausdrücklich auch für die Postfächer auf der Hauptdomain, nach Hinweis auf das Heatwave-Risiko).
-- Jeden Werktag um 08:00 UTC plant crm.mail_aufwaermen_planen() je eingetragenem Versand-Postfach: einen Platzierungstest an alle
-- Prüf-Postfächer (Posteingang/Spam wird ausgewertet, die Hochlauf-Bremse greift) und füllt bis „je_postfach“ mit Testmails an die
-- eingetragenen eigenen Adressen auf (nie an sich selbst, reihum). Der Motor verschickt sie wie alles andere – je Postfach eine Mail
-- pro Takt mit Mindestabstand, nach Antworten, Platzierungstests und Kampagnen. Sie zählen NICHT für den Hochlauf (keine
-- crm.emails-Zeilen) und nicht ins Tageskontingent der Kampagnen. Pausiert die Hochlauf-Bremse ein Postfach oder ist es noch in
-- Vorbereitung (Domain < 30 Tage, DNS), wird für dieses Postfach nichts geplant.
-- Konfiguration nur in der Datenbank (crm.settings email.aufwaermen – Adressen gehören nicht ins öffentliche Repo):
--   {"aktiv": true, "je_postfach": 10, "postfaecher": ["…"], "empfaenger": ["…"], "betreff": "…", "text": "…"}
-- betreff/text gelten für den Platzierungstest; die Testmails an die eigenen Adressen tragen „Testmail aus dem CRM“.
-- Die Edge Function mail-motor bleibt unverändert: sie reicht die Auftragsart nur an crm.mail_motor_ergebnis durch.

create table if not exists crm.mail_aufwaermen (
  id           uuid primary key default gen_random_uuid(),
  von_id       uuid not null references crm.mail_postfaecher (id) on delete cascade,
  an           text not null check (an = lower(btrim(an)) and an ~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'),
  betreff      text not null check (char_length(betreff) between 2 and 200),
  text         text not null check (char_length(text) between 10 and 10000),
  message_id   text not null,
  tag          date not null,
  status       text not null default 'geplant' check (status in ('geplant', 'in_arbeit', 'gesendet', 'fehler')),
  vergeben_at  timestamptz,
  gesendet_at  timestamptz,
  fehler       text check (fehler is null or char_length(fehler) <= 500),
  created_at   timestamptz not null default now()
);
create index if not exists mail_aufwaermen_offen_idx on crm.mail_aufwaermen (von_id, created_at) where status = 'geplant';
create index if not exists mail_aufwaermen_tag_idx on crm.mail_aufwaermen (tag);
comment on table crm.mail_aufwaermen is
  'Tägliche Testmails an eigene Adressen (Aufwärmen auf Wunsch des Teams) – geplant von crm.mail_aufwaermen_planen, versandt vom Mail-Motor.';

alter table crm.mail_aufwaermen enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'crm' and tablename = 'mail_aufwaermen' and policyname = 'Mitglieder lesen mail_aufwaermen') then
    create policy "Mitglieder lesen mail_aufwaermen" on crm.mail_aufwaermen for select to authenticated using ((select private.is_member()));
  end if;
end
$$;
revoke all on crm.mail_aufwaermen from public, anon;
grant select on crm.mail_aufwaermen to authenticated;

-- Standard-Konfiguration (aus); bestehende Werte bleiben
update crm.settings set value = value || '{"aufwaermen": {"aktiv": false, "je_postfach": 10, "postfaecher": [], "empfaenger": []}}'::jsonb
 where key = 'email' and not (value ? 'aufwaermen');

-- Plan eines Tages (idempotent je Postfach und Tag); Rückgabe = Zahl der geplanten Mails
create or replace function crm.mail_aufwaermen_planen(p_tag date default null) returns int
language plpgsql security definer set search_path = '' as $$
declare
  cfg jsonb := coalesce(crm.setting('email', 'aufwaermen'), '{}'::jsonb);
  v_tag date := coalesce(p_tag, crm.berlin_date(now()));
  v_je int := least(greatest(coalesce((cfg ->> 'je_postfach')::int, 10), 0), 25);
  v_postf text[] := array(select lower(btrim(x)) from jsonb_array_elements_text(coalesce(cfg -> 'postfaecher', '[]'::jsonb)) x);
  v_empf text[] := array(select distinct lower(btrim(x)) from jsonb_array_elements_text(coalesce(cfg -> 'empfaenger', '[]'::jsonb)) x
                          where lower(btrim(x)) ~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$');
  v_betreff text := coalesce(nullif(btrim(cfg ->> 'betreff'), ''), 'Testmail aus dem CRM');
  v_text text := coalesce(nullif(btrim(cfg ->> 'text'), ''),
                          E'Diese Testmail kommt aus dem CRM von Steiner & Co.\n\nIm Original (Gmail: ⋮ → „Original anzeigen“) sollte bei SPF, DKIM und DMARC „PASS“ stehen.');
  v_test_text constant text :=
    E'Diese Testmail kommt aus dem CRM von Steiner & Co.\n\nIm Original (Gmail: ⋮ → „Original anzeigen“) sollte bei SPF, DKIM und DMARC „PASS“ stehen.';
  pf crm.mail_postfaecher; v_ziele text[]; v_saat int; v_n int := 0; i int; v_test uuid;
begin
  if not coalesce((cfg ->> 'aktiv')::boolean, false) or v_je = 0 then return 0; end if;
  if extract(isodow from v_tag) > 5 or crm.is_holiday(v_tag) then return 0; end if;
  for pf in
    select p.* from crm.mail_postfaecher p
     where p.rolle = 'versand' and p.status = 'bereit' and p.smtp_host is not null and p.adresse = any (v_postf)
       and (p.gesperrt_bis is null or p.gesperrt_bis < now())
     order by p.adresse
  loop
    if exists (select 1 from crm.mail_aufwaermen a where a.von_id = pf.id and a.tag = v_tag) then continue; end if;
    if crm.mail_hochlauf(pf.id) ->> 'stufe' in ('pause', 'vorbereitung') then continue; end if;
    -- ein Platzierungstest je Postfach und Tag (eine Test-ID für alle Prüf-Postfächer)
    v_test := gen_random_uuid();
    insert into crm.mail_platzierung (test, von_id, saat_id, message_id, betreff, text)
    select v_test, pf.id, s.id, private.mail_message_id(pf.adresse), left(v_betreff, 200), left(v_text, 10000)
      from crm.mail_postfaecher s where s.rolle = 'saat' and s.status = 'bereit';
    get diagnostics v_saat = row_count;
    v_n := v_n + v_saat;
    v_ziele := array(select e from unnest(v_empf) e where e <> pf.adresse order by e);
    if cardinality(v_ziele) > 0 then
      for i in 0 .. v_je - v_saat - 1 loop
        insert into crm.mail_aufwaermen (von_id, an, betreff, text, message_id, tag)
        values (pf.id, v_ziele[(i % cardinality(v_ziele)) + 1], 'Testmail aus dem CRM', v_test_text, private.mail_message_id(pf.adresse), v_tag);
        v_n := v_n + 1;
      end loop;
    end if;
  end loop;
  return v_n;
end;
$$;
comment on function crm.mail_aufwaermen_planen(date) is
  'Plant die täglichen Aufwärm-Mails (Platzierungstest + Testmails an eigene Adressen) laut crm.settings email.aufwaermen.';
revoke all on function crm.mail_aufwaermen_planen(date) from public, anon, authenticated;
grant execute on function crm.mail_aufwaermen_planen(date) to service_role;

-- Auftrag für den Motor: nächste geplante Aufwärm-Mail dieses Postfachs (nur vom geplanten Tag)
create or replace function private.mail_auftrag_aufwaermen(pf crm.mail_postfaecher) returns jsonb
language plpgsql set search_path = '' as $$
declare a crm.mail_aufwaermen;
begin
  select * into a from crm.mail_aufwaermen
   where von_id = pf.id and status = 'geplant' and tag = crm.berlin_date(now())
   order by created_at, id limit 1 for update skip locked;
  if not found then return null; end if;
  update crm.mail_aufwaermen set status = 'in_arbeit', vergeben_at = now() where id = a.id;
  return jsonb_build_object('art', 'aufwaermen', 'id', a.id, 'an', a.an, 'an_name', null, 'betreff', a.betreff, 'text', a.text,
                            'message_id', a.message_id, 'in_reply_to', null, 'references', null, 'kopf', '{}'::jsonb);
end;
$$;

-- Aufräumen: hängende/verfallene Aufwärm-Mails
CREATE OR REPLACE FUNCTION private.mail_aufraeumen()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  with alt as (
    select r.id, r.in_arbeit from crm.mail_empfaenger r where r.in_arbeit is not null and r.in_arbeit_seit < now() - interval '10 minutes'
  ), weg as (
    delete from crm.emails e using alt where e.id = alt.in_arbeit and e.status = 'draft' returning e.id
  )
  update crm.mail_empfaenger r set in_arbeit = null, in_arbeit_seit = null, versuche = versuche + 1,
         status = case when versuche + 1 >= 3 then 'fehler' else status end,
         stopp_grund = case when versuche + 1 >= 3 then 'Versand dreimal abgebrochen' else stopp_grund end
    from alt where r.id = alt.id;
  update crm.mail_platzierung set status = 'fehler', fehler = 'Abgebrochen'
   where status = 'in_arbeit' and created_at < now() - interval '15 minutes';
  update crm.mail_platzierung set ordner = 'fehlt', geprueft_at = now()
   where status = 'gesendet' and ordner is null and gesendet_at < now() - interval '2 hours';
  update crm.mail_aufwaermen set status = 'fehler', fehler = 'Abgebrochen'
   where status = 'in_arbeit' and vergeben_at < now() - interval '15 minutes';
  update crm.mail_aufwaermen set status = 'fehler', fehler = 'Verfallen (nicht am geplanten Tag gesendet)'
   where status = 'geplant' and tag < crm.berlin_date(now());
  update crm.emails set status = 'failed', bounce_reason = 'Versand abgebrochen', sofort = false
   where sofort and status = 'draft' and status_at < now() - interval '30 minutes' and created_at < now() - interval '30 minutes';
end;
$function$;

-- Motor: Aufwärmen als letzte Auftragsart
CREATE OR REPLACE FUNCTION crm.mail_motor_auftraege(p_max integer DEFAULT 8)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare pf crm.mail_postfaecher; v_jobs jsonb := '[]'::jsonb; v_job jsonb; v_abstand interval; v_hochlauf jsonb;
begin
  perform private.mail_aufraeumen();
  for pf in
    select p.* from crm.mail_postfaecher p
     where p.status = 'bereit' and p.smtp_host is not null and p.rolle = 'versand'
       and (p.gesperrt_bis is null or p.gesperrt_bis < now())
       and (p.naechster_versand_at is null or p.naechster_versand_at <= now()
            or exists (select 1 from crm.emails e where e.postfach_id = p.id and e.sofort and e.status = 'draft'))
     order by random()
     limit greatest(p_max, 1)
     for update of p skip locked
  loop
    v_abstand := make_interval(mins => pf.mindestabstand_min);
    v_job := private.mail_auftrag_einzeln(pf);
    if v_job is null and (pf.naechster_versand_at is null or pf.naechster_versand_at <= now()) then
      v_job := private.mail_auftrag_platzierung(pf);
      if v_job is null then
        v_hochlauf := crm.mail_hochlauf(pf.id);
        select o_job, o_abstand into v_job, v_abstand from private.mail_auftrag_kampagne(pf, v_hochlauf);
      end if;
      if v_job is null then
        v_abstand := make_interval(mins => pf.mindestabstand_min);
        v_job := private.mail_auftrag_aufwaermen(pf);
      end if;
    end if;
    if v_job is not null then
      v_jobs := v_jobs || jsonb_build_array(v_job || jsonb_build_object('postfach_id', pf.id, 'von', pf.adresse, 'von_name', pf.absender_name));
      update crm.mail_postfaecher set naechster_versand_at = now() + coalesce(v_abstand, make_interval(mins => pf.mindestabstand_min))
       where id = pf.id;
    end if;
  end loop;
  return v_jobs;
end;
$function$;

-- Ergebnis buchen: Aufwärm-Mails
CREATE OR REPLACE FUNCTION crm.mail_motor_ergebnis(p_art text, p_id uuid, p_ok boolean, p_fehlerart text DEFAULT NULL::text, p_fehler text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare e crm.emails; r crm.mail_empfaenger; k crm.mail_kampagnen; t crm.mail_platzierung; w crm.mail_aufwaermen; v_postfach uuid; v_naechster crm.mail_schritte;
begin
  if p_art = 'platzierung' then
    select * into t from crm.mail_platzierung where id = p_id for update;
    if not found then return; end if;
    v_postfach := t.von_id;
    update crm.mail_platzierung set status = case when p_ok then 'gesendet' else 'fehler' end,
           gesendet_at = case when p_ok then now() end, fehler = case when p_ok then null else left(p_fehler, 500) end
     where id = t.id;
  elsif p_art = 'aufwaermen' then
    select * into w from crm.mail_aufwaermen where id = p_id for update;
    if not found then return; end if;
    v_postfach := w.von_id;
    update crm.mail_aufwaermen set status = case when p_ok then 'gesendet' else 'fehler' end,
           gesendet_at = case when p_ok then now() end, fehler = case when p_ok then null else left(p_fehler, 500) end
     where id = w.id;
  else
    select * into e from crm.emails where id = p_id for update;
    if not found then return; end if;
    v_postfach := e.postfach_id;
    if p_ok then
      perform set_config('crm.mail_motor', 'buchen', true);
      update crm.emails set status = 'sent', sent_at = now(), sofort = false where id = e.id;
      perform set_config('crm.mail_motor', '', true);
      update crm.mail_postfaecher set hochlauf_start = coalesce(hochlauf_start, (now() at time zone 'Europe/Berlin')::date)
       where id = v_postfach and hochlauf_start is null;
      if e.empfaenger_id is not null then
        select * into r from crm.mail_empfaenger where id = e.empfaenger_id for update;
        select * into k from crm.mail_kampagnen where id = r.kampagne_id;
        select * into v_naechster from crm.mail_schritte where kampagne_id = r.kampagne_id and position = r.schritt + 1;
        update crm.mail_empfaenger set
            in_arbeit = null, in_arbeit_seit = null, versuche = 0, schritt = r.schritt + 1,
            betreff_start = coalesce(betreff_start, e.subject), letzte_message_id = e.message_id_header,
            referenzen = btrim(coalesce(referenzen, '') || ' ' || e.message_id_header), letzter_versand_at = now(),
            status = case when status = 'aktiv' and v_naechster.id is null then 'fertig' else status end,
            naechster_versand_at = case when v_naechster.id is null then null
                                        else private.mail_naechstes_fenster(k.zeitplan, crm.berlin_date(now()) + greatest(v_naechster.wartetage, 1)) end
         where id = r.id;
      end if;
    else
      if e.empfaenger_id is not null then
        update crm.mail_empfaenger set
            in_arbeit = null, in_arbeit_seit = null, versuche = versuche + 1,
            status = case when p_fehlerart = 'empfaenger' then 'bounce' when versuche + 1 >= 3 then 'fehler' else status end,
            stopp_grund = case when p_fehlerart = 'empfaenger' then left('Adresse abgelehnt: ' || coalesce(p_fehler, ''), 300)
                               when versuche + 1 >= 3 then left('Versand dreimal fehlgeschlagen: ' || coalesce(p_fehler, ''), 300)
                               else stopp_grund end,
            naechster_versand_at = now() + interval '30 minutes'
         where id = e.empfaenger_id;
        if p_fehlerart = 'empfaenger' then
          insert into crm.sperrliste (email, reason, channels, note, lead_id)
          values (e.to_address, 'bounce', array['email']::crm.channel[], left(p_fehler, 500), e.lead_id) on conflict do nothing;
        end if;
        delete from crm.emails where id = e.id and status = 'draft';
      elsif p_fehlerart in ('voruebergehend', 'drossel', 'limit') and e.sofort then
        null; -- Einzelmail bleibt Entwurf und geht im nächsten möglichen Takt raus
      else
        update crm.emails set status = 'failed', bounce_reason = left(p_fehler, 500), sofort = false where id = e.id;
      end if;
    end if;
  end if;
  if p_ok then
    update crm.mail_postfaecher set fehler_folge = 0 where id = v_postfach and fehler_folge <> 0;
  elsif p_fehlerart = 'anmeldung' then
    update crm.mail_postfaecher set status = 'fehler', status_at = now(),
           status_text = left('Anmeldung abgelehnt – App-Passwort prüfen: ' || coalesce(p_fehler, ''), 500)
     where id = v_postfach;
  elsif p_fehlerart = 'limit' then
    update crm.mail_postfaecher set gesperrt_bis = private.mail_tagesbeginn() + interval '1 day 7 hours', status_at = now(),
           status_text = left('Sendelimit des Anbieters erreicht – Pause bis morgen 7 Uhr: ' || coalesce(p_fehler, ''), 500)
     where id = v_postfach;
  elsif p_fehlerart = 'drossel' then
    update crm.mail_postfaecher set gesperrt_bis = now() + interval '1 hour', status_at = now(),
           status_text = left('Anbieter drosselt – eine Stunde Pause: ' || coalesce(p_fehler, ''), 500)
     where id = v_postfach;
  elsif p_fehlerart = 'abgelehnt' then
    update crm.mail_postfaecher set gesperrt_bis = now() + interval '1 day', status_at = now(),
           status_text = left('Vom Server abgelehnt (Spam/Richtlinie) – 24 Stunden Pause, Texte und DNS prüfen: ' || coalesce(p_fehler, ''), 500)
     where id = v_postfach;
  elsif coalesce(p_fehlerart, '') <> 'empfaenger' then
    update crm.mail_postfaecher set fehler_folge = fehler_folge + 1,
           status = case when fehler_folge + 1 >= 5 then 'fehler' else status end,
           status_text = case when fehler_folge + 1 >= 5 then left('Fünfmal hintereinander fehlgeschlagen: ' || coalesce(p_fehler, ''), 500) else status_text end,
           status_at = case when fehler_folge + 1 >= 5 then now() else status_at end
     where id = v_postfach;
  end if;
end;
$function$;

comment on function crm.mail_motor_auftraege(int) is
  'Mail-Motor: je Postfach höchstens ein Auftrag pro Takt (Antwort aus der Unibox > Platzierungstest > Kampagne > Aufwärmen), Kontingent aus dem Hochlauf.';

-- Jeden Werktag 08:00 UTC (09:00 MEZ / 10:00 MESZ)
select cron.schedule('crm-mail-aufwaermen', '0 8 * * 1-5', $cron$ select crm.mail_aufwaermen_planen(); $cron$);
