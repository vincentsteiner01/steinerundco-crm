// Validierte Umgebung (architektur § 2, BAUPLAN § 3.1.6). Wirft beim Start, wenn URL oder Key fehlen.
// Konflikt (Konfliktregel § 0): § 3.1.6 nennt „env.ts (zod)“, E22/F-02 verlangen ≤ 220 kB initiales JS – zod/mini zog trotzdem
// den ganzen zod-Kern (≈ 13 kB gzip) ins initiale Bundle. Drei Prüfungen von Hand erfüllen dieselbe Zusage; zod bleibt für
// Import/Schnellimport (M7) im Routen-Chunk.
export type Env = { VITE_SUPABASE_URL: string; VITE_SUPABASE_KEY: string; VITE_APP_VERSION: string }

const roh: Record<keyof Env, unknown> = {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_KEY: import.meta.env.VITE_SUPABASE_KEY,
  VITE_APP_VERSION: import.meta.env.VITE_APP_VERSION,
}

const istUrl = (v: unknown): v is string => {
  if (typeof v !== 'string') return false
  try {
    const u = new URL(v)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}
const istText = (v: unknown, min: number): v is string => typeof v === 'string' && v.length >= min

const fehlend: string[] = []
if (!istUrl(roh.VITE_SUPABASE_URL)) fehlend.push('VITE_SUPABASE_URL')
if (!istText(roh.VITE_SUPABASE_KEY, 20)) fehlend.push('VITE_SUPABASE_KEY')
if (fehlend.length > 0) throw new Error(`Umgebung unvollständig: ${fehlend.join(', ')} – siehe .env.example`)

export const env: Env = {
  VITE_SUPABASE_URL: roh.VITE_SUPABASE_URL as string,
  VITE_SUPABASE_KEY: roh.VITE_SUPABASE_KEY as string,
  VITE_APP_VERSION: istText(roh.VITE_APP_VERSION, 1) ? roh.VITE_APP_VERSION : 'dev',
}
