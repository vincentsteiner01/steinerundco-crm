import type { ButtonHTMLAttributes, Ref } from 'react'
import { cn } from './cn'

export type SwitchProps = {
  checked: boolean
  onCheckedChange: (an: boolean) => void
  label?: string
  ref?: Ref<HTMLButtonElement>
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'>

/** `<button role="switch" aria-checked>` 28 × 16 px, Bahn line-strong, Knopf 12 px ink; an = Bahn ink + Knopf canvas. Kein Lime (DESIGN-SYSTEM § 5.2). */
export function Switch({ checked, onCheckedChange, label, className, ref, ...rest }: SwitchProps) {
  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'ease-brand relative inline-flex h-4 w-7 flex-none items-center rounded-full border transition-[background,border-color] duration-[var(--t-1)] disabled:cursor-not-allowed disabled:opacity-45',
        checked ? 'border-ink bg-ink' : 'border-line-strong bg-transparent',
        className,
      )}
      {...rest}
    >
      <span
        aria-hidden
        className={cn(
          'ease-brand absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full transition-[left,background] duration-[var(--t-1)]',
          checked ? 'bg-canvas left-[13px]' : 'bg-ink left-[1px]',
        )}
      />
    </button>
  )
}
