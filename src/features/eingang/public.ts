// src/features/eingang/public.ts – Exporte für Einstellungen → Verbindungen (25.11.2026: der Badge für Heute/Sidebar ist mit der alten Hülle entfallen).
export { EingangListe } from './EingangListe'
export {
  qkEingang,
  schluesselErzeugen,
  schluesselWiderrufen,
  useEingangLive,
  useEingangOffenAnzahl,
  useEingangStatus,
  type EingangStatusDaten,
} from './daten'
export {
  artLabel,
  istStatus,
  scriptZustand,
  STATUS_LABEL,
  zaehle,
  type EingangStatus,
  type SchluesselInfo,
  type ScriptZustand,
} from './logik'
