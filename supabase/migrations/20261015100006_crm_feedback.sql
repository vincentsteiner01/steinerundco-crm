-- =====================================================================================================
-- CRM Steiner & Co. · Migration 6 · Feedback (Fehler · Wunsch · Frage aus der App an Claude), idempotent, rein additiv.
-- Stand: 2026-10-15
--
-- Vincent meldet Probleme direkt aus der App (Knopf „Feedback“ / ⌥F): Beschreibung, Art, automatischer Screenshot, Kontext
-- (Seite, Breite, Browser, Version, letzte Konsolen-Fehler). Claude liest die Meldungen mit tools/feedback.sh und antwortet
-- dort (Status + Antwort); die App zeigt Status und Antwort live unter /feedback.
--
-- Konventionen wie Migration 1: Schema crm, RLS ausschließlich über private.is_member(), deutsche Kommentare,
-- set search_path = '' in Funktionen. Nichts Bestehendes wird verändert oder gelöscht.
--   · Tabelle crm.feedback (Mitglieder lesen, legen an, bearbeiten – kein Löschen)
--   · Trigger: updated_at, antwort_at / notiz_at automatisch
--   · Realtime-Publikation supabase_realtime
--   · Storage-Bucket „crm-feedback“ (privat, PNG/JPEG/WebP, ≤ 5 MB) mit Lese- und Upload-Policy für Mitglieder
-- =====================================================================================================

-- -----------------------------------------------------------------------------------------------------
-- 1. Tabelle
-- -----------------------------------------------------------------------------------------------------
create table if not exists crm.feedback (
  id              uuid primary key default gen_random_uuid(),
  member_id       uuid default auth.uid() references auth.users (id) on delete set null,
  art             text not null default 'fehler' check (art in ('fehler', 'wunsch', 'frage')),
  titel           text check (titel is null or char_length(titel) <= 200),
  beschreibung    text not null check (char_length(btrim(beschreibung)) between 1 and 20000),
  route           text,
  url             text,
  viewport        text,
  user_agent      text,
  app_version     text,
  konsole         jsonb not null default '[]'::jsonb check (jsonb_typeof(konsole) = 'array'),
  screenshot_path text,
  status          text not null default 'neu' check (status in ('neu', 'in_arbeit', 'erledigt', 'abgelehnt')),
  antwort         text,
  antwort_at      timestamptz,
  notiz           text,
  notiz_at        timestamptz,
  notiz_von       uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table crm.feedback is 'Feedback aus der App (Fehler · Wunsch · Frage) mit Screenshot-Pfad und Kontext; Claude antwortet über tools/feedback.sh.';
comment on column crm.feedback.member_id is 'Wer gemeldet hat (auth.uid() beim Anlegen).';
comment on column crm.feedback.art is 'fehler · wunsch · frage';
comment on column crm.feedback.route is 'Pfad + Query der Seite beim Melden, z. B. /pipeline?lead=…';
comment on column crm.feedback.viewport is 'Fensterbreite × -höhe in CSS-Pixeln, z. B. 1440×900 @2x';
comment on column crm.feedback.konsole is 'Letzte Konsolen-Fehler/-Warnungen (max. 30, ohne Tokens): [{zeit, art, text}]';
comment on column crm.feedback.screenshot_path is 'Objektpfad im privaten Bucket crm-feedback (<feedback-id>.png); null = ohne Bild.';
comment on column crm.feedback.status is 'neu · in_arbeit · erledigt · abgelehnt';
comment on column crm.feedback.antwort is 'Antwort von Claude (tools/feedback.sh status …); antwort_at setzt der Trigger.';
comment on column crm.feedback.notiz is 'Notiz eines Mitglieds (Nachtrag, Rückfrage); notiz_at/notiz_von setzt der Trigger.';

create index if not exists feedback_status_created_idx on crm.feedback (status, created_at desc);
create index if not exists feedback_created_idx on crm.feedback (created_at desc);

-- -----------------------------------------------------------------------------------------------------
-- 2. Trigger: updated_at · antwort_at · notiz_at/notiz_von · member_id beim Anlegen
-- -----------------------------------------------------------------------------------------------------
create or replace function crm.feedback_before_write() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.member_id := coalesce(new.member_id, auth.uid());
    if new.antwort is not null then new.antwort_at := coalesce(new.antwort_at, now()); end if;
    if new.notiz is not null then new.notiz_at := coalesce(new.notiz_at, now()); new.notiz_von := coalesce(new.notiz_von, auth.uid()); end if;
    return new;
  end if;
  -- Anlegende Person und Zeitpunkt bleiben fest
  new.member_id := old.member_id;
  new.created_at := old.created_at;
  if new.antwort is distinct from old.antwort then
    new.antwort_at := case when nullif(btrim(new.antwort), '') is null then null else now() end;
  end if;
  if new.notiz is distinct from old.notiz then
    new.notiz_at := case when nullif(btrim(new.notiz), '') is null then null else now() end;
    new.notiz_von := auth.uid();
  end if;
  return new;
end;
$$;
comment on function crm.feedback_before_write() is 'Feedback: member_id beim Anlegen, antwort_at/notiz_at bei Änderung; member_id und created_at bleiben fest.';

create or replace trigger feedback_before_write before insert or update on crm.feedback
  for each row execute function crm.feedback_before_write();
create or replace trigger feedback_set_updated_at before update on crm.feedback
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------------------------------
-- 3. RLS: Mitglieder lesen, legen an (nur als sie selbst), bearbeiten – kein Löschen
-- -----------------------------------------------------------------------------------------------------
alter table crm.feedback enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'crm' and tablename = 'feedback' and policyname = 'Mitglieder lesen feedback') then
    create policy "Mitglieder lesen feedback" on crm.feedback
      for select to authenticated using ((select private.is_member()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'crm' and tablename = 'feedback' and policyname = 'Mitglieder legen feedback an') then
    create policy "Mitglieder legen feedback an" on crm.feedback
      for insert to authenticated with check ((select private.is_member()) and member_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'crm' and tablename = 'feedback' and policyname = 'Mitglieder bearbeiten feedback') then
    create policy "Mitglieder bearbeiten feedback" on crm.feedback
      for update to authenticated using ((select private.is_member())) with check ((select private.is_member()));
  end if;
end
$$;

revoke all on crm.feedback from public, anon;
grant select, insert, update on crm.feedback to authenticated;
revoke delete, truncate on crm.feedback from authenticated;
grant all on crm.feedback to service_role;
revoke all on function crm.feedback_before_write() from public, anon;

-- -----------------------------------------------------------------------------------------------------
-- 4. Realtime: Status und Antworten erscheinen live (Liste /feedback, Toast „Claude hat geantwortet“)
-- -----------------------------------------------------------------------------------------------------
do $$
begin
  alter table crm.feedback replica identity full;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'crm' and tablename = 'feedback') then
    alter publication supabase_realtime add table crm.feedback;
  end if;
end
$$;

-- -----------------------------------------------------------------------------------------------------
-- 5. Storage: privater Bucket „crm-feedback“ (Screenshots), Mitglieder lesen und laden hoch – kein Überschreiben, kein Löschen
-- -----------------------------------------------------------------------------------------------------
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage.buckets fehlt – Bucket crm-feedback nicht angelegt (kein Supabase-Projekt)';
    return;
  end if;
  if not exists (select 1 from storage.buckets where id = 'crm-feedback') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('crm-feedback', 'crm-feedback', false, 5242880, array['image/png', 'image/jpeg', 'image/webp']);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'crm-feedback: Mitglieder lesen') then
    create policy "crm-feedback: Mitglieder lesen" on storage.objects
      for select to authenticated using (bucket_id = 'crm-feedback' and (select private.is_member()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'crm-feedback: Mitglieder laden hoch') then
    create policy "crm-feedback: Mitglieder laden hoch" on storage.objects
      for insert to authenticated with check (bucket_id = 'crm-feedback' and (select private.is_member()));
  end if;
end
$$;
