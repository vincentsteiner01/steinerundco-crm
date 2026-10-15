// Formular-Bausteine der Einstellungen (DESIGN-SYSTEM § 5.18): Sektionen mit `text-h3` und Haarlinie, Felder 560 px breit,
// Speichern je Block (⌘↵), Switch-Zeilen. Keine Farben außer Token-Utilities.
import type { FormEvent, KeyboardEvent, ReactNode } from 'react'
import { Button, Switch, cn } from '@/components/ui'
import { ALLGEMEIN } from '@/texte/de'

export type BlockProps = {
  titel: string
  beschreibung?: ReactNode
  children: ReactNode
  /** Speichern-Fuß (fehlt er, ist der Block rein informativ oder speichert sofort) */
  onSpeichern?: () => void
  geaendert?: boolean
  busy?: boolean
  speichernLabel?: string
  fuss?: ReactNode
  className?: string
}

/** Sektion: `text-h3` + Haarlinie oben, Inhalt max. 560 px, Speichern rechts unten mit `⌘↵`. */
export function Block({
  titel,
  beschreibung,
  children,
  onSpeichern,
  geaendert = false,
  busy,
  speichernLabel = ALLGEMEIN.speichern,
  fuss,
  className,
}: BlockProps) {
  const absenden = (e: FormEvent) => {
    e.preventDefault()
    if (onSpeichern && geaendert && !busy) onSpeichern()
  }
  const tasten = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      if (onSpeichern && geaendert && !busy) onSpeichern()
    }
  }
  return (
    <form
      onSubmit={absenden}
      onKeyDown={tasten}
      aria-label={titel}
      className={cn('hairline-t grid max-w-[560px] gap-4 pt-5 pb-7 first:border-t-0 first:pt-0', className)}
    >
      <div className="grid gap-1">
        <h3 className="text-h3 text-ink-bright">{titel}</h3>
        {beschreibung ? <p className="text-small text-ink-3">{beschreibung}</p> : null}
      </div>
      {children}
      {onSpeichern || fuss ? (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="text-small text-ink-3">{fuss}</div>
          {onSpeichern ? (
            <Button
              type="submit"
              variante="primary"
              kbd="⌘↵"
              busy={busy}
              disabled={!geaendert}
              disabledGrund={geaendert ? undefined : ALLGEMEIN.nichtsGeaendert}
            >
              {speichernLabel}
            </Button>
          ) : null}
        </div>
      ) : null}
    </form>
  )
}

export type SwitchZeileProps = {
  label: string
  hinweis?: string
  checked: boolean
  onCheckedChange: (an: boolean) => void
  disabled?: boolean
  busy?: boolean
}

/** Beschriftung links, Switch rechts – 40 px hoch, Haarlinie zwischen Zeilen. */
export function SwitchZeile({ label, hinweis, checked, onCheckedChange, disabled, busy }: SwitchZeileProps) {
  return (
    <div className="hairline flex min-h-10 items-center justify-between gap-4 py-2 last:border-b-0">
      <div className="grid gap-0.5">
        <span className="text-ui text-ink">{label}</span>
        {hinweis ? <span className="text-small text-ink-3">{hinweis}</span> : null}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} label={label} disabled={disabled || busy} />
    </div>
  )
}

/** Zwei Felder nebeneinander (ab 640 px), darunter untereinander. */
export function Zeile({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid gap-4 sm:grid-cols-2', className)}>{children}</div>
}
