// BAUPLAN § 3.1.5 – globaler UI-Zustand (zustand). Keine Daten, nur Oberfläche.
import { create } from 'zustand'

export type Scope = 'global' | 'liste' | 'karte' | 'anruf' | 'formular'

export type UiState = {
  realtime: 'live' | 'getrennt'
  online: boolean
  peekLeadId: string | null
  peekListe: string[]
  hotkeyScope: Scope
  scopeStack: Scope[]
  letzterUndo: { activityId: number; label: string } | null
  personAnsicht: string | null
  paletteOffen: boolean
  hilfeOffen: boolean
  setRealtime: (r: 'live' | 'getrennt') => void
  setOnline: (o: boolean) => void
  setPeek: (leadId: string | null, liste?: string[]) => void
  setPeekListe: (ids: string[]) => void
  pushScope: (s: Scope) => void
  popScope: (s: Scope) => void
  setLetzterUndo: (u: { activityId: number; label: string } | null) => void
  setPersonAnsicht: (m: string | null) => void
  setPaletteOffen: (o: boolean) => void
  setHilfeOffen: (o: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  realtime: 'getrennt',
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  peekLeadId: null,
  peekListe: [],
  hotkeyScope: 'global',
  scopeStack: [],
  letzterUndo: null,
  personAnsicht: null,
  paletteOffen: false,
  hilfeOffen: false,
  setRealtime: (realtime) => set({ realtime }),
  setOnline: (online) => set({ online }),
  setPeek: (peekLeadId, liste) => set((s) => ({ peekLeadId, peekListe: liste ?? s.peekListe })),
  setPeekListe: (peekListe) => set({ peekListe }),
  pushScope: (scope) =>
    set((s) => {
      const scopeStack = [...s.scopeStack, scope]
      return { scopeStack, hotkeyScope: scope }
    }),
  popScope: (scope) =>
    set((s) => {
      const i = s.scopeStack.lastIndexOf(scope)
      const scopeStack = i < 0 ? s.scopeStack : [...s.scopeStack.slice(0, i), ...s.scopeStack.slice(i + 1)]
      return { scopeStack, hotkeyScope: scopeStack[scopeStack.length - 1] ?? 'global' }
    }),
  setLetzterUndo: (letzterUndo) => set({ letzterUndo }),
  setPersonAnsicht: (personAnsicht) => set({ personAnsicht }),
  setPaletteOffen: (paletteOffen) => set({ paletteOffen }),
  setHilfeOffen: (hilfeOffen) => set({ hilfeOffen }),
}))
