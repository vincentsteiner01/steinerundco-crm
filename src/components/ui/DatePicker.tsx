import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { parseDatumEingabeTag } from '@/lib/datumEingabe'
import { fmtDatumKurz, heuteBerlin } from '@/lib/format'
import { monatePlus, naechsterWochentag, tagPlus } from '@/lib/zeit'
import { cn } from './cn'
import { Popover, PopoverClose } from './Popover'

export type DatePickerPreset = 'heute' | '+3' | '+7' | '+14' | '+3m' | 'morgen' | 'mo' | '+1w' | '+2m'
export type DatePickerProps = {
  /** ISO-Datum YYYY-MM-DD (mit `mitUhrzeit`: YYYY-MM-DDTHH:MM) oder null */
  wert: string | null
  onChange: (iso: string | null) => void
  presets?: DatePickerPreset[]
  mitUhrzeit?: boolean
  /** ISO-Datum, vor dem nichts wählbar ist */
  min?: string
  placeholder?: string
  className?: string
  id?: string
  disabled?: boolean
  /** Popover beim ersten Rendern geöffnet (ux § 2.5 Schritt 3: Picker klappt sofort auf) – FOUNDATION-WUNSCH M3 */
  autoOffen?: boolean
}

const PRESET_LABEL: Record<DatePickerPreset, string> = {
  heute: 'Heute',
  '+3': '+3 T',
  '+7': '+7 T',
  '+14': '+14 T',
  '+3m': '+3 Mo',
  morgen: 'Morgen',
  mo: 'Nächster Mo',
  '+1w': '+1 W',
  '+2m': '+2 Mo',
}
function presetDatum(p: DatePickerPreset, heute: string): string {
  switch (p) {
    case 'heute':
      return heute
    case 'morgen':
      return tagPlus(heute, 1)
    case 'mo':
      return naechsterWochentag(heute, 1)
    case '+3':
      return tagPlus(heute, 3)
    case '+7':
      return tagPlus(heute, 7)
    case '+14':
      return tagPlus(heute, 14)
    case '+1w':
      return tagPlus(heute, 7)
    case '+2m':
      return monatePlus(heute, 2)
    case '+3m':
      return monatePlus(heute, 3)
  }
}

const MONATE = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
]

/** Mini-Kalender: Mono, Tage 32 px, heute Lime-Ring, gewählt Lime-Fläche (DESIGN-SYSTEM § 5.20). */
function Kalender({
  gewaehlt,
  heute,
  min,
  onPick,
}: {
  gewaehlt: string | null
  heute: string
  min?: string
  onPick: (iso: string) => void
}) {
  const [monat, setMonat] = useState((gewaehlt ?? heute).slice(0, 7))
  const [y, m] = monat.split('-').map(Number) as [number, number]
  const tage = useMemo(() => {
    const erster = new Date(Date.UTC(y, m - 1, 1))
    const offset = (erster.getUTCDay() + 6) % 7 // Mo = 0
    const anzahl = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const zellen: (string | null)[] = Array.from({ length: offset }, () => null)
    for (let t = 1; t <= anzahl; t++) zellen.push(`${y}-${String(m).padStart(2, '0')}-${String(t).padStart(2, '0')}`)
    while (zellen.length % 7) zellen.push(null)
    return zellen
  }, [y, m])
  const wechsel = (d: number) => {
    const n = new Date(Date.UTC(y, m - 1 + d, 1))
    setMonat(`${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  return (
    <div className="px-1 pt-2 pb-1">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <button
          type="button"
          aria-label="Voriger Monat"
          onClick={() => wechsel(-1)}
          className="text-ink-2 hover:bg-surface-hover hover:text-ink grid h-7 w-7 place-items-center rounded-sm"
        >
          <ChevronLeft size={14} strokeWidth={1.75} aria-hidden />
        </button>
        <span className="text-ink-2 tnum font-mono text-[12.5px]">
          {MONATE[m - 1]} {y}
        </span>
        <button
          type="button"
          aria-label="Nächster Monat"
          onClick={() => wechsel(1)}
          className="text-ink-2 hover:bg-surface-hover hover:text-ink grid h-7 w-7 place-items-center rounded-sm"
        >
          <ChevronRight size={14} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
      <div className="text-ink-3 tnum grid grid-cols-7 gap-px font-mono text-[11px]">
        {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((w) => (
          <span key={w} className="grid h-6 place-items-center">
            {w}
          </span>
        ))}
        {tage.map((iso, i) =>
          iso ? (
            <PopoverClose asChild key={iso}>
              <button
                type="button"
                disabled={!!min && iso < min}
                aria-label={iso}
                aria-current={iso === heute ? 'date' : undefined}
                aria-pressed={iso === gewaehlt}
                onClick={() => onPick(iso)}
                className={cn(
                  'text-ink ease-brand hover:bg-surface-hover grid h-8 w-8 place-items-center rounded-sm text-[12.5px] transition-[background] duration-[var(--t-1)] disabled:opacity-35',
                  iso === heute && 'ring-signal ring-1 ring-inset',
                  iso === gewaehlt && 'bg-signal text-signal-ink hover:bg-signal',
                  (i % 7 === 5 || i % 7 === 6) && iso !== gewaehlt && 'text-ink-3',
                )}
              >
                {Number(iso.slice(8, 10))}
              </button>
            </PopoverClose>
          ) : (
            <span key={`l${i}`} />
          ),
        )}
      </div>
    </div>
  )
}

/** Popover mit Presets + Mini-Kalender + Texteingabe (`14.10.`, `+3`, `+1w`, `mo`, `heute`, `morgen` – Vorschau rechts in Mono). */
export function DatePicker({
  wert,
  onChange,
  presets = ['heute', '+3', '+7', '+14', '+3m'],
  mitUhrzeit,
  min,
  placeholder = 'Datum',
  className,
  id,
  disabled,
  autoOffen,
}: DatePickerProps) {
  const heute = heuteBerlin()
  const [offen, setOffen] = useState(!!autoOffen && !disabled)
  const [text, setText] = useState('')
  const datumTeil = wert ? wert.slice(0, 10) : null
  const zeitTeil = wert && mitUhrzeit && wert.length >= 16 ? wert.slice(11, 16) : ''
  const vorschau = text ? parseDatumEingabeTag(text, heute) : null

  const setze = (iso: string | null, zeit?: string) => {
    if (!iso) return onChange(null)
    if (mitUhrzeit) return onChange(`${iso}T${zeit ?? zeitTeil ?? '09:00'}`.replace(/T$/, 'T09:00'))
    onChange(iso)
  }
  const anzeige = datumTeil ? `${fmtDatumKurz(datumTeil)}${zeitTeil ? ` ${zeitTeil}` : ''}` : placeholder

  return (
    <Popover
      offen={offen}
      onOpenChange={(o) => {
        setOffen(o)
        if (!o) setText('')
      }}
      className="w-[280px] max-w-[calc(100vw-16px)]"
      trigger={
        <button
          type="button"
          id={id}
          disabled={disabled}
          className={cn(
            'border-line-strong bg-surface-hover tnum ease-brand focus:border-signal flex h-9 w-full items-center gap-2 rounded-sm border px-3 text-left font-mono text-[13px] transition-[border-color] duration-[var(--t-1)] disabled:cursor-not-allowed disabled:opacity-45',
            datumTeil ? 'text-ink' : 'text-ink-4',
            className,
          )}
        >
          <CalendarDays size={16} strokeWidth={1.75} aria-hidden className="text-ink-3" />
          <span className="flex-1">{anzeige}</span>
        </button>
      }
    >
      <div className="grid gap-1.5 p-1">
        <div className="border-line-strong bg-surface-hover focus-within:border-signal flex h-8 items-center gap-2 rounded-sm border px-2">
          <input
            autoFocus
            aria-label="Datum eingeben"
            placeholder="14.10. · +3 · +1w · mo"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && vorschau) {
                e.preventDefault()
                setze(vorschau)
                setOffen(false)
              }
              e.stopPropagation()
            }}
            className="tnum placeholder:text-ink-4 min-w-0 flex-1 bg-transparent font-mono text-[13px] outline-none"
          />
          <span className={cn('tnum font-mono text-[12px] whitespace-nowrap', vorschau ? 'text-ink-3' : 'text-ink-4')}>
            {vorschau ? `→ ${fmtDatumKurz(vorschau)}` : text ? '?' : ''}
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {presets.map((p) => (
            <PopoverClose asChild key={p}>
              <button
                type="button"
                onClick={() => setze(presetDatum(p, heute))}
                className="border-line-strong text-small hover:bg-surface-hover inline-flex h-7 items-center rounded-sm border px-2.5 font-medium"
              >
                {PRESET_LABEL[p]}
              </button>
            </PopoverClose>
          ))}
        </div>
        <Kalender
          key={(datumTeil ?? heute).slice(0, 7)}
          gewaehlt={datumTeil}
          heute={heute}
          min={min}
          onPick={(iso) => setze(iso)}
        />
        {mitUhrzeit ? (
          <label className="text-small text-ink-3 flex items-center gap-2 px-1 pb-1">
            Uhrzeit
            <input
              type="time"
              value={zeitTeil || '09:00'}
              onChange={(e) => datumTeil && setze(datumTeil, e.target.value)}
              className="border-line-strong bg-surface-hover text-ink tnum focus:border-signal h-7 rounded-sm border px-2 font-mono text-[12.5px] outline-none"
            />
          </label>
        ) : null}
        {datumTeil ? (
          <PopoverClose asChild>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-small text-ink-3 hover:bg-surface-hover hover:text-ink h-7 rounded-sm px-2.5 text-left"
            >
              Datum entfernen
            </button>
          </PopoverClose>
        ) : null}
      </div>
    </Popover>
  )
}
