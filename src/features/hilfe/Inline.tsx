// Mini-Auszeichnung der Handbuch-Texte (Inhalt bleibt Daten, durchsuchbar):
//   **fett** → betont      [Leads](/leads) → interner Link      {{geplant}} → Chip „geplant“
// 25.11.2026: Tasten (`{C}`, `{G H}`) gibt es im Handbuch nicht mehr.
import { Fragment } from 'react'
import { Link } from 'react-router'
import { Chip } from '@/components/ui/Chip'
import { LINK, MUSTER } from './markup'

const GANZER_LINK = new RegExp(`^${LINK.source}$`)

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
        if (t.startsWith('**') && t.endsWith('**'))
          return (
            <strong key={i} className="text-ink font-medium">
              {t.slice(2, -2)}
            </strong>
          )
        const link = GANZER_LINK.exec(t)
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
