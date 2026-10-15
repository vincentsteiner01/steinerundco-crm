// „Notiz“ `N` (BAUPLAN § 3.1.10b, ux § 5.5): Textarea, ⌘Enter → useNotizErstellen (optimistisch), `/` im leeren Feld öffnet
// VorlageWaehlen (M6) zum Einfügen; Undo über die Notiz-Aktivität (reversibel ≤ 10 min).
import { useRef, useState } from 'react'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { Textarea } from '@/components/ui/Textarea'
import { useNotizErstellen } from '@/data/activities'
import { useUndo } from '@/data/undo'
import { VorlageWaehlen } from '@/features/leitfaeden/public'
import type { Channel } from '@/types/domain'
import { getrimmt, useAktionTaste, useOffen, type AktionProps } from './_gemeinsam'
import { TriggerHuelle } from './_Teile'

export type NotizFeldProps = AktionProps & {
  /** Kanal der Leitfaden-Auswahl bei `/` (Standard LinkedIn) */
  kanal?: Channel
  /** Feld bleibt nach dem Speichern sichtbar (Peek-Fuß); Standard: nur mit `trigger` wird es wieder geschlossen */
  bleibtOffen?: boolean
}

export function NotizFeld({
  leadId,
  trigger,
  offen: offenProp,
  onOpenChange,
  onFertig,
  aktiv,
  kanal = 'linkedin',
  bleibtOffen,
  className,
}: NotizFeldProps) {
  const [offen, setOffen] = useOffen(offenProp ?? (trigger === undefined ? true : undefined), onOpenChange)
  const [text, setText] = useState('')
  const feld = useRef<HTMLTextAreaElement | null>(null)
  const vorlageKnopf = useRef<HTMLButtonElement | null>(null)
  const erstellen = useNotizErstellen()
  const { anbieten } = useUndo()

  const fokus = () => {
    setOffen(true)
    // nach dem Öffnen ist das Feld erst im nächsten Tick da
    setTimeout(() => feld.current?.focus(), 0)
  }

  const speichern = async () => {
    const note = getrimmt(text)
    if (!note || erstellen.isPending) return
    let a
    try {
      a = await erstellen.mutateAsync({ leadId, note })
    } catch {
      return
    }
    setText('')
    const label = 'Notiz gespeichert.'
    if (a && a.id > 0) anbieten(a.id, label, leadId)
    else toast(label)
    if (trigger !== undefined && !bleibtOffen) setOffen(false)
    onFertig?.()
  }

  const einfuegen = (body: string) => {
    const el = feld.current
    const von = el?.selectionStart ?? text.length
    const bis = el?.selectionEnd ?? text.length
    const neu = `${text.slice(0, von)}${body}${text.slice(bis)}`
    setText(neu)
    setTimeout(() => {
      el?.focus()
      el?.setSelectionRange(von + body.length, von + body.length)
    }, 0)
  }

  useAktionTaste('n', trigger === undefined && !!aktiv, fokus)

  return (
    <div className={cn('grid gap-2', className)}>
      {trigger === undefined ? null : <TriggerHuelle onClick={fokus}>{trigger}</TriggerHuelle>}
      {offen ? (
        <div className="grid gap-2" role="group" aria-label="Notiz">
          <Textarea
            ref={feld}
            aria-label="Notiz"
            placeholder="Notiz … (/ fügt einen Leitfaden ein)"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onSubmit={() => void speichern()}
            onKeyDown={(e) => {
              if (e.key === '/' && text.trim() === '') {
                e.preventDefault()
                vorlageKnopf.current?.click()
              }
              if (e.key === 'Escape' && trigger !== undefined) setOffen(false)
            }}
            mitHinweis
          />
          <div className="flex items-center justify-between gap-2">
            <VorlageWaehlen
              kanal={kanal}
              onSelect={(t) => einfuegen(t.body)}
              trigger={
                <Button ref={vorlageKnopf} variante="quiet" groesse="S" kbd="/">
                  Leitfaden einfügen
                </Button>
              }
            />
            <Button
              variante="primary"
              groesse="S"
              kbd="⌘↵"
              disabled={!getrimmt(text)}
              busy={erstellen.isPending}
              onClick={() => void speichern()}
            >
              Notiz speichern
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
