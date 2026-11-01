// Bestätigung vor dem Löschen/Beenden als Dialog (wie im übrigen CRM, kein window.confirm) – eigene Datei, damit Teile.tsx
// nur Komponenten exportiert (Fast Refresh).
import { useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'

type Frage = { titel: string; text: string; label: string; los: () => void }

export function useBestaetigung() {
  const [frage, setFrage] = useState<Frage | null>(null)
  const dialog = frage ? (
    <Dialog
      offen
      onOpenChange={(o) => !o && setFrage(null)}
      titel={frage.titel}
      text={frage.text}
      primaer={{
        label: frage.label,
        danger: true,
        onClick: () => {
          frage.los()
          setFrage(null)
        },
      }}
    />
  ) : null
  return { dialog, fragen: setFrage }
}
