// M3 – Skript (BAUPLAN § 3.4 Skript.tsx, DESIGN-SYSTEM § 5.13): Tabs Zentrale · Einstieg · Problem · Qualifizierung · Pitch ·
// Einwände · Abschluss · Mailbox · Datenschutz (Tab/⇧Tab); Vorlagen Kanal telefon je Phase; Platzhalter gefüllt (lib/platzhalter),
// offene amber markiert. Logik in skript.ts.
import { ChevronDown } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'
import { cn } from '@/components/ui/cn'
import { Segment } from '@/components/ui/Segment'
import { Select } from '@/components/ui/Select'
import { Tabs } from '@/components/ui/Tabs'
import { platzhalterWert, type PlatzhalterKontext, type PlatzhalterLead } from '@/lib/platzhalter'
import type { CallBasis, Template } from '@/types/domain'
import { SKRIPT_TABS, skriptVorlagen, type SkriptTab } from './skriptLogik'

/** Bis zu dieser Gesamtlänge der Vorlagennamen passt das Segment in die 318-px-Skriptspalte. */
const VORLAGEN_SEGMENT_MAX = 32

/**
 * Neun Phasen als Raster 3 × 3 (Runde 3): in der 318-px-Spalte (1440) und der halben Breite (1024) brachen die Tabs
 * ungleichmäßig um (3/3/3 bzw. 4/4/1, „Datenschutz“ allein). Das Raster hält jede Phase an fester Stelle – Zentrale · Einstieg ·
 * Problem / Qualifizierung · Pitch · Einwände / Abschluss · Mailbox · Datenschutz – alle sichtbar, nichts scrollt quer.
 * Kind-Selektoren (Spezifität 0,2,0) überstimmen `flex`/`px-3` der gemeinsamen Tabs-Komponente ohne `!important`.
 */
const PHASEN_RASTER =
  '[&>[role=tablist]]:grid [&>[role=tablist]]:grid-cols-3 [&_[role=tab]]:min-w-0 [&_[role=tab]]:justify-center [&_[role=tab]]:px-2'

const TOKEN = /(\[[^[\]\n]{1,40}\])/

/** Text mit markierten Platzhaltern: gefüllt = `mark`, offen = amber (DESIGN-SYSTEM: offener Platzhalter = overdue). */
export function GefuellterText({ body, lead, ctx }: { body: string; lead: PlatzhalterLead; ctx?: PlatzhalterKontext }) {
  const norm = body.replace(/\b(Herr|Frau)\s+\[Nachname\]/g, '[Anrede] [Nachname]')
  const absaetze = norm.split(/\n{2,}/)
  return (
    <>
      {absaetze.map((abs, ai) => (
        <p key={ai} className="mb-[0.8em] last:mb-0">
          {abs.split('\n').map((zeile, zi) => (
            <Fragment key={zi}>
              {zi > 0 ? <br /> : null}
              {zeile.split(TOKEN).map((teil, ti): ReactNode => {
                if (!TOKEN.test(teil)) return teil
                const name = teil.slice(1, -1).trim()
                const wert = platzhalterWert(name, lead, ctx)
                return wert === null ? (
                  <mark key={ti} className="text-overdue rounded-xs bg-transparent px-0.5" title={`${name} – offen`}>
                    {teil}
                  </mark>
                ) : (
                  <mark key={ti} className="bg-signal-tint text-ink rounded-xs px-0.5" title={`aus ${name}`}>
                    {wert}
                  </mark>
                )
              })}
            </Fragment>
          ))}
        </p>
      ))}
    </>
  )
}

export type SkriptProps = {
  templates: readonly Template[]
  lead: PlatzhalterLead & { call_basis?: CallBasis | null }
  ctx?: PlatzhalterKontext
  versuch: number
  tab: SkriptTab
  onTab: (t: SkriptTab) => void
  vorlageId: string | null
  onVorlage: (id: string | null) => void
  /** Mobil: eingeklappt über den Ergebnissen */
  eingeklappt?: boolean
  onToggle?: () => void
  className?: string
}

export function Skript({
  templates,
  lead,
  ctx,
  versuch,
  tab,
  onTab,
  vorlageId,
  onVorlage,
  eingeklappt,
  onToggle,
  className,
}: SkriptProps) {
  const liste = skriptVorlagen(templates, tab, { callBasis: lead.call_basis, versuch })
  const aktiv = liste.find((t) => t.id === vorlageId) ?? liste[0] ?? null
  return (
    <section
      aria-label="Skript"
      className={cn('bg-surface-raised border-line overflow-hidden rounded-md border', className)}
    >
      {onToggle ? (
        <button
          type="button"
          aria-expanded={!eingeklappt}
          onClick={onToggle}
          className="border-line flex h-10 w-full items-center gap-2 border-b px-3.5 text-left"
        >
          <span className="label">Skript</span>
          <span className="text-small text-ink-3">{SKRIPT_TABS.find((t) => t.key === tab)?.label}</span>
          <ChevronDown
            size={16}
            strokeWidth={1.75}
            aria-hidden
            className={cn(
              'text-ink-3 ease-brand ml-auto transition-transform duration-[var(--t-1)]',
              eingeklappt && '-rotate-90',
            )}
          />
        </button>
      ) : null}
      {eingeklappt ? null : (
        <>
          <div className={PHASEN_RASTER} data-testid="skript-phasen">
            <Tabs
              tabs={SKRIPT_TABS.map((t) => ({ key: t.key, label: t.label }))}
              wert={tab}
              onChange={onTab}
              ariaLabel="Skript-Phase"
              umbrechen
              className="px-1"
            />
          </div>
          <div className="px-4 py-3.5 text-[14px] leading-[1.5]">
            {liste.length > 1 && liste.reduce((n, t) => n + t.name.length, 0) > VORLAGEN_SEGMENT_MAX ? (
              // Lange Vorlagennamen: Select über die volle Breite statt eines rechts abgeschnittenen Segments (Runde 2, 1024)
              <Select
                aria-label="Vorlage"
                className="mb-3 h-8 w-full min-w-0"
                title={aktiv?.name}
                value={aktiv?.id ?? ''}
                onChange={(e) => onVorlage(e.target.value)}
                optionen={liste.map((t) => ({ value: t.id, label: t.name }))}
              />
            ) : liste.length > 1 ? (
              <Segment
                klein
                className="mb-3"
                ariaLabel="Vorlage"
                optionen={liste.map((t) => ({ key: t.id, label: t.name }))}
                wert={aktiv?.id ?? ''}
                onChange={(id) => onVorlage(id)}
              />
            ) : null}
            {aktiv ? (
              <div data-template-id={aktiv.id}>
                <GefuellterText body={aktiv.body} lead={lead} ctx={ctx} />
              </div>
            ) : (
              <p className="text-small text-ink-3">Kein Leitfaden für diese Phase – in Leitfäden anlegen.</p>
            )}
            <p className="text-ink-3 mt-3 flex flex-wrap items-center gap-1 text-[12px]">
              <kbd className="kbd">Tab</kbd> nächste Phase · <kbd className="kbd">⇧Tab</kbd> zurück · Platzhalter aus
              Lead und Anrufgrund
            </p>
          </div>
        </>
      )}
    </section>
  )
}
