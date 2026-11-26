// Gemeinsame Wortlaute (BAUPLAN § 3.1.9 Ende, ux § 6). Primärquellen für Stufen/Gründe/Ergebnisse sind
// settings.stage_labels, settings.ended_reason_labels und call_outcome_defs – diese Maps sind der Fallback.
// Lint (texte.test.ts): keine geraden Anführungszeichen, kein Ausrufezeichen, kein „...“, kein „--“,
// nicht „erfolgreich“, „OK“, „Snooze“, „Owner“.
import type {
  CallBasis,
  CallOutcome,
  Channel,
  EmailConsentBasis,
  EndedReason,
  LeadStage,
  ReplyLabel,
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
  emailFaellig: { titel: 'Keine E-Mail fällig.', satz: 'E-Mails gehen nur an Personen, die darum gebeten haben.' },
  seiteNichtGefunden: {
    titel: 'Seite nicht gefunden.',
    satz: 'Die Adresse kennt das CRM nicht.',
    aktion: 'Zu den Leads',
  },
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
  keinZugriff: 'Dieses Konto hat keinen Zugriff auf das CRM.',
  neueVersion: 'Neue Version verfügbar',
  neueVersionLaden: 'Jetzt laden',
  rueckgaengigGemacht: 'Rückgängig gemacht.',
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
    // Lead-Blatt des Neustarts (25.11.2026): Sequenzen und Import gibt es in der Oberfläche nicht mehr, der Titel fragt schon
    kurz: 'Die Person kommt auf die Sperrliste und wird nicht mehr kontaktiert.',
    primaer: 'Widerspruch erfassen',
  }),
  sperrlisteEntfernen: {
    text: 'Eintrag entfernen? Die Person könnte wieder kontaktiert werden. Grund: Pflicht.',
    primaer: 'Entfernen',
  },
  ueberallAbmelden: {
    text: 'Überall abmelden? Alle Geräte werden abgemeldet – auch die Akten-Sitzung desselben Kontos.',
    primaer: 'Überall abmelden',
  },
} as const

export const ALLGEMEIN = {
  anmelden: 'Anmelden',
  abmelden: 'Abmelden',
  ueberallAbmelden: 'Überall abmelden',
  passcode: 'Passcode',
  angemeldetBleiben: 'Angemeldet bleiben',
  werBistDu: 'Wer bist du?',
  nurFuer: 'Nur für Vincent und Mike.',
  passcodeFalsch: 'Passcode stimmt nicht – versuch es nochmal.',
  passcodeZuKurz: 'Mindestens 10 Zeichen.',
  nochmalIn: (s: number) => `Nochmal in ${s} s`,
  zuVieleVersuche: 'Zu viele Versuche – bitte in ein paar Minuten noch einmal.',
  keineVerbindung: 'Keine Verbindung – bitte später noch einmal.',
  offlineBanner: 'Offline – du kannst lesen, Änderungen werden nicht gespeichert.',
  mehr: 'Mehr',
  // Integration M1–M8: gemeinsame Formular-Wortlaute (M2, M6, M8)
  speichern: 'Speichern',
  nichtsGeaendert: 'Nichts geändert',
  nummerUnvollstaendig: 'Nummer unvollständig',
  grundEingeben: 'Grund eingeben',
} as const
