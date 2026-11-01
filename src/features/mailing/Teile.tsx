// Gemeinsame Bausteine der Mailing-Seiten (01.11.2026): Unternavigation, Abschnitte, Kopier-Zeilen, „Warum?“-Kästen.
import { Check, ChevronDown, Copy, HelpCircle } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { NavLink } from 'react-router'
import { PFADE } from '@/app/pfade'
import { toast } from '@/components/toast'
import { cn } from '@/components/ui/cn'
import { kopieren } from '@/lib/zwischenablage'

const BEREICHE = [
  { pfad: PFADE.emailKampagnen, label: 'Kampagnen' },
  { pfad: PFADE.emailAntworten, label: 'Antworten' },
  { pfad: PFADE.emailPostfaecher, label: 'Postfächer' },
  { pfad: PFADE.email, label: 'Einzelmails', ende: true },
] as const

/** Leiste der E-Mail-Bereiche (auch auf dem Handy und in der Icon-Leiste erreichbar). */
export function MailNav({ antworten }: { antworten?: number }) {
  return (
    <nav aria-label="E-Mail-Bereiche" className="border-line mb-6 flex [scrollbar-width:none] overflow-x-auto border-b">
      {BEREICHE.map((b) => (
        <NavLink
          key={b.pfad}
          to={b.pfad}
          end={'ende' in b}
          className={({ isActive }) =>
            cn(
              'text-ui -mb-px flex h-10 shrink-0 items-center gap-1.5 border-b-2 px-3 whitespace-nowrap transition-colors',
              isActive ? 'border-signal text-ink-bright' : 'text-ink-2 hover:text-ink border-transparent',
            )
          }
        >
          {b.label}
          {b.label === 'Antworten' && antworten ? (
            <span className="bg-signal text-signal-ink tnum rounded-full px-1.5 text-[11px] leading-[18px] font-semibold">
              {antworten}
            </span>
          ) : null}
        </NavLink>
      ))}
    </nav>
  )
}

export function Abschnitt({
  titel,
  satz,
  rechts,
  children,
  className,
}: {
  titel: string
  satz?: ReactNode
  rechts?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('mb-10', className)} aria-label={titel}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-h3 text-ink-bright">{titel}</h2>
          {satz ? <p className="text-small text-ink-3 mt-0.5 max-w-[75ch]">{satz}</p> : null}
        </div>
        {rechts ? <div className="flex flex-wrap items-center gap-2">{rechts}</div> : null}
      </div>
      {children}
    </section>
  )
}

/** Aufklappbares „Warum?“ – Mike soll verstehen, wozu ein Schritt gut ist (Wunsch Vincent, 30.10.2026). */
export function Warum({ children, label = 'Warum?' }: { children: ReactNode; label?: string }) {
  const [offen, setOffen] = useState(false)
  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        aria-expanded={offen}
        className="text-small text-tag-gelb-ink hover:text-ink inline-flex items-center gap-1"
      >
        <HelpCircle size={14} aria-hidden />
        {label}
        <ChevronDown size={13} aria-hidden className={cn('transition-transform', offen && 'rotate-180')} />
      </button>
      {offen ? (
        <div className="bg-tag-gelb text-small text-ink mt-1.5 max-w-[75ch] rounded-sm px-3 py-2">{children}</div>
      ) : null}
    </div>
  )
}

/** Wert zum Kopieren (DNS-Eintrag, Name) mit Knopf – kein Code zum Abtippen. */
export function KopierFeld({ label, wert }: { label?: string; wert: string }) {
  const [kopiert, setKopiert] = useState(false)
  return (
    <div className="min-w-0">
      {label ? <span className="text-ink-3 block text-[12px]">{label}</span> : null}
      <div className="border-line-strong bg-surface-hover mt-0.5 flex min-w-0 items-center gap-2 rounded-sm border py-1 pr-1 pl-2.5">
        <span className="font-code min-w-0 flex-1 truncate text-[12.5px]" title={wert}>
          {wert}
        </span>
        <button
          type="button"
          aria-label={`${label ?? 'Wert'} kopieren`}
          onClick={() =>
            void kopieren(wert).then((r) => {
              setKopiert(r === 'ok')
              toast(r === 'ok' ? 'Kopiert' : 'Text markiert – ⌘C')
              setTimeout(() => setKopiert(false), 2000)
            })
          }
          className={cn(
            'text-small inline-flex h-7 shrink-0 items-center gap-1 rounded-xs px-2 transition-colors',
            kopiert ? 'bg-done-tint text-done' : 'text-ink-2 hover:bg-surface-pressed hover:text-ink',
          )}
        >
          {kopiert ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
          {kopiert ? 'Kopiert' : 'Kopieren'}
        </button>
      </div>
    </div>
  )
}

/** Punkt mit Text (DNS-Ampel, Status): grün = ok, orange = ok mit Hinweis bzw. bald ok (`warn`), rot = fehlt. */
export function Ampel({ ok, warn, children }: { ok: boolean; warn?: boolean; children: ReactNode }) {
  return (
    <span className="text-small inline-flex min-w-0 items-center gap-1.5">
      <span
        className={cn('size-2 shrink-0 rounded-full', warn ? 'bg-overdue' : ok ? 'bg-done' : 'bg-danger')}
        aria-hidden
      />
      <span className="min-w-0">{children}</span>
    </span>
  )
}

export function Leer({ titel, satz, children }: { titel: string; satz?: ReactNode; children?: ReactNode }) {
  return (
    <div className="border-line-strong rounded-md border border-dashed px-5 py-6 text-center">
      <p className="text-ui text-ink-bright">{titel}</p>
      {satz ? <p className="text-small text-ink-3 mx-auto mt-1 max-w-[60ch]">{satz}</p> : null}
      {children ? <div className="mt-3 flex justify-center gap-2">{children}</div> : null}
    </div>
  )
}
