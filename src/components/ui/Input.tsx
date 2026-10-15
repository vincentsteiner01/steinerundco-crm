import type { InputHTMLAttributes, ReactNode, Ref } from 'react'
import { cn } from './cn'

export type InputProps = {
  fehler?: string
  mono?: boolean
  groesse?: 'M' | 'L'
  /** Slot rechts im Feld (Auge-Toggle, Vorschau in Mono) */
  rechts?: ReactNode
  /** Klassen für den Rahmen (das Feld selbst erhält `className`) */
  rahmenClassName?: string
  ref?: Ref<HTMLInputElement>
} & InputHTMLAttributes<HTMLInputElement>

/**
 * DESIGN-SYSTEM § 5.2: 36 px (L 44), surface-hover, Rahmen line-strong, Radius sm, 0 12, Fokus Rahmen Lime,
 * Fehler Rahmen danger + Hinweiszeile small danger darunter. mono: Geist Mono (Passcode: 15 px, letter-spacing .3em – Anmelden setzt es).
 */
export function Input({
  fehler,
  mono,
  groesse = 'M',
  rechts,
  rahmenClassName,
  className,
  id,
  ref,
  'aria-describedby': describedBy,
  ...rest
}: InputProps) {
  const fehlerId = fehler && id ? `${id}-fehler` : undefined
  return (
    <div className="grid gap-1.5">
      <div
        className={cn(
          'bg-surface-hover ease-brand focus-within:border-signal flex items-center gap-2 rounded-sm border px-3 transition-[border-color] duration-[var(--t-1)]',
          groesse === 'L' ? 'h-11' : 'h-9',
          fehler ? 'border-danger' : 'border-line-strong',
          rahmenClassName,
        )}
      >
        <input
          ref={ref}
          id={id}
          aria-invalid={fehler ? true : undefined}
          aria-describedby={[describedBy, fehlerId].filter(Boolean).join(' ') || undefined}
          className={cn(
            'placeholder:text-ink-4 h-full min-w-0 flex-1 bg-transparent outline-none',
            groesse === 'L' ? 'text-[15px]' : 'text-ui font-normal',
            mono && 'tnum font-mono',
            className,
          )}
          {...rest}
        />
        {rechts}
      </div>
      {fehler ? (
        <p id={fehlerId} className="text-small text-danger" role="alert">
          {fehler}
        </p>
      ) : null}
    </div>
  )
}
