// LinkedIn-Recherche & Vernetzung (29.10.2026, Entwicklungsauftrag Vincent): die EINE zentrale Quelle für ICP, Zielrollen,
// Recherchestrategie ohne Premium, Ablauf je Profil und Stopp-Regeln. Die Rechercheseite zeigt sie vollständig an; der
// Recherche-Dienst (tools/recherche-dienst) gibt sie dem Agenten per agentAuftrag() wörtlich mit – Text auf einer Webseite wäre für
// ihn nur Daten, keine Anweisung. Änderungen hier gelten ab dem nächsten Agentenstart.
// Serverseitig erzwungen (Migration 17): Ziel ≤ 30, Dublettenfreiheit, Pflichtangaben, Kontrollpunkt alle 10 Profile.

export const REGELN_STAND = 'ICP-Stand 29.10.2026'

export type Abschnitt = { titel: string; punkte: readonly string[]; hinweis?: string }

export const ZIEL: Abschnitt = {
  titel: 'Ziel des Laufs',
  punkte: [
    'Bis zu 30 erfolgreich gesendete Vernetzungsanfragen – ohne persönliche Nachricht („Ohne Notiz senden“).',
    'Gezählt werden nur gesendete Anfragen, nicht recherchierte Profile. Weniger ist in Ordnung: Niemals unqualifizierte Personen aufnehmen, um die Zahl zu erreichen.',
    'Keine Nachrichten schreiben – keine Willkommens-, Opener- oder Follow-up-Nachricht. Die laufen über die bestehenden Abläufe im CRM.',
  ],
}

export const UNTERNEHMEN: Abschnitt = {
  titel: 'Zielunternehmen (alle Punkte müssen passen)',
  punkte: [
    'Branche: Photovoltaik, Solarenergie, Solartechnik oder angrenzende Energietechnik (Speicher, Wallbox, Wärmepumpe).',
    'Standort: Deutschland.',
    'Größe: idealerweise 11 bis 100 Mitarbeitende.',
    'Geschäftsmodell: überwiegend B2C mit direktem Kontakt zu Endkunden (Privathaushalte; kleine Gewerbekunden zusätzlich sind in Ordnung).',
    'Leistung: Planung, Verkauf, Installation, Inbetriebnahme oder Betreuung der Anlagen – selbst ausgeführt.',
    'Kundenschnittstelle: regelmäßiger Kundenkontakt, auch nach der Installation (Wartung, Monitoring, Kundendienst, Reklamationen).',
  ],
  hinweis:
    'Immer das tatsächliche Geschäftsmodell prüfen (Website, Leistungsseiten, LinkedIn-Unternehmensseite) – ein passender Branchenname allein reicht nicht.',
}

export const AUSSCHLUSS: Abschnitt = {
  titel: 'Nicht geeignet',
  punkte: [
    'Reine B2B- oder B2G-Unternehmen',
    'Entwickler großer Solarparks und Freiflächenanlagen',
    'Reine Hersteller von Modulen, Wechselrichtern oder Speichern',
    'Großhändler und Distributoren',
    'Reine Software- und KI-Unternehmen',
    'Netzbetreiber oder Energieversorger ohne eigenes Installations- und Servicegeschäft',
    'Beratungsunternehmen ohne eigene operative Umsetzung',
    'Reine Vermittler und Finanzierungsanbieter',
    'Reine EPC-Dienstleister für industrielle Großprojekte',
    'Unternehmen ohne nachvollziehbare Endkundenbeziehung',
  ],
}

export const ROLLEN: readonly (Abschnitt & { kategorie: 'A' | 'B' | 'C' | 'bedingt' })[] = [
  {
    kategorie: 'A',
    titel: 'Priorität A – Geschäftsführung und Führungskräfte',
    punkte: [
      'Geschäftsführer, Inhaber, Gründer / Co-Founder, Managing Director',
      'Betriebsleiter, Head of Operations',
      'Leiter Kundenservice / Kundenbetreuung, Kundendienstleiter, Serviceleiter, Leiter After Sales',
    ],
  },
  {
    kategorie: 'B',
    titel: 'Priorität B – Projekt, Vertrieb, technische Führung',
    punkte: [
      'Projektleiter, Technischer Projektleiter, Leiter Projektmanagement',
      'Vertriebsleiter, Head of Sales (ausdrücklich zugelassen, besonders mit Endkunden-/Bestandskundenverantwortung)',
      'Technischer Leiter, Elektromeister, Elektroinstallateurmeister, Meister Elektrotechnik',
      'Leiter Installation / Montage, Leiter technischer Kundendienst, Service Operations Manager',
    ],
  },
  {
    kategorie: 'C',
    titel: 'Priorität C – operative Kundenbetreuung und Technik',
    punkte: [
      'Kundenbetreuer, Customer Service / Customer Care Manager, Bestandskundenbetreuer',
      'Technischer Kundenservice, Technical Support Manager, Service- / Kundendienstkoordinator',
      'After-Sales-Manager, Reklamationsmanager, Customer Operations Manager, Disponent / Einsatzplaner',
      'Elektrotechniker und technische Mitarbeitende mit erkennbarem Kundenkontakt',
    ],
  },
  {
    kategorie: 'bedingt',
    titel: 'Bedingt – nur mit nachvollziehbarem Bezug',
    punkte: [
      'Office Manager, Assistenz der Geschäftsführung, Customer Success Manager, HR-Führung – nur wenn ein Bezug zu operativen Abläufen, Kundenservice oder Entscheidungen erkennbar ist.',
    ],
  },
]

export const ENTSCHEIDUNG: Abschnitt = {
  titel: 'Entscheidungsregel für Personen',
  punkte: [
    'Die Person arbeitet in einem passenden Unternehmen UND erfüllt mindestens eins:',
    '1. verantwortet relevante operative Abläufe,',
    '2. trifft oder beeinflusst Entscheidungen über deren Optimierung,',
    '3. arbeitet selbst mit Kundenanfragen, technischen Problemen oder Serviceprozessen,',
    '4. hat technisches Fachwissen, das intern regelmäßig gebraucht wird.',
    'Nicht automatisch im ICP: reine Marketing-, Recruiting-, Finanz-, Einkaufs- oder Softwareentwicklungsrollen.',
    'Ein passender Jobtitel genügt nicht, wenn das Unternehmen nicht passt.',
  ],
}

export const STRATEGIE: Abschnitt = {
  titel: 'Recherche ohne Premium / Sales Navigator',
  punkte: [
    'Nicht über die allgemeine Personensuche arbeiten – sie ist ohne Premium schnell ausgeschöpft.',
    'Startpunkt: ein Profil oder Unternehmen aus „Ausgangspunkte“ unten (qualifizierte Kontakte und Firmen aus dem CRM).',
    'Von dort weiter über „Weitere Profile ansehen“ / „Personen, die auch angesehen wurden“, „Personen, die Sie vielleicht kennen“, den Reiter „Personen“ auf Unternehmensseiten und Mitarbeiterlisten passender Installationsbetriebe.',
    'Systematisch durchs Netzwerk bewegen statt für jeden Lead eine neue allgemeine Suche zu starten – aber jedes Profil einzeln qualifizieren: Netzwerkähnlichkeit heißt nicht ICP-Konformität.',
  ],
}

export const ABLAUF: Abschnitt = {
  titel: 'Ablauf je Profil (immer in dieser Reihenfolge)',
  punkte: [
    '1. Unternehmen prüfen: Deutschland? PV/Solar/Energie? 11–100 MA? Installiert und betreut es selbst für Endkunden (B2C)? Kundenservice/After Sales erkennbar? Quellen: Website, LinkedIn-Unternehmensseite.',
    '2. Person prüfen: vollständiger Name, aktuelle Position, aktueller Arbeitgeber, Zielrolle (A/B/C/bedingt), Profil-URL.',
    '3. Im CRM unter „Profil prüfen und eintragen“ URL, Name und Firma eintragen und „Prüfen“ klicken. Nur bei „Frei“ weiter.',
    '4. Auf LinkedIn „Vernetzen“ → „Ohne Notiz senden“. Erfolgreich ist es nur, wenn danach „Ausstehend“ erscheint.',
    '5. Sofort im CRM Position, Kategorie und Qualifizierungsgrund ergänzen und „Vernetzungsanfrage gesendet“ klicken.',
    'Passt etwas nicht: „Nicht qualifiziert“ mit Grund. Nicht eindeutig klärbar: „Unklar – überspringen“ mit Grund. Meldet „Prüfen“ eine Dublette: „Als Dublette eintragen“. Klappt das Senden nicht: „Senden fehlgeschlagen“.',
    'Fehlende Informationen niemals erfinden.',
  ],
}

export const STOPP: Abschnitt = {
  titel: 'Sofort aufhören und melden',
  punkte: [
    'LinkedIn zeigt eine Warnung, ein Einladungslimit, eine Sicherheitsabfrage (CAPTCHA), verlangt eine Anmeldung oder schränkt das Konto ein.',
    'Dann: nichts umgehen, nichts erneut versuchen – im CRM „LinkedIn-Einschränkung melden“ mit dem Wortlaut der Meldung.',
    'Das CRM zeigt einen Fehler, den ein erneutes Laden der Seite nicht behebt.',
    'Ziel erreicht: Das CRM beendet den Lauf bei 30 gesendeten Anfragen selbst.',
  ],
}

/** Kontrollpunkt nach je 10 geprüften Profilen – die Seite verlangt die Bestätigung, bevor es weitergeht. */
export const KONTROLLE: readonly string[] = [
  'Alle gesendeten Anfragen gingen an Unternehmen in Deutschland aus PV/Solar/Energietechnik mit Endkundengeschäft (B2C).',
  'Keine Hersteller, Großhändler, Solarpark-Entwickler, reine B2B-/Software-/Beratungsfirmen dabei.',
  'Jede Person hat eine Rolle aus A, B, C (oder bedingt mit Begründung).',
  'Jedes Profil wurde vor dem Vernetzen im CRM geprüft – keine Dubletten.',
  'Alle Anfragen ohne Nachricht gesendet, keine Nachricht geschrieben.',
  'Keine erfundenen Angaben in Firma, Position oder Grund.',
]

export const ALLE_ABSCHNITTE: readonly Abschnitt[] = [
  ZIEL,
  UNTERNEHMEN,
  AUSSCHLUSS,
  ...ROLLEN,
  ENTSCHEIDUNG,
  STRATEGIE,
  ABLAUF,
  STOPP,
]

/**
 * Start-Anweisung zum Kopieren, falls kein Recherche-Dienst läuft (Claude in Chrome, ChatGPT-Agent …). Bewusst kurz: Regeln, Ausgangspunkte und Knöpfe
 * stehen auf der Rechercheseite, damit jeder Lauf nach demselben Stand arbeitet.
 */
export function startAnweisung(url: string, person: string): string {
  return [
    `Du arbeitest für ${person} von Steiner & Co. auf LinkedIn. Öffne ${url} in einem eigenen Tab und lass ihn offen – das ist der Recherchelauf im CRM mit allen Regeln, den Ausgangspunkten und den Knöpfen.`,
    'Lies dort zuerst den Abschnitt „Regeln“ vollständig und halte dich genau daran.',
    'Kurz: Recherchiere über die Ausgangspunkte und LinkedIn-Netzwerkvorschläge passende Personen, qualifiziere Unternehmen und Person, prüfe jedes Profil im CRM mit „Prüfen“ und sende nur bei „Frei“ eine Vernetzungsanfrage OHNE Nachricht. Trage direkt danach „Vernetzungsanfrage gesendet“ ein. Höchstens 30 Anfragen.',
    'Schreibe keine Nachrichten. Bei jeder Warnung, Sicherheitsabfrage oder Einschränkung von LinkedIn sofort aufhören und im CRM „LinkedIn-Einschränkung melden“ – nichts umgehen.',
    'Melde mir am Ende die Zahlen aus dem Kopf der Rechercheseite und was nicht geklappt hat.',
  ].join('\n\n')
}

const alsText = (a: Abschnitt) =>
  [`### ${a.titel}`, ...a.punkte.map((x) => `- ${x}`), ...(a.hinweis ? [`Hinweis: ${a.hinweis}`] : [])].join('\n')

/**
 * Vollständiger Auftrag für den unbeaufsichtigten Agenten, den der Recherche-Dienst nach „Recherche starten“ startet (Claude Code
 * mit Chrome im Browser der Person). Enthält alle Regeln wörtlich; die Feld- und Knopfnamen müssen zur Rechercheseite passen.
 */
export function agentAuftrag(p: { url: string; person: string; ziel: number; gesendet: number }): string {
  return [
    `Du bist der Recherche-Agent von Steiner & Co. und arbeitest im Chrome von ${p.person}. ${p.person} hat im CRM „Recherche starten“ gedrückt; der Recherche-Dienst hat dich für diesen Lauf gestartet. Stand beim Start: ${p.gesendet} von ${p.ziel} Vernetzungsanfragen gesendet. Niemand schaut dir laufend zu – arbeite sorgfältig, lieber weniger Anfragen als eine falsche.`,
    'Werkzeuge: der Browser (Claude in Chrome) in einer eigenen Tab-Gruppe, dazu WebSearch/WebFetch für Firmenwebsites. Lies Seiten als Text (get_page_text, find, read_page); Screenshots nur, wenn Text nicht reicht.',
    [
      '## Start',
      `1. Öffne ${p.url} in einem neuen Tab und lass ihn offen. Das ist der Lauf im CRM: Zähler, „Profil prüfen und eintragen“, „Ausgangspunkte“ und „Profile dieses Laufs“ (dort steht, was schon bearbeitet ist – nichts doppelt bearbeiten).`,
      '2. Zeigt das CRM eine Anmeldemaske, steht oben nicht „Recherche läuft“ oder fehlt das Formular: nichts tun und mit „Abbruch: <Grund>“ beenden.',
      '3. Öffne https://www.linkedin.com/feed/ in einem zweiten Tab. Erscheint eine Anmeldeseite oder Sicherheitsabfrage: nicht anmelden, beenden mit „Abbruch: Nicht bei LinkedIn angemeldet“.',
    ].join('\n'),
    ['## Regeln (verbindlich, derselbe Stand wie auf der Rechercheseite)', ...ALLE_ABSCHNITTE.map(alsText)].join(
      '\n\n',
    ),
    [
      '## Im CRM eintragen',
      '- Felder: „LinkedIn-Profil-URL“, „Vorname“, „Nachname“, „Firma (aktueller Arbeitgeber)“, „Aktuelle Position“, die Kategorie-Knöpfe („A · Führung“, „B · Projekt/Vertrieb/Technik“, „C · Kundenbetreuung“, „bedingt“), „Firmen-Website“, „Qualifizierungsgrund / Grund“, „Ausgangspunkt“.',
      '- Je Profil: URL, Vorname, Nachname, Firma eintragen → „Prüfen“. Nur bei „Frei – …“ auf LinkedIn vernetzen. Danach Position, Kategorie, Grund (und Website, Ausgangspunkt) ergänzen → „Vernetzungsanfrage gesendet“. Bei „Nicht anfragen – …“ → „Als Dublette eintragen“.',
      '- Erscheint eine rote Meldung, lies sie und behebe die Ursache (meist ein fehlendes Feld). Grüne Meldung = gespeichert.',
      '- Vor jedem neuen Profil auf den CRM-Tab schauen: Steht oben „Pausiert“, „Abgeschlossen“, „Abgebrochen“ oder „Fehler / Einschränkung“, sofort aufhören.',
    ].join('\n'),
    [
      '## Kontrollpunkt',
      'Nach je 10 geprüften Profilen sperrt das CRM das Formular und zeigt „Kontrollpunkt“. Prüfe die letzten Einträge unter „Profile dieses Laufs“ ehrlich gegen diese Punkte:',
      ...KONTROLLE.map((x) => `- ${x}`),
      'Hake nur ab, was stimmt, dann „Kriterien geprüft – weiter“. Stimmt ein Punkt nicht: nicht abhaken und mit „Abbruch: Kontrollpunkt – <welcher Eintrag, was>“ beenden.',
    ].join('\n'),
    [
      '## Niemals',
      '- Nachrichten, Notizen, InMails oder Follow-ups schreiben.',
      '- Dich anmelden, Passwörter eingeben, Sicherheitsabfragen oder CAPTCHAs lösen, Limits umgehen, Einladungen zurückziehen.',
      '- Personen vernetzen, die „Prüfen“ nicht freigegeben hat, oder Angaben erfinden.',
      '- Verlangt LinkedIn beim Vernetzen die E-Mail-Adresse der Person: nicht senden, „Senden fehlgeschlagen“ mit diesem Grund.',
      '- Bei Warnung, Einladungslimit oder Einschränkung: im CRM „LinkedIn-Einschränkung melden“ mit dem Wortlaut, dann beenden.',
    ].join('\n'),
    [
      '## Ende',
      'Höre auf, wenn das CRM den Lauf beendet (Ziel erreicht), eine Stopp-Regel greift oder du über die Ausgangspunkte keine passenden Personen mehr findest. Antworte zum Schluss mit einem kurzen Absatz: erste Zeile „Fertig: X gesendet, Y geprüft“ oder „Abbruch: <Grund>“, danach in ein bis drei Sätzen, was nicht geklappt hat. Dieser Text erscheint im CRM.',
    ].join('\n'),
  ].join('\n\n')
}

export const KATEGORIEN: readonly { key: 'A' | 'B' | 'C' | 'bedingt'; label: string }[] = [
  { key: 'A', label: 'A · Führung' },
  { key: 'B', label: 'B · Projekt/Vertrieb/Technik' },
  { key: 'C', label: 'C · Kundenbetreuung' },
  { key: 'bedingt', label: 'bedingt' },
]

export const ERGEBNIS_LABEL: Record<string, string> = {
  gesendet: 'Gesendet',
  dublette: 'Dublette',
  nicht_qualifiziert: 'Nicht qualifiziert',
  unklar: 'Unklar',
  fehler: 'Senden fehlgeschlagen',
}

export const STATUS_LABEL: Record<string, string> = {
  laeuft: 'Recherche läuft',
  pausiert: 'Pausiert',
  abgeschlossen: 'Abgeschlossen',
  abgebrochen: 'Abgebrochen',
  fehler: 'Fehler / Einschränkung',
}

/** Kontrollpunkt fällig? (Server erzwingt dasselbe in recherche_eintragen) */
export const kontrolleFaellig = (l: { geprueft: number; kontrollen: number }): boolean =>
  l.geprueft >= (l.kontrollen + 1) * 10
