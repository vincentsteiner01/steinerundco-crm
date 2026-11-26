// Formular-Bausteine der Einstellungen: Abschnitt mit Speichern-Fuß, „nicht geladen“, zwei Felder nebeneinander.
// Neustart 25.11.2026: Knöpfe 44 px, keine Tastenhinweise. Das Feld mit Beschriftung liegt in components/ui/Feld.tsx
// (gemeinsam mit dem Board).
import type { FormEvent, KeyboardEvent, ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { ALLGEMEIN } from '@/texte/de'

export type BlockProps = {
  /** Name des Formulars für Vorleseprogramme; als Überschrift sichtbar, außer mit `ohneKopf` */
  titel: string
  /** Bereiche mit nur einem Abschnitt: die Überschrift des Bereichs steht schon darüber */
  ohneKopf?: boolean
  beschreibung?: ReactNode
  children: ReactNode
  /** Speichern-Fuß (fehlt er, ist der Abschnitt rein informativ oder speichert sofort) */
  onSpeichern?: () => void
  geaendert?: boolean
  busy?: boolean
  speichernLabel?: string
  className?: string
}

/** Abschnitt als Formular: Überschrift, Inhalt (höchstens 560 px breit), „Speichern“ rechts unten. */
export function Block({
  titel,
  ohneKopf,
  beschreibung,
  children,
  onSpeichern,
  geaendert = false,
  busy,
  speichernLabel = ALLGEMEIN.speichern,
  className,
}: BlockProps) {
  const speichern = () => {
    if (onSpeichern && geaendert && !busy) onSpeichern()
  }
  const absenden = (e: FormEvent) => {
    e.preventDefault()
    speichern()
  }
  // Aus einem mehrzeiligen Feld heraus sendet Enter nicht – dort tut es ⌘↵ bzw. Strg+↵
  const tasten = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      speichern()
    }
  }
  return (
    <form
      onSubmit={absenden}
      onKeyDown={tasten}
      aria-label={titel}
      noValidate
      className={cn('hairline-t grid max-w-[560px] gap-4 pt-6 pb-8 first:border-t-0 first:pt-0', className)}
    >
      {ohneKopf ? null : (
        <div className="grid gap-1">
          <h3 className="text-h3 text-ink-bright">{titel}</h3>
          {beschreibung ? <p className="text-small text-ink-3">{beschreibung}</p> : null}
        </div>
      )}
      {children}
      {onSpeichern ? (
        <div className="flex justify-end pt-1">
          <Button
            type="submit"
            variante="primary"
            groesse="L"
            busy={busy}
            disabled={!geaendert}
            disabledGrund={geaendert ? undefined : ALLGEMEIN.nichtsGeaendert}
          >
            {speichernLabel}
          </Button>
        </div>
      ) : null}
    </form>
  )
}

/** Statt endloser Ladebalken: ein Satz und „Erneut versuchen“ (wie auf Leitfäden und Team). */
export function NichtGeladen({ text, onNochmal }: { text: string; onNochmal: () => void }) {
  return (
    <div role="alert" className="grid justify-items-start gap-5 py-2">
      <p className="text-body text-ink-2">{text}</p>
      <Button groesse="L" onClick={onNochmal}>
        Erneut versuchen
      </Button>
    </div>
  )
}

/** Zwei Felder nebeneinander (ab 640 px), darunter untereinander. */
export function Zeile({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid items-start gap-4 sm:grid-cols-2', className)}>{children}</div>
}
