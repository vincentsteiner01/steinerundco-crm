// BAUPLAN § 3.7 Vorschau.tsx – „Vorschau mit …“ (useLeadSuche), gefüllter Text im Nachrichten-Block, offene Platzhalter Amber,
// manuelle Platzhalter als Felder, `C` kopiert (lib/zwischenablage) – gesperrt, solange Platzhalter offen sind (§ 3.1.9a, LF-03).
import { Search, X } from 'lucide-react'
import { useId, useMemo, useRef, useState } from 'react'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cn } from '@/components/ui/cn'
import { useLead, useLeadSuche } from '@/data/leads'
import { useMe } from '@/data/members'
import { useHotkeys } from '@/lib/keyboard'
import { fuellen, tokens, type PlatzhalterKontext, type PlatzhalterLead } from '@/lib/platzhalter'
import { kopieren } from '@/lib/zwischenablage'
import { TOAST } from '@/texte/de'
import type { Channel, LeadMitBezug } from '@/types/domain'
import { istManuell, kopierGrund, segmente, type Segment } from './editorHelfer'

export type VorschauProps = {
  kanal: Channel
  subject: string
  body: string
  /** Gewählter Lead (`?vorschau=`); mit `onLeadChange` gesteuert, sonst nur Startwert */
  leadId?: string | null
  onLeadChange?: (leadId: string | null) => void
  /** `C` kopiert (Scope karte); aus, wenn ein anderer Bereich die Taste hat */
  mitTaste?: boolean
}

/** Letztes stattgefundenes Gespräch (für `[Gesprächsdatum]`). */
function letztesGespraech(lead: LeadMitBezug | null | undefined): PlatzhalterKontext['meeting'] {
  const m = (lead?.meetings ?? [])
    .filter((x) => x.status === 'stattgefunden')
    .sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at))[0]
  return m ? { scheduled_at: m.scheduled_at, status: m.status } : null
}

export function Vorschau({ kanal, subject, body, leadId, onLeadChange, mitTaste = true }: VorschauProps) {
  const id = useId()
  const [q, setQ] = useState('')
  const [intern, setIntern] = useState<string | null>(leadId ?? null)
  const gewaehlt = onLeadChange ? (leadId ?? null) : intern
  const [werte, setWerte] = useState<Record<string, string>>({})
  const [kopiert, setKopiert] = useState(false)
  const timer = useRef<number | null>(null)

  const { data: treffer, isFetching } = useLeadSuche(q)
  const { data: lead } = useLead(gewaehlt)
  const me = useMe()

  const ctx = useMemo<PlatzhalterKontext>(
    () => ({ werte, me: me ?? null, meeting: letztesGespraech(lead) }),
    [werte, me, lead],
  )
  const leadDaten = useMemo<PlatzhalterLead>(() => lead ?? {}, [lead])
  const voll = kanal === 'email' && subject ? `${subject}\n\n${body}` : body
  const ergebnis = useMemo(() => fuellen(voll, leadDaten, ctx), [voll, leadDaten, ctx])
  const grund = kopierGrund(ergebnis.offen)
  const manuell = useMemo(() => tokens(voll).filter(istManuell), [voll])

  const kopierenJetzt = async () => {
    if (grund) {
      toast(`${grund}.`)
      return
    }
    const r = await kopieren(ergebnis.text)
    toast(r === 'ok' ? TOAST.kopiert : 'Text markiert – ⌘C zum Kopieren.')
    setKopiert(true)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setKopiert(false), 2000)
  }

  useHotkeys('karte', mitTaste ? { c: () => void kopierenJetzt() } : {}, [ergebnis.text, grund, mitTaste])

  const waehlen = (lid: string | null) => {
    setIntern(lid)
    setQ('')
    onLeadChange?.(lid)
  }

  const bodySegmente = segmente(body, leadDaten, ctx)
  const subjectSegmente = kanal === 'email' && subject ? segmente(subject, leadDaten, ctx) : null
  const gefuellt = Object.keys(ergebnis.gefuellt).length

  return (
    <section aria-labelledby={`${id}-h`} className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <h3 id={`${id}-h`} className="label">
          Vorschau mit …
        </h3>
        {lead ? (
          <span className="border-line-strong text-ui inline-flex h-7 items-center gap-1.5 rounded-xs border pr-1 pl-2.5">
            <span className="text-ink-bright font-serif italic">{lead.full_name ?? '–'}</span>
            {lead.company_name ? <span className="text-small text-ink-3">{lead.company_name}</span> : null}
            <button
              type="button"
              aria-label="Lead entfernen"
              onClick={() => waehlen(null)}
              className="text-ink-3 hover:text-ink inline-flex h-5 w-5 items-center justify-center rounded-xs"
            >
              <X size={12} strokeWidth={1.75} aria-hidden />
            </button>
          </span>
        ) : (
          <div className="relative w-[280px] max-w-full">
            <Input
              id={`${id}-lead`}
              aria-label="Lead für die Vorschau suchen"
              placeholder="Lead suchen …"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              rechts={<Search size={14} strokeWidth={1.75} aria-hidden className="text-ink-3" />}
              autoComplete="off"
            />
            {q.trim().length >= 2 ? (
              <div
                role="listbox"
                aria-label="Treffer"
                className="bg-surface-raised shadow-float absolute top-full left-0 z-[65] mt-1.5 w-full rounded-md p-1.5"
              >
                {treffer?.length ? (
                  treffer.slice(0, 8).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => waehlen(t.id)}
                      className="text-ui hover:bg-surface-hover flex h-9 w-full items-center gap-2.5 rounded-sm px-2.5 text-left font-normal"
                    >
                      <span className="text-ink-bright truncate font-serif text-[16px] italic">
                        {t.full_name ?? '–'}
                      </span>
                      {t.company_name ? <span className="text-small text-ink-3 truncate">{t.company_name}</span> : null}
                    </button>
                  ))
                ) : (
                  <span className="text-small text-ink-3 block px-2.5 py-2">
                    {isFetching ? 'Suche …' : `Nichts gefunden für ‚${q.trim()}‘.`}
                  </span>
                )}
              </div>
            ) : null}
          </div>
        )}
        <span className="ml-auto">
          <Button
            variante="secondary"
            groesse="S"
            kbd="C"
            copied={kopiert}
            disabled={!!grund}
            disabledGrund={grund ?? undefined}
            onClick={() => void kopierenJetzt()}
          >
            Kopieren
          </Button>
        </span>
      </div>

      {manuell.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2" aria-label="Manuelle Platzhalter">
          {manuell.map((n) => (
            <label key={n} className="grid gap-1.5">
              <span className="label">[{n}]</span>
              <Input
                value={werte[n] ?? ''}
                onChange={(e) => setWerte((w) => ({ ...w, [n]: e.target.value }))}
                placeholder={`${n} eintragen`}
              />
            </label>
          ))}
        </div>
      ) : null}

      <div className="border-line bg-surface-hover max-w-[64ch] rounded-sm border" data-offen={ergebnis.offen.length}>
        <div className="border-line text-ink-3 tnum flex min-h-7 flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-1 font-mono text-[11.5px] tracking-[0.02em]">
          <span>
            Platzhalter{' '}
            <span className={cn(ergebnis.offen.length ? 'text-overdue' : 'text-ink-2')}>
              {gefuellt}/{gefuellt + ergebnis.offen.length}
            </span>{' '}
            gefüllt
          </span>
          {!lead ? <span>ohne Lead</span> : null}
        </div>
        <div className="px-4 py-3.5 text-[15px] leading-[1.55] whitespace-pre-wrap">
          {subjectSegmente ? (
            <p className="text-ink-bright mb-3 font-medium">
              <Segmente teile={subjectSegmente} />
            </p>
          ) : null}
          <p>
            <Segmente teile={bodySegmente} />
          </p>
        </div>
      </div>
    </section>
  )
}

function Segmente({ teile }: { teile: Segment[] }) {
  return (
    <>
      {teile.map((s, i) =>
        s.art === 'text' ? (
          <span key={i}>{s.wert}</span>
        ) : s.art === 'gefuellt' ? (
          <mark
            key={i}
            data-ph="gefuellt"
            title={`aus ${s.name}`}
            className="decoration-line-strong bg-transparent text-inherit underline decoration-dotted decoration-1 underline-offset-[3px]"
          >
            {s.wert}
          </mark>
        ) : (
          <mark
            key={i}
            data-ph="offen"
            title={`${s.name} fehlt`}
            className="bg-overdue-tint text-overdue border-overdue rounded-xs border-b border-dotted px-1"
          >
            {s.wert}
          </mark>
        ),
      )}
    </>
  )
}
