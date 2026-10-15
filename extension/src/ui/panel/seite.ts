// Der geöffnete Tab: welcher es ist, ob er LinkedIn ist, und das Lesen per chrome.scripting – nur aus der offenen Seitenleiste.
// Gelesen wird ausschließlich der DOM der sichtbaren Seite; es wird nichts geklickt, getippt, gesendet oder navigiert.
import { istLinkedin } from '../../shared/konfig'
import type { Extrakt, LeseOptionen } from '../../shared/typen'

export type TabInfo = { id: number; url: string | null; fensterId: number | null }

/** `?tab=<id>` nur für den Headless-Test (Seitenleiste als normaler Tab geöffnet). */
export function tabAusAdresse(): number | null {
  const v = new URLSearchParams(location.search).get('tab')
  const n = v ? Number(v) : NaN
  return Number.isInteger(n) && n > 0 ? n : null
}

export async function aktiverTab(festerTab: number | null): Promise<TabInfo | null> {
  try {
    if (festerTab) {
      const t = await chrome.tabs.get(festerTab)
      return { id: festerTab, url: t.url ?? null, fensterId: t.windowId ?? null }
    }
    const [t] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!t?.id) return null
    return { id: t.id, url: t.url ?? null, fensterId: t.windowId ?? null }
  } catch {
    return null
  }
}

/** Liest die Seite: erst das Lese-Skript (definiert eine Funktion in der isolierten Welt), dann der Aufruf. */
export async function leseTab(tab: TabInfo, opts: LeseOptionen): Promise<Extrakt> {
  if (!istLinkedin(tab.url)) {
    return { art: 'andere', url: tab.url ?? '', person: null, letzteNachricht: null, auswahl: null, hinweis: null }
  }
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['lesen.js'] })
  const [r] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (o: LeseOptionen) => globalThis.__sucoCrmLesen?.(o) ?? null,
    args: [opts],
  })
  const e = r?.result as Extrakt | null | undefined
  if (!e) throw new Error('Die Seite ließ sich nicht lesen – lade den LinkedIn-Tab neu.')
  return e
}

/** Meldet Tabwechsel und Navigation (auch LinkedIn-interne) im eigenen Fenster, solange die Seitenleiste offen ist. */
export function beobachteTabs(
  festerTab: number | null,
  fensterId: () => number | null,
  aktuellerTab: () => number | null,
  cb: (grund: 'tab' | 'navigation') => void,
): () => void {
  const aktiviert = (info: chrome.tabs.OnActivatedInfo) => {
    if (festerTab) return
    if (fensterId() !== null && info.windowId !== fensterId()) return
    cb('tab')
  }
  const geaendert = (tabId: number, change: chrome.tabs.OnUpdatedInfo) => {
    if (tabId !== (festerTab ?? aktuellerTab())) return
    if (change.url || change.status === 'complete') cb('navigation')
  }
  chrome.tabs.onActivated.addListener(aktiviert)
  chrome.tabs.onUpdated.addListener(geaendert)
  return () => {
    chrome.tabs.onActivated.removeListener(aktiviert)
    chrome.tabs.onUpdated.removeListener(geaendert)
  }
}
