// Reine Helfer des Moduls M6: Schlüssel-Vergabe (BAUPLAN § 3.7 „DB“), Statistik aus Aktivitäten (LF-06), Suche, Baum-Gruppen.
import type { ActivityZeitraum } from '@/data/activities'
import { berlinTag, tagPlus, tageDifferenz } from '@/lib/zeit'
import type { Channel, Template, TemplatePerformance, TemplatePhase } from '@/types/domain'
import { KANAELE, KEY_PRAEFIX, phaseRang, phasenFuer, type PhaseDef } from './phasen'

/** `?kanal=` → Kanal (Standard LinkedIn). */
export function kanalAusParam(p: string | null): Channel {
  return KANAELE.includes(p as Channel) ? (p as Channel) : 'linkedin'
}

/** Vorlagen in Phasen-Reihenfolge des Kanals, dann `sort_order`, Name. */
export function sortiert(vorlagen: readonly Template[], kanal: Channel): Template[] {
  return [...vorlagen].sort(
    (a, b) =>
      phaseRang(kanal, a.phase) - phaseRang(kanal, b.phase) ||
      a.sort_order - b.sort_order ||
      a.name.localeCompare(b.name, 'de'),
  )
}

export type BaumGruppe = { def: PhaseDef; eintraege: Template[] }

/** Gruppen in Phasen-Reihenfolge (alle Phasen des Kanals, auch leere – LF-09), gefiltert nach Suche und Phase. */
export function baumGruppen(
  vorlagen: readonly Template[],
  kanal: Channel,
  q: string,
  phase?: TemplatePhase | null,
): BaumGruppe[] {
  const liste = sortiert(
    vorlagen.filter((t) => t.channel === kanal && (!phase || t.phase === phase) && passtSuche(t, q)),
    kanal,
  )
  const phasen = phasenFuer(kanal).filter((p) => !phase || p.key === phase)
  const gruppen: BaumGruppe[] = phasen.map((def) => ({ def, eintraege: liste.filter((t) => t.phase === def.key) }))
  for (const t of liste.filter((x) => !phasen.some((p) => p.key === x.phase))) {
    const g = gruppen.find((x) => x.def.key === t.phase)
    if (g) g.eintraege.push(t)
    else gruppen.push({ def: { key: t.phase, label: t.phase, beschreibung: '' }, eintraege: [t] })
  }
  return q.trim() ? gruppen.filter((g) => g.eintraege.length > 0) : gruppen
}

/** Flache Reihenfolge der Einträge für J/K. */
export function baumReihenfolge(gruppen: readonly BaumGruppe[]): string[] {
  return gruppen.flatMap((g) => g.eintraege.map((t) => t.id))
}

/** Ø Tage als „1,8 T“ (Komma, eine Nachkommastelle). */
export function fmtTage(t: number): string {
  return `${t.toFixed(1).replace('.', ',')} T`
}

/** Name → Slug: Umlaute aufgelöst, nur a–z, 0–9 und `_`, max. 40 Zeichen. */
export function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
}

/** Neuer Schlüssel `<präfix>_<slug>`, eindeutig gegenüber `vorhandene` (Zähler `_2`, `_3`, …). */
export function neuerKey(kanal: Channel, name: string, vorhandene: readonly string[]): string {
  const basis = `${KEY_PRAEFIX[kanal]}_${slug(name) || 'leitfaden'}`
  const belegt = new Set(vorhandene)
  if (!belegt.has(basis)) return basis
  for (let i = 2; i < 1000; i++) {
    const k = `${basis}_${i}`
    if (!belegt.has(k)) return k
  }
  return `${basis}_${Date.now()}`
}

/** Schlüssel einer Kopie: `<key>_kopie`, eindeutig. */
export function kopieKey(original: string, vorhandene: readonly string[]): string {
  const basis = `${original}_kopie`
  const belegt = new Set(vorhandene)
  if (!belegt.has(basis)) return basis
  for (let i = 2; i < 1000; i++) {
    const k = `${basis}_${i}`
    if (!belegt.has(k)) return k
  }
  return `${basis}_${Date.now()}`
}

/** Jedes Wort der Suche muss in Name, Phase oder „Wann verwenden“ vorkommen (ohne Groß/Klein). */
export function passtSuche(t: Pick<Template, 'name' | 'when_to_use' | 'key'>, q: string): boolean {
  const s = q.trim().toLowerCase()
  if (!s) return true
  const text = `${t.name} ${t.when_to_use ?? ''} ${t.key}`.toLowerCase()
  return s.split(/\s+/).every((w) => text.includes(w))
}

export const ANTWORT_FENSTER_TAGE = 7
export const WOCHEN = 8

/** Von-Tag der Statistik: Beginn des 8-Wochen-Fensters (Berlin). */
export function statistikVon(heute: string): string {
  return tagPlus(heute, -(WOCHEN * 7 - 1))
}

export type Statistik = {
  gesendet: number
  antworten7T: number
  /** 0–1, null ohne Sendungen */
  quote: number | null
  /** Ø Tage bis zur Antwort (nur beantwortete Sendungen), null ohne Antwort */
  oeTageBisAntwort: number | null
  /** Sendungen je Kalenderwoche, älteste zuerst, `WOCHEN` Einträge */
  wochen: number[]
}

/**
 * LF-06: Sendungen = Aktivitäten mit `template_id` (nachricht_gesendet · pitch_gesendet · email_gesendet);
 * eine Sendung gilt als beantwortet, wenn derselbe Lead binnen 7 Tagen danach `nachricht_erhalten`/`email_erhalten` hat.
 */
export function statistikAusAktivitaeten(
  sendungen: readonly ActivityZeitraum[],
  antworten: readonly ActivityZeitraum[],
  heute: string,
): Statistik {
  const antwortenJeLead = new Map<string, number[]>()
  for (const a of antworten) {
    const liste = antwortenJeLead.get(a.lead_id) ?? []
    liste.push(new Date(a.occurred_at).getTime())
    antwortenJeLead.set(a.lead_id, liste)
  }
  let beantwortet = 0
  let summeTage = 0
  const fenster = ANTWORT_FENSTER_TAGE * 24 * 3600 * 1000
  const wochen = Array.from({ length: WOCHEN }, () => 0)
  const start = tagPlus(heute, -(WOCHEN * 7 - 1))
  for (const s of sendungen) {
    const t = new Date(s.occurred_at).getTime()
    const reaktionen = antwortenJeLead.get(s.lead_id) ?? []
    const erste = reaktionen.filter((r) => r >= t && r - t <= fenster).sort((a, b) => a - b)[0]
    if (erste !== undefined) {
      beantwortet++
      summeTage += (erste - t) / (24 * 3600 * 1000)
    }
    const tag = berlinTag(s.occurred_at)
    const diff = tageDifferenz(start, tag)
    if (diff >= 0 && diff < WOCHEN * 7) {
      const w = Math.floor(diff / 7)
      wochen[w] = (wochen[w] ?? 0) + 1
    }
  }
  const gesendet = sendungen.length
  return {
    gesendet,
    antworten7T: beantwortet,
    quote: gesendet > 0 ? beantwortet / gesendet : null,
    oeTageBisAntwort: beantwortet > 0 ? summeTage / beantwortet : null,
    wochen,
  }
}

/** Nutzung rechts im Baum: „12 · 25 %“ (gesendet · Quote) aus v_template_performance, leer ohne Zeile. */
export function nutzung(perf: TemplatePerformance | undefined): { gesendet: number; quote: number | null } | null {
  if (!perf || !perf.gesendet) return null
  return { gesendet: perf.gesendet, quote: perf.antwort_quote ?? null }
}

/** Standard-Verwendung in Sequenzschritten: „Standard für Schritt 2“ (Sequenzname · Position). */
export function schrittVerwendungen(
  templateId: string,
  sequenzen: readonly {
    name: string
    key: string
    id: string
    steps: readonly { position: number; template_id: string | null; id: string }[]
  }[],
): { sequenceId: string; sequenzName: string; position: number; stepId: string }[] {
  const out: { sequenceId: string; sequenzName: string; position: number; stepId: string }[] = []
  for (const s of sequenzen)
    for (const st of s.steps)
      if (st.template_id === templateId)
        out.push({ sequenceId: s.id, sequenzName: s.name, position: st.position, stepId: st.id })
  return out
}
