// Service Worker: hält den Supabase-Client, beantwortet Nachrichten der eigenen Seiten und öffnet die Seitenleiste per ⌥C.
// Kein Content-Script, keine Hintergrund-Abfrage von LinkedIn – gelesen wird nur aus der offenen Seitenleiste heraus.
import { istNachricht, type Ereignis } from '../shared/protokoll'
import { erstelleHandler } from './handler'
import { erstelleDb, setzeBleiben } from './supabase'

const db = erstelleDb()
const handler = erstelleHandler({ db, setzeBleiben })

function sendeEreignis(e: Ereignis) {
  chrome.runtime.sendMessage(e).catch(() => {
    /* keine Seite offen */
  })
}

db.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
    handler.cachesLeeren()
    sendeEreignis({ ereignis: 'sitzung' })
  }
})

chrome.runtime.onMessage.addListener((nachricht, sender, antworten) => {
  // Nur eigene Erweiterungsseiten (Popup, Seitenleiste, Optionen) – Webseiten und fremde Erweiterungen nie.
  if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL(''))) return false
  if (!istNachricht(nachricht)) return false
  void handler.bearbeite(nachricht).then(antworten)
  return true
})

// Aktionssymbol öffnet das Popup; die Seitenleiste öffnet ⌥C oder der Knopf im Popup.
chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {})
})

chrome.commands.onCommand.addListener((befehl, tab) => {
  if (befehl !== 'seitenleiste-oeffnen' || tab?.windowId === undefined) return
  void chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {})
})
