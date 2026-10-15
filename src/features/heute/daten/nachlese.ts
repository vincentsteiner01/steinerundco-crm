// Typen der Schritt-Aktivitäten, deren Trigger-Zeile die Heute-Seite für den Undo-Toast nachliest (E16). Die Nachlese selbst
// ist `nachleseAktivitaet` aus der Daten-Schicht (Integration M1–M8, vorher hier als Kopie).
import type { ActivityType } from '@/types/domain'

export const SCHRITT_TYPEN: ActivityType[] = [
  'gespraech_eroeffnet',
  'nachricht_gesendet',
  'pitch_gesendet',
  'email_gesendet',
  'anruf',
  'aufgabe_erledigt',
  'schritt_uebersprungen',
]
