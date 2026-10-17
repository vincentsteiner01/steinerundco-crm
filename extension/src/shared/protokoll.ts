// Typisiertes Nachrichtenprotokoll Oberfläche (Popup, Seitenleiste, Optionen) → Service Worker.
// Nur der Service Worker spricht mit Supabase; Seiten schicken { typ, …Felder } und bekommen { ok, daten } | { ok: false, fehler }.
import type {
  Angelegt,
  AntwortLabel,
  EingangEinstellungen,
  EingangListe,
  Erledigt,
  HeuteZahlen,
  LeadAnsicht,
  LeadEntwurf,
  PersonId,
  Rueckgabe,
  Sitzung,
  SuchErgebnis,
  VerlaufCursor,
  VerlaufSeite,
} from './typen'

export type Anfragen = {
  sitzung: { req: Record<never, never>; res: Sitzung }
  anmelden: { req: { person: PersonId; passcode: string; bleiben: boolean }; res: Sitzung }
  abmelden: { req: Record<never, never>; res: Sitzung }
  heute: { req: Record<never, never>; res: HeuteZahlen }
  suchen: { req: { norm: string | null; name: string | null }; res: SuchErgebnis }
  lead: { req: { leadId: string }; res: LeadAnsicht }
  verlauf: { req: { leadId: string; vor: VerlaufCursor | null }; res: VerlaufSeite }
  anlegen: { req: { entwurf: LeadEntwurf; anfrageGesendet: boolean }; res: Angelegt }
  verknuepfen: { req: { leadId: string; profilUrl: string }; res: Erledigt }
  schrittGesendet: {
    req: { leadId: string; enrollmentId: string; schrittId: string | null; templateId: string | null }
    res: Erledigt
  }
  antwortGesendet: { req: { leadId: string; templateId: string | null }; res: Erledigt }
  angenommen: { req: { leadId: string }; res: Erledigt }
  anfrageGesendet: { req: { leadId: string }; res: Erledigt }
  antwortErhalten: { req: { leadId: string; label: AntwortLabel; zitat: string | null }; res: Erledigt }
  notiz: { req: { leadId: string; text: string }; res: Erledigt }
  rueckgaengig: { req: Rueckgabe; res: Erledigt }
  eingang: { req: Record<never, never>; res: EingangListe }
  eingangZuordnen: { req: { id: string; leadId: string }; res: { text: string } }
  eingangIgnorieren: { req: { id: string }; res: { text: string } }
  eingangEinstellungen: { req: Record<never, never>; res: EingangEinstellungen }
  eingangProfil: { req: { profilUrl: string | null }; res: EingangEinstellungen }
  eingangSchluessel: { req: { aktion: 'erzeugen' | 'widerrufen' }; res: { schluessel: string | null; einstellungen: EingangEinstellungen } }
}

export type Typ = keyof Anfragen
export type Req<K extends Typ> = Anfragen[K]['req']
export type Res<K extends Typ> = Anfragen[K]['res']

export type Nachricht = { [K in Typ]: { typ: K } & Req<K> }[Typ]
export type NachrichtVon<K extends Typ> = Extract<Nachricht, { typ: K }>

export type Antwort<K extends Typ = Typ> = { ok: true; daten: Res<K> } | { ok: false; fehler: string }

export const TYPEN: readonly Typ[] = [
  'sitzung',
  'anmelden',
  'abmelden',
  'heute',
  'suchen',
  'lead',
  'verlauf',
  'anlegen',
  'verknuepfen',
  'schrittGesendet',
  'antwortGesendet',
  'angenommen',
  'anfrageGesendet',
  'antwortErhalten',
  'notiz',
  'rueckgaengig',
  'eingang',
  'eingangZuordnen',
  'eingangIgnorieren',
  'eingangEinstellungen',
  'eingangProfil',
  'eingangSchluessel',
]

export function istNachricht(x: unknown): x is Nachricht {
  return !!x && typeof x === 'object' && TYPEN.includes((x as { typ?: unknown }).typ as Typ)
}

/** Ereignis Service Worker → offene Seiten (Anmeldung geändert). */
export type Ereignis = { ereignis: 'sitzung' }
export function istEreignis(x: unknown): x is Ereignis {
  return !!x && typeof x === 'object' && (x as { ereignis?: unknown }).ereignis === 'sitzung'
}
