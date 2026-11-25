// Formular-Logik des Lead-Blatts (25.11.2026): Startwerte aus dem Lead, Prüfung und der Patch fürs Speichern.
// Gespeichert wird nur, was die Person geändert hat (Vergleich mit dem Stand beim Öffnen) – ändert die andere Person
// inzwischen die Notiz, überschreibt ein Speichern der Zugehörigkeit sie nicht.
import type { KartePatch } from '@/data/board'
import { normalizeLinkedinUrl } from '@/lib/url'
import type { Lead, Salutation } from '@/types/domain'
import { istBoardListe, type BoardListe } from './listen'

export type BlattWerte = {
  first_name: string
  last_name: string
  salutation: Salutation
  company_name: string
  linkedin_url: string
  owner_id: string | null
  /** `null` = liegt nicht auf dem Board (alle Leads von vor dem Neustart). */
  board_liste: BoardListe | null
  notes: string
}

type BlattLead = Pick<
  Lead,
  'first_name' | 'last_name' | 'salutation' | 'company_name' | 'linkedin_url' | 'owner_id' | 'board_liste' | 'notes'
>

export function blattWerte(lead: BlattLead): BlattWerte {
  return {
    first_name: lead.first_name ?? '',
    last_name: lead.last_name ?? '',
    salutation: lead.salutation,
    company_name: lead.company_name ?? '',
    linkedin_url: lead.linkedin_url ?? '',
    owner_id: lead.owner_id,
    board_liste: istBoardListe(lead.board_liste) ? lead.board_liste : null,
    notes: lead.notes ?? '',
  }
}

const text = (s: string): string | null => s.trim() || null

export type BlattFehler = { name?: string; link?: string }

/** Wortlaut wie in der Datenbank (crm.board_karte_anlegen), damit Anlegen und Bearbeiten gleich klingen. */
export function pruefeBlatt(basis: BlattWerte, w: BlattWerte): BlattFehler {
  const fehler: BlattFehler = {}
  if (!text(w.first_name) && !text(w.last_name) && !text(w.linkedin_url)) fehler.name = 'Bitte einen Namen eingeben'
  const link = text(w.linkedin_url)
  // Nur ein geänderter Link wird geprüft: alte Leads tragen teils Firmen- oder Sales-Navigator-Links, die bleiben dürfen
  if (link && link !== text(basis.linkedin_url) && !normalizeLinkedinUrl(link))
    fehler.link = 'Das ist kein LinkedIn-Profil-Link – er muss linkedin.com/in/… enthalten'
  return fehler
}

/** Nur die geänderten Felder. Leere Texte werden `null`. Ein Listenwechsel setzt `board_seit` auf dem Server neu. */
export function blattPatch(basis: BlattWerte, w: BlattWerte): KartePatch {
  const p: KartePatch = {}
  if (text(w.first_name) !== text(basis.first_name)) p.first_name = text(w.first_name)
  if (text(w.last_name) !== text(basis.last_name)) p.last_name = text(w.last_name)
  if (w.salutation !== basis.salutation) p.salutation = w.salutation
  if (text(w.company_name) !== text(basis.company_name)) p.company_name = text(w.company_name)
  if (text(w.linkedin_url) !== text(basis.linkedin_url)) p.linkedin_url = text(w.linkedin_url)
  if (w.owner_id !== basis.owner_id) p.owner_id = w.owner_id
  if (w.board_liste !== basis.board_liste) p.board_liste = w.board_liste
  if (text(w.notes) !== text(basis.notes)) p.notes = text(w.notes)
  return p
}
