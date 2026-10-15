import { functionalUpdate, useTable, type Row, type SortingState } from '@tanstack/react-table'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { ChevronDown, ChevronRight } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type Ref,
} from 'react'
import { useUiStore } from '@/app/uiStore'
import { cn } from '@/components/ui/cn'
import { useHotkeys } from '@/lib/keyboard'
import { useIstTelefon } from '@/lib/useMediaQuery'
import {
  dataTableFeatures,
  naechsteEditierbareSpalte,
  spaltenMeta,
  VIRTUALISIEREN_AB,
  type DataTableFeatures,
  type DataTableSpalte,
  type RowData,
} from './spalten'

export type ZeitBalken = 'today' | 'overdue' | null

/** BAUPLAN § 3.1.10 (wörtlich) + optionale Ergänzungen (mobilZeile, ariaLabel, className, ref). */
export type DataTableProps<T extends RowData> = {
  daten: T[]
  spalten: DataTableSpalte<T>[]
  rowId: (r: T) => string
  cursorId?: string | null
  onCursor?: (id: string) => void
  auswahl?: Set<string>
  onAuswahl?: (s: Set<string>) => void
  onEnter?: (r: T) => void
  onZelleBearbeiten?: (r: T, spalte: string) => void
  gruppierung?: { key: (r: T) => string; label: (k: string) => string; zaehler?: boolean }
  /** Kopf klebt unter dem Seitenkopf – nur ≥ 1280 px wirksam (darunter liegt die Tabelle in einem overflow-x-Wrapper,
   * in dem `sticky` relativ zum Wrapper rechnete und den Kopf mitten über Zeile 3–4 legte, Runde 2) */
  sticky?: boolean
  /** Mindestbreite unter 1280 px (Querscroll statt gequetschter Spalten). Standard 1040; `null` = keine – für schmale 4–5-Spalten-Tabellen */
  minBreite?: number | null
  zeilenHoehe?: 40 | 56
  leer?: ReactNode
  ladeMehr?: () => void
  hatMehr?: boolean
  sortierung?: SortingState
  onSortierung?: (s: SortingState) => void
  zeitBalken?: (r: T) => ZeitBalken
  /** < 768 px: Liste 56 px mit drei Zeilen je Lead (DESIGN-SYSTEM § 5.10 Mobil); ohne diese Funktion bleibt die Tabelle (horizontal scrollbar) */
  mobilZeile?: (r: T, zustand: { cursor: boolean; ausgewaehlt: boolean; zeit: ZeitBalken }) => ReactNode
  ariaLabel?: string
  className?: string
  ref?: Ref<HTMLDivElement>
}

type Anzeige<T extends RowData> =
  | { art: 'gruppe'; key: string; label: string; anzahl: number; ueberfaellig: number; eingeklappt: boolean }
  | { art: 'zeile'; row: Row<DataTableFeatures, T> }

const GRUPPEN_HOEHE = 32

/**
 * Leads-Tabelle (DESIGN-SYSTEM § 5.10): TanStack Table v9 (Sortierung) + Virtual (Fenster-Scroll ab 100 Zeilen, BAUPLAN E18).
 * Zeilen 40/56 px, Kopf `label` sticky unter dem Seitenkopf (`top: var(--head-h)`), Cursor `.cursor-bar`, Auswahl per Checkbox-Spalte
 * (erscheint bei `onAuswahl`), Gruppen 32 px mit Zähler (Überfällig Amber), Zeitbalken links (Lime heute / Amber überfällig).
 * Tastatur (Scope `liste`, ux § 5.3): `J K ↓ ↑` Cursor · `Enter` öffnen · `Space` auswählen · `⇧↓ ⇧↑` Bereich · `⌘A` alle sichtbaren ·
 * `Esc` Auswahl aufheben · `E` Zelle bearbeiten · `Tab ⇧Tab` aktive Spalte · `← →` aktive Spalte.
 * Sortierung: mit `sortierung`/`onSortierung` sortiert der Aufrufer (Server, `manualSorting`); ohne beides clientseitig.
 */
export function DataTable<T extends RowData>({
  daten,
  spalten,
  rowId,
  cursorId,
  onCursor,
  auswahl,
  onAuswahl,
  onEnter,
  onZelleBearbeiten,
  gruppierung,
  sticky = true,
  minBreite = 1040,
  zeilenHoehe = 40,
  leer,
  ladeMehr,
  hatMehr,
  sortierung,
  onSortierung,
  zeitBalken,
  mobilZeile,
  ariaLabel = 'Tabelle',
  className,
  ref,
}: DataTableProps<T>) {
  const [internSort, setInternSort] = useState<SortingState>([])
  const sorting = sortierung ?? internSort
  const manuell = sortierung !== undefined || !!onSortierung
  const getRowId = useCallback((r: T) => rowId(r), [rowId])

  const table = useTable(
    {
      features: dataTableFeatures,
      columns: spalten,
      data: daten,
      getRowId,
      manualSorting: manuell,
      enableMultiSort: true,
      enableSortingRemoval: true,
      state: { sorting },
      onSortingChange: (u) => {
        const next = functionalUpdate(u, sorting)
        if (onSortierung) onSortierung(next)
        else setInternSort(next)
      },
    },
    (s) => ({ sorting: s.sorting }),
  )

  const rows = table.getRowModel().rows
  const sichtbareSpalten = table.getAllLeafColumns()
  const spaltenInfo = useMemo(
    () => sichtbareSpalten.map((c) => ({ id: c.id, editierbar: !!spaltenMeta(c.columnDef).editierbar })),
    [sichtbareSpalten],
  )
  const mitAuswahl = !!onAuswahl
  const spaltenZahl = sichtbareSpalten.length + (mitAuswahl ? 1 : 0)

  // ── Gruppierung (Client, Reihenfolge = erstes Auftreten in der sortierten Liste) ──
  const [eingeklappt, setEingeklappt] = useState<Set<string>>(() => new Set())
  const anzeige = useMemo<Anzeige<T>[]>(() => {
    if (!gruppierung) return rows.map((row) => ({ art: 'zeile', row }))
    const gruppen = new Map<string, Row<DataTableFeatures, T>[]>()
    for (const row of rows) {
      const k = gruppierung.key(row.original)
      const liste = gruppen.get(k)
      if (liste) liste.push(row)
      else gruppen.set(k, [row])
    }
    const out: Anzeige<T>[] = []
    for (const [key, liste] of gruppen) {
      const zu = eingeklappt.has(key)
      out.push({
        art: 'gruppe',
        key,
        label: gruppierung.label(key),
        anzahl: liste.length,
        ueberfaellig: zeitBalken ? liste.filter((r) => zeitBalken(r.original) === 'overdue').length : 0,
        eingeklappt: zu,
      })
      if (!zu) for (const row of liste) out.push({ art: 'zeile', row })
    }
    return out
  }, [rows, gruppierung, eingeklappt, zeitBalken])

  const zeilen = useMemo(
    () => anzeige.filter((a): a is Extract<Anzeige<T>, { art: 'zeile' }> => a.art === 'zeile').map((a) => a.row),
    [anzeige],
  )
  const zeilenIds = useMemo(() => zeilen.map((r) => r.id), [zeilen])

  // ── Virtualisierung über das Fenster (die Seite scrollt, der Kopf klebt unter dem Seitenkopf) ──
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [scrollMargin, setScrollMargin] = useState(0)
  useLayoutEffect(() => {
    const messen = () => {
      const el = wrapRef.current
      if (!el) return
      setScrollMargin(Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY)))
    }
    messen()
    window.addEventListener('resize', messen)
    return () => window.removeEventListener('resize', messen)
  }, [])
  const mobil = useIstTelefon() && !!mobilZeile
  const virtuell = anzeige.length >= VIRTUALISIEREN_AB
  const hoehe = mobil ? 56 : zeilenHoehe
  const virtualizer = useWindowVirtualizer({
    count: anzeige.length,
    estimateSize: (i) => (anzeige[i]?.art === 'gruppe' ? GRUPPEN_HOEHE : hoehe),
    overscan: 12,
    scrollMargin,
    enabled: virtuell,
    getItemKey: (i) => {
      const a = anzeige[i]
      return a ? (a.art === 'gruppe' ? `g:${a.key}` : a.row.id) : i
    },
  })
  const virtuelleItems = virtuell ? virtualizer.getVirtualItems() : null
  const sichtbar = virtuelleItems
    ? virtuelleItems.map((v) => ({ index: v.index, start: v.start, size: v.size }))
    : anzeige.map((_, index) => ({ index, start: 0, size: 0 }))
  const obenAbstand = virtuelleItems && virtuelleItems.length > 0 ? (virtuelleItems[0]?.start ?? 0) - scrollMargin : 0
  const untenAbstand =
    virtuelleItems && virtuelleItems.length > 0
      ? virtualizer.getTotalSize() - ((virtuelleItems[virtuelleItems.length - 1]?.end ?? 0) - scrollMargin)
      : 0

  // ── Nachladen: Sentinel „Lade weitere …“ (IntersectionObserver) + Nähe zum Ende bei Virtualisierung ──
  const ladeRef = useRef<HTMLTableRowElement | null>(null)
  const ladeGesperrt = useRef<number>(-1)
  const ladeMehrRef = useRef(ladeMehr)
  ladeMehrRef.current = ladeMehr
  const nachladen = useCallback(() => {
    if (!hatMehr || !ladeMehrRef.current) return
    if (ladeGesperrt.current === daten.length) return
    ladeGesperrt.current = daten.length
    ladeMehrRef.current()
  }, [hatMehr, daten.length])
  useEffect(() => {
    const el = ladeRef.current
    if (!el || !hatMehr || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((eintraege) => {
      if (eintraege.some((e) => e.isIntersecting)) nachladen()
    })
    io.observe(el)
    return () => io.disconnect()
  }, [hatMehr, nachladen, anzeige.length])
  useEffect(() => {
    if (!virtuelleItems || !hatMehr) return
    const letzter = virtuelleItems[virtuelleItems.length - 1]
    if (letzter && letzter.index >= anzeige.length - 5) nachladen()
  }, [virtuelleItems, hatMehr, anzeige.length, nachladen])

  // ── Cursor, aktive Spalte, Auswahl ──
  const [aktiveSpalte, setAktiveSpalte] = useState<string | null>(null)
  const ankerRef = useRef<string | null>(null)
  const cursorIndex = cursorId ? zeilenIds.indexOf(cursorId) : -1

  const setzeCursor = useCallback(
    (index: number) => {
      const id = zeilenIds[Math.min(Math.max(index, 0), zeilenIds.length - 1)]
      if (id && onCursor) onCursor(id)
    },
    [zeilenIds, onCursor],
  )

  useEffect(() => {
    if (cursorIndex < 0) return
    const id = zeilenIds[cursorIndex]
    if (virtuell) {
      const i = anzeige.findIndex((a) => a.art === 'zeile' && a.row.id === id)
      if (i >= 0) virtualizer.scrollToIndex(i, { align: 'auto' })
    } else {
      wrapRef.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(id ?? '')}"]`)?.scrollIntoView?.({
        block: 'nearest',
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursorId])

  const setzeAuswahl = useCallback(
    (ids: Iterable<string>) => {
      onAuswahl?.(new Set(ids))
    },
    [onAuswahl],
  )
  const toggle = useCallback(
    (id: string, bereich: boolean) => {
      if (!onAuswahl) return
      const next = new Set(auswahl ?? [])
      const anker = ankerRef.current
      if (bereich && anker && zeilenIds.includes(anker)) {
        const a = zeilenIds.indexOf(anker)
        const b = zeilenIds.indexOf(id)
        const [von, bis] = a < b ? [a, b] : [b, a]
        const ziel = !next.has(id) || !next.has(anker)
        for (let i = von; i <= bis; i++) {
          const z = zeilenIds[i]
          if (!z) continue
          if (ziel) next.add(z)
          else next.delete(z)
        }
      } else {
        if (next.has(id)) next.delete(id)
        else next.add(id)
        ankerRef.current = id
      }
      onAuswahl(next)
    },
    [auswahl, onAuswahl, zeilenIds],
  )

  const cursorRow = cursorIndex >= 0 ? zeilen[cursorIndex] : undefined
  const bearbeite = useCallback(
    (row: Row<DataTableFeatures, T>, spalte: string | null) => {
      if (!onZelleBearbeiten) return
      const ziel =
        spalte && spaltenInfo.find((s) => s.id === spalte)?.editierbar
          ? spalte
          : naechsteEditierbareSpalte(spaltenInfo, null, 1)
      if (!ziel) return
      setAktiveSpalte(ziel)
      onZelleBearbeiten(row.original, ziel)
    },
    [onZelleBearbeiten, spaltenInfo],
  )

  // useHotkeys registriert die Handler einmal; alles Veränderliche kommt aus diesem Ref (jede Render-Runde aktuell)
  const zustand = useRef({
    cursorIndex,
    cursorRow,
    zeilenIds,
    auswahl,
    aktiveSpalte,
    spaltenInfo,
    onEnter,
    onAuswahl,
    onZelleBearbeiten,
    setzeCursor,
    setzeAuswahl,
    toggle,
    bearbeite,
  })
  zustand.current = {
    cursorIndex,
    cursorRow,
    zeilenIds,
    auswahl,
    aktiveSpalte,
    spaltenInfo,
    onEnter,
    onAuswahl,
    onZelleBearbeiten,
    setzeCursor,
    setzeAuswahl,
    toggle,
    bearbeite,
  }
  const bereich = (richtung: 1 | -1) => {
    const z = zustand.current
    if (!z.onAuswahl || z.zeilenIds.length === 0) return
    const von = z.cursorIndex < 0 ? 0 : z.cursorIndex
    const bis = Math.min(Math.max(von + richtung, 0), z.zeilenIds.length - 1)
    const next = new Set(z.auswahl ?? [])
    next.add(z.zeilenIds[von] as string)
    next.add(z.zeilenIds[bis] as string)
    ankerRef.current ??= z.zeilenIds[von] ?? null
    z.onAuswahl(next)
    z.setzeCursor(bis)
  }
  const spalteWechseln = (richtung: 1 | -1, nurEditierbar: boolean, e: KeyboardEvent) => {
    const z = zustand.current
    if (z.cursorIndex < 0) return
    if (nurEditierbar) {
      if (!z.onZelleBearbeiten) return
      const ziel = naechsteEditierbareSpalte(z.spaltenInfo, z.aktiveSpalte, richtung)
      if (!ziel) return
      e.preventDefault()
      setAktiveSpalte(ziel)
      return
    }
    const ids = z.spaltenInfo.map((s) => s.id)
    const i = z.aktiveSpalte ? ids.indexOf(z.aktiveSpalte) : richtung === 1 ? -1 : ids.length
    setAktiveSpalte(ids[Math.min(Math.max(i + richtung, 0), ids.length - 1)] ?? null)
  }

  // Bei offenem Peek gehören Tab/⇧Tab (Fokusfalle im Dialog), `E` (Karte „Gesendet“) und Space dem Peek – Review-Korrektur;
  // ←/→ und Esc prüfen das schon (Integration), J/K bleiben bewusst bei der Tabelle (Lead wechseln im Peek)
  const peekOffen = () => !!useUiStore.getState().peekLeadId
  useHotkeys('liste', {
    j: () => zustand.current.setzeCursor(zustand.current.cursorIndex + 1),
    arrowdown: (e) => {
      e.preventDefault()
      zustand.current.setzeCursor(zustand.current.cursorIndex + 1)
    },
    k: () => zustand.current.setzeCursor(zustand.current.cursorIndex - 1),
    arrowup: (e) => {
      e.preventDefault()
      zustand.current.setzeCursor(zustand.current.cursorIndex - 1)
    },
    enter: () => {
      const z = zustand.current
      if (z.cursorRow && z.onEnter) z.onEnter(z.cursorRow.original)
    },
    'shift+arrowdown': () => bereich(1),
    'shift+arrowup': () => bereich(-1),
    'mod+a': () => {
      const z = zustand.current
      if (z.onAuswahl) z.setzeAuswahl(z.zeilenIds)
    },
    escape: (e) => {
      // Eine Ebene je Druck: ein offener Peek hat Vorrang (PeekPanel schließt), danach die Auswahl
      if (useUiStore.getState().peekLeadId) return
      const z = zustand.current
      if (z.auswahl && z.auswahl.size > 0 && z.onAuswahl) {
        e.preventDefault()
        z.setzeAuswahl([])
      }
    },
    e: () => {
      if (peekOffen()) return
      const z = zustand.current
      if (z.cursorRow) z.bearbeite(z.cursorRow, z.aktiveSpalte)
    },
    tab: (e) => {
      if (!peekOffen()) spalteWechseln(1, true, e)
    },
    'shift+tab': (e) => {
      if (!peekOffen()) spalteWechseln(-1, true, e)
    },
    // Bei offenem Peek gehören ←/→ dem Peek (Lead wechseln) – Integration, FOUNDATION-WUNSCH M2
    arrowright: (e) => {
      if (!peekOffen()) spalteWechseln(1, false, e)
    },
    arrowleft: (e) => {
      if (!peekOffen()) spalteWechseln(-1, false, e)
    },
    // `Space` wählt aus (ux § 5.3) – nicht auf Knöpfen/Links (dort löst Space den Knopf aus)
    space: (e) => {
      if (peekOffen()) return
      const ziel = e.target instanceof Element ? e.target : null
      if (ziel?.closest?.('button, a, [role="button"]')) return
      const z = zustand.current
      if (!z.cursorRow || !z.onAuswahl) return
      e.preventDefault()
      z.toggle(z.cursorRow.id, false)
    },
  })

  const zelleKlick = (row: Row<DataTableFeatures, T>, spalte: string, e: ReactMouseEvent) => {
    onCursor?.(row.id)
    setAktiveSpalte(spalte)
    const meta = spaltenMeta(sichtbareSpalten.find((c) => c.id === spalte)?.columnDef ?? {})
    if (e.altKey && meta.editierbar) {
      e.preventDefault()
      bearbeite(row, spalte)
      return
    }
    if (meta.oeffnet && onEnter) onEnter(row.original)
  }

  const setRef = (el: HTMLDivElement | null) => {
    wrapRef.current = el
    if (typeof ref === 'function') ref(el)
    else if (ref && typeof ref === 'object') (ref as { current: HTMLDivElement | null }).current = el
  }

  const alleSichtbarGewaehlt = zeilenIds.length > 0 && zeilenIds.every((id) => auswahl?.has(id))
  const einigeGewaehlt = !alleSichtbarGewaehlt && zeilenIds.some((id) => auswahl?.has(id))

  const istLeer = daten.length === 0 && !hatMehr

  // ── Mobil: Liste 56 px ──
  if (mobil && mobilZeile) {
    return (
      <div ref={setRef} className={cn('relative', className)} aria-label={ariaLabel} role="list">
        {istLeer ? (
          <div className="py-8">{leer}</div>
        ) : (
          <div style={virtuell ? { height: virtualizer.getTotalSize(), position: 'relative' } : undefined}>
            {sichtbar.map(({ index, start, size }) => {
              const a = anzeige[index]
              if (!a) return null
              const stil = virtuell
                ? {
                    position: 'absolute' as const,
                    top: 0,
                    left: 0,
                    right: 0,
                    height: size,
                    transform: `translateY(${start - scrollMargin}px)`,
                  }
                : undefined
              if (a.art === 'gruppe') {
                return (
                  <div
                    key={`g:${a.key}`}
                    role="listitem"
                    style={stil}
                    className="label hairline flex h-8 items-center gap-2 px-3"
                  >
                    <button
                      type="button"
                      aria-expanded={!a.eingeklappt}
                      onClick={() => setEingeklappt((s) => toggleSet(s, a.key))}
                      className="label hover:text-ink flex items-center gap-1.5"
                    >
                      {a.eingeklappt ? <ChevronRight size={12} aria-hidden /> : <ChevronDown size={12} aria-hidden />}
                      {a.label}
                    </button>
                    {gruppierung?.zaehler !== false ? (
                      <span
                        className={cn(
                          'tnum font-mono text-[12px] tracking-normal normal-case',
                          a.ueberfaellig === a.anzahl && a.anzahl > 0 ? 'text-overdue' : 'text-ink-2',
                        )}
                      >
                        {a.anzahl}
                      </span>
                    ) : null}
                  </div>
                )
              }
              const row = a.row
              const zeit = zeitBalken ? zeitBalken(row.original) : null
              const cursor = row.id === cursorId
              const gewaehlt = !!auswahl?.has(row.id)
              return (
                <div
                  key={row.id}
                  role="listitem"
                  data-id={row.id}
                  aria-selected={cursor || undefined}
                  data-ausgewaehlt={gewaehlt || undefined}
                  style={stil}
                  onClick={() => {
                    onCursor?.(row.id)
                    onEnter?.(row.original)
                  }}
                  className={cn(
                    'hairline relative flex min-h-14 items-center pl-3',
                    cursor && 'cursor-bar',
                    !cursor && zeit === 'today' && 'shadow-[inset_2px_0_0_var(--color-signal)]',
                    !cursor && zeit === 'overdue' && 'shadow-[inset_2px_0_0_var(--color-overdue)]',
                    gewaehlt && 'bg-surface-hover',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    {mobilZeile(row.original, { cursor, ausgewaehlt: gewaehlt, zeit })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {hatMehr ? (
          <div
            ref={(el) => void (ladeRef.current = el as unknown as HTMLTableRowElement)}
            className="text-ink-3 mono px-3 py-3 text-[12.5px]"
          >
            Lade weitere …
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div ref={setRef} className={cn('max-xl:overflow-x-auto', className)}>
      <table
        aria-label={ariaLabel}
        aria-rowcount={zeilen.length}
        className="w-full table-fixed border-collapse max-xl:min-w-[var(--min-breite)]"
        style={{
          ['--zeile' as string]: `${hoehe}px`,
          ['--min-breite' as string]: minBreite === null ? '0px' : `${minBreite}px`,
        }}
      >
        <colgroup>
          {mitAuswahl ? <col style={{ width: 28 }} /> : null}
          {sichtbareSpalten.map((c) => {
            const meta = spaltenMeta(c.columnDef)
            const breite = meta.breite
            // <col> blendet mit th/td aus – sonst behielt die versteckte Spalte ihre Breite und alle rutschten nach links (Runde 2, 1024 px)
            return (
              <col
                key={c.id}
                className={cn(meta.ausblenden === 'lg' && 'max-lg:hidden', meta.ausblenden === 'xl' && 'max-xl:hidden')}
                style={breite && breite !== 'auto' ? { width: breite } : undefined}
              />
            )
          })}
        </colgroup>
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {mitAuswahl ? (
                <th
                  scope="col"
                  className={cn(
                    'bg-canvas border-line-strong h-8 border-b pb-2.5 pl-2 text-left align-bottom',
                    sticky && 'xl:sticky xl:top-[var(--head-h)] xl:z-[5]',
                  )}
                >
                  <input
                    type="checkbox"
                    className="checkbox"
                    aria-label="Alle sichtbaren auswählen"
                    checked={alleSichtbarGewaehlt}
                    ref={(el) => {
                      if (el) el.indeterminate = einigeGewaehlt
                    }}
                    onChange={() => setzeAuswahl(alleSichtbarGewaehlt ? [] : zeilenIds)}
                  />
                </th>
              ) : null}
              {hg.headers.map((header) => {
                const meta = spaltenMeta(header.column.columnDef)
                const sortierbar = header.column.getCanSort()
                const richtung = header.column.getIsSorted()
                const inhalt = header.isPlaceholder ? null : <table.FlexRender header={header} />
                const kopfText =
                  meta.kopfTitel ??
                  (typeof header.column.columnDef.header === 'string' ? header.column.columnDef.header : undefined)
                return (
                  <th
                    key={header.id}
                    scope="col"
                    title={sortierbar ? undefined : meta.kopfTitel}
                    aria-sort={richtung === 'asc' ? 'ascending' : richtung === 'desc' ? 'descending' : undefined}
                    className={cn(
                      'label bg-canvas border-line-strong h-8 border-b px-2.5 pb-2.5 text-left align-bottom leading-[1.2] font-semibold whitespace-normal',
                      sticky && 'xl:sticky xl:top-[var(--head-h)] xl:z-[5]',
                      meta.rechts && 'text-right',
                      meta.ausblenden === 'lg' && 'max-lg:hidden',
                      meta.ausblenden === 'xl' && 'max-xl:hidden',
                      meta.klasse,
                    )}
                  >
                    {sortierbar ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        // max-w-full + truncate: „Letzte Bewegung“ lief bei 1440 px unter die Nachbarspalte und war ohne „…“ abgeschnitten
                        className={cn(
                          'label hover:text-ink inline-flex max-w-full min-w-0 items-center gap-1',
                          meta.kopfUmbruch ? cn('whitespace-normal', meta.rechts && 'text-right') : 'whitespace-nowrap',
                        )}
                        title={kopfText ? `${kopfText} – sortieren · ⇧Klick: sekundär` : 'Sortieren · ⇧Klick: sekundär'}
                      >
                        <span className={meta.kopfUmbruch ? 'min-w-0' : 'min-w-0 truncate'}>{inhalt}</span>
                        {richtung ? (
                          <span className="text-ink font-mono tracking-normal" aria-hidden>
                            {richtung === 'asc' ? '↑' : '↓'}
                          </span>
                        ) : null}
                      </button>
                    ) : (
                      inhalt
                    )}
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {istLeer ? (
            <tr>
              <td colSpan={spaltenZahl} className="py-8">
                {leer}
              </td>
            </tr>
          ) : null}
          {virtuell && obenAbstand > 0 ? (
            <tr aria-hidden>
              <td colSpan={spaltenZahl} style={{ height: obenAbstand, padding: 0, border: 0 }} />
            </tr>
          ) : null}
          {sichtbar.map(({ index }) => {
            const a = anzeige[index]
            if (!a) return null
            if (a.art === 'gruppe') {
              return (
                <tr key={`g:${a.key}`} data-gruppe={a.key} className="bg-canvas">
                  <td
                    colSpan={spaltenZahl}
                    className="border-line h-8 border-b px-2.5 align-middle"
                    style={{ height: GRUPPEN_HOEHE }}
                  >
                    <button
                      type="button"
                      aria-expanded={!a.eingeklappt}
                      onClick={() => setEingeklappt((s) => toggleSet(s, a.key))}
                      className="label hover:text-ink inline-flex items-center gap-1.5"
                    >
                      {a.eingeklappt ? (
                        <ChevronRight size={12} strokeWidth={1.75} aria-hidden />
                      ) : (
                        <ChevronDown size={12} strokeWidth={1.75} aria-hidden />
                      )}
                      {a.label}
                      {gruppierung?.zaehler !== false ? (
                        <span
                          className={cn(
                            'tnum ml-1 font-mono text-[12px] font-normal tracking-normal normal-case',
                            a.ueberfaellig === a.anzahl && a.anzahl > 0 ? 'text-overdue' : 'text-ink-2',
                          )}
                          data-zaehler
                        >
                          {a.anzahl}
                        </span>
                      ) : null}
                    </button>
                  </td>
                </tr>
              )
            }
            const row = a.row
            const zeit = zeitBalken ? zeitBalken(row.original) : null
            const cursor = row.id === cursorId
            const gewaehlt = !!auswahl?.has(row.id)
            return (
              <tr
                key={row.id}
                data-id={row.id}
                data-index={index}
                aria-selected={cursor || undefined}
                data-ausgewaehlt={gewaehlt || undefined}
                data-zeit={zeit ?? undefined}
                className={cn(
                  'group/zeile ease-brand cursor-pointer transition-[background] duration-[var(--t-1)]',
                  'hover:bg-surface-hover',
                  (cursor || gewaehlt) && 'bg-surface-hover',
                )}
                style={{ height: hoehe }}
              >
                {mitAuswahl ? (
                  <td
                    className={cn(
                      'border-line border-b pl-2 align-middle',
                      cursor && 'shadow-[inset_2px_0_0_var(--color-signal)]',
                      !cursor && zeit === 'today' && 'shadow-[inset_2px_0_0_var(--color-signal)]',
                      !cursor && zeit === 'overdue' && 'shadow-[inset_2px_0_0_var(--color-overdue)]',
                    )}
                    onClick={(e) => {
                      e.stopPropagation()
                      onCursor?.(row.id)
                    }}
                  >
                    <input
                      type="checkbox"
                      className={cn(
                        'checkbox ease-brand transition-opacity duration-[var(--t-1)]',
                        !gewaehlt && !cursor && 'opacity-0 group-hover/zeile:opacity-100 focus-visible:opacity-100',
                      )}
                      aria-label="Auswählen"
                      checked={gewaehlt}
                      onClick={(e) => toggle(row.id, e.shiftKey)}
                      onChange={() => {}}
                    />
                  </td>
                ) : null}
                {row.getAllCells().map((cell, ci) => {
                  const meta = spaltenMeta(cell.column.columnDef)
                  const erste = ci === 0 && !mitAuswahl
                  const aktiv = cursor && aktiveSpalte === cell.column.id
                  return (
                    <td
                      key={cell.id}
                      data-zelle={cell.column.id}
                      data-aktiv={aktiv || undefined}
                      className={cn(
                        'text-table border-line truncate border-b px-2.5 align-middle whitespace-nowrap',
                        meta.rechts && 'text-right',
                        meta.mono && 'text-ink-2 tnum font-mono text-[13px]',
                        meta.ausblenden === 'lg' && 'max-lg:hidden',
                        meta.ausblenden === 'xl' && 'max-xl:hidden',
                        erste && cursor && 'shadow-[inset_2px_0_0_var(--color-signal)]',
                        erste && !cursor && zeit === 'today' && 'shadow-[inset_2px_0_0_var(--color-signal)]',
                        erste && !cursor && zeit === 'overdue' && 'shadow-[inset_2px_0_0_var(--color-overdue)]',
                        aktiv && 'ring-line-strong ring-1 ring-inset',
                        meta.klasse,
                      )}
                      onClick={(e) => zelleKlick(row, cell.column.id, e)}
                      onDoubleClick={(e) => {
                        if (!meta.editierbar) return
                        e.preventDefault()
                        bearbeite(row, cell.column.id)
                      }}
                    >
                      <table.FlexRender cell={cell} />
                    </td>
                  )
                })}
              </tr>
            )
          })}
          {virtuell && untenAbstand > 0 ? (
            <tr aria-hidden>
              <td colSpan={spaltenZahl} style={{ height: untenAbstand, padding: 0, border: 0 }} />
            </tr>
          ) : null}
          {hatMehr ? (
            <tr ref={ladeRef} data-lade-mehr>
              <td colSpan={spaltenZahl} className="text-ink-3 tnum h-10 px-2.5 font-mono text-[12.5px]">
                Lade weitere …
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}

function toggleSet(s: Set<string>, k: string): Set<string> {
  const n = new Set(s)
  if (n.has(k)) n.delete(k)
  else n.add(k)
  return n
}
