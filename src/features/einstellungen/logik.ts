// Reine Logik der Einstellungen (Validierung, Ableitungen) – getrennt von den Komponenten (oxlint react/only-export-components).
import { nachE164 } from '@/lib/telefon'
import { normalizeLinkedinUrl } from '@/lib/url'
import { ALLGEMEIN, KANAL_LABEL } from '@/texte/de'
import type { Channel, SperrlisteEintrag } from '@/types/domain'

// ── Profil ────────────────────────────────────────────────────────────────────────────────────────
// Neustart 25.11.2026: nur noch die drei Felder, die im einfachen CRM etwas bewirken (Avatar, Einzelmails).
export type ProfilEntwurf = {
  short_name: string
  signature: string
  calendly_url: string
}

export type ProfilFehler = Partial<Record<keyof ProfilEntwurf, string>>

/**
 * `gespeichert` = Stand in der Datenbank. Ein dort stehendes längeres Kürzel (früher stand im Feld der Vorname) blockiert das
 * Speichern nicht, solange es niemand anfasst – sonst ließe sich mit so einem Profil auch die Signatur nicht mehr speichern.
 */
export function pruefeProfil(e: ProfilEntwurf, gespeichert?: ProfilEntwurf): ProfilFehler {
  const f: ProfilFehler = {}
  const kuerzel = e.short_name.trim()
  if (kuerzel.length > 3 && kuerzel !== gespeichert?.short_name.trim()) f.short_name = 'Höchstens 3 Zeichen'
  if (e.calendly_url.trim() !== '' && !/^https:\/\/calendly\.com\//.test(e.calendly_url.trim()))
    f.calendly_url = 'Link beginnt mit https://calendly.com/'
  return f
}

// ── Sperrliste ────────────────────────────────────────────────────────────────────────────────────
export const KANAELE: Channel[] = ['linkedin', 'telefon', 'email']
export type NeuerEintrag = {
  url: string
  email: string
  telefon: string
  name: string
  firma: string
  kanaele: Channel[]
  grund: string
  notiz: string
}
export const LEERER_EINTRAG: NeuerEintrag = {
  url: '',
  email: '',
  telefon: '',
  name: '',
  firma: '',
  kanaele: [...KANAELE],
  grund: '',
  notiz: '',
}

export type EintragFehler = Partial<Record<keyof NeuerEintrag | 'schluessel', string>>

/** Mindestens ein Schlüssel (URL, E-Mail, Telefon) und ein Grund; URL/Telefon müssen sich normalisieren lassen. */
export function pruefeEintrag(e: NeuerEintrag): EintragFehler {
  const f: EintragFehler = {}
  const url = e.url.trim()
  const email = e.email.trim()
  const tel = e.telefon.trim()
  if (!url && !email && !tel) f.schluessel = 'Mindestens eine Angabe: LinkedIn-Link, E-Mail oder Telefon'
  if (url && !normalizeLinkedinUrl(url)) f.url = 'Kein LinkedIn-Profil-Link (linkedin.com/in/…)'
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) f.email = 'E-Mail-Adresse prüfen'
  if (tel && !nachE164(tel)) f.telefon = ALLGEMEIN.nummerUnvollstaendig
  if (!e.grund.trim()) f.grund = ALLGEMEIN.grundEingeben
  if (e.kanaele.length === 0) f.kanaele = 'Mindestens einen Kanal wählen'
  return f
}

/** Anzeige der DB-Gründe (`crm.sperrliste.reason`). */
export const SPERR_GRUND_LABEL: Record<string, string> = {
  widerspruch: 'Widerspruch',
  abmeldung: 'Abmeldung',
  bounce: 'Bounce',
  manuell: 'Manuell',
}

/** Manueller Eintrag: Freitext-Grund (Pflicht) und Notiz landen in `note` – „Grund – Notiz“. */
export function sperrNotiz(grund: string, notiz: string): string | null {
  const teile = [grund.trim(), notiz.trim()].filter(Boolean)
  return teile.length ? teile.join(' – ') : null
}

/** Grund-Chip: Enum-Label, bei Notiz „Manuell · Widerspruch per Telefon am …“. */
export function sperrGrundText(reason: string, note: string | null | undefined): string {
  const label = SPERR_GRUND_LABEL[reason] ?? reason
  return note?.trim() ? `${label} · ${note.trim()}` : label
}

export function kanalUmfang(channels: Channel[]): string {
  const relevant = channels.filter((c) => c !== 'sonstiges')
  if (relevant.length >= 3) return 'alle Kanäle'
  return relevant.map((c) => KANAL_LABEL[c]).join(' · ') || '–'
}

export function passtSperrsuche(e: SperrlisteEintrag, q: string): boolean {
  if (!q.trim()) return true
  const text = [e.name, e.company, e.email, e.phone_e164, e.linkedin_url_norm, e.reason, e.note]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => text.includes(w))
}

// ── Feiertage ─────────────────────────────────────────────────────────────────────────────────────
/** Liste mit dem neuen Tag – sortiert, ohne Dubletten. */
export function feiertagHinzufuegen(liste: readonly string[], tag: string): string[] {
  return [...new Set([...liste, tag])].sort()
}

/** Die Jahre, in denen die übergebenen Tage liegen – jedes einmal, aufsteigend (für die Jahr-Auswahl). */
export function feiertagJahre(tage: readonly string[]): string[] {
  return [...new Set(tage.map((t) => t.slice(0, 4)))].sort()
}
