import type { HTMLAttributes, Ref } from 'react'
import { cn } from './cn'

type KbdProps = { akkord?: string; ref?: Ref<HTMLElement> } & HTMLAttributes<HTMLElement>

/** Tastenhinweis (DESIGN-SYSTEM § 3.4/§ 5.4): `<Kbd>E</Kbd>` · `<Kbd akkord="G H"/>` (zwei kbd, 4 px Abstand). Auf Touch per CSS ausgeblendet. */
export function Kbd({ akkord, children, className, ref, ...rest }: KbdProps) {
  if (akkord) {
    const teile = akkord.split(' ')
    return (
      <span className={cn('inline-flex items-center gap-1', className)} ref={ref as Ref<HTMLSpanElement>} {...rest}>
        {teile.map((t, i) => (
          <kbd key={i} className="kbd">
            {t}
          </kbd>
        ))}
      </span>
    )
  }
  return (
    <kbd className={cn('kbd', className)} ref={ref} {...rest}>
      {children}
    </kbd>
  )
}
