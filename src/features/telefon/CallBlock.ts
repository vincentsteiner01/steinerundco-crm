// M3 – Call-Block-Session (BAUPLAN § 3.4 CallBlock.ts): localStorage['crm.callblock'] = { id, start, listeIds[], position, uebersprungen[] }.
// Timer „Block 00:42 / 2:00“, Hinweis nach 2 h (ux § 2.5 Schritt 4). Kein Server-Zustand: die Zusammenfassung kommt aus
// `useCallsSession(sessionKey(me, start))` (alle eigenen Anrufe seit Block-Start).
import { useSyncExternalStore } from 'react'
import { fmtDauer } from '@/lib/format'
import { lokalEntfernen, neueId } from './lokal'

export const BLOCK_KEY = 'crm.callblock'
export const BLOCK_DAUER_SEC = 2 * 60 * 60
const EVENT = 'crm:callblock'

export type CallBlockSession = {
  id: string
  /** ISO-Zeitpunkt des Starts (= Session-Key für `useCallsSession`) */
  start: string
  listeIds: string[]
  /** Index des aktuellen Leads in `listeIds` */
  position: number
  uebersprungen: string[]
  hinweisGezeigt?: boolean
}

function istSession(x: unknown): x is CallBlockSession {
  if (!x || typeof x !== 'object') return false
  const s = x as Record<string, unknown>
  return (
    typeof s.id === 'string' &&
    typeof s.start === 'string' &&
    Array.isArray(s.listeIds) &&
    typeof s.position === 'number' &&
    Array.isArray(s.uebersprungen)
  )
}

let cache: { roh: string | null; wert: CallBlockSession | null } = { roh: null, wert: null }

/** Liest die Session; liefert bei unverändertem Inhalt dieselbe Referenz (useSyncExternalStore). */
export function blockLesen(): CallBlockSession | null {
  let roh: string | null = null
  try {
    roh = localStorage.getItem(BLOCK_KEY)
  } catch {
    roh = null
  }
  if (roh === cache.roh) return cache.wert
  let wert: CallBlockSession | null = null
  try {
    const p: unknown = roh ? JSON.parse(roh) : null
    wert = istSession(p) ? p : null
  } catch {
    wert = null
  }
  cache = { roh, wert }
  return wert
}

function melden(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT))
}

export function blockSpeichern(s: CallBlockSession): CallBlockSession {
  try {
    localStorage.setItem(BLOCK_KEY, JSON.stringify(s))
  } catch {
    cache = { roh: `mem:${Date.now()}`, wert: s }
  }
  melden()
  return s
}

export function blockStarten(listeIds: string[], jetzt: Date = new Date()): CallBlockSession {
  return blockSpeichern({
    id: neueId(),
    start: jetzt.toISOString(),
    listeIds: [...listeIds],
    position: 0,
    uebersprungen: [],
  })
}

export function blockBeenden(): void {
  lokalEntfernen(BLOCK_KEY)
  melden()
}

export function blockAktuellerLead(s: CallBlockSession): string | null {
  return s.listeIds[s.position] ?? null
}

/** Position auf einen Lead setzen (der Anruf-Screen wurde für ihn geöffnet). */
export function blockPositionSetzen(s: CallBlockSession, leadId: string): CallBlockSession {
  const i = s.listeIds.indexOf(leadId)
  if (i < 0 || i === s.position) return s
  return blockSpeichern({ ...s, position: i })
}

/** Nächster Lead nach `leadId` (bzw. nach der aktuellen Position); `null` = Liste erschöpft. */
export function blockNaechster(s: CallBlockSession, leadId?: string | null): string | null {
  const i = leadId ? s.listeIds.indexOf(leadId) : s.position
  const start = i < 0 ? s.position : i
  return s.listeIds[start + 1] ?? null
}

/** `⌘⇧X`: Lead ans Listenende, kein Versuch. Liefert die neue Session und den nun fälligen Lead (`null` = nur dieser war übrig). */
export function blockUeberspringen(
  s: CallBlockSession,
  leadId: string,
): { session: CallBlockSession; naechster: string | null } {
  const i = s.listeIds.indexOf(leadId)
  if (i < 0) return { session: s, naechster: blockNaechster(s) }
  const ohne = s.listeIds.filter((id) => id !== leadId)
  const listeIds = [...ohne, leadId]
  const uebersprungen = s.uebersprungen.includes(leadId) ? s.uebersprungen : [...s.uebersprungen, leadId]
  const naechster = ohne[i] ?? null
  const position = naechster ? i : listeIds.length - 1
  return { session: blockSpeichern({ ...s, listeIds, uebersprungen, position }), naechster }
}

export function blockFortschritt(s: CallBlockSession, leadId?: string | null): { nummer: number; gesamt: number } {
  const i = leadId ? s.listeIds.indexOf(leadId) : -1
  return { nummer: (i >= 0 ? i : s.position) + 1, gesamt: s.listeIds.length }
}

export function blockDauerSec(s: CallBlockSession, jetzt: Date = new Date()): number {
  return Math.max(0, Math.floor((jetzt.getTime() - new Date(s.start).getTime()) / 1000))
}

/** „Block 00:42 / 2:00“ */
export function blockZeit(sec: number): string {
  return `${fmtDauer(sec)} / 2:00`
}

/** Nach 2 h einmal fragen: „2 Stunden – weitermachen oder beenden?“ */
export function blockHinweisFaellig(s: CallBlockSession, jetzt: Date = new Date()): boolean {
  return !s.hinweisGezeigt && blockDauerSec(s, jetzt) >= BLOCK_DAUER_SEC
}

export function blockHinweisGezeigt(s: CallBlockSession): CallBlockSession {
  return blockSpeichern({ ...s, hinweisGezeigt: true })
}

function abonnieren(cb: () => void): () => void {
  window.addEventListener(EVENT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}

/** Reaktiver Zugriff auf die laufende Session (auch über Tabs hinweg). */
export function useCallBlock(): CallBlockSession | null {
  return useSyncExternalStore(abonnieren, blockLesen, () => null)
}

/** Nur für Tests. */
export function _blockCacheZuruecksetzen(): void {
  cache = { roh: null, wert: null }
}
