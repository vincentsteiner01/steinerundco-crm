// Reine Logik der Einstellungen (Validierung, Ableitungen) – getrennt von den Komponenten (oxlint react/only-export-components).
import { nachE164 } from '@/lib/telefon'
import { normalizeLinkedinUrl } from '@/lib/url'
import { ALLGEMEIN, KANAL_LABEL } from '@/texte/de'
import type { Database } from '@/types/database'
import type { Channel, SequenceMitSchritten, Settings, SperrlisteEintrag } from '@/types/domain'
import { pruefeZahl, zahl } from './components/formularLogik'
import type { Preferences } from '@/data/members'

export type Plan = Database['crm']['Enums']['linkedin_plan']
export const PLAN_LABEL: Record<Plan, string> = {
  basic: 'Basic',
  premium: 'Premium',
  sales_navigator: 'Sales Navigator',
}

// ── Profil ────────────────────────────────────────────────────────────────────────────────────────
export type ProfilEntwurf = {
  short_name: string
  linkedin_plan: Plan
  weekly_budget: string
  daily_target: string
  rufnummer: string
  signature: string
  calendly_url: string
  preferences: Preferences
}

export type ProfilFehler = Partial<Record<keyof ProfilEntwurf, string>>

export function pruefeProfil(e: ProfilEntwurf): ProfilFehler {
  const f: ProfilFehler = {}
  if (e.short_name.trim().length > 3) f.short_name = 'Höchstens 3 Zeichen'
  const wb = pruefeZahl(e.weekly_budget, 0, 1000)
  if (wb) f.weekly_budget = wb
  const tz = pruefeZahl(e.daily_target, 0, 1000)
  if (tz) f.daily_target = tz
  if (e.rufnummer.trim() !== '' && !nachE164(e.rufnummer)) f.rufnummer = ALLGEMEIN.nummerUnvollstaendig
  if (e.calendly_url.trim() !== '' && !/^https:\/\/calendly\.com\//.test(e.calendly_url.trim()))
    f.calendly_url = 'Link beginnt mit https://calendly.com/'
  return f
}

// ── Sequenzen ─────────────────────────────────────────────────────────────────────────────────────
/** Schreibt `sequences.active` – alle übrigen Spalten bleiben (Upsert mit der vorhandenen Zeile). */
export function sequenzUpsert(s: SequenceMitSchritten, active: boolean) {
  const { steps: _steps, ...zeile } = s
  void _steps
  return { ...zeile, active }
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
  if (!url && !email && !tel) f.schluessel = 'Mindestens eine Angabe: LinkedIn-URL, E-Mail oder Telefon'
  if (url && !normalizeLinkedinUrl(url)) f.url = 'Keine Profil-URL (linkedin.com/in/…)'
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

// ── Ziele ─────────────────────────────────────────────────────────────────────────────────────────
export type ZieleFehler = Record<string, string | undefined>

export type LinkedinEntwurf = {
  daily_target: string
  weekly_budget: string
  daily_target_default: string
  warn_at_pct: string
  pending_withdraw_days: string
}

export function pruefeLinkedin(e: LinkedinEntwurf): ZieleFehler {
  return {
    daily_target: pruefeZahl(e.daily_target, 0, 1000),
    weekly_budget: pruefeZahl(e.weekly_budget, 0, 1000),
    daily_target_default: pruefeZahl(e.daily_target_default, 0, 1000),
    warn_at_pct: pruefeZahl(e.warn_at_pct, 0, 100, '%'),
    pending_withdraw_days: pruefeZahl(e.pending_withdraw_days, 0, 300, 'Tage'),
  }
}

export type QueueEntwurf = { withdraw_weekday: string; due_time: string; kommend_days: string }

export function pruefeQueue(e: QueueEntwurf): ZieleFehler {
  return {
    kommend_days: pruefeZahl(e.kommend_days, 0, 30, 'Tage'),
    due_time: /^\d{2}:\d{2}$/.test(e.due_time) ? undefined : 'Uhrzeit als HH:MM',
  }
}

export type KpiKey = keyof Settings['kpi_targets']
export const KPI_FELDER: { key: KpiKey; label: string; art: 'prozent' | 'zahl'; einheit?: string }[] = [
  { key: 'annahme_quote', label: 'Annahmequote', art: 'prozent' },
  { key: 'antwort_quote', label: 'Antwortquote', art: 'prozent' },
  { key: 'pitch_quote', label: 'Pitch-Quote', art: 'prozent' },
  { key: 'erstgespraech_quote', label: 'Erstgespräch-Quote', art: 'prozent' },
  { key: 'connect_rate', label: 'Erreicht-Quote (Telefon)', art: 'prozent' },
  { key: 'entscheider_quote', label: 'Entscheider-Quote', art: 'prozent' },
  { key: 'termine_pro_100_anrufe', label: 'Termine je 100 Anrufe', art: 'zahl' },
  { key: 'antwortzeit_werktage', label: 'Antwortzeit', art: 'zahl', einheit: 'Werktage' },
]
export type KpiEntwurf = Record<KpiKey, string>

export function pruefeKpi(e: KpiEntwurf): ZieleFehler {
  const f: ZieleFehler = {}
  for (const feld of KPI_FELDER)
    f[feld.key] = feld.art === 'prozent' ? pruefeZahl(e[feld.key], 0, 100, '%') : pruefeZahl(e[feld.key], 0, 1000)
  return f
}

export function kpiWerte(e: KpiEntwurf): Partial<Settings['kpi_targets']> {
  const out: Partial<Settings['kpi_targets']> = {}
  for (const feld of KPI_FELDER)
    out[feld.key] = feld.art === 'prozent' ? Math.round(zahl(e[feld.key]) * 10) / 1000 : zahl(e[feld.key])
  return out
}

export function feiertagHinzufuegen(liste: readonly string[], tag: string): string[] {
  return [...new Set([...liste, tag])].sort()
}
