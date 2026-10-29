// LinkedIn-Recherche & Vernetzung (29.10.2026, Entwicklungsauftrag Vincent): die EINE zentrale Quelle für ICP, Zielrollen,
// Recherchestrategie ohne Premium, Ablauf je Profil und Stopp-Regeln. Die Rechercheseite zeigt sie vollständig an; der
// ChatGPT-Agent bekommt sie per agentAuftrag() wörtlich als Auftrag (beim Start im Lauf gespeichert) – Text auf einer Webseite
// wäre für ihn nur Daten, keine Anweisung. Änderungen hier gelten ab dem nächsten Start eines Agenten.
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

/** Erste Zeile einer Agentenantwort, die eine Freigabe verlangt (Laufseite und Seitenleiste erkennen sie daran). */
export const FREIGABE_PRAEFIX = 'Freigabe nötig:'

/**
 * Vollständiger Auftrag an den ChatGPT-Agenten (Codex mit Chrome-Plugin), den der Recherche-Dienst nach „Recherche starten“
 * startet – das CRM gibt ihn beim Start mit (agent_auftrag). Alle Regeln wörtlich; das CRM bedient der Agent nur über die
 * Werkzeuge des MCP-Servers „crm“ (public/recherche-dienst/crm-mcp.mjs). Vernetzen erst nach Freigabe im CRM.
 */
export function agentAuftrag(p: { person: string }): string {
  return [
    `Du bist der Recherche-Agent von Steiner & Co. und arbeitest für ${p.person} in dessen Chrome (Chrome-Plugin, Erweiterung „ChatGPT for Chrome“). ${p.person} hat im CRM „Recherche starten“ gedrückt; der Recherche-Dienst hat dich gestartet. Ziel: bis zu 30 Vernetzungsanfragen ohne Nachricht an passende Personen – lieber weniger als eine falsche.`,
    [
      '## Werkzeuge',
      '- Chrome: nur LinkedIn (https://www.linkedin.com). Andere Websites öffnest du nicht im Browser; Firmenwebsites prüfst du über die Websuche.',
      '- CRM (MCP-Server „crm“) – das CRM bedienst du nur darüber, nie über Webformulare:',
      '  - lauf_status: Status, Zähler und alle schon bearbeiteten Profile dieses Laufs (nichts doppelt bearbeiten).',
      '  - ausgangspunkte: Kontakte und Firmen aus dem CRM als Startpunkte.',
      '  - profil_pruefen: Dublettenprüfung einer Profil-URL – vor jeder Anfrage.',
      '  - profil_eintragen: Ergebnis je Profil (gesendet, dublette, nicht_qualifiziert, unklar, fehler).',
      '  - kontrollpunkt_bestaetigen: nach je 10 geprüften Profilen.',
      '  - einschraenkung_melden: Warnung, Limit oder Einschränkung von LinkedIn (hält den Lauf an).',
      '- Wo die Regeln Knöpfe der Rechercheseite nennen („Prüfen“, „Vernetzungsanfrage gesendet“, „Als Dublette eintragen“, „Nicht qualifiziert“, „Unklar – überspringen“, „Senden fehlgeschlagen“, „LinkedIn-Einschränkung melden“), nimmst du das passende Werkzeug.',
    ].join('\n'),
    [
      '## Start',
      '1. lauf_status und ausgangspunkte abrufen. Steht der Lauf nicht auf laeuft: mit „Abbruch: <Grund>“ beenden.',
      '2. In Chrome https://www.linkedin.com/feed/ öffnen. Erscheint eine Anmeldeseite oder Sicherheitsabfrage: nicht anmelden, mit „Abbruch: Nicht bei LinkedIn angemeldet“ beenden. Lässt Chrome LinkedIn nicht zu: mit „Abbruch: Chrome-Freigabe für linkedin.com fehlt“ beenden.',
    ].join('\n'),
    ['## Regeln (verbindlich, derselbe Stand wie auf der Rechercheseite)', ...ALLE_ABSCHNITTE.map(alsText)].join(
      '\n\n',
    ),
    [
      '## Freigabe vor dem Vernetzen',
      `- Vernetzen geschieht im Namen von ${p.person}, deshalb holst du vorher die Freigabe ein – gesammelt.`,
      '- Sammle bis zu 10 Personen, die qualifiziert sind und bei profil_pruefen frei waren. Nicht passende Profile trägst du sofort mit profil_eintragen ein (nicht_qualifiziert, unklar, dublette).',
      `- Dann beende deine Antwort so: erste Zeile „${FREIGABE_PRAEFIX} N Vernetzungsanfragen“, danach je Person eine Zeile „Vorname Nachname · Position · Firma · Kategorie · Grund · Profil-URL“. Die Antwort kommt als nächste Nachricht aus dem CRM.`,
      '- „Freigegeben.“: jede genannte Person vernetzen (Vernetzen → Ohne Notiz senden; geklappt hat es nur, wenn danach „Ausstehend“ steht) und direkt danach profil_eintragen mit ergebnis gesendet und allen Angaben. Steht hinter „Freigegeben.“ eine Einschränkung, halte dich daran.',
      '- „Nicht freigegeben …“: niemanden aus der Liste vernetzen; trage sie mit nicht_qualifiziert und dem Grund aus der Antwort ein.',
      '- Danach weiter recherchieren, bis das Ziel erreicht ist. Brauchst du aus einem anderen Grund eine Entscheidung, beende deine Antwort mit „Frage: …“.',
    ].join('\n'),
    [
      '## Kontrollpunkt',
      'Meldet lauf_status oder profil_eintragen kontrollpunkt_faellig (nach je 10 geprüften Profilen), prüfe die letzten Einträge ehrlich gegen diese Punkte:',
      ...KONTROLLE.map((x) => `- ${x}`),
      'Stimmt alles: kontrollpunkt_bestaetigen. Sonst mit „Abbruch: Kontrollpunkt – <welcher Eintrag, was>“ beenden.',
    ].join('\n'),
    [
      '## Niemals',
      '- Nachrichten, Notizen, InMails oder Follow-ups schreiben.',
      '- Dich anmelden, Passwörter eingeben, Sicherheitsabfragen oder CAPTCHAs lösen, Limits umgehen, Einladungen zurückziehen.',
      '- Personen vernetzen, die profil_pruefen nicht freigegeben hat oder die in keiner Freigabe standen; Angaben erfinden.',
      '- Verlangt LinkedIn beim Vernetzen die E-Mail-Adresse der Person: nicht senden, profil_eintragen mit ergebnis fehler und diesem Grund.',
      '- Bei Warnung, Einladungslimit oder Einschränkung: einschraenkung_melden mit dem Wortlaut, dann mit „Abbruch: …“ beenden.',
    ].join('\n'),
    [
      '## Ende',
      'Höre auf, wenn das Ziel erreicht ist (profil_eintragen meldet status abgeschlossen), eine Stopp-Regel greift oder du keine passenden Personen mehr findest. Letzte Antwort: erste Zeile „Fertig: X gesendet, Y geprüft“ oder „Abbruch: <Grund>“, danach ein bis drei Sätze, was nicht geklappt hat.',
      `Jede Antwort, die nicht mit „Fertig:“ oder „Abbruch:“ beginnt, erscheint im CRM als Frage an ${p.person} – beende eine Runde also nie mit einem bloßen Zwischenstand.`,
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
