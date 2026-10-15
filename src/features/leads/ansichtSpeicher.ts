// Ansicht-Zustand je Gerät (ux § 3.2.1/§ 3.2.3, LE-01): Favoriten (max. 6) und Spaltenwahl je Ansicht in localStorage
// (`crm.leads.favoriten`, `crm.leads.spalten.<ansicht>`). Jeder Zugriff in try/catch – ohne Storage gelten die Standards.
import { FAVORITEN_STANDARD, SYSTEM_ANSICHTEN, type AnsichtDef } from './ansichten'
import { SPALTEN_KEYS, type SpaltenKey } from './spaltenKeys'

const FAV_KEY = 'crm.leads.favoriten'
export const spaltenSpeicherKey = (ansicht: Pick<AnsichtDef, 'key'>) => `crm.leads.spalten.${ansicht.key}`

export function liesFavoriten(): string[] {
  try {
    const roh = localStorage.getItem(FAV_KEY)
    const liste = roh ? (JSON.parse(roh) as unknown) : null
    if (Array.isArray(liste))
      return liste.filter((k): k is string => typeof k === 'string' && SYSTEM_ANSICHTEN.some((a) => a.key === k))
  } catch {
    /* kein Storage */
  }
  return [...FAVORITEN_STANDARD]
}

export function schreibeFavoriten(liste: readonly string[]): void {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(liste))
  } catch {
    /* kein Storage */
  }
}

export function liesSpalten(ansicht: AnsichtDef): SpaltenKey[] {
  try {
    const roh = localStorage.getItem(spaltenSpeicherKey(ansicht))
    const liste = roh ? (JSON.parse(roh) as unknown) : null
    if (Array.isArray(liste)) {
      const gueltig = liste.filter(
        (k): k is SpaltenKey => typeof k === 'string' && (SPALTEN_KEYS as readonly string[]).includes(k),
      )
      if (gueltig.length) return gueltig
    }
  } catch {
    /* kein Storage */
  }
  return [...ansicht.spalten]
}

export function schreibeSpalten(ansicht: AnsichtDef, keys: readonly SpaltenKey[]): void {
  try {
    localStorage.setItem(spaltenSpeicherKey(ansicht), JSON.stringify(keys))
  } catch {
    /* kein Storage */
  }
}
