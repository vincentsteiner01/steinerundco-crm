-- KPI-Läufe und Board-Zahlen: Funde der Gegenprüfung (26.11.2026). Das Board war zu diesem Zeitpunkt noch leer – es ist keine
-- Zahl zu reparieren, nur die Regeln werden richtiggestellt.
--
-- 1) Sicht crm.v_board_zaehlung: Ein Lead aus dem alten CRM zählte auf dem Board noch einmal als „Angeschrieben“, wenn seine
--    Eröffnung dort mit kpi_relevant = false stand. Das heißt aber gerade „steht schon in den importierten Sheet-Zahlen“
--    (Tageszähler gespraeche_eroeffnet) – 132 Leads waren betroffen. Die Bedingung entfällt.
-- 2) Fehlgriff von Hand zurückgenommen (ziehen oder Lead-Blatt, ohne den Knopf „Rückgängig“): Liegt die Karte keine zehn
--    Minuten in ihrer Liste und geht in die Liste von davor zurück, gilt wieder genau der Stand von davor – sonst entstand
--    z. B. aus „Verloren → versehentlich Im Geschäft → zurück“ ein Kunde, den es nie gab.
-- 3) „Rückgängig“ nach „Karte entfernt“ ohne Zeitfenster: weitergeführt wird der Lauf, den genau dieses Entfernen beendet hat
--    (er endete, nachdem die Karte in ihre Liste kam). Das alte Zehn-Minuten-Fenster öffnete im Sonderfall den falschen Lauf
--    oder – wenn der Hinweis länger stehen blieb – gar keinen.
-- 4) Der Zeitstempel von „Rückgängig“ kann von der Uhr des Rechners stammen (der Client trägt board_seit vorläufig selbst ein).
--    „Rückgängig“ wird deshalb daran erkannt, DASS ein Zeitstempel mitkommt, der nicht „jetzt“ ist; in den Lauf kommt nie ein
--    Zeitpunkt in der Zukunft.
-- 5) Zug von einem Bildschirm, der das Entfernen einer Karte noch nicht kennt: der letzte Lauf geht weiter, statt dass ein
--    zweiter entsteht („Lead hinzufügen“ legt immer in „Angeschrieben“ an – ein Zug von „nicht auf dem Board“ in eine andere
--    Liste kann nur von einem veralteten Stand kommen).

-- -----------------------------------------------------------------------------------------------------
-- 1. Board-Zahlen: alte Eröffnung zählt nie doppelt
-- -----------------------------------------------------------------------------------------------------
create or replace view crm.v_board_zaehlung with (security_invoker = true) as
select l.owner_id as member_id, crm.berlin_date(r.angeschrieben_am) as tag, 'angeschrieben'::text as kennzahl, r.lead_id
  from crm.board_laeufe r join crm.leads l on l.id = r.lead_id
 where l.deleted_at is null
   -- auch kpi_relevant = false: das heißt „steht schon in den Sheet-Zahlen“ (Tageszähler gespraeche_eroeffnet)
   and not exists (select 1 from crm.activities a
                    where a.lead_id = r.lead_id and a.type = 'gespraech_eroeffnet'
                      and a.occurred_at < r.angeschrieben_am)
union all
select l.owner_id, crm.berlin_date(r.gespraech_am), 'gespraech', r.lead_id
  from crm.board_laeufe r join crm.leads l on l.id = r.lead_id
 where l.deleted_at is null and r.gespraech_am is not null
   and not exists (select 1 from crm.meetings m
                    where m.lead_id = r.lead_id and m.type = 'erstgespraech' and m.status <> 'verschoben'
                      and m.booked_at < r.gespraech_am)
union all
select l.owner_id, crm.berlin_date(r.im_geschaeft_am), 'im_geschaeft', r.lead_id
  from crm.board_laeufe r join crm.leads l on l.id = r.lead_id
 where l.deleted_at is null and r.im_geschaeft_am is not null
   and not exists (select 1 from crm.activities a
                    where a.lead_id = r.lead_id and a.type = 'stage_wechsel' and a.metadata ->> 'to' = 'kunde'
                      and a.occurred_at < r.im_geschaeft_am)
union all
select l.owner_id, crm.berlin_date(r.verloren_am), 'verloren', r.lead_id
  from crm.board_laeufe r join crm.leads l on l.id = r.lead_id
 where l.deleted_at is null and r.verloren_am is not null;

-- -----------------------------------------------------------------------------------------------------
-- 2.–5. Trigger
-- -----------------------------------------------------------------------------------------------------
create or replace function crm.leads_board_lauf() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_alt text := case when tg_op = 'UPDATE' then old.board_liste end;
  v_neu text := new.board_liste;
  -- Zeitpunkt des Zugs – nie in der Zukunft (board_seit kann kurz von der Uhr des Rechners stammen)
  v_ts timestamptz := least(coalesce(new.board_seit, now()), now());
  -- „Rückgängig“ gibt den alten Zeitstempel der Liste mit; einem gewöhnlichen Zug setzt leads_board_before_write genau „jetzt“
  v_rueck boolean := new.board_seit is not null and new.board_seit <> now();
  -- die Karte lag keine zehn Minuten in ihrer Liste: geht sie in die Liste von davor zurück, war der Zug ein Fehlgriff
  v_kurz boolean := case when tg_op = 'UPDATE' then coalesce(old.board_seit > now() - interval '10 minutes', false) else false end;
  v_offen boolean;
  r crm.board_laeufe;
begin
  if v_neu is not distinct from v_alt then return null; end if;

  select * into r from crm.board_laeufe where lead_id = new.id and beendet_am is null for update;
  v_offen := found;

  if v_neu is null then
    -- vom Board genommen: der Lauf endet, seine Zahlen bleiben (Aufräumen ändert keine Vergangenheit) …
    if v_offen then
      if r.gespraech_am is null and r.im_geschaeft_am is null and r.verloren_am is null
         and r.angeschrieben_am > now() - interval '10 minutes' then
        delete from crm.board_laeufe where id = r.id; -- … außer die Karte war ein Versehen: gerade erst angelegt und gleich wieder weg
      else
        update crm.board_laeufe set beendet_am = now() where id = r.id;
      end if;
    end if;
    return null;
  end if;

  if not v_offen then
    if v_rueck then
      -- „Rückgängig“ nach „Karte entfernt“: der Lauf, den genau dieses Entfernen beendet hat – er endete, nachdem die Karte in
      -- ihre Liste kam (board_seit). Ein Lauf, der davor endete, gehört zu einem früheren Leben der Karte und bleibt, wie er ist.
      select * into r from crm.board_laeufe
       where lead_id = new.id and beendet_am is not null
         and (beendet_am >= new.board_seit or new.board_seit > now())
       order by beendet_am desc limit 1 for update;
      v_offen := found;
    elsif tg_op = 'UPDATE' and v_neu <> 'angeschrieben' then
      -- Zug von einem Bildschirm, der das Entfernen noch nicht kennt: der letzte Lauf geht weiter
      select * into r from crm.board_laeufe
       where lead_id = new.id and beendet_am is not null
       order by beendet_am desc limit 1 for update;
      v_offen := found;
    end if;
    if v_offen then
      update crm.board_laeufe set beendet_am = null where id = r.id;
    else
      -- Neuanlage (auch dieselbe Person noch einmal): ein neuer Lauf
      insert into crm.board_laeufe (lead_id, angeschrieben_am) values (new.id, v_ts) returning * into r;
    end if;
  end if;

  if (v_rueck or v_kurz) and r.vorher is not null and r.vorher ->> 'liste' is not distinct from v_neu then
    -- „Rückgängig“ oder ein von Hand zurückgenommener Fehlgriff: genau der Stand vor dem letzten Zug
    update crm.board_laeufe
       set gespraech_am = (r.vorher ->> 'gespraech_am')::timestamptz,
           im_geschaeft_am = (r.vorher ->> 'im_geschaeft_am')::timestamptz,
           verloren_am = (r.vorher ->> 'verloren_am')::timestamptz,
           vorher = null
     where id = r.id;
    return null;
  end if;

  -- Stand nach dem Zug: was vor der neuen Liste liegt, gilt als erreicht; was dahinter liegt, gilt nicht mehr.
  -- „Verloren“ behält die erreichten Stufen (das Gespräch gab es) – jede andere Liste hebt „Verloren“ wieder auf.
  -- Rechts vom Gleichheitszeichen stehen die Werte VOR dem Zug – so landet der alte Stand in vorher.
  update crm.board_laeufe
     set vorher = jsonb_build_object('liste', v_alt, 'gespraech_am', gespraech_am,
                                     'im_geschaeft_am', im_geschaeft_am, 'verloren_am', verloren_am),
         gespraech_am = case when v_neu in ('gespraech', 'im_geschaeft') then coalesce(gespraech_am, v_ts)
                             when v_neu = 'angeschrieben' then null
                             else gespraech_am end,
         im_geschaeft_am = case when v_neu = 'im_geschaeft' then coalesce(im_geschaeft_am, v_ts)
                                when v_neu in ('angeschrieben', 'gespraech') then null
                                else im_geschaeft_am end,
         verloren_am = case when v_neu = 'verloren' then coalesce(verloren_am, v_ts) else null end
   where id = r.id;
  return null;
exception when others then
  raise warning 'crm.leads_board_lauf: % (%)', sqlerrm, sqlstate;
  return null;
end;
$$;
revoke all on function crm.leads_board_lauf() from public, anon, authenticated;
