// Handbuch-Inhalt als Daten (durchsuchbar, eine Quelle für Seite und Suche). Geschrieben aus dem tatsächlichen Verhalten des
// Codes (Stand 15.10.2026, v1 + LinkedIn-Brücke: supabase/functions/linkedin-eingang, tools/apps-script/ANLEITUNG.md,
// extension/README.md, Einstellungen → Verbindungen) – nichts versprechen, was nicht gebaut ist; Geplantes trägt {{geplant}}.
// Auszeichnung: {Taste} · {G H} · **betont** · [Link](/pfad) · {{geplant}} (markup.ts, Inline.tsx).
import { PFADE } from '@/app/pfade'
import type { PersonId } from '@/features/auth/personen'
import type { TourKey } from './ereignis'
import { klartext } from './markup'

export type Block =
  | { art: 'absatz'; text: string }
  | { art: 'zwischentitel'; text: string }
  | { art: 'liste'; punkte: readonly string[] }
  | { art: 'schritte'; punkte: readonly string[] }
  | { art: 'tasten'; zeilen: readonly { tasten: readonly string[]; text: string }[] }
  | { art: 'hinweis'; text: string; geplant?: boolean }
  /** Alle Tastenkürzel aus der Registry (src/app/tasten.ts) */
  | { art: 'tastenregister' }

export type Thema = {
  key: string
  titel: string
  /** Ein Satz unter dem Titel (Voice-Zeile) und in der Themenliste */
  kurz: string
  /** Zusätzliche Suchwörter, die im Text nicht vorkommen */
  stichworte?: string
  tour?: TourKey
  /** Abweichende Mini-Tour für Mike (Dein Tag → Telefon statt LinkedIn) */
  tourMike?: TourKey
  bloecke: readonly Block[] | ((person: PersonId | null) => readonly Block[])
}

const VINCENT_TAG: readonly Block[] = [
  { art: 'zwischentitel', text: 'Vincent · morgens: neue Anfragen' },
  {
    art: 'schritte',
    punkte: [
      'ChatGPT-Liste kopieren, in Heute auf „Liste einfügen“ klicken ({⌘⇧O}) und einfügen. Das CRM erkennt Namen, Unternehmen und LinkedIn-Links, prüft Dubletten und will je Zeile eine Anrede ({H} Herr, {F} Frau). {⌘↵} übernimmt.',
      'Sektion „Neue Anfragen“: {O} öffnet das Profil in einem neuen Tab. Dort „Vernetzen“ klicken, zurück im CRM {E} – Anfrage gesendet. {⇧E} heißt „mit Notiz gesendet“, {X} „passt nicht“.',
      'Die Kanalzeile oben zeigt „Anfragen heute“, „Woche“ und „Heute noch möglich“. Ab 90 % des Wochenbudgets warnt das CRM – es blockiert nie.',
    ],
  },
  { art: 'zwischentitel', text: 'Vincent · mittags: Annahmen und Opener' },
  {
    art: 'schritte',
    punkte: [
      'Ist dein Gmail unter [Verbindungen](/einstellungen/verbindungen) angeschlossen, hat das CRM die meisten Annahmen schon aus den LinkedIn-Mails verbucht – diese Leads stehen direkt in „Opener senden“.',
      'Den Rest prüfst du in „Annahme prüfen“, daneben deine LinkedIn-Kontakte. Wer angenommen hat: {E} oder {Space}. Das CRM setzt die Phase auf „Vernetzt“, startet die Sequenz und legt den Opener für heute an. War die Annahme gestern, wählst du das Datum mit {D}.',
      'In „Opener senden“ steht der fertige Text: {C} kopiert, in LinkedIn einfügen und senden, zurück im CRM {E}.',
    ],
  },
  { art: 'zwischentitel', text: 'Vincent · zwischendurch: Follow-ups' },
  {
    art: 'absatz',
    text: '„Überfällig“ und „Heute fällig“ enthalten die Follow-ups aus den Sequenzen, jede Karte mit dem passenden Leitfaden-Text. Kopieren, senden, {E} – der nächste Schritt wird automatisch terminiert. Mit den Batch-Chips ({⌥1}–{⌥9}) arbeitest du gleiche Schritte am Stück ab.',
  },
  { art: 'zwischentitel', text: 'Vincent · abends: Antworten' },
  {
    art: 'schritte',
    punkte: [
      'Antworten, für die LinkedIn dir eine Mail geschickt hat, stehen mit angeschlossenem Gmail schon in „Antworten“ – mit Nachrichtentext, die Sequenz ist gestoppt.',
      'Was du live in LinkedIn gelesen hast, meldet LinkedIn oft nicht per Mail: Lead mit {⌘K} suchen und {A} drücken – oder in der Seitenleiste der Chrome-Erweiterung die Unterhaltung öffnen, dort steht die letzte Nachricht schon drin. Reaktion wählen ({1}–{9}), Zitat optional.',
      'Der Lead steht in „Antworten“ mit einem passenden Antwort-Leitfaden. Antworten und {E} – oder {P}, wenn du gepitcht hast, {T} für einen Termin.',
    ],
  },
]

const MIKE_TAG: readonly Block[] = [
  { art: 'zwischentitel', text: 'Mike · Call-Block' },
  {
    art: 'schritte',
    punkte: [
      '[Telefon](/telefon) öffnen ({G T}). Oben stehen fällige Rückrufe, darunter die Anrufliste: Wiederholungen vor frischen Leads.',
      '„Call-Block starten“ ({↵}) öffnet den ersten Lead im Anruf-Screen: links Kontext und Anrufgrund, in der Mitte Nummer, „Timer starten“ und Notiz, rechts das Skript. Gewählt wird am eigenen Telefon.',
      'Nach dem Gespräch ein Ergebnis wählen – Pflicht, eine Taste je Ergebnis. Das CRM plant den nächsten Versuch, den Rückruf oder die Wiedervorlage selbst.',
      '{↵} lädt den nächsten Lead. „Block beenden“ zeigt die Bilanz: Anrufe, erreicht, Entscheider, Termine.',
    ],
  },
  { art: 'zwischentitel', text: 'Mike · LinkedIn' },
  {
    art: 'absatz',
    text: 'Deine LinkedIn-Follow-ups und Antworten stehen genauso in Heute wie bei Vincent – gleicher Ablauf: kopieren, in LinkedIn senden, {E}. Antworten trägst du mit {A} ein.',
  },
]

const BEIDE_TAG: readonly Block[] = [
  { art: 'zwischentitel', text: 'Beide · freitags' },
  {
    art: 'absatz',
    text: 'Freitags erscheint in Heute die Sektion „Zurückziehen“: Anfragen, die länger als 21 Tage offen sind. In LinkedIn zurückziehen, im CRM mit {E} abhaken. Danach gemeinsam auf [KPIs](/kpis) und [Team](/team) schauen.',
  },
  {
    art: 'absatz',
    text: 'Einmal pro Woche ein Voll-Backup unter [Einstellungen → Export & Backup](/einstellungen/export) – Heute erinnert dich, wenn das letzte länger als 7 Tage her ist.',
  },
]

export const THEMEN: readonly Thema[] = [
  {
    key: 'erste-schritte',
    titel: 'Erste Schritte',
    kurz: 'Was das CRM ist, wie du dich bewegst und wo du anfängst.',
    stichworte: 'start anfang einführung tour navigation palette',
    tour: 'onboarding',
    bloecke: [
      {
        art: 'absatz',
        text: 'Das CRM ersetzt die drei Google Sheets. Es zeigt dir jeden Tag, was dran ist, bereitet die Texte vor und zählt mit. **Senden tust du selbst** – in LinkedIn, am Telefon oder in Gmail.',
      },
      { art: 'zwischentitel', text: 'So bewegst du dich' },
      {
        art: 'liste',
        punkte: [
          '**Heute** ist dein Startscreen. Dort steht alles, was jetzt zu tun ist – sonst nichts.',
          'Links die Navigation. Jede Seite erreichst du auch mit zwei Tasten, zum Beispiel {G H} für Heute, {G L} für Leads, {G S} für diese Hilfe.',
          '{⌘K} öffnet die Palette: Leads suchen, Seiten öffnen, Aktionen ausführen. Mit {@} vorneweg suchst du nur Leads, mit {#} nur Leitfäden, mit {>} nur Aktionen.',
          '{?} zeigt alle Tastenkürzel. Am iPhone gibt es statt Tasten die Leiste unten, Pipeline, E-Mail, Leitfäden, Team und Hilfe liegen dort unter „Mehr“.',
          'Fast alles ist sofort gespeichert und lässt sich 6 Sekunden lang mit {Z} rückgängig machen. Nachgefragt wird nur bei Dingen, die sich nicht zurücknehmen lassen.',
        ],
      },
      { art: 'zwischentitel', text: 'Zu zweit' },
      {
        art: 'absatz',
        text: 'Ihr seht beide alle Leads. „Zuständig“ ist ein Feld, keine Sperre. Was die andere Person ändert, erscheint bei dir live – „live“ unten in der Seitenleiste zeigt, dass die Verbindung steht.',
      },
      { art: 'zwischentitel', text: 'In fünf Minuten startklar' },
      {
        art: 'schritte',
        punkte: [
          'Die Einführungstour machen – eine Minute, Knopf „Tour erneut starten“ oben rechts.',
          '[Einstellungen → Profil](/einstellungen/profil): Kürzel, LinkedIn-Plan, Rufnummer und Signatur prüfen.',
          '[Einstellungen → Ziele](/einstellungen/ziele): Tagesziel und Wochenbudget für Vernetzungsanfragen.',
          '[Einstellungen → Verbindungen](/einstellungen/verbindungen): LinkedIn-Mails aus Gmail und die Chrome-Erweiterung anschließen – dann kommen Annahmen und Antworten von selbst ins CRM (etwa zehn Minuten, siehe [Verbindungen einrichten](/hilfe/verbindungen)).',
          '[Heute](/heute) öffnen und die erste Karte abarbeiten.',
          'Wenn etwas hakt: {⌥F} drücken und es direkt melden.',
        ],
      },
    ],
  },
  {
    key: 'dein-tag',
    titel: 'Dein Tag',
    kurz: 'Die Tagesroutinen – LinkedIn für Vincent, Telefon für Mike.',
    stichworte: 'routine morgens mittags abends ablauf tagesablauf call-block',
    tour: 'linkedin',
    tourMike: 'telefon',
    bloecke: (person) => [
      {
        art: 'absatz',
        text: 'Beide arbeiten aus [Heute](/heute). Die Routinen unten sind Vorschläge aus den alten Sheets – das CRM erzwingt keine Reihenfolge.',
      },
      ...(person === 'mike' ? [...MIKE_TAG, ...VINCENT_TAG] : [...VINCENT_TAG, ...MIKE_TAG]),
      ...BEIDE_TAG,
    ],
  },
  {
    key: 'heute',
    titel: 'Heute',
    kurz: 'Deine Queue: Sektionen, Karten, Tasten.',
    stichworte: 'queue karte sektion batch zähler später erledigt vertretung',
    tour: 'heute',
    bloecke: [
      {
        art: 'absatz',
        text: 'Heute zeigt nur, was jetzt dran ist – für dich. Leere Sektionen sind ausgeblendet, die Reihenfolge ist fest:',
      },
      {
        art: 'liste',
        punkte: [
          '**Rückrufe** – zugesagte Rückrufe mit Uhrzeit.',
          '**Antworten** – Leads, die geantwortet haben und auf dich warten.',
          '**Überfällig** – Schritte, deren Termin vorbei ist (orange).',
          '**Heute fällig** – Schritte für heute (blau).',
          '**Annahme prüfen** – offene Vernetzungsanfragen der letzten 7 Tage zum Abhaken.',
          '**Opener senden** – frisch Vernetzte, die erste Nachricht ist fertig.',
          '**Neue Anfragen** – deine Tagesliste aus dem Schnellimport.',
          '**Zurückziehen** – nur freitags: Anfragen, die zu lange offen sind.',
          '**Später** – was in den nächsten 7 Tagen kommt.',
        ],
      },
      { art: 'zwischentitel', text: 'Eine Karte, eine Handlung' },
      {
        art: 'absatz',
        text: 'Nur die Karte unter dem Cursor ist aufgeklappt, {J} und {K} wechseln. Die Tasten wirken immer auf diese Karte:',
      },
      {
        art: 'tasten',
        zeilen: [
          { tasten: ['C', '↵'], text: 'Text kopieren' },
          { tasten: ['E'], text: 'Gesendet bzw. erledigt – der nächste Schritt wird geplant' },
          { tasten: ['⌘↵'], text: 'Kopieren und gesendet in einem' },
          { tasten: ['S'], text: 'Später: 1 morgen · 2 +3 Tage · 3 Montag · 4 +1 Woche · 5 +2 Monate · D Datum' },
          { tasten: ['A'], text: 'Antwort erhalten' },
          { tasten: ['N'], text: 'Notiz' },
          { tasten: ['B'], text: 'Beenden mit Grund' },
          { tasten: ['O'], text: 'LinkedIn-Profil öffnen' },
          { tasten: ['Z'], text: 'Rückgängig (6 Sekunden)' },
        ],
      },
      { art: 'zwischentitel', text: 'Oben und rechts' },
      {
        art: 'liste',
        punkte: [
          '**Kanalzeile**: Anfragen heute, Woche, Annahmequote und „Heute noch möglich“. Die Knöpfe +1, +5, +10 zählen Anfragen, die du ohne Liste verschickt hast ({+} und {⇧+} gehen auch).',
          '**Batch-Chips** filtern auf einen Sequenzschritt, damit du gleiche Follow-ups am Stück schickst ({⌥1}–{⌥9}, {⌥0} zeigt wieder alle).',
          '**Tageszähler** rechts: Vernetzungen heute gegen dein Tagesziel. Anfragen aus „Neue Anfragen“ zählen automatisch.',
          'Oben rechts schaltest du auf **das Heute der anderen Person** um – zum Vertreten. Ein Hinweis zeigt, wessen Queue du siehst; Aktionen gehen dort ganz normal.',
        ],
      },
    ],
  },
  {
    key: 'leads',
    titel: 'Leads & Pipeline',
    kurz: 'Alle Kontakte als Tabelle und als Kanban – suchen, filtern, bearbeiten.',
    stichworte: 'tabelle kanban filter ansicht peek bulk papierkorb phase übergeben freigeben übernehmen',
    tour: 'leads',
    bloecke: [
      { art: 'zwischentitel', text: 'Leads' },
      {
        art: 'liste',
        punkte: [
          '{/} springt in die Suche.',
          'Ansichten wie „Fällig“, „Antwort offen“, „Termine“, „Wiedervorlage“ oder „Freigegeben“ sind fertige Filter. Filter stehen in der Adresse – eine Ansicht kannst du als Link schicken.',
          '{↵} öffnet den Lead im Peek rechts, {⌘↵} die Vollansicht mit Timeline, Notizen, Gesprächen und Rechtlichem.',
          'Phase, Nächste Aktion, Notiz, Zuständig, Unternehmen und Rolle bearbeitest du direkt in der Zelle: {E} oder Doppelklick, {Tab} springt zur nächsten.',
          'Mehrere Leads: {Space} wählt aus, {⇧↓} einen Bereich, {⌥B} öffnet das Bulk-Menü (Zuständig, Übergeben, Phase, Wiedervorlage, Sequenz, Tag, Export, Papierkorb …).',
          '{⌥N} legt einen Lead an; Dubletten erkennt das CRM schon beim Tippen.',
          'Gelöschtes landet im [Papierkorb](/leads/papierkorb) und lässt sich wiederherstellen.',
        ],
      },
      { art: 'zwischentitel', text: 'Pipeline' },
      {
        art: 'liste',
        punkte: [
          'Zehn Phasen als Spalten: Angefragt · Vernetzt · Eröffnet · Beantwortet · Gepitcht · Erstgespräch · Strategiegespräch · Kunde · Wiedervorlage · Beendet.',
          'Karte ziehen ändert die Phase. Wo eine Angabe nötig ist (Termin, Grund, Datum), fragt das CRM nach.',
          'Angefragt, Wiedervorlage und Beendet sind eingeklappt; ein Klick auf den Spaltenkopf klappt sie auf.',
          'Tastatur: {J}/{K} Karte, {H}/{L} Spalte, {⇧→}/{⇧←} eine Phase weiter oder zurück, {↵} Peek.',
        ],
      },
      { art: 'zwischentitel', text: 'Zuständig, Übergeben, Freigeben' },
      {
        art: 'absatz',
        text: 'Jeder Lead hat eine zuständige Person. **Übergeben** ({⌘⇧U}) gibt ihn mit Notiz an die andere Person, **Freigeben** ({⌘⇧F}) legt ihn mit Grund in den Pool „Frei“, **Übernehmen** ({Ü}) holt ihn zu dir. Die Timeline zeigt immer, wer was getan hat.',
      },
    ],
  },
  {
    key: 'linkedin',
    titel: 'LinkedIn: was automatisch geht',
    kurz: 'Annahmen und neue Nachrichten erkennt das CRM aus deinen LinkedIn-Mails, die Chrome-Erweiterung bucht mit einem Klick – senden tust du weiter selbst in LinkedIn.',
    stichworte:
      'synchronisieren sync automatisch nachrichten api posteingang doppelt pflegen annahme antwort mail benachrichtigung erweiterung seitenleiste chrome',
    tour: 'linkedin',
    bloecke: [
      {
        art: 'absatz',
        text: 'LinkedIn hat keine offene Schnittstelle für Nachrichten und verbietet Bots. Deshalb berührt das CRM LinkedIn nie: Es sendet nichts, klickt nichts und liest keine LinkedIn-Seiten im Hintergrund – es synchronisiert sich nicht mit LinkedIn. Zwei Brücken nehmen dir trotzdem das Abtippen ab: die LinkedIn-Mails in deinem Gmail und die Chrome-Erweiterung.',
      },
      { art: 'zwischentitel', text: 'Automatisch: LinkedIn-Mails aus deinem Gmail' },
      {
        art: 'absatz',
        text: 'LinkedIn schickt dir für angenommene Einladungen und neue Nachrichten eine Benachrichtigungs-Mail. Ein kleines Google-Script in **deinem eigenen** Gmail schickt alle 5 Minuten **nur diese LinkedIn-Mails** ans CRM. Daraus trägt das CRM von selbst ein:',
      },
      {
        art: 'liste',
        punkte: [
          '**Einladung angenommen** → Phase „Vernetzt“, die LinkedIn-Sequenz startet, der Opener steht in Heute – wie {E} in „Annahme prüfen“.',
          '**Neue Nachricht** → „Antwort erhalten“ mit dem Nachrichtentext, laufende Sequenzen stoppen, der Lead steht in Heute unter „Antworten“. Die Reaktion (Interesse, Rückfrage, Nein …) wählst du selbst.',
          'Lässt sich eine Mail keinem Lead sicher zuordnen, landet sie im **Eingang** unter [Einstellungen → Verbindungen](/einstellungen/verbindungen?tab=eingang). Lead suchen, „Zuordnen“ – dann ist sie verbucht. Dort stehen auch Einladungen, die dir ein Lead geschickt hat; annehmen tust du sie in LinkedIn.',
          'Was du schon mit einer Taste erfasst hast, bucht das CRM nicht noch einmal.',
        ],
      },
      {
        art: 'hinweis',
        text: '**Grenze:** LinkedIn schickt eine Nachrichten-Mail meist nur, wenn du die Nachricht nicht schon in LinkedIn gelesen hast. Antworten, die du live liest, trägst du weiter selbst ein – mit {A} oder in der Seitenleiste der Erweiterung.',
      },
      {
        art: 'absatz',
        text: 'Einrichten: einmal je Person, etwa zehn Minuten – [Verbindungen einrichten](/hilfe/verbindungen). Das Script liest nur Mails von linkedin.com und sendet oder löscht nichts.',
      },
      { art: 'zwischentitel', text: 'Mit einem Klick: die Chrome-Erweiterung' },
      {
        art: 'absatz',
        text: 'Die Erweiterung öffnet neben LinkedIn eine Seitenleiste ({⌥C}). Auf einem Profil oder in einer Unterhaltung zeigt sie, wer die Person im CRM ist – Phase, Zuständig, laufende Sequenz – und die nächste Nachricht mit gefüllten Platzhaltern.',
      },
      {
        art: 'liste',
        punkte: [
          '**Kopieren** ({C}), in LinkedIn einfügen und senden, dann **Gesendet** ({E}) – der nächste Schritt ist geplant, 6 Sekunden lang mit {Z} rückgängig.',
          '**Angenommen** und **Anfrage gesendet** bestätigst du direkt vom Profil aus.',
          '**Antwort erhalten** ({A}): In einer Unterhaltung steht die letzte Nachricht der anderen Person schon drin, du wählst nur die Reaktion. Kam die Antwort bereits über die Mail, heißt der Knopf „Reaktion nachtragen“ – es entsteht keine zweite Antwort. Genauso hier im CRM: {A} trägt dann nur die Reaktion an dieser Antwort nach.',
          'Nicht im CRM: **Als Lead anlegen** mit vorbefülltem Formular, auf Wunsch mit „Vernetzungsanfrage gerade gesendet“ – oder ein ähnlicher Name wird mit dem Profil verknüpft.',
        ],
      },
      {
        art: 'absatz',
        text: 'Die Erweiterung klickt, tippt und sendet nie in LinkedIn. Sie liest nur die Seite, die du gerade ansiehst, und nur, solange die Seitenleiste offen ist.',
      },
      { art: 'zwischentitel', text: 'Bleibt bei dir' },
      {
        art: 'tasten',
        zeilen: [
          { tasten: ['O'], text: 'Profil in LinkedIn öffnen (neuer Tab)' },
          { tasten: ['C'], text: 'Text kopieren, in LinkedIn einfügen und senden – senden tust immer du' },
          { tasten: ['E'], text: 'Bestätigen: Anfrage gesendet · Nachricht gesendet · Annahme ohne Mail' },
          { tasten: ['A'], text: 'Antwort ohne Mail erfassen und die Reaktion wählen' },
          { tasten: ['X'], text: 'Abgelehnt bzw. passt nicht' },
        ],
      },
      {
        art: 'absatz',
        text: 'Dazu: alte Anfragen zurückziehen (freitags in Heute) und Einladungen von Leads in LinkedIn annehmen.',
      },
      { art: 'zwischentitel', text: 'Das rechnet das CRM ohnehin' },
      {
        art: 'liste',
        punkte: [
          'Füllt jeden Text aus dem passenden Leitfaden mit Anrede, Name und Unternehmen.',
          'Plant jedes Follow-up: Nach jedem bestätigten Schritt rechnet es den nächsten Termin aus; Wochenenden und Hamburger Feiertage werden übersprungen.',
          'Stoppt die Sequenz sofort bei einer Antwort, einem Termin oder „Beenden“.',
          'Zählt alles mit – Anfragen, Annahmen, eröffnete Gespräche, Antworten, Pitches. Daraus entstehen die KPIs, ohne dass du etwas tippst.',
          'Warnt bei 90 % deines Wochenbudgets für Vernetzungsanfragen.',
        ],
      },
      {
        art: 'hinweis',
        geplant: true,
        text: 'Annahmen aus dem LinkedIn-Datenexport (Connections.csv) importieren, statt sie abzuhaken.',
      },
    ],
  },
  {
    key: 'verbindungen',
    titel: 'Verbindungen einrichten',
    // „Gmail“ bewusst nicht im Kurztext/Stichworten: ↵ bei „gmail“ öffnet weiter das Thema E-Mail, das hierher verlinkt
    kurz: 'Die LinkedIn-Mails aus deinem Postfach und die Chrome-Erweiterung anschließen – einmal je Person, etwa zehn Minuten.',
    stichworte:
      'verbinden anschließen apps script google schlüssel token eingang zuordnen erweiterung chrome seitenleiste installieren einrichten benachrichtigung',
    bloecke: [
      {
        art: 'absatz',
        text: 'Alles Nötige steht unter [Einstellungen → Verbindungen](/einstellungen/verbindungen): das Script zum Kopieren, dein Eingangs-Schlüssel, der Stand („zuletzt gemeldet“) und der Eingang. Jede Person richtet ihr eigenes Gmail mit ihrem eigenen Schlüssel ein; verbucht wird in ihrem Namen.',
      },
      { art: 'zwischentitel', text: 'LinkedIn-Mails aus Gmail' },
      {
        art: 'schritte',
        punkte: [
          'Unter Verbindungen dein eigenes LinkedIn-Profil eintragen (linkedin.com/in/…) – so hält das CRM dich nie für einen Lead.',
          '„Script kopieren“, auf script.google.com mit dem Google-Konto, in dem deine LinkedIn-Mails ankommen, ein neues Projekt anlegen, den Code einfügen und speichern.',
          '„Schlüssel erzeugen“ – er ist nur einmal sichtbar und liegt gleich in der Zwischenablage. Im Script unter Projekteinstellungen → Skripteigenschaften als „CRM_SCHLUESSEL“ eintragen, nicht in den Code.',
          'Im Editor die Funktion „einrichten“ wählen, „Ausführen“ und Google die Berechtigungen erlauben. Ab jetzt läuft das Script alle 5 Minuten; beim ersten Mal holt es die LinkedIn-Mails der letzten 3 Tage.',
          'Prüfen: In Gmail erscheint das Label „CRM/erfasst“, unter Verbindungen steht, wann dein Script zuletzt gemeldet hat.',
        ],
      },
      {
        art: 'absatz',
        text: 'In LinkedIn müssen die E-Mail-Benachrichtigungen für Nachrichten und angenommene Einladungen eingeschaltet sein (Einstellungen → Mitteilungen).',
      },
      { art: 'zwischentitel', text: 'Eingang' },
      {
        art: 'absatz',
        text: 'Was das CRM nicht sicher zuordnen kann – etwa eine Mail ohne Profil-Link bei einem Namen, den es zweimal gibt –, landet im Tab [Eingang](/einstellungen/verbindungen?tab=eingang). Lead suchen und „Zuordnen“ oder „Ignorieren“. Lieber einmal zuordnen, als einer falschen Person Opener-Aufgaben anzulegen.',
      },
      { art: 'zwischentitel', text: 'Chrome-Erweiterung' },
      {
        art: 'schritte',
        punkte: [
          'Den Ordner der Erweiterung bekommen – wie, steht unter Verbindungen (Mike bekommt eine ZIP und entpackt sie an einen festen Ort).',
          'In Chrome chrome://extensions öffnen und oben rechts den „Entwicklermodus“ einschalten.',
          '„Entpackte Erweiterung laden“, den Ordner wählen und die Erweiterung über das Puzzle-Symbol anheften.',
          'Auf das S&-Symbol klicken, Vincent oder Mike wählen – derselbe Passcode wie im CRM.',
          '{⌥C} öffnet die Seitenleiste neben LinkedIn.',
        ],
      },
      { art: 'zwischentitel', text: 'Anhalten und Datenschutz' },
      {
        art: 'liste',
        punkte: [
          'Schlüssel unter Verbindungen widerrufen – das Script kann danach nichts mehr übertragen. Oder im Script die Funktion „stoppen“ ausführen.',
          'Übertragen werden nur Mails von linkedin.com. Gespeichert werden höchstens 2000 Zeichen Nachrichtentext je Annahme oder Nachricht, nie die ganze Mail; Werbung und Job-Mails löscht das CRM nach 30 Tagen.',
          'Der Schlüssel liegt nur in deinen Skripteigenschaften, das CRM kennt nur einen nicht umkehrbaren Abdruck.',
        ],
      },
    ],
  },
  {
    key: 'telefon',
    titel: 'Telefon',
    kurz: 'Anrufliste, Call-Block, Anruf-Screen – und wofür der Anrufgrund gut ist.',
    stichworte: 'anrufen call-block rückruf ergebnis skript anrufgrund uwg mailbox',
    tour: 'telefon',
    bloecke: [
      {
        art: 'absatz',
        text: 'In der Anrufliste steht jeder mit Telefonnummer, der nicht gesperrt ist – auch ohne Vorgeschichte (Cold Calling). Gibt es einen konkreten Anlass, halte ihn als **Anrufgrund** fest: Bei Geschäftsanrufen verlangt § 7 UWG eine zumindest mutmaßliche Einwilligung, und der notierte Grund ist später dein Beleg. Wer keine Nummer hat oder gesperrt ist, steht unten unter „Noch nicht anrufbar“.',
      },
      { art: 'zwischentitel', text: 'Die Liste' },
      {
        art: 'liste',
        punkte: [
          'Oben die fälligen Rückrufe, darunter die Anrufliste: Wiederholungen vor frischen Leads.',
          '{J}/{K} wählen, {↵} anrufen, {R} nimmt eine Zeile für heute heraus, {S} verschiebt.',
          '„Call-Block starten“ führt dich Lead für Lead durch die Liste und zählt mit: Anrufe, erreicht, Entscheider, Termine.',
        ],
      },
      { art: 'zwischentitel', text: 'Anruf-Screen' },
      {
        art: 'liste',
        punkte: [
          'Links der Kontext: Rolle, Unternehmen, Anrufgrund, letzte Versuche, LinkedIn-Verlauf, Notizen.',
          'Mitte: die Nummer (mit „Kopieren“) – gewählt wird am eigenen Telefon. „Timer starten“ ({↵}) misst nur die Dauer, die Notiz speichert sich selbst.',
          'Rechts das Skript in Phasen, {Tab} blättert weiter.',
          'Unten 15 Ergebnisse mit je einer Taste. Ohne Ergebnis gibt es keinen nächsten Lead.',
        ],
      },
      { art: 'zwischentitel', text: 'Was nach dem Ergebnis passiert' },
      {
        art: 'liste',
        punkte: [
          '**Nicht erreicht oder Mailbox**: nächster Versuch nach Plan, bis zu fünf Versuche in wechselnden Zeitfenstern.',
          '**Besetzt**: zählt nicht als Versuch, kommt später am Tag wieder.',
          '**Rückruf vereinbart**: Rückruf mit Uhrzeit – erscheint oben in Heute und in Telefon.',
          '**Termin vereinbart**: Phase Erstgespräch, laufende Sequenzen enden.',
          '**Kein Bedarf aktuell**: Wiedervorlage. **Kein Interesse** oder **nicht passend**: Lead wird mit Grund beendet.',
          '**Werbewiderspruch**: nach Bestätigung auf die Sperrliste – das ist endgültig.',
        ],
      },
      {
        art: 'absatz',
        text: 'Am iPhone öffnet „Anrufen“ die Telefon-App. Danach zeigt das CRM große Ergebnis-Knöpfe.',
      },
    ],
  },
  {
    key: 'email',
    titel: 'E-Mail',
    kurz: 'E-Mail ist ein Warm-Kanal: nur mit Erlaubnis-Grundlage, gesendet über Gmail.',
    stichworte: 'gmail verbinden postfach composer erlaubnis einwilligung widerspruch uwg mailto',
    tour: 'email',
    bloecke: [
      {
        art: 'absatz',
        text: 'Werbe-Mails ohne Einwilligung sind unzulässig (§ 7 UWG). Darum braucht jeder Lead eine **Erlaubnis-Grundlage** – zum Beispiel „hat im Gespräch um Infos gebeten“. Ohne sie bleibt der Composer gesperrt.',
      },
      { art: 'zwischentitel', text: 'Ablauf' },
      {
        art: 'schritte',
        punkte: [
          'Lead öffnen und {⌥M} drücken – oder unter [E-Mail](/email) einen fälligen Schritt wählen.',
          'Vorlage wählen ({⌘⇧E}) und Platzhalter füllen; {[} schlägt Platzhalter vor.',
          '„In Gmail öffnen“ ({⌘↵}) öffnet Gmail mit Empfänger, Betreff und Text. Du sendest dort.',
          'Zurück im CRM fragt es „Gesendet?“. Mit Ja ist die Mail verbucht und der nächste Schritt geplant.',
        ],
      },
      { art: 'zwischentitel', text: 'Was das CRM prüft' },
      {
        art: 'liste',
        punkte: [
          'Grundlage vorhanden und nicht widerrufen – sonst gesperrt.',
          'Grundlage älter als 12 Monate – Warnung.',
          'Höchstens drei Nachfass-Mails je Erlaubnis.',
          'Kein Treffer auf der Sperrliste, keine gesperrte Firma.',
          'Pflichtbausteine wie der Widerspruchssatz hängen automatisch an.',
        ],
      },
      { art: 'zwischentitel', text: 'Gmail verbinden?' },
      {
        art: 'absatz',
        text: 'Für Mails an Leads nicht als Postfach: Das CRM verschickt nicht selbst und liest deine Mails nicht. Es öffnet Gmail mit fertigem Entwurf (am iPhone die Mail-App) – du behältst die Kontrolle, und alles liegt in deinem normalen Gesendet-Ordner. Ist ein Text zu lang für den Gmail-Link, kopierst du ihn. Einzige Ausnahme sind die LinkedIn-Benachrichtigungen: Die schickt ein Script in deinem Gmail ans CRM – [Verbindungen einrichten](/hilfe/verbindungen).',
      },
      {
        art: 'hinweis',
        geplant: true,
        text: 'Versand direkt aus dem CRM und das Erkennen von Antworten aus Gmail – vorbereitet, aber noch nicht eingeschaltet.',
      },
      {
        art: 'absatz',
        text: '„Erlaubnis erfassen“ und „Widerspruch erfassen“ findest du in der Palette ({⌘K}), wenn ein Lead geöffnet ist.',
      },
    ],
  },
  {
    key: 'leitfaeden',
    titel: 'Leitfäden & Sequenzen',
    kurz: 'Leitfäden sind deine Textvorlagen, Sequenzen planen, wann welcher Text dran ist.',
    stichworte: 'vorlage template text platzhalter kadenz follow-up schritt',
    tour: 'leitfaeden',
    bloecke: [
      { art: 'zwischentitel', text: 'Leitfäden' },
      {
        art: 'liste',
        punkte: [
          'Links der Baum: Kanal → Phase → Leitfaden. Unter jeder Phase steht ihr Zweck.',
          'Rechts Text, „Wann verwenden?“, Anredeform und Notizen. Platzhalter wie [Vorname] oder [Unternehmen] werden für jeden Lead gefüllt; was offen bleibt, ist orange markiert und muss vor dem Kopieren gefüllt werden.',
          'Die Vorschau mit einem echten Lead zeigt den fertigen Text, {C} kopiert ihn.',
          'Statistik: wie oft gesendet, wie viele Antworten binnen 7 Tagen, Quote.',
          'Duplizieren, Deaktivieren und „Als Standard für Schritt …“ bestimmen, welche Vorlage eine Sequenz nimmt.',
        ],
      },
      { art: 'zwischentitel', text: 'Sequenzen' },
      {
        art: 'absatz',
        text: 'Eine Sequenz ist ein Plan aus Schritten mit Abständen in Tagen. Sie erzeugt Aufgaben, keine Nachrichten: Jeder Schritt erscheint als Karte in Heute.',
      },
      {
        art: 'liste',
        punkte: [
          '**LinkedIn Standard** – nach einer Annahme ohne Notiz: Opener, Kurzfristig 1–3, Langfristig 1–2.',
          '**Vernetzt ohne Antwort** – nach einer Anfrage mit Notiz: Re-Opener, dann wie Standard.',
          '**Nachfassen im Gespräch** – nachdem du auf eine Antwort reagiert hast.',
          '**Telefon Standard** – fünf Versuche in wechselnden Zeitfenstern, danach ein neuer Anlauf.',
          '**E-Mail** – Nachbereitung nach Erst- und Strategiegespräch, Infomails nach Zusage, No-Show.',
        ],
      },
      {
        art: 'absatz',
        text: 'Abstände sind Kalendertage ab dem tatsächlich erledigten Schritt; fällt ein Termin aufs Wochenende oder einen Feiertag, rutscht er auf den nächsten Werktag. Antwort, Termin, Beenden oder Widerspruch stoppen eine Sequenz sofort.',
      },
      {
        art: 'absatz',
        text: 'Abstand und Vorlage je Schritt änderst du unter [Einstellungen → Sequenzen](/einstellungen/sequenzen). Von Hand starten oder stoppen: im Lead, Kanal-Karte LinkedIn.',
      },
    ],
  },
  {
    key: 'kpis-team',
    titel: 'KPIs & Team',
    kurz: 'Zahlen, die sich selbst rechnen – und wie du siehst, was die andere Person macht.',
    stichworte: 'kennzahlen funnel performance vergleich mike vincent protokoll was macht statistik',
    tour: 'kpis',
    bloecke: [
      { art: 'zwischentitel', text: 'KPIs' },
      {
        art: 'liste',
        punkte: [
          'Oben schaltest du Person (Vincent · Mike · Team, {1} {2} {3}), Zeitraum ({←} {→}) und Kanal um.',
          '**Funnel**: Vernetzung versendet → angenommen → Gespräche eröffnet → beantwortet → gepitcht → Erstgespräche → Strategiegespräche → Kunden, mit Quoten und Vergleich zur Vorperiode. Ein Klick auf eine Zahl zeigt die Leads dahinter.',
          'Tagesverlauf, Wochentabelle, Sales-Calls, No-Shows und die Leistung jedes Leitfadens.',
          '**Ohne Bewegung**: Leads in Beantwortet oder Gepitcht, bei denen seit Tagen nichts passiert ist – {W} Wiedervorlage oder {B} Beenden direkt aus der Liste.',
          'Alles wird aus euren Aktionen gerechnet. Nur der Zähler „Vernetzungen versendet“ kann manuell ergänzt werden; Werte aus dem alten Sheet tragen den Chip „aus Sheet“.',
        ],
      },
      { art: 'zwischentitel', text: 'Team – was macht die andere Person?' },
      {
        art: 'liste',
        punkte: [
          '[Team](/team) ({G A}) stellt Vincent und Mike nebeneinander: zuletzt aktiv, was heute fällig, überfällig und erledigt ist, und dieselben Kennzahlen wie auf der KPI-Seite – für heute, die Woche oder den Monat.',
          'Darunter das **Team-Protokoll**: jede Aktion von euch beiden, neueste oben, live. Filter nach Person und Kanal; ein Klick auf den Namen öffnet den Lead.',
          'In Heute kannst du oben rechts auf das Heute der anderen Person schalten – zum Vertreten.',
        ],
      },
    ],
  },
  {
    key: 'import',
    titel: 'Import & Schnellimport',
    kurz: 'ChatGPT-Listen in Sekunden übernehmen, Dateien importieren – und 30 Tage rückgängig.',
    stichworte: 'chatgpt liste einfügen csv excel xlsx sheet dublette rückgängig',
    tour: 'import',
    bloecke: [
      { art: 'zwischentitel', text: 'Schnellimport' },
      {
        art: 'schritte',
        punkte: [
          '{⌘⇧O} oder „Liste einfügen“ in Heute.',
          'Liste einfügen ({⌘V}): Markdown-Tabelle, nummerierte Liste, Unterpunkte, CSV, JSON oder gemischt.',
          'Rechts siehst du live, was erkannt wurde: neu, Dublette, Archiv, unvollständig.',
          'Anrede je Zeile ist Pflicht: {H} Herr, {F} Frau, {–} neutral; {↑}/{↓} wechselt die Zeile.',
          'Ziel wählen: „Als Anfrageliste“ – die Leads landen in Heute unter „Neue Anfragen“ – oder „Als Leads (bereits vernetzt)“, dann startet die Sequenz sofort.',
          '{⌘↵} übernimmt.',
        ],
      },
      {
        art: 'absatz',
        text: 'Dubletten erkennt das CRM an der LinkedIn-Adresse – auch gegen Papierkorb und Archiv. Doppelt angelegt wird nichts.',
      },
      { art: 'zwischentitel', text: 'Import-Assistent' },
      {
        art: 'absatz',
        text: 'Für Dateien (CSV, Excel): Quelle, Spalten zuordnen, Prüfen – ein Probelauf, der nichts schreibt –, Fertig. Vorlagen gibt es für die CRM-Tabelle, den KPI-Monat, die DM-Leitfäden und eine allgemeine Zuordnung. Den Assistenten gibt es nur am Desktop.',
      },
      {
        art: 'absatz',
        text: 'Jeder Import hat eine Ergebnisseite und lässt sich 30 Tage lang rückgängig machen. Ausnahme: der einmalige Sheet-Import – er wird durch einen erneuten Lauf korrigiert.',
      },
      {
        art: 'hinweis',
        geplant: true,
        text: 'LinkedIn-Export (Connections.csv, Invitations.csv) als Vorlage, um Annahmen automatisch abzugleichen.',
      },
    ],
  },
  {
    key: 'tastenkuerzel',
    titel: 'Tastenkürzel',
    kurz: 'Alle Tasten auf einen Blick – dieselbe Liste wie hinter dem Fragezeichen.',
    stichworte: 'taste kürzel shortcut keyboard tastatur',
    bloecke: [
      {
        art: 'absatz',
        text: 'Einzelbuchstaben wirken nur, wenn kein Eingabefeld aktiv ist. {Esc} verlässt erst das Feld, dann den Dialog. {?} öffnet diese Liste überall.',
      },
      { art: 'tastenregister' },
    ],
  },
  {
    key: 'feedback',
    titel: 'Feedback geben',
    kurz: 'Etwas klemmt, fehlt oder sieht falsch aus – melde es direkt im CRM, samt Screenshot.',
    stichworte: 'fehler bug melden problem wunsch idee frage claude bugreport',
    tour: 'feedback',
    bloecke: [
      {
        art: 'absatz',
        text: '**Feedback geben** in der Seitenleiste (am iPhone das Sprechblasen-Symbol oben) oder {⌥F} öffnet auf jeder Seite das Feedback-Fenster. Deine Meldung geht direkt an Claude.',
      },
      {
        art: 'schritte',
        punkte: [
          'Art wählen: Fehler, Wunsch oder Frage.',
          'Beschreiben, was passiert ist und was du erwartet hast; ein Titel ist optional.',
          'Der Screenshot der Seite wird automatisch aufgenommen. Du kannst ihn entfernen oder ein eigenes Bild einfügen ({⌘V}) oder hineinziehen.',
          '{⌘↵} sendet. Seite, Fenstergröße und Browser gehen automatisch mit – so lässt sich ein Darstellungsfehler nachstellen.',
        ],
      },
      {
        art: 'absatz',
        text: 'Unter [Feedback](/feedback) ({G B}) siehst du die Meldungen von euch beiden mit Stand (neu, in Arbeit, erledigt, abgelehnt) und der Antwort von Claude. Kommt eine Antwort, meldet sich das CRM mit einem Hinweis.',
      },
      { art: 'zwischentitel', text: 'Gute Meldungen' },
      {
        art: 'liste',
        punkte: ['Eine Sache pro Meldung.', 'Was du getan hast, was passiert ist, was du erwartet hast.'],
      },
    ],
  },
  {
    key: 'noch-nicht',
    titel: 'Was das CRM (noch) nicht kann',
    kurz: 'Ehrlich aufgelistet – damit du nicht suchst, was es nicht gibt.',
    stichworte: 'grenzen fehlt geplant später roadmap automatisierung',
    bloecke: [
      { art: 'zwischentitel', text: 'Bewusst nicht' },
      {
        art: 'liste',
        punkte: [
          'Nichts in LinkedIn automatisch tun: keine Nachrichten senden, keine Anfragen verschicken, keine Profile im Hintergrund auslesen. Erkannt wird nur, was LinkedIn dir ohnehin per Mail schickt, und die Erweiterung liest nur die Seite, die du gerade offen hast.',
          'E-Mails selbst versenden oder dein Postfach lesen – Gmail öffnet sich mit fertigem Entwurf, senden tust du. Das Script unter Verbindungen liest nur Mails von linkedin.com.',
          'Anrufe selbst wählen oder aufzeichnen – „Anrufen“ öffnet die Telefon-App.',
          'Leads per KI priorisieren. Die Reihenfolge ist erklärbar: überfällig, heute, Funnel-Tiefe, Alter.',
        ],
      },
      { art: 'zwischentitel', text: 'Noch nicht' },
      {
        art: 'liste',
        punkte: [
          '{{geplant}} Calendly-Termine automatisch übernehmen (No-Show, Absage).',
          '{{geplant}} LinkedIn-Datenexport importieren und Annahmen abgleichen.',
          '{{geplant}} Dubletten zusammenführen.',
          '{{geplant}} Eigene Ansichten speichern – heute gibt es die fertigen Ansichten.',
          '{{geplant}} Versionen von Leitfäden mit Wiederherstellen.',
          '{{geplant}} Sequenzen frei bauen (Schritte anlegen, löschen, sortieren) – heute änderst du Abstand und Vorlage bestehender Schritte.',
          '{{geplant}} „Antwort erhalten“ rückgängig machen – bis dahin über die Timeline korrigieren.',
          '{{geplant}} Offline weiterarbeiten – heute zeigt das CRM offline nur einen Hinweis und speichert nichts.',
          '{{geplant}} Sehen, woran die andere Person gerade arbeitet (Präsenz).',
          '{{geplant}} Erinnerung 10 Minuten vor einem Rückruf.',
          '{{geplant}} Wischgesten am iPhone.',
        ],
      },
      { art: 'zwischentitel', text: 'Grenzen der LinkedIn-Brücke' },
      {
        art: 'liste',
        punkte: [
          'Nachrichten, die du schon in LinkedIn gelesen hast, meldet LinkedIn oft nicht per Mail – die trägst du mit {A} oder in der Seitenleiste ein.',
          'Die Reaktion auf eine Antwort (Interesse, Rückfrage, Nein …) erkennt das CRM nicht, die wählst du.',
          'Die Erweiterung gibt es nur für Chrome am Computer, nicht am iPhone.',
        ],
      },
      { art: 'zwischentitel', text: 'Am iPhone' },
      {
        art: 'absatz',
        text: 'Import-Assistent, Leitfaden- und Sequenz-Editor sagen „Am Desktop bearbeiten“. Lesen, kopieren, anrufen und abhaken geht überall.',
      },
    ],
  },
]

/** Fragen, mit denen Leute in die Hilfe kommen – Startseite `/hilfe`. */
export const HAEUFIGE_FRAGEN: readonly { frage: string; antwort: string; thema: string }[] = [
  {
    frage: 'Kommen LinkedIn-Nachrichten automatisch ins CRM?',
    antwort:
      'Zum Teil: Angenommene Einladungen und neue Nachrichten erkennt das CRM aus den LinkedIn-Mails in deinem Gmail, sobald du das unter Verbindungen eingerichtet hast. Senden, die Reaktion wählen und live gelesene Antworten bleiben bei dir – die Chrome-Erweiterung macht das mit einem Klick.',
    thema: 'linkedin',
  },
  {
    frage: 'Kann ich mein Gmail verbinden?',
    antwort:
      'Für LinkedIn-Mails ja – ein Script in deinem Gmail schickt nur Mails von linkedin.com ans CRM. Als Postfach für Mails an Leads nicht: Das CRM öffnet Gmail mit fertigem Entwurf, du sendest dort und bestätigst „Gesendet?“.',
    thema: 'verbindungen',
  },
  {
    frage: 'Sehe ich, was Mike macht – und er, was ich mache?',
    antwort:
      'Ja: Team zeigt euch nebeneinander und protokolliert jede Aktion live; KPIs lassen sich je Person umschalten.',
    thema: 'kpis-team',
  },
  {
    frage: 'Wo melde ich einen Fehler?',
    antwort: 'Mit „Feedback geben“ in der Seitenleiste (am iPhone oben) oder ⌥F – samt Screenshot, direkt an Claude.',
    thema: 'feedback',
  },
]

export function themaVon(key: string | undefined): Thema | undefined {
  return key ? THEMEN.find((t) => t.key === key) : undefined
}

export function bloeckeVon(t: Thema, person: PersonId | null): readonly Block[] {
  return typeof t.bloecke === 'function' ? t.bloecke(person) : t.bloecke
}

/** Alles Lesbare eines Themas als Klartext (Suche). */
export function themaText(t: Thema, person: PersonId | null = null): string {
  const teile: string[] = [t.titel, t.kurz, t.stichworte ?? '']
  for (const b of bloeckeVon(t, person)) {
    if (b.art === 'absatz' || b.art === 'zwischentitel' || b.art === 'hinweis') teile.push(b.text)
    else if (b.art === 'liste' || b.art === 'schritte') teile.push(...b.punkte)
    else if (b.art === 'tasten') for (const z of b.zeilen) teile.push(z.tasten.join(' '), z.text)
    else teile.push('Tastenkürzel Tasten')
  }
  return klartext(teile.join(' ')).toLowerCase()
}

/**
 * Jedes Suchwort muss vorkommen (wie Palette und `?`-Liste). Reihenfolge: Treffer im Titel vor Kurztext/Stichworten vor Fließtext,
 * bei Gleichstand die Handbuch-Reihenfolge – so öffnet ↵ bei „gmail“ das Thema E-Mail. Leere Suche = alle Themen.
 */
export function sucheThemen(q: string, person: PersonId | null = null): Thema[] {
  const woerter = q.toLowerCase().split(/\s+/).filter(Boolean)
  if (!woerter.length) return [...THEMEN]
  const gewicht = (t: Thema): number => {
    const titel = t.titel.toLowerCase()
    const kopf = klartext(`${t.kurz} ${t.stichworte ?? ''}`).toLowerCase()
    return woerter.reduce((s, w) => s + (titel.includes(w) ? 4 : kopf.includes(w) ? 2 : 1), 0)
  }
  return THEMEN.map((t, i) => ({ t, i, text: themaText(t, person) }))
    .filter(({ text }) => woerter.every((w) => text.includes(w)))
    .map((x) => ({ ...x, g: gewicht(x.t) }))
    .sort((a, b) => b.g - a.g || a.i - b.i)
    .map((x) => x.t)
}

/** Hilfe-Pfad eines Themas. */
export const themaPfad = (key: string) => PFADE.hilfe(key)
