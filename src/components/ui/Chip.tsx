import { ChevronDown, X } from 'lucide-react'
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode, Ref } from 'react'
import type { LeadStage, Settings } from '@/types/domain'
import { fmtDatumKurz, heuteBerlin, relativ } from '@/lib/format'
import { phaseVon } from '@/lib/stufen'
import { berlinTag, tageDifferenz } from '@/lib/zeit'
import { PHASE_LABEL, STUFEN_LABEL } from '@/texte/de'
import { cn } from './cn'
import { PHASE_FARBE } from './phaseFarbe'

export type ChipTon =
  | 'neutral'
  | 'muted'
  | 'ended'
  | 'won'
  | 'today'
  | 'overdue'
  | 'later'
  | 'done'
  | 'danger'
  | 'neu'
  // Etiketten-Farben (Notion-Palette, 20.10.2026) – Phasen im StatusChip
  | 'grau'
  | 'braun'
  | 'orange'
  | 'gelb'
  | 'gruen'
  | 'blau'
  | 'lila'
  | 'rosa'
  | 'rot'

// Hell (20.10.2026): Pastell-Fläche statt Rahmen, wie Etiketten in Notion; nur „beendet“ bleibt als Umriss
const TON: Record<ChipTon, string> = {
  neutral: 'border-transparent bg-tag-grau text-ink',
  muted: 'border-transparent bg-tag-grau text-ink-2',
  ended: 'border-line-strong text-ink-3',
  won: 'border-transparent bg-tag-gruen text-tag-gruen-ink',
  today: 'border-transparent bg-signal-tint text-signal',
  overdue: 'border-transparent bg-overdue-tint text-overdue',
  later: 'border-transparent bg-tag-grau text-ink-3',
  done: 'border-transparent bg-done-tint text-done',
  danger: 'border-transparent bg-danger-tint text-danger',
  neu: 'border-transparent bg-tag-blau text-tag-blau-ink',
  grau: 'border-transparent bg-tag-grau text-tag-grau-ink',
  braun: 'border-transparent bg-tag-braun text-tag-braun-ink',
  orange: 'border-transparent bg-tag-orange text-tag-orange-ink',
  gelb: 'border-transparent bg-tag-gelb text-tag-gelb-ink',
  gruen: 'border-transparent bg-tag-gruen text-tag-gruen-ink',
  blau: 'border-transparent bg-tag-blau text-tag-blau-ink',
  lila: 'border-transparent bg-tag-lila text-tag-lila-ink',
  rosa: 'border-transparent bg-tag-rosa text-tag-rosa-ink',
  rot: 'border-transparent bg-tag-rot text-tag-rot-ink',
}

export type ChipProps = {
  ton?: ChipTon
  icon?: ReactNode
  onRemove?: () => void
  interaktiv?: boolean
  children: ReactNode
  ref?: Ref<HTMLElement>
} & Omit<HTMLAttributes<HTMLElement>, 'children'> &
  Pick<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'disabled'>

const BASIS =
  'inline-flex h-[22px] max-w-full items-center gap-1.5 whitespace-nowrap rounded-xs border px-2 text-[12px] font-medium leading-none tnum'

/** DESIGN-SYSTEM § 5.3: 22 px, 0 8, Radius xs, Text 12/500, Rahmen 1 px. Töne = Phase (neutral/muted/ended/won) oder Zeit (today/overdue/later/done). */
export function Chip({
  ton = 'neutral',
  icon,
  onRemove,
  interaktiv,
  className,
  children,
  ref,
  onClick,
  disabled,
  ...rest
}: ChipProps) {
  const inhalt = (
    <>
      {icon ? <span className="inline-flex [&_svg]:h-3 [&_svg]:w-3">{icon}</span> : null}
      <span className="min-w-0 truncate leading-tight">{children}</span>
      {interaktiv ? <ChevronDown size={12} strokeWidth={1.75} aria-hidden className="text-ink-3" /> : null}
      {onRemove ? (
        <button
          type="button"
          aria-label="Entfernen"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="text-ink-3 hover:text-ink ml-0.5 inline-flex"
        >
          <X size={12} strokeWidth={1.75} aria-hidden />
        </button>
      ) : null}
    </>
  )
  if (interaktiv || onClick) {
    return (
      <button
        type="button"
        ref={ref as Ref<HTMLButtonElement>}
        onClick={onClick}
        disabled={disabled}
        className={cn(
          BASIS,
          TON[ton],
          'ease-brand transition-[background,color,filter] duration-[var(--t-1)] hover:brightness-[0.96]',
          className,
        )}
        {...(rest as HTMLAttributes<HTMLButtonElement>)}
      >
        {inhalt}
      </button>
    )
  }
  return (
    <span
      ref={ref as Ref<HTMLSpanElement>}
      className={cn(BASIS, TON[ton], className)}
      {...(rest as HTMLAttributes<HTMLSpanElement>)}
    >
      {inhalt}
    </span>
  )
}

/** Phase-Chip (BAUPLAN § 1.5 Nr. 1): zeigt die Gruppe, `title` die Feinstufe aus settings.stage_labels. Ton aus DESIGN-SYSTEM § 3.3. */
export function StatusChip({
  stage,
  settings,
  className,
  ...rest
}: { stage: LeadStage; settings: Settings | null | undefined; className?: string } & Pick<
  ChipProps,
  'interaktiv' | 'onClick'
>) {
  const phase = phaseVon(stage)
  const fein = settings?.stage_labels?.[stage]?.label ?? STUFEN_LABEL[stage].label
  return (
    <Chip ton={PHASE_FARBE[phase.key]} title={fein} className={className} {...rest}>
      {PHASE_LABEL[phase.key]}
    </Chip>
  )
}

/** Zeit-Chip: heute (Lime) · −2 T / −12 T (Amber, immer Tage – ein Datum verschleierte, wie lange etwas liegt) ·
 * in 3 T / Mi 14.10. (ink-3). `title` trägt immer das Datum. */
export function ZeitChip({ datum, heute, className }: { datum: string; heute?: string; className?: string }) {
  const h = heute ?? heuteBerlin()
  const diff = tageDifferenz(berlinTag(h), berlinTag(datum))
  const zustand: ChipTon = diff === 0 ? 'today' : diff < 0 ? 'overdue' : 'later'
  const text = diff < -1 ? `\u2212${Math.abs(diff)}\u00a0T` : relativ(datum, h)
  return (
    <Chip ton={zustand} className={cn('font-mono', className)} title={fmtDatumKurz(datum)}>
      {text}
    </Chip>
  )
}
