// BAUPLAN § 3.3 `ansichten.ts` – die System-Ansichten (ux § 3.2.3, seit Runde 3 + „Ohne Telefonnummer“) als LeadFilter + Sortierung + Spalten.
// Die Keys sind der URL-Vertrag mit src/app/ansichten.ts (Palette `*`, Links `/leads?ansicht=<key>`) – Test vergleicht beide Listen.
// Was PostgREST über `LeadFilter` nicht ausdrücken kann (≤ heute, Antwort offen, > 21 T, Anrufliste), filtert `client` nachträglich –
// die Listen sind klein (E18: Seiten à 500, < 1 000 Leads).
import { stageRank } from '@/lib/stufen'
import { berlinTag, tagPlus } from '@/lib/zeit'
import type { Lead, LeadFilter, SperrlisteEintrag } from '@/types/domain'
import { sperrlistenEintraege } from '@/lib/gates'
import type { SpaltenKey } from './spaltenKeys'

export type AnsichtKontext = {
  /** Heutiger Berliner Kalendertag */
  heute: string
  me: string | null
  /** Firmensperre je Lead (Embed companies.do_not_contact, § 1.5 Nr. 27) */
  firmaGesperrt: (l: Lead) => boolean
  /** Sperrlisten-Treffer je Lead (Telefon/E-Mail/LinkedIn) */
  sperrliste: (l: Lead) => boolean
  /** settings.linkedin.pending_withdraw_days (Standard 21) */
  zurueckziehenTage: number
}

export type AnsichtDef = {
  key: string
  name: string
  /** Kurzsatz für Dropdown/Tooltip (ux § 3.2.3 Definition) */
  definition: string
  filter: LeadFilter
  sort?: LeadFilter['sort']
  gruppe?: LeadFilter['gruppe']
  spalten: readonly SpaltenKey[]
  /** Clientseitige Nachfilterung (nur, wo LeadFilter nicht reicht) */
  client?: (l: Lead, ctx: AnsichtKontext) => boolean
}

export const STANDARD_SPALTEN: readonly SpaltenKey[] = [
  'name',
  'unternehmen',
  'rolle',
  'kanal',
  'phase',
  'schritt',
  'zustaendig',
  'letzteBewegung',
  'naechsteAktion',
  'notiz',
]

const tag = (iso: string | null): string | null => (iso ? berlinTag(iso) : null)

/** Sperrlisten-Treffer: Telefon, E-Mail oder LinkedIn-URL stimmt überein (oder der Eintrag zeigt auf den Lead). */
export function sperrlistenTreffer(l: Lead, eintraege: readonly SperrlisteEintrag[]): boolean {
  return sperrlistenEintraege(eintraege, l).length > 0
}

export const SYSTEM_ANSICHTEN: readonly AnsichtDef[] = [
  { key: 'alle', name: 'Alle', definition: 'ohne Papierkorb', filter: {}, spalten: STANDARD_SPALTEN },
  {
    key: 'meine',
    name: 'Meine',
    definition: 'Zuständig = ich',
    filter: { zustaendig: 'me' },
    spalten: STANDARD_SPALTEN,
  },
  {
    key: 'faellig',
    name: 'Fällig',
    definition: 'Nächste Aktion ≤ heute, Zuständig = ich',
    filter: { zustaendig: 'me' },
    sort: [{ feld: 'next_action_at', richtung: 'asc' }],
    spalten: STANDARD_SPALTEN,
    // LeadFilter.faellig kennt nur einen Wert (heute ODER überfällig) – „≤ heute“ ist beides
    client: (l, ctx) => {
      const t = tag(l.next_action_at)
      return t !== null && t <= ctx.heute
    },
  },
  {
    key: 'ueberfaellig',
    name: 'Überfällig',
    definition: 'Nächste Aktion < heute',
    filter: {},
    sort: [{ feld: 'next_action_at', richtung: 'asc' }],
    spalten: STANDARD_SPALTEN,
    // LE-03: < heute 00:00 (Kalendertag), nicht < jetzt – deshalb clientseitig statt LeadFilter.faellig = ueberfaellig
    client: (l, ctx) => {
      const t = tag(l.next_action_at)
      return t !== null && t < ctx.heute
    },
  },
  {
    key: 'antwort_offen',
    name: 'Antwort offen',
    definition: 'letzte Reaktion eingehend, keine Antwort von uns',
    filter: {},
    sort: [{ feld: 'last_inbound_at', richtung: 'desc' }],
    spalten: STANDARD_SPALTEN,
    client: (l) => l.inbound_unanswered_since !== null,
  },
  {
    key: 'angefragt',
    name: 'Angefragt',
    definition: 'Anfrage offen, Anfragedatum ↓',
    filter: { stage: ['vernetzung_gesendet'] },
    sort: [{ feld: 'stage_changed_at', richtung: 'desc' }],
    spalten: ['name', 'unternehmen', 'rolle', 'zustaendig', 'angefragtAm', 'letzteBewegung', 'notiz'],
  },
  {
    key: 'abgelaufen',
    name: 'Zurückziehen',
    definition: 'Angefragt seit mehr als 21 Tagen',
    filter: { stage: ['vernetzung_gesendet'] },
    sort: [{ feld: 'stage_changed_at', richtung: 'asc' }],
    spalten: ['name', 'unternehmen', 'rolle', 'zustaendig', 'angefragtAm', 'letzteBewegung', 'notiz'],
    client: (l, ctx) => {
      const t = tag(l.stage_changed_at)
      return t !== null && t < tagPlus(ctx.heute, -ctx.zurueckziehenTage)
    },
  },
  {
    key: 'in_gespraech',
    name: 'In Gespräch',
    definition: 'Phase Beantwortet oder Gepitcht',
    filter: { phase: ['beantwortet', 'gepitcht'] },
    spalten: STANDARD_SPALTEN,
  },
  {
    key: 'termine',
    name: 'Termine',
    definition: 'Phase Erstgespräch oder Strategiegespräch, Termin ↑',
    filter: { phase: ['erstgespraech', 'strategiegespraech'] },
    sort: [{ feld: 'next_action_at', richtung: 'asc' }],
    spalten: STANDARD_SPALTEN,
  },
  {
    key: 'wiedervorlage',
    name: 'Wiedervorlage',
    definition: 'Phase Wiedervorlage, Datum ↑',
    filter: { phase: ['wiedervorlage'] },
    sort: [{ feld: 'next_action_at', richtung: 'asc' }],
    spalten: ['name', 'unternehmen', 'rolle', 'zustaendig', 'wiedervorlageAm', 'letzteBewegung', 'notiz'],
  },
  {
    key: 'beendet',
    name: 'Beendet',
    definition: 'Phase Beendet',
    filter: { phase: ['beendet'] },
    sort: [{ feld: 'stage_changed_at', richtung: 'desc' }],
    spalten: ['name', 'unternehmen', 'rolle', 'zustaendig', 'beendetGrund', 'letzteBewegung', 'notiz'],
  },
  {
    key: 'frei',
    name: 'Freigegeben',
    definition: 'Zuständig = Frei',
    filter: { zustaendig: 'frei' },
    spalten: STANDARD_SPALTEN,
  },
  {
    key: 'ohne_unternehmen',
    name: 'Unvollständig',
    definition: 'Unternehmen leer',
    filter: { ohneUnternehmen: true },
    spalten: STANDARD_SPALTEN,
  },
  {
    key: 'anrufliste',
    name: 'Anrufliste',
    definition: 'Telefon vorhanden, Anrufgrund gesetzt, kein Sperrlisten-Treffer, keine Firmensperre',
    filter: {},
    sort: [{ feld: 'next_action_at', richtung: 'asc' }],
    spalten: [
      'name',
      'unternehmen',
      'rolle',
      'phase',
      'telefon',
      'anrufgrund',
      'zustaendig',
      'naechsteAktion',
      'notiz',
    ],
    // LE-15 (BAUPLAN gilt vor ux): genau phone_e164 + call_basis, ohne Sperrlisten-Treffer, ohne Firmensperre. Ein Telefon-Widerspruch
    // zählt als Sperre (E12, telefonGate blockt ihn ohnehin); die Phase filtert die Ansicht nicht – Beendete bleiben sichtbar.
    client: (l, ctx) =>
      !!l.phone_e164 &&
      !!l.call_basis &&
      !(l.do_not_contact && (!l.do_not_contact_channels?.length || l.do_not_contact_channels.includes('telefon'))) &&
      !ctx.sperrliste(l) &&
      !ctx.firmaGesperrt(l),
  },
  {
    // Runde 3 (Befund 9): /telefon „Nummern ergänzen“ → „In Leads öffnen“. Dieselbe Menge wie /telefon „Keine Nummer“
    // (telefon/anrufliste.ts: Anruf-Kandidat Vernetzt … Sales-Follow-up, ohne Widerspruch/Sperrliste/Firmensperre – die zählen dort als
    // „gesperrt“), damit beide Seiten dieselbe Zahl zeigen (echte Daten: 116, nicht 119). Telefon-Spalte ist inline editierbar.
    key: 'ohne_nummer',
    name: 'Ohne Telefonnummer',
    definition: 'Telefonnummer fehlt, anrufbar ab Vernetzt, nicht gesperrt (wie Telefon „Keine Nummer“)',
    filter: {},
    sort: [{ feld: 'created_at', richtung: 'asc' }],
    spalten: ['name', 'unternehmen', 'phase', 'telefon', 'zustaendig', 'naechsteAktion', 'notiz'],
    client: (l, ctx) =>
      !l.phone_e164 &&
      stageRank(l.stage) >= stageRank('vernetzt') &&
      stageRank(l.stage) <= stageRank('sales_follow_up') &&
      !(l.do_not_contact && (!l.do_not_contact_channels?.length || l.do_not_contact_channels.includes('telefon'))) &&
      !ctx.sperrliste(l) &&
      !ctx.firmaGesperrt(l),
  },
  {
    key: 'papierkorb',
    name: 'Papierkorb',
    definition: 'gelöscht (30 Tage)',
    filter: { papierkorb: true },
    sort: [{ feld: 'deleted_at', richtung: 'desc' }],
    spalten: ['name', 'unternehmen', 'phase', 'zustaendig', 'geloeschtAm'],
  },
]

const NACH_KEY = new Map(SYSTEM_ANSICHTEN.map((a) => [a.key, a]))

/** Ansicht nach Key; unbekannt → `alle`. */
export function ansichtNachKey(key: string | null | undefined): AnsichtDef {
  return (key && NACH_KEY.get(key)) || (NACH_KEY.get('alle') as AnsichtDef)
}

/** Favoriten (Segment neben dem Dropdown, max. 6) – Standardauswahl wie reference.html. */
export const FAVORITEN_STANDARD: readonly string[] = ['alle', 'meine', 'faellig', 'antwort_offen', 'beendet']
export const FAVORITEN_MAX = 6
