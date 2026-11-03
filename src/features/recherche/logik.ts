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
import { FREIGABE_PRAEFIX, JE_FIRMA } from './regeln'

/** Kleine, stabile Zahl aus einer ID (gleicher Lauf → gleiche Auswahl). */
function saat(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Positionstitel der Zielrollen (A/B/C aus regeln.ts) – grob, nur für die Reihenfolge der Ausgangspunkte. */
const ICP_TITEL =
  /gesch(ä|ae)ftsf|\bgf\b|inhaber|gr(ü|ue)nder|founder|owner|ceo|leit|head|projekt|vertrieb|sales|kunden|service|support|meister|techni|disponent|betrieb/i

const GATTUNGSWOERTER = new Set(
  (
    'solar solare solaranlagen solartechnik solarenergie solarsysteme solarservice solarstrom photovoltaik energie energy ' +
    'energien energietechnik energiesysteme elektro elektrotechnik elektrik elektroinstallation haustechnik gebäudetechnik ' +
    'gebaeudetechnik sonnen sonne green grün gruen neue deutsche deutschland german dach dachtechnik strom power smart ' +
    'stadtwerke nord north süd sued south west east team service technik tech home haus zukunft future'
  ).split(' '),
)

/** Franchise-Marken: jeder Standort ist ein eigener Betrieb (03.11.2026, Vincent) – wie Migration 24. */
const FRANCHISE = new Set(['enerix', '1komma5'])

/**
 * Firmengruppe wie crm.firma_gruppe (Migrationen 23/24): erstes Wort ohne Rechtsform, damit „Lichtfang AC GmbH“ und „Lichtfang
 * Projekt GmbH“ als ein Unternehmen zählen – bei Gattungswörtern („Solar- & Elektrotechnik Testmann“) und Franchise-Marken
 * („enerix Musterstadt“) der ganze Name.
 */
export function firmaGruppe(firma: string | null | undefined): string | null {
  const kern = (firma ?? '')
    .toLowerCase()
    .replace(/&\s*co\.?(\s*(kg|ohg))?/g, ' ')
    .replace(
      /(?<![a-z0-9äöüßéèáà])(gmbh|mbh|ag|kg|ug|ohg|gbr|se|ltd|inc|haftungsbeschränkt|holding|gruppe|group)(?![a-z0-9äöüßéèáà])/g,
      ' ',
    )
    .replace(/[^a-z0-9äöüßéèáà]+/g, ' ')
    .trim()
  const erstes = kern.split(' ')[0] ?? ''
  return (erstes.length >= 4 && !GATTUNGSWOERTER.has(erstes) && !FRANCHISE.has(erstes) ? erstes : kern) || null
}

/** Vernetzt oder weiter – vor „Anfrage gesendet“ (beides sind geprüfte Firmen, Vernetzte kennen wir besser). */
const vernetzt = (p: Ausgangspunkt) => p.stage !== 'vernetzung_gesendet'

/**
 * Ausgangspunkte eines Laufs (wie die Aktion „ausgangspunkte“ in crm.recherche_dienst): je Firmengruppe ein Kontakt – vernetzt
 * und mit passender Position zuerst –, davon `anzahl` Firmen je Lauf neu gemischt (gleicher Lauf → gleiche Auswahl).
 */
export function ausgangspunkteFuer(
  liste: readonly Ausgangspunkt[],
  laufId: string,
  anzahl = 30,
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
  // je Firma die beste Person: vernetzt vor angefragt, ICP-nahe Position vor anderen (die Mischung entscheidet den Rest)
  const rang = (p: Ausgangspunkt) => Number(vernetzt(p)) * 2 + Number(ICP_TITEL.test(p.role_title ?? ''))
  const beste = new Map<string, Ausgangspunkt>()
  for (const p of gemischt) {
    const g = firmaGruppe(p.company_name)
    if (!g) continue
    const bisher = beste.get(g)
    if (!bisher || rang(p) > rang(bisher)) beste.set(g, p)
  }
  // Reihenfolge der Firmen: Reihenfolge ihres ersten Auftretens in der Mischung
  const personen = [...beste.values()].sort((a, b) => gemischt.indexOf(a) - gemischt.indexOf(b)).slice(0, anzahl)
  return { personen, firmen: personen.map((p) => p.company_name!.trim()) }
}

/** Zeile einer Freigabeliste: „Vorname Nachname · Position · Firma · Kategorie · Grund · Profil-URL“. */
type ListenZeile = { name: string; firma: string; kategorie: string }

const KATEGORIE_RANG: Record<string, number> = { A: 0, B: 1, C: 2, bedingt: 3 }

/**
 * Freigabeliste des Agenten gegen die Grenze je Unternehmen prüfen (03.11.2026): Firmen mit mehr als JE_FIRMA Personen, welche
 * bleiben (wichtigste Kategorie zuerst, sonst Reihenfolge der Liste) und wer nicht vernetzt werden soll. Schon früher angefragte
 * Kontakte derselben Firma kennt nur die Datenbank – die prüft der Agent mit profil_pruefen direkt vor jedem Klick.
 */
export function firmenUeberGrenze(
  liste: string,
): { firma: string; anzahl: number; bleiben: string[]; weglassen: string[] }[] {
  const zeilen: ListenZeile[] = liste
    .split('\n')
    .map((z) => z.split(' · ').map((t) => t.trim()))
    .filter((t) => t.length >= 4 && t[0] && t[2])
    .map((t) => ({ name: t[0]!, firma: t[2]!, kategorie: t[3]! }))
  const gruppen = new Map<string, ListenZeile[]>()
  for (const z of zeilen) {
    const g = firmaGruppe(z.firma)
    if (g) gruppen.set(g, [...(gruppen.get(g) ?? []), z])
  }
  return [...gruppen.values()]
    .filter((g) => g.length > JE_FIRMA)
    .map((g) => {
      const sortiert = [...g].sort((a, b) => (KATEGORIE_RANG[a.kategorie] ?? 9) - (KATEGORIE_RANG[b.kategorie] ?? 9))
      return {
        firma: g[0]!.firma,
        anzahl: g.length,
        bleiben: sortiert.slice(0, JE_FIRMA).map((z) => z.name),
        weglassen: sortiert.slice(JE_FIRMA).map((z) => z.name),
      }
    })
}

/** Einschränkung, die „Freigeben“ automatisch mitschickt, wenn die Liste die Grenze je Unternehmen überschreitet. */
export const firmenEinschraenkung = (ueber: ReturnType<typeof firmenUeberGrenze>): string =>
  ueber.length
    ? `Höchstens ${JE_FIRMA} Personen je Unternehmen – nicht vernetzen: ${ueber.flatMap((u) => u.weglassen).join(', ')}.`
    : ''

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

export type System = 'mac' | 'windows'

/** Seiten der geführten Windows-Einrichtung (WindowsAnleitung.tsx). */
export const WINDOWS_TITEL = ['Befehl kopieren', 'In PowerShell einfügen', 'Dem Fenster folgen', 'Fertig'] as const

/** Betriebssystem des Browsers – der Einrichtungsdialog schlägt das passende vor (Mike arbeitet mit Windows). */
export const systemVon = (userAgent: string): System => (/Windows/i.test(userAgent) ? 'windows' : 'mac')

/**
 * Befehl fürs Terminal (Mac) bzw. für Windows PowerShell: lädt public/recherche-dienst/einrichten.sh bzw. einrichten.ps1 und
 * übergibt den persönlichen Dienst-Schlüssel. Unter Windows als Skriptblock, damit das Skript Parameter bekommt.
 */
export const einrichtungsBefehl = (schluessel: string, origin: string, system: System = 'mac') =>
  system === 'windows'
    ? `& ([scriptblock]::Create((irm ${origin}/recherche-dienst/einrichten.ps1))) ${schluessel}`
    : `curl -fsSL ${origin}/recherche-dienst/einrichten.sh | bash -s -- ${schluessel}`

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
  | 'agent_anbieter'
>

const sekundenSeit = (t: string | null, jetzt: number) => (t ? (jetzt - new Date(t).getTime()) / 1000 : Infinity)

const KEIN_DIENST: Record<DienstLage, string> = {
  keiner: 'Auf deinem Rechner ist noch kein Recherche-Dienst eingerichtet – einmalig „Recherche-Dienst einrichten“.',
  getrennt: 'Der Recherche-Dienst auf deinem Rechner meldet sich nicht. Ist der Rechner wach und bist du angemeldet?',
  verbunden: 'Der Recherche-Dienst hat den Lauf nicht übernommen. Läuft gerade ein anderer Agent?',
}

/** Claude übernimmt, wenn ChatGPT sein Nutzungslimit erreicht (Migration 20) – sonst arbeitet ChatGPT. */
export const agentName = (l: Pick<RechercheLauf, 'agent_anbieter'>) =>
  l.agent_anbieter === 'claude' ? 'Claude' : 'ChatGPT'

/** Was der Agent gerade tut – aus Laufstatus, den Meldungen des Recherche-Diensts und ob ein Dienst verbunden ist. */
export function agentZustand(l: AgentFelder, jetzt = Date.now(), dienst?: DienstLage): AgentZustand {
  const name = agentName(l)
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
            text: `Der Recherche-Dienst auf deinem Rechner startet ${name} gleich in deinem Chrome.`,
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
            titel: `${name} arbeitet${l.agent_rechner ? ` auf ${l.agent_rechner}` : ''}`,
            text: [
              name === 'Claude' ? l.agent_meldung : null,
              `${name} arbeitet in deinem Chrome – du kannst zuschauen. Vor dem Vernetzen fragt es hier nach deiner Freigabe.`,
            ]
              .filter(Boolean)
              .join(' '),
            starten: null,
          }
        : {
            art: 'still',
            titel: 'Agent antwortet nicht',
            text: `Letztes Lebenszeichen ${l.agent_heartbeat ? `um ${fmtZeit(l.agent_heartbeat)}` : 'unbekannt'}. Schläft der Rechner? Sonst neu starten – niemand wird doppelt angefragt.`,
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
        text: '„Agent starten“ übergibt den Lauf an den Recherche-Dienst auf deinem Rechner.',
        starten: 'starten',
      }
  }
}
