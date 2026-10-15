import { PFADE } from './pfade'

/** Routen, auf denen `?lead=` den Kontext eines eigenen Sheets meint (Composer) – dort kein zweiter Peek darunter. */
const OHNE_PEEK = new Set<string>([PFADE.emailVerfassen])

/** Lead des Peeks aus `?lead=` – `null` auf Routen, die `lead` selbst verwenden (Runde 2: Composer + Peek doppelt offen). */
export function peekLeadId(pathname: string, params: URLSearchParams): string | null {
  if (OHNE_PEEK.has(pathname)) return null
  return params.get('lead')
}
