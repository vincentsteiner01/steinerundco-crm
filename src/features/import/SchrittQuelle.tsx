// BAUPLAN § 3.8 SchrittQuelle: Presets als Zeilen 56 px (Name text-h3, Erwartungstext small ink-3, Chevron; LinkedIn-Export disabled „v1.1“)
// + Dropzone (gestrichelt line-strong, Radius md, 120 px; XLSX/CSV ≤ 10 MB) + Link Schnellimport + letzte Importe.
import { ChevronRight, Upload } from 'lucide-react'
import { useId, useRef, useState, type DragEvent } from 'react'
import { useNavigate } from 'react-router'
import { PFADE } from '@/app/pfade'
import { useImportBatches } from '@/data'
import { Button, Chip, cn, Kbd } from '@/components/ui'
import { fmtDatum, fmtZahl } from '@/lib/format'
import { PRESETS, type PresetKey } from './presets'
import type { ImportApi } from './useImport'

export function SchrittQuelle({ api }: { api: ImportApi }) {
  const navigate = useNavigate()
  const { state, info } = api
  const [ueber, setUeber] = useState(false)
  const eingabe = useRef<HTMLInputElement | null>(null)
  const id = useId()
  const batches = useImportBatches()

  const datei = (f: File | undefined) => {
    if (f) void api.setzeDatei(f)
  }
  const drop = (e: DragEvent) => {
    e.preventDefault()
    setUeber(false)
    datei(e.dataTransfer.files[0])
  }
  const accept = info
    ? info.dateiarten.map((a) => (a === 'xlsx' ? '.xlsx,.xlsm,.xls' : '.csv,.tsv,.txt')).join(',')
    : '.xlsx,.xls,.csv'

  return (
    <div className="grid max-w-[880px] gap-7">
      <section aria-labelledby={`${id}-presets`}>
        <h2 id={`${id}-presets`} className="label mb-2 block">
          Preset
        </h2>
        <div role="radiogroup" aria-label="Preset" className="border-line-strong rounded-md border">
          {PRESETS.map((p) => {
            const aktiv = state.preset === p.key
            const aus = !!p.deaktiviert
            return (
              <button
                key={p.key}
                type="button"
                role="radio"
                aria-checked={aktiv}
                aria-disabled={aus || undefined}
                disabled={aus}
                onClick={() => api.waehlePreset(p.key as PresetKey)}
                className={cn(
                  'hairline flex min-h-14 w-full items-center gap-4 px-4 py-2 text-left last:border-b-0',
                  'ease-brand transition-[background] duration-[var(--t-1)]',
                  aus ? 'cursor-not-allowed opacity-45' : 'hover:bg-surface-hover',
                  aktiv && 'bg-surface-hover cursor-bar',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="text-h3 text-ink flex items-center gap-2">
                    {p.name}
                    {aus ? <Chip ton="later">{p.deaktiviert}</Chip> : null}
                  </span>
                  <span className="text-small text-ink-3 block">{p.erwartung}</span>
                </span>
                <ChevronRight size={16} strokeWidth={1.75} aria-hidden className="text-deco shrink-0" />
              </button>
            )
          })}
        </div>
      </section>

      <section aria-labelledby={`${id}-datei`}>
        <h2 id={`${id}-datei`} className="label mb-2 block">
          Datei
        </h2>
        <label
          htmlFor={`${id}-input`}
          onDragOver={(e) => {
            e.preventDefault()
            setUeber(true)
          }}
          onDragLeave={() => setUeber(false)}
          onDrop={drop}
          className={cn(
            'border-line-strong text-ui text-ink-2 flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 text-center',
            'ease-brand hover:border-ink transition-[border-color,background] duration-[var(--t-1)]',
            ueber && 'bg-surface-hover border-signal',
            !state.preset && 'opacity-45',
          )}
        >
          <Upload size={18} strokeWidth={1.75} aria-hidden className="text-ink-3" />
          {state.quelle ? (
            <span className="text-ink">
              {state.quelle.name}{' '}
              <span className="text-ink-3 tnum font-mono text-[12px]">
                · {fmtZahl(Math.round(state.quelle.groesse / 1024))} kB
              </span>
            </span>
          ) : (
            <span>{state.preset ? 'Datei hierher ziehen oder auswählen' : 'Erst ein Preset wählen'}</span>
          )}
          <span className="text-small text-ink-3">XLSX oder CSV, maximal 10 MB</span>
          <input
            ref={eingabe}
            id={`${id}-input`}
            type="file"
            accept={accept}
            disabled={!state.preset}
            aria-label="Datei auswählen"
            className="sr-only"
            onChange={(e) => {
              datei(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </label>
        {state.fehler ? (
          <p role="alert" className="text-small text-danger mt-2">
            {state.fehler}
          </p>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Button variante="quiet" kbd="⌘⇧O" onClick={() => navigate(PFADE.schnellimport(PFADE.import))}>
          Schnellimport (Text einfügen)
        </Button>
      </div>

      {batches.data && batches.data.length > 0 ? (
        <section aria-labelledby={`${id}-letzte`}>
          <h2 id={`${id}-letzte`} className="label mb-2 block">
            Letzte Importe
          </h2>
          <ul className="border-line-strong rounded-md border">
            {batches.data.slice(0, 8).map((b) => (
              <li key={b.id} className="hairline last:border-b-0">
                <button
                  type="button"
                  onClick={() => navigate(PFADE.importErgebnis(b.id))}
                  className="hover:bg-surface-hover flex min-h-10 w-full items-center gap-3 px-4 py-1.5 text-left"
                >
                  <span className="text-ink-3 tnum font-mono text-[12.5px]">{fmtDatum(b.created_at)}</span>
                  <span className="text-ui text-ink min-w-0 flex-1 truncate">{b.label ?? b.preset ?? b.source}</span>
                  <span className="text-ink-2 tnum font-mono text-[12.5px]">
                    {fmtZahl(b.inserted ?? 0)} neu · {fmtZahl(b.updated ?? 0)} aktualisiert
                  </span>
                  {b.undone_at ? <Chip ton="ended">rückgängig</Chip> : null}
                  <Kbd>↵</Kbd>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
