// Reine Logik der Rechercheseite (29.10.2026): Ausgangspunkte je Lauf (rotierend, damit nicht jeder Lauf bei denselben Profilen
// anfängt), Formularprüfung wie in recherche_eintragen und die Sperre „Gesendet nur nach Prüfen derselben URL“.
import type { Ausgangspunkt, PruefErgebnis, RechercheErgebnis, RechercheKategorie } from '@/data/recherche'
import { normalizeLinkedinUrl } from '@/lib/url'

/** Kleine, stabile Zahl aus einer ID (gleicher Lauf → gleiche Auswahl). */
function saat(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Positionstitel der Zielrollen (A/B/C aus regeln.ts) – grob, nur für die Reihenfolge der Ausgangspunkte. */
const ICP_TITEL =
  /gesch(ä|ae)ftsf|\bgf\b|inhaber|gr(ü|ue)nder|founder|owner|ceo|leit|head|projekt|vertrieb|sales|kunden|service|support|meister|techni|disponent|betrieb/i

/** Deterministisch gemischte Auswahl von Personen und daraus die Firmen (je Firma eine Zeile). */
export function ausgangspunkteFuer(
  liste: readonly Ausgangspunkt[],
  laufId: string,
  anzahl = 12,
): { personen: Ausgangspunkt[]; firmen: string[] } {
  let s = saat(laufId)
  const zufall = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
  const gemischt = [...liste]
  for (let i = gemischt.length - 1; i > 0; i--) {
    const j = Math.floor(zufall() * (i + 1))
    ;[gemischt[i], gemischt[j]] = [gemischt[j] as Ausgangspunkt, gemischt[i] as Ausgangspunkt]
  }
  // ICP-nahe Positionstitel zuerst (stabil, die Mischung innerhalb der Gruppen bleibt)
  gemischt.sort((a, b) => Number(ICP_TITEL.test(b.role_title ?? '')) - Number(ICP_TITEL.test(a.role_title ?? '')))
  const personen = gemischt.slice(0, anzahl)
  const firmen: string[] = []
  for (const p of gemischt) {
    const f = p.company_name?.trim()
    if (f && !firmen.some((x) => x.toLowerCase() === f.toLowerCase())) firmen.push(f)
    if (firmen.length >= anzahl) break
  }
  return { personen, firmen }
}

export type Formular = {
  url: string
  vorname: string
  nachname: string
  firma: string
  position: string
  kategorie: RechercheKategorie | null
  grund: string
  ausgangspunkt: string
  firmaWebsite: string
}

export const LEERES_FORMULAR: Formular = {
  url: '',
  vorname: '',
  nachname: '',
  firma: '',
  position: '',
  kategorie: null,
  grund: '',
  ausgangspunkt: '',
  firmaWebsite: '',
}

/** Fehlertext fürs Formular oder null (deckt sich mit den Pflichtangaben in recherche_eintragen). */
export function formularFehler(f: Formular, ergebnis: RechercheErgebnis | 'pruefen'): string | null {
  if (!normalizeLinkedinUrl(f.url)) return 'LinkedIn-Profil-URL eintragen (https://www.linkedin.com/in/…).'
  if (ergebnis === 'pruefen') return null
  if (ergebnis === 'gesendet') {
    const fehlt = [
      !f.vorname.trim() && 'Vorname',
      !f.nachname.trim() && 'Nachname',
      !f.firma.trim() && 'Firma',
      !f.position.trim() && 'Position',
      !f.kategorie && 'Kategorie',
      !f.grund.trim() && 'Qualifizierungsgrund',
    ].filter(Boolean)
    return fehlt.length ? `Für „gesendet“ fehlt: ${fehlt.join(', ')}.` : null
  }
  if ((ergebnis === 'nicht_qualifiziert' || ergebnis === 'unklar') && !f.grund.trim())
    return 'Bitte einen Grund angeben (Feld „Qualifizierungsgrund / Grund“).'
  return null
}

/** „Gesendet“ ist nur frei, wenn die zuletzt geprüfte URL dieselbe ist und „frei“ ergab. */
export function gesendetErlaubt(f: Formular, pruefung: { url: string; ergebnis: PruefErgebnis } | null): boolean {
  if (!pruefung || !pruefung.ergebnis.frei) return false
  const a = normalizeLinkedinUrl(f.url)
  return !!a && a === normalizeLinkedinUrl(pruefung.url)
}

/** Verbleibende Anfragen bis zum Ziel. */
export const verbleibend = (l: { ziel: number; gesendet: number }) => Math.max(0, l.ziel - l.gesendet)

/** Fehlertext aus Supabase/PostgREST (Wortlaut der Datenbank-Exception) lesbar machen. */
export function fehlerText(e: unknown): string {
  const m = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e)
  return m.replace(/^Error:\s*/, '')
}
