# Tasten-Prüfung (F-08, BAUPLAN § 1.5 Nr. 23)

Jede `⌘`-/`⌥`-Kombination aus allen `tasten.ts` wird in Chrome **und** Safari (macOS, aktuelle Versionen) manuell geprüft: Die Seite erhält `keydown`, `preventDefault` wirkt, kein Browser-Menü öffnet sich, kein Sonderzeichen landet im Feld.

| Kombination | Bedeutung                          | Chrome (Version · Datum · ok?) | Safari (Version · Datum · ok?) |
| ----------- | ---------------------------------- | ------------------------------ | ------------------------------ |
| ⌘K          | Palette                            |                                |                                |
| ⌥N          | Lead anlegen                       |                                |                                |
| ⌘⇧O         | Schnellimport                      |                                |                                |
| ⌥B          | Bulk-Menü                          |                                |                                |
| ⌥M          | E-Mail verfassen                   |                                |                                |
| ⌥R          | Liste neu sortieren                |                                |                                |
| ⌥1–9 · ⌥0   | Batch-Chips                        |                                |                                |
| ⌘⇧E         | Vorlage wechseln                   |                                |                                |
| ⌘⇧K         | Anrufen                            |                                |                                |
| ⌘⇧U         | Übergeben                          |                                |                                |
| ⌘⇧F         | Freigeben                          |                                |                                |
| ⌘⇧X         | Überspringen                       |                                |                                |
| ⌘↵ · ⌘⇧↵    | Speichern · Speichern und nächsten |                                |                                |
| ⌘A          | Alle auswählen (Scope liste)       |                                |                                |

Verboten (dürfen nirgends belegt sein, `lib/keyboard.ts` `VERBOTEN`): ⌘N ⌘T ⌘W ⌘Q ⌘H ⌘M ⌘L ⌘R ⌘0–9 ⌘⇧N ⌘⇧T ⌘⇧W ⌘⇧A ⌘⇧B ⌘⇧C ⌘⇧D ⌘⇧H ⌘⇧I ⌘⇧J ⌘⇧L ⌘⇧M ⌘⇧R ⌘⇧V ⌘⌥I ⌘⌥J ⌘⌥U ⌘, ⌘⇧, – der Lint-Test `keyboard.verboten.test.ts` prüft das automatisch.
