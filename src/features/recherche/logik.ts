// Reine Logik der Rechercheseite (29.10.2026): Ausgangspunkte je Lauf (rotierend, damit nicht jeder Lauf bei denselben Profilen
// anfängt), Formularprüfung wie in recherche_eintragen, die Sperre „Gesendet nur nach Prüfen derselben URL“ und der Zustand des
// Agenten aus den Meldungen des Recherche-Diensts (Migration 18).
import type {
  Ausgangspunkt,
  PruefErgebnis,
  RechercheErgebnis,
  RechercheKategorie,
  RechercheLauf,
} from '@/data/recherche'
import { fmtZeit } from '@/lib/format'
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

/** Ohne Übernahme durch den Dienst nach so vielen Sekunden: „kein Agent“. Ohne Lebenszeichen: „antwortet nicht“. */
export const AGENT_UEBERNAHME_S = 45
export const AGENT_STILL_S = 120

export type AgentZustand = {
  art: 'startet' | 'kein_dienst' | 'arbeitet' | 'still' | 'beendet' | 'fehler' | 'manuell' | 'angehalten' | 'aus'
  titel: string
  text: string
  /** Knopf anbieten: „Agent starten“ bzw. „Agent neu starten“ */
  starten: 'starten' | 'neu' | null
}

type AgentFelder = Pick<
  RechercheLauf,
  'status' | 'agent_status' | 'agent_angefordert' | 'agent_heartbeat' | 'agent_rechner' | 'agent_meldung'
>

const sekundenSeit = (t: string | null, jetzt: number) => (t ? (jetzt - new Date(t).getTime()) / 1000 : Infinity)

/** Was der Agent gerade tut – aus Laufstatus und den Meldungen des Recherche-Diensts. */
export function agentZustand(l: AgentFelder, jetzt = Date.now()): AgentZustand {
  if (l.status === 'pausiert' || l.status === 'fehler')
    return {
      art: 'angehalten',
      titel: 'Agent angehalten',
      text:
        l.status === 'pausiert'
          ? 'Der Lauf ist pausiert. „Fortsetzen“ startet den Agenten wieder – bereits Eingetragenes bleibt.'
          : 'Erst die Einschränkung klären, dann „Fortsetzen“ – der Agent startet dann wieder.',
      starten: null,
    }
  if (l.status !== 'laeuft') return { art: 'aus', titel: 'Lauf beendet', text: l.agent_meldung ?? '', starten: null }

  switch (l.agent_status) {
    case 'wartet':
      return sekundenSeit(l.agent_angefordert, jetzt) < AGENT_UEBERNAHME_S
        ? {
            art: 'startet',
            titel: 'Agent startet …',
            text: 'Der Recherche-Dienst auf deinem Mac öffnet gleich eine eigene Tab-Gruppe in Chrome.',
            starten: null,
          }
        : {
            art: 'kein_dienst',
            titel: 'Kein Agent hat den Lauf übernommen',
            text: 'Der Recherche-Dienst antwortet nicht. Ist der Mac wach und Chrome geöffnet? Ohne Dienst die Start-Anweisung unten kopieren und selbst an einen Agenten geben.',
            starten: 'neu',
          }
    case 'arbeitet':
      return sekundenSeit(l.agent_heartbeat, jetzt) <= AGENT_STILL_S
        ? {
            art: 'arbeitet',
            titel: l.agent_rechner ? `Agent arbeitet auf ${l.agent_rechner}` : 'Agent arbeitet',
            text: 'Er arbeitet in deinem Chrome in einer eigenen Tab-Gruppe – du kannst zuschauen. „Pausieren“ hält ihn an.',
            starten: null,
          }
        : {
            art: 'still',
            titel: 'Agent antwortet nicht',
            text: `Letztes Lebenszeichen ${l.agent_heartbeat ? `um ${fmtZeit(l.agent_heartbeat)}` : 'unbekannt'}. Schläft der Mac? Sonst neu starten – niemand wird doppelt angefragt.`,
            starten: 'neu',
          }
    case 'beendet':
      return {
        art: 'beendet',
        titel: 'Agent beendet',
        text: l.agent_meldung ?? 'Ohne Bericht beendet.',
        starten: 'neu',
      }
    case 'fehler':
      return {
        art: 'fehler',
        titel: 'Agent mit Fehler beendet',
        text: l.agent_meldung ?? 'Ohne Fehlermeldung beendet.',
        starten: 'neu',
      }
    default:
      return {
        art: 'manuell',
        titel: 'Für diesen Lauf arbeitet noch kein Agent',
        text: '„Agent starten“ übergibt den Lauf an den Recherche-Dienst auf deinem Mac.',
        starten: 'starten',
      }
  }
}
