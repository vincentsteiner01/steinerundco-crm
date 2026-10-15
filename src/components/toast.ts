// Toasts (DESIGN-SYSTEM § 5.21, BAUPLAN § 3.1.10): sonner mit eigenen Klassen (base.css .toast-brand).
// Varianten: neutral · undo (2-px-Sage-Rand, 6 s, „Rückgängig Z“) · error (2-px-danger-Rand, bleibt bis R/Esc) · realtime (Avatar, Klick öffnet Lead).
// Die Ausführung von Rückgängig gehört der Daten-Schicht: src/data/undo.ts registriert sie über `registriereUndo(fn)`.
import { createElement, type ReactElement, type ReactNode } from 'react'
import { toast as sonner } from 'sonner'
import { useUiStore } from '@/app/uiStore'
import { Avatar, type AvatarMember } from '@/components/ui/Avatar'

export const UNDO_MS = 6000
export const TOAST_MS = 4000

/**
 * Was „Rückgängig“ zurücknimmt: eine Activity-ID (Standard, `undo_activity`), ein Stapel von IDs (Bulk, LE-08) oder eine
 * eigene Aktion (z. B. `undo_import`, M7). Integration M1–M8 (FOUNDATION-WUNSCH M2/M7): vorher zwei Nachbauten des Toasts.
 */
export type UndoZiel = number | readonly number[] | (() => Promise<void> | void)
type UndoAusfuehrer = (activityIds: number | readonly number[]) => Promise<void> | void
let undoAusfuehrer: UndoAusfuehrer | null = null
/** Stapel/Aktionen hinter einer negativen Marke in `uiStore.letzterUndo.activityId`. */
const undoZiele = new Map<number, Exclude<UndoZiel, number>>()
let marke = 0
let letzterRetry: (() => void) | null = null
let fehlerToastId: string | number | null = null

/** Von src/data/undo.ts aufgerufen: verbindet den Toast mit `rpc.undoActivity`. */
export function registriereUndo(fn: UndoAusfuehrer): void {
  undoAusfuehrer = fn
}

function knopf(
  label: string,
  kbd: string,
  onClick: () => void,
  ton: 'secondary' | 'quiet' = 'secondary',
): ReactElement {
  return createElement(
    'button',
    {
      type: 'button',
      onClick,
      className:
        'toast-aktion inline-flex h-7 items-center gap-2 rounded-sm border px-2.5 text-small font-medium leading-none transition-[background] duration-[var(--t-1)] ease-brand hover:bg-surface-hover ' +
        (ton === 'secondary' ? 'border-line-strong text-ink' : 'border-transparent text-ink-2'),
    },
    label,
    createElement('kbd', { className: 'kbd' }, kbd),
  )
}

function karte(
  variante: 'neutral' | 'undo' | 'error' | 'realtime',
  text: ReactNode,
  aktion?: ReactNode,
  links?: ReactNode,
): ReactElement {
  return createElement(
    'div',
    { className: 'toast-brand', 'data-variante': variante, role: variante === 'error' ? 'alert' : 'status' },
    links ?? null,
    createElement('span', { className: 'toast-text' }, text),
    aktion ?? null,
  )
}

/** Neutraler Toast: „Kopiert.“ – 4 s, kein Icon, keine Farbe. */
export function toast(text: string): string | number {
  return sonner.custom(() => karte('neutral', text), { duration: TOAST_MS })
}

/**
 * Rückgängig-Toast (6 s): `Z` oder Klick ruft den registrierten Ausführer mit der Activity-ID (bzw. dem Stapel) oder die
 * übergebene Aktion. Ein leerer Stapel zeigt nur den neutralen Toast.
 */
export function toastUndo(text: string, ziel: UndoZiel): string | number {
  if (Array.isArray(ziel) && ziel.length === 0) return toast(text)
  const { setLetzterUndo } = useUiStore.getState()
  const activityId = typeof ziel === 'number' ? ziel : -++marke
  if (typeof ziel !== 'number') undoZiele.set(activityId, ziel as Exclude<UndoZiel, number>)
  setLetzterUndo({ activityId, label: text })
  let id: string | number = 0
  const ausfuehren = () => {
    void undoAusfuehren()
    sonner.dismiss(id)
  }
  id = sonner.custom(() => karte('undo', text, knopf('Rückgängig', 'Z', ausfuehren)), {
    duration: UNDO_MS,
    onAutoClose: () => {
      const s = useUiStore.getState()
      if (s.letzterUndo?.activityId === activityId) s.setLetzterUndo(null)
      undoZiele.delete(activityId)
    },
    onDismiss: () => {
      const s = useUiStore.getState()
      if (s.letzterUndo?.activityId === activityId) s.setLetzterUndo(null)
      undoZiele.delete(activityId)
    },
  })
  return id
}

/** Führt das letzte angebotene Rückgängig aus (`Z` global). */
export async function undoAusfuehren(): Promise<boolean> {
  const s = useUiStore.getState()
  const u = s.letzterUndo
  if (!u) return false
  const ziel = undoZiele.get(u.activityId)
  if (typeof ziel === 'function') {
    undoZiele.delete(u.activityId)
    s.setLetzterUndo(null)
    await ziel()
    return true
  }
  if (!undoAusfuehrer) return false
  undoZiele.delete(u.activityId)
  s.setLetzterUndo(null)
  await undoAusfuehrer(ziel ?? u.activityId)
  return true
}

/** Fehler-Toast: bleibt bis `R` (Retry) oder `Esc`. */
export function toastFehler(text: string, retry?: () => void): string | number {
  letzterRetry = retry ?? null
  const aktion = retry
    ? knopf('Erneut versuchen', 'R', () => {
        void retryAusfuehren()
      })
    : knopf('Schließen', 'Esc', () => fehlerSchliessen(), 'quiet')
  fehlerToastId = sonner.custom(() => karte('error', text, aktion), { duration: Infinity })
  return fehlerToastId
}

export function retryAusfuehren(): boolean {
  if (!letzterRetry) return false
  const fn = letzterRetry
  fehlerSchliessen()
  fn()
  return true
}
export function fehlerSchliessen(): boolean {
  if (fehlerToastId === null) return false
  sonner.dismiss(fehlerToastId)
  fehlerToastId = null
  letzterRetry = null
  return true
}
export const hatFehlerToast = (): boolean => fehlerToastId !== null

/** Realtime-Toast (max. 2): Avatar 22 px links, Klick öffnet den Lead im Peek (Event `crm:peek`, PeekOutlet hört zu). */
export function toastRealtime(text: string, member: AvatarMember | null, leadId: string): string | number {
  let id: string | number = 0
  const oeffnen = () => {
    window.dispatchEvent(new CustomEvent('crm:peek', { detail: { leadId } }))
    sonner.dismiss(id)
  }
  id = sonner.custom(
    () =>
      createElement(
        'button',
        { type: 'button', onClick: oeffnen, className: 'text-left', 'aria-label': `${text} – Lead öffnen` },
        karte('realtime', text, null, createElement(Avatar, { member, groesse: 22 })),
      ),
    { duration: UNDO_MS },
  )
  return id
}

export { sonner as sonnerToast }
