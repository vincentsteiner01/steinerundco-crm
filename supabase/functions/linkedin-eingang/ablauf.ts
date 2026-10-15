// Ablauf der Edge Function linkedin-eingang ohne Netz: Mails prüfen → Zeilen bauen → anlegen → offene Zeilen verbuchen.
// Die Datenbank kommt als kleine Schnittstelle herein (index.ts: Supabase-Client; ablauf_test.ts: Attrappe).
import { eigeneSlugsSchaetzen, type EingangZeile, type Mail, parseMail, zeileBauen } from './parser.ts'

export type Zaehler = { neu: number; doppelt: number; verarbeitet: number; unbekannt: number; ignoriert: number; offen: number; fehler: number }

type DbErgebnis<T> = { data: T | null; error: { message: string } | null }

export interface EingangDb {
  /** Eigenes LinkedIn-Profil (member_profiles.linkedin_url) und Namen des Mitglieds (Anzeige-/Kurzname) */
  profil(memberId: string): Promise<{ linkedinUrl: string | null; namen: string[] }>
  /** upsert … on conflict (quelle, external_id) do nothing – liefert nur die neu angelegten Zeilen */
  anlegen(zeilen: EingangZeile[]): Promise<DbErgebnis<{ id: string; status: string }[]>>
  /** Zeilen dieses Mitglieds zu den Message-IDs, die noch im Status „neu“ stehen */
  offene(memberId: string, externalIds: string[]): Promise<DbErgebnis<{ id: string; art: string; ergebnis: string | null }[]>>
  /** crm.eingang_verarbeiten(p_id) */
  verarbeiten(id: string): Promise<DbErgebnis<{ status: string }>>
  /** crm.eingang_aufraeumen() – Löschfrist für ignorierte Einträge */
  aufraeumen(): Promise<DbErgebnis<number>>
}

export class SpeicherFehler extends Error {}

const str = (v: unknown, max: number): string | null => (typeof v === 'string' && v.length <= max ? v : null)

/** Eine Mail aus dem Body prüfen; null = ungültig (wird als Fehler gezählt). */
export function mailPruefen(x: unknown): Mail | null {
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  const id = str(o.id, 200)
  if (!id || !/^[A-Za-z0-9_.:@<>-]{1,200}$/.test(id)) return null
  const links = Array.isArray(o.links) ? o.links.filter((l): l is string => typeof l === 'string' && l.length <= 2000).slice(0, 20) : []
  return {
    id,
    datum: str(o.datum, 64) ?? '',
    betreff: str(o.betreff, 1000) ?? '',
    von: str(o.von, 500) ?? '',
    text: (typeof o.text === 'string' ? o.text : '').slice(0, 10000),
    links,
    dmarc: str(o.dmarc, 10) ?? '',
  }
}

const log = { fehler: (...x: unknown[]) => console.error(...x) }

export async function ablauf(db: EingangDb, memberId: string, liste: unknown[], jetzt = new Date()): Promise<Zaehler> {
  const zaehler: Zaehler = { neu: 0, doppelt: 0, verarbeitet: 0, unbekannt: 0, ignoriert: 0, offen: 0, fehler: 0 }

  const gesehen = new Set<string>()
  const mails: Mail[] = []
  for (const x of liste) {
    const mail = mailPruefen(x)
    if (!mail) { zaehler.fehler++; continue }
    if (gesehen.has(mail.id)) { zaehler.doppelt++; continue }
    gesehen.add(mail.id)
    mails.push(mail)
  }
  if (mails.length === 0) return zaehler

  // Eigenes Profil ausschließen: Kopf und Fuß jeder LinkedIn-Mail verlinken den Empfänger
  const profil = await db.profil(memberId)
  const eigenerSlug = /linkedin\.com\/in\/([^/?#]+)/i.exec(profil.linkedinUrl ?? '')?.[1]?.toLowerCase() ?? null
  const eigeneSlugs = eigeneSlugsSchaetzen(mails)
  const zeilen = mails.map((m) => zeileBauen(m, parseMail(m, { eigenerSlug, eigeneSlugs, eigeneNamen: profil.namen }), memberId, jetzt))

  // Anlegen; schon bekannte Message-IDs überspringt die Datenbank (unique quelle + external_id)
  const neu = await db.anlegen(zeilen)
  if (neu.error) {
    log.fehler('Eingang anlegen fehlgeschlagen', neu.error.message)
    throw new SpeicherFehler('Eingang konnte nicht gespeichert werden')
  }
  zaehler.neu = neu.data?.length ?? 0
  zaehler.doppelt += zeilen.length - zaehler.neu
  for (const z of neu.data ?? []) if (z.status === 'ignoriert') zaehler.ignoriert++

  // Verbuchen: alle Zeilen dieses Aufrufs, die noch „neu“ sind – auch die eines früheren Aufrufs, der nach dem Anlegen
  // abbrach (sonst blieben sie als „doppelt“ für immer liegen). Einladungen von Leads bleiben gewollt „neu“ und werden nur
  // verbucht, solange sie noch kein Ergebnis haben. eingang_verarbeiten ist idempotent.
  const offen = await db.offene(memberId, zeilen.map((z) => z.external_id))
  let ids: string[]
  if (offen.error) {
    log.fehler('Offene Eingänge laden fehlgeschlagen', offen.error.message)
    ids = (neu.data ?? []).filter((z) => z.status === 'neu').map((z) => z.id)
  } else {
    ids = (offen.data ?? []).filter((z) => z.art === 'annahme' || z.art === 'nachricht' || z.ergebnis === null).map((z) => z.id)
  }
  for (const id of ids) {
    const { data: e, error } = await db.verarbeiten(id)
    if (error || !e) {
      log.fehler('Verarbeiten fehlgeschlagen', id, error?.message)
      zaehler.fehler++
      continue
    }
    if (e.status === 'verarbeitet') zaehler.verarbeitet++
    else if (e.status === 'unbekannt') zaehler.unbekannt++
    else if (e.status === 'ignoriert') zaehler.ignoriert++
    else if (e.status === 'neu') zaehler.offen++
    else zaehler.fehler++
  }

  // Löschfrist (ignorierte Einträge nach 30 Tagen) – Fehler hier halten nichts auf
  const auf = await db.aufraeumen()
  if (auf.error) log.fehler('Aufräumen fehlgeschlagen', auf.error.message)
  return zaehler
}
