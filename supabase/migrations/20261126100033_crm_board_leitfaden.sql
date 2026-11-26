-- Board: beim Anlegen einer Karte festhalten, welcher Leitfaden benutzt wurde (26.11.2026, Vincent: „Wichtig ist noch, dass
-- wir bei dem Anlegen einer Karte noch anklicken können, welchen Leitfaden wir benutzt haben“). Mike testet seit 25.11. drei
-- Gesprächsöffnungen – so lässt sich später sagen, welche wie viele Gespräche bringt.
--
-- crm.leads.board_leitfaden_id: der Leitfaden der Karte (freiwillig; im Lead-Blatt änderbar). Wird ein Leitfaden auf der
-- Leitfäden-Seite „gelöscht“, ist er nur archiviert – der Verweis bleibt. crm.board_karte_anlegen bekommt den Parameter
-- p_leitfaden. Die alte Fassung mit fünf Parametern muss dafür weg: zwei Fassungen nebeneinander könnte die API nicht mehr
-- unterscheiden. Ein Aufruf ohne p_leitfaden (ältere, noch offene App-Fenster) trifft die neue Fassung mit ihrem Standardwert.

alter table crm.leads add column if not exists board_leitfaden_id uuid references crm.templates (id) on delete set null;
comment on column crm.leads.board_leitfaden_id is
  'Board: der Leitfaden, mit dem die Person angeschrieben wurde (Auswahl in „Lead hinzufügen“, änderbar im Lead-Blatt). null = nicht angegeben.';
create index if not exists leads_board_leitfaden_idx on crm.leads (board_leitfaden_id) where board_leitfaden_id is not null;

drop function if exists crm.board_karte_anlegen(text, text, text, uuid, crm.salutation);

create or replace function crm.board_karte_anlegen(
  p_vorname text, p_nachname text, p_linkedin_url text default null, p_owner uuid default null,
  p_anrede crm.salutation default 'neutral', p_leitfaden uuid default null
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
  if p_leitfaden is not null and not exists (select 1 from crm.templates t where t.id = p_leitfaden) then
    raise exception 'Diesen Leitfaden gibt es nicht mehr';
  end if;
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
             salutation = case when v_anrede <> 'neutral' then v_anrede else salutation end,
             board_leitfaden_id = coalesce(p_leitfaden, board_leitfaden_id)
       where id = l.id
      returning * into l;
      return jsonb_build_object('status', 'uebernommen', 'lead_id', l.id, 'liste', l.board_liste, 'owner_id', l.owner_id);
    end if;
  end if;

  insert into crm.leads (first_name, last_name, salutation, linkedin_url, owner_id, created_by, board_liste, board_leitfaden_id)
  values (v_vor, v_nach, v_anrede, v_url, v_owner, v_me, 'angeschrieben', p_leitfaden)
  returning * into l;
  return jsonb_build_object('status', 'neu', 'lead_id', l.id, 'liste', l.board_liste, 'owner_id', l.owner_id);
end;
$$;
comment on function crm.board_karte_anlegen(text, text, text, uuid, crm.salutation, uuid) is
  'Board: neue Karte in „Angeschrieben“, auf Wunsch mit dem benutzten Leitfaden. Rückgabe {status: neu | uebernommen (Person war schon gespeichert) | schon_da (liegt schon auf dem Board), lead_id, liste, owner_id}.';
revoke all on function crm.board_karte_anlegen(text, text, text, uuid, crm.salutation, uuid) from public, anon;
grant execute on function crm.board_karte_anlegen(text, text, text, uuid, crm.salutation, uuid) to authenticated, service_role;
