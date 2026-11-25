// Formular-Bausteine für „Lead hinzufügen“ und das Lead-Blatt (25.11.2026): Beschriftung in 13 px (Bauplan: kleinste Schrift
// 13 px – FormField schreibt 12 px) und eine Auswahl mit großen Flächen.
import type { ReactNode } from 'react'
import { cn } from '@/components/ui/cn'
import { Segment, type SegmentProps } from '@/components/ui/Segment'

type FeldProps = {
  label: string
  /** Bei Eingabefeldern: id des Felds. Ohne Angabe (Auswahl) ist die Beschriftung nur sichtbar – die Gruppe nennt sich selbst. */
  htmlFor?: string
  children: ReactNode
  className?: string
}

export function Feld({ label, htmlFor, children, className }: FeldProps) {
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
    </div>
  )
}

// Das Segment des Design-Systems, nur größer: volle Breite, gleich breite Flächen, 44 px hoch (Daumen). `raster` legt vier
// Optionen als 2 × 2 – die vier Listentitel passen auf dem Telefon nicht nebeneinander und würden unsichtbar zur Seite scrollen.
// Die Ausrufezeichen sind nötig, weil Segment Höhe und Anordnung selbst setzt (gleiche Eigenschaft, die spätere Klasse gewinnt).
const BREIT = 'h-11! w-full [&>button]:flex-1 [&>button]:justify-center'
const RASTER = 'grid! h-auto! w-full grid-cols-2 [&>button]:h-10 [&>button]:justify-center'

export function Wahl<K extends string>({ raster, className, ...rest }: SegmentProps<K> & { raster?: boolean }) {
  return <Segment {...rest} className={cn(raster ? RASTER : BREIT, className)} />
}
