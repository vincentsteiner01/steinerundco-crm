// Verschieben und Entfernen mit „Rückgängig“ (25.11.2026). Der Toast erscheint erst, wenn die Datenbank zugestimmt hat –
// scheitert der Zug, rollt die Daten-Schicht die Karte zurück und zeigt den Fehler. „Rückgängig“ stellt Liste UND Zeitstempel
// wieder her (`board_seit`), damit die Karte an ihrer alten Stelle liegt und nicht oben einsortiert wird.
import { useCallback } from 'react'
import { toastUndo } from '@/components/toast'
import { useKarteVerschieben } from '@/data/board'
import { listenTitel, type BoardListe } from './listen'

/** Wo die Karte vor dem Zug lag – mehr braucht „Rückgängig“ nicht. */
export type KartenStand = { id: string; board_liste: BoardListe | null; board_seit: string | null }

export function useKartenAktionen() {
  const { mutateAsync } = useKarteVerschieben()

  const lege = useCallback(
    (karte: KartenStand, ziel: BoardListe | null, text: string) => {
      const alt = { id: karte.id, liste: karte.board_liste, seit: karte.board_seit }
      const zurueck = () =>
        mutateAsync(alt).then(
          () => {},
          () => {},
        )
      void mutateAsync({ id: karte.id, liste: ziel }).then(
        () => void toastUndo(text, zurueck),
        () => {}, // Fehlermeldung und Zurückrollen: useKarteVerschieben
      )
    },
    [mutateAsync],
  )

  /** Karte in eine andere Liste legen (Knopf oder Ziehen). Gleiche Liste = nichts. */
  const verschiebe = useCallback(
    (karte: KartenStand, ziel: BoardListe) => {
      if (karte.board_liste === ziel) return
      // kurz genug für eine Zeile im Toast (360 px) neben „Rückgängig“ – auch beim längsten Titel „Gespräch vereinbart“
      lege(karte, ziel, `Jetzt in „${listenTitel(ziel)}“.`)
    },
    [lege],
  )

  /** Karte vom Board nehmen – der Lead bleibt gespeichert, nichts wird gelöscht. */
  const entferne = useCallback((karte: KartenStand) => lege(karte, null, 'Karte entfernt.'), [lege])

  return { verschiebe, entferne }
}
