// Kleine Bausteine der Lead-Aktionen: Scope-Wechsel während ein Popover/Dialog offen ist, Standard-Auslöser,
// Auslöser-Hülle für Dialoge, Radio-Liste für Gründe/Umfang.
import type { ReactNode } from 'react'
import { Button, type ButtonProps } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'

/** Solange gerendert: Scope `formular` (Karten-Tasten aus, ⌘Enter/Esc bleiben). */
export { ScopeFormular } from '@/components/ui/ScopeFormular'

/** Standard-Auslöser einer Aktion: quiet, S, mit kbd. */
export function AktionButton({ className, ...rest }: ButtonProps) {
  return <Button variante="quiet" groesse="S" className={cn('shrink-0', className)} {...rest} />
}

/** Hülle um einen fremden `trigger` (Dialog-Aktionen haben keinen Radix-Trigger): Klick öffnet. */
export function TriggerHuelle({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <span className="contents" onClick={onClick}>
      {children}
    </span>
  )
}

export type RadioOption<K extends string> = { key: K; label: string; kbd?: string; hinweis?: string }

/** Native Radio-Liste (BAUPLAN § 1.5 Nr. 21): 36-px-Zeilen, kbd links, Pflicht über Validierung. */
export function RadioListe<K extends string>({
  name,
  optionen,
  wert,
  onChange,
  ariaLabel,
}: {
  name: string
  optionen: RadioOption<K>[]
  wert: K | null
  onChange: (k: K) => void
  ariaLabel: string
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="grid gap-0.5">
      {optionen.map((o) => (
        <label
          key={o.key}
          className={cn(
            'text-ui text-ink hover:bg-surface-hover flex h-9 cursor-pointer items-center gap-2.5 rounded-sm px-2.5',
            wert === o.key && 'bg-surface-hover',
          )}
        >
          <input
            type="radio"
            name={name}
            value={o.key}
            checked={wert === o.key}
            onChange={() => onChange(o.key)}
            className="checkbox"
          />
          {o.kbd ? <kbd className="kbd">{o.kbd}</kbd> : null}
          <span className="flex-1">{o.label}</span>
          {o.hinweis ? <span className="text-small text-ink-3">{o.hinweis}</span> : null}
        </label>
      ))}
    </div>
  )
}
