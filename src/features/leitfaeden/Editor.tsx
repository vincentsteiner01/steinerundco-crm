// BAUPLAN § 3.7 Editor.tsx – Textarea `body` (+ `subject` bei E-Mail), Platzhalter als Chips neutral Mono,
// `[` öffnet die Autovervollständigung (PLATZHALTER aus lib/platzhalter, LF-04), ⌘Enter speichert.
import { useId, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { Chip } from '@/components/ui/Chip'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { cn } from '@/components/ui/cn'
import { istBekannterPlatzhalter, tokens } from '@/lib/platzhalter'
import type { Channel } from '@/types/domain'
import { platzhalterEinfuegen, platzhalterTreffer, quelleLabel } from './editorHelfer'

export type EditorWert = { subject: string; body: string }

export type EditorProps = {
  kanal: Channel
  wert: EditorWert
  onChange: (w: EditorWert) => void
  /** ⌘Enter */
  onSpeichern: () => void
  /** Ref auf die Textarea (für `E` = fokussieren) */
  textareaRef?: RefObject<HTMLTextAreaElement | null>
  disabled?: boolean
}

type Vervollstaendigung = { start: number }

export function Editor({ kanal, wert, onChange, onSpeichern, textareaRef, disabled }: EditorProps) {
  const id = useId()
  const eigener = useRef<HTMLTextAreaElement | null>(null)
  const feld = textareaRef ?? eigener
  const [vv, setVv] = useState<Vervollstaendigung | null>(null)
  const [filter, setFilter] = useState('')
  const [cursor, setCursor] = useState(0)
  const treffer = useMemo(() => platzhalterTreffer(filter), [filter])
  const chips = useMemo(() => tokens(`${wert.subject}\n${wert.body}`), [wert.subject, wert.body])

  const schliessen = () => {
    setVv(null)
    setFilter('')
    setCursor(0)
  }

  const einfuegen = (name: string) => {
    const el = feld.current
    if (!vv) return
    const caret = el?.selectionStart ?? wert.body.length
    const r = platzhalterEinfuegen(wert.body, vv.start, caret, name)
    onChange({ ...wert, body: r.text })
    schliessen()
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      el.setSelectionRange(r.caret, r.caret)
    })
  }

  const aenderung = (text: string, caret: number) => {
    onChange({ ...wert, body: text })
    if (vv) {
      // Filter = Text zwischen `[` und Caret; schließt, wenn der Caret vor das `[` wandert oder `]` getippt wurde
      if (caret <= vv.start || text[vv.start] !== '[') return schliessen()
      const f = text.slice(vv.start + 1, caret)
      if (f.includes(']') || f.includes('\n')) return schliessen()
      setFilter(f)
      setCursor(0)
      return
    }
    if (caret > 0 && text[caret - 1] === '[') {
      setVv({ start: caret - 1 })
      setFilter('')
      setCursor(0)
    }
  }

  const tasten = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!vv) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => (treffer.length ? (c + 1) % treffer.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => (treffer.length ? (c - 1 + treffer.length) % treffer.length : 0))
    } else if ((e.key === 'Enter' && !e.metaKey && !e.ctrlKey) || e.key === 'Tab') {
      const name = treffer[cursor]
      if (name) {
        e.preventDefault()
        einfuegen(name)
      } else schliessen()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      schliessen()
    }
  }

  const listeId = `${id}-platzhalter`

  return (
    <div className="grid gap-3.5">
      {kanal === 'email' ? (
        <FormField label="Betreff" htmlFor={`${id}-betreff`}>
          <Input
            id={`${id}-betreff`}
            value={wert.subject}
            disabled={disabled}
            onChange={(e) => onChange({ ...wert, subject: e.target.value })}
            placeholder="Betreff der E-Mail"
          />
        </FormField>
      ) : null}
      <FormField label="Text" htmlFor={`${id}-text`} hinweis="Platzhalter in eckigen Klammern – [ öffnet die Liste.">
        <div className="relative">
          <Textarea
            id={`${id}-text`}
            ref={feld}
            value={wert.body}
            disabled={disabled}
            onSubmit={onSpeichern}
            mitHinweis
            placeholder="Hallo [Vorname], …"
            className="min-h-[220px] font-normal"
            onKeyDown={tasten}
            onChange={(e) => aenderung(e.target.value, e.target.selectionStart ?? e.target.value.length)}
            onBlur={() => {
              // Klick in die Liste läuft über onMouseDown (preventDefault), deshalb darf Blur schließen
              window.setTimeout(schliessen, 0)
            }}
            aria-autocomplete="list"
            aria-controls={vv ? listeId : undefined}
            aria-expanded={vv ? true : undefined}
          />
          {vv ? (
            <div
              id={listeId}
              role="listbox"
              aria-label="Platzhalter"
              className="bg-surface-raised shadow-float absolute top-full left-0 z-[65] mt-1.5 max-h-[260px] w-[300px] overflow-auto rounded-md p-1.5"
            >
              <span className="label block px-2.5 pt-1.5 pb-1">Platzhalter</span>
              {treffer.length === 0 ? (
                <span className="text-small text-ink-3 block px-2.5 py-2">Kein Platzhalter „{filter}“.</span>
              ) : (
                treffer.map((name, i) => (
                  <button
                    key={name}
                    type="button"
                    role="option"
                    aria-selected={i === cursor}
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => einfuegen(name)}
                    className={cn(
                      'text-ui flex h-8 w-full items-center gap-2.5 rounded-sm px-2.5 text-left font-normal',
                      i === cursor && 'cursor-bar',
                    )}
                  >
                    <span className="tnum flex-1 font-mono text-[12.5px]">[{name}]</span>
                    <span className="text-small text-ink-3 truncate">{quelleLabel(name)}</span>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
      </FormField>
      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Platzhalter im Text">
          {chips.map((name) => {
            const bekannt = istBekannterPlatzhalter(name)
            return (
              <Chip
                key={name}
                ton={bekannt ? 'neutral' : 'overdue'}
                className="font-mono"
                title={bekannt ? quelleLabel(name) : 'Unbekannter Platzhalter – wird nie gefüllt'}
              >
                [{name}]
              </Chip>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
