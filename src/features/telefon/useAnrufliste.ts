// M3 – Daten der Anrufliste (BAUPLAN § 3.4 useAnrufliste.ts): useLeadsUnendlich (Zuständigkeit), useTasksFaellig(me),
// Telefon-Enrollments, Sperrliste, Firmen (Firmensperre), Settings → `anrufliste()`.
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useLetzteAnrufe } from '@/data/calls'
import { useCompanies } from '@/data/companies'
import { useEnrollmentsKanal } from '@/data/enrollments'
import { useLeadsUnendlich } from '@/data/leads'
import { useMeId } from '@/data/members'
import { useSettings } from '@/data/settings'
import { useSperrliste } from '@/data/sperrliste'
import { useRueckrufeOffen, useTasksFaellig } from '@/data/tasks'
import { heuteBerlin } from '@/lib/format'
import type { LeadFilter } from '@/types/domain'
import { anrufliste, type Anrufliste, type ListenLead } from './anrufliste'
import { lokalLesen, lokalSchreiben } from './lokal'

export type AnruflisteOptionen = {
  /** „Anrufliste Standard“ = Zuständig ich; „Alle Zuständigen“ = beide Personen */
  zustaendig: 'me' | 'alle'
  /** Segment „Alle“: auch kommende Versuche */
  alle: boolean
}

export const ENTFERNT_KEY = 'crm.anrufliste.entfernt'
const ENTFERNT_EVENT = 'crm:anrufliste-entfernt'
type Entfernt = { tag: string; ids: string[]; gruende?: Record<string, string> }

/** Gründe für `R` (ux § 5.3: „aus der Liste entfernen (Grund-Popover, kein Versuch)“); nur lokal, nur heute. */
export const ENTFERNEN_GRUENDE: readonly { kbd: string; label: string }[] = [
  { kbd: '1', label: 'Heute kein guter Zeitpunkt' },
  { kbd: '2', label: 'Erst Nummer prüfen' },
  { kbd: '3', label: 'Lieber über einen anderen Kanal' },
  { kbd: '4', label: 'Sonstiges' },
]

let entferntCache: { schluessel: string; set: ReadonlySet<string> } = { schluessel: '', set: new Set() }

/** Heute per `R` entfernte Leads (nur dieser Tag, nur dieser Browser). Stabile Referenz bei gleichem Inhalt. */
export function entferntLesen(heute = heuteBerlin()): ReadonlySet<string> {
  const roh = lokalLesen<Entfernt>(ENTFERNT_KEY)
  const ids = roh && roh.tag === heute ? roh.ids : []
  const schluessel = `${heute}|${ids.join(',')}`
  if (schluessel !== entferntCache.schluessel) entferntCache = { schluessel, set: new Set(ids) }
  return entferntCache.set
}

export function entfernen(leadId: string, heute = heuteBerlin(), grund?: string): void {
  const alt = lokalLesen<Entfernt>(ENTFERNT_KEY)
  const aktuell = alt && alt.tag === heute
  const ids = aktuell ? alt.ids : []
  const gruende = { ...(aktuell ? (alt.gruende ?? {}) : {}) }
  if (!ids.includes(leadId)) ids.push(leadId)
  if (grund) gruende[leadId] = grund
  lokalSchreiben(ENTFERNT_KEY, { tag: heute, ids, gruende })
  window.dispatchEvent(new Event(ENTFERNT_EVENT))
}

export function entferntZuruecknehmen(leadId: string, heute = heuteBerlin()): void {
  const alt = lokalLesen<Entfernt>(ENTFERNT_KEY)
  if (!alt || alt.tag !== heute) return
  const gruende = { ...(alt.gruende ?? {}) }
  delete gruende[leadId]
  lokalSchreiben(ENTFERNT_KEY, { tag: heute, ids: alt.ids.filter((id) => id !== leadId), gruende })
  window.dispatchEvent(new Event(ENTFERNT_EVENT))
}

function abonniereEntfernt(cb: () => void): () => void {
  window.addEventListener(ENTFERNT_EVENT, cb)
  return () => window.removeEventListener(ENTFERNT_EVENT, cb)
}

export function useEntfernt(): ReadonlySet<string> {
  return useSyncExternalStore(
    abonniereEntfernt,
    () => entferntLesen(),
    () => entferntCache.set,
  )
}

export function useAnrufliste(o: AnruflisteOptionen): {
  liste: Anrufliste
  istLaden: boolean
  /** Laden gescheitert (ux § 4.3: Fehlerzeile statt „Niemand anzurufen.“) */
  fehler: unknown
  nachladen: () => void
  leadsById: Map<string, ListenLead>
  me: string | null
  jetzt: Date
} {
  const me = useMeId()
  const filter = useMemo<LeadFilter>(
    () => ({ zustaendig: o.zustaendig === 'me' ? 'me' : 'alle', sort: [{ feld: 'created_at', richtung: 'asc' }] }),
    [o.zustaendig],
  )
  const leads = useLeadsUnendlich(filter)
  const tasks = useTasksFaellig(me)
  // auch künftige Rückrufe: ein vereinbarter Rückruf hält den Lead aus der Liste (ux § 2.5 Schritt 1)
  const rueckrufe = useRueckrufeOffen(o.zustaendig === 'me' ? me : null, !!me)
  const enrollments = useEnrollmentsKanal('telefon', o.zustaendig === 'me' ? me : null, !!me)
  const sperrliste = useSperrliste()
  const companies = useCompanies()
  const { data: settings } = useSettings()
  const entfernt = useEntfernt()
  // „verpasst“ und Fälligkeit wandern mit der Uhr: alle 30 s neu bewerten
  const [jetzt, setJetzt] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setJetzt(new Date()), 30_000)
    return () => window.clearInterval(t)
  }, [])

  const leadsMitFirma = useMemo<ListenLead[]>(() => {
    const gesperrt = new Map((companies.data ?? []).map((c) => [c.id, c.do_not_contact] as const))
    // Listen tragen das Embed `companies(do_not_contact)` (M0); useCompanies bleibt Fallback für Zeilen ohne Embed
    return leads.data.map((l) =>
      !l.companies && l.company_id && gesperrt.has(l.company_id)
        ? { ...l, companies: { do_not_contact: gesperrt.get(l.company_id) ?? false } }
        : l,
    )
  }, [leads.data, companies.data])

  const alleTasks = useMemo(() => {
    const m = new Map((tasks.data ?? []).map((t) => [t.id, t] as const))
    for (const t of rueckrufe.data ?? []) m.set(t.id, t)
    return [...m.values()]
  }, [tasks.data, rueckrufe.data])
  const kandidatIds = useMemo(() => leadsMitFirma.filter((l) => !!l.phone_e164).map((l) => l.id), [leadsMitFirma])
  const letzte = useLetzteAnrufe(kandidatIds)

  const liste = useMemo(
    () =>
      anrufliste({
        leads: leadsMitFirma,
        tasks: alleTasks,
        enrollments: enrollments.data ?? [],
        sperrliste: sperrliste.data ?? [],
        jetzt,
        maxVersuche: settings?.telefon.max_attempts ?? 5,
        entfernt,
        alle: o.alle,
        letzte: letzte.data,
      }),
    [leadsMitFirma, alleTasks, enrollments.data, sperrliste.data, settings, entfernt, o.alle, jetzt, letzte.data],
  )

  const leadsById = useMemo(() => new Map(leadsMitFirma.map((l) => [l.id, l] as const)), [leadsMitFirma])

  return {
    liste,
    istLaden: leads.istLaden || tasks.isPending || enrollments.isPending,
    fehler: leads.fehler ?? tasks.error ?? enrollments.error ?? null,
    nachladen: () => {
      leads.nachladen()
      void tasks.refetch()
      void enrollments.refetch()
    },
    leadsById,
    me,
    jetzt,
  }
}
