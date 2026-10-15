// BAUPLAN § 3.3 `filter.ts` – LeadFilter ↔ URL (?q ?zustaendig ?phase ?kanal ?faellig ?tag ?quelle ?sort ?gruppe ?ansicht)
// ↔ PostgREST (reine Funktionen). Die PostgREST-Übersetzung selbst macht `data/leads.wendeLeadFilterAn` (M0);
// `postgrestVorschau` zeichnet die Builder-Aufrufe auf (Tests, Debug). LE-04: jeder Filterzustand steht vollständig in der URL –
// deshalb leben auch die ux-Chips Rolle · Anrede · Erlaubnis-Grundlage (ux § 3.2.1) als `?rolle ?anrede ?erlaubnis` dort (additiv zu § 3.1.4).
import { wendeLeadFilterAn } from '@/data/leads'
import { PHASEN } from '@/lib/stufen'
import type {
  ActivityType,
  Channel,
  EmailConsentBasis,
  Lead,
  LeadFilter,
  LeadRole,
  PhaseKey,
  Salutation,
} from '@/types/domain'
import { ansichtNachKey, type AnsichtDef } from './ansichten'

/** Die Filter-Keys, die als URL-Parameter leben (Reihenfolge = Reihenfolge in der URL). */
export const FILTER_PARAMS = [
  'q',
  'zustaendig',
  'phase',
  'kanal',
  'faellig',
  'tag',
  'quelle',
  'sort',
  'gruppe',
  'rolle',
  'anrede',
  'erlaubnis',
  'ereignis',
] as const
export type FilterParam = (typeof FILTER_PARAMS)[number]

/** Teilmenge von LeadFilter, die in der URL kodiert wird (Overrides über die Ansicht). */
export type UrlFilter = Pick<LeadFilter, FilterParam>

const KANAELE: readonly Channel[] = ['linkedin', 'telefon', 'email']
const FAELLIG = ['ueberfaellig', 'heute', 'woche', 'spaeter', 'ohne'] as const
const GRUPPEN = ['faelligkeit', 'phase', 'zustaendig', 'unternehmen'] as const
const ZUSTAENDIG = ['me', 'andere', 'frei', 'alle'] as const
const ROLLEN: readonly LeadRole[] = [
  'geschaeftsfuehrer',
  'inhaber',
  'kundenbetreuer',
  'innendienst',
  'vertrieb',
  'projektleiter',
  'sonstiges',
  'unbekannt',
]
const ANREDEN: readonly Salutation[] = ['herr', 'frau', 'neutral']
const ERLAUBNISSE: readonly EmailConsentBasis[] = [
  'none',
  'requested_linkedin',
  'requested_phone',
  'requested_email',
  'meeting_held',
  'double_opt_in',
  'existing_customer',
  'revoked',
]
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TAG_RE = /^\d{4}-\d{2}-\d{2}$/
/** § 7.5 Funnel-Ereignisse, die als `?ereignis=` kommen (Aktivitätstypen der KPI-Zeilen). */
const EREIGNIS_TYPEN: readonly ActivityType[] = ['gespraech_eroeffnet', 'nachricht_erhalten', 'pitch_gesendet']
/** Zusatz-Parameter des Ereignis-Filters (§ 7.5; additiv zu § 3.1.4, Integration M2/M5). */
const EREIGNIS_PARAMS = ['ereignis', 'von', 'bis', 'person', 'termin'] as const

/** Sortierbare Lead-Felder (Spalte → Feld steht in spalten.tsx). */
export const SORTIERBAR: readonly (keyof Lead)[] = [
  'full_name',
  'company_name',
  'role',
  'stage',
  'next_action_label',
  'owner_id',
  'last_activity_at',
  'next_action_at',
  'created_at',
  'stage_changed_at',
  'city',
  'salutation',
  'follow_up_count',
  'email_consent_basis',
  'call_basis',
  'ended_reason',
  'last_inbound_at',
  'deleted_at',
]

const PHASE_KEYS = new Set<string>(PHASEN.map((p) => p.key))

function liste(v: string | null): string[] {
  return (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Liest nur die Overrides aus der URL; ungültige Werte werden still ignoriert. */
export function filterAusUrl(params: URLSearchParams): UrlFilter {
  const f: UrlFilter = {}
  const q = params.get('q')?.trim()
  if (q) f.q = q
  const z = params.get('zustaendig')
  if (z) {
    if ((ZUSTAENDIG as readonly string[]).includes(z)) f.zustaendig = z as 'me' | 'andere' | 'frei' | 'alle'
    else {
      const ids = liste(z).filter((x) => UUID_RE.test(x))
      if (ids.length) f.zustaendig = ids
    }
  }
  const phase = liste(params.get('phase')).filter((p) => PHASE_KEYS.has(p)) as PhaseKey[]
  if (phase.length) f.phase = phase
  const kanal = liste(params.get('kanal')).filter((k) => (KANAELE as readonly string[]).includes(k)) as Channel[]
  if (kanal.length) f.kanal = kanal
  const faellig = params.get('faellig')
  if (faellig && (FAELLIG as readonly string[]).includes(faellig)) f.faellig = faellig as LeadFilter['faellig']
  const tag = liste(params.get('tag'))
  if (tag.length) f.tag = tag
  const quelle = params.get('quelle')
  if (quelle && UUID_RE.test(quelle)) f.quelle = quelle
  const ereignis = ereignisAusUrl(params)
  if (ereignis) f.ereignis = ereignis
  const sort = liste(params.get('sort'))
    .map((s) => {
      const [feld, richtung] = s.split(':')
      if (!feld || !(SORTIERBAR as readonly string[]).includes(feld)) return null
      return { feld: feld as keyof Lead, richtung: richtung === 'desc' ? ('desc' as const) : ('asc' as const) }
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
  if (sort.length) f.sort = sort
  const gruppe = params.get('gruppe')
  if (gruppe && (GRUPPEN as readonly string[]).includes(gruppe)) f.gruppe = gruppe as LeadFilter['gruppe']
  const rolle = liste(params.get('rolle')).filter((r): r is LeadRole => (ROLLEN as readonly string[]).includes(r))
  if (rolle.length) f.rolle = rolle
  const anrede = liste(params.get('anrede')).filter((a): a is Salutation => (ANREDEN as readonly string[]).includes(a))
  if (anrede.length) f.anrede = anrede
  const erlaubnis = liste(params.get('erlaubnis')).filter((e): e is EmailConsentBasis =>
    (ERLAUBNISSE as readonly string[]).includes(e),
  )
  if (erlaubnis.length) f.erlaubnis = erlaubnis
  return f
}

/**
 * § 7.5 (K-05): `?ereignis=<typ>` · `?quelle=anfragen|angenommen` · `?ansicht=termine&termin=…` jeweils mit `?von&bis`
 * (YYYY-MM-DD) und optional `?person=<member>` → Ereignis-Filter. Ohne gültigen Zeitraum kein Filter.
 */
export function ereignisAusUrl(params: URLSearchParams): LeadFilter['ereignis'] | undefined {
  const von = params.get('von')
  const bis = params.get('bis')
  if (!von || !bis || !TAG_RE.test(von) || !TAG_RE.test(bis)) return undefined
  const person = params.get('person')
  const basis = { von, bis, ...(person && UUID_RE.test(person) ? { person } : {}) }
  const typ = params.get('ereignis')
  if (typ && (EREIGNIS_TYPEN as readonly string[]).includes(typ)) return { art: 'aktivitaet', typ, ...basis }
  const quelle = params.get('quelle')
  if (quelle === 'anfragen') return { art: 'anfrage', ...basis }
  if (quelle === 'angenommen') return { art: 'annahme', ...basis }
  if (params.get('ansicht') === 'termine') {
    const termin = params.get('termin')
    if (termin === 'vereinbart') return { art: 'termin_vereinbart', ...basis }
    if (termin === 'erstgespraech' || termin === 'strategiegespraech') return { art: 'termin', typ: termin, ...basis }
    return { art: 'termin', ...basis }
  }
  return undefined
}

/** Schreibt die Overrides in die URL (andere Parameter wie `lead`/`ansicht` bleiben erhalten). */
export function filterInUrl(f: UrlFilter, basis?: URLSearchParams): URLSearchParams {
  const p = new URLSearchParams(basis)
  for (const k of FILTER_PARAMS) p.delete(k)
  for (const k of EREIGNIS_PARAMS) p.delete(k)
  const e = f.ereignis
  if (e) {
    if (e.art === 'aktivitaet' && e.typ) p.set('ereignis', e.typ)
    if (e.art === 'anfrage') p.set('quelle', 'anfragen')
    if (e.art === 'annahme') p.set('quelle', 'angenommen')
    if (e.art === 'termin_vereinbart') p.set('termin', 'vereinbart')
    else if (e.art === 'termin' && e.typ) p.set('termin', e.typ)
    p.set('von', e.von)
    p.set('bis', e.bis)
    if (e.person) p.set('person', e.person)
  }
  if (f.q?.trim()) p.set('q', f.q.trim())
  if (f.zustaendig) p.set('zustaendig', Array.isArray(f.zustaendig) ? f.zustaendig.join(',') : f.zustaendig)
  if (f.phase?.length) p.set('phase', f.phase.join(','))
  if (f.kanal?.length) p.set('kanal', f.kanal.join(','))
  if (f.faellig) p.set('faellig', f.faellig)
  if (f.tag?.length) p.set('tag', f.tag.join(','))
  if (f.quelle) p.set('quelle', f.quelle)
  if (f.sort?.length) p.set('sort', f.sort.map((s) => `${s.feld}:${s.richtung}`).join(','))
  if (f.gruppe) p.set('gruppe', f.gruppe)
  if (f.rolle?.length) p.set('rolle', f.rolle.join(','))
  if (f.anrede?.length) p.set('anrede', f.anrede.join(','))
  if (f.erlaubnis?.length) p.set('erlaubnis', f.erlaubnis.join(','))
  return p
}

/** `?ansicht=` (Standard `alle`); unbekannte Keys fallen auf `alle` zurück. */
export function ansichtAusUrl(params: URLSearchParams): AnsichtDef {
  return ansichtNachKey(params.get('ansicht') ?? 'alle')
}

/** Hat die URL irgendeinen Override (für „Zurücksetzen ⌫“ und den Chip-Zustand)? */
export function hatOverrides(f: UrlFilter): boolean {
  return FILTER_PARAMS.some((k) => f[k] !== undefined)
}

/** Ansicht + Overrides → vollständiger LeadFilter (Overrides gewinnen je Key; Gruppierung sortiert vor). */
export function effektiverFilter(ansicht: AnsichtDef, overrides: UrlFilter): LeadFilter {
  const f: LeadFilter = { ...ansicht.filter }
  for (const k of FILTER_PARAMS) {
    const v = overrides[k]
    if (v !== undefined) (f as Record<string, unknown>)[k] = v
  }
  if (f.zustaendig === 'alle') delete f.zustaendig
  // § 7.5: Termin-Ereignisse ersetzen die Phasen der Ansicht „Termine“ (historische Termine liegen oft in späteren Phasen)
  if ((f.ereignis?.art === 'termin' || f.ereignis?.art === 'termin_vereinbart') && !overrides.phase) delete f.phase
  const gruppe = f.gruppe ?? ansicht.gruppe
  if (gruppe) f.gruppe = gruppe
  const sort = [...(f.sort ?? ansicht.sort ?? [])]
  // Gruppierung braucht den Gruppenschlüssel als erste Sortierung, sonst zerfallen die Gruppen
  const vorsortierung: Record<string, keyof Lead | null> = {
    faelligkeit: null,
    phase: 'stage',
    zustaendig: 'owner_id',
    unternehmen: 'company_name',
  }
  const vorn = gruppe ? vorsortierung[gruppe] : null
  if (vorn && sort[0]?.feld !== vorn) sort.unshift({ feld: vorn, richtung: 'asc' })
  if (sort.length) f.sort = sort
  else delete f.sort
  return f
}

export type PostgrestAufruf = readonly [methode: string, ...args: unknown[]]

/** Zeichnet die PostgREST-Builder-Aufrufe für einen Filter auf (reine Funktion über `wendeLeadFilterAn`). */
export function postgrestVorschau(f: LeadFilter, me: string | null = null): PostgrestAufruf[] {
  const aufrufe: PostgrestAufruf[] = []
  const builder: Record<string, (...args: unknown[]) => unknown> = {}
  for (const m of ['eq', 'neq', 'in', 'is', 'or', 'ilike', 'gte', 'lte', 'gt', 'lt', 'order', 'not', 'filter']) {
    builder[m] = (...args: unknown[]) => {
      aufrufe.push([m, ...args])
      return builder
    }
  }
  wendeLeadFilterAn(builder, f, me)
  return aufrufe
}
