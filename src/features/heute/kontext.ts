// Seiten-Kontext für die Karten (BAUPLAN § 3.2 „Lokaler State“): fällige Zahl für Toasts, Schritt-Infos, Markierung eigener
// Mutationen (Realtime-Unterscheidung), Rückmeldung „erledigt“ an die Seite (Erledigt-Zeile an derselben Position, H-06).
// Ohne Provider (Peek, M2) gelten stille Standardwerte – die Karte funktioniert trotzdem.
import { createContext, useContext } from 'react'
import { heuteBerlin } from '@/lib/format'
import type { AktionenKontext } from './useQueueAktionen'

export const HeuteKontext = createContext<AktionenKontext | null>(null)

const STANDARD: AktionenKontext = {
  heute: heuteBerlin(),
  offen: () => 0,
  schritt: () => null,
  markiereEigen: () => {},
  onErledigt: () => {},
  onAbgehakt: () => {},
  istNeu: () => false,
}

export function useHeuteKontext(): AktionenKontext {
  return useContext(HeuteKontext) ?? { ...STANDARD, heute: heuteBerlin() }
}

/**
 * Karte eingebettet im Peek (NaechsterSchritt): Name und Firma stehen schon im Panelkopf, das Panel ist selbst die Fläche –
 * ohne Namenszeile, ohne eigenen Rahmen (keine Box in der Box), Label ohne „seit n T“ (steht als Zeit-Chip daneben). Runde 2.
 */
export const KarteEingebettet = createContext(false)
