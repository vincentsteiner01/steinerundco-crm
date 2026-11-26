// To-dos eines Key Results: abhaken, löschen, hinzufügen. Die Hinzufügen-Zeile ist nur eine leise Textzeile – wer zuständig
// ist („Beide · Vincent · Mike“) und der Knopf erscheinen erst, wenn etwas dasteht. So bleibt ein Key Result ohne To-dos ruhig.
import { Plus, Trash2 } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { cn } from '@/components/ui/cn'
import { Segment } from '@/components/ui/Segment'
import { useTodoAbhaken, useTodoAnlegen, useTodoLoeschen } from '@/data/okr'
import type { TeamPerson } from '@/features/team/personen'
import type { OkrErgebnis, OkrTodo } from './rechnen'

const BEIDE = 'beide'
/** Abhak-Feld und Löschen: 36 px, am Telefon 44 px */
const FLAECHE = 'grid size-9 flex-none place-items-center max-md:size-11'

export function Todos({
  ergebnis,
  todos,
  personen,
}: {
  ergebnis: OkrErgebnis
  todos: readonly OkrTodo[]
  personen: readonly TeamPerson[]
}) {
  const anlegen = useTodoAnlegen()
  const abhaken = useTodoAbhaken()
  const loeschen = useTodoLoeschen()
  const [text, setText] = useState('')
  const [wer, setWer] = useState<string>(BEIDE)
  const name = (id: string | null) => (id ? personen.find((p) => p.id === id)?.name : undefined)

  const hinzufuegen = () => {
    const t = text.trim()
    if (!t) return
    // sofort leeren (das nächste To-do lässt sich gleich tippen); scheitert das Speichern, steht der Text wieder da
    setText('')
    anlegen.mutate(
      { ergebnis_id: ergebnis.id, text: t, member_id: wer === BEIDE ? null : wer },
      { onError: () => setText((jetzt) => jetzt || t) },
    )
  }
  const mitEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    hinzufuegen()
  }

  return (
    // -ml: das Abhak-Feld steht bündig mit dem Titel des Key Results, die Klickfläche ragt nach links
    <div className="mt-3 -ml-2.5 min-w-0 max-md:-ml-3.5">
      {todos.length ? (
        // -mr: das Löschen-Symbol steht bündig mit den Ampel-Marken darüber
        <ul aria-label={`To-dos: ${ergebnis.titel}`} className="-mr-2.5 max-md:-mr-3.5">
          {todos.map((t) => {
            const erledigt = t.erledigt_at !== null
            const zustaendig = name(t.member_id)
            return (
              <li key={t.id} className="flex min-w-0 items-start gap-1">
                <label className={cn(FLAECHE, 'cursor-pointer')}>
                  <Checkbox
                    aria-label={t.text}
                    checked={erledigt}
                    onChange={(e) => abhaken.mutate({ id: t.id, erledigt: e.target.checked })}
                  />
                </label>
                <span
                  className={cn(
                    'text-body min-w-0 flex-1 py-1.5 [overflow-wrap:anywhere] max-md:py-2.5',
                    erledigt ? 'text-ink-3 line-through' : 'text-ink',
                  )}
                >
                  {t.text}
                </span>
                {zustaendig ? (
                  <span
                    data-wer
                    className="bg-tag-grau text-tag-grau-ink mt-1.5 inline-flex h-6 flex-none items-center rounded-xs px-2 text-[13px] leading-none font-medium max-md:mt-2.5"
                  >
                    {zustaendig}
                  </span>
                ) : null}
                <button
                  type="button"
                  aria-label={`To-do „${t.text}“ löschen`}
                  onClick={() => loeschen.mutate(t.id)}
                  className={cn(
                    FLAECHE,
                    'text-ink-3 hover:bg-danger-tint hover:text-danger ease-brand rounded-sm transition-[background,color] duration-[var(--t-1)]',
                  )}
                >
                  <Trash2 size={16} strokeWidth={1.75} aria-hidden />
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}

      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
        <label className="hover:bg-surface-hover focus-within:bg-surface-hover focus-within:border-signal ease-brand flex min-w-0 flex-1 basis-56 cursor-text items-center gap-1 rounded-sm border border-transparent transition-[background,border-color] duration-[var(--t-1)]">
          <span aria-hidden className={cn(FLAECHE, 'text-ink-3')}>
            <Plus size={16} strokeWidth={1.75} />
          </span>
          <input
            type="text"
            aria-label={`To-do hinzufügen: ${ergebnis.titel}`}
            placeholder="To-do hinzufügen"
            autoComplete="off"
            enterKeyHint="done"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={mitEnter}
            // am Telefon 16 px: iOS zoomt beim Antippen in Felder unter 16 px
            className="text-body placeholder:text-ink-3 h-9 min-w-0 flex-1 bg-transparent pr-3 outline-none max-md:h-11 max-md:text-[16px]"
          />
        </label>
        {text.trim() ? (
          <div className="flex min-w-0 flex-wrap items-center gap-2 max-md:pl-3.5">
            <Segment
              klein
              ariaLabel="Zuständig"
              className="max-md:h-11!"
              wert={wer}
              onChange={setWer}
              optionen={[{ key: BEIDE, label: 'Beide' }, ...personen.map((p) => ({ key: p.id, label: p.name }))]}
            />
            <Button variante="primary" groesse="S" className="max-md:h-11!" onClick={hinzufuegen}>
              Hinzufügen
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
