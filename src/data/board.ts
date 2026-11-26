// Board (25.11.2026, Neustart als einfaches CRM): eine Karte = ein Lead mit `board_liste`. Karten lesen, verschieben, anlegen und
// das Lead-Blatt speichern. Bewusst nicht im Barrel data/index.ts – nur Board, Lead-Blatt und Team-Seite laden diese Datei.
// Regeln (Bauplan § 3): `stage` wird weder gelesen noch geschrieben (alte Trigger hängen daran); jede Abfrage filtert `deleted_at`;
// Updates immer mit `.eq('id')` und ohne updated_at-Sperre – fremde Trigger setzen updated_at bei jeder Aktivität, das gäbe beim
// Kartenschieben falsche „hat gerade geändert“-Konflikte. Realtime invalidiert alles unter ['leads'], also auch dieses Board.
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { istBoardListe, type BoardListe } from '@/features/board/listen'
import type { Lead, LeadMitBezug, LeadUpdate, Salutation } from '@/types/domain'
import { alleSeiten, pruefe } from './_helfer'
import { BOARD_KEY, BOARD_SCHREIBEN, istBoardKey } from './boardKeys'
import { mutationFehler } from './errors'
import { qk } from './queryKeys'
import { supabase } from './supabase'

/** Was eine Karte zeigt – eine schlanke Auswahl aus dem Lead (das Board lädt bei jedem Realtime-Ereignis neu). */
export type BoardKarte = Pick<
  Lead,
  | 'id'
  | 'salutation'
  | 'first_name'
  | 'last_name'
  | 'full_name'
  | 'company_name'
  | 'linkedin_url'
  | 'owner_id'
  | 'board_seit'
> & { board_liste: BoardListe }

export { BOARD_KEY }

/**
 * 26.11.2026: Läuft außer diesem kein Schreibvorgang mehr? Nur dann darf das Board neu laden. Ein Neuladen dazwischen bringt
 * den Stand der Datenbank OHNE den noch laufenden Zug – bei zwei Zügen kurz hintereinander sprang dessen Karte kurz in die
 * alte Liste zurück. In onSettled zählt der eigene Vorgang noch als laufend, daher „höchstens einer“; der letzte lädt neu.
 */
const istLetzterSchreibvorgang = (qc: QueryClient): boolean => qc.isMutating({ mutationKey: BOARD_SCHREIBEN }) <= 1

/**
 * 26.11.2026: Der KPI-Reiter zählt aus den Board-Zügen (Sicht v_kpi_tage). Nach jedem Schreiben gelten seine Abfragen als
 * veraltet – nicht erst mit dem Realtime-Ereignis, das bei getrenntem Kanal ausbleibt. Ist der Reiter nicht offen, lädt nichts.
 */
function kpisVeraltet(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: qk.kpis.all })
}

/** Alles unter ['leads'] neu laden – das Board selbst nur, wenn kein weiterer Schreibvorgang mehr läuft. Dazu die KPIs. */
function ladeLeadsNeu(qc: QueryClient): void {
  const mitBoard = istLetzterSchreibvorgang(qc)
  void qc.invalidateQueries({
    queryKey: qk.leads.all,
    predicate: (q) => mitBoard || !istBoardKey(q.queryKey),
  })
  kpisVeraltet(qc)
}

const SPALTEN =
  'id, salutation, first_name, last_name, full_name, company_name, linkedin_url, owner_id, board_liste, board_seit'

type KartenZeile = Omit<BoardKarte, 'board_liste'> & { board_liste: string | null }

/** Zeile → Karte; `null`, wenn der Lead (nicht mehr) auf dem Board liegt. */
function alsKarte(z: KartenZeile): BoardKarte | null {
  if (!istBoardListe(z.board_liste)) return null
  return {
    id: z.id,
    salutation: z.salutation,
    first_name: z.first_name,
    last_name: z.last_name,
    full_name: z.full_name,
    company_name: z.company_name,
    linkedin_url: z.linkedin_url,
    owner_id: z.owner_id,
    board_liste: z.board_liste,
    board_seit: z.board_seit,
  }
}

const zeit = (k: BoardKarte): number => (k.board_seit ? Date.parse(k.board_seit) || 0 : 0)

/** Reihenfolge wie die Abfrage: zuletzt hineingekommen oben (`board_seit desc`), bei Gleichstand nach id. */
export function sortiereKarten(karten: readonly BoardKarte[]): BoardKarte[] {
  return [...karten].sort((a, b) => zeit(b) - zeit(a) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/** Karte im Cache ersetzen und neu einsortieren; `karte = null` nimmt sie heraus. */
function einsortiert(karten: readonly BoardKarte[], id: string, karte: BoardKarte | null): BoardKarte[] {
  const rest = karten.filter((k) => k.id !== id)
  return karte ? sortiereKarten([karte, ...rest]) : rest
}

export async function ladeBoardKarten(): Promise<BoardKarte[]> {
  return alleSeiten<BoardKarte>((von, bis) =>
    supabase
      .from('leads')
      .select(SPALTEN)
      .not('board_liste', 'is', null)
      .is('deleted_at', null)
      .order('board_seit', { ascending: false })
      .order('id', { ascending: true })
      .range(von, bis),
  )
}

/** Alle Karten des Boards, sortiert `board_seit desc, id`. Die Aufteilung auf die vier Listen macht die Oberfläche. */
export function useBoardKarten() {
  return useQuery({ queryKey: BOARD_KEY, queryFn: ladeBoardKarten })
}

export type KarteVerschieben = {
  id: string
  /** Zielliste; `null` nimmt die Karte vom Board (der Lead bleibt gespeichert). */
  liste: BoardListe | null
  /** Nur für „Rückgängig“: der alte Zeitstempel legt die Karte an ihre alte Stelle. Ohne Angabe setzt der Server „jetzt“. */
  seit?: string | null
}

/**
 * Karte in eine andere Liste legen – sofort sichtbar (optimistisch im Board-Cache), bei Fehler zurück an den alten Platz
 * mit Fehlermeldung. Zurückgerollt wird nur diese eine Karte, damit ein zweiter, schneller Zug nicht mit verschwindet.
 */
export function useKarteVerschieben() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: BOARD_SCHREIBEN,
    // 25.11.2026: offline nicht pausieren (Voreinstellung 'online') – sonst liegt die Karte sichtbar in der neuen Liste,
    // gespeichert ist nichts. So scheitert der Zug sofort: Karte zurück + Offline-Meldung.
    networkMode: 'always',
    mutationFn: async ({ id, liste, seit }: KarteVerschieben): Promise<BoardKarte | null> => {
      const patch: LeadUpdate = { board_liste: liste }
      if (liste && seit) patch.board_seit = seit
      const zeile = pruefe(
        await supabase.from('leads').update(patch).eq('id', id).is('deleted_at', null).select(SPALTEN).single(),
      )
      return alsKarte(zeile)
    },
    onMutate: async ({ id, liste, seit }) => {
      await qc.cancelQueries({ queryKey: BOARD_KEY })
      const alle = qc.getQueryData<BoardKarte[]>(BOARD_KEY)
      const vorher = alle?.find((k) => k.id === id) ?? null
      if (alle && vorher) {
        const jetzt = liste ? { ...vorher, board_liste: liste, board_seit: seit ?? new Date().toISOString() } : null
        qc.setQueryData<BoardKarte[]>(BOARD_KEY, einsortiert(alle, id, jetzt))
      }
      return { vorher }
    },
    onError: (e, { id }, ctx) => {
      const alle = qc.getQueryData<BoardKarte[]>(BOARD_KEY)
      if (alle && ctx?.vorher) qc.setQueryData<BoardKarte[]>(BOARD_KEY, einsortiert(alle, id, ctx.vorher))
      mutationFehler(e)
    },
    // Zeile vom Server übernehmen: der echte Zeitstempel zählt für die Reihenfolge und für ein späteres „Rückgängig“
    onSuccess: (karte, { id }) => {
      qc.setQueryData<BoardKarte[]>(BOARD_KEY, (alt) => (alt ? einsortiert(alt, id, karte) : alt))
    },
    onSettled: (_d, _e, { id }) => {
      if (istLetzterSchreibvorgang(qc)) void qc.invalidateQueries({ queryKey: BOARD_KEY })
      void qc.invalidateQueries({ queryKey: qk.leads.detail(id) })
      kpisVeraltet(qc)
    },
  })
}

export type KarteAnlegen = {
  vorname: string
  nachname: string
  linkedinUrl?: string | null
  /** Zugehörigkeit; ohne Angabe die angemeldete Person. */
  ownerId?: string | null
  anrede?: Salutation
}

/** Antwort von `crm.board_karte_anlegen`. `uebernommen` = Person war schon gespeichert und liegt jetzt auf dem Board. */
export type KarteAngelegt = {
  status: 'neu' | 'uebernommen' | 'schon_da'
  lead_id: string
  liste: BoardListe
  owner_id: string | null
}

/**
 * Neue Karte in „Angeschrieben“. Ohne eigenen Fehler-Toast: der Dialog zeigt den deutschen Text der Datenbank direkt am
 * Formular („Diese Person steht auf der Sperrliste“ …) – über `fehlerMeldung(e).meldung`.
 */
export function useKarteAnlegen() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: BOARD_SCHREIBEN,
    mutationFn: async (k: KarteAnlegen): Promise<KarteAngelegt> =>
      pruefe(
        await supabase.rpc('board_karte_anlegen', {
          p_vorname: k.vorname.trim() || null,
          p_nachname: k.nachname.trim() || null,
          p_linkedin_url: k.linkedinUrl?.trim() || null,
          p_owner: k.ownerId ?? undefined,
          p_anrede: k.anrede,
        }),
      ) as unknown as KarteAngelegt,
    // Karte sofort oben einsortieren; das Neuladen danach bringt die echte Zeile (Firma und Notiz eines übernommenen Leads)
    onSuccess: (r, k) => {
      if (r.status === 'schon_da' || !istBoardListe(r.liste)) return
      const vorname = k.vorname.trim() || null
      const nachname = k.nachname.trim() || null
      const karte: BoardKarte = {
        id: r.lead_id,
        salutation: k.anrede ?? 'neutral',
        first_name: vorname,
        last_name: nachname,
        full_name: [vorname, nachname].filter(Boolean).join(' ') || null,
        company_name: null,
        linkedin_url: k.linkedinUrl?.trim() || null,
        owner_id: r.owner_id,
        board_liste: r.liste,
        board_seit: new Date().toISOString(),
      }
      qc.setQueryData<BoardKarte[]>(BOARD_KEY, (alt) => (alt ? einsortiert(alt, karte.id, karte) : alt))
    },
    onSettled: () => ladeLeadsNeu(qc),
  })
}

/** Felder, die das Lead-Blatt schreibt. Eng gehalten: nie eine ganze Lead-Zeile spreizen (generierte Spalten, `stage`). */
export type KartePatch = Pick<
  LeadUpdate,
  | 'first_name'
  | 'last_name'
  | 'salutation'
  | 'company_name'
  | 'linkedin_url'
  | 'owner_id'
  | 'notes'
  | 'board_liste'
  | 'board_seit'
>

/** Lead-Blatt speichern: einfaches Update ohne updated_at-Sperre (der letzte Stand gewinnt). */
export function useKarteSpeichern() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: BOARD_SCHREIBEN,
    mutationFn: async ({ id, patch }: { id: string; patch: KartePatch }): Promise<Lead> =>
      pruefe(await supabase.from('leads').update(patch).eq('id', id).is('deleted_at', null).select('*').single()),
    onError: mutationFehler,
    onSuccess: (lead) => {
      qc.setQueryData<LeadMitBezug>(qk.leads.detail(lead.id), (alt) => (alt ? { ...alt, ...lead } : alt))
      qc.setQueryData<BoardKarte[]>(BOARD_KEY, (alt) => (alt ? einsortiert(alt, lead.id, alsKarte(lead)) : alt))
    },
    onSettled: () => ladeLeadsNeu(qc),
  })
}
