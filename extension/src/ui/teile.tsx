// Kleine Bausteine nach DESIGN-SYSTEM § 5: Knopf mit Taste, Chip, Avatar (Foto aus dem CRM), Zeit-Chip.
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { ZeitChip } from '../shared/zeit'
import type { MemberKurz, PersonId } from '../shared/typen'

type KnopfArt = 'primaer' | 'sekundaer' | 'leise'

export function Knopf({
  art = 'sekundaer',
  groesse,
  taste,
  voll,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  art?: KnopfArt
  groesse?: 'klein' | 'gross'
  taste?: string
  voll?: boolean
}) {
  const klassen = ['knopf', art !== 'sekundaer' ? art : '', groesse ?? '', voll ? 'voll' : '', className ?? '']
    .filter(Boolean)
    .join(' ')
  return (
    <button type="button" className={klassen} {...rest}>
      {children}
      {taste ? <kbd aria-hidden="true">{taste}</kbd> : null}
    </button>
  )
}

export function Chip({ ton, titel, children }: { ton?: string; titel?: string; children: ReactNode }) {
  return (
    <span className={`chip ${ton ?? ''}`} title={titel}>
      {children}
    </span>
  )
}

export function ZeitChipAnzeige({ chip }: { chip: ZeitChip | null }) {
  if (!chip) return null
  return (
    <Chip ton={chip.ton} titel={chip.titel}>
      {chip.text}
    </Chip>
  )
}

export function fotoVon(personId: PersonId | null | undefined): string | null {
  return personId ? `/avatars/${personId}.webp` : null
}

export function Avatar({
  member,
  groesse = 22,
  titel,
}: {
  member: Pick<MemberKurz, 'kuerzel' | 'personId' | 'name'> | null
  groesse?: number
  titel?: string
}) {
  const style = { width: groesse, height: groesse, fontSize: groesse >= 36 ? 12 : 10 }
  if (!member) return <span className="avatar frei" style={style} title={titel ?? 'Frei'} aria-label="Frei" />
  const foto = fotoVon(member.personId)
  return (
    <span
      className={`avatar ${member.personId === 'mike' ? 'mike' : ''}`}
      style={style}
      title={titel ?? member.name}
      aria-label={member.name}
    >
      {foto ? <img src={foto} alt="" /> : member.kuerzel}
    </span>
  )
}

export function Laden({ text = 'Lade …' }: { text?: string }) {
  return (
    <p className="laden" role="status">
      {text}
    </p>
  )
}

/** Einzeltasten nur, wenn kein Eingabefeld den Fokus hat. */
export function istEingabe(ziel: EventTarget | null): boolean {
  const el = ziel as HTMLElement | null
  if (!el) return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}
