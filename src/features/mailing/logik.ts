// Mailing (01.11.2026): reine Helfer für Postfächer, Hochlauf, Kampagnen und Texte – getestet in logik.test.ts.
// Regeln aus der Recherche (Scratchpad mailing/research): echter Hochlauf statt Aufwärm-Netz, Plain Text, erste Mail ohne
// Link, kurze Texte, kein vorgetäuschtes „Re:“, Kampagnen nur an Leads mit Erlaubnis-Grundlage.
import type { ChipTon } from '@/components/ui/Chip'

export type Anbieter = 'google' | 'microsoft' | 'ionos' | 'strato' | 'gmx' | 'webde' | 'tonline' | 'sonstige'

export type AnbieterVorlage = {
  key: Anbieter
  label: string
  smtp: { host: string; port: 465 | 587; sicherheit: 'ssl' | 'starttls' } | null
  imap: string
  /** Wie man an das Passwort kommt – Schritt für Schritt, ohne Fachwörter */
  passwort: string
  link?: string
  /** nur als Prüf-Postfach (kein Versand) */
  nurPruef?: boolean
  /** noch nicht möglich (Microsoft 365 braucht OAuth) */
  spaeter?: string
}

export const ANBIETER: readonly AnbieterVorlage[] = [
  {
    key: 'google',
    label: 'Google Workspace / Gmail',
    smtp: { host: 'smtp.gmail.com', port: 465, sicherheit: 'ssl' },
    imap: 'imap.gmail.com',
    passwort:
      'Ein App-Passwort, nicht das normale Passwort: Im Google-Konto die Bestätigung in zwei Schritten einschalten, dann unter „App-Passwörter“ eines mit dem Namen „CRM“ erzeugen und die 16 Zeichen hier einfügen.',
    link: 'https://myaccount.google.com/apppasswords',
  },
  {
    key: 'ionos',
    label: 'IONOS',
    smtp: { host: 'smtp.ionos.de', port: 465, sicherheit: 'ssl' },
    imap: 'imap.ionos.de',
    passwort: 'Das Passwort des Postfachs aus dem IONOS-Kundenbereich (E-Mail → Postfach → Passwort).',
  },
  {
    key: 'strato',
    label: 'STRATO',
    smtp: { host: 'smtp.strato.de', port: 465, sicherheit: 'ssl' },
    imap: 'imap.strato.de',
    passwort: 'Das Passwort des Postfachs aus dem STRATO-Kundenbereich.',
  },
  {
    key: 'gmx',
    label: 'GMX (Prüf-Postfach)',
    smtp: null,
    imap: 'imap.gmx.net',
    passwort: 'Das GMX-Passwort. Vorher in GMX unter Einstellungen → „POP3/IMAP Abruf“ den Zugriff erlauben.',
    nurPruef: true,
  },
  {
    key: 'webde',
    label: 'WEB.DE (Prüf-Postfach)',
    smtp: null,
    imap: 'imap.web.de',
    passwort: 'Das WEB.DE-Passwort. Vorher in WEB.DE unter Einstellungen → „POP3/IMAP Abruf“ den Zugriff erlauben.',
    nurPruef: true,
  },
  {
    key: 'tonline',
    label: 'T-Online (Prüf-Postfach)',
    smtp: null,
    imap: 'secureimap.t-online.de',
    passwort: 'Das E-Mail-Passwort von T-Online (im Kundencenter unter „E-Mail-Passwort“ – nicht das Login-Passwort).',
    nurPruef: true,
  },
  {
    key: 'microsoft',
    label: 'Microsoft 365 / Outlook',
    smtp: null,
    imap: 'outlook.office365.com',
    passwort: '',
    spaeter: 'Microsoft 365 erlaubt keine Anmeldung mit Passwort mehr – kommt später über eine Microsoft-Freigabe.',
  },
  {
    key: 'sonstige',
    label: 'Anderer Anbieter',
    smtp: { host: '', port: 465, sicherheit: 'ssl' },
    imap: '',
    passwort:
      'Das Passwort des Postfachs. Server-Adressen stehen in der Hilfe des Anbieters („IMAP“ und „SMTP“, Port 993 und 465).',
  },
]

export const anbieterVorlage = (k: string | null | undefined): AnbieterVorlage =>
  ANBIETER.find((a) => a.key === k) ?? (ANBIETER[ANBIETER.length - 1] as AnbieterVorlage)

// ---------------------------------------------------------------- Hochlauf
export type HochlaufStufe =
  'vorbereitung' | 'stufe_1' | 'stufe_2' | 'stufe_3' | 'plateau' | 'schonung' | 'pause' | 'saat'

export type HochlaufLage = {
  stufe: HochlaufStufe
  woche: number
  limit: number
  heute: number
  gruende: string[]
  sends_14: number
  bounces_14: number
  bounce_quote: number | null
  abgelehnt_7: number
  platzierung: { posteingang: number; geprueft: number } | null
}

export const HOCHLAUF: Record<HochlaufStufe, { label: string; ton: ChipTon; satz: string }> = {
  vorbereitung: { label: 'Vorbereitung', ton: 'overdue', satz: 'Noch nicht startklar – siehe Hinweise.' },
  stufe_1: { label: 'Hochlauf 1/3', ton: 'blau', satz: 'Woche 1–2: höchstens 10 Mails am Tag.' },
  stufe_2: { label: 'Hochlauf 2/3', ton: 'blau', satz: 'Woche 3–4: höchstens 15 Mails am Tag.' },
  stufe_3: { label: 'Hochlauf 3/3', ton: 'blau', satz: 'Woche 5–6: höchstens 25 Mails am Tag.' },
  plateau: { label: 'Bereit', ton: 'done', satz: 'Volles Tageslimit.' },
  schonung: { label: 'Schonung', ton: 'overdue', satz: 'Höchstens 10 Mails am Tag, bis die Werte wieder stimmen.' },
  pause: { label: 'Pause', ton: 'danger', satz: 'Keine Kampagnenmails, bis die Ursache behoben ist.' },
  saat: { label: 'Prüf-Postfach', ton: 'grau', satz: 'Empfängt nur Platzierungstests.' },
}

export function hochlaufLage(j: unknown): HochlaufLage | null {
  if (!j || typeof j !== 'object') return null
  const o = j as Partial<HochlaufLage>
  if (!o.stufe || !(o.stufe in HOCHLAUF)) return null
  return {
    stufe: o.stufe,
    woche: Number(o.woche ?? 0),
    limit: Number(o.limit ?? 0),
    heute: Number(o.heute ?? 0),
    gruende: Array.isArray(o.gruende) ? o.gruende.map(String) : [],
    sends_14: Number(o.sends_14 ?? 0),
    bounces_14: Number(o.bounces_14 ?? 0),
    bounce_quote: o.bounce_quote === null || o.bounce_quote === undefined ? null : Number(o.bounce_quote),
    abgelehnt_7: Number(o.abgelehnt_7 ?? 0),
    platzierung: o.platzierung ?? null,
  }
}

export const POSTFACH_STATUS: Record<string, { label: string; ton: ChipTon }> = {
  neu: { label: 'Nicht getestet', ton: 'grau' },
  bereit: { label: 'Verbunden', ton: 'done' },
  pausiert: { label: 'Pausiert', ton: 'muted' },
  fehler: { label: 'Fehler', ton: 'danger' },
}

export const KAMPAGNE_STATUS: Record<string, { label: string; ton: ChipTon }> = {
  entwurf: { label: 'Entwurf', ton: 'grau' },
  aktiv: { label: 'Läuft', ton: 'done' },
  pausiert: { label: 'Pausiert', ton: 'overdue' },
  beendet: { label: 'Beendet', ton: 'ended' },
}

export const EMPFAENGER_STATUS: Record<string, { label: string; ton: ChipTon }> = {
  wartet: { label: 'Wartet', ton: 'grau' },
  aktiv: { label: 'Läuft', ton: 'blau' },
  beantwortet: { label: 'Beantwortet', ton: 'done' },
  fertig: { label: 'Durchgelaufen', ton: 'muted' },
  abgemeldet: { label: 'Abgemeldet', ton: 'danger' },
  bounce: { label: 'Unzustellbar', ton: 'danger' },
  gestoppt: { label: 'Gestoppt', ton: 'overdue' },
  fehler: { label: 'Fehler', ton: 'danger' },
}

export const HINWEIS: Record<string, { label: string; ton: ChipTon }> = {
  interessiert: { label: 'Interesse', ton: 'done' },
  kein_interesse: { label: 'Kein Interesse', ton: 'muted' },
  abmeldung: { label: 'Abmeldung', ton: 'danger' },
}

// ---------------------------------------------------------------- Platzhalter und Vorschau
/** Platzhalter, die der Mail-Motor füllt (crm.mail_fuellen). Eigene Spalten je Empfänger kommen dazu. */
export const MAIL_PLATZHALTER = [
  'Briefanrede',
  'Vorname',
  'Nachname',
  'Anrede',
  'Titel',
  'Unternehmen',
  'Stadt',
  'Absender Vorname',
  'Absender Nachname',
  'Absender',
  'Signatur',
] as const

export type VorschauLead = {
  first_name?: string | null
  last_name?: string | null
  company_name?: string | null
  city?: string | null
  title?: string | null
  salutation?: string | null
}

/** Wie crm.mail_fuellen – für die Vorschau im Editor. Leere Werte bleiben als [Platzhalter] stehen. */
export function fuellenVorschau(
  text: string,
  lead: VorschauLead | null | undefined,
  absender: { name?: string | null; signatur?: string | null } | null | undefined,
  variablen: Record<string, string> = {},
): string {
  let r = text
  const setze = (name: string, wert: string | null | undefined) => {
    const w = wert?.trim()
    if (w) r = r.split(`[${name}]`).join(w)
  }
  for (const [k, v] of Object.entries(variablen)) setze(k, v)
  const anrede = lead?.salutation === 'herr' ? 'Herr' : lead?.salutation === 'frau' ? 'Frau' : null
  setze('Vorname', lead?.first_name)
  setze('Nachname', lead?.last_name)
  setze('Unternehmen', lead?.company_name)
  setze('Stadt', lead?.city)
  setze('Anrede', anrede)
  setze('Titel', lead?.title)
  if (lead?.last_name?.trim()) {
    const titel = lead.title?.trim() ? `${lead.title.trim()} ` : ''
    setze(
      'Briefanrede',
      lead.salutation === 'herr'
        ? `Sehr geehrter Herr ${titel}${lead.last_name.trim()}`
        : lead.salutation === 'frau'
          ? `Sehr geehrte Frau ${titel}${lead.last_name.trim()}`
          : `Guten Tag ${`${lead.first_name ?? ''} ${lead.last_name}`.trim()}`,
    )
  }
  const name = absender?.name?.trim() ?? ''
  if (name) {
    const [vor, ...rest] = name.split(/\s+/)
    setze('Absender Vorname', vor)
    setze('Absender Nachname', rest.join(' '))
    setze('Absender', name)
  }
  r = r.split('[Signatur]').join(absender?.signatur ?? '')
  return r
}

/** Offene Platzhalter („[Vorname]“), die nach dem Füllen noch im Text stehen. */
export function offenePlatzhalter(text: string): string[] {
  return [...new Set([...text.matchAll(/\[([^[\]\n]{1,40})\]/g)].map((m) => m[1] as string))]
}

// ---------------------------------------------------------------- Texthinweise (Zustellbarkeit + Recht)
export type TextHinweis = { ton: 'warnung' | 'info'; text: string }

const SPAMWOERTER =
  /\b(kostenlos|gratis|gewinn(spiel)?|garantiert|100 ?%|sofort zugreifen|jetzt kaufen|rabatt|sonderangebot|nur heute|klicken sie hier|click here|free)\b|!!+|€€|\$\$/i

export function woerter(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

/**
 * Hinweise zu Betreff und Text einer Variante. `ersterSchritt`: in der ersten Mail keine Links (Recherche 02 § 9) und kein
 * „Re:“/„AW:“ ohne echten Verlauf (§ 6 Abs. 2 DDG). Kurz ist besser: unter 50 Wörtern die meisten Antworten.
 */
export function textHinweise(
  betreff: string,
  text: string,
  ersterSchritt: boolean,
  eigeneVariablen: readonly string[] = [],
): TextHinweis[] {
  const h: TextHinweis[] = []
  const b = betreff.trim()
  if (ersterSchritt && !b) h.push({ ton: 'warnung', text: 'Die erste Mail braucht einen Betreff.' })
  if (ersterSchritt && /^\s*(re|aw|antw|wg|fwd?)\s*:/i.test(b))
    h.push({ ton: 'warnung', text: '„Re:“ oder „AW:“ ohne echten Verlauf täuscht – verboten (§ 6 Abs. 2 DDG).' })
  if (b.length > 60)
    h.push({ ton: 'info', text: `Betreff ist ${b.length} Zeichen lang – kurz und sachlich wirkt besser (unter 60).` })
  if (ersterSchritt && /https?:\/\/|www\.[a-z0-9-]+\./i.test(text))
    h.push({
      ton: 'warnung',
      text: 'Link in der ersten Mail – besser ohne: Links in Erstkontakten landen öfter im Spam.',
    })
  const n = woerter(text)
  if (n > 150)
    h.push({ ton: 'warnung', text: `${n} Wörter – deutlich zu lang. Unter 120 Wörtern antworten mehr Menschen.` })
  else if (n > 120) h.push({ ton: 'info', text: `${n} Wörter – kürzer ist besser (unter 120, ideal um 50–80).` })
  if (SPAMWOERTER.test(`${b}\n${text}`))
    h.push({ ton: 'warnung', text: 'Werbesprache („kostenlos“, „!!!“ …) – wirkt wie Spam.' })
  if (/\b[A-ZÄÖÜ]{6,}\b/.test(`${b} ${text}`.replace(/\[[^\]]*\]/g, '')))
    h.push({ ton: 'info', text: 'Wörter in GROSSBUCHSTABEN wirken laut – lieber normal schreiben.' })
  const bekannt = new Set<string>([...MAIL_PLATZHALTER, ...eigeneVariablen])
  const unbekannt = offenePlatzhalter(`${b}\n${text}`).filter((p) => !bekannt.has(p))
  if (unbekannt.length)
    h.push({
      ton: 'warnung',
      text: `Unbekannte Platzhalter: ${unbekannt.map((p) => `[${p}]`).join(', ')} – diese Empfänger würden gestoppt.`,
    })
  return h
}

// ---------------------------------------------------------------- Zeitplan
export const WOCHENTAGE = [
  { nr: 1, kurz: 'Mo' },
  { nr: 2, kurz: 'Di' },
  { nr: 3, kurz: 'Mi' },
  { nr: 4, kurz: 'Do' },
  { nr: 5, kurz: 'Fr' },
  { nr: 6, kurz: 'Sa' },
  { nr: 7, kurz: 'So' },
] as const

export type Zeitplan = { tage: number[]; von: string; bis: string }

export function zeitplanAus(j: unknown): Zeitplan {
  const o = (j ?? {}) as Partial<Zeitplan>
  return {
    tage: Array.isArray(o.tage) ? o.tage.map(Number).filter((n) => n >= 1 && n <= 7) : [1, 2, 3, 4, 5],
    von: typeof o.von === 'string' ? o.von : '08:00',
    bis: typeof o.bis === 'string' ? o.bis : '16:00',
  }
}

export function zeitplanText(z: Zeitplan): string {
  const tage = [...z.tage].sort((a, b) => a - b)
  const kurz = (n: number) => WOCHENTAGE.find((w) => w.nr === n)?.kurz ?? ''
  const zusammen = tage.length >= 3 && tage.every((t, i) => i === 0 || t === (tage[i - 1] as number) + 1)
  const tageText = !tage.length
    ? 'nie'
    : zusammen
      ? `${kurz(tage[0]!)}–${kurz(tage[tage.length - 1]!)}`
      : tage.map(kurz).join(', ')
  return `${tageText} · ${z.von}–${z.bis} Uhr`
}

/** Tag der Mail ab Start (Tag 0, +3, +8 …) aus den Wartetagen der Schritte. */
export function tagImAblauf(wartetage: readonly number[], index: number): number {
  return wartetage.slice(1, index + 1).reduce((s, w) => s + Math.max(w, 1), 0)
}

export function quote(teil: number, gesamt: number): string {
  if (!gesamt) return '–'
  const q = (teil / gesamt) * 100
  return `${q < 10 && q > 0 ? q.toFixed(1).replace('.', ',') : Math.round(q)} %`
}
