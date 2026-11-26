// Auswahl mit großen Flächen für „Lead hinzufügen“ und das Lead-Blatt (25.11.2026). Das Feld mit Beschriftung dazu liegt in
// components/ui/Feld.tsx (gemeinsam mit den Einstellungen).
import { cn } from '@/components/ui/cn'
import { Segment, type SegmentProps } from '@/components/ui/Segment'

// Das Segment des Design-Systems, nur größer: volle Breite, gleich breite Flächen, 44 px hoch (Daumen). `raster` legt vier
// Optionen als 2 × 2 – die vier Listentitel passen auf dem Telefon nicht nebeneinander und würden unsichtbar zur Seite scrollen.
// Die Ausrufezeichen sind nötig, weil Segment Höhe und Anordnung selbst setzt (gleiche Eigenschaft, die spätere Klasse gewinnt).
const BREIT = 'h-11! w-full [&>button]:flex-1 [&>button]:justify-center'
const RASTER = 'grid! h-auto! w-full grid-cols-2 [&>button]:h-10 [&>button]:justify-center'

export function Wahl<K extends string>({ raster, className, ...rest }: SegmentProps<K> & { raster?: boolean }) {
  return <Segment {...rest} className={cn(raster ? RASTER : BREIT, className)} />
}
