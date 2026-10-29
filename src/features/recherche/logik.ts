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
import { FREIGABE_PRAEFIX } from './regeln'

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
/** Ein Recherche-Dienst gilt als verbunden, wenn er sich so kürzlich gemeldet hat (er fragt alle 10 s). */
export const DIENST_VERBUNDEN_S = 60

export type DienstLage = 'verbunden' | 'getrennt' | 'keiner'

/** Befehl fürs Terminal: lädt public/recherche-dienst/einrichten.sh und übergibt den persönlichen Dienst-Schlüssel. */
export const einrichtungsBefehl = (schluessel: string, origin: string) =>
  `curl -fsSL ${origin}/recherche-dienst/einrichten.sh | bash -s -- ${schluessel}`

/** Lage der Recherche-Dienste einer Person – `undefined`, solange sie lädt. */
export function dienstLage(
  dienste: readonly { zuletzt_gesehen: string | null }[] | undefined,
  jetzt = Date.now(),
): DienstLage | undefined {
  if (!dienste) return undefined
  const gesehen = dienste.filter((d) => d.zuletzt_gesehen)
  if (!gesehen.length) return 'keiner'
  return gesehen.some((d) => sekundenSeit(d.zuletzt_gesehen, jetzt) <= DIENST_VERBUNDEN_S) ? 'verbunden' : 'getrennt'
}

export type AgentZustand = {
  art:
    'startet' | 'kein_dienst' | 'arbeitet' | 'frage' | 'still' | 'beendet' | 'fehler' | 'manuell' | 'angehalten' | 'aus'
  titel: string
  text: string
  /** Knopf anbieten: „Agent starten“ bzw. „Agent neu starten“ */
  starten: 'starten' | 'neu' | null
  /** bei art 'frage': verlangt der Agent eine Freigabe (ja/nein) oder eine freie Antwort? */
  freigabe?: boolean
}

type AgentFelder = Pick<
  RechercheLauf,
  | 'status'
  | 'agent_status'
  | 'agent_angefordert'
  | 'agent_heartbeat'
  | 'agent_rechner'
  | 'agent_meldung'
  | 'agent_frage'
>

const sekundenSeit = (t: string | null, jetzt: number) => (t ? (jetzt - new Date(t).getTime()) / 1000 : Infinity)

const KEIN_DIENST: Record<DienstLage, string> = {
  keiner: 'Auf deinem Mac ist noch kein Recherche-Dienst eingerichtet – einmalig „Recherche-Dienst einrichten“.',
  getrennt: 'Der Recherche-Dienst auf deinem Mac meldet sich nicht. Ist der Mac wach und angemeldet?',
  verbunden: 'Der Recherche-Dienst hat den Lauf nicht übernommen. Läuft gerade ein anderer Agent?',
}

/** Was der Agent gerade tut – aus Laufstatus, den Meldungen des Recherche-Diensts und ob ein Dienst verbunden ist. */
export function agentZustand(l: AgentFelder, jetzt = Date.now(), dienst?: DienstLage): AgentZustand {
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
    case 'antwort': {
      const fortsetzen = l.agent_status === 'antwort'
      if (dienst !== 'verbunden' && dienst !== undefined)
        return {
          art: 'kein_dienst',
          titel: 'Kein Recherche-Dienst verbunden',
          text: KEIN_DIENST[dienst],
          starten: 'neu',
        }
      return sekundenSeit(l.agent_angefordert, jetzt) < AGENT_UEBERNAHME_S
        ? {
            art: 'startet',
            titel: fortsetzen ? 'Antwort übermittelt – Agent macht weiter …' : 'Agent startet …',
            text: 'Der Recherche-Dienst auf deinem Mac startet ChatGPT gleich in deinem Chrome.',
            starten: null,
          }
        : {
            art: 'kein_dienst',
            titel: 'Kein Agent hat den Lauf übernommen',
            text: KEIN_DIENST[dienst ?? 'getrennt'],
            starten: 'neu',
          }
    }
    case 'frage': {
      const frage = l.agent_frage ?? ''
      const freigabe = frage.startsWith(FREIGABE_PRAEFIX)
      return {
        art: 'frage',
        titel: freigabe ? frage.split('\n')[0]! : 'Der Agent hat eine Frage',
        text: freigabe ? frage.split('\n').slice(1).join('\n').trim() : frage,
        starten: null,
        freigabe,
      }
    }
    case 'arbeitet':
      return sekundenSeit(l.agent_heartbeat, jetzt) <= AGENT_STILL_S
        ? {
            art: 'arbeitet',
            titel: l.agent_rechner ? `Agent arbeitet auf ${l.agent_rechner}` : 'Agent arbeitet',
            text: 'ChatGPT arbeitet in deinem Chrome – du kannst zuschauen. Vor dem Vernetzen fragt es hier nach deiner Freigabe.',
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
