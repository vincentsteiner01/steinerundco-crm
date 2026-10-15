import { Mail, Phone } from 'lucide-react'
import type { HTMLAttributes, Ref } from 'react'
import type { Channel } from '@/types/domain'
import { cn } from './cn'

type GlyphProps = { kanal: Channel; aktiv?: boolean; ref?: Ref<HTMLSpanElement> } & HTMLAttributes<HTMLSpanElement>

/** Kanal-Glyph (DESIGN-SYSTEM § 3.3): LinkedIn = Mono-Glyphe „in“ im 16-px-Rahmen, Telefon/E-Mail = lucide 16 px. Keine Farbe. */
export function Glyph({ kanal, aktiv, className, ref, ...rest }: GlyphProps) {
  const farbe = aktiv ? 'text-ink' : 'text-ink-3'
  if (kanal === 'linkedin') {
    return (
      <span
        className={cn('glyph', aktiv && 'text-ink', className)}
        aria-label="LinkedIn"
        title="LinkedIn"
        ref={ref}
        {...rest}
      >
        in
      </span>
    )
  }
  const Icon = kanal === 'telefon' ? Phone : kanal === 'email' ? Mail : null
  const label = kanal === 'telefon' ? 'Telefon' : kanal === 'email' ? 'E-Mail' : 'Sonstiges'
  return (
    <span
      className={cn('inline-flex h-4 items-center', farbe, className)}
      aria-label={label}
      title={label}
      ref={ref}
      {...rest}
    >
      {Icon ? <Icon size={16} strokeWidth={1.75} aria-hidden /> : <span className="glyph">·</span>}
    </span>
  )
}
