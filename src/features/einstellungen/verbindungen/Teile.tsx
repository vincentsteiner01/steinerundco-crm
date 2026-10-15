// Bausteine der Verbindungen-Seite: Abschnitt (text-h3 + Haarlinie wie Formular.Block, aber ohne <form> – darin stehen eigene
// Formulare), nummerierter Schritt (Ziffer Mono) und ein Kopier-Knopf mit 2-s-„Kopiert“-Zustand.
import { Copy } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, cn, type ButtonProps } from '@/components/ui'
import { toast } from '@/components/toast'
import { kopieren } from '@/lib/zwischenablage'

export function Abschnitt({
  id,
  titel,
  beschreibung,
  children,
  className,
}: {
  id: string
  titel: string
  beschreibung?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn('hairline-t grid max-w-[640px] gap-4 pt-5 pb-8 first:border-t-0 first:pt-0', className)}
    >
      <div className="grid gap-1">
        <h3 id={id} className="text-h3 text-ink-bright">
          {titel}
        </h3>
        {beschreibung ? <p className="text-small text-ink-3 max-w-[64ch]">{beschreibung}</p> : null}
      </div>
      {children}
    </section>
  )
}

export function Schritt({ nr, titel, children }: { nr: number; titel: string; children: ReactNode }) {
  return (
    <li className="hairline grid grid-cols-[28px_minmax(0,1fr)] gap-x-3 py-4 last:border-b-0">
      <span className="mono text-ink-3 pt-px" aria-hidden>
        {nr}
      </span>
      <div className="grid min-w-0 gap-2">
        <h4 className="text-ui text-ink">
          <span className="sr-only">Schritt {nr}: </span>
          {titel}
        </h4>
        {children}
      </div>
    </li>
  )
}

/** Fließtext eines Schritts: 14 px, ink-2, Lesebreite 64 ch; `klein` = Fußnote (small, ink-3). */
export function Text({ children, klein, className }: { children: ReactNode; klein?: boolean; className?: string }) {
  return (
    <p
      className={cn('max-w-[64ch]', klein ? 'text-small text-ink-3' : 'text-table text-ink-2 leading-[1.5]', className)}
    >
      {children}
    </p>
  )
}

/** Wert in Mono mit Rahmen (z. B. `CRM_SCHLUESSEL`, `einrichten`). */
export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="border-line-strong bg-surface-hover text-ink rounded-xs border px-1 py-px font-mono text-[12.5px]">
      {children}
    </code>
  )
}

export function KopierKnopf({
  text,
  children,
  meldung,
  ...rest
}: { text: string; /** Toast nach dem Kopieren (sonst zeigt nur der Knopf „Kopiert“) */ meldung?: string } & Omit<
  ButtonProps,
  'onClick' | 'copied'
>) {
  const [kopiert, setKopiert] = useState(false)
  const uhr = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(uhr.current), [])
  const klick = async () => {
    const r = await kopieren(text)
    if (r === 'ok') {
      setKopiert(true)
      if (meldung) toast(meldung)
      window.clearTimeout(uhr.current)
      uhr.current = window.setTimeout(() => setKopiert(false), 2000)
    } else {
      toast('Kopieren nicht möglich – Text markieren und ⌘C drücken.')
    }
  }
  return (
    <Button icon={Copy} copied={kopiert} onClick={() => void klick()} {...rest}>
      {children}
    </Button>
  )
}
