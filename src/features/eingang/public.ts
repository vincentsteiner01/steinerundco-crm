// src/features/eingang/public.ts – Exporte für andere Module (Heute, Sidebar, Einstellungen → Verbindungen).
export { EingangBadge, EINGANG_PFAD, type EingangBadgeProps } from './EingangBadge'
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
