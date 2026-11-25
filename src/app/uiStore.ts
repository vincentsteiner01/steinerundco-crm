// BAUPLAN § 3.1.5 – globaler UI-Zustand (zustand). Keine Daten, nur Oberfläche.
// Neustart 25.11.2026: Palette, Tastenliste, Personen-Ansicht und die Peek-Felder sind raus (das Lead-Blatt hängt an `?lead=`).
import { create } from 'zustand'

export type Scope = 'global' | 'liste' | 'karte' | 'anruf' | 'formular'

export type UiState = {
  realtime: 'live' | 'getrennt'
  online: boolean
  hotkeyScope: Scope
  scopeStack: Scope[]
  letzterUndo: { activityId: number; label: string } | null
  setRealtime: (r: 'live' | 'getrennt') => void
  setOnline: (o: boolean) => void
  pushScope: (s: Scope) => void
  popScope: (s: Scope) => void
  setLetzterUndo: (u: { activityId: number; label: string } | null) => void
}

export const useUiStore = create<UiState>((set) => ({
  realtime: 'getrennt',
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  hotkeyScope: 'global',
  scopeStack: [],
  letzterUndo: null,
  setRealtime: (realtime) => set({ realtime }),
  setOnline: (online) => set({ online }),
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
}))
