// Vertrag (BAUPLAN § 3.1.8): `export const BEFEHLE: Befehl[]` – M6: „Leitfaden anlegen“, „Leitfaden-Vorschau mit …“.
import type { Befehl } from '@/app/befehle'
import { PFADE } from '@/app/pfade'

/** Neuer Leitfaden läuft über die Detail-Route mit der Kennung `neu` (BAUPLAN § 3.1.4 kennt keine eigene Route; Entscheidung M6). */
export const NEU = 'neu'

export const BEFEHLE: Befehl[] = [
  {
    id: 'leitfaden-anlegen',
    label: 'Leitfaden anlegen',
    gruppe: 'aktionen',
    ausfuehren: ({ navigate }) => navigate(PFADE.leitfadenNeu()),
  },
  {
    id: 'leitfaden-vorschau',
    label: 'Leitfaden-Vorschau mit diesem Lead',
    gruppe: 'aktionen',
    sichtbar: ({ leadId }) => leadId !== null,
    ausfuehren: ({ navigate, leadId }) =>
      navigate(leadId ? `${PFADE.leitfaeden}?vorschau=${encodeURIComponent(leadId)}` : PFADE.leitfaeden),
  },
]
