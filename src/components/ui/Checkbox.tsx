import type { InputHTMLAttributes, ReactNode, Ref } from 'react'
import { cn } from './cn'

export type CheckboxProps = {
  /** Beschriftung rechts neben dem Kästchen */
  label?: ReactNode
  ref?: Ref<HTMLInputElement>
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

/** Natives `<input type="checkbox">` 16 px, appearance none, gefüllt = 8-px-Quadrat ink (BAUPLAN § 1.5 Nr. 21, Styles in base.css). */
export function Checkbox({ label, className, ref, ...rest }: CheckboxProps) {
  const feld = <input ref={ref} type="checkbox" className={cn('checkbox', !label && className)} {...rest} />
  if (!label) return feld
  return (
    <label
      className={cn(
        'text-ui text-ink-2 flex cursor-pointer items-center gap-2.5 has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-45',
        className,
      )}
    >
      {feld}
      <span>{label}</span>
    </label>
  )
}
