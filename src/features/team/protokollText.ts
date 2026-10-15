// Team-Protokoll: derselbe Timeline-Wortlaut wie im Lead (texte/de TIMELINE_TEXT), aber Stufenwechsel nennen die Phase wie die
// Pipeline-Spalte (lib/stufen PHASEN: „Angefragt“, „Vernetzt“ …), nicht die Feinstufe („Vernetzung gesendet“). Runde 3 (echte
// Daten): „Phase zurückgesetzt: Vernetzt → Vernetzung gesendet“ stand neben der Pipeline-Spalte „Angefragt“. Die Feinstufe steht
// im Tooltip – wie beim Phase-Chip (BAUPLAN § 1.5 Nr. 1).
import { fmtDatumKurz } from '@/lib/format'
import { anzeigeName } from '@/lib/mitglied'
import { phaseVon, stageLabel, stageRank, STUFEN } from '@/lib/stufen'
import { TIMELINE_TEXT } from '@/texte/de'
import type { Activity, LeadStage, Member, Settings, Template } from '@/types/domain'

export type ProtokollKontext = {
  templates?: readonly Template[] | null
  settings?: Settings | null
  members?: readonly Member[] | null
}

const istStufe = (s: unknown): s is LeadStage => typeof s === 'string' && (STUFEN as readonly string[]).includes(s)
const text = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null)

/** `text` für die Zeile, `titel` für den Tooltip (bei Stufenwechseln mit Feinstufen). */
export function protokollText(a: Activity, ctx: ProtokollKontext = {}): { text: string; titel: string } {
  const vorlage = a.template_id ? (ctx.templates?.find((t) => t.id === a.template_id)?.name ?? null) : null
  const fein = (s: LeadStage) => stageLabel(s, ctx.settings ?? undefined)

  if (a.type === 'stage_wechsel') {
    const m = (a.metadata && typeof a.metadata === 'object' ? a.metadata : {}) as Record<string, unknown>
    const von = text(m.prev_stage ?? m.from)
    const nach = text(m.stage ?? m.to)
    if (istStufe(von) && istStufe(nach)) {
      const feinTitel = `Feinstufe: ${fein(von)} → ${fein(nach)}`
      const phase = phaseVon(nach)
      // Wechsel innerhalb einer Phase (Neu → Vernetzung gesendet = beides „Angefragt“): kein „Angefragt → Angefragt“
      if (phaseVon(von) === phase && nach !== 'beendet' && nach !== 'langfristig') {
        const t = `Phase ${phase.label} (${fein(nach)})`
        return { text: t, titel: `${t} – ${feinTitel}` }
      }
      const t = textMitPhasen(a, ctx, vorlage)
      return { text: t, titel: `${t} – ${feinTitel}` }
    }
  }
  const t = textMitPhasen(a, ctx, vorlage)
  return { text: t, titel: t }
}

function textMitPhasen(a: Activity, ctx: ProtokollKontext, vorlage: string | null): string {
  return TIMELINE_TEXT(a, {
    vorlage,
    stufe: (s) => (istStufe(s) ? phaseVon(s).label : s),
    rang: (s) => (istStufe(s) ? stageRank(s) : 0),
    mitglied: (id) => anzeigeName(id ? ctx.members?.find((x) => x.id === id) : null, 'die andere Person'),
    datum: (iso) => fmtDatumKurz(iso),
  })
}
