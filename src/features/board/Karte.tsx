// Die Karte nach der Skizze der Inhaber (25.11.2026): @Zugehörigkeit · Name · LinkedIn-Link · grüner und roter Knopf – sonst nichts.
// Klick auf die Karte öffnet das Lead-Blatt: der Name ist der echte Knopf, seine Klickfläche (::after) liegt über der ganzen Karte;
// Link und Knöpfe liegen darüber und tragen `data-kein-ziehen` (sie starten weder ein Ziehen noch öffnen sie das Blatt).
import { useDraggable } from '@dnd-kit/core'
import { useCallback, useEffect, useRef } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import type { BoardKarte } from '@/data/board'
import { anzeigeName } from '@/lib/mitglied'
import { linkedinHref } from '@/lib/url'
import type { Member } from '@/types/domain'
import { KARTEN_KNOEPFE, type BoardListe } from './listen'
import { kartenName } from './logik'

type FlaecheProps = {
  karte: BoardKarte
  member: Member | null | undefined
  onOeffnen?: (id: string) => void
  onVerschieben?: (karte: BoardKarte, ziel: BoardListe) => void
  className?: string
}

/** Aussehen der Karte ohne Zieh-Logik – auch das Bild unter dem Zeiger beim Ziehen (dann ohne Funktionen). */
export function KartenFlaeche({ karte, member, onOeffnen, onVerschieben, className }: FlaecheProps) {
  const name = kartenName(karte)
  const href = linkedinHref(karte.linkedin_url)
  const knoepfe = KARTEN_KNOEPFE[karte.board_liste]
  return (
    <div
      className={cn(
        'bg-surface shadow-card relative touch-manipulation rounded-md p-3.5 select-none [-webkit-touch-callout:none]',
        className,
      )}
    >
      <div className="text-small text-ink-2 flex h-[22px] min-w-0 items-center gap-2">
        <span aria-hidden className="inline-flex">
          <Avatar member={member ?? null} groesse={22} />
        </span>
        {member ? <span className="truncate">@{anzeigeName(member)}</span> : null}
      </div>
      <h3 className="mt-2">
        <button
          type="button"
          title={name}
          onClick={() => onOeffnen?.(karte.id)}
          className="text-ink-bright block w-full truncate text-left text-[16px] leading-[1.35] font-semibold after:absolute after:inset-0 after:rounded-md"
        >
          {name}
        </button>
      </h3>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          draggable={false}
          data-kein-ziehen
          className="text-signal text-ui relative z-[1] -mx-1 mt-0.5 inline-flex h-9 items-center rounded-xs px-1 font-medium hover:underline"
        >
          LinkedIn-Profil
        </a>
      ) : null}
      {knoepfe.length > 0 ? (
        <div className="mt-2 grid gap-2">
          {knoepfe.map((k) => (
            <Button
              key={k.ziel}
              variante={k.art}
              groesse="L"
              data-kein-ziehen
              className="relative z-[1] w-full"
              // Nur der erste Klick zählt: nach dem Zug rückt die nächste Karte unter den Zeiger – ein Doppelklick träfe sie mit
              onClick={(e) => {
                if (e.detail <= 1) onVerschieben?.(karte, k.ziel)
              }}
            >
              {k.label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

type KarteProps = Required<Pick<FlaecheProps, 'onOeffnen' | 'onVerschieben'>> &
  Pick<FlaecheProps, 'karte' | 'member'> & {
    /** Kurz hervorheben (gerade hinzugefügt bzw. „liegt schon in …“) und in Sicht holen. */
    hervorgehoben?: boolean
  }

export function Karte({ karte, member, hervorgehoben, onOeffnen, onVerschieben }: KarteProps) {
  // Bewusst ohne dnd-kit-`attributes` (role="button", tabIndex): die Karte enthält selbst Knöpfe. Mit der Tastatur führen die
  // Knöpfe auf der Karte und „Liste“ im Lead-Blatt zum selben Ziel.
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: karte.id })
  const knoten = useRef<HTMLLIElement | null>(null)
  const ref = useCallback(
    (el: HTMLLIElement | null) => {
      knoten.current = el
      setNodeRef(el)
    },
    [setNodeRef],
  )
  useEffect(() => {
    if (hervorgehoben) knoten.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [hervorgehoben])
  return (
    <li ref={ref} data-karte={karte.id} data-hervorgehoben={hervorgehoben || undefined} {...listeners}>
      <KartenFlaeche
        karte={karte}
        member={member}
        onOeffnen={onOeffnen}
        onVerschieben={onVerschieben}
        className={cn(
          'ease-brand transition-[box-shadow,opacity] duration-[var(--t-2)]',
          hervorgehoben && 'ring-signal ring-2',
          isDragging && 'opacity-40',
        )}
      />
    </li>
  )
}
