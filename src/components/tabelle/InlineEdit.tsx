import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { LeadStage, PhaseKey, Settings } from '@/types/domain'
import { PHASE_LABEL, STUFEN_LABEL } from '@/texte/de'
import { cn } from '@/components/ui/cn'
import { DatePicker } from '@/components/ui/DatePicker'
import type { SelectOption } from '@/components/ui/Select'
import { parseDatumEingabeTag } from '@/lib/datumEingabe'
import { fmtDatumKurz, heuteBerlin } from '@/lib/format'
import { phaseVon } from '@/lib/stufen'
import { monatePlus, tagPlus } from '@/lib/zeit'

export type InlineEditArt = 'text' | 'select' | 'datum' | 'textarea' | 'phase' | 'zustaendig'

export type InlineEditProps = {
  art: InlineEditArt
  /** Aktueller Wert (ISO-Datum bei `datum`, Stufe bei `phase`, Member-ID oder null bei `zustaendig`) */
  wert: string | null
  /** `select`: Optionen · `zustaendig`: Mitglieder (value = id, label = Name); „Frei“ wird ergänzt */
  optionen?: SelectOption[]
  onSave: (wert: string | null) => void
  onCancel: () => void
  /** `Tab`/`⇧Tab`: speichern und zur nächsten/vorigen editierbaren Zelle (DataTable, ux § 3.2.2) */
  onTab?: (richtung: 1 | -1) => void
  /** `phase`: Feinstufen-Labels aus settings.stage_labels (Fallback de.ts) */
  settings?: Settings | null
  placeholder?: string
  ariaLabel?: string
  mono?: boolean
  className?: string
}

const PHASEN_REIHENFOLGE: PhaseKey[] = [
  'angefragt',
  'vernetzt',
  'eroeffnet',
  'beantwortet',
  'gepitcht',
  'erstgespraech',
  'strategiegespraech',
  'kunde',
  'wiedervorlage',
  'beendet',
]
const STUFEN = Object.keys(STUFEN_LABEL) as LeadStage[]

const DATUM_PRESETS: { label: string; wert: (heute: string) => string }[] = [
  { label: 'Heute', wert: (h) => h },
  { label: '+3 T', wert: (h) => tagPlus(h, 3) },
  { label: '+7 T', wert: (h) => tagPlus(h, 7) },
  { label: '+14 T', wert: (h) => tagPlus(h, 14) },
  { label: '+3 Mo', wert: (h) => monatePlus(h, 3) },
]

/** Zelle blinkt nach dem Speichern einmal Sage (DESIGN-SYSTEM § 3.8 „Zellen-Blink“ 400 ms). */
function blinke(el: HTMLElement | null) {
  const zelle = el?.closest('td, [data-zelle]') as HTMLElement | null
  if (!zelle) return
  zelle.classList.remove('animate-flash-done')
  // Reflow, damit die Animation erneut startet
  void zelle.offsetWidth
  zelle.classList.add('animate-flash-done')
  window.setTimeout(() => zelle.classList.remove('animate-flash-done'), 450)
}

const FELD =
  'bg-surface-hover border-signal text-ink h-[30px] min-w-0 flex-1 rounded-sm border px-2 text-[13.5px] outline-none placeholder:text-ink-4'
const SELECT =
  'select bg-surface-raised border-signal text-ink h-[30px] min-w-0 flex-1 rounded-sm border pl-2 text-[13.5px] outline-none'

/**
 * Inline-Edit in Zeilenhöhe (DESIGN-SYSTEM § 5.10): Input in der Zelle (surface-hover, Rahmen Lime), rechts `↵` `esc` als kbd.
 * `Enter`/Blur speichert, `Esc` verwirft, `Tab` speichert und springt weiter (`onTab`), Zelle blinkt Sage.
 * - text: einzeiliges Input · textarea: wächst, `⌘Enter` speichert · select / zustaendig: natives Select, Änderung speichert sofort
 * - datum: Texteingabe (`+3`, `14.10.`, `mo`) mit Vorschau `→ Sa 17.10.` + Presets Heute · +3 T · +7 T · +14 T · +3 Mo · Kalender
 * - phase: Select über alle 16 Stufen, gruppiert nach den 10 Phasen (BAUPLAN § 1.5 Nr. 1); Folgefragen (Datum/Grund) stellt das Modul nach `onSave`
 */
export function InlineEdit({
  art,
  wert,
  optionen = [],
  onSave,
  onCancel,
  onTab,
  settings,
  placeholder,
  ariaLabel,
  mono,
  className,
}: InlineEditProps) {
  const [text, setText] = useState(wert ?? '')
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const feldRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>(null)
  const fertig = useRef(false)
  const heute = heuteBerlin()

  useEffect(() => {
    const el = feldRef.current
    if (!el) return
    el.focus()
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.select()
  }, [])

  const speichere = (v: string | null) => {
    if (fertig.current) return
    fertig.current = true
    blinke(wrapRef.current)
    onSave(v)
  }
  const abbrechen = () => {
    if (fertig.current) return
    fertig.current = true
    onCancel()
  }
  const tab = (richtung: 1 | -1, v: string | null) => {
    if (fertig.current) return
    fertig.current = true
    blinke(wrapRef.current)
    onSave(v)
    onTab?.(richtung)
  }

  const textWert = () => (text.trim() === '' ? null : text)
  const datumWert = () => (text.trim() === '' ? null : (parseDatumEingabeTag(text, heute) ?? wert))

  const tasten = (e: ReactKeyboardEvent<HTMLElement>, aktuellerWert: () => string | null, mehrzeilig = false) => {
    e.stopPropagation()
    if (e.key === 'Escape') {
      e.preventDefault()
      abbrechen()
      return
    }
    if (e.key === 'Tab' && onTab) {
      e.preventDefault()
      tab(e.shiftKey ? -1 : 1, aktuellerWert())
      return
    }
    if (e.key === 'Enter') {
      if (mehrzeilig && !(e.metaKey || e.ctrlKey)) return
      e.preventDefault()
      speichere(aktuellerWert())
    }
  }
  // Blur speichert – außer der Fokus wandert in das Presets-Popover derselben Zelle (Datum)
  const blur = (aktuellerWert: () => string | null) => (e: React.FocusEvent) => {
    if (wrapRef.current?.contains(e.relatedTarget as Node | null)) return
    // Radix-Popover (Kalender) liegt im Portal: offen = nicht speichern
    if (document.querySelector('[data-radix-popper-content-wrapper]')) return
    speichere(aktuellerWert())
  }

  const hinweise = (
    <span className="flex shrink-0 items-center gap-1" aria-hidden>
      <kbd className="kbd">↵</kbd>
      <kbd className="kbd">esc</kbd>
    </span>
  )

  if (art === 'textarea') {
    return (
      <div ref={wrapRef} className={cn('relative z-10 flex items-start gap-1.5 py-1', className)}>
        <textarea
          ref={(el) => {
            feldRef.current = el
          }}
          aria-label={ariaLabel ?? 'Notiz'}
          value={text}
          placeholder={placeholder}
          rows={2}
          onChange={(e) => {
            setText(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = `${Math.max(30, e.target.scrollHeight)}px`
          }}
          onKeyDown={(e) => tasten(e, textWert, true)}
          onBlur={blur(textWert)}
          className={cn(FELD, 'textarea h-auto min-h-[30px] resize-none py-1 leading-[1.4]')}
        />
        <span className="flex shrink-0 items-center gap-1 pt-1" aria-hidden>
          <kbd className="kbd">⌘</kbd>
          <kbd className="kbd">↵</kbd>
          <kbd className="kbd">esc</kbd>
        </span>
      </div>
    )
  }

  if (art === 'select' || art === 'zustaendig') {
    const liste: SelectOption[] = art === 'zustaendig' ? [...optionen, { value: '', label: 'Frei' }] : optionen
    return (
      <div ref={wrapRef} className={cn('relative z-10 flex items-center gap-1.5', className)}>
        <select
          ref={(el) => {
            feldRef.current = el
          }}
          aria-label={ariaLabel ?? (art === 'zustaendig' ? 'Zuständig' : 'Auswahl')}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            speichere(e.target.value === '' ? null : e.target.value)
          }}
          onKeyDown={(e) => tasten(e, () => (text === '' ? null : text))}
          onBlur={() => abbrechen()}
          className={SELECT}
        >
          {art === 'select' && !liste.some((o) => o.value === text) ? <option value="">–</option> : null}
          {liste.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        {hinweise}
      </div>
    )
  }

  if (art === 'phase') {
    const feinLabel = (s: LeadStage) => settings?.stage_labels?.[s]?.label ?? STUFEN_LABEL[s].label
    return (
      <div ref={wrapRef} className={cn('relative z-10 flex items-center gap-1.5', className)}>
        <select
          ref={(el) => {
            feldRef.current = el
          }}
          aria-label={ariaLabel ?? 'Phase'}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            speichere(e.target.value)
          }}
          onKeyDown={(e) => tasten(e, () => text || null)}
          onBlur={() => abbrechen()}
          className={SELECT}
        >
          {PHASEN_REIHENFOLGE.map((phase) => (
            <optgroup key={phase} label={PHASE_LABEL[phase]}>
              {STUFEN.filter((s) => phaseVon(s).key === phase).map((s) => (
                <option key={s} value={s}>
                  {feinLabel(s)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {hinweise}
      </div>
    )
  }

  if (art === 'datum') {
    const vorschau = text.trim() ? parseDatumEingabeTag(text, heute) : null
    return (
      <div ref={wrapRef} className={cn('relative z-10', className)}>
        <div className="flex items-center gap-1.5">
          <input
            ref={(el) => {
              feldRef.current = el
            }}
            aria-label={ariaLabel ?? 'Datum'}
            value={text}
            placeholder={placeholder ?? '14.10. · +3 · mo'}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => tasten(e, datumWert)}
            onBlur={blur(datumWert)}
            className={cn(FELD, 'tnum font-mono text-[13px]')}
          />
          <span
            className={cn('tnum font-mono text-[12px] whitespace-nowrap', vorschau ? 'text-ink-3' : 'text-ink-4')}
            aria-live="polite"
          >
            {vorschau ? `→ ${fmtDatumKurz(vorschau)}` : text.trim() ? '?' : wert ? fmtDatumKurz(wert) : ''}
          </span>
          {hinweise}
        </div>
        <div
          role="group"
          aria-label="Presets"
          className="bg-surface-raised shadow-float absolute top-[calc(100%+4px)] left-0 z-20 flex min-w-[260px] flex-wrap items-center gap-1 rounded-md p-1.5"
        >
          {DATUM_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => speichere(p.wert(heute))}
              className="border-line-strong text-small hover:bg-surface-hover inline-flex h-7 items-center rounded-sm border px-2.5 font-medium"
            >
              {p.label}
            </button>
          ))}
          <DatePicker
            wert={wert ? wert.slice(0, 10) : null}
            onChange={(iso) => speichere(iso)}
            placeholder="Kalender"
            className="h-7 w-auto text-[12.5px]"
          />
          {wert ? (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => speichere(null)}
              className="text-small text-ink-3 hover:bg-surface-hover hover:text-ink h-7 rounded-sm px-2"
            >
              Entfernen
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div ref={wrapRef} className={cn('relative z-10 flex items-center gap-1.5', className)}>
      <input
        ref={(el) => {
          feldRef.current = el
        }}
        aria-label={ariaLabel ?? 'Wert'}
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => tasten(e, textWert)}
        onBlur={blur(textWert)}
        className={cn(FELD, mono && 'tnum font-mono text-[13px]')}
      />
      {hinweise}
    </div>
  )
}
