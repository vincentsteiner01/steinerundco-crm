// M3 – Skript-Logik (Tabs, Vorlagen je Phase, Start-Tab) ohne React: „Einstieg V2“ nur ohne LinkedIn-Grund (T-14), Mailbox-Vorlage 2
// bei Versuch 4, Mailbox-Tab nach Klick auf Anrufen bei Versuch 2 und 4 (BAUPLAN § 3.4 Skript.tsx).
import { VORLAGE } from '@/lib/vorlagenKeys'
import type { CallBasis, PhoneType, Template, TemplatePhase } from '@/types/domain'

export type SkriptTab =
  | 'zentrale'
  | 'einstieg'
  | 'problem'
  | 'qualifizierung'
  | 'pitch'
  | 'einwaende'
  | 'abschluss'
  | 'mailbox'
  | 'datenschutz'

export const SKRIPT_TABS: readonly { key: SkriptTab; label: string; phase: TemplatePhase }[] = [
  { key: 'zentrale', label: 'Zentrale', phase: 'gatekeeper' },
  { key: 'einstieg', label: 'Einstieg', phase: 'einstieg' },
  { key: 'problem', label: 'Problem', phase: 'problem' },
  { key: 'qualifizierung', label: 'Qualifizierung', phase: 'qualifizierung' },
  { key: 'pitch', label: 'Pitch', phase: 'pitch' },
  { key: 'einwaende', label: 'Einwände', phase: 'einwand' },
  { key: 'abschluss', label: 'Abschluss', phase: 'abschluss' },
  { key: 'mailbox', label: 'Mailbox', phase: 'mailbox' },
  { key: 'datenschutz', label: 'Datenschutz', phase: 'datenschutz' },
]

export const istLinkedinGrund = (basis: CallBasis | null | undefined): boolean =>
  !!basis && basis.startsWith('linkedin_')

/** Vorlagen eines Tabs in Anzeigereihenfolge (Einstieg V2 nur ohne LinkedIn-Grund; Mailbox 2 zuerst bei Versuch 4). */
export function skriptVorlagen(
  templates: readonly Template[],
  tab: SkriptTab,
  o: { callBasis?: CallBasis | null; versuch?: number } = {},
): Template[] {
  const def = SKRIPT_TABS.find((t) => t.key === tab)
  if (!def) return []
  let liste = templates.filter((t) => t.channel === 'telefon' && t.phase === def.phase && t.active !== false)
  if (tab === 'einstieg' && istLinkedinGrund(o.callBasis)) liste = liste.filter((t) => t.key !== VORLAGE.tel_einstieg_2)
  if (tab === 'mailbox' && o.versuch === 4) {
    liste = [...liste].sort((a, b) => (a.key === VORLAGE.tel_mailbox_2 ? -1 : b.key === VORLAGE.tel_mailbox_2 ? 1 : 0))
  }
  return liste
}

/** Start-Tab: vor dem Anruf Zentrale (Nummerntyp Zentrale) sonst Einstieg; nach Klick auf Anrufen bei Versuch 2 und 4 Mailbox. */
export function startTab(phoneType: PhoneType | null | undefined, versuch: number, nachAnruf: boolean): SkriptTab {
  if (nachAnruf && (versuch === 2 || versuch === 4)) return 'mailbox'
  return phoneType === 'zentrale' ? 'zentrale' : 'einstieg'
}

export function naechsterTab(aktuell: SkriptTab, richtung: 1 | -1): SkriptTab {
  const i = SKRIPT_TABS.findIndex((t) => t.key === aktuell)
  const n = (i + richtung + SKRIPT_TABS.length) % SKRIPT_TABS.length
  return SKRIPT_TABS[n]?.key ?? 'einstieg'
}
