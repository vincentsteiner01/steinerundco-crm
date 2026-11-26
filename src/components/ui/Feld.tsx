// Feld mit Beschriftung für alles Neue (25.11.2026: Lead-Blatt, „Lead hinzufügen“, Einstellungen): Beschriftung in 13 px –
// der Bauplan nennt 13 px als kleinste Schrift, FormField (E-Mail-Bereich) schreibt 12 px und bleibt, wie es ist.
import type { ReactNode } from 'react'
import { cn } from './cn'

export type FeldProps = {
  label: string
  /** id des Eingabefelds; ohne Angabe (Auswahl, Gruppe aus Kästchen) ist die Beschriftung nur sichtbar – die Gruppe nennt sich selbst */
  htmlFor?: string
  hinweis?: string
  /** Nur für Gruppen ohne eigenes Fehlerfeld (Kästchen) – Eingabefelder zeigen ihren Fehler selbst (`Input fehler`) */
  fehler?: string
  children: ReactNode
  className?: string
}

/** Feld mit Beschriftung darüber; darunter der Fehler der Gruppe oder, wenn keiner da ist, ein kurzer Hinweis. */
export function Feld({ label, htmlFor, hinweis, fehler, children, className }: FeldProps) {
  const klasse = 'text-small text-ink-2 font-medium'
  return (
    <div className={cn('grid min-w-0 content-start gap-1.5', className)}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className={klasse}>
          {label}
        </label>
      ) : (
        <span aria-hidden className={klasse}>
          {label}
        </span>
      )}
      {children}
      {fehler ? (
        <p className="text-small text-danger" role="alert">
          {fehler}
        </p>
      ) : hinweis ? (
        <p className="text-small text-ink-3">{hinweis}</p>
      ) : null}
    </div>
  )
}
