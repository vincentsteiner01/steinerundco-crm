// Mini-Auszeichnung der Handbuch-Texte (Inhalt bleibt Daten, durchsuchbar):
//   {C} · {G H} · {⌘⇧O}  → Taste(n)            **fett**  → betont
//   [Leads](/leads)       → interner Link       {{geplant}} → Chip „geplant“
import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Chip } from '@/components/ui/Chip'
import { cn } from '@/components/ui/cn'
import { MUSTER, tastenTeile } from './markup'

/**
 * Taste wie `kbd` (DESIGN-SYSTEM § 3.4), aber als `span`: im Handbuch ist die Taste Information und bleibt auch auf Touch
 * sichtbar (die globale Regel blendet `kbd` dort aus).
 */
export function Taste({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'text-ink-2 border-line-strong tnum inline-block min-w-5 rounded-xs border px-[5px] py-0.5 text-center align-[1px] font-mono text-[11px] leading-none tracking-[0.02em] whitespace-nowrap',
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Akkord „G H“ → zwei Tasten mit 4 px Abstand; „1–9“, „⌘⇧O“ → eine Taste. */
export function Tasten({ wert }: { wert: string }) {
  const teile = tastenTeile(wert)
  return (
    <span className="inline-flex items-center gap-0.5 align-baseline">
      {teile.map((t, i) => (
        <Taste key={i}>{t}</Taste>
      ))}
    </span>
  )
}

/** Mehrere Tasten/Akkorde einer Zeile: „G H · G L · G P“ – Akkorde zusammen, Alternativen mit Punkt getrennt. */
export function TastenFolge({ tasten, className }: { tasten: readonly string[]; className?: string }) {
  const mitPunkt = tasten.some((t) => tastenTeile(t).length > 1)
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-x-1 gap-y-1', className)}>
      {tasten.map((t, i) => (
        <span key={t} className="inline-flex items-center gap-1">
          {i > 0 && mitPunkt ? (
            <span aria-hidden className="text-ink-3 px-0.5">
              ·
            </span>
          ) : null}
          <Tasten wert={t} />
        </span>
      ))}
    </span>
  )
}

export function Inline({ text }: { text: string }) {
  const teile = text.split(MUSTER)
  return (
    <>
      {teile.map((t, i) => {
        if (!t) return null
        if (t === '{{geplant}}')
          return (
            <Chip key={i} ton="later" className="mx-0.5 align-[1px]">
              geplant
            </Chip>
          )
        if (t.startsWith('{') && t.endsWith('}')) return <Tasten key={i} wert={t.slice(1, -1)} />
        if (t.startsWith('**') && t.endsWith('**'))
          return (
            <strong key={i} className="text-ink font-medium">
              {t.slice(2, -2)}
            </strong>
          )
        const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(t)
        if (link)
          return (
            <Link
              key={i}
              to={link[2]!}
              className="text-ink decoration-line-strong hover:decoration-ink underline underline-offset-[3px] transition-[text-decoration-color] duration-[var(--t-1)]"
            >
              {link[1]}
            </Link>
          )
        return <Fragment key={i}>{t}</Fragment>
      })}
    </>
  )
}
