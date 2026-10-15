// BAUPLAN § 3.3 `spalten.tsx` – ColumnDef-Fabrik der Leads-Tabelle (ux § 3.2.2 Standardspalten + weitere wählbare),
// Inline-Edit je Spalte (components/tabelle/InlineEdit), Zeitfarben (DESIGN-SYSTEM § 5.10), Chip „Firma gesperrt“ (§ 1.5 Nr. 27),
// Mobil-Zeile (56 px, drei Zeilen) und CSV-Spalten (LE-14). Keine Daten-Hooks hier – alles kommt über `SpaltenOptionen`.
import type { ReactNode } from 'react'
import { InlineEdit, spaltenHelper, SPALTEN_BREITE, type DataTableSpalte, type ZeitBalken } from '@/components/tabelle'
import { Avatar } from '@/components/ui/Avatar'
import { Chip, StatusChip } from '@/components/ui/Chip'
import { cn } from '@/components/ui/cn'
import { Glyph } from '@/components/ui/Glyph'
import type { SelectOption } from '@/components/ui/Select'
import type { CsvSpalte } from '@/lib/csv'
import { fmtDatum, fmtDatumKurz, fmtZeit, MINUS, relativ } from '@/lib/format'
import { fmtTelefon } from '@/lib/telefon'
import { kurzId } from '@/lib/ids'
import { stageLabel } from '@/lib/stufen'
import { linkedinAnzeige } from '@/lib/url'
import { berlinTag, isodow, tagPlus, tageDifferenz } from '@/lib/zeit'
import { ANRUFGRUND_LABEL, ERLAUBNIS_LABEL, GRUND_LABEL, PHASE_LABEL } from '@/texte/de'
import { phaseVon } from '@/lib/stufen'
import type { Lead, LeadRole, Member, Salutation, Settings } from '@/types/domain'
import { Mono } from './Mono'
import { SPALTE_FELD, SPALTEN_LABEL, type SpaltenKey } from './spaltenKeys'
import { anzeigeName } from '@/lib/mitglied'

/**
 * Tabellenzeile = Lead + clientseitig angereicherte Flags (Firmensperre aus companies, Sperrlisten-Treffer) + Firmen-Embed für
 * lib/gates (`companies.do_not_contact`). Die Liste aus data/leads lädt `*` ohne Embed (M0) – deshalb kommt die Sperre aus useCompanies.
 */
export type LeadZeile = Lead & {
  firmaGesperrt: boolean
  sperrliste: boolean
  companies: { do_not_contact: boolean } | null
}

export function mitFirmensperre(l: Lead, firmaGesperrt: boolean, sperrliste: boolean): LeadZeile {
  return { ...l, firmaGesperrt, sperrliste, companies: { do_not_contact: firmaGesperrt } }
}

export type Bearbeitung = { rowId: string; spalte: SpaltenKey } | null

export type SpaltenOptionen = {
  heute: string
  settings: Settings | null | undefined
  members: readonly Member[]
  bearbeitung: Bearbeitung
  onSave: (lead: LeadZeile, spalte: SpaltenKey, wert: string | null) => void
  onCancel: () => void
  onTab: (richtung: 1 | -1) => void
  /** Import-Stapel (Spalte Quelle) */
  batches?: readonly { id: string; label: string | null; created_at: string }[]
  /** Anker einer Zeilen-Aktion (Popover/Dialog) – wird in der Name-Zelle der Zeile gerendert */
  anker?: { rowId: string; node: ReactNode }
  /**
   * Unternehmen als zweite Zeile unter dem Namen (Spalte Unternehmen fehlt). Ohne Angabe wie bisher über die Fensterbreite
   * (`max-xl`); LeadsSeite setzt es nach der gemessenen Tabellenbreite (Runde 3).
   */
  firmaUnterName?: boolean
}

export const ROLLE_KURZ: Record<LeadRole, string> = {
  geschaeftsfuehrer: 'GF',
  inhaber: 'Inh.',
  kundenbetreuer: 'KB',
  innendienst: 'ID',
  vertrieb: 'Vertr.',
  projektleiter: 'PL',
  sonstiges: 'Sonst.',
  unbekannt: '–',
}
export const ROLLE_LABEL: Record<LeadRole, string> = {
  geschaeftsfuehrer: 'Geschäftsführer',
  inhaber: 'Inhaber',
  kundenbetreuer: 'Kundenbetreuer',
  innendienst: 'Innendienst',
  vertrieb: 'Vertrieb',
  projektleiter: 'Projektleiter',
  sonstiges: 'Sonstiges',
  unbekannt: 'Unbekannt',
}
export const ROLLE_OPTIONEN: SelectOption[] = (Object.keys(ROLLE_LABEL) as LeadRole[]).map((r) => ({
  value: r,
  label: ROLLE_LABEL[r],
}))
/** „Geschäftsführer“ statt „Geschäftsführer · Geschäftsführer“ (Import setzt role_title oft = Rollenwort); abweichender Titel bleibt dran. */
export function rolleAnzeige(role: LeadRole, titel: string | null | undefined): string | null {
  const t = titel?.trim() || null
  if (role === 'unbekannt') return t
  const label = ROLLE_LABEL[role]
  if (!t || t.toLowerCase() === label.toLowerCase()) return label
  return `${label} · ${t}`
}
export const ANREDE_LABEL: Record<Salutation, string> = { herr: 'Herr', frau: 'Frau', neutral: '–' }
export const ANREDE_OPTIONEN: SelectOption[] = [
  { value: 'herr', label: 'Herr' },
  { value: 'frau', label: 'Frau' },
  { value: 'neutral', label: '–' },
]
const QUELLE_LABEL: Record<string, string> = {
  app: 'Angelegt',
  import_sheet: 'Import · CRM-Tabelle',
  import_csv: 'Import · CSV',
  schnellimport: 'Schnellimport',
  linkedin_export: 'LinkedIn-Export',
  telefonie: 'Telefonie',
  email_sync: 'E-Mail',
}

/** Zeitbalken links (DESIGN-SYSTEM § 5.10): heute Lime, überfällig Amber. */
export function zeitBalken(l: Pick<Lead, 'next_action_at' | 'stage'>, heute: string): ZeitBalken {
  if (!l.next_action_at || l.stage === 'beendet') return null
  const t = berlinTag(l.next_action_at)
  if (t === heute) return 'today'
  if (t < heute) return 'overdue'
  return null
}

export type FaelligkeitsGruppe = 'ueberfaellig' | 'heute' | 'woche' | 'spaeter' | 'ohne'
export const GRUPPE_LABEL: Record<FaelligkeitsGruppe, string> = {
  ueberfaellig: 'Überfällig',
  heute: 'Heute',
  woche: 'Diese Woche',
  spaeter: 'Später',
  ohne: 'Ohne',
}

/** Gruppierung „Fälligkeit“ (BAUPLAN § 3.3): Überfällig (< heute) · Heute · Diese Woche (≤ Sonntag) · Später · Ohne. */
export function faelligkeitsGruppe(l: Pick<Lead, 'next_action_at'>, heute: string): FaelligkeitsGruppe {
  if (!l.next_action_at) return 'ohne'
  const t = berlinTag(l.next_action_at)
  if (t < heute) return 'ueberfaellig'
  if (t === heute) return 'heute'
  const sonntag = tagPlus(heute, 7 - isodow(heute))
  if (t <= sonntag) return 'woche'
  return 'spaeter'
}

/** „Mi 08.10. −6 T“ · „Mi 14.10. heute“ · „Mi 14.10. 10:30“ (Rückruf) · „Do 16.10.“ */
export function naechsteAktionText(
  l: Pick<Lead, 'next_action_at' | 'next_action_kind' | 'stage'>,
  heute: string,
): { text: string; ton: 'today' | 'overdue' | 'later' | null } {
  if (!l.next_action_at) return { text: '–', ton: null }
  const kurz = fmtDatumKurz(l.next_action_at)
  const t = berlinTag(l.next_action_at)
  if (l.next_action_kind === 'rueckruf' || l.next_action_kind === 'meeting') {
    const zeit = fmtZeit(l.next_action_at)
    return { text: `${kurz} ${zeit}`, ton: t === heute ? 'today' : t < heute ? 'overdue' : 'later' }
  }
  if (t === heute) return { text: `${kurz} heute`, ton: 'today' }
  // Überfällig immer „Datum −N T“ (wie ZeitChip): nicht „gestern“ (schnitt bei 1440 zu „geste…“ ab) und ab 7 Tagen nicht das
  // Datum doppelt („Do 08.10. Do 08.10.“, echte Daten 15.10.2026) – die Tage zählen bei 63 Überfälligen
  if (t < heute) return { text: `${kurz} ${MINUS}${tageDifferenz(t, heute)} T`, ton: 'overdue' }
  return { text: kurz, ton: 'later' }
}

/** Kompakte Variante für Kanban-Karten: genau EIN Datum („heute“ · „Do 08.10.“), bei Rückruf/Termin mit Uhrzeit. */
export function naechsteAktionKurz(
  l: Pick<Lead, 'next_action_at' | 'next_action_kind' | 'stage'>,
  heute: string,
): { text: string; ton: 'today' | 'overdue' | 'later' | null } {
  if (!l.next_action_at) return { text: '–', ton: null }
  const t = berlinTag(l.next_action_at)
  const ton = t === heute ? 'today' : t < heute ? 'overdue' : 'later'
  const tag = ton === 'today' ? 'heute' : fmtDatumKurz(l.next_action_at)
  const mitZeit = l.next_action_kind === 'rueckruf' || l.next_action_kind === 'meeting'
  return { text: mitZeit ? `${tag} ${fmtZeit(l.next_action_at)}` : tag, ton }
}

/** Spalte Schritt: „4 · Kurzfristig 2“ / „Versuch 3/5“ / „E1 Nachfassen“ / „Rückruf 10:30“ / „–“ (aus next_action_*). */
export function schrittText(
  l: Pick<Lead, 'next_action_kind' | 'next_action_label' | 'next_action_at' | 'stage'>,
): string {
  if (l.stage === 'beendet' || l.stage === 'kunde') return '–'
  switch (l.next_action_kind) {
    case 'rueckruf':
      return `Rückruf${l.next_action_at ? ` ${fmtZeit(l.next_action_at)}` : ''}`
    case 'wiedervorlage':
      return l.next_action_label ?? 'Wiedervorlage'
    case 'antworten':
      return 'Antworten'
    case 'meeting':
      return l.next_action_label ?? 'Termin'
    case 'sequenz_schritt':
    case 'aufgabe':
      return l.next_action_label ?? '–'
    default:
      return l.next_action_label ?? '–'
  }
}

/** Gesprächsphase 1–4 (Eröffnung · Bedarf · Pitch · Follow-ups) als Mono-Präfix der Spalte Schritt. */
export function gespraechsphase(stage: Lead['stage']): number | null {
  switch (stage) {
    case 'gespraech_eroeffnet':
      return 1
    case 'dm_beantwortet':
    case 'bedarfsermittlung':
      return 2
    case 'pitch':
      return 3
    case 'dm_follow_up':
      return 4
    default:
      return null
  }
}

export type KanalZustand = 'aktiv' | 'vorhanden' | null
/** Kanal-Glyphen: aktiv = voll, vorhanden-aber-inaktiv = gedimmt (ux § 3.2.2). Ohne Enrollment-Embed heuristisch aus dem Lead. */
export function kanalZustand(
  l: Pick<Lead, 'linkedin_url' | 'phone_e164' | 'email' | 'call_basis' | 'email_consent_basis' | 'stage'>,
): Record<'linkedin' | 'telefon' | 'email', KanalZustand> {
  const phase = phaseVon(l.stage).key
  const linkedinAktiv = !['kunde', 'beendet', 'wiedervorlage', 'angefragt'].includes(phase)
  return {
    linkedin: l.linkedin_url ? (linkedinAktiv ? 'aktiv' : 'vorhanden') : null,
    telefon: l.phone_e164 ? (l.call_basis ? 'aktiv' : 'vorhanden') : null,
    email: l.email
      ? l.email_consent_basis !== 'none' && l.email_consent_basis !== 'revoked'
        ? 'aktiv'
        : 'vorhanden'
      : null,
  }
}

export function istFrei(l: Pick<Lead, 'owner_id' | 'released'>): boolean {
  return l.released || !l.owner_id
}

function mitglied(members: readonly Member[], id: string | null): Member | null {
  return id ? (members.find((m) => m.id === id) ?? null) : null
}

const h = spaltenHelper<LeadZeile>()

/**
 * Abweichung von DESIGN-SYSTEM § 5.10 nach Sichtprüfung mit echten Daten (15.10.2026, Tabelle 1136 px bei 1440er Fenster):
 * Unternehmen kürzte „Energiekonzepte…“ (136 px), Notiz blieb bei 69 px („First O…“), Kanal (74 px) und Zuständig (97 px) waren für
 * eine Glyphe bzw. einen Avatar zu breit, „LETZTE BEWEGUNG“ wurde zu „LETZTE BEW…“. Rolle fällt weg, wenn kein Lead eine hat
 * (LeadsSeite). Nächste Aktion braucht für „Mo 05.10. −10 T“ ≈ 141 px. Summe 85 % + Auswahl 28 px; Notiz = Rest (≈ 140 px).
 */
export const BREITE_ECHT = {
  name: '15%',
  unternehmen: '15%',
  rolle: '7%',
  kanal: '5%',
  phase: '9.5%',
  schritt: '10%',
  zustaendig: '7%',
  letzteBewegung: '10%',
  naechsteAktion: '13.5%',
} as const

/**
 * Unter 1280 px bleiben nur Name (mit Firma darunter), Kanal, Phase, Schritt, Zuständig und Nächste Aktion – bei 1024 ist der Inhalt
 * wegen der 232-px-Sidebar nur ≈ 740 px breit (Runde 2: „Nächste Aktion“ war bei 1024 abgeschnitten). Dafür reicht diese Mindestbreite.
 */
export const MIN_BREITE_SCHMAL = 640

/** Rolle ausblenden, wenn kein geladener Lead eine Rolle hat (echte Daten: alle 216 „unbekannt“ → überall „–“, Kopf „RO…“). */
export function ohneLeereRolle<T extends { id?: string }>(defs: T[], rows: readonly { role?: string | null }[]): T[] {
  if (rows.length === 0 || rows.some((r) => !!r.role && r.role !== 'unbekannt')) return defs
  return defs.filter((d) => d.id !== 'rolle')
}

/**
 * Spalten, die unter einer Breite ausgeblendet sind (`meta.ausblenden`), ganz weglassen statt per CSS verstecken: DataTable rendert die
 * `<col>`-Breiten ohne die Hide-Klasse – unter 1280 px rutschten sonst alle Breiten eine Spalte nach links (Phase-Chip „E…“, Kopf „KANA“).
 */
export function ohneVerdeckte<T extends { meta?: unknown }>(defs: T[], unterXl: boolean, unterLg: boolean): T[] {
  return defs.filter((d) => {
    const a = (d.meta as { ausblenden?: 'lg' | 'xl' } | undefined)?.ausblenden
    return !((a === 'xl' && unterXl) || (a === 'lg' && unterLg))
  })
}

/** Kurze Tabellenköpfe für schmale Spalten (Runde 3); Spaltenwahl, CSV und Fuß nutzen SPALTEN_LABEL. */
export const KOPF_KURZ = { letzteBewegung: 'Zuletzt' } as const
/** Runde 3 (Migration 8): `last_activity_at` = letzter Kontakt – Stufenwechsel, Notizen und Importe zählen nicht mehr. */
export const LETZTE_BEWEGUNG_TITEL =
  'Letzte Bewegung = letzter Kontakt (Anfrage, Annahme, Nachricht, Antwort, Pitch, Anruf, Mail, Termin); Stufenwechsel, Notizen und Importe zählen nicht'

/**
 * Spaltensatz nach der gemessenen Tabellenbreite (Container, nicht Fenster – ab 1600 px steht der Peek als dritte Spalte daneben):
 * - `breit` (≥ 1100 px, 1440er Fenster = 1136 px): alle Standardspalten, Notiz bekommt den Rest (≈ 160 px)
 * - `mittel` (960–1099 px, 1280er Fenster = 984 px): ohne Notiz (Name ≥ 160 px)
 * - `schmal` (< 960 px, 1024er Fenster = 741 px, 1680er Fenster mit Peek-Spalte = 928 px): Name (Firma darunter) · Phase · Schritt · Zuständig · Nächste Aktion
 * Runde 3 (echte Daten): bei 1024 war die Tabelle 1040 px in 741 px, „Nächste Aktion“ abgeschnitten; bei 1440 Notiz 69 px.
 */
export type SpaltenStufe = 'breit' | 'mittel' | 'schmal'
export const STUFE_AB = { breit: 1100, mittel: 960 } as const

export function spaltenStufe(breite: number): SpaltenStufe {
  if (breite >= STUFE_AB.breit) return 'breit'
  if (breite >= STUFE_AB.mittel) return 'mittel'
  return 'schmal'
}

const FEHLT_AB: Record<SpaltenStufe, readonly SpaltenKey[]> = {
  breit: [],
  mittel: ['notiz'],
  schmal: ['notiz', 'unternehmen', 'rolle', 'kanal', 'letzteBewegung'],
}

/**
 * Breiten je Stufe: feste px für Inhalte fester Breite (Glyphe, Chip, Avatar + Vorname, Mono-Datum „Mo 05.10. −10 T“), Prozent für
 * Text, `auto` = Rest (Notiz breit, sonst Name). Summe ohne Rest bei 1136 px ≈ 985 px → Notiz ≈ 150 px.
 */
/** 118 px: „Erstgespräch“/„Beantwortet“ stehen ganz im Chip (Runde 3: bei 104 px „Erstgespr…“, Text 66 von 75 px). */
export const PHASE_BREITE = '118px'

export const BREITEN: Record<SpaltenStufe, Partial<Record<SpaltenKey, string>>> = {
  breit: {
    name: '14%',
    unternehmen: '15%',
    rolle: '64px',
    kanal: '64px',
    phase: PHASE_BREITE,
    schritt: '10%',
    zustaendig: '100px',
    letzteBewegung: '92px',
    naechsteAktion: '140px',
    notiz: 'auto',
  },
  mittel: {
    name: 'auto',
    unternehmen: '16%',
    rolle: '64px',
    kanal: '64px',
    phase: PHASE_BREITE,
    schritt: '12%',
    zustaendig: '100px',
    letzteBewegung: '92px',
    naechsteAktion: '140px',
  },
  schmal: {
    name: 'auto',
    phase: PHASE_BREITE,
    schritt: '21%',
    zustaendig: '100px',
    naechsteAktion: '140px',
  },
}

/** Spalten der Stufe: fehlende weglassen, Breiten setzen, `ausblenden` (Fensterbreite) entfällt – die Stufe entscheidet. */
export function fuerStufe<T extends { id?: string; meta?: unknown }>(defs: T[], stufe: SpaltenStufe): T[] {
  const fehlt = FEHLT_AB[stufe]
  return defs
    .filter((d) => !fehlt.includes(d.id as SpaltenKey))
    .map((d) => {
      const breite = BREITEN[stufe][d.id as SpaltenKey]
      const meta = { ...((d.meta as object | undefined) ?? {}), ausblenden: undefined }
      return { ...d, meta: breite ? { ...meta, breite } : meta }
    })
}

/** Nur Standardspalten sichtbar → die Breiten passen ohne Querscroll (DataTable `minBreite = null`). */
export function nurStandardSpalten(ids: readonly (string | undefined)[]): boolean {
  return ids.every((id) => !!id && id in BREITEN.breit)
}

/** Baut die Spaltendefinitionen für die gewählten Keys. Die Reihenfolge ist die der Keys. */
export function leadSpalten(keys: readonly SpaltenKey[], o: SpaltenOptionen): DataTableSpalte<LeadZeile>[] {
  const bearbeitet = (rowId: string, key: SpaltenKey) => o.bearbeitung?.rowId === rowId && o.bearbeitung.spalte === key
  const memberOptionen: SelectOption[] = o.members
    .filter((m) => !!m.id)
    .map((m) => ({ value: m.id as string, label: anzeigeName(m, '') }))

  const defs: DataTableSpalte<LeadZeile>[] = []
  for (const key of keys) {
    switch (key) {
      case 'name':
        defs.push(
          h.accessor('full_name', {
            id: 'name',
            header: SPALTEN_LABEL.name,
            meta: { oeffnet: true, editierbar: true, breite: BREITE_ECHT.name },
            cell: (c) => {
              const l = c.row.original
              if (bearbeitet(l.id, 'name'))
                return (
                  <InlineEdit
                    art="text"
                    wert={l.full_name}
                    ariaLabel="Name"
                    onSave={(v) => o.onSave(l, 'name', v)}
                    onCancel={o.onCancel}
                    onTab={o.onTab}
                  />
                )
              return (
                <span className="relative flex min-w-0 items-center gap-2">
                  {o.anker?.rowId === l.id ? o.anker.node : null}
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn('block truncate font-medium', l.stage === 'beendet' ? 'text-ink-2' : 'text-ink')}
                      title={l.full_name ?? undefined}
                    >
                      {l.full_name ?? '–'}
                    </span>
                    <span
                      className={cn(
                        'text-ink-3 truncate text-[11.5px]',
                        o.firmaUnterName === undefined ? 'hidden max-xl:block' : o.firmaUnterName ? 'block' : 'hidden',
                      )}
                      title={l.company_name ?? undefined}
                    >
                      {l.company_name ?? ''}
                    </span>
                    {/* Runde 3: Chips in eigener Zeile unter dem Namen (wie in der mobilen Liste) – neben dem Namen ließ
                        „Firma gesperrt“ ihm nur 31 px („Ja…“) */}
                    {l.firmaGesperrt || l.sperrliste || l.released ? (
                      <span className="mt-0.5 flex min-w-0 flex-wrap gap-1" data-testid="name-chips">
                        {l.firmaGesperrt ? <Chip ton="danger">Firma gesperrt</Chip> : null}
                        {l.sperrliste ? <Chip ton="danger">Sperrliste</Chip> : null}
                        {l.released ? <Chip ton="muted">Frei</Chip> : null}
                      </span>
                    ) : null}
                  </span>
                </span>
              )
            },
          }),
        )
        break
      case 'unternehmen':
        defs.push(
          h.accessor('company_name', {
            id: 'unternehmen',
            header: SPALTEN_LABEL.unternehmen,
            meta: { editierbar: true, breite: BREITE_ECHT.unternehmen, ausblenden: 'xl' },
            cell: (c) => {
              const l = c.row.original
              if (bearbeitet(l.id, 'unternehmen'))
                return (
                  <InlineEdit
                    art="text"
                    wert={l.company_name}
                    ariaLabel="Unternehmen"
                    onSave={(v) => o.onSave(l, 'unternehmen', v)}
                    onCancel={o.onCancel}
                    onTab={o.onTab}
                  />
                )
              return l.company_name ? (
                <span className="text-ink-2 block truncate" title={l.company_name}>
                  {l.company_name}
                </span>
              ) : (
                <span className="text-ink-3 inline-flex items-center gap-1.5">
                  – <Chip ton="muted">fehlt</Chip>
                </span>
              )
            },
          }),
        )
        break
      case 'rolle':
        defs.push(
          h.accessor('role', {
            id: 'rolle',
            header: SPALTEN_LABEL.rolle,
            meta: { editierbar: true, breite: BREITE_ECHT.rolle, ausblenden: 'xl' },
            cell: (c) => {
              const l = c.row.original
              if (bearbeitet(l.id, 'rolle'))
                return (
                  <InlineEdit
                    art="select"
                    wert={l.role}
                    optionen={ROLLE_OPTIONEN}
                    ariaLabel="Rolle"
                    onSave={(v) => o.onSave(l, 'rolle', v)}
                    onCancel={o.onCancel}
                    onTab={o.onTab}
                  />
                )
              return <span title={l.role_title ?? ROLLE_LABEL[l.role]}>{ROLLE_KURZ[l.role]}</span>
            },
          }),
        )
        break
      case 'kanal':
        defs.push(
          h.display({
            id: 'kanal',
            header: SPALTEN_LABEL.kanal,
            enableSorting: false,
            meta: { breite: BREITE_ECHT.kanal },
            cell: (c) => {
              const z = kanalZustand(c.row.original)
              return (
                <span className="inline-flex items-center gap-1.5">
                  {z.linkedin ? <Glyph kanal="linkedin" aktiv={z.linkedin === 'aktiv'} /> : null}
                  {z.telefon ? <Glyph kanal="telefon" aktiv={z.telefon === 'aktiv'} /> : null}
                  {z.email ? <Glyph kanal="email" aktiv={z.email === 'aktiv'} /> : null}
                </span>
              )
            },
          }),
        )
        break
      case 'phase':
        defs.push(
          h.accessor('stage', {
            id: 'phase',
            header: SPALTEN_LABEL.phase,
            meta: { editierbar: true, breite: BREITE_ECHT.phase },
            cell: (c) => {
              const l = c.row.original
              if (bearbeitet(l.id, 'phase'))
                return (
                  <InlineEdit
                    art="phase"
                    wert={l.stage}
                    settings={o.settings ?? null}
                    onSave={(v) => o.onSave(l, 'phase', v)}
                    onCancel={o.onCancel}
                    onTab={o.onTab}
                  />
                )
              return (
                <StatusChip
                  stage={l.stage}
                  settings={o.settings}
                  className="max-w-full [&>span]:min-w-0 [&>span]:truncate"
                />
              )
            },
          }),
        )
        break
      case 'schritt':
        defs.push(
          h.accessor('next_action_label', {
            id: 'schritt',
            header: SPALTEN_LABEL.schritt,
            meta: { editierbar: true, breite: BREITE_ECHT.schritt },
            cell: (c) => {
              const l = c.row.original
              const text = schrittText(l)
              const n = l.next_action_kind === 'sequenz_schritt' ? gespraechsphase(l.stage) : null
              return (
                <span className="block truncate" title={text !== '–' ? text : undefined}>
                  {text !== '–' && n !== null ? (
                    <span className="text-ink-3 mr-1.5 font-mono text-[12.5px]">{n}</span>
                  ) : null}
                  {text !== '–' && l.next_action_kind === 'rueckruf' ? (
                    <span className="text-ink-3 mr-1.5 font-mono text-[12.5px]">☎</span>
                  ) : null}
                  {text}
                </span>
              )
            },
          }),
        )
        break
      case 'zustaendig':
        defs.push(
          h.accessor('owner_id', {
            id: 'zustaendig',
            header: SPALTEN_LABEL.zustaendig,
            meta: { editierbar: true, breite: BREITE_ECHT.zustaendig },
            cell: (c) => {
              const l = c.row.original
              if (bearbeitet(l.id, 'zustaendig'))
                return (
                  <InlineEdit
                    art="zustaendig"
                    wert={istFrei(l) ? null : l.owner_id}
                    optionen={memberOptionen}
                    onSave={(v) => o.onSave(l, 'zustaendig', v)}
                    onCancel={o.onCancel}
                    onTab={o.onTab}
                  />
                )
              const owner = istFrei(l) ? null : mitglied(o.members, l.owner_id)
              const sales =
                l.sales_owner_id && l.sales_owner_id !== l.owner_id ? mitglied(o.members, l.sales_owner_id) : null
              // Runde 3: die Spalte ist für den Kopf „Zuständig“ ohnehin ≈ 100 px breit – der Vorname neben dem Avatar nutzt den Platz
              const titel = owner
                ? `Zuständig: ${anzeigeName(owner)}${sales ? ` · Sales: ${anzeigeName(sales)}` : ''}`
                : 'Frei'
              return (
                <span className="flex min-w-0 items-center gap-1.5" title={titel}>
                  <Avatar member={owner} zweiter={sales} className="shrink-0" />
                  <span className={cn('min-w-0 truncate text-[13px]', owner ? 'text-ink-2' : 'text-ink-3')}>
                    {owner ? anzeigeName(owner) : 'Frei'}
                  </span>
                </span>
              )
            },
          }),
        )
        break
      case 'letzteBewegung':
        defs.push(
          h.accessor('last_activity_at', {
            id: 'letzteBewegung',
            // Runde 3: „LETZTE BEWEGUNG“ (≈ 145 px) wurde zu „LETZTE BEW…“ – der Tabellenkopf sagt kurz „Zuletzt“, Spaltenwahl und CSV
            // behalten den langen Namen
            header: KOPF_KURZ.letzteBewegung,
            meta: {
              rechts: true,
              mono: true,
              breite: BREITE_ECHT.letzteBewegung,
              ausblenden: 'xl',
              kopfTitel: LETZTE_BEWEGUNG_TITEL,
            },
            cell: (c) => {
              const v = c.getValue()
              return v ? <Mono title={relativ(v, o.heute)}>{fmtDatumKurz(v)}</Mono> : <Mono ton="later">–</Mono>
            },
          }),
        )
        break
      case 'naechsteAktion':
        defs.push(
          h.accessor('next_action_at', {
            id: 'naechsteAktion',
            header: SPALTEN_LABEL.naechsteAktion,
            meta: { editierbar: true, rechts: true, mono: true, breite: BREITE_ECHT.naechsteAktion },
            cell: (c) => {
              const l = c.row.original
              if (bearbeitet(l.id, 'naechsteAktion'))
                return (
                  <InlineEdit
                    art="datum"
                    wert={l.next_action_at ? berlinTag(l.next_action_at) : null}
                    ariaLabel="Nächste Aktion"
                    onSave={(v) => o.onSave(l, 'naechsteAktion', v)}
                    onCancel={o.onCancel}
                    onTab={o.onTab}
                  />
                )
              const { text, ton } = naechsteAktionText(l, o.heute)
              return (
                <Mono ton={ton} title={l.next_action_label ?? undefined}>
                  {text}
                </Mono>
              )
            },
          }),
        )
        break
      case 'notiz':
        defs.push(
          h.accessor('notes', {
            id: 'notiz',
            header: SPALTEN_LABEL.notiz,
            enableSorting: false,
            meta: { editierbar: true, breite: SPALTEN_BREITE.notiz, ausblenden: 'xl' },
            cell: (c) => {
              const l = c.row.original
              if (bearbeitet(l.id, 'notiz'))
                return (
                  <InlineEdit
                    art="textarea"
                    wert={l.notes}
                    ariaLabel="Notiz"
                    onSave={(v) => o.onSave(l, 'notiz', v)}
                    onCancel={o.onCancel}
                    onTab={o.onTab}
                  />
                )
              return (
                <span className="text-ink-3 block truncate text-[12.5px]" title={l.notes ?? undefined}>
                  {l.notes ?? ''}
                </span>
              )
            },
          }),
        )
        break
      case 'anrede':
        defs.push(
          h.accessor('salutation', {
            id: 'anrede',
            header: SPALTEN_LABEL.anrede,
            meta: { editierbar: true, breite: '6%' },
            cell: (c) => {
              const l = c.row.original
              if (bearbeitet(l.id, 'anrede'))
                return (
                  <InlineEdit
                    art="select"
                    wert={l.salutation}
                    optionen={ANREDE_OPTIONEN}
                    ariaLabel="Anrede"
                    onSave={(v) => o.onSave(l, 'anrede', v)}
                    onCancel={o.onCancel}
                    onTab={o.onTab}
                  />
                )
              return <span>{ANREDE_LABEL[l.salutation]}</span>
            },
          }),
        )
        break
      case 'ort':
        defs.push(
          h.accessor('city', {
            id: 'ort',
            header: SPALTEN_LABEL.ort,
            meta: { editierbar: true, breite: '9%' },
            cell: (c) => {
              const l = c.row.original
              if (bearbeitet(l.id, 'ort'))
                return (
                  <InlineEdit
                    art="text"
                    wert={l.city}
                    ariaLabel="Ort"
                    onSave={(v) => o.onSave(l, 'ort', v)}
                    onCancel={o.onCancel}
                    onTab={o.onTab}
                  />
                )
              return <span className="text-ink-2">{l.city ?? '–'}</span>
            },
          }),
        )
        break
      case 'linkedin':
        defs.push(
          h.accessor('linkedin_url', {
            id: 'linkedin',
            header: SPALTEN_LABEL.linkedin,
            enableSorting: false,
            meta: { mono: true, breite: '14%' },
            cell: (c) => {
              const v = c.getValue()
              return <Mono title={v ?? undefined}>{v ? linkedinAnzeige(v) : '–'}</Mono>
            },
          }),
        )
        break
      case 'telefon':
        defs.push(
          h.accessor('phone_e164', {
            id: 'telefon',
            header: SPALTEN_LABEL.telefon,
            enableSorting: false,
            meta: { mono: true, breite: '11%' },
            cell: (c) => <Mono>{c.getValue() ? fmtTelefon(c.getValue()) : '–'}</Mono>,
          }),
        )
        break
      case 'email':
        defs.push(
          h.accessor('email', {
            id: 'email',
            header: SPALTEN_LABEL.email,
            enableSorting: false,
            meta: { mono: true, breite: '14%' },
            cell: (c) => <Mono>{c.getValue() ?? '–'}</Mono>,
          }),
        )
        break
      case 'angefragtAm':
        defs.push(
          h.accessor('stage_changed_at', {
            id: 'angefragtAm',
            header: SPALTEN_LABEL.angefragtAm,
            meta: { rechts: true, mono: true, breite: '10%' },
            cell: (c) => {
              const l = c.row.original
              const v = l.stage === 'vernetzung_gesendet' ? l.stage_changed_at : null
              return <Mono title={v ? relativ(v, o.heute) : undefined}>{v ? fmtDatumKurz(v) : '–'}</Mono>
            },
          }),
        )
        break
      case 'followUps':
        defs.push(
          h.accessor('follow_up_count', {
            id: 'followUps',
            header: SPALTEN_LABEL.followUps,
            meta: { rechts: true, mono: true, breite: '7%' },
            cell: (c) => <Mono>{c.getValue()}</Mono>,
          }),
        )
        break
      case 'erlaubnis':
        defs.push(
          h.accessor('email_consent_basis', {
            id: 'erlaubnis',
            header: SPALTEN_LABEL.erlaubnis,
            meta: { breite: '12%' },
            cell: (c) => (
              <span className="text-ink-2 truncate">{ERLAUBNIS_LABEL[c.row.original.email_consent_basis]}</span>
            ),
          }),
        )
        break
      case 'anrufgrund':
        defs.push(
          h.accessor('call_basis', {
            id: 'anrufgrund',
            header: SPALTEN_LABEL.anrufgrund,
            meta: { breite: '12%' },
            cell: (c) => {
              const v = c.row.original.call_basis
              return v ? (
                <span className="text-ink-2 truncate">{ANRUFGRUND_LABEL[v]}</span>
              ) : (
                // Amber heißt nur „überfällig“ (DESIGN-SYSTEM § 3.2) – ein fehlender Anrufgrund ist ein Hinweis (Runde 3, wie die Telefon-Karte)
                <span className="text-ink-3 text-[12.5px]">fehlt</span>
              )
            },
          }),
        )
        break
      case 'quelle':
        defs.push(
          h.accessor('source', {
            id: 'quelle',
            header: SPALTEN_LABEL.quelle,
            enableSorting: false,
            meta: { breite: '12%' },
            cell: (c) => {
              const l = c.row.original
              const batch = l.source_batch_id ? o.batches?.find((b) => b.id === l.source_batch_id) : null
              return (
                <span className="text-ink-2 truncate">
                  {QUELLE_LABEL[l.source] ?? l.source}
                  {batch ? ` · ${batch.label ?? fmtDatumKurz(batch.created_at)}` : ''}
                </span>
              )
            },
          }),
        )
        break
      case 'angelegtAm':
        defs.push(
          h.accessor('created_at', {
            id: 'angelegtAm',
            header: SPALTEN_LABEL.angelegtAm,
            meta: { rechts: true, mono: true, breite: '9%' },
            cell: (c) => <Mono>{fmtDatumKurz(c.getValue())}</Mono>,
          }),
        )
        break
      case 'beendetGrund':
        defs.push(
          h.accessor('ended_reason', {
            id: 'beendetGrund',
            header: SPALTEN_LABEL.beendetGrund,
            meta: { breite: '12%' },
            cell: (c) => {
              const l = c.row.original
              const v = l.ended_reason
              return (
                <span className="text-ink-2 truncate" title={l.ended_note ?? undefined}>
                  {v ? (o.settings?.ended_reason_labels?.[v] ?? GRUND_LABEL[v]) : '–'}
                  {l.ended_at ? ` · ${fmtDatumKurz(l.ended_at)}` : ''}
                </span>
              )
            },
          }),
        )
        break
      case 'wiedervorlageAm':
        defs.push(
          h.accessor('next_action_at', {
            id: 'wiedervorlageAm',
            header: SPALTEN_LABEL.wiedervorlageAm,
            meta: { rechts: true, mono: true, breite: '10%' },
            cell: (c) => {
              const l = c.row.original
              const v = l.stage === 'langfristig' ? l.next_action_at : null
              return <Mono ton={v ? naechsteAktionText(l, o.heute).ton : null}>{v ? fmtDatum(v) : '–'}</Mono>
            },
          }),
        )
        break
      case 'geloeschtAm':
        defs.push(
          h.accessor('deleted_at', {
            id: 'geloeschtAm',
            header: SPALTEN_LABEL.geloeschtAm,
            meta: { rechts: true, mono: true, breite: '10%' },
            cell: (c) => {
              const v = c.getValue()
              return (
                <Mono title={v ? `endgültig weg am ${fmtDatum(tagPlus(berlinTag(v), 30))}` : undefined}>
                  {v ? fmtDatumKurz(v) : '–'}
                </Mono>
              )
            },
          }),
        )
        break
      case 'id':
        defs.push(
          h.accessor('id', {
            id: 'id',
            header: SPALTEN_LABEL.id,
            enableSorting: false,
            meta: { mono: true, breite: '7%' },
            cell: (c) => <Mono title={c.getValue()}>#{kurzId(c.getValue())}</Mono>,
          }),
        )
        break
    }
  }
  return h.columns(defs)
}

/** Mobil-Zeile (DESIGN-SYSTEM § 5.10): Name + Avatar · Unternehmen + Phase-Chip · Nächste Aktion + Schritt. */
export function mobilZeile(
  l: LeadZeile,
  o: Pick<SpaltenOptionen, 'heute' | 'settings' | 'members'>,
  zustand: { cursor: boolean; ausgewaehlt: boolean; zeit: ZeitBalken },
): ReactNode {
  const { text, ton } = naechsteAktionText(l, o.heute)
  const owner = istFrei(l) ? null : mitglied(o.members, l.owner_id)
  const schritt = schrittText(l)
  // Feste 56 px (virtualisierte Liste): 22 + 18 + 16 px. Vorher 78 px Inhalt → Zeilen überlappten (Sichtprüfung 390 px).
  const klein = 'h-[18px]! shrink-0 px-1.5! text-[11px]!'
  return (
    <div className="flex h-14 min-w-0 flex-col justify-center pr-3" data-mobil-zeile>
      <div className="flex h-[22px] min-w-0 items-center gap-2">
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-[14px] leading-[18px] font-medium',
            l.stage === 'beendet' ? 'text-ink-2' : 'text-ink',
          )}
        >
          {l.full_name ?? '–'}
        </span>
        {l.firmaGesperrt ? (
          <Chip ton="danger" className={klein}>
            Firma gesperrt
          </Chip>
        ) : null}
        {zustand.ausgewaehlt ? (
          <Chip ton="neu" className={klein}>
            gewählt
          </Chip>
        ) : null}
        <Avatar member={owner} className="shrink-0" />
      </div>
      <div className="flex h-[18px] min-w-0 items-center gap-2">
        <span className="text-ink-3 min-w-0 flex-1 truncate text-[11.5px] leading-none">{l.company_name ?? '–'}</span>
        <StatusChip stage={l.stage} settings={o.settings} className={klein} />
      </div>
      <div className="flex h-4 min-w-0 items-center gap-2 leading-none">
        <Mono ton={ton}>{text}</Mono>
        {schritt !== '–' ? <span className="text-ink-3 min-w-0 truncate text-[12px]">{schritt}</span> : null}
      </div>
    </div>
  )
}

/** CSV-Spalten der aktuellen Ansicht (LE-14): Labels wie im Kopf, Enums als Wortlaut, Daten über lib/csv. */
export function csvSpalten(
  keys: readonly SpaltenKey[],
  o: Pick<SpaltenOptionen, 'heute' | 'settings' | 'members' | 'batches'>,
): CsvSpalte<LeadZeile>[] {
  const m = (id: string | null) => {
    const x = mitglied(o.members, id)
    return x ? anzeigeName(x, '') : ''
  }
  return keys.map((key): CsvSpalte<LeadZeile> => {
    const label = SPALTEN_LABEL[key]
    switch (key) {
      case 'name':
        return { key: 'full_name', label }
      case 'unternehmen':
        return { key: 'company_name', label }
      case 'rolle':
        return { key: 'role', label, wert: (l) => ROLLE_LABEL[l.role] }
      case 'kanal':
        return {
          key: 'kanal',
          label,
          wert: (l) => {
            const z = kanalZustand(l)
            return [z.linkedin && 'LinkedIn', z.telefon && 'Telefon', z.email && 'E-Mail'].filter(Boolean).join(', ')
          },
        }
      case 'phase':
        return {
          key: 'stage',
          label,
          wert: (l) => `${PHASE_LABEL[phaseVon(l.stage).key]} · ${stageLabel(l.stage, o.settings ?? undefined)}`,
        }
      case 'schritt':
        return { key: 'next_action_label', label, wert: (l) => schrittText(l) }
      case 'zustaendig':
        return { key: 'owner_id', label, wert: (l) => (istFrei(l) ? 'Frei' : m(l.owner_id)) }
      case 'letzteBewegung':
        return { key: 'last_activity_at', label, wert: (l) => (l.last_activity_at ? fmtDatum(l.last_activity_at) : '') }
      case 'naechsteAktion':
        return { key: 'next_action_at', label, wert: (l) => (l.next_action_at ? fmtDatum(l.next_action_at) : '') }
      case 'notiz':
        return { key: 'notes', label }
      case 'anrede':
        return { key: 'salutation', label, wert: (l) => ANREDE_LABEL[l.salutation] }
      case 'ort':
        return { key: 'city', label }
      case 'linkedin':
        return { key: 'linkedin_url', label }
      case 'telefon':
        return { key: 'phone_e164', label }
      case 'email':
        return { key: 'email', label }
      case 'angefragtAm':
        return {
          key: 'stage_changed_at',
          label,
          wert: (l) => (l.stage === 'vernetzung_gesendet' && l.stage_changed_at ? fmtDatum(l.stage_changed_at) : ''),
        }
      case 'followUps':
        return { key: 'follow_up_count', label }
      case 'erlaubnis':
        return { key: 'email_consent_basis', label, wert: (l) => ERLAUBNIS_LABEL[l.email_consent_basis] }
      case 'anrufgrund':
        return { key: 'call_basis', label, wert: (l) => (l.call_basis ? ANRUFGRUND_LABEL[l.call_basis] : '') }
      case 'quelle':
        return { key: 'source', label, wert: (l) => QUELLE_LABEL[l.source] ?? l.source }
      case 'angelegtAm':
        return { key: 'created_at', label, wert: (l) => fmtDatum(l.created_at) }
      case 'beendetGrund':
        return {
          key: 'ended_reason',
          label,
          wert: (l) =>
            l.ended_reason ? (o.settings?.ended_reason_labels?.[l.ended_reason] ?? GRUND_LABEL[l.ended_reason]) : '',
        }
      case 'wiedervorlageAm':
        return {
          key: 'next_action_at',
          label,
          wert: (l) => (l.stage === 'langfristig' && l.next_action_at ? fmtDatum(l.next_action_at) : ''),
        }
      case 'geloeschtAm':
        return { key: 'deleted_at', label, wert: (l) => (l.deleted_at ? fmtDatum(l.deleted_at) : '') }
      case 'id':
        return { key: 'id', label }
    }
  })
}

/** Spalten-ID der Tabelle ↔ Sortierfeld (für SortingState ↔ LeadFilter.sort). */
export function sortFeld(spalte: string): keyof Lead | null {
  return SPALTE_FELD[spalte as SpaltenKey] ?? null
}

/** Tage ohne Bewegung (Badge „12 T ohne Bewegung“, ux § 4.5): Kalendertage seit last_activity_at. */
export function tageOhneBewegung(l: Pick<Lead, 'last_activity_at' | 'created_at'>, heute: string): number {
  const von = l.last_activity_at ?? l.created_at
  return Math.max(0, tageDifferenz(berlinTag(von), heute))
}
