-- Neustart als einfaches Board (25.11.2026, Vincent und Mike: „das ganze CRM archivieren und von vorne anfangen … viel zu
-- kompliziert … es soll so aussehen wie Trello“; „archiviere das CRM, aber lösche nichts“; „die neue Pipeline wird von 0 an
-- gestartet, die alten Leads bitte separat lassen“).
--
-- 1) Archiv: eingefrorene Kopie ALLER Tabellen des Schemas crm im Schema crm_archiv (Stand: Zeitpunkt dieser Migration).
--    Nichts wird gelöscht oder umgebaut – alle bisherigen Tabellen, Stufen, Sequenzen, Aufgaben und Aktivitäten bleiben, wie sie sind.
--    Der zugehörige Code liegt im Git-Tag archiv-crm-v1.
-- 2) Board: zwei neue Spalten an crm.leads. board_liste = null heißt „nicht auf dem Board“ – das gilt für alle bisherigen Leads
--    (das Board startet leer). Die alte Spalte stage wird vom Board weder gelesen noch geschrieben: eingehende Mails heben sie
--    weiter automatisch an (activities_after_insert), und „beendet“/„kunde“ hätten Nebenwirkungen auf alte Sequenzen und Aufgaben.
-- 3) Karte anlegen: crm.board_karte_anlegen. Die LinkedIn-URL ist eindeutig (leads_linkedin_norm_uidx, auch für alte Leads und den
--    Papierkorb) – steht die Person schon in der Datenbank, kommt dieser Lead aufs Board, statt dass das Anlegen scheitert.
-- 4) Leitfäden: crm.templates.archiviert_at. Alle bisherigen Vorlagen gelten als archiviert; die neue Leitfäden-Seite zeigt nur
--    neue. active, key, channel und phase bleiben unberührt – der E-Mail-Composer findet seine Vorlagen weiter.

-- -----------------------------------------------------------------------------------------------------
-- 1. Archiv-Kopie (vor allen Änderungen dieser Migration)
-- -----------------------------------------------------------------------------------------------------
create schema if not exists crm_archiv;
comment on schema crm_archiv is
  'Eingefrorene Kopie aller crm-Tabellen vom 25.11.2026, unmittelbar vor dem Neustart als einfaches Board. Nur zum Nachschlagen; die App liest und schreibt hier nicht.';
revoke all on schema crm_archiv from public, anon, authenticated;

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'crm' order by tablename loop
    if to_regclass(format('crm_archiv.%I', t)) is null then
      execute format('create table crm_archiv.%I as table crm.%I', t, t);
      execute format('alter table crm_archiv.%I enable row level security', t);
      execute format('revoke all on crm_archiv.%I from public, anon, authenticated', t);
      execute format('comment on table crm_archiv.%I is %L', t,
        'Archiv-Kopie von crm.' || t || ' vom ' || to_char(now() at time zone 'Europe/Berlin', 'DD.MM.YYYY HH24:MI') || ' (vor dem Neustart als Board)');
    end if;
  end loop;
end
$$;

-- -----------------------------------------------------------------------------------------------------
-- 2. Board-Spalten an crm.leads
-- -----------------------------------------------------------------------------------------------------
alter table crm.leads add column if not exists board_liste text;
alter table crm.leads add column if not exists board_seit timestamptz;
do $$
begin
  alter table crm.leads add constraint leads_board_liste_check
    check (board_liste is null or board_liste in ('angeschrieben', 'gespraech', 'im_geschaeft', 'verloren'));
exception when duplicate_object then null;
end
$$;
comment on column crm.leads.board_liste is
  'Liste auf dem Board: angeschrieben · gespraech (Gespräch vereinbart) · im_geschaeft · verloren. null = nicht auf dem Board (alle Leads von vor dem 25.11.2026).';
comment on column crm.leads.board_seit is
  'Seit wann die Karte in ihrer Liste liegt (Sortierung: neueste oben). Setzt der Trigger leads_board_before_write.';
create index if not exists leads_board_idx on crm.leads (board_liste, board_seit desc) where board_liste is not null and deleted_at is null;

-- Zeitstempel setzt der Server: bei jedem Listenwechsel jetzt – außer der Aufrufer gibt board_seit selbst mit (Rückgängig legt
-- die Karte an ihre alte Stelle zurück).
create or replace function crm.leads_board_before_write() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.board_seit := case when new.board_liste is null then null else coalesce(new.board_seit, now()) end;
  elsif new.board_liste is null then
    new.board_seit := null;
  elsif new.board_liste is distinct from old.board_liste and (new.board_seit is null or new.board_seit is not distinct from old.board_seit) then
    new.board_seit := now();
  end if;
  return new;
end;
$$;
drop trigger if exists leads_board_before_write on crm.leads;
create trigger leads_board_before_write before insert or update of board_liste, board_seit on crm.leads
  for each row execute function crm.leads_board_before_write();

-- -----------------------------------------------------------------------------------------------------
-- 3. Karte anlegen (läuft mit den Rechten der angemeldeten Person – RLS gilt)
-- -----------------------------------------------------------------------------------------------------
create or replace function crm.board_karte_anlegen(
  p_vorname text, p_nachname text, p_linkedin_url text default null, p_owner uuid default null,
  p_anrede crm.salutation default 'neutral'
) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_vor text := nullif(btrim(coalesce(p_vorname, '')), '');
  v_nach text := nullif(btrim(coalesce(p_nachname, '')), '');
  v_url text := nullif(btrim(coalesce(p_linkedin_url, '')), '');
  v_norm text;
  v_owner uuid;
  v_anrede crm.salutation := coalesce(p_anrede, 'neutral');
  l crm.leads;
begin
  if v_me is null or not private.is_member() then raise exception 'Nur für angemeldete Mitglieder'; end if;
  if v_vor is null and v_nach is null then raise exception 'Bitte einen Namen eingeben'; end if;
  v_norm := crm.normalize_linkedin_url(v_url);
  if v_url is not null and v_norm is null then
    raise exception 'Das ist kein LinkedIn-Profil-Link – er muss linkedin.com/in/… enthalten';
  end if;
  v_owner := coalesce(p_owner, v_me);
  if not exists (select 1 from public.members m where m.user_id = v_owner) then raise exception 'Unbekannte Person'; end if;
  if v_norm is not null and crm.is_blocked(v_norm, null, null) then
    raise exception 'Diese Person steht auf der Sperrliste';
  end if;

  if v_norm is not null then
    select * into l from crm.leads where linkedin_url_norm = v_norm for update;
    if found then
      if l.do_not_contact then raise exception 'Diese Person hat der Kontaktaufnahme widersprochen'; end if;
      if l.board_liste is not null and l.deleted_at is null then
        return jsonb_build_object('status', 'schon_da', 'lead_id', l.id, 'liste', l.board_liste, 'owner_id', l.owner_id);
      end if;
      -- schon gespeichert (alter Lead oder entfernte Karte): kommt aufs Board, Verlauf und alte Felder bleiben
      update crm.leads
         set board_liste = 'angeschrieben', deleted_at = null, owner_id = v_owner,
             first_name = coalesce(v_vor, first_name), last_name = coalesce(v_nach, last_name),
             salutation = case when v_anrede <> 'neutral' then v_anrede else salutation end
       where id = l.id
      returning * into l;
      return jsonb_build_object('status', 'uebernommen', 'lead_id', l.id, 'liste', l.board_liste, 'owner_id', l.owner_id);
    end if;
  end if;

  insert into crm.leads (first_name, last_name, salutation, linkedin_url, owner_id, created_by, board_liste)
  values (v_vor, v_nach, v_anrede, v_url, v_owner, v_me, 'angeschrieben')
  returning * into l;
  return jsonb_build_object('status', 'neu', 'lead_id', l.id, 'liste', l.board_liste, 'owner_id', l.owner_id);
end;
$$;
comment on function crm.board_karte_anlegen(text, text, text, uuid, crm.salutation) is
  'Board: neue Karte in „Angeschrieben“. Rückgabe {status: neu | uebernommen (Person war schon gespeichert) | schon_da (liegt schon auf dem Board), lead_id, liste, owner_id}.';
revoke all on function crm.board_karte_anlegen(text, text, text, uuid, crm.salutation) from public, anon;
grant execute on function crm.board_karte_anlegen(text, text, text, uuid, crm.salutation) to authenticated, service_role;

-- -----------------------------------------------------------------------------------------------------
-- 4. Leitfäden: bisherige Vorlagen als archiviert markieren (nur beim ersten Lauf)
-- -----------------------------------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'crm' and table_name = 'templates' and column_name = 'archiviert_at') then
    alter table crm.templates add column archiviert_at timestamptz;
    update crm.templates set archiviert_at = now();
  end if;
end
$$;
comment on column crm.templates.archiviert_at is
  'Gesetzt = Leitfaden ist archiviert und steht nicht mehr auf der Leitfäden-Seite (alle Vorlagen von vor dem 25.11.2026; „Löschen“ auf der neuen Seite). active/key bleiben unberührt – der E-Mail-Composer wählt weiter über channel und active.';
