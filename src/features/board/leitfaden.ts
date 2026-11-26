// Leitfaden an der Karte (26.11.2026, Vincent: „beim Anlegen einer Karte anklicken können, welchen Leitfaden wir benutzt
// haben“): welche Leitfäden wählbar sind, was vorgewählt ist und das Merken der letzten Wahl. Die Auswahl selbst: LeitfadenWahl.
import type { Template } from '@/types/domain'

export type Vorlage = Pick<Template, 'id' | 'name' | 'channel' | 'archiviert_at'>

export const KEIN_LEITFADEN = 'Kein Leitfaden'

/** Die wählbaren Leitfäden, nach Namen. Ein schon gesetzter bleibt wählbar, auch wenn er inzwischen archiviert ist. */
export function waehlbareLeitfaeden(alle: readonly Vorlage[] | undefined, gesetzt: string | null = null): Vorlage[] {
  return (alle ?? [])
    .filter((t) => (t.archiviert_at == null && t.channel !== 'email') || t.id === gesetzt)
    .sort((a, b) => a.name.localeCompare(b.name, 'de'))
}

const SCHLUESSEL = 'crm:board:leitfaden'

/** Der beim letzten Anlegen gewählte Leitfaden (dieses Gerät); `null`, wenn keiner gemerkt ist. */
export function letzterLeitfaden(): string | null {
  try {
    return window.localStorage.getItem(SCHLUESSEL)
  } catch {
    return null
  }
}

export function merkeLeitfaden(id: string | null): void {
  try {
    if (id) window.localStorage.setItem(SCHLUESSEL, id)
    else window.localStorage.removeItem(SCHLUESSEL)
  } catch {
    // privates Fenster o. Ä.: dann wird eben nichts gemerkt
  }
}

/**
 * Vorauswahl beim Anlegen: der zuletzt benutzte, wenn es ihn noch gibt – sonst der einzige, wenn es nur einen gibt
 * („später wird es nur noch einen einzigen geben“), sonst keiner.
 */
export function vorgewaehlterLeitfaden(
  waehlbar: readonly Pick<Vorlage, 'id'>[],
  gemerkt: string | null,
): string | null {
  if (gemerkt && waehlbar.some((t) => t.id === gemerkt)) return gemerkt
  return waehlbar.length === 1 ? (waehlbar[0]?.id ?? null) : null
}
