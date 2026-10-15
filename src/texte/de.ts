// Gemeinsame Wortlaute (BAUPLAN § 3.1.9 Ende, ux § 6). Primärquellen für Stufen/Gründe/Ergebnisse sind
// settings.stage_labels, settings.ended_reason_labels und call_outcome_defs – diese Maps sind der Fallback.
// Lint (texte.test.ts): keine geraden Anführungszeichen, kein Ausrufezeichen, kein „...“, kein „--“,
// nicht „erfolgreich“, „OK“, „Snooze“, „Owner“.
import type {
  Activity,
  CallBasis,
  CallOutcome,
  Channel,
  EmailConsentBasis,
  EndedReason,
  LeadStage,
  ReplyLabel,
  UiSektion,
} from '@/types/domain'

export const STUFEN_LABEL: Record<LeadStage, { label: string; short: string }> = {
  neu: { label: 'Neu', short: 'Neu' },
  vernetzung_gesendet: { label: 'Vernetzung gesendet', short: 'Angefragt' },
  vernetzt: { label: 'Vernetzt', short: 'Vernetzt' },
  gespraech_eroeffnet: { label: 'Gespräch eröffnet', short: 'Eröffnet' },
  dm_follow_up: { label: 'DM Follow-up', short: 'Follow-up' },
  dm_beantwortet: { label: 'Antwort erhalten', short: 'Im Gespräch' },
  bedarfsermittlung: { label: 'Bedarfsermittlung', short: 'Bedarf' },
  pitch: { label: 'Erstgespräch gepitcht', short: 'Pitch' },
  erstgespraech_vereinbart: { label: 'Erstgespräch vereinbart', short: 'EG vereinbart' },
  erstgespraech: { label: 'Erstgespräch geführt', short: 'EG geführt' },
  strategiegespraech_vereinbart: { label: 'Strategiegespräch vereinbart', short: 'SG vereinbart' },
  strategiegespraech: { label: 'Strategiegespräch geführt', short: 'SG geführt' },
  sales_follow_up: { label: 'Sales Follow-up', short: 'Follow-up' },
  kunde: { label: 'Kunde gewonnen', short: 'Kunde' },
  langfristig: { label: 'Wiedervorlage', short: 'Wiedervorlage' }, // § 1.5 Nr. 2
  beendet: { label: 'Beendet', short: 'Beendet' },
}

export const PHASE_LABEL = {
  angefragt: 'Angefragt',
  vernetzt: 'Vernetzt',
  eroeffnet: 'Eröffnet',
  beantwortet: 'Beantwortet',
  gepitcht: 'Gepitcht',
  erstgespraech: 'Erstgespräch',
  strategiegespraech: 'Strategiegespräch',
  kunde: 'Kunde',
  wiedervorlage: 'Wiedervorlage',
  beendet: 'Beendet',
} as const

export const GRUND_LABEL: Record<EndedReason, string> = {
  kein_bedarf: 'Kein Bedarf',
  nicht_icp: 'Nicht ICP',
  nicht_qualifiziert: 'Nicht qualifiziert',
  kein_interesse: 'Kein Interesse',
  falsche_nummer: 'Falsche Nummer / Kontakt ungültig',
  duplikat: 'Duplikat',
  widerspruch: 'Widerspruch (nicht mehr kontaktieren)',
  sonstiges: 'Sonstiges',
}

export const REAKTION_LABEL: Record<ReplyLabel, string> = {
  interessiert: 'Ja',
  frage: 'Rückfrage',
  kein_bedarf: 'Nein',
  spaeter: 'Später',
  nicht_icp: 'Nicht ICP',
  hat_partner: 'Hat Partner',
  falsches_problem: 'Falsches Problem',
  widerspruch: 'Widerspruch',
  sonstiges: 'Sonstiges',
}
/** „Nein (mit Grund)“, wenn zur Reaktion `kein_bedarf` ein Zitat vorliegt. */
export function reaktionLabel(label: ReplyLabel, mitNote?: boolean): string {
  if (label === 'kein_bedarf' && mitNote) return 'Nein (mit Grund)'
  return REAKTION_LABEL[label]
}

export const KANAL_LABEL: Record<Channel, string> = {
  linkedin: 'LinkedIn',
  telefon: 'Telefon',
  email: 'E-Mail',
  sonstiges: 'Sonstiges',
}

export const ANRUFGRUND_LABEL: Record<CallBasis, string> = {
  linkedin_vernetzt_antwort: 'LinkedIn vernetzt + Antwort',
  linkedin_vernetzt: 'LinkedIn vernetzt',
  email_antwort: 'E-Mail-Antwort',
  website_anfrage: 'Website-Anfrage',
  messe_event: 'Messe / Event',
  empfehlung: 'Empfehlung',
  bestandskontakt: 'Bestandskontakt',
  stellenanzeige_innendienst: 'Stellenanzeige Innendienst',
  oeffentliche_aussage: 'Öffentliche Aussage',
  sonstiger_konkreter_anlass: 'Sonstiger konkreter Anlass',
}

export const ERLAUBNIS_LABEL: Record<EmailConsentBasis, string> = {
  none: 'Keine Erlaubnis',
  requested_linkedin: 'Per LinkedIn um Infos gebeten',
  requested_phone: 'Am Telefon um Infos gebeten',
  requested_email: 'Per E-Mail um Infos gebeten',
  meeting_held: 'Gespräch geführt',
  double_opt_in: 'Double-Opt-in',
  existing_customer: 'Bestandskunde',
  revoked: 'Widerspruch',
}

export const ERGEBNIS_LABEL: Record<CallOutcome, string> = {
  no_answer: 'Nicht erreicht',
  busy: 'Besetzt',
  voicemail: 'Mailbox (keine Nachricht)',
  voicemail_left: 'Mailbox – Nachricht hinterlassen',
  wrong_number: 'Falsche / ungültige Nummer',
  gatekeeper: 'Zentrale / Vorzimmer – Entscheider nicht erreichbar',
  gatekeeper_blocked: 'Zentrale blockt – Infos per E-Mail gewünscht',
  callback_scheduled: 'Rückruf vereinbart',
  dm_interest: 'Entscheider – Interesse, noch kein Termin',
  meeting_booked: 'Termin (Erstgespräch) vereinbart',
  send_info: 'Info per E-Mail gewünscht',
  not_now: 'Kein Bedarf aktuell – Wiedervorlage',
  not_interested: 'Kein Interesse – beendet',
  not_icp: 'Nicht ICP / nicht qualifiziert',
  do_not_call: 'Werbewiderspruch – nicht mehr kontaktieren',
}

export const QUEUE_SEKTION_LABEL: Record<UiSektion, string> = {
  rueckrufe: 'Rückrufe',
  antworten: 'Antworten',
  ueberfaellig: 'Überfällig',
  heute: 'Heute fällig',
  annahme_pruefen: 'Annahme prüfen',
  opener: 'Opener senden',
  neue_anfragen: 'Neue Anfragen',
  zurueckziehen: 'Zurückziehen',
  spaeter: 'Später',
}

export const GATE_GRUND_LABEL = {
  keine_nummer: 'Keine Nummer',
  kein_anrufgrund: 'Nummer ohne Anrufgrund',
  sperrliste: 'Auf der Sperrliste',
  widerspruch: 'Widerspruch – nicht kontaktieren',
  firma_gesperrt: 'Firma gesperrt – nicht anschreiben',
  keine_grundlage: 'Keine Erlaubnis-Grundlage',
  zu_viele_nachfass: 'Drei Nachfass-Mails unter dieser Erlaubnis gesendet',
  keine_adresse: 'Keine E-Mail-Adresse',
  nur_nach_gespraech: 'Nur nach geführtem Gespräch oder für Bestandskunden',
  aelter_12_monate: 'Erlaubnis älter als 12 Monate',
} as const

/** Telefon-Kontext (Anrufliste, Anruf-Knopf): „nicht anrufen“ statt „nicht anschreiben“ (Runde 2). */
export function telefonGrundLabel(grund: keyof typeof GATE_GRUND_LABEL): string {
  return grund === 'firma_gesperrt' ? 'Firma gesperrt – nicht anrufen' : GATE_GRUND_LABEL[grund]
}

// ux § 4.1 – Leere Zustände (eine Überschrift, ein Satz, max. eine Primäraktion)
/**
 * Gate-Wortlaute für E-Mail (ux § 3.3.3 Tooltip, § 3.6.3; Regel 5 = offene Platzhalter § 3.1.9a). Eine Quelle für
 * Composer (M4), Heute-Karte (M1) und Kanal-Karte (M2) – Integration M1–M8, vorher dreifach.
 */
export function emailGateText(
  grund: keyof typeof GATE_GRUND_LABEL | 'offene_platzhalter',
  vorname?: string | null,
): string {
  switch (grund) {
    case 'keine_grundlage':
      return `Keine Erlaubnis-Grundlage. Trag ein, wann und wie ${vorname?.trim() || 'die Person'} um die Mail gebeten hat – oder frag erst auf LinkedIn/am Telefon.`
    case 'zu_viele_nachfass':
      return `${GATE_GRUND_LABEL.zu_viele_nachfass} – Thema schließen oder neuen Anlass schaffen (LinkedIn/Telefon).`
    case 'sperrliste':
      return `${GATE_GRUND_LABEL.sperrliste} – kein Versand, kein Override.`
    case 'keine_adresse':
      return 'Adresse fehlt – trag die E-Mail-Adresse ein, die die Person genannt hat.'
    case 'offene_platzhalter':
      return 'Erst alle Platzhalter eintragen.'
    case 'nur_nach_gespraech':
      return 'Nachbereitung nur nach einem geführten Gespräch oder für Bestandskunden.'
    default:
      return GATE_GRUND_LABEL[grund]
  }
}

export const EMAIL_WARNUNG_12_MONATE =
  'Erlaubnis älter als 12 Monate ohne Kontakt seitdem – öffnen nur mit „Trotzdem öffnen“ oder neuen Anlass schaffen.'

export const LEER = {
  heuteErledigt: { titel: 'Nichts mehr fällig.', aktion: 'Leads ansehen' },
  heuteKeineDaten: {
    titel: 'Noch keine Leads.',
    satz: 'Füge eine Liste aus ChatGPT ein oder importiere die Sheets.',
    aktion: 'Schnellimport',
    sekundaer: 'Sheets importieren',
  },
  heuteAnderePerson: (name: string) => ({
    titel: `${name} hat heute nichts Fälliges.`,
    aktion: 'Zurück zu deinem Heute',
  }),
  leadsFilter: { titel: 'Kein Lead passt zu diesem Filter.', aktion: 'Filter zurücksetzen ⌫' },
  leadsSuche: (q: string) => ({ titel: `Nichts gefunden für ‚${q}‘.`, aktion: 'Lead anlegen' }),
  leadsSucheVorschlag: (name: string) => `Meintest du ${name}?`,
  pipelineSpalte: { titel: 'Keine Leads' },
  telefonListe: { titel: 'Niemand anzurufen.', aktion: 'Anrufgrund setzen' },
  emailFaellig: { titel: 'Keine E-Mail fällig.', satz: 'E-Mails gehen nur an Personen, die darum gebeten haben.' },
  kpisPeriode: (monat: string) => ({
    titel: `Keine Daten für ${monat}.`,
    satz: 'Importiere das KPI-Sheet oder wähle einen anderen Zeitraum.',
    aktion: 'KPI-Sheet importieren',
  }),
  leitfaedenKanal: (kanal: string) => ({ titel: `Noch kein Leitfaden für ${kanal}.`, aktion: 'Leitfaden anlegen' }),
  dubletten: { titel: 'Keine Dubletten.', satz: 'Geprüft: LinkedIn-URL, Telefon, Name + Unternehmen.' },
  papierkorb: { titel: 'Papierkorb ist leer.', satz: 'Gelöschte Leads bleiben 30 Tage hier.' },
  timeline: { satz: 'Noch nichts passiert.' },
  importVorschau: {
    titel: 'Nichts erkannt.',
    satz: 'Erwartet: Markdown-Tabelle, Liste oder CSV mit Name und LinkedIn-URL.',
    aktion: 'Prompt-Vorlage kopieren',
  },
  seiteNichtGefunden: { titel: 'Seite nicht gefunden.', satz: 'Die Adresse kennt das CRM nicht.', aktion: 'Zu Heute' },
  kommtMit: (modul: string) => ({ titel: `Kommt mit ${modul}.`, satz: 'Dieser Bereich wird gerade gebaut.' }),
} as const

// ux § 6.2 – Toasts: ein Satz, Punkt am Ende, Fakt vor Gefühl
export const TOAST = {
  kopiert: 'Kopiert.',
  kopiertErstesMal: 'Kopiert. In LinkedIn einfügen – dann E drücken.',
  erledigt: (schritt: string, datum: string, offen: number) =>
    `Erledigt – ${schritt} am ${datum} · noch ${offen} fällig.`,
  spaeter: (wann: string) => `Später: ${wann}.`,
  nichtGespeichert: 'Nicht gespeichert – erneut versuchen',
  offline: 'Offline – Änderungen werden nicht gespeichert.',
  wiederOnline: (n: number) => (n > 0 ? `Wieder online – ${n} Änderungen gespeichert.` : 'Wieder online.'),
  angenommen: 'Angenommen – Opener heute fällig.',
  antwortErhalten: (vorlage: string) => `Antwort erhalten – Vorlage ‚${vorlage}‘ vorgeschlagen.`,
  terminVereinbart: (typ: string, wann: string) => `${typ} vereinbart für ${wann}`,
  passcodeGeaendert: 'Passcode geändert.',
  abgemeldet: 'Abgemeldet.',
  keinZugriff: 'Dieses Konto hat keinen Zugriff auf das CRM.',
  neueVersion: 'Neue Version verfügbar',
  neueVersionLaden: 'Jetzt laden',
  rueckgaengig: 'Rückgängig',
  rueckgaengigGemacht: 'Rückgängig gemacht.',
  schonErledigt: (name: string, zeit: string) => `Schon erledigt von ${name} um ${zeit}`,
  uebergeben: (von: string, lead: string) => `${von} hat dir ${lead} übergeben.`,
  uebernommen: (wer: string, lead: string) => `${wer} hat ${lead} übernommen.`,
  terminAnderePerson: (wer: string, lead: string, wann: string) => `${wer}: Termin mit ${lead} am ${wann}`,
  erstReaktion: 'Erst Reaktion eintragen.',
  // Integration M1–M8: gemeinsame Wortlaute aus M4 (E-Mail)
  entwurfGespeichert: 'Entwurf gespeichert.',
  entwurfVerworfen: 'Entwurf verworfen.',
  emailGesendet: (vorlage?: string | null) => `E-Mail gesendet${vorlage ? ` · ${vorlage}` : ''}.`,
  emailBestaetigt: 'E-Mail gesendet – bestätigt.',
  bounceErfasst: 'Bounce erfasst – Adresse steht auf der Sperrliste.',
} as const

// ux § 4.8 – Dialoge nur bei Unumkehrbarem; Primärbutton benennt die Handlung
export const DIALOG = {
  endgueltigLoeschen: {
    text: 'Lead endgültig löschen? Alle Ereignisse, Anrufe und E-Mails werden gelöscht. Die Sperrliste bleibt.',
    primaer: 'Endgültig löschen',
  },
  widerspruch: (name: string) => ({
    text: `Werbewiderspruch für ${name} erfassen? Der Lead wird beendet, alle Sequenzen enden, und die Person kann nicht erneut importiert oder kontaktiert werden.`,
    primaer: 'Widerspruch erfassen',
  }),
  sperrlisteEntfernen: {
    text: 'Eintrag entfernen? Die Person könnte wieder kontaktiert werden. Grund: Pflicht.',
    primaer: 'Entfernen',
  },
  passcodeZuruecksetzen: (name: string) => ({
    text: `${name}s Passcode zurücksetzen? ${name} muss sich beim nächsten Mal mit dem Einmal-Passcode anmelden.`,
    primaer: 'Zurücksetzen',
  }),
  // BAUPLAN § 6.4 (v1) vor ux § 4.8: aktualisierte Leads werden nicht zurückgesetzt (Integration, FOUNDATION-WUNSCH M7)
  importRueckgaengig: (datum: string, zeilen: string, geloescht: string) => ({
    text: `Import vom ${datum} (${zeilen} Zeilen) rückgängig machen? ${geloescht} Leads werden gelöscht; aktualisierte Leads bleiben auf dem neuen Stand. Ereignisse, die danach entstanden sind, bleiben erhalten.`,
    primaer: 'Rückgängig machen',
  }),
  sequenzVersion: (n: number, version: number) => ({
    text: `${n} laufende Leads auf Version ${version} umstellen? Fällige Daten werden neu berechnet.`,
    primaer: 'Umstellen',
  }),
  anrufVerwerfen: {
    text: 'Anruf ohne Ergebnis verwerfen?',
    primaer: 'Verwerfen',
    hinweis: 'Verwerfen löscht den lokalen Anruf-Entwurf. Behalten lässt dich das Ergebnis eintragen.',
    behalten: 'Behalten',
  },
  anonymisieren: (n: number) => ({
    text: `${n} Leads anonymisieren? Name, URL, Telefon, E-Mail werden entfernt; Zählwerte bleiben.`,
    primaer: 'Anonymisieren',
  }),
  ueberallAbmelden: {
    text: 'Überall abmelden? Alle Geräte werden abgemeldet – auch die Akten-Sitzung desselben Kontos.',
    primaer: 'Überall abmelden',
  },
  abbrechen: 'Abbrechen',
} as const

export const ALLGEMEIN = {
  anmelden: 'Anmelden',
  abmelden: 'Abmelden',
  ueberallAbmelden: 'Überall abmelden',
  tastenkuerzel: 'Tastenkürzel',
  suchenOderBefehl: 'Suchen oder Befehl …',
  passcode: 'Passcode',
  angemeldetBleiben: 'Angemeldet bleiben',
  werBistDu: 'Wer bist du?',
  nurFuer: 'Nur für Vincent und Mike.',
  passcodeVergessen: 'Passcode vergessen? Die andere Person setzt ihn unter Einstellungen → Passcode zurück.',
  passcodeFalsch: 'Passcode stimmt nicht – versuch es nochmal.',
  passcodeZuKurz: 'Mindestens 10 Zeichen.',
  nochmalIn: (s: number) => `Nochmal in ${s} s`,
  zuVieleVersuche: 'Zu viele Versuche – bitte in ein paar Minuten noch einmal.',
  keineVerbindung: 'Keine Verbindung – bitte später noch einmal.',
  angemeldet: 'angemeldet',
  offlineBanner: 'Offline – du kannst lesen, Änderungen werden nicht gespeichert.',
  live: 'live',
  getrennt: 'getrennt',
  schliessen: 'Schließen',
  laden: 'Lade …',
  mehr: 'Mehr',
  // Integration M1–M8: gemeinsame Formular-Wortlaute (M2, M6, M8)
  speichern: 'Speichern',
  nichtsGeaendert: 'Nichts geändert',
  nummerUnvollstaendig: 'Nummer unvollständig',
  grundEingeben: 'Grund eingeben',
} as const

// ux § 6.3 – Timeline-Wortlaute. `ctx` liefert Namen, die die Aktivität nur als ID kennt.
export type TimelineKontext = {
  vorlage?: string | null
  stufe?: (s: string) => string
  /** Rang einer Stufe (lib/stufen.stageRank) – „Phase zurückgesetzt“, wenn der Trigger kein `rank`/`prev_rank` schreibt. */
  rang?: (s: string) => number
  mitglied?: (id: string | null) => string
  datum?: (iso: string) => string
}
type Meta = Record<string, unknown>
const meta = (a: Activity): Meta => (a.metadata && typeof a.metadata === 'object' ? (a.metadata as Meta) : {})
const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null)
const num = (v: unknown): number | null => (typeof v === 'number' ? v : null)

export function TIMELINE_TEXT(a: Activity, ctx: TimelineKontext = {}): string {
  const m = meta(a)
  const stufe = (s: unknown) =>
    str(s)
      ? ctx.stufe
        ? ctx.stufe(str(s) as string)
        : (STUFEN_LABEL[str(s) as LeadStage]?.label ?? (str(s) as string))
      : '–'
  const datum = (iso: unknown) => (str(iso) ? (ctx.datum ? ctx.datum(str(iso) as string) : (str(iso) as string)) : '')
  const vorlage = ctx.vorlage ?? str(m.template_name)
  const zitat = a.note ? ` – ‚${a.note}‘` : ''
  switch (a.type) {
    case 'angelegt': {
      const quelle = a.source
      if (quelle === 'schnellimport') return 'Angelegt per Schnellimport (ChatGPT)'
      // Runde 3 (Wunsch daten.md Nr. 6): diese Zeile trägt das rückdatierte erste Sheet-Datum – nicht wie der Importzeitpunkt klingen
      if (quelle === 'import_sheet')
        return `Angelegt in der CRM-Tabelle (importiert${num(m.row) !== null ? `, Zeile ${num(m.row)}` : ''})`
      if (quelle === 'import_csv') return 'Importiert aus CSV'
      return 'Angelegt'
    }
    case 'import':
      return `Importiert aus CRM-Tabelle${num(m.row) !== null ? ` (Zeile ${num(m.row)})` : ''}`
    case 'vernetzung_gesendet': {
      const v = str(m.note_variant)
      return `Vernetzung angefragt (${v === 'note_v1' ? 'Notiz V1' : v === 'note_v2' ? 'Notiz V2' : 'ohne Notiz'})`
    }
    case 'vernetzung_angenommen': {
      const t = num(m.days_after_request)
      return `Vernetzung angenommen${t !== null ? ` (${t} Tage nach Anfrage)` : ''}`
    }
    case 'vernetzung_zurueckgezogen':
      return a.note === 'abgelehnt' ? 'Anfrage abgelehnt' : 'Anfrage zurückgezogen' // § 1.5 Nr. 34
    case 'vernetzung_abgelaufen':
      return 'Anfrage abgelaufen'
    case 'gespraech_eroeffnet':
      return `Gesprächseröffnung gesendet${vorlage ? ` · Vorlage ${vorlage}` : ''}`
    case 'nachricht_gesendet':
      if (!a.enrollment_id) return `Antwort gesendet${vorlage ? ` · ${vorlage}` : ''}` // § 1.5 Nr. 25
      return `${vorlage ?? 'Nachricht'} gesendet`
    case 'nachricht_erhalten': {
      const label = a.reply_label ? reaktionLabel(a.reply_label as ReplyLabel, !!a.note) : null
      return `Antwort erhalten${label ? `: ${label}` : ''}${zitat}`
    }
    case 'pitch_gesendet':
      return `Pitch ${str(m.variante) ?? (vorlage?.includes('B') ? 'B' : 'A')} gesendet`
    case 'anruf': {
      const ergebnis = a.outcome ? (ERGEBNIS_LABEL[a.outcome as CallOutcome] ?? a.outcome) : 'Ergebnis offen'
      const versuch = num(m.attempt_no) !== null ? ` · Versuch ${num(m.attempt_no)}/${num(m.max_attempts) ?? 5}` : ''
      const dauer = str(m.dauer) ? ` · ${str(m.dauer)}` : ''
      const wer = str(m.reached_name) ? ` · ${str(m.reached_name)}` : ''
      return `Anruf · ${ergebnis}${wer}${versuch}${dauer}`
    }
    case 'email_gesendet':
      return a.outcome === 'opened_in_client'
        ? `E-Mail in Gmail geöffnet${vorlage ? ` · ${vorlage}` : ''}`
        : `E-Mail gesendet${vorlage ? ` · ${vorlage}` : ''}`
    case 'email_erhalten':
      return 'E-Mail beantwortet'
    case 'meeting_geplant': {
      const typ = str(m.meeting_type) === 'strategiegespraech' ? 'Strategiegespräch' : 'Erstgespräch'
      return `${typ} vereinbart${str(m.scheduled_at) ? ` für ${datum(m.scheduled_at)}` : ''}`
    }
    case 'meeting_stattgefunden':
      return `${str(m.meeting_type) === 'strategiegespraech' ? 'Strategiegespräch' : 'Erstgespräch'} stattgefunden`
    case 'meeting_no_show':
      return `${str(m.meeting_type) === 'strategiegespraech' ? 'Strategiegespräch' : 'Erstgespräch'} No-Show`
    case 'meeting_abgesagt':
      return `${str(m.meeting_type) === 'strategiegespraech' ? 'Strategiegespräch' : 'Erstgespräch'} abgesagt`
    case 'meeting_verschoben':
      return `${str(m.meeting_type) === 'strategiegespraech' ? 'Strategiegespräch' : 'Erstgespräch'} verschoben${str(m.scheduled_at) ? ` auf ${datum(m.scheduled_at)}` : ''}`
    case 'notiz':
      if (str(m.kind) === 'auskunft_export') return 'Auskunft exportiert (JSON)' // § 1.5 Nr. 32
      if (str(m.kind) === 'bearbeitet') return 'Notiz bearbeitet'
      return 'Notiz'
    case 'stage_wechsel': {
      // Trigger leads_after_update schreibt `from`/`to`/`ended_reason` und `outcome = <neue Stufe>`; ältere Zeilen
      // `prev_stage`/`stage`/`prev_rank`/`rank` und den Grund in `outcome` (Integration, FOUNDATION-WUNSCH M2).
      const vonKey = str(m.prev_stage ?? m.from)
      const nachKey = str(m.stage ?? m.to)
      const von = stufe(vonKey)
      const nach = stufe(nachKey)
      if (nachKey === 'beendet') {
        const grund = str(m.ended_reason) ?? (a.outcome && a.outcome !== 'beendet' ? a.outcome : null)
        return `Beendet · ${grund ? (GRUND_LABEL[grund as EndedReason] ?? grund) : 'Sonstiges'}`
      }
      if (nachKey === 'langfristig') return `Wiedervorlage${str(m.due) ? ` am ${datum(m.due)}` : ''}`
      if (vonKey === 'beendet') return 'Reaktiviert'
      const rangVon = num(m.prev_rank) ?? (vonKey && ctx.rang ? ctx.rang(vonKey) : null)
      const rangNach = num(m.rank) ?? (nachKey && ctx.rang ? ctx.rang(nachKey) : null)
      const rueck = rangVon !== null && rangNach !== null && rangVon > rangNach
      const quelle = str(m.via) === 'pipeline' ? ' (per Pipeline)' : ''
      return `${rueck ? 'Phase zurückgesetzt' : 'Phase geändert'}: ${von} → ${nach}${quelle}`
    }
    case 'uebergabe':
      return `Übergeben an ${ctx.mitglied ? ctx.mitglied(str(m.to_owner_id)) : (str(m.to_name) ?? 'die andere Person')}${zitat}`
    case 'freigabe':
      return str(m.taken) ? 'Übernommen' : `Freigegeben${a.note ? ` · ${a.note}` : ''}`
    case 'sequenz_gestartet':
      return `Sequenz ${str(m.sequence_name) ?? ''} gestartet${num(m.version) !== null ? ` (Version ${num(m.version)})` : ''}`.replace(
        '  ',
        ' ',
      )
    case 'sequenz_gestoppt':
      return `Sequenz beendet${a.outcome ? `: ${STOP_LABEL[a.outcome] ?? a.outcome}` : ''}`
    case 'sequenz_abgeschlossen':
      return 'Sequenz abgeschlossen'
    case 'sequenz_pausiert':
      return 'Sequenz pausiert wegen E-Mail-Sequenz'
    case 'schritt_uebersprungen':
      return `Schritt übersprungen${vorlage ? ` · ${vorlage}` : ''}`
    case 'schritt_verschoben': {
      const delta = num(m.delta_days)
      return `Schritt verschoben${str(m.due) ? ` auf ${datum(m.due)}` : ''}${delta !== null ? ` (${delta >= 0 ? '+' : '−'}${Math.abs(delta)} T)` : ''}`
    }
    case 'aufgabe_erledigt':
      return str(m.kind) === 'rueckruf'
        ? `Rückruf vereinbart${str(m.due) ? ` ${datum(m.due)}` : ''}`
        : `Aufgabe erledigt${str(m.title) ? ` · ${str(m.title)}` : ''}`
    case 'einwilligung':
      if (str(m.kind) === 'anrufgrund')
        return `Anrufgrund gesetzt: ${a.outcome ? (ANRUFGRUND_LABEL[a.outcome as CallBasis] ?? a.outcome) : '–'}` // § 1.5 Nr. 14
      if (str(m.kind) === 'datenschutz')
        return `Datenschutz-Info gesendet (${str(m.version) ?? 'v1.0'}, ${str(m.kanal) ?? 'E-Mail'})`
      return `Erlaubnis erfasst: ${a.outcome ? (ERLAUBNIS_LABEL[a.outcome as EmailConsentBasis] ?? a.outcome) : '–'}${zitat}`
    case 'widerspruch':
      return `Widerspruch erfasst · ${str(m.channels) ?? 'alle Kanäle'}`
    default:
      return a.type
  }
}

const STOP_LABEL: Record<string, string> = {
  antwort_erhalten: 'Antwort erhalten',
  meeting_gebucht: 'Termin gebucht',
  lead_beendet: 'Lead beendet',
  verbindung_entfernt: 'Verbindung entfernt',
  widerspruch: 'Widerspruch',
  manuell: 'manuell',
  ersetzt: 'ersetzt',
  uebergabe: 'Übergabe',
}
