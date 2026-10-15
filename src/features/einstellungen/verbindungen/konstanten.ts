// Einstellungen → Verbindungen: feste Werte. Das Apps Script kommt wörtlich aus tools/apps-script/LinkedIn-ins-CRM.gs (Vite ?raw),
// damit „Script kopieren“ nie von der Datei im Repository abweicht. Liegt im Einstellungen-Chunk (lazy), nicht im Start-Bundle.
import skriptText from '../../../../tools/apps-script/LinkedIn-ins-CRM.gs?raw'

export const SKRIPT: string = skriptText
export const SKRIPT_ZEILEN = SKRIPT.trimEnd().split('\n').length
export const SKRIPT_NAME = 'LinkedIn ins CRM'
export const SKRIPT_EIGENSCHAFT = 'CRM_SCHLUESSEL'
export const SKRIPT_URL = 'https://script.google.com/home'
export const SKRIPT_LABEL = 'CRM/erfasst'

export const ERWEITERUNG_VERSION = '1.1.0'
export const ERWEITERUNG_KUERZEL = '⌥C'
export const CHROME_ERWEITERUNGEN = 'chrome://extensions'
export const ERWEITERUNG_ORDNER = 'extension/dist'
export const ERWEITERUNG_ZIP = 'steinerundco-crm-erweiterung.zip'

export type VerbindungenTab = 'einrichtung' | 'eingang'
export const VERBINDUNGEN_TABS: { key: VerbindungenTab; label: string }[] = [
  { key: 'einrichtung', label: 'Einrichtung' },
  { key: 'eingang', label: 'Eingang' },
]
