// Handbuch-Inhalt als Daten (durchsuchbar, eine Quelle für Seite und Suche).
// Neustart 25.11.2026: sieben kurze Themen für das einfache CRM (Board, Leitfäden, E-Mail). Geschrieben für Menschen, die keine
// Software mögen: kurze Sätze, konkrete Schritte, keine Fachwörter, keine Tasten. Die neuen Themen passen auf eine Bildschirmseite
// (der Test hält sie kurz); „E-Mail“ und „E-Mail-Kampagnen“ sind aus dem alten Handbuch übernommen, nur die Verweise stimmen wieder.
// Nichts versprechen, was nicht gebaut ist. Auszeichnung: **betont** · [Link](/pfad) · {{geplant}} (markup.ts, Inline.tsx).
// Jeder Link wird gegen die Routentabelle geprüft (links.test.ts).
import type { PersonId } from '@/features/auth/personen'
import { klartext } from './markup'

export type Block =
  | { art: 'absatz'; text: string }
  | { art: 'zwischentitel'; text: string }
  | { art: 'liste'; punkte: readonly string[] }
  | { art: 'schritte'; punkte: readonly string[] }
  | { art: 'hinweis'; text: string; geplant?: boolean }

export type Thema = {
  key: string
  titel: string
  /** Ein Satz unter dem Titel (Voice-Zeile) und in der Themenliste */
  kurz: string
  /** Zusätzliche Suchwörter – und Wörter aus dem Text, bei denen dieses Thema in der Suche oben stehen soll */
  stichworte?: string
  bloecke: readonly Block[] | ((person: PersonId | null) => readonly Block[])
}

export const THEMEN: readonly Thema[] = [
  {
    key: 'erste-schritte',
    titel: 'Erste Schritte',
    kurz: 'Was das CRM ist – und die ersten drei Handgriffe.',
    stichworte: 'start anfang anfangen einführung überblick',
    bloecke: [
      { art: 'absatz', text: 'Das CRM hat drei Teile. Mehr brauchst du im Alltag nicht.' },
      {
        art: 'liste',
        punkte: [
          '**Leads** – dein Board. Jede Person ist eine Karte.',
          '**Leitfäden** – deine Texte zum Kopieren.',
          '**E-Mail** – Kampagnen, Antworten, Postfächer und einzelne Mails.',
        ],
      },
      { art: 'zwischentitel', text: 'Die ersten drei Handgriffe' },
      {
        art: 'schritte',
        punkte: [
          'Klick auf [Leads](/leads) und dann oben rechts auf den blauen Knopf „Lead hinzufügen“. Namen und LinkedIn-Link eintragen, auf „Hinzufügen“ klicken. Die Karte liegt jetzt in „Angeschrieben“.',
          'Hat die Person geantwortet? Klick auf der Karte auf den grünen Knopf „Hat Interesse“ oder auf den roten Knopf „Kein Interesse“. Die Karte wandert in die passende Liste.',
          'Klick auf [Leitfäden](/leitfaeden) und dann auf „Leitfaden schreiben“. Dort legst du den Text ab, den du immer wieder brauchst.',
        ],
      },
      {
        art: 'absatz',
        text: 'Ihr arbeitet beide auf demselben Board. Was die andere Person ändert, erscheint bei dir von selbst.',
      },
    ],
  },
  {
    key: 'leads',
    titel: 'Leads',
    kurz: 'Dein Board: vier Listen, jede Person eine Karte.',
    stichworte:
      'board trello karten liste anlegen neu verschieben interesse rückgängig entfernen lead-blatt bearbeiten löschen filtern',
    bloecke: [
      {
        art: 'absatz',
        text: 'Die Listen: **Angeschrieben**, **Gespräch vereinbart**, **Im Geschäft**, **Verloren**.',
      },
      { art: 'zwischentitel', text: 'Karte hinzufügen' },
      {
        art: 'schritte',
        punkte: [
          'Klick auf [Leads](/leads) und oben rechts auf den blauen Knopf „Lead hinzufügen“.',
          'Vorname, Nachname und LinkedIn-Link eintragen. Zugehörigkeit wählen.',
          'Klick auf „Hinzufügen“. Die Karte liegt jetzt oben in „Angeschrieben“.',
        ],
      },
      { art: 'zwischentitel', text: 'Karte verschieben' },
      {
        art: 'liste',
        punkte: [
          'In „Angeschrieben“: Der grüne Knopf „Hat Interesse“ legt die Karte in „Gespräch vereinbart“. Der rote Knopf „Kein Interesse“ legt sie in „Verloren“.',
          'In „Gespräch vereinbart“: Der grüne Knopf „Im Geschäft“ legt sie in „Im Geschäft“. Der rote Knopf „Kein Interesse“ legt sie in „Verloren“.',
          'Du kannst eine Karte auch in eine andere Liste ziehen. Verklickt? Unten erscheint kurz „Rückgängig“ – ein Klick legt die Karte zurück.',
        ],
      },
      { art: 'zwischentitel', text: 'Karte finden und öffnen' },
      {
        art: 'liste',
        punkte: [
          'Oben tippst du im Feld „Suchen“ einen Namen oder eine Firma. Daneben wählst du „Alle“ oder eine Person. Beides blendet Karten nur aus.',
          'Ein Klick auf die Karte öffnet sie: Name, Anrede, Firma, LinkedIn-Link, Zugehörigkeit, Liste, Notiz und E-Mail-Erlaubnis. Ändern und auf „Speichern“ klicken.',
          '„Karte entfernen“ ganz unten nimmt die Karte nur vom Board. Gelöscht wird nichts.',
        ],
      },
    ],
  },
  {
    key: 'leitfaeden',
    titel: 'Leitfäden',
    kurz: 'Deine Texte zum Kopieren – einmal schreiben, immer wieder benutzen.',
    stichworte: 'vorlage vorlagen nachricht schreiben bearbeiten ändern archivieren archiviert chips',
    bloecke: [
      { art: 'zwischentitel', text: 'Leitfaden schreiben' },
      {
        art: 'schritte',
        punkte: [
          'Klick auf [Leitfäden](/leitfaeden) und dann auf den großen blauen Knopf „Leitfaden schreiben“.',
          'Titel und Text eintragen.',
          'Unter dem Text stehen kleine Knöpfe: Anrede, Vorname, Nachname, Unternehmen, Position, Absender Vorname. Ein Klick setzt einen Platzhalter wie [Vorname] an die Stelle, an der du gerade schreibst.',
          'Klick auf „Speichern“.',
        ],
      },
      { art: 'zwischentitel', text: 'Leitfaden benutzen' },
      {
        art: 'liste',
        punkte: [
          'Jeder Leitfaden ist eine Karte. Klick auf „Text kopieren“ und füge den Text dort ein, wo du schreibst.',
          'Die Platzhalter werden mitkopiert. Ersetze sie vor dem Senden durch den echten Namen.',
          'Zum Ändern klickst du auf die Karte.',
        ],
      },
      { art: 'zwischentitel', text: 'Leitfaden löschen' },
      {
        art: 'absatz',
        text: 'Öffne den Leitfaden und klick unten links auf „Löschen“. Er verschwindet aus deiner Liste, bleibt aber gespeichert – verloren geht nichts.',
      },
    ],
  },
  {
    // Aus dem alten Handbuch übernommen; angepasst sind nur Verweise auf Entferntes (Erlaubnis in der Lead-Karte statt in der Palette)
    key: 'email',
    titel: 'E-Mail',
    kurz: 'E-Mail ist ein Warm-Kanal: nur mit Erlaubnis-Grundlage, gesendet über Gmail.',
    stichworte: 'gmail verbinden postfach composer erlaubnis einwilligung widerspruch uwg mailto einzelmail',
    bloecke: [
      {
        art: 'absatz',
        text: 'Werbe-Mails ohne Einwilligung sind unzulässig (§ 7 UWG). Darum braucht jeder Lead eine **Erlaubnis-Grundlage** – zum Beispiel „hat im Gespräch um Infos gebeten“. Ohne sie bleibt der Composer gesperrt.',
      },
      { art: 'zwischentitel', text: 'Ablauf' },
      {
        art: 'schritte',
        punkte: [
          'Karte auf dem Board anklicken und dort auf „E-Mail schreiben“ klicken – oder unter [Einzelmails](/email) einen fälligen Schritt wählen.',
          'Vorlage wählen und Platzhalter füllen.',
          '„In Gmail öffnen“ öffnet Gmail mit Empfänger, Betreff und Text. Du sendest dort.',
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
        text: 'Für einzelne Mails nicht: Das CRM verschickt sie nicht selbst und liest deine Mails nicht. Es öffnet Gmail mit fertigem Entwurf (am iPhone die Mail-App) – du behältst die Kontrolle, und alles liegt in deinem normalen Gesendet-Ordner. Ist ein Text zu lang für den Gmail-Link, kopierst du ihn.',
      },
      {
        art: 'hinweis',
        text: 'Mehrere Leads auf einmal anschreiben, mit eigenem Postfach und automatischen Folgemails: [E-Mail-Kampagnen](/hilfe/kampagnen).',
      },
      {
        art: 'absatz',
        text: '„Erlaubnis erfassen“ und „Widerspruch erfassen“ stehen in der Lead-Karte: Karte anklicken, dann unten im Bereich „E-Mail“.',
      },
    ],
  },
  {
    // Aus dem alten Handbuch übernommen; angepasst sind nur die Verweise auf „Heute“ und „im Lead“
    key: 'kampagnen',
    titel: 'E-Mail-Kampagnen',
    kurz: 'Kurze Mail-Folgen an Leads mit Erlaubnis – über eigene Postfächer, mit Hochlauf statt „Aufwärmen“.',
    stichworte:
      'instantly mailchimp kampagne sequenz postfach domain dns spf dkim dmarc aufwärmen warmup hochlauf unibox antworten abmelden bounce unzustellbar platzierungstest app-passwort',
    bloecke: [
      {
        art: 'absatz',
        text: 'Eine Kampagne schickt bis zu drei kurze Mails im selben Verlauf (Tag 0, +3, +8) an viele Leads – über ein echtes Postfach, mit Antworten an einem Ort ([Antworten](/email/antworten)). Sie stoppt bei jeder Antwort, auch für die ganze Firma.',
      },
      { art: 'zwischentitel', text: 'In fünf Schritten startklar' },
      {
        art: 'schritte',
        punkte: [
          '**Versand-Domain kaufen** (z. B. eine zweite .de-Domain mit „Steiner & Co.“ im Namen) – mindestens 30 Tage vor der ersten Kampagne. Warum: Wird sie gesperrt, bleibt steinerundco.de sauber.',
          '**DNS-Einträge setzen**: unter [Postfächer](/email/postfaecher) die Domain eintragen, „Prüfen“ zeigt die Ampel, die Einträge stehen zum Kopieren da. Warum: Ohne SPF, DKIM und DMARC lehnen Gmail, Microsoft, GMX und T-Online ab.',
          '**Postfach anlegen** – am besten in einem eigenen Google-Workspace-Konto. Warum: Sperrt Google bei Verdacht ein Konto, bleibt euer normales Postfach unberührt.',
          '**Postfach verbinden**: „Postfach verbinden“, App-Passwort einfügen, das CRM testet sofort Anmeldung und Ordner.',
          '**Hochlauf abwarten**: Woche 1–2 höchstens 10 Mails am Tag, 3–4 15, 5–6 25, danach das Tageslimit. Das CRM steigert selbst – nur, solange kaum etwas unzustellbar ist.',
        ],
      },
      { art: 'zwischentitel', text: 'Warum kein „Aufwärmen“ wie bei Instantly?' },
      {
        art: 'absatz',
        text: 'Instantly lässt Postfächer sich gegenseitig künstliche Mails schicken, öffnen und aus dem Spam holen. Seit September 2026 erkennt die Blockliste „Heatwave“ genau das und sperrt die Domain dauerhaft. Das CRM steigert die Menge deshalb nur mit echten Mails und bremst bei schlechten Werten selbst („Schonung“, „Pause“).',
      },
      { art: 'zwischentitel', text: 'Kampagne anlegen' },
      {
        art: 'schritte',
        punkte: [
          '[Kampagnen](/email/kampagnen) → „Neue Kampagne“. Die Vorlage hat drei Mails; alles in **[hier …]** ersetzen – sonst sendet das CRM nicht.',
          'Ablauf: kurz schreiben (unter 120 Wörtern), erste Mail ohne Link. Platzhalter wie [Briefanrede] per Klick einfügen, rechts die Vorschau mit echtem Empfänger. Mit „Variante“ testet ihr zwei Betreffs (A/B).',
          'Empfänger: „Leads hinzufügen“ – nur Leads mit E-Mail-Adresse und Erlaubnis.',
          'Einstellungen: Postfach wählen, Versandzeiten (Mo–Fr 8–16 Uhr ist ein guter Start).',
          'Übersicht: Sind alle Punkte unter „Vor dem Start“ grün, „Starten“.',
        ],
      },
      { art: 'zwischentitel', text: 'Was automatisch passiert' },
      {
        art: 'liste',
        punkte: [
          'Antwort → Kampagne stoppt für diesen Lead (und seine Firma), der Lead steht in [Antworten](/email/antworten).',
          'Abwesenheitsnotiz → die nächste Mail wartet bis nach dem Rückkehrdatum.',
          '„Nicht mehr im Unternehmen“ → Lead wird gestoppt.',
          'Unzustellbar → Adresse auf die Sperrliste; über 3 % Unzustellbare hält die Kampagne an.',
          '„Bitte keine Mails“ oder Klick auf „Abmelden“ → sofort auf die Sperrliste.',
          'Echte Antworten, die im Spam gelandet sind, holt das CRM in den Posteingang.',
          'Feiertage und Wochenenden werden übersprungen, zwischen zwei Mails liegen mindestens einige Minuten.',
        ],
      },
      { art: 'zwischentitel', text: 'Wen darf ich anschreiben?' },
      {
        art: 'absatz',
        text: 'Nur Leads mit **Erlaubnis-Grundlage**. Kalte Werbe-Mails an Firmen sind in Deutschland auch im B2B verboten (§ 7 Abs. 2 Nr. 2 UWG) – schon eine einzige kann eine Abmahnung kosten. Eine LinkedIn-Vernetzung ist keine Erlaubnis.',
      },
      {
        art: 'liste',
        punkte: [
          'Telefon: „Darf ich Ihnen das kurz per Mail schicken?“ – Ja → in der Lead-Karte „Erlaubnis erfassen“ (mit Wortlaut).',
          'LinkedIn: ein schriftliches „Ja, gern an …@…“ im Chat ist eine Erlaubnis – Screenshot sichern.',
          'Nach einem Gespräch und bei Bestandskunden.',
          'Mehr als drei Mails ohne Antwort lässt das CRM nicht zu.',
        ],
      },
      { art: 'zwischentitel', text: 'Platzierungstest' },
      {
        art: 'absatz',
        text: 'Eigene Prüf-Postfächer bei GMX, WEB.DE, T-Online und Gmail verbinden, dann unter [Postfächer](/email/postfaecher) „Test starten“: Das CRM schickt die Mail dorthin und schaut nur nach, ob sie im Posteingang oder im Spam liegt – ohne etwas anzuklicken.',
      },
    ],
  },
  {
    key: 'team-einstellungen',
    titel: 'Team & Einstellungen',
    kurz: 'Wer wie viele Karten hat – und wo Profil, Passcode und Backup stehen.',
    stichworte: 'zahlen übersicht kürzel signatur calendly passwort sperrliste feiertage export sicherung sichern',
    bloecke: [
      { art: 'zwischentitel', text: 'Team' },
      {
        art: 'absatz',
        text: 'Klick auf [Team](/team). Für jede Person siehst du eine Karte mit vier Zahlen: so viele Karten hat sie in jeder Liste des Boards.',
      },
      { art: 'zwischentitel', text: 'Einstellungen' },
      {
        art: 'liste',
        punkte: [
          '[Profil](/einstellungen/profil) – dein Kürzel, deine E-Mail-Signatur und dein Calendly-Link.',
          '[Passcode](/einstellungen/passcode) – deinen Passcode ändern.',
          '[Sperrliste](/einstellungen/sperrliste) – wer hier steht, bekommt keine E-Mail mehr.',
          '[Feiertage](/einstellungen/feiertage) – an diesen Tagen sendet keine Kampagne.',
          '[Export & Backup](/einstellungen/export) – eine Sicherung als Datei herunterladen.',
        ],
      },
    ],
  },
  {
    key: 'archiv',
    titel: 'Wo ist das alte CRM?',
    kurz: 'Nichts wurde gelöscht – das alte CRM ist vollständig gesichert.',
    stichworte: 'archiv altes alter früher vorher weg verschwunden fehlt neustart sicherung',
    bloecke: [
      {
        art: 'absatz',
        text: 'Am 25.11.2026 wurde das CRM neu und einfach aufgebaut. Dabei wurde **nichts gelöscht**. Der Stand von diesem Tag ist vollständig gesichert.',
      },
      { art: 'zwischentitel', text: 'Die alten Leads' },
      {
        art: 'liste',
        punkte: [
          'Die alten Leads stehen nicht auf dem Board. Das Board hat leer angefangen.',
          'Sie sind aber weiter gespeichert.',
          'Fügst du eine dieser Personen mit ihrem LinkedIn-Link neu als Karte hinzu, bekommst du denselben Lead zurück. Es entsteht kein zweiter.',
        ],
      },
      { art: 'zwischentitel', text: 'Die alten Leitfäden' },
      {
        art: 'absatz',
        text: 'Die alten Leitfäden sind archiviert. Sie stehen nicht mehr unter [Leitfäden](/leitfaeden), sind aber gespeichert.',
      },
      { art: 'zwischentitel', text: 'Die alten Seiten' },
      {
        art: 'absatz',
        text: 'Heute, Pipeline, Telefon, KPIs und Import gibt es nicht mehr. Alte Lesezeichen führen jetzt auf das Board.',
      },
    ],
  },
]

/** Fragen, mit denen Leute in die Hilfe kommen – Startseite `/hilfe`. Höchstens drei, kurz. */
export const HAEUFIGE_FRAGEN: readonly { frage: string; antwort: string; thema: string }[] = [
  {
    frage: 'Wo ist das alte CRM?',
    antwort: 'Nichts wurde gelöscht. Der Stand vom 25.11.2026 ist vollständig gesichert.',
    thema: 'archiv',
  },
  {
    frage: 'Ich habe mich verklickt. Was jetzt?',
    antwort:
      'Nach dem Verschieben erscheint unten kurz „Rückgängig“. Später ziehst du die Karte einfach zurück in ihre Liste.',
    thema: 'leads',
  },
  {
    frage: 'Darf ich jedem Lead eine E-Mail schreiben?',
    antwort: 'Nein, nur mit Erlaubnis. Du erfasst sie in der Lead-Karte mit „Erlaubnis erfassen“.',
    thema: 'email',
  },
]

export function themaVon(key: string | undefined): Thema | undefined {
  return key ? THEMEN.find((t) => t.key === key) : undefined
}

export function bloeckeVon(t: Thema, person: PersonId | null): readonly Block[] {
  return typeof t.bloecke === 'function' ? t.bloecke(person) : t.bloecke
}

/** Alle Texte eines Themas mit Auszeichnung (Titel, Kurztext, Blöcke) – Grundlage für Suche und Link-Prüfung. */
export function themaRohtexte(t: Thema, person: PersonId | null = null): string[] {
  const teile: string[] = [t.titel, t.kurz]
  for (const b of bloeckeVon(t, person)) {
    if (b.art === 'liste' || b.art === 'schritte') teile.push(...b.punkte)
    else teile.push(b.text)
  }
  return teile
}

/** Alles Lesbare eines Themas als Klartext (Suche). */
export function themaText(t: Thema, person: PersonId | null = null): string {
  return klartext([...themaRohtexte(t, person), t.stichworte ?? ''].join(' ')).toLowerCase()
}

/**
 * Jedes Suchwort muss vorkommen. Reihenfolge: Treffer im Titel vor Kurztext/Stichworten vor Fließtext, bei Gleichstand die
 * Handbuch-Reihenfolge – so steht bei „gmail“ das Thema E-Mail oben. Leere Suche = alle Themen.
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
