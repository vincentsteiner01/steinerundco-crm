// architektur § 3.2 (createClient-Optionen gelten wörtlich) + BAUPLAN § 1.5 Nr. 39 (delegierender Storage-Adapter).
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { env } from '@/data/env'

export const BLEIBEN_KEY = 'crm.bleiben'

/** In-Memory-Fallback, wenn Web Storage wirft (Private Mode, blockierte Site-Daten). */
const memory = new Map<string, string>()
const memoryStorage: Storage = {
  get length() {
    return memory.size
  },
  clear: () => memory.clear(),
  getItem: (k) => memory.get(k) ?? null,
  key: (i) => [...memory.keys()][i] ?? null,
  removeItem: (k) => void memory.delete(k),
  setItem: (k, v) => void memory.set(k, String(v)),
}

function safeGet(key: string): string | null {
  try {
    return globalThis.localStorage.getItem(key)
  } catch {
    return null
  }
}

/** Speicherort der Session: localStorage, außer „Angemeldet bleiben“ ist aus (crm.bleiben = 'nein') → sessionStorage. */
export function speicher(): Storage {
  try {
    const bleiben = safeGet(BLEIBEN_KEY)
    const s = bleiben === 'nein' ? globalThis.sessionStorage : globalThis.localStorage
    // Zugriff testen – wirft in manchen Privat-Modi
    s.getItem('__probe__')
    return s
  } catch {
    return memoryStorage
  }
}

/** Delegierender Adapter für supabase-js `auth.storage` – jeder Zugriff in try/catch, Fallback In-Memory. */
export const bleibenStorage = {
  getItem: (k: string): string | null => {
    try {
      return speicher().getItem(k)
    } catch {
      return memoryStorage.getItem(k)
    }
  },
  setItem: (k: string, v: string): void => {
    try {
      speicher().setItem(k, v)
    } catch {
      memoryStorage.setItem(k, v)
    }
  },
  removeItem: (k: string): void => {
    try {
      speicher().removeItem(k)
    } catch {
      memoryStorage.removeItem(k)
    }
  },
}

/** Schreibt die Checkbox-Entscheidung – vor `signInWithPassword` aufrufen. */
export function setzeBleiben(bleiben: boolean): void {
  try {
    globalThis.localStorage.setItem(BLEIBEN_KEY, bleiben ? 'ja' : 'nein')
  } catch {
    /* ohne Storage: Session landet im In-Memory-Fallback */
  }
}
export function liesBleiben(): boolean {
  return safeGet(BLEIBEN_KEY) !== 'nein'
}

export const supabase = createClient<Database, 'crm'>(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_KEY, {
  db: { schema: 'crm' }, // Standard-Schema aller .from()/.rpc()
  auth: {
    persistSession: true,
    autoRefreshToken: true, // Access-Token 1 h, Refresh im Hintergrund
    detectSessionInUrl: false, // keine Magic-Link-Rücksprünge im CRM
    flowType: 'pkce',
    storage: bleibenStorage,
  },
  realtime: { params: { eventsPerSecond: 10 } },
  global: { headers: { 'x-client-info': `steinerundco-crm/${env.VITE_APP_VERSION}` } },
})

// public.members liegt im Schema public:
export const members = () => supabase.schema('public').from('members')
