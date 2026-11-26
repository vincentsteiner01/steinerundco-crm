// Kleine Bausteine des Reiters „Ziele“: Ampel-Marke, das Menü „⋯“ und die Knöpfe „−“/„+“ für von Hand gezählte Key Results.
import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { DropdownMenu, type MenuEintrag } from '@/components/ui/DropdownMenu'
import { STATUS_STIL } from './farben'
import { STATUS_LABEL, type Status } from './rechnen'

/** Ampel als Marke: „Im Plan“, „Knapp“, „Hinten“ … (13 px – die Chips des Design-Systems schreiben 12 px). */
export function StatusMarke({ status, className }: { status: Status; className?: string }) {
  return (
    <span
      data-status={status}
      className={cn(
        'inline-flex h-6 flex-none items-center rounded-xs px-2 text-[13px] leading-none font-medium whitespace-nowrap',
        STATUS_STIL[status].marke,
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

/** Menü „⋯“ an Ziel und Key Result; am Telefon sind Knopf und Einträge 44 px hoch. */
export function Menue({
  label,
  eintraege,
  className,
}: {
  label: string
  eintraege: MenuEintrag[]
  className?: string
}) {
  return (
    <DropdownMenu
      // Die Einträge öffnen Fenster. Erst im nächsten Bild: dann ist das Menü zu und der Fokus wieder auf „⋯“ – das Fenster
      // merkt sich diesen Knopf und gibt den Fokus nach dem Schließen dorthin zurück (sonst fiele er auf <body>).
      eintraege={eintraege.map((e) => ({ ...e, onSelect: () => void requestAnimationFrame(() => e.onSelect()) }))}
      className="max-md:[&_[role=menuitem]]:h-11"
      trigger={
        <Button variante="icon" aria-label={label} className={cn('flex-none max-md:h-11! max-md:w-11!', className)}>
          <MoreHorizontal size={18} strokeWidth={1.75} aria-hidden />
        </Button>
      }
    />
  )
}

// Die Ausrufezeichen sind nötig, weil Button Innenabstand, Schriftgröße und Höhe selbst setzt
const ZAEHLKNOPF = 'w-9 flex-none px-0! text-[18px]! max-md:h-11! max-md:w-11!'

/** „−“ und „+“ neben dem Balken eines von Hand gezählten Key Results. */
export function PlusMinus({
  onPlus,
  onMinus,
  minusMoeglich,
  gesperrt,
}: {
  onPlus: () => void
  onMinus: () => void
  minusMoeglich: boolean
  gesperrt?: boolean
}) {
  return (
    <span className="flex flex-none items-center gap-1.5">
      <Button aria-label="Eins weniger" className={ZAEHLKNOPF} disabled={gesperrt || !minusMoeglich} onClick={onMinus}>
        −
      </Button>
      <Button aria-label="Eins mehr" className={ZAEHLKNOPF} disabled={gesperrt} onClick={onPlus}>
        +
      </Button>
    </span>
  )
}
