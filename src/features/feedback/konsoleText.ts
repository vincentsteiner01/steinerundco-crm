// Konsolen-Einträge für eine Meldung: Roh-Puffer aus lib/konsole lesbar machen (wie die Konsole formatiert) und alles
// entfernen, was nach Zugangsdaten aussieht – JWTs, Supabase-Schlüssel, Bearer-Tokens, `token=`/`passcode:`-Werte,
// lange Geheimnis-Ketten. Liegt im Feedback-Chunk, nicht im initialen Bundle.
import { konsolenRoh, type KonsolenArt } from '@/lib/konsole'

export type KonsolenEintrag = { zeit: string; art: KonsolenArt; text: string }
const TEXT_MAX = 1000

/** Entfernt Zugangsdaten aus einem Text. UUIDs, Pfade und normale Sätze bleiben stehen. */
export function bereinige(text: string): string {
  return text
    .replace(/eyJ[\w-]{6,}\.[\w-]{6,}\.[\w-]*/g, '[JWT]')
    .replace(/\bsb_(?:publishable|secret)_[\w-]+/g, '[Schlüssel]')
    .replace(/(bearer\s+)[\w.~+/=-]+/gi, '$1[Token]')
    .replace(
      /((?:access_token|refresh_token|provider_token|apikey|api_key|password|passwort|passcode|secret|token)["']?\s*[:=]\s*["']?)[^"'&\s,;}]+/gi,
      '$1[entfernt]',
    )
    .replace(/[A-Za-z0-9+/_-]{40,}={0,2}/g, (s) => (/\d/.test(s) && /[A-Za-z]/.test(s) ? '[entfernt]' : s))
}

function wert(a: unknown): string {
  if (typeof a === 'string') return a
  if (a instanceof Error) {
    const stapel = (a.stack ?? '').split('\n').slice(1, 6).join('\n')
    return `${a.name}: ${a.message}${stapel ? `\n${stapel}` : ''}`
  }
  try {
    return JSON.stringify(a) ?? String(a)
  } catch {
    return String(a)
  }
}

/** Wie die Konsole formatiert: `%s %d %o …` werden der Reihe nach ersetzt, der Rest mit Leerzeichen angehängt; `%c` fällt weg. */
export function formatiere(args: readonly unknown[]): string {
  const rest = [...args]
  let kopf = ''
  if (typeof rest[0] === 'string') {
    kopf = (rest.shift() as string).replace(/%[sdifoOc]/g, (m) =>
      m === '%c' ? (rest.shift(), '') : wert(rest.shift()),
    )
  }
  return [kopf, ...rest.map(wert)].filter(Boolean).join(' ')
}

/** Die letzten 30 Einträge, lesbar, bereinigt, je max. 1000 Zeichen. */
export function konsolenEintraege(): KonsolenEintrag[] {
  return konsolenRoh().map((e) => {
    let text: string
    try {
      text = bereinige(formatiere(e.args)).slice(0, TEXT_MAX)
    } catch {
      text = '[nicht lesbar]'
    }
    return { zeit: e.zeit, art: e.art, text }
  })
}
