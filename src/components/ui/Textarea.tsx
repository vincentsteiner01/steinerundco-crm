import { useEffect, useRef, type KeyboardEvent, type Ref, type TextareaHTMLAttributes } from 'react'
import { cn } from './cn'

export type TextareaProps = {
  fehler?: string
  /** ⌘Enter (Ctrl+Enter) löst Speichern aus */
  onSubmit?: () => void
  /** Hinweis „⌘ ↵ speichern“ unter dem Feld zeigen */
  mitHinweis?: boolean
  ref?: Ref<HTMLTextAreaElement>
} & TextareaHTMLAttributes<HTMLTextAreaElement>

/** DESIGN-SYSTEM § 5.2: min. 64 px, wächst (autogrow), padding 10 12, ⌘Enter speichert. */
export function Textarea({
  fehler,
  onSubmit,
  mitHinweis,
  className,
  onKeyDown,
  onInput,
  ref,
  id,
  ...rest
}: TextareaProps) {
  const innen = useRef<HTMLTextAreaElement | null>(null)

  const wachse = (el: HTMLTextAreaElement | null) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(64, el.scrollHeight)}px`
  }
  useEffect(() => {
    wachse(innen.current)
  }, [rest.value])

  const setRef = (el: HTMLTextAreaElement | null) => {
    innen.current = el
    if (typeof ref === 'function') ref(el)
    else if (ref && typeof ref === 'object') (ref as { current: HTMLTextAreaElement | null }).current = el
  }

  const tastendruck = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && onSubmit) {
      e.preventDefault()
      onSubmit()
    }
    onKeyDown?.(e)
  }

  return (
    <div className="grid gap-1.5">
      <textarea
        ref={setRef}
        id={id}
        aria-invalid={fehler ? true : undefined}
        className={cn(
          'textarea bg-surface-hover text-ui placeholder:text-ink-4 block min-h-16 w-full rounded-sm border px-3 py-2.5 leading-[1.45] font-normal outline-none',
          'ease-brand focus:border-signal transition-[border-color] duration-[var(--t-1)]',
          fehler ? 'border-danger' : 'border-line-strong',
          className,
        )}
        onKeyDown={tastendruck}
        onInput={(e) => {
          wachse(e.currentTarget)
          onInput?.(e)
        }}
        {...rest}
      />
      {fehler ? (
        <p className="text-small text-danger" role="alert">
          {fehler}
        </p>
      ) : mitHinweis ? (
        <p className="text-ink-3 flex items-center gap-1 text-[12px]">
          <kbd className="kbd">⌘</kbd>
          <kbd className="kbd">↵</kbd> speichern
        </p>
      ) : null}
    </div>
  )
}
