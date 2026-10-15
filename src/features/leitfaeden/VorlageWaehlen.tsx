// BAUPLAN § 3.7 / § 3.1.10a – Vorlage wählen: Popover mit Befehlsliste (cmdk), Gruppen nach Phase mit Untertitel
// (`beschreibung` aus phasen.ts, § 1.5 Nr. 41), Einträge Name + Quote Mono, aktueller Eintrag markiert, Suche ab 8 Einträgen.
// Entscheidung (Konfliktregel): § 3.7 sagt „DropdownMenu“, Suche + Gruppen-Untertitel brauchen eine Befehlsliste → Popover + cmdk.
import * as RP from '@radix-ui/react-popover'
import { Command } from 'cmdk'
import { Check, Search } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { cn } from '@/components/ui/cn'
import { useTemplatePerformance, useTemplates } from '@/data/templates'
import { fmtProzent } from '@/lib/format'
import type { Channel, Template, TemplatePhase } from '@/types/domain'
import { sortiert } from './helfer'
import { labelTeile, phasenFuer } from './phasen'

export const SUCHE_AB = 8

export type VorlageWaehlenProps = {
  kanal: Channel
  phase?: TemplatePhase
  aktuellId?: string
  onSelect: (t: Template) => void
  trigger: ReactNode
  /** Gesteuert (optional) – Standard: intern */
  offen?: boolean
  onOpenChange?: (offen: boolean) => void
  align?: 'start' | 'center' | 'end'
}

export function VorlageWaehlen({
  kanal,
  phase,
  aktuellId,
  onSelect,
  trigger,
  offen,
  onOpenChange,
  align = 'start',
}: VorlageWaehlenProps) {
  const [internOffen, setInternOffen] = useState(false)
  const istOffen = offen ?? internOffen
  const setOffen = (o: boolean) => {
    setInternOffen(o)
    onOpenChange?.(o)
  }
  const { data: vorlagen } = useTemplates({ channel: kanal, phase, active: true })
  const { data: perf } = useTemplatePerformance()
  const quoteVon = useMemo(() => {
    const m = new Map<string, number | null>()
    for (const p of perf ?? []) if (p.template_id && p.gesendet) m.set(p.template_id, p.antwort_quote)
    return m
  }, [perf])

  const gruppen = useMemo(() => {
    const liste = sortiert(vorlagen ?? [], kanal)
    const phasen = phasenFuer(kanal)
    const nachPhase = new Map<TemplatePhase, Template[]>()
    for (const t of liste) nachPhase.set(t.phase, [...(nachPhase.get(t.phase) ?? []), t])
    const bekannt = phasen
      .filter((p) => nachPhase.has(p.key))
      .map((p) => ({ def: p, vorlagen: nachPhase.get(p.key) ?? [] }))
    // Phasen, die phasen.ts für diesen Kanal nicht kennt (z. B. verschobene Vorlagen), hinten anfügen
    const fremd = [...nachPhase.keys()]
      .filter((k) => !phasen.some((p) => p.key === k))
      .map((k) => ({ def: { key: k, label: k, beschreibung: '' }, vorlagen: nachPhase.get(k) ?? [] }))
    return [...bekannt, ...fremd]
  }, [vorlagen, kanal])
  const anzahl = vorlagen?.length ?? 0
  const mitSuche = anzahl >= SUCHE_AB

  return (
    <RP.Root open={istOffen} onOpenChange={setOffen}>
      <RP.Trigger asChild>{trigger}</RP.Trigger>
      <RP.Portal>
        <RP.Content
          align={align}
          side="bottom"
          sideOffset={6}
          collisionPadding={8}
          onOpenAutoFocus={(e) => {
            if (!mitSuche) e.preventDefault()
          }}
          className={cn(
            'bg-surface-raised shadow-float z-[65] w-[min(360px,calc(100vw-16px))] rounded-md p-0 outline-none',
            'data-[state=open]:animate-[pop-in_var(--t-3)_var(--ease-brand)]',
          )}
          aria-label="Vorlage wählen"
        >
          <Command
            label="Vorlage wählen"
            loop
            className="outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOffen(false)
            }}
          >
            {mitSuche ? (
              <div className="border-line flex h-10 items-center gap-2 border-b px-3">
                <Search size={14} strokeWidth={1.75} aria-hidden className="text-ink-3" />
                <Command.Input
                  autoFocus
                  placeholder="Leitfaden suchen …"
                  aria-label="Leitfaden suchen"
                  className="placeholder:text-ink-4 text-ui min-w-0 flex-1 bg-transparent font-normal outline-none"
                />
              </div>
            ) : null}
            <Command.List className="max-h-[min(50vh,420px)] overflow-auto p-1.5">
              <Command.Empty className="text-small text-ink-3 px-2.5 py-4">
                {anzahl === 0 ? 'Keine aktive Vorlage für diesen Kanal.' : 'Nichts gefunden.'}
              </Command.Empty>
              {gruppen.map(({ def, vorlagen: liste }) => {
                const { ziffer, text } = labelTeile(def.label)
                return (
                  <Command.Group
                    key={def.key}
                    value={def.key}
                    heading={
                      <span className="block px-2.5 pt-2 pb-1">
                        <span className="label flex items-center gap-1.5">
                          {ziffer ? <span className="tnum font-mono">{ziffer}</span> : null}
                          {text}
                        </span>
                        {def.beschreibung ? (
                          <span className="text-small text-ink-3 block tracking-normal normal-case">
                            {def.beschreibung}
                          </span>
                        ) : null}
                      </span>
                    }
                    className="[&+[cmdk-group]]:border-line [&+[cmdk-group]]:mt-1 [&+[cmdk-group]]:border-t"
                  >
                    {liste.map((t) => {
                      const aktuell = t.id === aktuellId
                      const quote = quoteVon.get(t.id)
                      return (
                        <Command.Item
                          key={t.id}
                          value={t.id}
                          keywords={[t.name, text, t.when_to_use ?? '']}
                          onSelect={() => {
                            setOffen(false)
                            onSelect(t)
                          }}
                          aria-current={aktuell ? 'true' : undefined}
                          data-aktuell={aktuell || undefined}
                          className={cn(
                            'text-ui data-[selected=true]:cursor-bar flex h-9 cursor-default items-center gap-2.5 rounded-sm px-2.5 font-normal',
                            aktuell ? 'text-ink-bright' : 'text-ink',
                          )}
                        >
                          <span className="min-w-0 flex-1 truncate">{t.name}</span>
                          {quote !== undefined ? (
                            <span className="text-ink-3 tnum font-mono text-[12px]">
                              {quote === null ? '–' : fmtProzent(quote)}
                            </span>
                          ) : null}
                          {aktuell ? <Check size={14} strokeWidth={1.75} aria-hidden className="text-signal" /> : null}
                        </Command.Item>
                      )
                    })}
                  </Command.Group>
                )
              })}
            </Command.List>
            <div className="border-line text-ink-3 flex h-8 items-center gap-3 border-t px-3 text-[12px]">
              <span className="inline-flex items-center gap-1">
                <kbd className="kbd">↑</kbd>
                <kbd className="kbd">↓</kbd> wählen
              </span>
              <span className="inline-flex items-center gap-1">
                <kbd className="kbd">↵</kbd> übernehmen
              </span>
              <span className="ml-auto inline-flex items-center gap-1">
                <kbd className="kbd">Esc</kbd>
              </span>
            </div>
          </Command>
        </RP.Content>
      </RP.Portal>
    </RP.Root>
  )
}
