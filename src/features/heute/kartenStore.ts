// Sitzungszustand je Karte (BAUPLAN § 3.2 „Lokaler State“): offene Platzhalter-Werte, Textsnapshot („Text bearbeiten“),
// gewählte Vorlage (⌘⇧E), „kopiert 09:41“. Lebt außerhalb der Komponente, damit eine Karte beim Ein-/Ausklappen
// (J/K) nichts vergisst und der Peek (M2) dieselben Werte sieht.
import { useEffect } from 'react'
import { create } from 'zustand'

export type KartenZustand = {
  werte: Record<string, string>
  /** „Text bearbeiten“ – gilt nur für diese Karte */
  text: string | null
  bearbeiten: boolean
  /** Vorlage über „ändern ⌘⇧E“ gewechselt */
  vorlageId: string | null
  /** Uhrzeit des letzten Kopierens (Fußzeile, Button-Swap) */
  kopiertUm: string | null
  /** Von der aufgeklappten Karte geschrieben: fertiger Text, offene Platzhalter, wirksame Vorlage – die Tasten lesen hier */
  ergebnis: KartenErgebnis | null
  /** Gate der aufgeklappten Karte (E-Mail-Erlaubnis, Firmensperre, Telefon-Gate): Grund-Text oder `null` = frei.
   *  Die Tasten der Seite (↵ C E ⌘↵) lesen hier, damit sie dieselbe Sperre wie die Buttons haben (H-20). */
  gesperrt: string | null
}

export type KartenErgebnis = {
  text: string
  offen: string[]
  vorlageId: string | null
  vorlageName: string | null
  phase: string | null
}

const LEER: KartenZustand = {
  werte: {},
  text: null,
  bearbeiten: false,
  vorlageId: null,
  kopiertUm: null,
  ergebnis: null,
  gesperrt: null,
}

type Store = {
  karten: Record<string, KartenZustand>
  setze: (key: string, patch: Partial<KartenZustand>) => void
  setzeWert: (key: string, name: string, wert: string) => void
  vergiss: (key: string) => void
}

export const useKartenStore = create<Store>((set) => ({
  karten: {},
  setze: (key, patch) => set((s) => ({ karten: { ...s.karten, [key]: { ...(s.karten[key] ?? LEER), ...patch } } })),
  setzeWert: (key, name, wert) =>
    set((s) => {
      const alt = s.karten[key] ?? LEER
      return { karten: { ...s.karten, [key]: { ...alt, werte: { ...alt.werte, [name]: wert } } } }
    }),
  vergiss: (key) =>
    set((s) => {
      const { [key]: _weg, ...rest } = s.karten
      void _weg
      return { karten: rest }
    }),
}))

export const kartenZustand = (key: string): KartenZustand => useKartenStore.getState().karten[key] ?? LEER

export function useKartenZustand(key: string): KartenZustand {
  return useKartenStore((s) => s.karten[key]) ?? LEER
}

/** Die aufgeklappte Karte meldet ihr Gate (Grund-Text oder `null`), damit ↵/C/E/⌘↵ der Seite dieselbe Sperre haben. */
export function useGateMelden(key: string, grund: string | null): void {
  const setze = useKartenStore((s) => s.setze)
  useEffect(() => {
    setze(key, { gesperrt: grund })
  }, [key, grund, setze])
}
