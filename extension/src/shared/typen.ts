// Datenformen zwischen Lese-Skript, Service Worker und Oberfläche. Alles serialisierbar (chrome.runtime-Nachrichten).
import type { PlatzhalterLead, PlatzhalterMe } from '@/lib/platzhalter'
import type { PhaseTon } from '@/lib/stufen'
import type { KontaktGrund } from '@/lib/gates'
import type {
  ConnectionStatus,
  EnrollmentStatus,
  LeadRole,
  LeadStage,
  ReplyLabel,
  Salutation,
  TemplatePhase,
} from '@/types/domain'

// ── Lese-Skript (liest nur die geöffnete Seite) ─────────────────────────────

export type SeitenArt = 'profil' | 'nachrichten' | 'andere'

export type PersonExtrakt = {
  name: string | null
  titel: string | null
  vorname: string | null
  nachname: string | null
  headline: string | null
  unternehmen: string | null
  rolle: string | null
  ort: string | null
  /** `https://www.linkedin.com/in/<slug>/` */
  profilUrl: string | null
  /** `linkedin.com/in/<slug>` – exakt wie crm.normalize_linkedin_url */
  norm: string | null
  slug: string | null
}

export type Extrakt = {
  art: SeitenArt
  url: string
  person: PersonExtrakt | null
  /** Letzte Nachricht der anderen Person in der offenen Unterhaltung (best effort) */
  letzteNachricht: string | null
  /** Markierter Text auf der Seite */
  auswahl: string | null
  /** Sales Navigator, Firmenseite … – Hinweis statt Person */
  hinweis: string | null
}

export type LeseOptionen = { ichName?: string | null }

// ── Sitzung ────────────────────────────────────────────────────────────────

export type PersonId = 'vincent' | 'mike'

export type MemberKurz = {
  id: string
  name: string
  kurz: string
  kuerzel: string
  personId: PersonId | null
}

export type Ich = MemberKurz & { email: string; platzhalter: PlatzhalterMe }

export type Sitzung = { angemeldet: false } | { angemeldet: true; ich: Ich }

export type HeuteZahlen = {
  linkedinFaellig: number
  linkedinUeberfaellig: number
  antwortenOffen: number
  annahmePruefen: number
  neueAnfragen: number
  /** Offene Einträge aus den LinkedIn-Mails (neu · unbekannt · fehler), alle Mitglieder */
  eingangOffen: number
}

// ── Lead-Ansicht ───────────────────────────────────────────────────────────

export type VorlageInfo = { id: string; key: string; name: string; body: string; phase: TemplatePhase }

export type VerbindungInfo = {
  memberId: string
  name: string
  kuerzel: string
  personId: PersonId | null
  status: ConnectionStatus
  angefragtAm: string | null
  angenommenAm: string | null
  ich: boolean
}

export type SequenzInfo = {
  enrollmentId: string
  sequenzName: string
  sequenzKey: string
  schrittId: string | null
  schrittName: string
  position: number
  anzahl: number
  faelligAm: string | null
  status: EnrollmentStatus
  member: MemberKurz | null
  schrittTemplateId: string | null
  istOpener: boolean
}

export type AntwortOffen = {
  seit: string
  label: ReplyLabel | null
  zitat: string | null
  vorlage: VorlageInfo | null
  /** Die letzte nachricht_erhalten – ohne Reaktion (z. B. aus der LinkedIn-Mail) wird die Reaktion hier nachgetragen */
  aktivitaetId: number | null
}

export type LeadInfo = {
  id: string
  name: string
  titel: string | null
  vorname: string | null
  nachname: string | null
  anrede: Salutation
  unternehmen: string | null
  rolle: LeadRole
  rollenTitel: string | null
  stadt: string | null
  stufe: LeadStage
  stufeLabel: string
  phaseTon: PhaseTon
  beendetGrund: string | null
  owner: MemberKurz | null
  linkedinNorm: string | null
}

export type GateInfo = { erlaubt: boolean; grund: KontaktGrund | null; text: string | null }

export type LeadAnsicht = {
  lead: LeadInfo
  verbindungen: VerbindungInfo[]
  meineVerbindung: ConnectionStatus | null
  /** Die andere Person hat eine offene Anfrage – nur eine Anfrage je Lead */
  andereOffen: boolean
  gate: GateInfo
  sequenz: SequenzInfo | null
  vorlage: VorlageInfo | null
  antwortOffen: AntwortOffen | null
  platzhalterLead: PlatzhalterLead
}

export type LeadKurz = {
  id: string
  name: string
  unternehmen: string | null
  stufeLabel: string
  owner: MemberKurz | null
  linkedinNorm: string | null
}

export type SuchErgebnis = {
  ansicht: LeadAnsicht | null
  vorschlaege: LeadKurz[]
  /** Profil-URL steht auf der Sperrliste (LinkedIn) */
  gesperrt: boolean
  /** Lead mit dieser URL liegt im Papierkorb */
  papierkorb: LeadKurz | null
}

export type LeadEntwurf = {
  titel: string | null
  vorname: string | null
  nachname: string | null
  unternehmen: string | null
  rolle: string | null
  stadt: string | null
  anrede: Salutation
  profilUrl: string
}

/** Was „Rückgängig“ zurücknimmt: Aktivitäten (undo_activity) und ggf. der Import-Batch (undo_import). */
export type Rueckgabe = { activityIds: number[]; batchId: string | null; leadId: string | null }

export type Erledigt = {
  text: string
  ansicht: LeadAnsicht | null
  rueckgabe: Rueckgabe | null
}

export type AnlegenStatus = 'neu' | 'duplikat' | 'gesperrt' | 'archiv' | 'ungueltig'

export type Angelegt = Erledigt & { status: AnlegenStatus }

export type AntwortLabel = Extract<ReplyLabel, 'interessiert' | 'frage' | 'kein_bedarf' | 'spaeter' | 'nicht_icp'>

// ── Eingang (LinkedIn-Benachrichtigungs-Mails, Apps Script → crm.eingang) ─────

export type EingangArt = 'nachricht' | 'annahme' | 'einladung' | 'sonstiges'
export type EingangStatus = 'neu' | 'unbekannt' | 'fehler'

export type EingangEintrag = {
  id: string
  art: EingangArt
  status: EingangStatus
  empfangenAm: string
  absender: string | null
  slug: string | null
  text: string | null
  ergebnis: string | null
  lead: { id: string; name: string } | null
  /** In wessen Postfach die Mail ankam */
  member: MemberKurz | null
}

export type SchluesselInfo = { erstelltAm: string; zuletztGenutzt: string | null }

export type EingangListe = { eintraege: EingangEintrag[]; schluessel: SchluesselInfo | null }

export type EingangEinstellungen = { profilUrl: string | null; schluessel: SchluesselInfo | null }
