// Seiten → Service Worker: eine typisierte Funktion statt loser sendMessage-Aufrufe.
import { istEreignis, type Antwort, type Req, type Res, type Typ } from '../shared/protokoll'
import { CRM_LIVE, pruefeCrmBasis, SPEICHER } from '../shared/konfig'

export async function senden<K extends Typ>(typ: K, daten: Req<K>): Promise<Res<K>> {
  let antwort: Antwort<K> | undefined
  try {
    antwort = (await chrome.runtime.sendMessage({ typ, ...daten })) as Antwort<K> | undefined
  } catch {
    throw new Error('Die Erweiterung wurde neu geladen – bitte die Seitenleiste schließen und wieder öffnen.')
  }
  if (!antwort) throw new Error('Keine Antwort von der Erweiterung.')
  if (!antwort.ok) throw new Error(antwort.fehler)
  return antwort.daten
}

/** Ruft `cb`, wenn sich die Anmeldung ändert (Popup ↔ Seitenleiste). */
export function beiSitzungswechsel(cb: () => void): () => void {
  const l = (x: unknown) => {
    if (istEreignis(x)) cb()
  }
  chrome.runtime.onMessage.addListener(l)
  return () => chrome.runtime.onMessage.removeListener(l)
}

export async function lies<T>(key: string, standard: T): Promise<T> {
  try {
    const r = await chrome.storage.local.get(key)
    return (r[key] as T | undefined) ?? standard
  } catch {
    return standard
  }
}

export async function schreibe(key: string, wert: unknown): Promise<void> {
  try {
    await chrome.storage.local.set({ [key]: wert })
  } catch {
    /* nur Komfort */
  }
}

export async function crmBasis(): Promise<string> {
  return pruefeCrmBasis(await lies<string>(SPEICHER.crmBasis, CRM_LIVE)) ?? CRM_LIVE
}

export function fehlerText(e: unknown): string {
  return e instanceof Error ? e.message : 'Das hat nicht geklappt – bitte noch einmal.'
}

/** In die Zwischenablage; Rückfall über eine markierte Textarea. */
export async function kopiere(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const t = document.createElement('textarea')
    t.value = text
    t.setAttribute('readonly', '')
    t.style.position = 'fixed'
    t.style.opacity = '0'
    document.body.append(t)
    t.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    t.remove()
    return ok
  }
}

/** Öffnet einen Link in einem neuen Tab (CRM). */
export function oeffne(url: string): void {
  void chrome.tabs.create({ url }).catch(() => window.open(url, '_blank', 'noopener'))
}

/** Eingang (LinkedIn-Mails, die das CRM nicht allein zuordnen konnte) als eigene Seite der Erweiterung. */
export function eingangOeffnen(): void {
  oeffne(chrome.runtime.getURL('eingang.html'))
}
