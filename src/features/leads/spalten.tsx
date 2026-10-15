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
import { fmtDatum, fmtDatumKurz, fmtZeit, relativ } from '@/lib/format'
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
  if (t < heute) return { text: `${kurz} ${relativ(l.next_action_at, heute)}`, ton: 'overdue' }
  return { text: kurz, ton: 'later' }
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

/** Baut die Spaltendefinitionen für die gewählten Keys. Die Reihenfolge ist die der Keys. */
export function leadSpalten(keys: readonly SpaltenKey[], o: SpaltenOptionen): DataTableSpalte<LeadZeile>[] {
  const bearbeitet = (rowId: string, key: SpaltenKey) => o.bearbeitung?.rowId === rowId && o.bearbeitung.spalte === key
  const memberOptionen: SelectOption[] = o.members
    .filter((m) => !!m.id)
    .map((m) => ({ value: m.id as string, label: m.short_name ?? m.display_name ?? '' }))

  const defs: DataTableSpalte<LeadZeile>[] = []
  for (const key of keys) {
    switch (key) {
      case 'name':
        defs.push(
          h.accessor('full_name', {
            id: 'name',
            header: SPALTEN_LABEL.name,
            meta: { oeffnet: true, editierbar: true, breite: SPALTEN_BREITE.name },
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
                  <span className="min-w-0">
                    <span
                      className={cn('block truncate font-medium', l.stage === 'beendet' ? 'text-ink-2' : 'text-ink')}
                    >
                      {l.full_name ?? '–'}
                    </span>
                    <span className="text-ink-3 hidden truncate text-[11.5px] max-xl:block">
                      {l.company_name ?? ''}
                    </span>
                  </span>
                  {l.firmaGesperrt ? <Chip ton="danger">Firma gesperrt</Chip> : null}
                  {l.sperrliste ? <Chip ton="danger">Sperrliste</Chip> : null}
                  {l.released ? <Chip ton="muted">Frei</Chip> : null}
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
            meta: { editierbar: true, breite: SPALTEN_BREITE.unternehmen, ausblenden: 'xl' },
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
                <span className="text-ink-2">{l.company_name}</span>
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
            meta: { editierbar: true, breite: SPALTEN_BREITE.rolle },
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
            meta: { breite: SPALTEN_BREITE.kanal },
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
            meta: { editierbar: true, breite: SPALTEN_BREITE.phase },
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
              return <StatusChip stage={l.stage} settings={o.settings} />
            },
          }),
        )
        break
      case 'schritt':
        defs.push(
          h.accessor('next_action_label', {
            id: 'schritt',
            header: SPALTEN_LABEL.schritt,
            meta: { editierbar: true, breite: SPALTEN_BREITE.schritt },
            cell: (c) => {
              const l = c.row.original
              const text = schrittText(l)
              const n = l.next_action_kind === 'sequenz_schritt' ? gespraechsphase(l.stage) : null
              return (
                <span className="truncate">
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
            meta: { editierbar: true, breite: SPALTEN_BREITE.zustaendig },
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
              return (
                <Avatar
                  member={owner}
                  zweiter={sales}
                  title={
                    owner
                      ? `Zuständig: ${owner.short_name ?? owner.display_name}${sales ? ` · Sales: ${sales.short_name ?? sales.display_name}` : ''}`
                      : 'Frei'
                  }
                />
              )
            },
          }),
        )
        break
      case 'letzteBewegung':
        defs.push(
          h.accessor('last_activity_at', {
            id: 'letzteBewegung',
            header: SPALTEN_LABEL.letzteBewegung,
            meta: { rechts: true, mono: true, breite: SPALTEN_BREITE.letzteBewegung, ausblenden: 'lg' },
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
            meta: { editierbar: true, rechts: true, mono: true, breite: SPALTEN_BREITE.naechsteAktion },
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
            meta: { editierbar: true, breite: SPALTEN_BREITE.notiz, ausblenden: 'lg' },
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
              return <span className="text-ink-3 block truncate text-[12.5px]">{l.notes ?? ''}</span>
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
                <span className="text-overdue text-[12.5px]">fehlt</span>
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
  return (
    <div className="flex items-center gap-3 py-2 pr-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn('truncate text-[14px] font-medium', l.stage === 'beendet' ? 'text-ink-2' : 'text-ink')}>
            {l.full_name ?? '–'}
          </span>
          {l.firmaGesperrt ? <Chip ton="danger">Firma gesperrt</Chip> : null}
          {zustand.ausgewaehlt ? <Chip ton="neu">gewählt</Chip> : null}
        </div>
        <div className="text-ink-3 truncate text-[11.5px]">{l.company_name ?? '–'}</div>
        <div className="mt-1 flex items-center gap-2">
          <StatusChip stage={l.stage} settings={o.settings} />
          <span className="text-ink-3 truncate text-[12px]">{schrittText(l)}</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <Mono ton={ton}>{text}</Mono>
        <Avatar member={owner} />
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
    return x ? (x.short_name ?? x.display_name ?? '') : ''
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
