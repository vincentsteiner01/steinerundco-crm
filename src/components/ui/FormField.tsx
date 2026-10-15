import type { ReactNode } from 'react'
import { cn } from './cn'

export type FormFieldProps = {
  label: string
  hinweis?: string
  fehler?: string
  pflicht?: boolean
  children: ReactNode
  htmlFor?: string
  className?: string
}

/** Feld mit `label`-Versalbeschriftung, Hinweis (small ink-3) und Fehler (small danger). Pflicht wird nicht mit Sternchen, sondern über die Validierung markiert (ux § 4.9) – `pflicht` setzt nur aria-required am Container. */
export function FormField({ label, hinweis, fehler, pflicht, children, htmlFor, className }: FormFieldProps) {
  return (
    <div className={cn('grid min-w-0 content-start gap-1.5', className)} data-pflicht={pflicht || undefined}>
      <label className="label block" htmlFor={htmlFor}>
        {label}
      </label>
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
