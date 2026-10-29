// Touren: die Einführung (erster Login, 9 Schritte) und je Hilfe-Thema eine Mini-Tour für „Zeig’s mir“. Jeder Schritt nennt
// optional die Seite (`pfad`, die Tour navigiert dorthin) und Ziele in Prioritätsreihenfolge; fehlt das Ziel, steht das Popover
// mittig (mit `leer`-Hinweis, falls gesetzt). Texte: ein bis zwei Sätze, du-Form, ohne Tasten im Satz – Tasten stehen in `tasten`
// (auf Touch ausgeblendet), damit jeder Satz auch am iPhone stimmt.
import { PFADE } from '@/app/pfade'
import type { TourKey } from './ereignis'
import type { ZielSpec } from './ziel'

export type TourSchritt = {
  id: string
  titel: string
  text: string
  pfad?: string
  ziele?: readonly ZielSpec[]
  tasten?: readonly string[]
  /** Zusatzsatz, wenn das Ziel gerade fehlt (leere Sektion, eingeklappte Liste …) */
  leer?: string
}

export type Tour = { key: TourKey; titel: string; schritte: readonly TourSchritt[] }

/** Nav-Eintrag: Sidebar/Icon-Rail (`Hauptnavigation`) oder Tab-Leiste (< 768 px, `Navigation`). */
const nav = (pfad: string): ZielSpec[] => [
  `[data-tour="nav:${pfad}"]`,
  `nav[aria-label="Hauptnavigation"] a[href="${pfad}"]`,
  `nav[aria-label="Navigation"] a[href="${pfad}"]`,
]
/** „Mehr“ in der Tab-Leiste – dort liegen Pipeline, E-Mail, Leitfäden, Team, Hilfe, Feedback am iPhone. */
const MEHR: ZielSpec = 'nav[aria-label="Navigation"] button[aria-haspopup="menu"]'
const ERSTE_KARTE: ZielSpec[] = [
  '[data-sektion] [data-tour="queue-karte"]',
  '[data-sektion] article[role="listitem"]',
  '[data-sektion]',
]
const FEEDBACK: ZielSpec[] = [
  '[data-tour="feedback"]',
  '[data-feedback-knopf]',
  'button[aria-label^="Feedback"]',
  ...nav(PFADE.feedback),
  MEHR,
]

const ONBOARDING: Tour = {
  key: 'onboarding',
  titel: 'Einführung',
  schritte: [
    {
      id: 'heute',
      pfad: PFADE.heute,
      ziele: nav(PFADE.heute),
      titel: 'Willkommen, {name}.',
      text: '„Heute“ ist dein Startscreen: Hier steht nur, was jetzt dran ist – jede Karte mit fertigem Text. Die Tour dauert eine Minute.',
      tasten: ['G H'],
    },
    {
      id: 'karte',
      pfad: PFADE.heute,
      ziele: ERSTE_KARTE,
      titel: 'Eine Karte, eine Handlung',
      text: 'Text kopieren, in LinkedIn senden, „Gesendet“ bestätigen – den nächsten Schritt plant das CRM selbst. Alles lässt sich 6 Sekunden lang rückgängig machen.',
      tasten: ['J', 'K', 'C', 'E', 'S', 'Z'],
      leer: 'Gerade ist nichts fällig – die Karten erscheinen hier, sobald etwas ansteht.',
    },
    {
      id: 'zaehler',
      pfad: PFADE.heute,
      ziele: ['[data-tageszaehler]', '[data-kanalzeile]'],
      titel: 'Tageszähler',
      text: 'Anfragen heute gegen Tagesziel und Wochenbudget. Was du in „Neue Anfragen“ abhakst, zählt automatisch – nachtippen musst du nur Anfragen ohne Liste.',
      tasten: ['+', '⇧+'],
    },
    {
      id: 'leads',
      ziele: nav(PFADE.leads),
      titel: 'Leads',
      text: 'Alle Kontakte als Tabelle: suchen, filtern, direkt in der Zelle bearbeiten. Ein Lead öffnet sich rechts im Peek, die Liste bleibt stehen.',
      tasten: ['G L', '/'],
    },
    {
      id: 'pipeline',
      ziele: [...nav(PFADE.pipeline), MEHR],
      titel: 'Pipeline',
      text: 'Dieselben Leads als Kanban über zehn Phasen. Karte ziehen ändert die Phase – braucht es einen Termin oder Grund, fragt das CRM nach.',
      tasten: ['G P'],
    },
    {
      // 29.10.2026: Telefon ist keine eigene Rubrik mehr – angerufen wird aus dem Lead; die Deals stehen unter Leads
      id: 'deals',
      ziele: nav(PFADE.dealPipeline),
      titel: 'Deal-Pipeline',
      text: 'Alle Deals ab dem Erstgespräch – egal ob aus LinkedIn, Telefon oder E-Mail. Die Spalte ergibt sich aus den Terminen im Lead.',
    },
    {
      id: 'kpis',
      ziele: [...nav(PFADE.kpis), ...nav(PFADE.team)],
      titel: 'KPIs & Team',
      text: 'Zahlen, die sich aus euren Aktionen rechnen – umschaltbar zwischen Vincent, Mike und Team. So seht ihr jederzeit, wie die andere Person läuft.',
      tasten: ['G K', 'G A'],
    },
    {
      id: 'hilfe',
      ziele: [...nav(PFADE.hilfe()), MEHR],
      titel: 'Hilfe',
      text: 'Das Handbuch: was das CRM kann und was nicht, zu jedem Thema „Zeig’s mir“. Dort startest du diese Tour jederzeit neu.',
      tasten: ['G S'],
    },
    {
      id: 'feedback',
      ziele: FEEDBACK,
      titel: 'Feedback geben',
      text: 'Etwas klemmt, fehlt oder sieht falsch aus? Der Knopf schickt deine Meldung samt Screenshot der Seite direkt an Claude.',
      tasten: ['⌥F'],
    },
  ],
}

const HEUTE: Tour = {
  key: 'heute',
  titel: 'Heute',
  schritte: [
    {
      id: 'kanalzeile',
      pfad: PFADE.heute,
      ziele: ['[data-kanalzeile]'],
      titel: 'Kanalzeile',
      text: 'Anfragen heute, Woche, Annahmequote und was heute noch möglich ist. „Liste einfügen“ startet den Schnellimport, +1/+5/+10 zählt Anfragen ohne Liste.',
      tasten: ['⌘⇧O'],
    },
    {
      id: 'batch',
      pfad: PFADE.heute,
      ziele: ['[role="group"][aria-label="Batch-Filter"]'],
      titel: 'Batch-Chips',
      text: 'Filtern die Queue auf einen Sequenzschritt – so schickst du gleiche Follow-ups am Stück.',
      tasten: ['⌥1', '⌥0'],
    },
    {
      id: 'karte',
      pfad: PFADE.heute,
      ziele: ERSTE_KARTE,
      titel: 'Die aufgeklappte Karte',
      text: 'Nur die Karte unter dem Cursor ist offen. Kopieren, senden, bestätigen – Später, Notiz, Antwort und Beenden liegen daneben.',
      tasten: ['J', 'K', 'C', 'E', 'S', 'N', 'A', 'B'],
      leer: 'Gerade ist nichts fällig.',
    },
    {
      id: 'person',
      pfad: PFADE.heute,
      ziele: ['[role="group"][aria-label="Heute von"]'],
      titel: 'Vertreten',
      text: 'Hier schaltest du auf das Heute der anderen Person um – zum Vertreten. Aktionen gehen dort ganz normal.',
    },
  ],
}

const LEADS: Tour = {
  key: 'leads',
  titel: 'Leads & Pipeline',
  schritte: [
    {
      id: 'suche',
      pfad: PFADE.leads,
      ziele: ['[data-toolbar]', '[data-suche]'],
      titel: 'Suche und Ansichten',
      text: 'Suche, Ansichten und Filter. Alles steht in der Adresse – eine Ansicht kannst du als Link schicken.',
      tasten: ['/', '⌫'],
    },
    {
      id: 'tabelle',
      pfad: PFADE.leads,
      ziele: ['table[aria-label="Leads"]', '[aria-label="Leads"][role="list"]'],
      titel: 'Tabelle',
      text: 'Cursor bewegen, Lead im Peek öffnen, Zellen direkt bearbeiten, mehrere auswählen und gemeinsam ändern.',
      tasten: ['J', 'K', '↵', 'E', 'Space', '⌥B'],
    },
    {
      id: 'pipeline',
      pfad: PFADE.pipeline,
      ziele: ['[data-kanban]'],
      titel: 'Pipeline',
      text: 'Zehn Phasen als Spalten. Ziehen ändert die Phase; wo ein Termin oder Grund nötig ist, fragt das CRM nach.',
      tasten: ['H', 'L', '⇧→', '⇧←'],
    },
  ],
}

const LINKEDIN: Tour = {
  key: 'linkedin',
  titel: 'LinkedIn',
  schritte: [
    {
      id: 'neue',
      pfad: PFADE.heute,
      ziele: ['[data-sektion="neue_anfragen"]'],
      titel: 'Neue Anfragen',
      text: 'Deine Tagesliste: Profil öffnen, in LinkedIn vernetzen, im CRM „Anfrage gesendet“ abhaken.',
      tasten: ['O', 'E', '⇧E', 'X'],
      leer: 'Gerade leer – die Liste füllt sich über „Liste einfügen“.',
    },
    {
      id: 'annahme',
      pfad: PFADE.heute,
      ziele: ['[data-sektion="annahme_pruefen"]'],
      titel: 'Annahme prüfen',
      // Runde 3: Annahmen aus den LinkedIn-Mails verbucht das CRM selbst (Einstellungen → Verbindungen)
      text: 'Ist dein Gmail unter Verbindungen angeschlossen, verbucht das CRM Annahmen aus den LinkedIn-Mails selbst. Was ohne Mail bleibt, hakst du hier ab – dann startet die Sequenz und der Opener liegt für heute bereit.',
      tasten: ['E', 'Space', 'D', 'X'],
      leer: 'Gerade keine offenen Anfragen der letzten 7 Tage.',
    },
    {
      id: 'nachrichten',
      pfad: PFADE.heute,
      ziele: ['[data-sektion="opener"]', '[data-sektion="ueberfaellig"]', '[data-sektion="heute"]'],
      titel: 'Opener und Follow-ups',
      text: 'Jede Karte hat den fertigen Text. Kopieren, in LinkedIn senden, „Gesendet“ bestätigen – der nächste Schritt wird automatisch terminiert.',
      tasten: ['C', 'E'],
      leer: 'Gerade ist keine Nachricht fällig.',
    },
    {
      id: 'antworten',
      pfad: PFADE.heute,
      ziele: ['[data-sektion="antworten"]'],
      titel: 'Antworten',
      text: 'Antworten aus den LinkedIn-Mails landen hier von selbst, mit Nachrichtentext. Was du live in LinkedIn liest, trägst du mit A am Lead ein – die Sequenz stoppt, der passende Antwort-Leitfaden liegt bereit.',
      tasten: ['A', '⌘K'],
      leer: 'Gerade wartet keine Antwort auf dich.',
    },
  ],
}

const TELEFON: Tour = {
  key: 'telefon',
  titel: 'Telefon',
  schritte: [
    {
      id: 'block',
      pfad: PFADE.telefon,
      ziele: [
        '[data-tour="call-block"]',
        { css: 'button', text: 'Call-Block starten' },
        { css: 'button', text: 'Call-Block fortsetzen' },
      ],
      titel: 'Call-Block',
      text: 'Führt dich Lead für Lead durch die Liste und zählt mit: Anrufe, erreicht, Entscheider, Termine.',
      tasten: ['↵'],
    },
    {
      id: 'liste',
      pfad: PFADE.telefon,
      ziele: ['[role="listbox"][aria-label="Rückrufe"]', '[role="listbox"][aria-label="Anrufliste"]'],
      titel: 'Anrufliste',
      text: 'Fällige Rückrufe zuerst, dann Wiederholungen, dann frische Leads. Eine Zeile anwählen und anrufen.',
      tasten: ['J', 'K', '↵', 'R', 'S'],
      leer: 'Gerade ist niemand anrufbar.',
    },
    {
      id: 'nicht',
      pfad: PFADE.telefon,
      ziele: ['section[aria-labelledby="sek-nicht"]'],
      titel: 'Noch nicht anrufbar',
      text: 'Hier fehlt eine Telefonnummer, oder der Lead ist gesperrt (Widerspruch, Sperrliste, Firma). Ein fehlender Anrufgrund hält niemanden auf – er ist nur ein Hinweis.',
    },
  ],
}

const EMAIL: Tour = {
  key: 'email',
  titel: 'E-Mail',
  schritte: [
    {
      id: 'tabs',
      pfad: PFADE.email,
      ziele: ['[role="tablist"][aria-label="E-Mail"]'],
      titel: 'Fällig · Entwürfe · Gesendet',
      text: 'Fällige Schritte aus E-Mail-Sequenzen, angefangene Entwürfe und alles, was du als gesendet bestätigt hast.',
    },
    {
      id: 'faellig',
      pfad: PFADE.email,
      ziele: ['[aria-label="Fällige E-Mail-Schritte"]'],
      titel: 'Composer',
      text: 'Ein Eintrag öffnet den Composer. Ohne Erlaubnis-Grundlage bleibt er gesperrt – das schützt vor unzulässiger Werbung.',
      tasten: ['J', 'K', '↵', '⌥M'],
      leer: 'Gerade ist keine E-Mail fällig.',
    },
    {
      id: 'gmail',
      pfad: PFADE.email,
      titel: 'Gesendet wird in Gmail',
      text: '„In Gmail öffnen“ füllt Empfänger, Betreff und Text. Du sendest in Gmail, zurück im CRM bestätigst du „Gesendet?“.',
      tasten: ['⌘↵'],
    },
  ],
}

const LEITFAEDEN: Tour = {
  key: 'leitfaeden',
  titel: 'Leitfäden',
  schritte: [
    {
      id: 'baum',
      pfad: PFADE.leitfaeden,
      ziele: ['aside[aria-label="Baum"]'],
      titel: 'Baum',
      text: 'Kanal → Phase → Leitfaden. Unter jeder Phase steht ihr Zweck, rechts die Nutzung.',
      tasten: ['/', 'J', 'K', '↵'],
    },
    {
      id: 'detail',
      pfad: PFADE.leitfaeden,
      ziele: ['[data-tour="leitfaden-detail"]', 'aside[aria-label="Baum"] + div'],
      titel: 'Text, Vorschau, Statistik',
      text: 'Text mit Platzhaltern, Vorschau mit einem echten Lead und wie oft der Leitfaden Antworten bringt.',
      tasten: ['E', 'C', '['],
      leer: 'Am iPhone öffnet ein Tipp auf den Leitfaden die Ansicht.',
    },
  ],
}

const KPIS: Tour = {
  key: 'kpis',
  titel: 'KPIs',
  schritte: [
    {
      id: 'person',
      pfad: PFADE.kpis,
      ziele: ['[role="group"][aria-label="Person"]'],
      titel: 'Vincent · Mike · Team',
      text: 'Hier schaltest du die Person um – so siehst du, wie die andere Person läuft, oder beide zusammen.',
      tasten: ['1', '2', '3'],
    },
    {
      id: 'zeitraum',
      pfad: PFADE.kpis,
      ziele: ['[role="group"][aria-label="Zeitraum"]'],
      titel: 'Zeitraum',
      text: 'Monat, Kalenderwoche, 7 oder 30 Tage – verglichen wird immer mit der Vorperiode.',
      tasten: ['←', '→'],
    },
    {
      id: 'funnel',
      pfad: PFADE.kpis,
      ziele: ['ol[aria-label="Funnel"]'],
      titel: 'Funnel',
      text: 'Von der Vernetzung bis zum Kunden, mit Quoten. Ein Klick auf eine Zahl zeigt die Leads dahinter.',
    },
    {
      id: 'team',
      pfad: PFADE.team,
      ziele: ['section[aria-label="Vergleich"]'],
      titel: 'Team',
      text: 'Vincent und Mike nebeneinander: zuletzt aktiv, was heute ansteht, dieselben Kennzahlen. Darunter das Team-Protokoll mit jeder Aktion, live.',
      tasten: ['G A', '1', '2', '3'],
    },
  ],
}

const IMPORT: Tour = {
  key: 'import',
  titel: 'Import',
  schritte: [
    {
      id: 'presets',
      pfad: PFADE.import,
      ziele: ['[role="radiogroup"][aria-label="Preset"]'],
      titel: 'Import-Assistent',
      text: 'Datei wählen, Vorlage wählen, Spalten prüfen, Probelauf – erst dann wird geschrieben. Jeder Import ist 30 Tage rückgängig zu machen.',
      leer: 'Den Import-Assistenten gibt es nur am Desktop.',
    },
    {
      id: 'schnell',
      pfad: PFADE.import,
      titel: 'Schnellimport',
      text: 'Für ChatGPT-Listen: einfügen, Anrede je Zeile wählen, übernehmen. Dubletten erkennt das CRM an der LinkedIn-Adresse.',
      tasten: ['⌘⇧O'],
    },
  ],
}

const FEEDBACK_TOUR: Tour = {
  key: 'feedback',
  titel: 'Feedback',
  schritte: [{ ...ONBOARDING.schritte[ONBOARDING.schritte.length - 1]!, id: 'feedback-allein' }],
}

export const TOUREN: Record<TourKey, Tour> = {
  onboarding: ONBOARDING,
  heute: HEUTE,
  leads: LEADS,
  linkedin: LINKEDIN,
  telefon: TELEFON,
  email: EMAIL,
  leitfaeden: LEITFAEDEN,
  kpis: KPIS,
  import: IMPORT,
  feedback: FEEDBACK_TOUR,
}

/** `{name}` im Titel durch den Vornamen ersetzen (ohne Namen: „Willkommen.“). */
export function mitName(text: string, name: string | null | undefined): string {
  return name ? text.replace('{name}', name) : text.replace(', {name}', '').replace('{name}', '')
}
