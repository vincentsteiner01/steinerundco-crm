// Vertrag (BAUPLAN § 3.1.8): `export const BEFEHLE: Befehl[]` – M8: „Voll-Backup jetzt herunterladen“ (löst den Download über
// ?aktion=backup aus) und „Zu Einstellungen → …“ je Bereich. „Backup herunterladen“/„Passcode ändern“ (nur Navigation) sind global (M0).
import type { Befehl } from '@/app/befehle'
import { PFADE } from '@/app/pfade'
import { BEREICHE } from './bereiche'

export const BEFEHLE: Befehl[] = [
  {
    id: 'einstellungen:backup-jetzt',
    label: 'Voll-Backup jetzt herunterladen',
    gruppe: 'aktionen',
    ausfuehren: ({ navigate }) => navigate(`${PFADE.einstellungen('export')}?aktion=backup`),
  },
  {
    // Runde 3: der Eingang (LinkedIn-Mails ohne sichere Zuordnung) ist ein Tab von Verbindungen – Pfad wie EINGANG_PFAD in
    // features/eingang (hier ohne Import, damit Badge und Daten nicht ins Start-Bundle der Palette wandern)
    id: 'einstellungen:eingang',
    label: 'Eingang öffnen – LinkedIn-Mails zuordnen',
    gruppe: 'seiten',
    ausfuehren: ({ navigate }) => navigate(`${PFADE.einstellungen('verbindungen')}?tab=eingang`),
  },
  ...BEREICHE.map<Befehl>((b) => ({
    id: `einstellungen:${b.key}`,
    label: `Zu Einstellungen → ${b.label}`,
    gruppe: 'seiten',
    tasten: ['G E', b.taste],
    ausfuehren: ({ navigate }) => navigate(PFADE.einstellungen(b.key)),
  })),
]
