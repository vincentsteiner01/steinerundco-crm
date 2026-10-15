// BAUPLAN § 3.1.8 – useHotkeys, Scopes, Akkorde, VERBOTEN (§ 1.5 Nr. 23).
// Bindungs-Syntax: 'mod+k' · 'alt+n' · 'mod+shift+o' · 'g h' (Akkord, 800 ms) · 'j' · '?' · '/' · 'escape' · 'enter'
// · 'mod+enter' · 'arrowdown' · 'shift+arrowdown' · '+' · 'shift++' · 'ü'. `mod` = ⌘ auf dem Mac, Ctrl sonst.
import { createContext, useContext, useEffect, useRef } from 'react'
import { useUiStore, type Scope } from '@/app/uiStore'

export type { Scope }
export type HotkeyHandler = (e: KeyboardEvent) => void
export type Bindings = Record<string, HotkeyHandler>

export const AKKORD_FENSTER_MS = 800

/** Browser-reservierte Kombinationen (§ 1.5 Nr. 23). Belegung ist ein Lint-Fehler und wirft in DEV. */
export const VERBOTEN: readonly string[] = [
  'mod+n',
  'mod+t',
  'mod+w',
  'mod+q',
  'mod+h',
  'mod+m',
  'mod+l',
  'mod+r',
  'mod+1',
  'mod+2',
  'mod+3',
  'mod+4',
  'mod+5',
  'mod+6',
  'mod+7',
  'mod+8',
  'mod+9',
  'mod+0',
  'mod+shift+n',
  'mod+shift+t',
  'mod+shift+w',
  'mod+shift+a',
  'mod+shift+b',
  'mod+shift+c',
  'mod+shift+d',
  'mod+shift+h',
  'mod+shift+i',
  'mod+shift+j',
  'mod+shift+l',
  'mod+shift+m',
  'mod+shift+r',
  'mod+shift+v',
  'mod+alt+i',
  'mod+alt+j',
  'mod+alt+u',
  'mod+,',
  'mod+shift+,',
]

/** In Eingabefeldern bleiben nur diese Bindungen aktiv. */
const IN_EINGABE_ERLAUBT = new Set(['escape', 'mod+enter', 'mod+shift+enter', 'mod+k'])

export const istMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform ?? '')
export const MOD_LABEL = istMac ? '⌘' : 'Ctrl'

const KEY_ALIAS: Record<string, string> = {
  esc: 'escape',
  return: 'enter',
  '↵': 'enter',
  space: ' ',
  up: 'arrowup',
  down: 'arrowdown',
  left: 'arrowleft',
  right: 'arrowright',
  backspace: 'backspace',
  '⌫': 'backspace',
}

/** Normalisiert eine Bindung: Modifier sortiert (mod, alt, shift), Taste klein. */
export function normalisiere(binding: string): string {
  const akkord = binding.trim().split(/\s+/)
  if (akkord.length > 1) return akkord.map((t) => normalisiere(t)).join(' ')
  const teile = binding.trim().toLowerCase().split('+')
  // 'shift++' → ['shift', '', ''] → Taste '+'
  let key = teile[teile.length - 1] ?? ''
  if (key === '' && binding.endsWith('+')) key = '+'
  const mods = new Set(teile.slice(0, -1).filter(Boolean))
  if (key === '') key = '+'
  key = KEY_ALIAS[key] ?? key
  const out: string[] = []
  if (mods.has('mod') || mods.has('meta') || mods.has('cmd') || mods.has('ctrl')) out.push('mod')
  if (mods.has('alt') || mods.has('option')) out.push('alt')
  if (mods.has('shift')) out.push('shift')
  out.push(key)
  return out.join('+')
}

/** Anzeige-String („⌘⇧O“, „⌥N“, „G H“, „⌘↵“) → Bindung („mod+shift+o“, „alt+n“, „g h“, „mod+enter“). Für den Lint-Test. */
export function anzeigeNachBinding(anzeige: string): string {
  const s = anzeige.trim()
  if (/^[A-Za-zÄÖÜ]( [A-Za-zÄÖÜ])+$/.test(s)) return s.toLowerCase() // Akkord „G H“
  let rest = s
  const mods: string[] = []
  const take = (sym: string, mod: string) => {
    if (rest.startsWith(sym)) {
      mods.push(mod)
      rest = rest.slice(sym.length)
      return true
    }
    return false
  }
  // Reihenfolge beliebig: ⌘⇧, ⇧⌘, Ctrl+…
  let weiter = true
  while (weiter) {
    weiter =
      take('⌘', 'mod') ||
      take('Ctrl+', 'mod') ||
      take('Ctrl', 'mod') ||
      take('⌥', 'alt') ||
      take('Alt+', 'alt') ||
      take('⇧', 'shift') ||
      take('Shift+', 'shift')
  }
  const keyMap: Record<string, string> = {
    '↵': 'enter',
    Enter: 'enter',
    Esc: 'escape',
    '⌫': 'backspace',
    Space: ' ',
    Tab: 'tab',
    '↑': 'arrowup',
    '↓': 'arrowdown',
    '←': 'arrowleft',
    '→': 'arrowright',
  }
  const key = keyMap[rest] ?? rest.toLowerCase()
  const out: string[] = []
  if (mods.includes('mod')) out.push('mod')
  if (mods.includes('alt')) out.push('alt')
  if (mods.includes('shift')) out.push('shift')
  out.push(key)
  return out.join('+')
}

const CODE_KEY: Record<string, string> = {}
for (const c of 'abcdefghijklmnopqrstuvwxyz') CODE_KEY[`Key${c.toUpperCase()}`] = c
for (const d of '0123456789') CODE_KEY[`Digit${d}`] = d

/** Liefert die normalisierte Bindung eines Events (ohne Akkord). */
export function eventNachBinding(e: KeyboardEvent): string {
  // `mod` = ⌘ auf dem Mac, Ctrl sonst – beide werden akzeptiert (Ctrl+K auf dem Mac ist nicht reserviert; die Anzeige folgt der Plattform).
  const mod = e.metaKey || e.ctrlKey
  const out: string[] = []
  if (mod) out.push('mod')
  if (e.altKey) out.push('alt')
  if (e.shiftKey) out.push('shift')
  let key = (e.key ?? '').toLowerCase()
  // ⌥-Kombinationen über event.code (macOS liefert in event.key „˜“, „∫“, „µ“, „®“ oder „Dead“)
  if (e.altKey && CODE_KEY[e.code]) key = CODE_KEY[e.code] as string
  if (mod && CODE_KEY[e.code] && !/^[a-z0-9]$/.test(key)) key = CODE_KEY[e.code] as string
  if (key === ' ') key = ' '
  if (key === 'esc') key = 'escape'
  out.push(key)
  return out.join('+')
}

/** Zeichen, die auf manchen Layouts nur mit Shift erreichbar sind: Shift wird beim Vergleich ignoriert. */
const SHIFT_NEUTRAL = new Set(['?', '/', '+', '*', 'ü', '[', ']', '#', '@', '>'])

function passt(binding: string, e: KeyboardEvent): boolean {
  const ev = eventNachBinding(e)
  if (binding === ev) return true
  const key = binding.split('+').pop() ?? ''
  if (binding === 'shift++') return e.shiftKey && (e.key === '+' || e.key === '*')
  if (SHIFT_NEUTRAL.has(key) && !binding.includes('+', 1)) {
    // Bindung ohne Modifier auf ein Sonderzeichen: nur event.key zählt
    const nurKey = binding
    return e.key?.toLowerCase() === nurKey && !e.metaKey && !e.ctrlKey && !e.altKey
  }
  return false
}

export function istEingabe(el: Element | null): boolean {
  if (!el) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return (el as HTMLElement).isContentEditable === true
}

function scopeAktiv(bindingScope: Scope, aktuell: Scope): boolean {
  if (bindingScope === 'global') return true
  if (bindingScope === 'liste' || bindingScope === 'karte')
    return aktuell === 'liste' || aktuell === 'karte' || aktuell === 'global'
  return bindingScope === aktuell
}

let akkordWartend: { taste: string; bis: number } | null = null

/**
 * Wo eine Bindung lebt: im Lead-Peek (`PeekPanel` setzt `peek`) oder auf der Seite. Karten-Tasten (Scope `karte`) der Seite schweigen,
 * solange ein Peek offen ist – sonst feuerten B/S/N/A/T/W doppelt (Heute-Karte hinter dem Peek + Karte im Peek; Review-Korrektur).
 */
/**
 * `stumm`: Karten-/Listen-Tasten (Scope `karte`/`liste`) im Teilbaum schweigen ganz – die offene Karte auf der Lead-Vollseite
 * (Runde 3) zeigt Text und Knöpfe, ihre Tasten B/S/N/A/W/C/E würden sonst doppelt zu den Seiten-Tasten feuern.
 */
export const TastenBereich = createContext<'seite' | 'peek' | 'stumm'>('seite')

/** „g h“ ist ein Akkord, die Leertaste (`' '`, aus `space`) nicht (FOUNDATION-WUNSCH M1: Space feuerte nie). */
const istAkkord = (k: string): boolean => /\S\s+\S/.test(k)

/**
 * Registriert Tastenbindungen für einen Scope. Guard: Einzelbuchstaben und ⌥-Kombinationen sind in
 * Eingabefeldern inaktiv (Ausnahmen: Esc, ⌘Enter, ⌘K). Akkorde „g h“ mit 800-ms-Fenster.
 */
export function useHotkeys(scope: Scope, bindings: Bindings, deps: readonly unknown[] = []): void {
  const ref = useRef(bindings)
  ref.current = bindings
  const bereich = useContext(TastenBereich)

  useEffect(() => {
    if (import.meta.env.DEV) {
      for (const k of Object.keys(ref.current).map(normalisiere)) {
        if (VERBOTEN.includes(k))
          throw new Error(
            `Tastenkombination „${k}“ ist browser-reserviert (lib/keyboard.ts VERBOTEN, BAUPLAN § 1.5 Nr. 23).`,
          )
      }
    }
    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      // Bindungen je Event aus dem letzten Render lesen – Handler sehen immer den aktuellen Zustand (FOUNDATION-WUNSCH M5).
      const normiert = Object.entries(ref.current).map(([k, fn]) => [normalisiere(k), fn] as const)
      const aktuell = useUiStore.getState().hotkeyScope
      if (!scopeAktiv(scope, aktuell)) return
      if (scope === 'karte' && bereich === 'seite' && useUiStore.getState().peekLeadId) return
      if (bereich === 'stumm' && (scope === 'karte' || scope === 'liste')) return
      const inEingabe = istEingabe(document.activeElement)
      const ev = eventNachBinding(e)
      const jetzt = Date.now()

      // Akkord-Abschluss
      if (akkordWartend && akkordWartend.bis >= jetzt && !inEingabe && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const voll = `${akkordWartend.taste} ${ev}`
        const treffer = normiert.find(([k]) => k === voll)
        if (treffer) {
          akkordWartend = null
          if (aktuell === 'anruf') return // G-Akkorde im Anruf-Screen aus
          e.preventDefault()
          treffer[1](e)
          return
        }
      }
      if (akkordWartend && akkordWartend.bis < jetzt) akkordWartend = null

      for (const [k, fn] of normiert) {
        if (istAkkord(k)) {
          // Akkord-Start
          const [erste] = k.split(' ')
          if (erste === ev && !inEingabe && !e.metaKey && !e.ctrlKey && !e.altKey) {
            if (aktuell === 'anruf') return
            akkordWartend = { taste: ev, bis: jetzt + AKKORD_FENSTER_MS }
            e.preventDefault()
            return
          }
          continue
        }
        if (!passt(k, e)) continue
        if (inEingabe && !IN_EINGABE_ERLAUBT.has(k)) return
        if (k.startsWith('alt+') || k.startsWith('mod+') || k === '?' || k === '/' || k.startsWith('shift+arrow'))
          e.preventDefault()
        // Esc in einem Feld: erst verlassen (Blur), dann der Handler. Felder, die Esc selbst verwerfen (Stepper), rufen
        // `preventDefault` im eigenen onKeyDown – dann kommt das Event hier gar nicht an (siehe oben).
        if (k === 'escape' && inEingabe) {
          ;(document.activeElement as HTMLElement | null)?.blur?.()
        }
        fn(e)
        return
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, bereich, ...deps])
}

/** Setzt den aktiven Scope für die Lebensdauer der Komponente (Anruf-Screen: 'anruf', Formulare: 'formular'). */
export function useHotkeyScope(scope: Scope): void {
  const push = useUiStore((s) => s.pushScope)
  const pop = useUiStore((s) => s.popScope)
  useEffect(() => {
    push(scope)
    return () => pop(scope)
  }, [scope, push, pop])
}

/** Nur für Tests: Akkord-Zustand zurücksetzen. */
export function _akkordZuruecksetzen(): void {
  akkordWartend = null
}
