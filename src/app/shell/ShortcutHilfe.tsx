import * as RD from '@radix-ui/react-dialog'
import { Search } from 'lucide-react'
import { useState } from 'react'
import { passtSuche } from '@/app/befehle'
import { TASTEN } from '@/app/tasten'
import { useUiStore } from '@/app/uiStore'
import { Kbd } from '@/components/ui/Kbd'
import { ALLGEMEIN } from '@/texte/de'

/** `?`-Overlay (DESIGN-SYSTEM § 5.23): wie Palette, zweispaltig (Gruppe label, Zeile 32 px), Suchfeld oben; Inhalt = src/app/tasten.ts. */
export function ShortcutHilfe() {
  const offen = useUiStore((s) => s.hilfeOffen)
  const setOffen = useUiStore((s) => s.setHilfeOffen)
  const [q, setQ] = useState('')
  const gruppen = TASTEN.map((g) => ({
    ...g,
    eintraege: g.eintraege.filter((e) => passtSuche(`${e.beschreibung} ${e.tasten.join(' ')}`, q)),
  })).filter((g) => g.eintraege.length > 0)

  return (
    <RD.Root
      open={offen}
      onOpenChange={(o) => {
        setOffen(o)
        if (!o) setQ('')
      }}
    >
      <RD.Portal>
        <RD.Overlay className="bg-canvas/50 fixed inset-0 z-[60]" />
        <RD.Content className="bg-surface-raised shadow-float fixed top-[14vh] left-1/2 z-[61] max-h-[72vh] w-[min(720px,calc(100vw-32px))] -translate-x-1/2 animate-[pop-in_var(--t-3)_var(--ease-brand)] overflow-auto rounded-lg px-6 py-5 outline-none max-md:inset-0 max-md:top-0 max-md:max-h-none max-md:w-auto max-md:translate-x-0 max-md:rounded-none">
          <div className="flex items-center gap-3">
            <RD.Title className="text-h2 text-ink-bright">{ALLGEMEIN.tastenkuerzel}</RD.Title>
            <RD.Description className="sr-only">Alle Tastenkürzel, durchsuchbar</RD.Description>
            <span className="flex-1" />
            <div className="border-line-strong bg-surface-hover focus-within:border-signal flex h-[34px] max-w-[240px] items-center gap-2 rounded-sm border px-2.5">
              <Search size={14} strokeWidth={1.75} aria-hidden className="text-ink-3" />
              <input
                autoFocus
                type="search"
                placeholder="Taste oder Aktion …"
                aria-label="Tasten durchsuchen"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="text-ui placeholder:text-ink-4 min-w-0 flex-1 bg-transparent font-normal outline-none"
              />
            </div>
            <Kbd>Esc</Kbd>
          </div>
          <div className="mt-3.5 grid grid-cols-2 gap-x-8 gap-y-2 max-md:grid-cols-1">
            {gruppen.map((g) => (
              <div key={g.gruppe}>
                <span className="label mt-2.5 mb-1 block">{g.gruppe}</span>
                {g.eintraege.map((e) => (
                  <div
                    key={`${g.gruppe}:${e.beschreibung}`}
                    className="border-line text-ui text-ink-2 flex h-8 items-center justify-between gap-3 border-b"
                  >
                    <span className="truncate-1 min-w-0 font-normal">{e.beschreibung}</span>
                    <span className="flex flex-none gap-1">
                      {e.tasten.map((t) =>
                        t.includes(' ') && t.length <= 5 ? <Kbd key={t} akkord={t} /> : <Kbd key={t}>{t}</Kbd>,
                      )}
                    </span>
                  </div>
                ))}
              </div>
            ))}
            {gruppen.length === 0 ? <p className="text-small text-ink-3 py-4">Nichts gefunden.</p> : null}
          </div>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  )
}
