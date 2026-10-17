// Alle Anfragen der Oberfläche an das CRM (Service Worker). Reine Logik mit injiziertem Supabase-Client → testbar mit einem Mock.
// RPC-Namen und Parameter wie src/data/rpc.ts (BAUPLAN § 4.3); die DB-Trigger bleiben die Regel, die Gates hier sind Komfort.
import { PERSONEN } from '@/features/auth/personen'
import { kontaktGate, sperrlistenEintraege, type SperrlistenEintragKurz } from '@/lib/gates'
import { fmtDatum, fmtDatumKurz } from '@/lib/format'
import type { PlatzhalterMe } from '@/lib/platzhalter'
import { phaseVon, stageLabel, stageRank, STUFEN } from '@/lib/stufen'
import { hatAufklappText, ohneDoppelteEmailSendung, ohneDoppeltenImport, timelineKategorie } from '@/lib/verlauf'
import { normalizeLinkedinUrl } from '@/lib/url'
import { OPENER_NACH_ROLLE, phase2Vorlage, SEQUENZ, VORLAGE } from '@/lib/vorlagenKeys'
import { berlinTag, tagPlus } from '@/lib/zeit'
import { ALLGEMEIN, GATE_GRUND_LABEL, GRUND_LABEL, TIMELINE_TEXT, TOAST } from '@/texte/de'
import type { Activity, ActivityType, Channel, ConnectionStatus, EndedReason, LeadStage, ReplyLabel, TemplatePhase } from '@/types/domain'
import type { Json } from '@/types/database'
import { teileName } from '../shared/name'
import type { Antwort, Nachricht, NachrichtVon, Res, Typ } from '../shared/protokoll'
import type {
  Angelegt,
  AntwortOffen,
  EingangArt,
  EingangEinstellungen,
  EingangEintrag,
  EingangListe,
  EingangStatus,
  Erledigt,
  HeuteZahlen,
  Ich,
  LeadAnsicht,
  LeadKurz,
  MemberKurz,
  PersonId,
  Rueckgabe,
  SchluesselInfo,
  SequenzInfo,
  Sitzung,
  SuchErgebnis,
  VerbindungInfo,
  VerlaufEintrag,
  VerlaufSeite,
  VorlageInfo,
} from '../shared/typen'
import type { Db } from './supabase'

/** Meldung für die Person (deutsch, ohne Technik). */
export class Hinweis extends Error {}

type DbFehler = { message?: string; code?: string; details?: string | null; status?: number; name?: string }

/** Ein Fehler → ein deutscher Satz (wie src/data/errors.ts, ohne Toast). */
export function fehlerText(e: unknown): string {
  if (e instanceof Hinweis) return e.message
  const x: DbFehler = e && typeof e === 'object' ? (e as DbFehler) : typeof e === 'string' ? { message: e } : {}
  const msg = x.message ?? ''
  if (/failed to fetch|networkerror|network request failed|load failed/i.test(msg) || x.name === 'AuthRetryableFetchError')
    return ALLGEMEIN.keineVerbindung
  switch (x.code) {
    case '23505':
      return 'Gibt es schon – diese LinkedIn-URL gehört bereits zu einem anderen Lead.'
    case '42501':
      return 'Kein Zugriff – bitte neu anmelden.'
    case 'PGRST301':
      return 'Sitzung abgelaufen – bitte erneut versuchen.'
    case 'PGRST116':
      return 'Nicht (mehr) vorhanden.'
    case 'P0001':
      return msg.trim() || 'Das CRM hat die Aktion abgelehnt.'
    default:
      break
  }
  if (x.status === 401) return 'Kein Zugriff – bitte neu anmelden.'
  return 'Das CRM antwortet gerade nicht – bitte noch einmal.'
}

/** Satzende genau einmal: „… am Mo 19.10.“ bekommt keinen zweiten Punkt. */
export function satz(s: string): string {
  const t = s.trim()
  return /[.…]$/.test(t) ? t : `${t}.`
}

function pruefe<T>(r: { data: T; error: unknown }): NonNullable<T> {
  if (r.error) throw r.error
  if (r.data === null || r.data === undefined) throw new Hinweis('Nicht (mehr) vorhanden.')
  return r.data as NonNullable<T>
}
function pruefeNull<T>(r: { data: T; error: unknown }): T {
  if (r.error) throw r.error
  return r.data
}

const SCHRITT_TYPEN: ActivityType[] = [
  'gespraech_eroeffnet',
  'nachricht_gesendet',
  'pitch_gesendet',
  'email_gesendet',
  'anruf',
  'aufgabe_erledigt',
  'schritt_uebersprungen',
]

const LEAD_SPALTEN =
  'id, salutation, title, first_name, last_name, full_name, role, role_title, company_name, city, stage, ended_reason, owner_id, do_not_contact, do_not_contact_channels, linkedin_url_norm, email, phone_e164, inbound_unanswered_since, call_basis, call_basis_note, deleted_at, companies(do_not_contact)' as const
const KURZ_SPALTEN = 'id, full_name, company_name, stage, owner_id, linkedin_url_norm, deleted_at' as const

type MemberZeile = {
  id: string | null
  display_name: string | null
  short_name: string | null
  email: string | null
  signature: string | null
  calendly_url: string | null
  caller_number_e164: string | null
}

type KurzZeile = {
  id: string
  full_name: string | null
  company_name: string | null
  stage: LeadStage
  owner_id: string | null
  linkedin_url_norm: string | null
  deleted_at: string | null
}

export type HandlerDeps = {
  db: Db
  setzeBleiben: (bleiben: boolean) => Promise<void>
  jetzt?: () => Date
}

function personVon(m: Pick<MemberZeile, 'email' | 'display_name'>): (typeof PERSONEN)[number] | undefined {
  const mail = m.email?.toLowerCase()
  return PERSONEN.find(
    (p) => p.email === mail || (!!m.display_name && p.name.toLowerCase() === m.display_name.split(' ')[0]?.toLowerCase()),
  )
}

export function memberKurz(m: MemberZeile): MemberKurz {
  const p = personVon(m)
  const name = m.display_name?.trim() || m.email || 'Unbekannt'
  const teile = name.split(/\s+/).filter(Boolean)
  const kuerzel = p?.initialen ?? `${teile[0]?.[0] ?? ''}${teile[1]?.[0] ?? ''}`.toUpperCase()
  return {
    id: m.id ?? '',
    name,
    kurz: m.short_name?.trim() || teile[0] || name,
    kuerzel,
    personId: (p?.id as PersonId | undefined) ?? null,
  }
}

function platzhalterMe(m: MemberZeile): PlatzhalterMe {
  return {
    display_name: m.display_name,
    short_name: m.short_name,
    caller_number_e164: m.caller_number_e164,
    signature: m.signature,
    calendly_url: m.calendly_url,
  }
}

/** ILIKE-Muster aus einem Namen: „%Vorname%Nachname%“, Sonderzeichen entschärft; `null` bei zu wenig Text. */
export function namensMuster(name: string | null | undefined): string | null {
  const t = teileName(name)
  const esc = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`)
  const vor = t.vorname?.split(' ')[0] ?? null
  const nach = t.nachname?.split(' ').pop() ?? null
  if (vor && nach) return `%${esc(vor)}%${esc(nach)}%`
  const eins = vor ?? nach
  return eins && eins.length >= 3 ? `%${esc(eins)}%` : null
}

/** Abfrage-Kette ohne generierte Typen (crm.eingang, crm.eingang_tokens, set_reply_label fehlen noch in src/types/database.ts). */
interface LoseKette extends PromiseLike<{ data: unknown; error: unknown }> {
  select(spalten: string): LoseKette
  in(spalte: string, werte: readonly unknown[]): LoseKette
  eq(spalte: string, wert: unknown): LoseKette
  is(spalte: string, wert: null): LoseKette
  order(spalte: string, optionen?: { ascending?: boolean }): LoseKette
  limit(anzahl: number): LoseKette
}
type LoseDb = { from: (tabelle: string) => LoseKette; rpc: (name: string, args?: Record<string, unknown>) => LoseKette }

const EINGANG_OFFEN: EingangStatus[] = ['neu', 'unbekannt', 'fehler']
export const VERLAUF_SEITE = 25

export function erstelleHandler(deps: HandlerDeps) {
  const { db } = deps
  const lose = db as unknown as LoseDb
  const jetzt = deps.jetzt ?? (() => new Date())

  let mitgliederCache: { zeit: number; liste: MemberZeile[] } | null = null
  let sperrCache: { zeit: number; liste: SperrlistenEintragKurz[] } | null = null

  function cachesLeeren() {
    mitgliederCache = null
    sperrCache = null
  }

  async function mitglieder(): Promise<MemberZeile[]> {
    if (mitgliederCache && jetzt().getTime() - mitgliederCache.zeit < 5 * 60_000) return mitgliederCache.liste
    const liste = pruefeNull(
      await db.from('members').select('id, display_name, short_name, email, signature, calendly_url, caller_number_e164'),
    ) as MemberZeile[] | null
    mitgliederCache = { zeit: jetzt().getTime(), liste: liste ?? [] }
    return mitgliederCache.liste
  }

  async function sperrliste(): Promise<SperrlistenEintragKurz[]> {
    if (sperrCache && jetzt().getTime() - sperrCache.zeit < 60_000) return sperrCache.liste
    const liste = pruefeNull(
      await db.from('sperrliste').select('lead_id, linkedin_url_norm, email, phone_e164, channels').limit(5000),
    ) as SperrlistenEintragKurz[] | null
    sperrCache = { zeit: jetzt().getTime(), liste: liste ?? [] }
    return sperrCache.liste
  }

  /** Angemeldete Person (Mitglied) oder `null`. */
  async function ichZeile(): Promise<MemberZeile | null> {
    const { data, error } = await db.auth.getSession()
    if (error) throw error
    const uid = data.session?.user.id
    if (!uid) return null
    const liste = await mitglieder()
    return liste.find((m) => m.id === uid) ?? null
  }

  async function ich(): Promise<MemberZeile & { id: string }> {
    const m = await ichZeile()
    if (!m?.id) throw new Hinweis('Bitte zuerst anmelden.')
    return m as MemberZeile & { id: string }
  }

  function alsIch(m: MemberZeile): Ich {
    return { ...memberKurz(m), email: m.email ?? '', platzhalter: platzhalterMe(m) }
  }

  // ── Sitzung ───────────────────────────────────────────────────────────────

  async function sitzung(): Promise<Sitzung> {
    const { data } = await db.auth.getSession()
    const s = data.session
    if (!s) return { angemeldet: false }
    const liste = await mitglieder()
    const m = liste.find((x) => x.id === s.user.id)
    if (!m) {
      // angemeldet, aber kein Mitglied (RLS liefert nichts) → lokal abmelden
      await db.auth.signOut({ scope: 'local' })
      cachesLeeren()
      return { angemeldet: false }
    }
    return { angemeldet: true, ich: alsIch(m) }
  }

  async function anmelden(n: NachrichtVon<'anmelden'>): Promise<Sitzung> {
    const person = PERSONEN.find((p) => p.id === n.person)
    if (!person) throw new Hinweis('Bitte Vincent oder Mike wählen.')
    if (n.passcode.length < 10) throw new Hinweis(ALLGEMEIN.passcodeZuKurz)
    await deps.setzeBleiben(n.bleiben)
    cachesLeeren()
    const { error } = await db.auth.signInWithPassword({ email: person.email, password: n.passcode })
    if (error) {
      const code = (error as { code?: string }).code
      if (code === 'over_request_rate_limit') throw new Hinweis(ALLGEMEIN.zuVieleVersuche)
      if (/fetch|network/i.test(error.message)) throw new Hinweis(ALLGEMEIN.keineVerbindung)
      throw new Hinweis(ALLGEMEIN.passcodeFalsch)
    }
    const s = await sitzung()
    if (!s.angemeldet) throw new Hinweis(TOAST.keinZugriff)
    return s
  }

  async function abmelden(): Promise<Sitzung> {
    await db.auth.signOut({ scope: 'local' })
    cachesLeeren()
    return { angemeldet: false }
  }

  // ── Heute ─────────────────────────────────────────────────────────────────

  async function heute(): Promise<HeuteZahlen> {
    const me = await ich()
    const zeilen = pruefeNull(
      await db.from('v_today_queue').select('section, item_kind, channel').eq('member_id', me.id).range(0, 1999),
    ) as { section: string | null; item_kind: string | null; channel: Channel | null }[] | null
    const z: HeuteZahlen = { linkedinFaellig: 0, linkedinUeberfaellig: 0, antwortenOffen: 0, annahmePruefen: 0, neueAnfragen: 0, eingangOffen: 0 }
    for (const i of zeilen ?? []) {
      const faellig = i.section === 'heute' || i.section === 'ueberfaellig'
      if (faellig && i.item_kind === 'sequenz_schritt' && i.channel === 'linkedin') {
        z.linkedinFaellig += 1
        if (i.section === 'ueberfaellig') z.linkedinUeberfaellig += 1
      }
      if (i.section === 'antworten') z.antwortenOffen += 1
      if (i.section === 'annahme_pruefen') z.annahmePruefen += 1
      if (i.section === 'neue_anfragen') z.neueAnfragen += 1
    }
    z.eingangOffen = await eingangAnzahl()
    return z
  }

  /** Offene Eingänge (alle Mitglieder) – nur eine Zahl; Fehler zählen als 0, damit „Heute“ immer lädt. */
  async function eingangAnzahl(): Promise<number> {
    try {
      const r = await lose.from('eingang').select('id').in('status', EINGANG_OFFEN).limit(500)
      return r.error || !Array.isArray(r.data) ? 0 : r.data.length
    } catch {
      return 0
    }
  }

  // ── Lead-Ansicht ──────────────────────────────────────────────────────────

  async function vorlageNachId(id: string | null | undefined): Promise<VorlageInfo | null> {
    if (!id) return null
    const t = pruefeNull(await db.from('templates').select('id, key, name, body, phase').eq('id', id).maybeSingle())
    return t ? { id: t.id, key: t.key, name: t.name, body: t.body, phase: t.phase as TemplatePhase } : null
  }
  async function vorlageNachKey(key: string | null | undefined): Promise<VorlageInfo | null> {
    if (!key) return null
    const t = pruefeNull(await db.from('templates').select('id, key, name, body, phase').eq('key', key).maybeSingle())
    return t ? { id: t.id, key: t.key, name: t.name, body: t.body, phase: t.phase as TemplatePhase } : null
  }

  function kurz(z: KurzZeile, liste: MemberZeile[]): LeadKurz {
    const owner = liste.find((m) => m.id === z.owner_id)
    return {
      id: z.id,
      name: z.full_name?.trim() || 'Ohne Namen',
      unternehmen: z.company_name,
      stufeLabel: stageLabel(z.stage),
      owner: owner ? memberKurz(owner) : null,
      linkedinNorm: z.linkedin_url_norm,
    }
  }

  async function ansicht(leadId: string): Promise<LeadAnsicht> {
    const me = await ich()
    const [leadR, verbR, enrR, liste, sperr] = await Promise.all([
      db.from('leads').select(LEAD_SPALTEN).eq('id', leadId).maybeSingle(),
      db.from('linkedin_connections').select('member_id, status, requested_at, accepted_at').eq('lead_id', leadId),
      db
        .from('enrollments')
        .select('id, sequence_id, member_id, status, current_step_id, next_due_at, sequences(key, name)')
        .eq('lead_id', leadId)
        .eq('channel', 'linkedin')
        .in('status', ['aktiv', 'pausiert'])
        .order('started_at', { ascending: false })
        .limit(1),
      mitglieder(),
      sperrliste(),
    ])
    const lead = pruefeNull(leadR)
    if (!lead || lead.deleted_at) throw new Hinweis('Lead nicht (mehr) im CRM.')
    const verbindungenRoh = pruefeNull(verbR) ?? []
    const enrollment = (pruefeNull(enrR) ?? [])[0] ?? null
    const memberVon = (id: string | null | undefined) => {
      const m = liste.find((x) => x.id === id)
      return m ? memberKurz(m) : null
    }

    // Sequenz + aktueller Schritt + Vorlage (Opener nach Rolle wie in der Heute-Karte)
    let sequenz: SequenzInfo | null = null
    let vorlage: VorlageInfo | null = null
    if (enrollment) {
      const schritte =
        pruefeNull(
          await db
            .from('sequence_steps')
            .select('id, position, name, template_id, is_opener')
            .eq('sequence_id', enrollment.sequence_id)
            .order('position', { ascending: true }),
        ) ?? []
      const schritt = schritte.find((s) => s.id === enrollment.current_step_id) ?? null
      const seq = enrollment.sequences as { key: string; name: string } | null
      sequenz = {
        enrollmentId: enrollment.id,
        sequenzName: seq?.name ?? 'Sequenz',
        sequenzKey: seq?.key ?? '',
        schrittId: schritt?.id ?? null,
        schrittName: schritt?.name ?? 'Schritt',
        position: schritt?.position ?? 0,
        anzahl: schritte.length,
        faelligAm: enrollment.next_due_at,
        status: enrollment.status,
        member: memberVon(enrollment.member_id),
        schrittTemplateId: schritt?.template_id ?? null,
        istOpener: !!schritt?.is_opener,
      }
      const rolle = schritt?.is_opener ? OPENER_NACH_ROLLE(lead.role) : null
      vorlage = (rolle ? await vorlageNachKey(VORLAGE[rolle]) : null) ?? (await vorlageNachId(schritt?.template_id))
    }

    // Antwort offen (eingehende Nachricht ohne Reaktion) → Phase-2-Vorschlag nach Reaktion
    let antwortOffen: AntwortOffen | null = null
    if (lead.inbound_unanswered_since && lead.stage !== 'beendet') {
      const a = pruefeNull(
        await db
          .from('activities')
          .select('id, reply_label, note, occurred_at')
          .eq('lead_id', leadId)
          .eq('type', 'nachricht_erhalten')
          .order('occurred_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      )
      const label = (a?.reply_label as ReplyLabel | null) ?? null
      const key = label ? phase2Vorlage(label, !!a?.note?.trim()) : null
      antwortOffen = {
        seit: lead.inbound_unanswered_since,
        label,
        zitat: a?.note ?? null,
        vorlage: key ? await vorlageNachKey(VORLAGE[key]) : null,
        aktivitaetId: typeof a?.id === 'number' ? a.id : null,
      }
    }

    const treffer = sperrlistenEintraege(sperr, {
      id: lead.id,
      phone_e164: lead.phone_e164,
      email: lead.email,
      linkedin_url_norm: lead.linkedin_url_norm,
    })
    const gate = kontaktGate(
      {
        do_not_contact: lead.do_not_contact,
        do_not_contact_channels: lead.do_not_contact_channels,
        companies: lead.companies as { do_not_contact?: boolean | null } | null,
      },
      treffer,
    )

    const verbindungen: VerbindungInfo[] = verbindungenRoh.map((v) => {
      const m = memberVon(v.member_id)
      return {
        memberId: v.member_id,
        name: m?.kurz ?? 'Unbekannt',
        kuerzel: m?.kuerzel ?? '?',
        personId: m?.personId ?? null,
        status: v.status as ConnectionStatus,
        angefragtAm: v.requested_at,
        angenommenAm: v.accepted_at,
        ich: v.member_id === me.id,
      }
    })

    return {
      lead: {
        id: lead.id,
        name: lead.full_name?.trim() || 'Ohne Namen',
        titel: lead.title,
        vorname: lead.first_name,
        nachname: lead.last_name,
        anrede: lead.salutation,
        unternehmen: lead.company_name,
        rolle: lead.role,
        rollenTitel: lead.role_title,
        stadt: lead.city,
        stufe: lead.stage,
        stufeLabel: stageLabel(lead.stage),
        phaseTon: phaseVon(lead.stage).ton,
        beendetGrund: lead.ended_reason ? GRUND_LABEL[lead.ended_reason as EndedReason] : null,
        owner: memberVon(lead.owner_id),
        linkedinNorm: lead.linkedin_url_norm,
      },
      verbindungen,
      meineVerbindung: verbindungen.find((v) => v.ich)?.status ?? null,
      andereOffen: verbindungen.some((v) => !v.ich && v.status === 'ausstehend'),
      gate: {
        erlaubt: gate.erlaubt,
        grund: gate.grund ?? null,
        text: gate.grund ? GATE_GRUND_LABEL[gate.grund] : null,
      },
      sequenz,
      vorlage,
      antwortOffen,
      platzhalterLead: {
        first_name: lead.first_name,
        last_name: lead.last_name,
        company_name: lead.company_name,
        city: lead.city,
        call_basis: lead.call_basis,
        call_basis_note: lead.call_basis_note,
        salutation: lead.salutation,
      },
    }
  }

  /**
   * Verlauf eines Leads (17.10.2026) – dieselben Zeilen und Texte wie die Timeline im CRM (Keyset-Seiten, neueste zuerst,
   * technische Doppel-Einträge ausgeblendet). Liest nur; Notizen bearbeitet man im CRM.
   */
  async function verlauf(n: NachrichtVon<'verlauf'>): Promise<VerlaufSeite> {
    let q = db.from('activities').select('*, templates(name)').eq('lead_id', n.leadId)
    if (n.vor) q = q.or(`occurred_at.lt.${n.vor.occurredAt},and(occurred_at.eq.${n.vor.occurredAt},id.lt.${n.vor.id})`)
    const [seiteR, angelegtR, leadR, liste] = await Promise.all([
      q.order('occurred_at', { ascending: false }).order('id', { ascending: false }).limit(VERLAUF_SEITE),
      // „angelegt“ aus einem Import liegt ganz unten – für das Ausblenden der doppelten „import“-Zeile schon auf Seite 1
      db.from('activities').select('type, lead_id, source').eq('lead_id', n.leadId).eq('type', 'angelegt').limit(5),
      db.from('leads').select('first_name, full_name').eq('id', n.leadId).maybeSingle(),
      mitglieder(),
    ])
    const roh = (pruefeNull(seiteR) ?? []) as (Activity & { templates?: { name: string | null } | null })[]
    const angelegt = (pruefeNull(angelegtR) ?? []) as Pick<Activity, 'type' | 'lead_id' | 'source'>[]
    const lead = pruefeNull(leadR) as { first_name: string | null; full_name: string | null } | null
    const person = lead?.first_name?.trim() || lead?.full_name?.trim().split(/\s+/)[0] || 'Lead'
    const zeilen = ohneDoppeltenImport(ohneDoppelteEmailSendung(roh), [...roh, ...angelegt])
    const memberVon = (id: string | null | undefined) => {
      const m = id ? liste.find((x) => x.id === id) : null
      return m ? memberKurz(m) : null
    }
    const eintraege: VerlaufEintrag[] = zeilen.map((a) => {
      const meta = (a.metadata && typeof a.metadata === 'object' ? a.metadata : {}) as { kind?: unknown }
      const eingehend = a.type === 'nachricht_erhalten' || a.type === 'email_erhalten'
      const m = memberVon(a.member_id)
      return {
        id: a.id,
        zeit: a.occurred_at,
        typ: a.type,
        kanal: a.channel,
        kategorie: timelineKategorie(a.type),
        text: TIMELINE_TEXT(a, {
          vorlage: a.templates?.name ?? null,
          stufe: (s) => stageLabel(s as LeadStage),
          rang: (s) => ((STUFEN as readonly string[]).includes(s) ? stageRank(s as LeadStage) : 0),
          mitglied: (id) => memberVon(id)?.kurz ?? 'die andere Person',
          datum: (iso) => fmtDatumKurz(iso),
        }),
        wer: eingehend ? person : m ? m.kuerzel : a.source === 'app' ? '' : 'System',
        eingehend,
        details: hatAufklappText(a) ? a.note : null,
        notiz:
          a.type === 'notiz' && a.note && !(typeof meta.kind === 'string' && meta.kind.startsWith('auskunft')) ? a.note : null,
      }
    })
    const letzte = roh[roh.length - 1]
    return {
      eintraege,
      weiter: roh.length === VERLAUF_SEITE && letzte ? { occurredAt: letzte.occurred_at, id: letzte.id } : null,
    }
  }

  async function suchen(n: NachrichtVon<'suchen'>): Promise<SuchErgebnis> {
    await ich()
    const liste = await mitglieder()
    let papierkorb: LeadKurz | null = null
    let treffer: LeadAnsicht | null = null
    const norm = n.norm ? normalizeLinkedinUrl(n.norm) : null
    if (norm) {
      const zeilen = (pruefeNull(
        await db.from('leads').select(KURZ_SPALTEN).eq('linkedin_url_norm', norm).limit(1),
      ) ?? []) as KurzZeile[]
      const z = zeilen[0]
      if (z && !z.deleted_at) treffer = await ansicht(z.id)
      else if (z) papierkorb = kurz(z, liste)
    }
    let vorschlaege: LeadKurz[] = []
    const muster = treffer ? null : namensMuster(n.name)
    if (muster) {
      const zeilen = (pruefeNull(
        await db
          .from('leads')
          .select(KURZ_SPALTEN)
          .is('deleted_at', null)
          .ilike('full_name', muster)
          .order('updated_at', { ascending: false })
          .limit(5),
      ) ?? []) as KurzZeile[]
      vorschlaege = zeilen.filter((z) => z.id !== papierkorb?.id).map((z) => kurz(z, liste))
    }
    let gesperrt = false
    if (norm && !treffer) {
      const sperr = await sperrliste()
      gesperrt = sperr.some(
        (e) => e.linkedin_url_norm === norm && (!e.channels || e.channels.length === 0 || e.channels.includes('linkedin')),
      )
    }
    return { ansicht: treffer, vorschlaege, gesperrt, papierkorb }
  }

  // ── Aktionen ──────────────────────────────────────────────────────────────

  /** Die vom Trigger/RPC gerade geschriebene Aktivität (für „Rückgängig“), nur eigene und frische. */
  async function nachlese(leadId: string, typen: ActivityType[], meId: string): Promise<number | null> {
    const r = await db
      .from('activities')
      .select('id, created_at, member_id')
      .eq('lead_id', leadId)
      .in('type', typen)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (r.error || !r.data) return null
    const alter = Math.abs(jetzt().getTime() - new Date(r.data.created_at).getTime())
    if (r.data.member_id !== meId || !(alter < 60_000)) return null
    return r.data.id
  }

  function rueckgabe(ids: (number | null)[], leadId: string, batchId: string | null = null): Rueckgabe | null {
    const activityIds = ids.filter((x): x is number => typeof x === 'number')
    return activityIds.length || batchId ? { activityIds, batchId, leadId } : null
  }

  async function gateOderFehler(leadId: string): Promise<LeadAnsicht> {
    const a = await ansicht(leadId)
    if (!a.gate.erlaubt) throw new Hinweis(`${a.gate.text ?? 'Kontakt gesperrt'} – keine Kontaktaktion.`)
    return a
  }

  async function schrittGesendet(n: NachrichtVon<'schrittGesendet'>): Promise<Erledigt> {
    const me = await ich()
    const vorher = await gateOderFehler(n.leadId)
    if (!vorher.sequenz || vorher.sequenz.enrollmentId !== n.enrollmentId || vorher.sequenz.schrittId !== n.schrittId) {
      throw new Hinweis('Der Schritt hat sich inzwischen geändert – die Ansicht ist neu geladen.')
    }
    const anderer = n.templateId && n.templateId !== vorher.sequenz.schrittTemplateId ? n.templateId : undefined
    const e = pruefe(
      await db.rpc('complete_step', {
        p_enrollment_id: n.enrollmentId,
        p_outcome: 'gesendet',
        ...(anderer ? { p_template_id: anderer } : {}),
      }),
    )
    const actId = await nachlese(n.leadId, SCHRITT_TYPEN, me.id)
    let text = 'Erledigt – Sequenz abgeschlossen.'
    if (e.status !== 'abgeschlossen' && e.current_step_id) {
      const s = pruefeNull(await db.from('sequence_steps').select('name').eq('id', e.current_step_id).maybeSingle())
      text = satz(`Erledigt – ${s?.name ?? 'nächster Schritt'} am ${e.next_due_at ? fmtDatumKurz(e.next_due_at) : '–'}`)
    }
    return { text, ansicht: await ansicht(n.leadId), rueckgabe: rueckgabe([actId], n.leadId) }
  }

  async function langfristTage(label: 'spaeter' | 'hat_partner'): Promise<number> {
    try {
      const r = pruefeNull(await db.from('settings').select('value').eq('key', 'langfristig').maybeSingle())
      const v = (r?.value ?? {}) as Record<string, unknown>
      const roh = label === 'spaeter' ? v['default_days'] : v['hat_partner_days']
      if (typeof roh === 'number' && roh > 0) return roh
    } catch {
      /* Standardwerte */
    }
    return label === 'spaeter' ? 60 : 180
  }

  /** Antworten-Karte „Gesendet“ wie im CRM (useQueueAktionen.antwortGesendet): log_outbound + Folgeaktion nach Reaktion. */
  async function antwortGesendet(n: NachrichtVon<'antwortGesendet'>): Promise<Erledigt> {
    await ich()
    const vorher = await gateOderFehler(n.leadId)
    if (!vorher.antwortOffen) throw new Hinweis('Keine offene Antwort mehr – die Ansicht ist neu geladen.')
    const label = vorher.antwortOffen.label
    const activityId = pruefe(
      await db.rpc('log_outbound', {
        p_lead_id: n.leadId,
        p_channel: 'linkedin',
        p_kind: 'nachricht',
        ...(n.templateId ? { p_template_id: n.templateId } : {}),
      }),
    )
    let text = 'Antwort gesendet'
    try {
      if (label === 'spaeter' || label === 'hat_partner') {
        const tage = await langfristTage(label)
        const due = tagPlus(berlinTag(jetzt()), tage)
        const lang = await vorlageNachKey(VORLAGE.li_fu_lang_1)
        const t = pruefe(
          await db.rpc('set_wiedervorlage', {
            p_lead_id: n.leadId,
            p_due: due,
            ...(lang ? { p_template_id: lang.id } : {}),
            ...(vorher.antwortOffen.zitat ? { p_note: vorher.antwortOffen.zitat } : {}),
          }),
        )
        text = `Antwort gesendet · Wiedervorlage am ${fmtDatum(t.due_at)}`
      } else {
        const id = pruefe(
          await db.rpc('enroll', { p_lead_id: n.leadId, p_sequence_key: SEQUENZ.linkedin_nachfassen_im_gespraech }),
        )
        const e = pruefeNull(await db.from('enrollments').select('next_due_at').eq('id', id).maybeSingle())
        if (e?.next_due_at) text = `Antwort gesendet · Nachfassen am ${fmtDatumKurz(e.next_due_at)}`
      }
    } catch {
      // Folgeaktion optional (Sequenz C lief schon o. ä.) – die Antwort ist verbucht
    }
    return { text: satz(`Erledigt – ${text}`), ansicht: await ansicht(n.leadId), rueckgabe: rueckgabe([activityId], n.leadId) }
  }

  async function angenommen(n: NachrichtVon<'angenommen'>): Promise<Erledigt> {
    const me = await ich()
    pruefe(await db.rpc('mark_accepted', { p_lead_id: n.leadId, p_member_id: me.id }))
    const actId = await nachlese(n.leadId, ['vernetzung_angenommen'], me.id)
    const a = await ansicht(n.leadId)
    return { text: a.sequenz ? TOAST.angenommen : 'Angenommen.', ansicht: a, rueckgabe: rueckgabe([actId], n.leadId) }
  }

  async function anfrageGesendet(n: NachrichtVon<'anfrageGesendet'>): Promise<Erledigt> {
    const me = await ich()
    await gateOderFehler(n.leadId)
    pruefe(await db.rpc('log_request', { p_lead_id: n.leadId, p_member_id: me.id }))
    const actId = await nachlese(n.leadId, ['vernetzung_gesendet'], me.id)
    return { text: 'Anfrage erfasst.', ansicht: await ansicht(n.leadId), rueckgabe: rueckgabe([actId], n.leadId) }
  }

  async function antwortErhalten(n: NachrichtVon<'antwortErhalten'>): Promise<Erledigt> {
    await ich()
    const zitat = n.zitat?.trim() || null
    // Antwort schon erfasst, aber ohne Reaktion (z. B. aus der LinkedIn-Mail): Reaktion an DIESER Antwort nachtragen –
    // log_reply legte sonst eine zweite nachricht_erhalten an (doppelt in Timeline und Kennzahlen). Kein Rückgängig:
    // undo_activity würde die ganze Antwort löschen.
    const vorher = await ansicht(n.leadId)
    const offen = vorher.antwortOffen
    if (offen && offen.label === null && offen.aktivitaetId !== null) {
      pruefe(
        await lose.rpc('set_reply_label', {
          p_activity_id: offen.aktivitaetId,
          p_label: n.label,
          ...(zitat ? { p_note: zitat } : {}),
        }),
      )
      const a = await ansicht(n.leadId)
      const text =
        n.label === 'nicht_icp'
          ? 'Reaktion erfasst – Lead beendet (Nicht ICP).'
          : a.antwortOffen?.vorlage
            ? `Reaktion erfasst – Vorlage ‚${a.antwortOffen.vorlage.name}‘ vorgeschlagen.`
            : 'Reaktion erfasst.'
      return { text, ansicht: a, rueckgabe: null }
    }
    const id = pruefe(
      await db.rpc('log_reply', {
        p_lead_id: n.leadId,
        p_channel: 'linkedin',
        p_label: n.label,
        ...(zitat ? { p_note: zitat } : {}),
      }),
    )
    const a = await ansicht(n.leadId)
    const text =
      n.label === 'nicht_icp'
        ? 'Antwort erfasst – Lead beendet (Nicht ICP).'
        : a.antwortOffen?.vorlage
          ? TOAST.antwortErhalten(a.antwortOffen.vorlage.name)
          : 'Antwort erfasst.'
    return { text, ansicht: a, rueckgabe: rueckgabe([id], n.leadId) }
  }

  async function notiz(n: NachrichtVon<'notiz'>): Promise<Erledigt> {
    const me = await ich()
    const text = n.text.trim()
    if (!text) throw new Hinweis('Die Notiz ist leer.')
    const r = pruefe(
      await db
        .from('activities')
        .insert({ lead_id: n.leadId, type: 'notiz', channel: 'sonstiges', note: text.slice(0, 5000), member_id: me.id })
        .select('id')
        .single(),
    )
    return { text: 'Notiz gespeichert.', ansicht: await ansicht(n.leadId), rueckgabe: rueckgabe([r.id], n.leadId) }
  }

  /** Als Lead anlegen – derselbe Weg wie der Schnellimport (crm.import_leads, Quelle schnellimport), optional log_request. */
  async function anlegen(n: NachrichtVon<'anlegen'>): Promise<Angelegt> {
    const me = await ich()
    const p = n.entwurf
    const sauberOderNull = (s: string | null | undefined) => (s ?? '').trim() || null
    const vorname = sauberOderNull(p.vorname)
    const nachname = sauberOderNull(p.nachname)
    if (!vorname && !nachname) throw new Hinweis('Vor- oder Nachname fehlt.')
    const norm = normalizeLinkedinUrl(p.profilUrl)
    if (!norm) throw new Hinweis('Profil-Adresse nicht erkannt – öffne das Profil der Person.')
    const zeile: Record<string, string> = { linkedin_url: `https://www.${norm}/`, salutation: p.anrede }
    const felder: [string, string | null][] = [
      ['first_name', vorname],
      ['last_name', nachname],
      ['title', sauberOderNull(p.titel)],
      ['company', sauberOderNull(p.unternehmen)],
      ['role_title', sauberOderNull(p.rolle)],
      ['city', sauberOderNull(p.stadt)],
    ]
    for (const [k, v] of felder) if (v) zeile[k] = v
    const erg = pruefe(
      await db.rpc('import_leads', {
        p_rows: [zeile] as unknown as Json,
        p_owner: me.id,
        p_source: 'schnellimport',
        p_label: `Erweiterung · ${fmtDatum(jetzt())}`,
      }),
    ) as { batch_id?: string | null; rows?: { status?: string; existing_id?: string | null }[] }
    const z = erg.rows?.[0]
    const status = (z?.status ?? 'ungueltig') as Angelegt['status']
    const batchId = erg.batch_id ?? null
    if (status === 'gesperrt') return { status, text: 'Steht auf der Sperrliste – nicht angelegt.', ansicht: null, rueckgabe: null }
    if (status === 'ungueltig' || (status !== 'neu' && !z?.existing_id))
      return { status: 'ungueltig', text: 'Name oder Profil-Adresse fehlt – nicht angelegt.', ansicht: null, rueckgabe: null }

    let leadId: string | null = z?.existing_id ?? null
    if (status === 'neu' && batchId) {
      const r = pruefeNull(await db.from('leads').select('id').eq('source_batch_id', batchId).limit(1).maybeSingle())
      leadId = r?.id ?? null
    }
    if (!leadId) throw new Hinweis('Angelegt, aber nicht wiedergefunden – bitte im CRM nachsehen.')
    if (status === 'archiv') {
      return { status, text: 'Schon im CRM und beendet – nicht neu angelegt.', ansicht: await ansicht(leadId), rueckgabe: null }
    }

    let text = status === 'neu' ? 'Als Lead angelegt' : 'War schon im CRM – leere Felder ergänzt'
    const ids: (number | null)[] = []
    if (n.anfrageGesendet) {
      try {
        pruefe(await db.rpc('log_request', { p_lead_id: leadId, p_member_id: me.id }))
        ids.push(await nachlese(leadId, ['vernetzung_gesendet'], me.id))
        text += ' · Anfrage erfasst'
      } catch (e) {
        text += ` · Anfrage nicht erfasst: ${fehlerText(e)}`
      }
    }
    return {
      status,
      text: satz(text),
      ansicht: await ansicht(leadId),
      rueckgabe: rueckgabe(ids, leadId, status === 'neu' ? batchId : null),
    }
  }

  async function verknuepfen(n: NachrichtVon<'verknuepfen'>): Promise<Erledigt> {
    await ich()
    const norm = normalizeLinkedinUrl(n.profilUrl)
    if (!norm) throw new Hinweis('Profil-Adresse nicht erkannt.')
    pruefe(
      await db
        .from('leads')
        .update({ linkedin_url: `https://www.${norm}/`, url_verified: true })
        .eq('id', n.leadId)
        .select('id')
        .single(),
    )
    return { text: 'Profil mit dem Lead verknüpft.', ansicht: await ansicht(n.leadId), rueckgabe: null }
  }

  // ── Eingang (LinkedIn-Mails) ──────────────────────────────────────────────

  async function schluesselInfo(meId: string): Promise<SchluesselInfo | null> {
    const r = await lose
      .from('eingang_tokens')
      .select('created_at, last_used_at')
      .eq('member_id', meId)
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
    const z = (pruefeNull(r as { data: unknown; error: unknown }) as { created_at: string; last_used_at: string | null }[] | null)?.[0]
    return z ? { erstelltAm: z.created_at, zuletztGenutzt: z.last_used_at } : null
  }

  async function eingang(): Promise<EingangListe> {
    const me = await ich()
    const liste = await mitglieder()
    const zeilen = (pruefeNull(
      (await lose
        .from('eingang')
        .select('id, member_id, art, status, empfangen_at, absender_name, linkedin_slug, text, ergebnis, lead_id')
        .in('status', EINGANG_OFFEN)
        .order('empfangen_at', { ascending: false })
        .limit(100)) as { data: unknown; error: unknown },
    ) ?? []) as {
      id: string
      member_id: string
      art: EingangArt
      status: EingangStatus
      empfangen_at: string
      absender_name: string | null
      linkedin_slug: string | null
      text: string | null
      ergebnis: string | null
      lead_id: string | null
    }[]
    const leadIds = [...new Set(zeilen.map((z) => z.lead_id).filter((x): x is string => !!x))]
    const namen = new Map<string, string>()
    if (leadIds.length) {
      const leads = (pruefeNull(await db.from('leads').select('id, full_name').in('id', leadIds)) ?? []) as {
        id: string
        full_name: string | null
      }[]
      for (const l of leads) namen.set(l.id, l.full_name?.trim() || 'Ohne Namen')
    }
    const eintraege: EingangEintrag[] = zeilen.map((z) => {
      const m = liste.find((x) => x.id === z.member_id)
      return {
        id: z.id,
        art: z.art,
        status: z.status,
        empfangenAm: z.empfangen_at,
        absender: z.absender_name,
        slug: z.linkedin_slug,
        text: z.text,
        ergebnis: z.ergebnis,
        lead: z.lead_id ? { id: z.lead_id, name: namen.get(z.lead_id) ?? 'Lead' } : null,
        member: m ? memberKurz(m) : null,
      }
    })
    return { eintraege, schluessel: await schluesselInfo(me.id) }
  }

  async function eingangZuordnen(n: NachrichtVon<'eingangZuordnen'>): Promise<{ text: string }> {
    await ich()
    const e = pruefe(await lose.rpc('eingang_zuordnen', { p_id: n.id, p_lead_id: n.leadId })) as {
      status?: string
      ergebnis?: string | null
    }
    if (e.status === 'fehler') throw new Hinweis(satz(`Zugeordnet, aber nicht verbucht: ${e.ergebnis ?? 'Fehler'}`))
    return { text: satz(e.ergebnis?.trim() || 'Zugeordnet') }
  }

  async function eingangIgnorieren(n: NachrichtVon<'eingangIgnorieren'>): Promise<{ text: string }> {
    await ich()
    pruefe(await lose.rpc('eingang_ignorieren', { p_id: n.id }))
    return { text: 'Erledigt – ohne Eintrag im CRM.' }
  }

  async function eingangEinstellungen(): Promise<EingangEinstellungen> {
    const me = await ich()
    const p = pruefeNull(await db.from('member_profiles').select('linkedin_url').eq('member_id', me.id).maybeSingle())
    return { profilUrl: p?.linkedin_url ?? null, schluessel: await schluesselInfo(me.id) }
  }

  async function eingangProfil(n: NachrichtVon<'eingangProfil'>): Promise<EingangEinstellungen> {
    const me = await ich()
    const roh = n.profilUrl?.trim() || null
    const norm = roh ? normalizeLinkedinUrl(roh) : null
    if (roh && !norm) throw new Hinweis('Profil-Adresse nicht erkannt – zum Beispiel linkedin.com/in/dein-name.')
    const r = pruefeNull(
      await db
        .from('member_profiles')
        .update({ linkedin_url: norm ? `https://www.${norm}/` : null })
        .eq('member_id', me.id)
        .select('member_id'),
    )
    if (!r || (Array.isArray(r) && r.length === 0)) throw new Hinweis('Kein Profil im CRM gefunden – bitte im CRM unter Einstellungen anlegen.')
    cachesLeeren()
    return eingangEinstellungen()
  }

  async function eingangSchluessel(n: NachrichtVon<'eingangSchluessel'>): Promise<{ schluessel: string | null; einstellungen: EingangEinstellungen }> {
    await ich()
    let schluessel: string | null = null
    if (n.aktion === 'erzeugen') {
      const t = pruefe(await lose.rpc('eingang_token_erzeugen', { p_label: 'Gmail (Apps Script) · Erweiterung' }))
      if (typeof t !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(t)) throw new Hinweis('Der Schlüssel kam unvollständig an – bitte noch einmal.')
      schluessel = t
    } else {
      pruefeNull(await lose.rpc('eingang_token_widerrufen'))
    }
    return { schluessel, einstellungen: await eingangEinstellungen() }
  }

  async function rueckgaengig(n: NachrichtVon<'rueckgaengig'>): Promise<Erledigt> {
    await ich()
    for (const id of n.activityIds) pruefeNull(await db.rpc('undo_activity', { p_activity_id: id }))
    if (n.batchId) pruefeNull(await db.rpc('undo_import', { p_batch_id: n.batchId }))
    const a = n.leadId && !n.batchId ? await ansicht(n.leadId) : null
    return { text: TOAST.rueckgaengigGemacht, ansicht: a, rueckgabe: null }
  }

  async function ausfuehren(n: Nachricht): Promise<Res<Typ>> {
    switch (n.typ) {
      case 'sitzung':
        return sitzung()
      case 'anmelden':
        return anmelden(n)
      case 'abmelden':
        return abmelden()
      case 'heute':
        return heute()
      case 'suchen':
        return suchen(n)
      case 'lead':
        return ansicht(n.leadId)
      case 'verlauf':
        return verlauf(n)
      case 'anlegen':
        return anlegen(n)
      case 'verknuepfen':
        return verknuepfen(n)
      case 'schrittGesendet':
        return schrittGesendet(n)
      case 'antwortGesendet':
        return antwortGesendet(n)
      case 'angenommen':
        return angenommen(n)
      case 'anfrageGesendet':
        return anfrageGesendet(n)
      case 'antwortErhalten':
        return antwortErhalten(n)
      case 'notiz':
        return notiz(n)
      case 'rueckgaengig':
        return rueckgaengig(n)
      case 'eingang':
        return eingang()
      case 'eingangZuordnen':
        return eingangZuordnen(n)
      case 'eingangIgnorieren':
        return eingangIgnorieren(n)
      case 'eingangEinstellungen':
        return eingangEinstellungen()
      case 'eingangProfil':
        return eingangProfil(n)
      case 'eingangSchluessel':
        return eingangSchluessel(n)
    }
  }

  async function bearbeite(n: Nachricht): Promise<Antwort> {
    try {
      return { ok: true, daten: await ausfuehren(n) }
    } catch (e) {
      return { ok: false, fehler: fehlerText(e) }
    }
  }

  return { bearbeite, cachesLeeren }
}
