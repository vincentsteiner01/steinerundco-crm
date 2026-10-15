// Bausteine der Queue-Karte (DESIGN-SYSTEM § 5.7): Rahmen mit Zeitbalken, Kopfzeile (Label + Zeit-Chip + Glyph), Name/Unternehmen,
// Unterzeile, Letzte Reaktion, Aktionsleiste, Fußzeile „kopiert 09:41“, kollabierte Karte (52 px).
import type { HTMLAttributes, ReactNode, Ref } from 'react'
import { Avatar, type AvatarMember } from '@/components/ui/Avatar'
import { Chip, ZeitChip } from '@/components/ui/Chip'
import { cn } from '@/components/ui/cn'
import { Glyph } from '@/components/ui/Glyph'
import { fmtDatumKurz, fmtDauer, fmtZeit } from '@/lib/format'
import { werktageZwischen } from '@/lib/werktage'
import { berlinTag, tageDifferenz } from '@/lib/zeit'
import type { Channel, QueueItem } from '@/types/domain'
import { faelligVon, jetzt as jetztZeit, kartenLabel, type Faellig } from './karten'
import { useHeuteKontext } from './kontext'
import { itemKey } from './sektionen'

export function KartenRahmen({
  aktiv,
  faellig,
  children,
  className,
  ref,
  ...rest
}: {
  aktiv: boolean
  faellig: Faellig
  children: ReactNode
  className?: string
  ref?: Ref<HTMLElement>
} & Omit<HTMLAttributes<HTMLElement>, 'children'>) {
  return (
    <article
      ref={ref}
      role="listitem"
      aria-current={aktiv || undefined}
      data-aktiv={aktiv || undefined}
      className={cn(
        'ease-brand relative overflow-hidden rounded-md border transition-[background,border-color] duration-[var(--t-1)]',
        "before:absolute before:top-3.5 before:bottom-3.5 before:-left-px before:w-0.5 before:rounded-[1px] before:content-['']",
        aktiv ? 'bg-surface-raised border-line-strong px-5 pt-[18px] pb-4' : 'bg-surface border-line px-5 py-3',
        faellig === 'today' && 'before:bg-signal',
        faellig === 'overdue' && 'before:bg-overdue',
        aktiv && 'outline-none',
        className,
      )}
      {...rest}
    >
      {children}
    </article>
  )
}

/** Zeit-Chip rechts oben: heute (Lime) · −2 T (Amber) · in 3 T · Rückruf „10:30 · heute“ / „verpasst · 00:35“ · Antworten „seit n T“. */
export function ZeitAnzeige({ item, heute, jetzt }: { item: QueueItem; heute: string; jetzt?: Date }) {
  const now = jetzt ?? jetztZeit()
  if (item.item_kind === 'rueckruf' && item.due_at) {
    const due = new Date(item.due_at)
    if (due.getTime() < now.getTime()) {
      return (
        <Chip ton="overdue" className="font-mono">
          verpasst · {fmtDauer((now.getTime() - due.getTime()) / 1000)}
        </Chip>
      )
    }
    const tag = berlinTag(due)
    return (
      <Chip ton={tag === heute ? 'today' : 'later'} className="font-mono">
        {fmtZeit(due)} · {tag === heute ? 'heute' : fmtDatumKurz(due)}
      </Chip>
    )
  }
  if (item.item_kind === 'antworten' && item.due_at) {
    const seit = berlinTag(item.due_at)
    const tage = tageDifferenz(seit, heute)
    const werktage = werktageZwischen(seit, heute)
    return (
      <span className="flex items-center gap-1.5">
        {werktage > 1 ? <Chip ton="overdue">Antwortzeit</Chip> : null}
        <Chip ton={tage <= 0 ? 'today' : 'muted'} className="font-mono">
          {tage <= 0 ? 'heute' : `seit ${tage} T`}
        </Chip>
      </span>
    )
  }
  if (item.due_date) return <ZeitChip datum={item.due_date} heute={heute} />
  return null
}

/** Chip „neu“ (Realtime-Neuzugang, 4 s, H-16) – liest den Seiten-Kontext, damit keine Variante ihn durchreichen muss. */
export function NeuChip({ item }: { item: QueueItem }) {
  const h = useHeuteKontext()
  return h.istNeu(itemKey(item)) ? <Chip ton="neu">neu</Chip> : null
}

export function KartenKopf({
  label,
  item,
  heute,
  rechts,
}: {
  label: string
  item: QueueItem
  heute: string
  rechts?: ReactNode
}) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-3">
      <span className="label truncate-1 min-w-0">{label}</span>
      <span className="flex flex-none items-center gap-2.5">
        <NeuChip item={item} />
        {rechts}
        <ZeitAnzeige item={item} heute={heute} />
        <Glyph kanal={(item.channel ?? 'linkedin') as Channel} />
      </span>
    </div>
  )
}

export function KartenWer({
  item,
  owner,
  salesOwner,
  rechts,
  kollabiert,
}: {
  item: QueueItem
  owner?: AvatarMember | null
  salesOwner?: AvatarMember | null
  rechts?: ReactNode
  kollabiert?: boolean
}) {
  const zweiter = salesOwner && owner && salesOwner.id !== owner.id ? salesOwner : null
  return (
    <div className={cn('flex flex-wrap gap-x-2.5 gap-y-1', kollabiert ? 'items-center' : 'items-baseline')}>
      <span className={kollabiert ? 'text-h3 text-ink' : 'lead-name'}>{item.lead_name ?? '–'}</span>
      {item.company_name ? <span className="text-ink-2 text-[13.5px] font-medium">{item.company_name}</span> : null}
      {zweiter ? <Avatar member={owner} zweiter={zweiter} groesse={22} className="ml-1" /> : null}
      {rechts ? <span className="text-ink-3 ml-auto flex items-center gap-1.5 text-[12.5px]">{rechts}</span> : null}
    </div>
  )
}

export function KartenSub({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('text-ink-3 tnum mt-0.5 text-[12.5px]', className)}>{children}</div>
}

/** Letzte Reaktion: eingerückt, linke Haarlinie, Zitat in ‚…‘ (ux § 3.1.2 Nr. 3). */
export function Reaktion({
  wann,
  zitat,
  label,
}: {
  wann?: string | null
  zitat?: string | null
  label?: string | null
}) {
  if (!zitat && !label) return null
  return (
    <p className="border-line-strong text-ink-2 mt-3 mb-0 border-l py-0.5 pl-3 text-[12.5px]">
      Antwort{wann ? ` ${fmtDatumKurz(wann)}, ${fmtZeit(wann)}` : ''}
      {label ? ` · ${label}` : ''}
      {zitat ? `: ‚${zitat}‘` : ''}
    </p>
  )
}

export function KartenAktionen({
  children,
  rechts,
  className,
}: {
  children: ReactNode
  rechts?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mt-3.5 flex flex-wrap items-center gap-1.5', className)} role="group" aria-label="Aktionen">
      {children}
      {rechts ? (
        <>
          <span className="flex-1" />
          {rechts}
        </>
      ) : null}
    </div>
  )
}

/** Fußzeile nach `C`: „kopiert 09:41 · jetzt in LinkedIn einfügen – dann E drücken.“ (bleibt bis `E`). */
export function KartenFuss({ kopiertUm, kanal }: { kopiertUm: string | null; kanal: Channel | null }) {
  if (!kopiertUm) return null
  return (
    <div className="text-ink-3 tnum mt-2.5 font-mono text-[11.5px] tracking-[0.02em]">
      kopiert {kopiertUm}
      {kanal === 'linkedin' ? ' · jetzt in LinkedIn einfügen – dann E drücken.' : ' · dann E drücken.'}
    </div>
  )
}

/** Kollabierte Karte (alle außer der aktiven): Kopfzeile + Name + rechts „Kurzfristig 2 vorbereitet · J öffnet“ – 52 px. */
export function KollabierteKarte({
  item,
  heute,
  vorbereitet,
  jOeffnet,
  ref,
  onClick,
}: {
  item: QueueItem
  heute: string
  vorbereitet: string
  jOeffnet?: boolean
  ref?: Ref<HTMLElement>
  onClick?: () => void
}) {
  return (
    <KartenRahmen
      aktiv={false}
      faellig={faelligVon(item, heute)}
      ref={ref}
      onClick={onClick}
      tabIndex={-1}
      data-key={item.item_id ?? undefined}
    >
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="label truncate-1 min-w-0">{kartenLabel(item)}</span>
        <span className="flex flex-none items-center gap-2.5">
          <NeuChip item={item} />
          <ZeitAnzeige item={item} heute={heute} />
          <Glyph kanal={(item.channel ?? 'linkedin') as Channel} />
        </span>
      </div>
      <KartenWer
        item={item}
        kollabiert
        rechts={
          <>
            {vorbereitet}
            {jOeffnet ? (
              <>
                {' '}
                · <kbd className="kbd">J</kbd> öffnet
              </>
            ) : null}
          </>
        }
      />
    </KartenRahmen>
  )
}
