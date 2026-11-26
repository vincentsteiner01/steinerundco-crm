-- KPI-Reiter zurück (26.11.2026, Vincent: „Den KPI Tab vom alten CRM müssen wir wieder reinbringen, weil damit können wir gut
-- tracken“). Entscheidungen der Inhaber: Board-Zahlen plus zwei Tageszähler (Vernetzungen versendet und angenommen); die alten
-- Zahlen bleiben als Vergleich sichtbar (alte „Gespräche eröffnet“ = „Angeschrieben“, alte „Erstgespräche vereinbart“ =
-- „Gespräch vereinbart“, alte „Kunden gewonnen“ = „Im Geschäft“).
--
-- 1) crm.board_laeufe: je Karte ein „Lauf“ über das Board – wann sie in welche Liste kam. Ein Trigger an crm.leads pflegt ihn.
--    Das Board selbst speichert nur die aktuelle Liste (board_liste, board_seit); ohne den Lauf gäbe es keine Zahlen je Tag.
--    Der Lauf beschreibt den Stand des Wissens, kein Protokoll jeder Mausbewegung: wer eine Karte zurückschiebt (Rückgängig oder
--    Korrektur), nimmt die späteren Stufen wieder heraus.
-- 2) crm.v_kpi_tage: eine Zeile je Person und Tag mit allen Zahlen des KPI-Reiters – aus Board, Tageszählern
--    (crm.daily_counters über crm.set_counter, beides unverändert), E-Mail-Motor und den alten Zahlen (crm.v_metric_events).
-- Nichts Altes wird geändert oder gelöscht; stage, activities und die alten Trigger bleiben unberührt.

-- -----------------------------------------------------------------------------------------------------
-- 1. Läufe
-- -----------------------------------------------------------------------------------------------------
create table if not exists crm.board_laeufe (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references crm.leads (id) on delete cascade,
  angeschrieben_am timestamptz not null,
  gespraech_am timestamptz,
  im_geschaeft_am timestamptz,
  verloren_am timestamptz,
  beendet_am timestamptz,
  created_at timestamptz not null default now()
);
comment on table crm.board_laeufe is
  'Ein Lauf einer Karte über das Board: wann sie nach „Angeschrieben“, „Gespräch vereinbart“, „Im Geschäft“ und „Verloren“ kam. Grundlage der KPI-Zahlen. Schreibt nur der Trigger leads_board_lauf; beendet_am = Karte vom Board genommen.';
comment on column crm.board_laeufe.gespraech_am is
  'Gesetzt, sobald die Karte „Gespräch vereinbart“ erreicht hat (auch beim direkten Sprung nach „Im Geschäft“). Wieder leer, wenn sie nach „Angeschrieben“ zurückgeschoben wird.';
create unique index if not exists board_laeufe_offen_uidx on crm.board_laeufe (lead_id) where beendet_am is null;
create index if not exists board_laeufe_lead_idx on crm.board_laeufe (lead_id);

alter table crm.board_laeufe enable row level security;
revoke all on crm.board_laeufe from public, anon;
revoke insert, update, delete, truncate on crm.board_laeufe from authenticated;
grant select on crm.board_laeufe to authenticated;
do $$
begin
  create policy "Mitglieder lesen board_laeufe" on crm.board_laeufe for select to authenticated using ((select private.is_member()));
exception when duplicate_object then null;
end
$$;

-- Läuft mit den Rechten des Eigentümers (Mitglieder dürfen die Tabelle nur lesen). Ein Fehler hier darf das Verschieben einer
-- Karte nie verhindern – dann fehlt lieber eine Zahl, als dass das Board stehen bleibt.
create or replace function crm.leads_board_lauf() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_alt text := case when tg_op = 'UPDATE' then old.board_liste end;
  v_neu text := new.board_liste;
  -- board_seit setzt leads_board_before_write: „jetzt“ – oder bei „Rückgängig“ der alte Zeitstempel der Liste
  v_ts timestamptz := coalesce(new.board_seit, now());
  r crm.board_laeufe;
begin
  if v_neu is not distinct from v_alt then return null; end if;

  select * into r from crm.board_laeufe where lead_id = new.id and beendet_am is null for update;

  if v_neu is null then
    -- vom Board genommen: der Lauf endet, seine Zahlen bleiben (Aufräumen ändert keine Vergangenheit) …
    if found then
      if r.gespraech_am is null and r.im_geschaeft_am is null and r.verloren_am is null
         and r.angeschrieben_am > now() - interval '10 minutes' then
        delete from crm.board_laeufe where id = r.id; -- … außer die Karte war ein Versehen: gerade erst angelegt und gleich wieder weg
      else
        update crm.board_laeufe set beendet_am = now() where id = r.id;
      end if;
    end if;
    return null;
  end if;

  if not found then
    -- gerade erst vom Board genommen und wieder da („Rückgängig“ nach „Karte entfernt“): derselbe Lauf geht weiter
    select * into r from crm.board_laeufe
     where lead_id = new.id and beendet_am > now() - interval '10 minutes'
     order by beendet_am desc limit 1 for update;
    if found then
      update crm.board_laeufe set beendet_am = null where id = r.id;
    else
      insert into crm.board_laeufe (lead_id, angeschrieben_am) values (new.id, v_ts) returning * into r;
    end if;
  end if;

  -- Stand nach dem Zug: was vor der neuen Liste liegt, gilt als erreicht; was dahinter liegt, gilt nicht mehr.
  -- „Verloren“ behält die erreichten Stufen (das Gespräch gab es) – jede andere Liste hebt „Verloren“ wieder auf.
  update crm.board_laeufe
     set gespraech_am = case when v_neu in ('gespraech', 'im_geschaeft') then coalesce(gespraech_am, v_ts)
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

drop trigger if exists leads_board_lauf on crm.leads;
create trigger leads_board_lauf after insert or update of board_liste on crm.leads
  for each row execute function crm.leads_board_lauf();

-- Karten, die schon auf dem Board liegen (zwischen Neustart und dieser Migration angelegt): Lauf aus dem aktuellen Stand
insert into crm.board_laeufe (lead_id, angeschrieben_am, gespraech_am, im_geschaeft_am, verloren_am)
select l.id,
       case when l.board_liste = 'angeschrieben' then coalesce(l.board_seit, now())
            else least(coalesce(l.board_seit, now()), greatest(l.created_at, timestamptz '2026-11-25 00:00+01')) end,
       case when l.board_liste in ('gespraech', 'im_geschaeft') then coalesce(l.board_seit, now()) end,
       case when l.board_liste = 'im_geschaeft' then coalesce(l.board_seit, now()) end,
       case when l.board_liste = 'verloren' then coalesce(l.board_seit, now()) end
  from crm.leads l
 where l.board_liste is not null
   and not exists (select 1 from crm.board_laeufe r where r.lead_id = l.id and r.beendet_am is null);

-- -----------------------------------------------------------------------------------------------------
-- 2. Zahlen je Person und Tag
-- -----------------------------------------------------------------------------------------------------
-- Board-Zahlen: je Lauf und erreichter Liste eine Zeile. Die Person ist die heutige Zugehörigkeit der Karte (wie auf dem Board
-- und der Team-Seite). Ein Lead aus dem alten CRM zählt nicht doppelt: war sein Gespräch dort schon eröffnet, sein
-- Erstgespräch gebucht oder er schon Kunde, steht die Zahl bereits an ihrem alten Tag.
create or replace view crm.v_board_zaehlung with (security_invoker = true) as
select l.owner_id as member_id, crm.berlin_date(r.angeschrieben_am) as tag, 'angeschrieben'::text as kennzahl, r.lead_id
  from crm.board_laeufe r join crm.leads l on l.id = r.lead_id
 where l.deleted_at is null
   and not exists (select 1 from crm.activities a
                    where a.lead_id = r.lead_id and a.type = 'gespraech_eroeffnet' and a.kpi_relevant
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
comment on view crm.v_board_zaehlung is
  'Board-Zahlen als einzelne Ereignisse (Person = Zugehörigkeit der Karte, Tag in Berliner Zeit). Grundlage von v_kpi_tage.';

-- period = 'monat': Monatszähler aus dem alten Sheet-Import (September und Oktober 2026, Tag = Monatserster). Sie zählen nur in
-- der Monatsansicht – der Reiter filtert sie in allen anderen Zeiträumen heraus.
create or replace view crm.v_kpi_tage with (security_invoker = true) as
with zeilen as (
  -- altes CRM (Ereignisse bis 24.11.2026), Tageszähler und der E-Mail-Motor
  select e.member_id, e.day as tag, e.period,
         case e.metric
           when 'vernetzungen_versendet' then 'vernetzungen_versendet'
           when 'vernetzungen_angenommen' then 'vernetzungen_angenommen'
           when 'gespraeche_eroeffnet' then 'angeschrieben'
           when 'erstgespraeche_vereinbart' then 'gespraech'
           when 'kunden_gewonnen' then 'im_geschaeft'
           when 'emails_gesendet' then 'emails_gesendet'
         end as kennzahl,
         e.value::int as wert
    from crm.v_metric_events e
   where e.metric in ('vernetzungen_versendet', 'vernetzungen_angenommen', 'gespraeche_eroeffnet',
                      'erstgespraeche_vereinbart', 'kunden_gewonnen', 'emails_gesendet')
  union all
  select b.member_id, b.tag, 'tag'::crm.counter_period, b.kennzahl, 1
    from crm.v_board_zaehlung b
  union all
  select coalesce(e.member_id, p.member_id), crm.berlin_date(coalesce(e.sent_at, e.created_at)),
         'tag'::crm.counter_period, 'email_antworten', 1
    from crm.emails e
    left join crm.mail_postfaecher p on p.id = e.postfach_id
   where e.direction = 'in' and e.einordnung = 'antwort'
)
select member_id, tag, period,
       coalesce(sum(wert) filter (where kennzahl = 'vernetzungen_versendet'), 0)::int as vernetzungen_versendet,
       coalesce(sum(wert) filter (where kennzahl = 'vernetzungen_angenommen'), 0)::int as vernetzungen_angenommen,
       coalesce(sum(wert) filter (where kennzahl = 'angeschrieben'), 0)::int as angeschrieben,
       coalesce(sum(wert) filter (where kennzahl = 'gespraech'), 0)::int as gespraech,
       coalesce(sum(wert) filter (where kennzahl = 'im_geschaeft'), 0)::int as im_geschaeft,
       coalesce(sum(wert) filter (where kennzahl = 'verloren'), 0)::int as verloren,
       coalesce(sum(wert) filter (where kennzahl = 'emails_gesendet'), 0)::int as emails_gesendet,
       coalesce(sum(wert) filter (where kennzahl = 'email_antworten'), 0)::int as email_antworten
  from zeilen
 where tag is not null
 group by member_id, tag, period;
comment on view crm.v_kpi_tage is
  'KPI-Reiter: je Person, Tag und Zählerart (tag | monat) die Zahlen Vernetzungen versendet/angenommen (Tageszähler), Angeschrieben, Gespräch vereinbart, Im Geschäft, Verloren (Board, davor altes CRM), E-Mails gesendet und Antworten.';

revoke all on crm.v_board_zaehlung, crm.v_kpi_tage from public, anon;
grant select on crm.v_board_zaehlung, crm.v_kpi_tage to authenticated;
