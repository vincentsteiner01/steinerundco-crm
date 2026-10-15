# LinkedIn ins CRM – Einrichtung (ca. 10 Minuten)

LinkedIn schickt dir für neue Nachrichten und angenommene Einladungen eine Benachrichtigungs-Mail. Ein kleines Google-Script in deinem eigenen Gmail liest **nur diese LinkedIn-Mails** und schickt sie alle 5 Minuten ans CRM. Das CRM trägt dann von selbst ein:

- **„Einladung angenommen“** → Vernetzung angenommen, die LinkedIn-Sequenz startet (wie Taste „Angenommen“).
- **„Neue Nachricht von …“** → Antwort erhalten mit dem Nachrichtentext, laufende Sequenzen stoppen (wie Taste `A`).
- Lässt sich eine Mail keinem Lead sicher zuordnen, landet sie als „unbekannt“ im **Eingang**: im CRM unter **Einstellungen → Verbindungen → Tab „Eingang“** (live, beide Postfächer, Filter nach Person und Status; „Eingang n zuordnen“ steht auch im Kopf von Heute) oder in der Chrome-Erweiterung (Popup → „Eingang ansehen“). Dort suchst du den Lead und klickst „Zuordnen“ – dann wird sofort verbucht.

Das Script klickt, schreibt und sendet nichts bei LinkedIn. Es verstößt deshalb nicht gegen die LinkedIn-Nutzungsvereinbarung.

---

## Schritt 0 – Dein LinkedIn-Profil eintragen

Im CRM unter **Einstellungen → Verbindungen** (Taste `G E`, dann `7`) → Zeile **„Dein LinkedIn-Profil“** → „Eintragen“: deine eigene Profil-Adresse (`linkedin.com/in/…`) → speichern. Die Seite zeigt dieselben Schritte wie diese Anleitung, mit Status, Schlüssel und dem Script zum Kopieren.

Alternativ in der Chrome-Erweiterung (Version 1.1.0, `chrome://extensions` → Neu laden; Mike: neue ZIP entpacken, dann Neu laden): Rechtsklick auf das S&-Symbol → **Optionen** → Abschnitt **„LinkedIn-Mails ins CRM“** → **„Dein LinkedIn-Profil“**.

Warum: LinkedIn verlinkt in jeder Benachrichtigung auch **dein** Profil. Kennt das CRM deine Adresse, hält es sie nie für die eines Leads.

## Schritt 1 – Eingangs-Schlüssel holen

Der Schlüssel verbindet dein Script mit deinem CRM-Konto. Jede Person hat ihren eigenen.

- **Am einfachsten:** im CRM unter **Einstellungen → Verbindungen**, Schritt 3 **„Schlüssel erzeugen“** – einmal sichtbar, mit Kopieren-Knopf. Gleich gut: in der Erweiterung im Abschnitt „LinkedIn-Mails ins CRM“ → „Schlüssel erzeugen“ (liegt danach in der Zwischenablage).
- **Oder im eigenen Terminal** (selbst tippen, nicht über Claude – sonst landet der Schlüssel in einem Protokoll): `bash tools/eingang-token.sh vincent@steinerundco.de` – das Skript legt ihn nur in die Zwischenablage.

Der Schlüssel hat 43 Zeichen aus Buchstaben, Ziffern, `-` und `_`. Füge ihn direkt in Schritt 3 ein, nicht in eine Datei oder einen Chat – wer ihn hat, kann in deinem Namen Annahmen und Antworten ins CRM buchen. Ein neuer Schlüssel macht den alten ungültig.

## Schritt 2 – Script anlegen

1. Öffne **script.google.com** und melde dich mit dem Konto an, in dem die LinkedIn-Mails ankommen – bei Vincent **vincentsteiner01@googlemail.com** (rechts oben prüfen).
2. Klicke links oben auf **„Neues Projekt“**.
3. Klicke oben auf den Namen „Unbenanntes Projekt“ und nenne es **„LinkedIn ins CRM“** → „Umbenennen“.
4. Im Editor steht in `Code.gs` schon `function myFunction() { … }`. Markiere alles (`⌘ A`) und lösche es.
5. Kopiere den kompletten Inhalt von `tools/apps-script/LinkedIn-ins-CRM.gs` hinein (im CRM: Einstellungen → Verbindungen → Schritt 1 „Code ansehen“ / Kopieren).
6. Speichern mit `⌘ S` (oder das Disketten-Symbol).

## Schritt 3 – Schlüssel eintragen (nicht in den Code)

1. Klicke links auf das **Zahnrad „Projekteinstellungen“**.
2. Scrolle ganz nach unten zu **„Skripteigenschaften“** → **„Skripteigenschaft hinzufügen“**.
3. Eigenschaft: `CRM_SCHLUESSEL` · Wert: dein Schlüssel aus Schritt 1.
4. **„Skripteigenschaften speichern“**.

## Schritt 4 – Einrichten ausführen

1. Klicke links auf **„Editor“** (Symbol `< >`).
2. Wähle oben in der Leiste neben „Debuggen“ im Auswahlfeld die Funktion **`einrichten`**.
3. Klicke auf **„Ausführen“**.

## Schritt 5 – Berechtigungen erlauben

Beim ersten Ausführen fragt Google nach Erlaubnis. Die Texte können leicht abweichen:

1. „Autorisierung erforderlich“ → **„Berechtigungen überprüfen“**.
2. Wähle dein Google-Konto (vincentsteiner01@googlemail.com).
3. **„Google hat diese App nicht überprüft“** – das erscheint bei jedem selbst geschriebenen Script, weil Google nur Apps prüft, die andere Leute benutzen. Die „App“ ist hier dein eigenes Script, nur du hast Zugriff darauf. Klicke auf **„Erweitert“** und dann auf **„Zu LinkedIn ins CRM wechseln (unsicher)“**.
4. Google zeigt, was das Script darf. Falls Kästchen erscheinen: **alle anhaken**, sonst bricht das Script ab.
   - **„Gmail-Nachrichten lesen, verfassen, senden und dauerhaft löschen“** – klingt nach viel. Google kennt für Gmail-Scripts nur diese eine Berechtigung. Was das Script tatsächlich tut, steht im Code: Es sucht nur `from:linkedin.com` der letzten 3 Tage, liest diese Mails und setzt das Label „CRM/erfasst“. Es sendet und löscht nichts.
   - **„Verbindung zu einem externen Dienst herstellen“** – das ist die Übertragung ans CRM.
   - **„Ausführung zulassen, wenn Sie nicht anwesend sind“** – für den 5-Minuten-Takt.
5. **„Zulassen“**.

Danach läuft `einrichten` zu Ende und holt die LinkedIn-Mails der letzten 3 Tage. Antworten, die du in der Zeit schon mit `A` erfasst oder schon beantwortet hast, bucht das CRM nicht noch einmal (siehe „Gut zu wissen“). Im **Ausführungsprotokoll** unten steht dann ungefähr:

```
Eingerichtet: läuft ab jetzt alle 5 Minuten.
CRM: 7 Mails · neu 7 · doppelt 0 · verbucht 3 · unbekannt 1 · ignoriert 3 · offen 0 · Fehler 0
```

Fertig. Beim ersten Lauf werden die LinkedIn-Mails der letzten 3 Tage übertragen, danach alle 5 Minuten die neuen.

---

## Prüfen, ob es läuft

- **Gmail:** Links erscheint das Label **„CRM/erfasst“**. LinkedIn-Mails, die übertragen wurden, tragen es.
- **CRM:** In der Timeline des Leads stehen „Vernetzung angenommen“ bzw. „Nachricht erhalten“ mit dem Text aus LinkedIn. Nicht zugeordnete Mails stehen im Eingang (Einstellungen → Verbindungen → „Eingang“).
- **CRM → Einstellungen → Verbindungen:** Status, „Letzte 7 Tage“ und „Letzter Eingang“; Schritt 5 zeigt den ersten Eingang live.
- **Erweiterung → Optionen:** „Apps Script zuletzt gemeldet: vor 3 Min.“ – mehr als 30 Minuten her heißt: Takt prüfen.
- **script.google.com → links „Ausführungen“:** alle 5 Minuten ein Eintrag `sync` mit Status „Abgeschlossen“.
- **Von Hand testen:** Funktion **`test`** wählen → „Ausführen“. Im Protokoll steht die Antwort des CRM.

Bedeutung der Zahlen: **neu** = erstmals übertragen · **doppelt** = schon da gewesen · **verbucht** = bearbeitet (eingetragen oder als schon erfasst erkannt) · **unbekannt** = bitte im Eingang zuordnen · **ignoriert** = Werbung, Hinweise, Sammel-Mails · **offen** = Einladung von einem Lead (auf LinkedIn selbst annehmen) · **Fehler** = Claude Bescheid geben.

### Wenn etwas nicht stimmt

| Meldung im Protokoll | Was tun |
|---|---|
| „Kein gültiger Schlüssel …“ | Schritt 3 prüfen: Name genau `CRM_SCHLUESSEL`, Wert ohne Leerzeichen. |
| „Schlüssel ungültig oder widerrufen …“ | Neuen Schlüssel erzeugen (Schritt 1) und in Schritt 3 ersetzen. |
| „CRM antwortet 5xx …“ | Nichts tun, der nächste Lauf versucht es erneut. Hält es an: Claude Bescheid geben. |
| Viele „unbekannt“ | Im Eingang zuordnen (CRM → Einstellungen → Verbindungen → „Eingang“ oder in der Erweiterung). Prüfen, ob dein LinkedIn-Profil eingetragen ist (Schritt 0). Claude kann die Regeln anhand der gespeicherten Betreffzeilen nachschärfen. |

**Gut zu wissen – nichts doppelt:**

- LinkedIn schickt Nachrichten-Mails oft nur, wenn du die Nachricht nicht schon in LinkedIn gelesen hast. Antworten, die du live liest, trägst du weiter mit `A` ein (am besten in der Seitenleiste der Erweiterung).
- **`A` zuerst, Mail danach:** Das CRM bucht die Mail nicht noch einmal, wenn es seit 24 Stunden vor der Mail schon eine erfasste Antwort gibt und du dazwischen nichts geschrieben hast – egal, wie viel später du `A` gedrückt hast. Ebenso bei ±10 Minuten oder gleichem Text.
- **Schon geantwortet, Mail kommt erst danach** (z. B. beim ersten Lauf mit 3 Tagen Rückstand): Die alte Nachricht wird nicht mehr gebucht. Der Lead taucht also nicht wieder als „Antwort offen“ in Heute auf, und „Nachfassen im Gespräch“ läuft weiter.
- **Mail zuerst, `A` danach:** Die Antwort steht dann schon ohne Reaktion am Lead. In der **Seitenleiste** heißt der Knopf jetzt „Reaktion nachtragen“, in der **CRM-App** zeigt `A` den Hinweis „… kam schon über die LinkedIn-Mail ins CRM – du trägst nur die Reaktion nach“ und den Knopf „Reaktion speichern“. Beide setzen nur die Reaktion an dieser Antwort, es entsteht keine zweite.
- **Zuordnung nur über den Namen** (Mail ohne verwertbaren Profil-Link): Eine Annahme bucht das CRM nur, wenn du an diesen Lead eine offene Anfrage hast, eine Antwort nur, wenn du mit ihm vernetzt bist. Sonst landet sie im Eingang – so bekommt keine andere Person gleichen Namens Opener-Aufgaben.

In LinkedIn müssen die E-Mail-Benachrichtigungen für **Nachrichten** und **angenommene Einladungen** eingeschaltet sein (Einstellungen → Mitteilungen). Vincent bekommt sie bereits.

---

## Anhalten

- **Pausieren:** Funktion **`stoppen`** wählen → „Ausführen“. Der 5-Minuten-Takt ist weg, es wird nichts mehr übertragen. Wieder starten mit `einrichten`.
- **Schlüssel sperren:** CRM → Einstellungen → Verbindungen → Zeile „Schlüssel“ → „Widerrufen“, oder Erweiterung → Optionen → „Widerrufen“ (oder im eigenen Terminal `bash tools/eingang-token.sh --widerrufen vincent@steinerundco.de`).
- **Google-Zugriff ganz entziehen:** myaccount.google.com/permissions → „LinkedIn ins CRM“ → „Zugriff entfernen“.
- Das Label „CRM/erfasst“ kannst du in Gmail jederzeit löschen, die Mails bleiben erhalten.

---

## Mike

Mike macht genau dieselben Schritte – in **seinem eigenen** Gmail und mit **seinem eigenen** Schlüssel:

- Im CRM (mit seinem eigenen Login): Einstellungen → Verbindungen → eigenes LinkedIn-Profil eintragen → Schritt 3 „Schlüssel erzeugen“. Oder in der Erweiterung (Version 1.1.0): Optionen → „LinkedIn-Mails ins CRM“. Er braucht dafür kein Terminal.
- Annahmen und Antworten aus seinem Postfach werden in seinem Namen verbucht (seine Vernetzungen, seine Sequenzen).
- Voraussetzung: LinkedIn schickt ihm die Benachrichtigungs-Mails (Einstellungen → Mitteilungen in seinem LinkedIn).

---

## Datenschutz in einem Satz je Punkt

- Übertragen werden nur Mails mit Absender linkedin.com: Betreff, Absender, Datum, die ersten 6000 Zeichen Text und LinkedIn-Links ohne Tracking- und Login-Parameter.
- Gespeichert werden für Annahmen, Nachrichten und Einladungen höchstens 2000 Zeichen Nachrichtentext, Betreff, Absender und die Erkennungs-Entscheidung – nie die komplette Mail.
- Für Werbung, Job-Mails, „hat Ihr Profil angesehen“ und Einladungen von Personen, die nicht im CRM sind, bleibt nur die Erkennungs-Regel (ohne Namen, Betreff oder Links); diese Einträge löscht das CRM nach 30 Tagen.
- Der Schlüssel liegt nur in deinen Skripteigenschaften; das CRM speichert nur einen nicht umkehrbaren Hash davon.
- Wird ein Lead endgültig gelöscht, verschwinden auch seine Eingangs-Einträge.
