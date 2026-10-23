// Formatleiste über dem Leitfaden-Text (23.10.2026, wie in Mikes Editor): B · I · U · Kundenantwort (blau) · Markieren ·
// Normaler Text/Überschrift · • Liste · 1. Liste · Format löschen · Rückgängig. Wirkt auf die Auswahl der Textarea.
import {
  Bold,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  MessageCircleReply,
  RemoveFormatting,
  Underline,
  Undo2,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { cn } from '@/components/ui/cn'
import { formatLoeschen, umschliessen, zeilenPraefix, type Ergebnis } from './formatAktionen'

function Knopf({
  icon: Icon,
  label,
  onClick,
  disabled,
  text,
}: {
  icon?: LucideIcon
  label: string
  onClick: () => void
  disabled?: boolean
  text?: string
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      // Auswahl in der Textarea behalten
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'text-ink-2 hover:bg-surface-hover hover:text-ink inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-xs px-1.5 text-[12.5px]',
        'disabled:pointer-events-none disabled:opacity-40',
      )}
    >
      {Icon ? <Icon size={15} strokeWidth={1.75} aria-hidden /> : null}
      {text ? <span>{text}</span> : null}
    </button>
  )
}

export function FormatLeiste({
  feld,
  text,
  onText,
  disabled,
}: {
  feld: RefObject<HTMLTextAreaElement | null>
  text: string
  onText: (t: string) => void
  disabled?: boolean
}) {
  const verlauf = useRef<string[]>([])
  const [kannZurueck, setKannZurueck] = useState(false)
  const [ueberschrift, setUeberschrift] = useState(false)

  // „Normaler Text / Überschrift“ folgt der Zeile, in der der Cursor steht
  useEffect(() => {
    const pruefen = () => {
      const el = feld.current
      if (!el || document.activeElement !== el) return
      const von = el.value.lastIndexOf('\n', Math.max(0, el.selectionStart - 1)) + 1
      setUeberschrift(/^#{1,3}[ \t]+/.test(el.value.slice(von)))
    }
    document.addEventListener('selectionchange', pruefen)
    return () => document.removeEventListener('selectionchange', pruefen)
  }, [feld])

  const anwenden = (f: (t: string, s: number, e: number) => Ergebnis) => {
    const el = feld.current
    const start = el?.selectionStart ?? text.length
    const ende = el?.selectionEnd ?? text.length
    const r = f(text, start, ende)
    if (r.text === text) return
    verlauf.current = [...verlauf.current.slice(-29), text]
    setKannZurueck(true)
    onText(r.text)
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      el.setSelectionRange(r.start, r.ende)
    })
  }

  const zurueck = () => {
    const vorher = verlauf.current.pop()
    setKannZurueck(verlauf.current.length > 0)
    if (vorher !== undefined) onText(vorher)
  }

  return (
    <div
      role="toolbar"
      aria-label="Formatierung"
      className="border-line bg-sidebar mb-1.5 flex flex-wrap items-center gap-0.5 rounded-sm border px-1 py-1"
    >
      <Knopf
        icon={Bold}
        label="Fett"
        onClick={() => anwenden((t, s, e) => umschliessen(t, s, e, '**'))}
        disabled={disabled}
      />
      <Knopf
        icon={Italic}
        label="Kursiv"
        onClick={() => anwenden((t, s, e) => umschliessen(t, s, e, '*'))}
        disabled={disabled}
      />
      <Knopf
        icon={Underline}
        label="Unterstrichen"
        onClick={() => anwenden((t, s, e) => umschliessen(t, s, e, '__'))}
        disabled={disabled}
      />
      <span className="bg-line mx-1 h-4 w-px" aria-hidden />
      <Knopf
        icon={MessageCircleReply}
        label="Kundenantwort (blau)"
        text="Kundenantwort"
        onClick={() => anwenden((t, s, e) => zeilenPraefix(t, s, e, 'kunde'))}
        disabled={disabled}
      />
      <Knopf
        icon={Highlighter}
        label="Markieren"
        text="Markieren"
        onClick={() => anwenden((t, s, e) => umschliessen(t, s, e, '=='))}
        disabled={disabled}
      />
      <span className="bg-line mx-1 h-4 w-px" aria-hidden />
      <select
        aria-label="Textart"
        disabled={disabled}
        value={ueberschrift ? 'ueberschrift' : 'normal'}
        onMouseDown={() => feld.current?.focus()}
        onChange={(e) => {
          const ziel = e.target.value === 'ueberschrift'
          if (ziel !== ueberschrift) anwenden((t, s, en) => zeilenPraefix(t, s, en, 'ueberschrift'))
          setUeberschrift(ziel)
        }}
        className="text-ink-2 hover:bg-surface-hover h-7 rounded-xs bg-transparent px-1.5 text-[12.5px]"
      >
        <option value="normal">Normaler Text</option>
        <option value="ueberschrift">Überschrift</option>
      </select>
      <Knopf
        icon={List}
        label="Liste"
        text="Liste"
        onClick={() => anwenden((t, s, e) => zeilenPraefix(t, s, e, 'liste'))}
        disabled={disabled}
      />
      <Knopf
        icon={ListOrdered}
        label="Nummerierte Liste"
        text="1. Liste"
        onClick={() => anwenden((t, s, e) => zeilenPraefix(t, s, e, 'nummern'))}
        disabled={disabled}
      />
      <span className="bg-line mx-1 h-4 w-px" aria-hidden />
      <Knopf
        icon={RemoveFormatting}
        label="Format löschen"
        onClick={() => anwenden(formatLoeschen)}
        disabled={disabled}
      />
      <Knopf icon={Undo2} label="Rückgängig" onClick={zurueck} disabled={disabled || !kannZurueck} />
    </div>
  )
}
