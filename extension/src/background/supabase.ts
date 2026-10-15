// Supabase-Client des Service Workers – die einzige Stelle mit Netzwerkzugriff auf das CRM. Sitzung in chrome.storage:
// „Angemeldet bleiben“ an → storage.local (übersteht Neustarts), aus → storage.session (endet mit dem Browser). Wie im CRM.
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { SPEICHER, SUPABASE_KEY, SUPABASE_URL } from '../shared/konfig'

export type Db = ReturnType<typeof createClient<Database, 'crm'>>

async function bleiben(): Promise<boolean> {
  try {
    const r = await chrome.storage.local.get(SPEICHER.bleiben)
    return r[SPEICHER.bleiben] !== 'nein'
  } catch {
    return true
  }
}

async function bereich(): Promise<chrome.storage.StorageArea> {
  return (await bleiben()) ? chrome.storage.local : chrome.storage.session
}

/** Speicher-Adapter für supabase-js (`auth.storage`). Liest beim Lesen beide Bereiche, damit ein Wechsel nichts verliert. */
export const chromeSpeicher = {
  async getItem(key: string): Promise<string | null> {
    const b = await bereich()
    const r = await b.get(key)
    const wert = r[key]
    return typeof wert === 'string' ? wert : null
  },
  async setItem(key: string, value: string): Promise<void> {
    const b = await bereich()
    await b.set({ [key]: value })
  },
  async removeItem(key: string): Promise<void> {
    await Promise.allSettled([chrome.storage.local.remove(key), chrome.storage.session.remove(key)])
  },
}

/** „Angemeldet bleiben“ – vor signInWithPassword setzen, damit die Sitzung im richtigen Bereich landet. */
export async function setzeBleiben(wert: boolean): Promise<void> {
  await chrome.storage.local.set({ [SPEICHER.bleiben]: wert ? 'ja' : 'nein' })
}

export function erstelleDb(): Db {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase-Adresse fehlt im Build (../.env.production).')
  return createClient<Database, 'crm'>(SUPABASE_URL, SUPABASE_KEY, {
    db: { schema: 'crm' },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage: chromeSpeicher,
    },
    global: { headers: { 'x-client-info': 'steinerundco-crm-erweiterung/1' } },
  })
}
