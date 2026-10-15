// oxlint-disable react/only-export-components -- kuerzel/istMike gehören zur Komponente
import type { HTMLAttributes, Ref } from 'react'
import { cn } from './cn'

/** Strukturell kompatibel zu `Member` (View crm.members) und zum Auth-Member (public.members). */
export type AvatarMember = {
  id?: string | null
  user_id?: string | null
  display_name?: string | null
  short_name?: string | null
  initial?: string | null
  email?: string | null
}

type AvatarProps = {
  member: AvatarMember | null | undefined
  groesse?: 22 | 28
  zweiter?: AvatarMember | null
  ref?: Ref<HTMLSpanElement>
} & HTMLAttributes<HTMLSpanElement>

export function kuerzel(m: AvatarMember | null | undefined): string {
  if (!m) return ''
  if (m.short_name) return m.short_name.toUpperCase()
  const name = m.display_name ?? m.email?.split('@')[0] ?? ''
  const teile = name.split(/[\s.]+/).filter(Boolean)
  if (teile.length >= 2) return `${teile[0]?.[0] ?? ''}${teile[1]?.[0] ?? ''}`.toUpperCase()
  return (m.initial ?? name.slice(0, 2)).toUpperCase()
}

/** Mike = canvas auf ink-bright, Vincent (und alle anderen) = Papier auf surface-pressed (DESIGN-SYSTEM § 3.3). */
export function istMike(m: AvatarMember | null | undefined): boolean {
  if (!m) return false
  const k = kuerzel(m)
  return k === 'MM' || /^mike/i.test(m.display_name ?? '') || /^mike@/i.test(m.email ?? '')
}

function Einzel({
  m,
  groesse,
  className,
}: {
  m: AvatarMember | null | undefined
  groesse: 22 | 28
  className?: string
}) {
  const frei = !m
  const mike = istMike(m)
  const name = m?.display_name ?? 'Frei'
  return (
    <span
      className={cn(
        'tnum inline-grid flex-none place-items-center rounded-full font-mono tracking-[0.02em]',
        groesse === 28 ? 'h-7 w-7 text-[11px]' : 'h-[22px] w-[22px] text-[10px]',
        frei
          ? 'border-line-strong text-ink-3 border border-dashed bg-transparent'
          : mike
            ? 'bg-ink-bright text-canvas'
            : 'bg-surface-pressed text-ink',
        className,
      )}
      title={frei ? 'Frei' : name}
      aria-label={frei ? 'Frei' : name}
    >
      {frei ? '' : kuerzel(m)}
    </span>
  )
}

/** Avatar 22/28 px (DESIGN-SYSTEM § 3.3, § 5.4). `zweiter` = Sales-Verantwortlich, halb überlappend (−6 px, 2-px-Ring). Nie Fotos. */
export function Avatar({ member, groesse = 22, zweiter, className, ref, ...rest }: AvatarProps) {
  if (zweiter) {
    return (
      <span className={cn('inline-flex items-center', className)} ref={ref} {...rest}>
        <Einzel m={member} groesse={groesse} />
        <Einzel m={zweiter} groesse={groesse} className="-ml-1.5 shadow-[0_0_0_2px_var(--color-surface)]" />
      </span>
    )
  }
  return <Einzel m={member} groesse={groesse} className={className} />
}
