-- KPI-Läufe: „Rückgängig“ stellt den Stand genau wieder her (26.11.2026, zwei Funde aus der Prüfung von Migration 29).
--
-- 1) Eine Karte aus „Verloren“ versehentlich zurückgeschoben und per „Rückgängig“ wieder hingelegt, verlor ihr Gespräch bzw.
--    „Im Geschäft“: der Zug nach vorn leerte die späteren Stufen, „Rückgängig“ stellte nur „Verloren“ wieder her. Jetzt merkt
--    sich der Lauf den Stand vor dem letzten Zug (Spalte vorher) und „Rückgängig“ schreibt genau diesen Stand zurück.
-- 2) Eine entfernte Karte, die binnen zehn Minuten über „Lead hinzufügen“ neu angelegt wurde, führte den alten Lauf weiter und
--    leerte ihn. Der alte Lauf geht jetzt nur noch bei echtem „Rückgängig“ weiter; eine Neuanlage beginnt einen neuen Lauf.
--
-- Woran man „Rückgängig“ erkennt: Der Aufrufer gibt den alten Zeitstempel der Liste mit (board_seit liegt in der Vergangenheit).
-- Einem gewöhnlichen Zug setzt leads_board_before_write „jetzt“.

alter table crm.board_laeufe add column if not exists vorher jsonb;
comment on column crm.board_laeufe.vorher is
  'Stand vor dem letzten Zug (Liste und die drei Zeitstempel) – daraus stellt „Rückgängig“ den Lauf genau wieder her.';

create or replace function crm.leads_board_lauf() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_alt text := case when tg_op = 'UPDATE' then old.board_liste end;
  v_neu text := new.board_liste;
  -- board_seit setzt leads_board_before_write: „jetzt“ – oder bei „Rückgängig“ der alte Zeitstempel der Liste
  v_ts timestamptz := coalesce(new.board_seit, now());
  v_rueck boolean := new.board_seit is not null and new.board_seit < now();
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
    -- „Rückgängig“ nach „Karte entfernt“: derselbe Lauf geht weiter. Eine Neuanlage beginnt immer einen neuen Lauf.
    if v_rueck then
      select * into r from crm.board_laeufe
       where lead_id = new.id and beendet_am > now() - interval '10 minutes'
       order by beendet_am desc limit 1 for update;
      v_offen := found;
    end if;
    if v_offen then
      update crm.board_laeufe set beendet_am = null where id = r.id;
    else
      insert into crm.board_laeufe (lead_id, angeschrieben_am) values (new.id, v_ts) returning * into r;
    end if;
  end if;

  if v_rueck and r.vorher is not null and r.vorher ->> 'liste' is not distinct from v_neu then
    -- „Rückgängig“ des letzten Zugs: genau der Stand von davor
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
