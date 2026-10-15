import type { Ref, SelectHTMLAttributes } from 'react'
import { cn } from './cn'

export type SelectOption = { value: string; label: string; disabled?: boolean }
export type SelectProps = {
  optionen?: SelectOption[]
  fehler?: string
  platzhalter?: string
  ref?: Ref<HTMLSelectElement>
} & SelectHTMLAttributes<HTMLSelectElement>

/** Natives Select (BAUPLAN § 1.5 Nr. 21): Trigger wie Input (36 px, surface-hover, line-strong, Chevron 16 px), Liste = Browser-Popup. */
export function Select({ optionen, fehler, platzhalter, className, children, ref, ...rest }: SelectProps) {
  return (
    <div className="grid gap-1.5">
      <select
        ref={ref}
        aria-invalid={fehler ? true : undefined}
        className={cn(
          'select bg-surface-hover text-ui text-ink h-9 w-full rounded-sm border pl-3 font-normal outline-none',
          'ease-brand focus:border-signal transition-[border-color] duration-[var(--t-1)] disabled:cursor-not-allowed disabled:opacity-45',
          fehler ? 'border-danger' : 'border-line-strong',
          className,
        )}
        {...rest}
      >
        {platzhalter ? (
          <option value="" disabled>
            {platzhalter}
          </option>
        ) : null}
        {optionen
          ? optionen.map((o) => (
              <option key={o.value} value={o.value} disabled={o.disabled}>
                {o.label}
              </option>
            ))
          : children}
      </select>
      {fehler ? (
        <p className="text-small text-danger" role="alert">
          {fehler}
        </p>
      ) : null}
    </div>
  )
}
