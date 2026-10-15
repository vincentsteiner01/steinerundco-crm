// oxlint-disable react/only-export-components -- kuerzel/istMike gehören zur Komponente
import { useState, type HTMLAttributes, type Ref } from 'react'
import { PERSONEN } from '@/features/auth/personen'
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

export type AvatarGroesse = 22 | 28 | 36 | 48

type AvatarProps = {
  member: AvatarMember | null | undefined
  groesse?: AvatarGroesse
  zweiter?: AvatarMember | null
  ref?: Ref<HTMLSpanElement>
} & HTMLAttributes<HTMLSpanElement>

/** Person aus dem festen Register (Vincent, Mike) – über E-Mail oder Anzeigename. */
export function personVon(m: AvatarMember | null | undefined) {
  if (!m) return undefined
  const mail = m.email?.toLowerCase()
  return PERSONEN.find(
    (p) => p.email === mail || (m.display_name && p.name.toLowerCase() === m.display_name.toLowerCase()),
  )
}

/** Profilfoto unter /avatars/<id>.webp (192 px, aus LinkedIn, von Vincent am 15.10.2026 freigegeben). */
export function fotoVon(m: AvatarMember | null | undefined): string | undefined {
  const p = personVon(m)
  return p ? `/avatars/${p.id}.webp` : undefined
}

export function kuerzel(m: AvatarMember | null | undefined): string {
  if (!m) return ''
  // Echte Daten: crm.members.short_name ist der Vorname („Vincent“), nicht das Kürzel – Register gewinnt.
  const person = personVon(m)
  if (person) return person.initialen
  if (m.short_name && m.short_name.length <= 3) return m.short_name.toUpperCase()
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
  groesse: AvatarGroesse
  className?: string
}) {
  const frei = !m
  const mike = istMike(m)
  const name = m?.display_name ?? 'Frei'
  const foto = fotoVon(m)
  const [fotoKaputt, setFotoKaputt] = useState(false)
  const mitFoto = Boolean(foto) && !fotoKaputt
  const masse =
    groesse === 48
      ? 'h-12 w-12 text-[15px]'
      : groesse === 36
        ? 'h-9 w-9 text-[12px]'
        : groesse === 28
          ? 'h-7 w-7 text-[11px]'
          : 'h-[22px] w-[22px] text-[10px]'
  return (
    <span
      className={cn(
        'tnum inline-grid flex-none place-items-center overflow-hidden rounded-full font-mono tracking-[0.02em]',
        masse,
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
      {frei ? (
        ''
      ) : mitFoto ? (
        <img
          src={foto}
          alt=""
          className="h-full w-full object-cover"
          draggable={false}
          onError={() => setFotoKaputt(true)}
        />
      ) : (
        kuerzel(m)
      )}
    </span>
  )
}

/** Avatar 22/28/36/48 px (DESIGN-SYSTEM § 3.3, § 5.4). `zweiter` = Sales-Verantwortlich, halb überlappend (−6 px, 2-px-Ring).
 * Fotos: Vincent wollte am 15.10.2026 echte Profilbilder (schlägt DESIGN-SYSTEM „nie Fotos“); Kürzel bleibt Fallback. */
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
