# Steiner & Co. CRM für LinkedIn – Chrome-Erweiterung

Eine ruhige Seitenleiste neben LinkedIn: Sie zeigt, wer die Person im CRM ist, und die nächste vorbereitete Nachricht.
Du pflegst nichts doppelt – was du auf LinkedIn tust, bestätigst du mit einem Klick, und es steht im CRM.

## Was sie tut

- **Profil** (`linkedin.com/in/…`): liest Name, Headline, Firma, Ort und die Profil-Adresse der Seite, die du gerade ansiehst,
  und sucht die Person im CRM (exakt über die normierte LinkedIn-URL, sonst ähnliche Namen).
  - **Im CRM:** Stufe, Zuständig, Vernetzung je Person, laufende Sequenz mit Schritt und Fälligkeit und die **nächste
    Nachricht** – Vorlage mit gefüllten Platzhaltern; offene Platzhalter (Amber) trägst du direkt im Text ein.
    Knöpfe: **Kopieren** `C` · **Gesendet** `E` (erst nach dem Kopieren, 6 s Rückgängig `Z`) · **Angenommen** ·
    **Anfrage gesendet** · **Antwort erhalten** `A` (Ja · Rückfrage · Nein · Später · Nicht ICP, mit Zitat) · **Notiz** `N` ·
    **Im CRM öffnen** `O`. Ist eine Antwort offen, zeigt die Leiste den passenden Antwort-Vorschlag wie die Heute-Seite.
  - **Nicht im CRM:** ähnliche Namen mit „Profil verknüpfen“ (korrigiert z. B. erfundene ChatGPT-URLs) und
    **Als Lead anlegen** – vorbefülltes Formular (Anrede, Vorname, Nachname, Unternehmen, Rolle, Ort), zuständig bist du,
    optional „Vernetzungsanfrage gerade gesendet“. Angelegt wird über denselben Weg wie der Schnellimport (`crm.import_leads`,
    Quelle Schnellimport, Batch „Erweiterung · Datum“); Rückgängig nimmt Anfrage und Lead wieder heraus.
- **Unterhaltung** (`linkedin.com/messaging/thread/…`): erkennt den Gesprächspartner über den Profil-Link im Kopf und füllt
  „Antwort erhalten“ mit der letzten Nachricht der anderen Person (oder mit deinem markierten Text). Immer editierbar.
- **Popup** (Klick auf das S&-Symbol): Anmeldung, deine Zahlen für heute (fällige LinkedIn-Schritte, offene Antworten),
  Seitenleiste öffnen, CRM öffnen, Abmelden; „Eingang ansehen“, sobald aus den LinkedIn-Mails etwas offen ist.
- **Reaktion nachtragen:** Ist eine Antwort schon ohne Reaktion erfasst (aus der LinkedIn-Benachrichtigungs-Mail), heißt `A`
  „Reaktion nachtragen“ und setzt nur das Label an dieser Antwort (`crm.set_reply_label`) – keine zweite Antwort, kein Rückgängig.
- **Eingang** (`eingang.html`): LinkedIn-Mails, die das CRM nicht allein zuordnen konnte (`crm.eingang`, Apps Script →
  Edge Function `linkedin-eingang`), und Einladungen von Leads. Lead suchen → „Zuordnen“ (`crm.eingang_zuordnen`, verbucht
  sofort im Namen des Postfach-Inhabers) oder „Ignorieren“. Zeigt, wann dein Apps Script zuletzt gemeldet hat.
- **Optionen → LinkedIn-Mails ins CRM:** eigenes LinkedIn-Profil (damit die Mail-Erkennung es nie für einen Lead hält) und
  Eingangs-Schlüssel erzeugen/widerrufen (`crm.eingang_token_erzeugen`; einmal sichtbar, gleich in der Zwischenablage).
  Einrichtung des Apps Scripts: `tools/apps-script/ANLEITUNG.md`.
- Rechtliche Gates wie im CRM (`lib/gates.ts`): Widerspruch, Sperrliste und gesperrte Firma sperren Kopieren, Gesendet und
  Anfrage – mit Grund. Antworten und Notizen bleiben möglich (Historie ist kein Kontakt).

## Was sie nie tut

LinkedIn verbietet in der Nutzungsvereinbarung (Ziffer 8.2) Bots, Automatisierung und das massenhafte Kopieren von Profilen.
Deshalb gilt technisch:

- Sie **klickt, tippt, sendet und navigiert nie** auf LinkedIn. Nachrichten und Anfragen schickst du selbst.
- Sie **liest nur die Seite, die du gerade ansiehst** – und nur, solange die Seitenleiste offen ist oder du klickst.
  Es gibt **kein Content-Script**: Ohne offene Leiste läuft auf LinkedIn kein Code der Erweiterung.
- Sie ruft **keine weiteren LinkedIn-Seiten** ab, scrollt nicht, lädt nichts nach und fügt **nichts in LinkedIn ein**
  (die Leiste ist Chromes eigene Seitenleiste, nicht Teil der LinkedIn-Seite).
- Ins CRM geht nur, was du bestätigst. Die Erweiterung speichert keine Lead-Daten im Browser – nur deine Anmeldung.

Restrisiko: LinkedIn nennt „Browser-Plugins“ ausdrücklich beim Kopieren von Profildaten. Eine Erweiterung, die nur auf Klick die
sichtbare Seite liest (wie folk, Surfe oder HubSpot), wird geduldet, aber ohne Garantie. BAUPLAN § 8.3 Nr. 1 hatte „keine
Extension“ – Vincent hat am 15.10.2026 entschieden, sie in genau dieser Nur-Lesen-Form zu bauen.

**Warum Chromes Seitenleiste statt eines eingeblendeten Panels:** LinkedIn listet „Overlay or otherwise modify the Services or
their appearance“ als verbotene Erweiterungs-Art. Die Seitenleiste verändert LinkedIn nicht, braucht kein dauerhaftes Script auf
der Seite und keine `web_accessible_resources` (an denen LinkedIn Erweiterungen erkennen kann).

## Installieren (Vincent und Mike)

1. Ordner bekommen:
   - **Vincent** (Repository): `cd extension && npm install && npm run build` → Ordner `extension/dist`.
   - **Mike**: Vincent schickt `extension/steinerundco-crm-erweiterung.zip` → entpacken, z. B. nach
     `Dokumente/steinerundco-crm-erweiterung` (der Ordner muss liegen bleiben).
2. Chrome → `chrome://extensions` → oben rechts **Entwicklermodus** einschalten.
3. **„Entpackte Erweiterung laden“** → den Ordner `extension/dist` (Mike: den entpackten Ordner) wählen.
4. Puzzle-Symbol in der Chrome-Leiste → „Steiner & Co. CRM für LinkedIn“ **anheften**.

**Updates:** nach jedem `npm run build` in `chrome://extensions` beim Eintrag auf das **Neu-laden-Symbol** (Kreispfeil) klicken.
Mike ersetzt den Ordnerinhalt durch die neue ZIP und klickt ebenfalls auf Neu laden. Offene Seitenleisten danach einmal
schließen und wieder öffnen.

## Erste Anmeldung

1. Auf das **S&-Symbol** klicken → „Wer bist du?“ → **Vincent** oder **Mike** (`V`/`M`).
2. **Passcode** – derselbe wie im CRM (mindestens 10 Zeichen). „Angemeldet bleiben“ an: die Anmeldung übersteht
   Browser-Neustarts; aus: sie endet mit dem Browser.
3. Im Popup erscheinen dein Foto und die Zahlen für heute. **„Seitenleiste öffnen“** oder `⌥C`.

## Benutzung

`⌥C` (Option+C) öffnet die Seitenleiste. In der Leiste: `C` Kopieren · `E` Gesendet · `A` Antwort erhalten (dann `1`–`5`
für die Reaktion, `↵` speichern) · `N` Notiz (`⌘↵` speichern) · `O` Im CRM öffnen · `Z` Rückgängig · `R` neu lesen · `Esc` schließt
das Formular. Die Tasten wirken, wenn die Leiste den Fokus hat und kein Eingabefeld aktiv ist.

Typischer Ablauf Anfrage: Profil öffnen → auf LinkedIn „Vernetzen“ → in der Leiste „Als Lead anlegen“ mit Haken
„Vernetzungsanfrage gerade gesendet“ (oder bei bekannten Leads „Anfrage gesendet“).
Typischer Ablauf Nachricht: Profil oder Unterhaltung öffnen → `C` → in LinkedIn einfügen und senden → `E`.

Einstellungen (Rechtsklick auf das Symbol → Optionen): CRM-Adresse Live (`https://crm.steinerundco.de`) oder Lokal
(`http://localhost:8768`), Tastenkürzel ändern.

## Fehlerbehebung

| Problem | Lösung |
|---|---|
| „Die Seite ließ sich nicht lesen“ | LinkedIn-Tab neu laden (`⌘R`), dann `R` in der Leiste. |
| „Name nicht erkannt“ / Felder leer | LinkedIn lädt noch oder hat den Aufbau geändert: `R`. Felder im Formular selbst ausfüllen und Vincent Bescheid geben. |
| `⌥C` tut nichts | `chrome://extensions/shortcuts` → Kürzel prüfen (Konflikt mit anderer Erweiterung) oder Popup → „Seitenleiste öffnen“. |
| „Die Erweiterung wurde neu geladen …“ | Nach einem Update: Seitenleiste schließen und wieder öffnen. |
| „Passcode stimmt nicht“ | Passcode wie im CRM; nach 5 Fehlversuchen 30 s warten. Vergessen: die andere Person setzt ihn im CRM unter Einstellungen → Passcode zurück. |
| „Steht auf der Sperrliste“ / „Widerspruch – nicht kontaktieren“ | Gewollt (§ 8.4): kein Kontakt, kein Anlegen. Im CRM prüfen. |
| „Der Schritt hat sich inzwischen geändert“ | Jemand (z. B. die Heute-Seite) war schneller – die Leiste lädt neu, nichts wurde doppelt gebucht. |
| Sales Navigator / Firmenseite | Wird nicht gelesen – das normale Profil (`/in/…`) öffnen. |
| „Keine Verbindung“ | Internet prüfen; das CRM selbst unter crm.steinerundco.de testen. |

## Entwicklung

```bash
cd extension
npm install
npm test            # Vitest: Lese-Logik gegen synthetische LinkedIn-Seiten, Service-Worker mit Supabase-Mock, Nachrichten-Block
npx tsc --noEmit    # Typen (inkl. der importierten CRM-Module aus ../src)
npm run build       # dist/ + steinerundco-crm-erweiterung.zip
npm run e2e         # Headless-Chromium mit geladener Erweiterung, LinkedIn und Supabase gemockt (keine echten Daten)
npm run icons       # Icons neu rendern (Python + Pillow)
```

Aufbau:

- `src/background/` – Service Worker: einziger Supabase-Client (Schema `crm`, Sitzung in `chrome.storage`), Nachrichten-Handler
  (`handler.ts`, RPCs wie `src/data/rpc.ts`), `⌥C` öffnet die Seitenleiste.
- `src/lesen/` – reine Lese-Funktionen (URL, `document.title`, Meta-Tags, `h1`, `aria-label`, Links `/in/<slug>`; Klassennamen
  nur als Zusatzsignal). `einstieg.ts` wird als `dist/lesen.js` (IIFE ohne Imports) per `chrome.scripting.executeScript`
  in den Tab gegeben – nur aus der offenen Seitenleiste.
- `src/ui/` – Popup, Seitenleiste, Optionen (React, Design-System „Editorial Terminal“, Schriften und Fotos lokal in `static/`).
- Aus dem CRM wiederverwendet (`../src`, nur gelesen): `lib/url.ts` (URL-Norm wie `crm.normalize_linkedin_url`),
  `lib/platzhalter.ts` (`fuellen`), `lib/stufen.ts`, `lib/gates.ts`, `lib/vorlagenKeys.ts`, `texte/de.ts`.

Berechtigungen: `storage`, `sidePanel`, `scripting`, `clipboardWrite`; Hosts nur `https://www.linkedin.com/*` und das
Supabase-Projekt. Der Publishable Key kommt beim Build aus `../.env.production` (öffentlich, RLS schützt die Daten).
Testdaten in `tests/` sind erfunden.
