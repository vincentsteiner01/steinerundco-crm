// BAUPLAN § 3.3 `timelineText.ts` – Aktivität → Wortlaut (ux § 6.3) über texte/de.ts TIMELINE_TEXT, mit Kontext aus Vorlagen,
// settings.stage_labels und Mitgliedern. Dazu die Filter-Kategorien der Timeline (Alle · Nachrichten · Anrufe · E-Mails ·
// Statuswechsel · Notizen · System) und der Akteur-Text.
import { kuerzel } from '@/components/ui/Avatar'
import { fmtDatumKurz } from '@/lib/format'
import { stageLabel, stageRank, STUFEN } from '@/lib/stufen'
import { TIMELINE_TEXT } from '@/texte/de'
import type { Activity, LeadStage, Member, Settings, Template } from '@/types/domain'
import { anzeigeName } from '@/lib/mitglied'

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
      return anzeigeName(m, 'die andere Person')
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

// Filter-Kategorien und Aufklapp-Regel: lib/verlauf.ts (gemeinsam mit der Chrome-Erweiterung)
export { hatAufklappText, TIMELINE_FILTER, timelineKategorie, type TimelineFilterKey } from '@/lib/verlauf'
