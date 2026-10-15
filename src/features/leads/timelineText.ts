// BAUPLAN § 3.3 `timelineText.ts` – Aktivität → Wortlaut (ux § 6.3) über texte/de.ts TIMELINE_TEXT, mit Kontext aus Vorlagen,
// settings.stage_labels und Mitgliedern. Dazu die Filter-Kategorien der Timeline (Alle · Nachrichten · Anrufe · E-Mails ·
// Statuswechsel · Notizen · System) und der Akteur-Text.
import { kuerzel } from '@/components/ui/Avatar'
import { fmtDatumKurz } from '@/lib/format'
import { stageLabel, stageRank, STUFEN } from '@/lib/stufen'
import { TIMELINE_TEXT } from '@/texte/de'
import type { Activity, ActivityType, LeadStage, Member, Settings, Template } from '@/types/domain'

export type TimelineKontext = {
  templates?: readonly Template[] | null
  settings?: Settings | null
  members?: readonly Member[] | null
}

/** Stufenwechsel liest TIMELINE_TEXT seit der Integration selbst aus den Trigger-Feldern (`from`/`to`/`ended_reason`). */
export function timelineText(a: Activity, ctx: TimelineKontext = {}): string {
  const vorlage = a.template_id ? (ctx.templates?.find((t) => t.id === a.template_id)?.name ?? null) : null
  return TIMELINE_TEXT(a, {
    vorlage,
    stufe: (s) => stageLabel(s as Parameters<typeof stageLabel>[0], ctx.settings ?? undefined),
    rang: (s) => ((STUFEN as readonly string[]).includes(s) ? stageRank(s as LeadStage) : 0),
    mitglied: (id) => {
      const m = id ? ctx.members?.find((x) => x.id === id) : null
      return m?.short_name ?? m?.display_name ?? 'die andere Person'
    },
    datum: (iso) => fmtDatumKurz(iso),
  })
}

/** Akteur-Kürzel rechts neben dem Ereignis (`VS`, `MM`, `System`): Initialen aus display_name, sonst wie der Avatar. */
export function timelineAkteur(a: Activity, members?: readonly Member[] | null): string {
  if (!a.member_id) return a.source === 'app' ? '' : 'System'
  const m = members?.find((x) => x.id === a.member_id)
  if (!m) return '–'
  const teile = (m.display_name ?? '').split(/[\s.]+/).filter(Boolean)
  if (teile.length >= 2) return `${teile[0]?.[0] ?? ''}${teile[1]?.[0] ?? ''}`.toUpperCase()
  return kuerzel(m)
}

export type TimelineFilterKey = 'alle' | 'nachrichten' | 'anrufe' | 'emails' | 'status' | 'notizen' | 'system'

export const TIMELINE_FILTER: readonly { key: TimelineFilterKey; label: string; types: readonly ActivityType[] }[] = [
  { key: 'alle', label: 'Alle', types: [] },
  {
    key: 'nachrichten',
    label: 'Nachrichten',
    types: [
      'vernetzung_gesendet',
      'vernetzung_angenommen',
      'vernetzung_zurueckgezogen',
      'vernetzung_abgelaufen',
      'gespraech_eroeffnet',
      'nachricht_gesendet',
      'nachricht_erhalten',
      'pitch_gesendet',
    ],
  },
  { key: 'anrufe', label: 'Anrufe', types: ['anruf'] },
  { key: 'emails', label: 'E-Mails', types: ['email_gesendet', 'email_erhalten'] },
  {
    key: 'status',
    label: 'Statuswechsel',
    types: [
      'stage_wechsel',
      'uebergabe',
      'freigabe',
      'meeting_geplant',
      'meeting_stattgefunden',
      'meeting_no_show',
      'meeting_abgesagt',
      'meeting_verschoben',
    ],
  },
  { key: 'notizen', label: 'Notizen', types: ['notiz'] },
  {
    key: 'system',
    label: 'System',
    types: [
      'angelegt',
      'import',
      'sequenz_gestartet',
      'sequenz_gestoppt',
      'sequenz_abgeschlossen',
      'sequenz_pausiert',
      'schritt_uebersprungen',
      'schritt_verschoben',
      'aufgabe_erledigt',
      'einwilligung',
      'widerspruch',
    ],
  },
]

export function timelineKategorie(type: ActivityType): Exclude<TimelineFilterKey, 'alle'> {
  for (const f of TIMELINE_FILTER) if (f.key !== 'alle' && f.types.includes(type)) return f.key
  return 'system'
}

/** Ereignisse mit aufklappbarem Text („anzeigen“): Nachrichten, E-Mails, Anrufe mit Notiz. */
export function hatAufklappText(a: Activity): boolean {
  if (!a.note) return false
  const k = timelineKategorie(a.type)
  if (a.type === 'nachricht_erhalten') return false // Zitat steht schon im Wortlaut
  return k === 'nachrichten' || k === 'emails' || k === 'anrufe'
}
