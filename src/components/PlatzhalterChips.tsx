// Platzhalter-Chips (Neustart 25.11.2026): Klick setzt „[Name]“ an die Cursor-Position des Textfelds, der Fokus bleibt im Text.
// Muster aus mailing/AblaufEditor (VarianteFelder) – dort bleibt die eigene Kopie stehen, der E-Mail-Bereich wird nicht angefasst.
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { cn } from '@/components/ui/cn'

export type PlatzhalterChipsProps = {
  /** Namen ohne Klammern: „Anrede“ fügt „[Anrede]“ ein */
  namen: readonly string[]
  /** Das Textfeld, in das eingefügt wird */
  feld: RefObject<HTMLTextAreaElement | null>
  /** Aktueller Text des Felds (gesteuert) */
  wert: string
  onChange: (text: string) => void
  className?: string
}

export function PlatzhalterChips({ namen, feld, wert, onChange, className }: PlatzhalterChipsProps) {
  // Stand der Cursor noch nie im Text, hängt die Marke ans Ende (Browser melden für unberührte Felder teils Position 0)
  const beruehrt = useRef(false)
  useEffect(() => {
    const el = feld.current
    if (!el) return
    const merke = () => {
      beruehrt.current = true
    }
    if (document.activeElement === el) merke()
    el.addEventListener('focus', merke)
    return () => el.removeEventListener('focus', merke)
  }, [feld])

  // Cursor hinter die Marke: erst wenn der neue Text im Feld steht – React setzt ihn beim Schreiben sonst ans Ende
  const offen = useRef<{ text: string; pos: number } | null>(null)
  useLayoutEffect(() => {
    const ziel = offen.current
    if (!ziel) return
    offen.current = null
    const el = feld.current
    if (!el || ziel.text !== wert) return
    el.focus()
    el.setSelectionRange(ziel.pos, ziel.pos)
  }, [wert, feld])

  const einfuegen = (name: string) => {
    const el = feld.current
    const marke = `[${name}]`
    const a = el && beruehrt.current ? el.selectionStart : wert.length
    const b = el && beruehrt.current ? el.selectionEnd : a
    const text = wert.slice(0, a) + marke + wert.slice(b)
    offen.current = { text, pos: a + marke.length }
    onChange(text)
  }

  return (
    <div role="group" aria-label="Platzhalter einfügen" className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className="text-small text-ink-3 mr-1">Einfügen</span>
      {namen.map((name) => (
        <button
          key={name}
          type="button"
          // Maus/Finger nehmen dem Text den Fokus nicht weg (auf dem Telefon bleibt die Tastatur offen)
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => einfuegen(name)}
          className={cn(
            'border-line-strong text-ui text-ink hover:bg-surface-hover h-9 rounded-full border px-3.5 whitespace-nowrap',
            'ease-brand transition-[background] duration-[var(--t-1)] active:translate-y-[0.5px]',
          )}
        >
          {name}
        </button>
      ))}
    </div>
  )
}
