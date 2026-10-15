import { Check } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes, Ref } from 'react'
import { cn } from './cn'
import { Tooltip } from './Tooltip'

export type ButtonProps = {
  variante?: 'primary' | 'secondary' | 'quiet' | 'danger' | 'icon'
  groesse?: 'S' | 'M' | 'L'
  icon?: LucideIcon
  kbd?: string
  busy?: boolean
  copied?: boolean
  /** Grund, warum der Button deaktiviert ist – erscheint als Tooltip („Erst Reaktion eintragen“) */
  disabledGrund?: string
  ref?: Ref<HTMLButtonElement>
} & ButtonHTMLAttributes<HTMLButtonElement>

const GROESSE = {
  S: 'h-7 px-2.5 text-small',
  M: 'h-9 px-3.5 text-ui',
  L: 'h-11 px-4 text-[15px]',
} as const

const VARIANTE = {
  primary: 'bg-signal text-signal-ink font-semibold hover:bg-signal-hover disabled:hover:bg-signal',
  secondary: 'border-line-strong text-ink hover:bg-surface-hover',
  quiet: 'text-ink-2 hover:text-ink hover:bg-surface-hover',
  danger: 'text-danger hover:bg-danger-tint',
  icon: 'h-8 w-8 p-0 text-ink-2 hover:text-ink hover:bg-surface-hover',
} as const

/**
 * DESIGN-SYSTEM § 5.1: Text + optional Icon 16 px links + optional kbd rechts. M 36 / S 28 / L 44, Radius sm.
 * Zustände: Hover, Aktiv (translateY .5px), Fokus, Disabled (opacity .45 + Tooltip mit Grund), Busy (bleibt gedrückt),
 * Copied (2 s „Kopiert“ mit Häkchen, done-tint).
 */
export function Button(props: ButtonProps) {
  const {
    variante = 'secondary',
    groesse = 'M',
    icon: Icon,
    kbd,
    busy,
    copied,
    disabledGrund,
    className,
    children,
    disabled,
    type = 'button',
    ref,
    ...rest
  } = props
  // Wer `disabledGrund` übergibt (auch `undefined`), bekommt einen stabilen Elementbaum: der Wrapper bleibt, ist im aktiven
  // Zustand `display: contents` (kein Layout-Einfluss) – Fokus und Referenzen überleben den Wechsel (FOUNDATION-WUNSCH M8).
  const stabil = Object.prototype.hasOwnProperty.call(props, 'disabledGrund')
  const istIcon = variante === 'icon'
  const ikonGroesse = groesse === 'L' ? 20 : 16
  const knopf = (
    <button
      ref={ref}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      aria-disabled={disabled || undefined}
      data-copied={copied || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-sm border border-transparent leading-none font-medium whitespace-nowrap',
        'ease-brand transition-[background,border-color,color] duration-[var(--t-1)]',
        'active:translate-y-[0.5px] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:translate-y-0',
        '[&_kbd]:min-w-[18px] [&_kbd]:border-current [&_kbd]:px-1 [&_kbd]:text-inherit [&_kbd]:opacity-60',
        istIcon ? VARIANTE.icon : GROESSE[groesse],
        !istIcon && VARIANTE[variante],
        variante === 'primary' && '[&_kbd]:border-signal-ink/35',
        busy && !istIcon && 'bg-surface-pressed translate-y-[0.5px]',
        copied && 'bg-done-tint text-done hover:bg-done-tint border-transparent',
        className,
      )}
      {...rest}
    >
      {copied ? (
        <>
          <Check size={14} strokeWidth={1.75} aria-hidden />
          Kopiert
        </>
      ) : (
        <>
          {Icon ? <Icon size={ikonGroesse} strokeWidth={1.75} aria-hidden /> : null}
          {children}
          {kbd ? <kbd className="kbd">{kbd}</kbd> : null}
        </>
      )}
    </button>
  )
  const mitGrund = !!(disabled && disabledGrund)
  if (!mitGrund && !stabil) return knopf
  // Deaktivierte Buttons feuern keine Pointer-Events → Wrapper trägt den Tooltip
  return (
    <Tooltip text={disabledGrund} aus={!mitGrund} stabil>
      <span
        className={mitGrund ? 'inline-flex' : 'contents'}
        tabIndex={mitGrund ? 0 : undefined}
        aria-label={mitGrund ? disabledGrund : undefined}
      >
        {knopf}
      </span>
    </Tooltip>
  )
}
