// Ein-Klick-Lader für Exporte (BAUPLAN § 3.9 Export.tsx): alle Zeilen einer Tabelle, Seiten à 500 (E18).
// Seit dem Neustart (25.11.2026) nur noch Leads und E-Mails – mehr bietet Einstellungen › Export nicht an.
import type { Email, Lead } from '@/types/domain'
import { alleSeiten } from './_helfer'
import { supabase } from './supabase'

/** CSV „Leads“: Ansicht „Alle“ ohne Papierkorb. */
export const ladeLeadsAlle = (): Promise<Lead[]> =>
  alleSeiten<Lead>((v, b) => supabase.from('leads').select('*').is('deleted_at', null).order('created_at').range(v, b))

export const ladeEmailsAlle = (): Promise<Email[]> =>
  alleSeiten<Email>((v, b) => supabase.from('emails').select('*').order('created_at').range(v, b))
