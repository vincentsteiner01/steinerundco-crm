// Verbindungen → „Chrome-Erweiterung“: was sie tut und nie tut, Installation (Vincent aus dem Repository, Mike aus der ZIP),
// Tastenkürzel ⌥C, Version 1.1.0. Inhalt aus extension/README.md als UI-Text. chrome://-Adressen lassen sich aus einer
// Webseite nicht öffnen – deshalb ein Kopier-Knopf statt eines Links.
import { Kbd } from '@/components/ui'
import { useAndere, useMe } from '@/data'
import { anzeigeName, personSlug } from '@/lib/mitglied'
import {
  CHROME_ERWEITERUNGEN,
  ERWEITERUNG_KUERZEL,
  ERWEITERUNG_ORDNER,
  ERWEITERUNG_VERSION,
  ERWEITERUNG_ZIP,
} from './konstanten'
import { Abschnitt, Code, KopierKnopf, Schritt, Text } from './Teile'

const TUT = [
  'Zeigt neben LinkedIn in Chromes Seitenleiste, wer die Person im CRM ist, und die nächste vorbereitete Nachricht mit gefüllten Platzhaltern.',
  'Kopieren, Gesendet, Angenommen, Anfrage gesendet, Antwort erhalten, Notiz – ein Klick, und es steht im CRM.',
  'In einer Unterhaltung füllt sie „Antwort erhalten“ mit der letzten Nachricht der anderen Person. Kam die Antwort schon über die Mail, trägst du nur die Reaktion nach.',
  'Nicht im CRM: ähnliche Namen zum Verknüpfen oder „Als Lead anlegen“ mit vorbefülltem Formular.',
]

const NIE = [
  'Sie klickt, tippt, sendet und navigiert nie auf LinkedIn – Nachrichten und Anfragen schickst du selbst.',
  'Sie liest nur die Seite, die du gerade ansiehst, und nur, solange die Seitenleiste offen ist.',
  'Sie lädt keine weiteren LinkedIn-Seiten, scrollt nicht und fügt nichts in LinkedIn ein.',
  'Sie speichert keine Lead-Daten im Browser – nur deine Anmeldung.',
]

export function ErweiterungAbschnitt() {
  const me = useMe()
  const andere = useAndere()
  const ichBinMike = personSlug(me) === 'mike'
  const mike = anzeigeName(ichBinMike ? me : andere, 'Mike')
  const vincent = anzeigeName(ichBinMike ? andere : me, 'Vincent')

  return (
    <Abschnitt
      id="verbindungen-erweiterung"
      titel="Chrome-Erweiterung"
      beschreibung={
        <>
          Version <span className="mono">{ERWEITERUNG_VERSION}</span> · Seitenleiste öffnen mit{' '}
          <Kbd>{ERWEITERUNG_KUERZEL}</Kbd> · in der Leiste wirken <Kbd>C</Kbd> <Kbd>E</Kbd> <Kbd>A</Kbd> <Kbd>N</Kbd>{' '}
          <Kbd>O</Kbd> wie im CRM.
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2 sm:gap-6">
        <div className="grid content-start gap-2">
          <span className="label">Was sie tut</span>
          <ul className="text-table text-ink-2 grid list-disc gap-1.5 pl-4 leading-[1.5]">
            {TUT.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
        <div className="grid content-start gap-2">
          <span className="label">Was sie nie tut</span>
          <ul className="text-table text-ink-2 grid list-disc gap-1.5 pl-4 leading-[1.5]">
            {NIE.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      </div>

      <ol className="grid" aria-label="Installieren">
        <Schritt nr={1} titel="Ordner bekommen">
          <Text>
            {vincent}: im Repository <Code>cd extension &amp;&amp; npm run build</Code> – danach liegt alles im Ordner{' '}
            <Code>{ERWEITERUNG_ORDNER}</Code>.
          </Text>
          <Text>
            {mike}: die Datei <Code>{ERWEITERUNG_ZIP}</Code> von {vincent} entpacken, zum Beispiel nach „Dokumente“. Der
            Ordner muss dort liegen bleiben.
          </Text>
        </Schritt>
        <Schritt nr={2} titel="Erweiterungen in Chrome öffnen">
          <Text>
            In die Adresszeile <Code>{CHROME_ERWEITERUNGEN}</Code> eingeben und oben rechts den „Entwicklermodus“
            einschalten.
          </Text>
          <div>
            <KopierKnopf text={CHROME_ERWEITERUNGEN} groesse="S">
              Adresse kopieren
            </KopierKnopf>
          </div>
        </Schritt>
        <Schritt nr={3} titel="„Entpackte Erweiterung laden“">
          <Text>
            Den Ordner <Code>{ERWEITERUNG_ORDNER}</Code> wählen ({mike}: den entpackten Ordner). Dann über das
            Puzzle-Symbol „Steiner &amp; Co. CRM für LinkedIn“ anheften.
          </Text>
        </Schritt>
        <Schritt nr={4} titel="Anmelden">
          <Text>
            Auf das S&amp;-Symbol klicken, Person wählen, denselben Passcode wie im CRM eingeben. Dann{' '}
            <Kbd>{ERWEITERUNG_KUERZEL}</Kbd> auf einer LinkedIn-Seite.
          </Text>
        </Schritt>
      </ol>
      <Text klein>
        Updates: nach einem neuen Build in {CHROME_ERWEITERUNGEN} beim Eintrag auf den Kreispfeil „Neu laden“ klicken (
        {mike}: vorher den Ordnerinhalt durch die neue ZIP ersetzen). Offene Seitenleisten einmal schließen und wieder
        öffnen.
      </Text>
    </Abschnitt>
  )
}
