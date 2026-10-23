// BAUPLAN § 3.1.8 – Registry der Palette: Zusammenführung aller features/<m>/befehle.ts + globale Befehle (ux § 5.6).
import type { NavigateFunction } from 'react-router'
import type { Member } from '@/types/domain'
import { BEFEHLE as EINSTELLUNGEN } from '@/features/einstellungen/befehle'
import { BEFEHLE as EMAIL } from '@/features/email/befehle'
import { BEFEHLE as FEEDBACK } from '@/features/feedback/befehle'
import { BEFEHLE as HEUTE } from '@/features/heute/befehle'
import { BEFEHLE as HILFE } from '@/features/hilfe/befehle'
import { BEFEHLE as IMPORT } from '@/features/import/befehle'
import { BEFEHLE as KPIS } from '@/features/kpis/befehle'
import { BEFEHLE as LEADS } from '@/features/leads/befehle'
import { BEFEHLE as LEITFAEDEN } from '@/features/leitfaeden/befehle'
import { BEFEHLE as PIPELINE } from '@/features/pipeline/befehle'
import { BEFEHLE as SEQUENZEN } from '@/features/sequenzen/befehle'
import { BEFEHLE as TEAM } from '@/features/team/befehle'
import { BEFEHLE as TELEFON } from '@/features/telefon/befehle'
import { useLeadSuche } from '@/data/leads'
import { useTemplates } from '@/data/templates'
import { phaseVon } from '@/lib/stufen'
import { KANAL_LABEL, PHASE_LABEL } from '@/texte/de'
import { SYSTEM_ANSICHTEN } from './ansichten'
import { gruppeVon, NAV_SEITEN, type NavEintrag } from './nav'
import { PFADE } from './pfade'
import { useUiStore } from './uiStore'

export type BefehlKontext = { navigate: NavigateFunction; leadId: string | null; me: Member }
export type Befehl = {
  id: string
  label: string
  gruppe: 'aktionen' | 'seiten'
  tasten?: string[]
  sichtbar?: (ctx: BefehlKontext) => boolean
  ausfuehren: (ctx: BefehlKontext) => void
}

/** Treffer der Suchgruppen Leads · Leitfäden · Ansichten (DESIGN-SYSTEM § 5.19). */
export type PaletteTreffer = {
  id: string
  name: string
  untertitel?: string
  chip?: { label: string; ton: 'neutral' | 'muted' | 'ended' | 'won' }
  tasten?: string[]
  ausfuehren: (ctx: BefehlKontext, vollansicht?: boolean) => void
}
export type PaletteQuelle = {
  gruppe: 'leads' | 'leitfaeden' | 'ansichten'
  /** `nurGruppe` = Präfix der Gruppe getippt (`@`, `#`, `*`): dann auch ohne Suchtext alles zeigen. */
  useTreffer: (q: string, nurGruppe: boolean) => PaletteTreffer[]
}

/** Jedes Wort des Suchtexts muss (Teilstring, ohne Groß/Klein) vorkommen – Palette und `?`-Liste. */
export function passtSuche(text: string, q: string): boolean {
  if (!q) return true
  const t = text.toLowerCase()
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => t.includes(w))
}

/** Lead im Peek über dem aktuellen Screen öffnen (PeekOutlet hört auf `crm:peek`; ux S-07). */
export function peekOeffnen(leadId: string): void {
  window.dispatchEvent(new CustomEvent('crm:peek', { detail: { leadId } }))
}

/**
 * Suchquellen der Palette (ux § 5.6). Statisch (Hook-Reihenfolge), eine Quelle je Gruppe:
 * Leads → useLeadSuche(q) (Enter = Peek, ⌘Enter = Vollansicht) · Leitfäden → useTemplates (Enter = Leitfaden, mit aktuellem Lead
 * als `?vorschau=`) · Ansichten → System-Ansichten (`/leads?ansicht=<key>`, ux § 3.2.3).
 */
export const PALETTE_QUELLEN: PaletteQuelle[] = [
  {
    gruppe: 'leads',
    useTreffer: (q) => {
      const { data } = useLeadSuche(q)
      if (!data) return []
      return data.map((l) => {
        const phase = phaseVon(l.stage)
        return {
          id: l.id,
          name: l.full_name ?? '–',
          untertitel: l.company_name ?? undefined,
          chip: { label: PHASE_LABEL[phase.key], ton: phase.ton },
          ausfuehren: ({ navigate }, vollansicht) => (vollansicht ? navigate(PFADE.lead(l.id)) : peekOeffnen(l.id)),
        }
      })
    },
  },
  {
    gruppe: 'leitfaeden',
    useTreffer: (q, nurGruppe) => {
      const { data } = useTemplates({ active: true })
      if (!data || (!q && !nurGruppe)) return []
      return data
        .filter((t) => passtSuche(`${t.name} ${KANAL_LABEL[t.channel]} ${t.phase}`, q))
        .slice(0, nurGruppe && !q ? 64 : 8)
        .map((t) => ({
          id: t.id,
          name: t.name,
          untertitel: KANAL_LABEL[t.channel],
          ausfuehren: ({ navigate, leadId }) =>
            navigate(
              leadId ? `${PFADE.leitfaden(t.id)}?vorschau=${encodeURIComponent(leadId)}` : PFADE.leitfaden(t.id),
            ),
        }))
    },
  },
  {
    gruppe: 'ansichten',
    useTreffer: (q, nurGruppe) =>
      !q && !nurGruppe
        ? []
        : SYSTEM_ANSICHTEN.filter((a) => passtSuche(`${a.name} Ansicht`, q)).map((a) => ({
            id: a.key,
            name: a.name,
            ausfuehren: ({ navigate }) => navigate(`${PFADE.leads}?ansicht=${a.key}`),
          })),
  },
]

function seitenLabel(n: NavEintrag): string {
  const g = gruppeVon(n)
  return g && g.gruppe !== 'mehr' ? `${g.label} · ${n.label}` : n.label
}

// Unterseiten mit Gruppe („Telefon · Kontakte“), damit „Telefon“ in der Suche alle Telefon-Seiten findet
const SEITEN: Befehl[] = NAV_SEITEN.map((n) => ({
  id: `seite:${n.pfad}`,
  label: seitenLabel(n),
  gruppe: 'seiten',
  tasten: n.akkord ? [n.akkord] : undefined,
  ausfuehren: ({ navigate }) => navigate(n.pfad),
}))

const GLOBAL: Befehl[] = [
  {
    id: 'lead-anlegen',
    label: 'Lead anlegen',
    gruppe: 'aktionen',
    tasten: ['⌥N'],
    ausfuehren: ({ navigate }) => navigate(PFADE.leadNeu),
  },
  // „Schnellimport einfügen“ und „Sheets importieren“ liefert M7 (features/import/befehle.ts) – Integration: keine Doppelung
  {
    id: 'tasten',
    label: 'Tastenkürzel anzeigen',
    gruppe: 'aktionen',
    tasten: ['?'],
    ausfuehren: () => useUiStore.getState().setHilfeOffen(true),
  },
  {
    id: 'backup',
    label: 'Backup herunterladen',
    gruppe: 'aktionen',
    ausfuehren: ({ navigate }) => navigate(PFADE.einstellungen('export')),
  },
  {
    id: 'passcode',
    label: 'Passcode ändern',
    gruppe: 'aktionen',
    ausfuehren: ({ navigate }) => navigate(PFADE.einstellungen('passcode')),
  },
  {
    id: 'abmelden',
    label: 'Abmelden',
    gruppe: 'aktionen',
    ausfuehren: () => window.dispatchEvent(new CustomEvent('crm:abmelden')),
  },
]

export const BEFEHLE: Befehl[] = [
  ...GLOBAL,
  ...HEUTE,
  ...SEQUENZEN,
  ...LEADS,
  ...PIPELINE,
  ...TELEFON,
  ...EMAIL,
  ...KPIS,
  ...TEAM,
  ...LEITFAEDEN,
  ...IMPORT,
  ...EINSTELLUNGEN,
  ...FEEDBACK,
  ...HILFE,
  ...SEITEN,
]
