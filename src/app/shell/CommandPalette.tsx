import { useIsFetching } from '@tanstack/react-query'
import { Command } from 'cmdk'
import { Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import {
  BEFEHLE,
  PALETTE_QUELLEN,
  passtSuche,
  type Befehl,
  type BefehlKontext,
  type PaletteTreffer,
} from '@/app/befehle'
import { useUiStore } from '@/app/uiStore'
import { Chip } from '@/components/ui/Chip'
import { Kbd } from '@/components/ui/Kbd'
import { cn } from '@/components/ui/cn'
import { useMe } from '@/data/members'
import { useAuth } from '@/features/auth/authStore'
import { useIstTelefon } from '@/lib/useMediaQuery'
import type { Member } from '@/types/domain'

const ZULETZT_KEY = 'crm.palette.zuletzt'
const PRAEFIX: Record<string, 'aktionen' | 'leitfaeden' | 'leads' | 'ansichten'> = {
  '>': 'aktionen',
  '#': 'leitfaeden',
  '@': 'leads',
  '*': 'ansichten',
}
const GRUPPEN_LABEL = {
  leads: 'Leads',
  aktionen: 'Aktionen',
  seiten: 'Seiten',
  leitfaeden: 'Leitfäden',
  ansichten: 'Ansichten',
} as const

/**
 * Mobil (Vollbild, kein Esc): die offene Palette legt einen Verlaufseintrag an – „Zurück“ schließt sie (Runde 3, 390 px).
 * Schließt sie anders, wird der Eintrag wieder entfernt; Befehle mit Navigation laufen erst danach, sonst nähme das
 * `history.back()` die neue Seite gleich wieder weg.
 */
export const PALETTE_VERLAUF = 'crmPalette'
let zurueckLaeuft = false
const nachZurueck: (() => void)[] = []
function istPaletteEintrag(state: unknown): boolean {
  return !!state && typeof state === 'object' && (state as Record<string, unknown>)[PALETTE_VERLAUF] === true
}
function paletteEintragEntfernen(danach?: () => void) {
  if (danach) nachZurueck.push(danach)
  if (zurueckLaeuft) return
  if (!istPaletteEintrag(window.history.state)) {
    nachZurueck.splice(0).forEach((f) => f())
    return
  }
  zurueckLaeuft = true
  const fertig = () => {
    window.removeEventListener('popstate', fertig)
    zurueckLaeuft = false
    nachZurueck.splice(0).forEach((f) => f())
  }
  window.addEventListener('popstate', fertig)
  window.history.back()
}

function liesZuletzt(): string[] {
  try {
    return JSON.parse(localStorage.getItem(ZULETZT_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}
function merkeZuletzt(id: string) {
  try {
    const alt = liesZuletzt().filter((x) => x !== id)
    localStorage.setItem(ZULETZT_KEY, JSON.stringify([id, ...alt].slice(0, 5)))
  } catch {
    /* ohne Storage keine Historie */
  }
}

/** Eine Suchquelle (Hook-Aufruf stabil, Quellen-Array ist statisch). */
function QuelleGruppe({
  gruppe,
  useTreffer,
  q,
  nurGruppe,
  ctx,
  vollansicht,
  onFertig,
}: {
  gruppe: 'leads' | 'leitfaeden' | 'ansichten'
  useTreffer: (q: string, nurGruppe: boolean) => PaletteTreffer[]
  q: string
  nurGruppe: boolean
  ctx: BefehlKontext
  /** ⌘↵ gedrückt (Vollansicht statt Peek) – gesetzt im keydown vor cmdk's onSelect */
  vollansicht: () => boolean
  onFertig: (aktion: () => void) => void
}) {
  const treffer = useTreffer(q, nurGruppe)
  if (treffer.length === 0) return null
  return (
    <Command.Group
      heading={GRUPPEN_LABEL[gruppe]}
      className="[&+[cmdk-group]]:border-line [&_[cmdk-group-heading]]:label p-2 [&_[cmdk-group-heading]]:block [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-1.5 [&_[cmdk-group-heading]]:pb-1 [&+[cmdk-group]]:border-t"
    >
      {treffer.map((t) => (
        <Command.Item
          key={`${gruppe}:${t.id}`}
          value={`${gruppe}:${t.id}`}
          onSelect={() => {
            const voll = vollansicht()
            onFertig(() => t.ausfuehren(ctx, voll))
          }}
          className="text-ui data-[selected=true]:cursor-bar relative flex h-10 cursor-default items-center gap-3 rounded-sm px-2.5"
        >
          {/* Einzeilig wie die 40-px-Zeile verlangt: lange Namen/Firmen enden mit „…“ (Runde 2: zweizeilige Treffer) */}
          {gruppe === 'leads' ? (
            <span
              className="text-ink-bright max-w-[60%] flex-none truncate font-serif text-[18px] leading-[1.2] italic"
              title={t.name}
            >
              {t.name}
            </span>
          ) : (
            <span className="min-w-0 truncate" title={t.name}>
              {t.name}
            </span>
          )}
          {t.untertitel ? (
            <span className="text-small text-ink-3 min-w-0 truncate" title={t.untertitel}>
              {t.untertitel}
            </span>
          ) : null}
          {t.chip ? (
            <Chip ton={t.chip.ton} className="ml-1.5 flex-none">
              {t.chip.label}
            </Chip>
          ) : null}
          {t.tasten?.length ? (
            <span className="ml-auto flex flex-none gap-1">
              {t.tasten.map((k) => (
                <Kbd key={k}>{k}</Kbd>
              ))}
            </span>
          ) : null}
        </Command.Item>
      ))}
    </Command.Group>
  )
}

/**
 * ⌘K-Palette (DESIGN-SYSTEM § 5.19): 640 px, surface-raised, Radius lg, shadow-float, 14 vh von oben, Scrim .5. Eingabe 48 px,
 * Gruppen Leads · Aktionen · Seiten · Leitfäden · Ansichten, Präfixe > # @ *, Einträge 40 px, Cursor .cursor-bar, Fuß 36 px.
 * Kürzlich benutzt zuerst (max. 5). Mobil Vollbild.
 */
export function CommandPalette() {
  const offen = useUiStore((s) => s.paletteOffen)
  const setOffen = useUiStore((s) => s.setPaletteOffen)
  return (
    <Command.Dialog
      open={offen}
      onOpenChange={setOffen}
      label="Suchen oder Befehl"
      shouldFilter={false}
      overlayClassName="fixed inset-0 z-[60] bg-canvas/50"
      contentClassName={cn(
        'fixed left-1/2 top-[14vh] z-[61] w-[min(var(--spacing-palette),calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-lg bg-surface-raised shadow-float outline-none',
        'animate-[pop-in_var(--t-3)_var(--ease-brand)] max-md:inset-0 max-md:top-0 max-md:w-auto max-md:translate-x-0 max-md:rounded-none',
      )}
    >
      {offen ? <PaletteInhalt schliessen={() => setOffen(false)} /> : null}
    </Command.Dialog>
  )
}

/** Inhalt der Palette – wird mit dem Dialog ge- und entmountet, der Suchtext startet also immer leer. */
function PaletteInhalt({ schliessen }: { schliessen: () => void }) {
  const sucheLaeuft = useIsFetching({ queryKey: ['leads', 'suche'] }) > 0
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const member = useAuth((s) => s.member)
  const [text, setText] = useState('')
  const [zuletzt] = useState<string[]>(() => liesZuletzt())
  // ⌘↵ = Vollansicht (ux § 5.6): cmdk ruft onSelect ohne Event – das keydown davor merkt sich den Modifier
  const meta = useRef(false)

  const praefix = PRAEFIX[text.charAt(0)]
  const q = praefix ? text.slice(1).trim() : text.trim()

  const mobil = useIstTelefon()
  useEffect(() => {
    if (!mobil) return
    if (!istPaletteEintrag(window.history.state))
      window.history.pushState({ ...(window.history.state as object | null), [PALETTE_VERLAUF]: true }, '')
    const zurueck = (e: PopStateEvent) => {
      if (!istPaletteEintrag(e.state)) useUiStore.getState().setPaletteOffen(false)
    }
    window.addEventListener('popstate', zurueck)
    return () => {
      window.removeEventListener('popstate', zurueck)
      // Nach dem Commit prüfen: StrictMode mountet doppelt – nur eine wirklich geschlossene Palette räumt auf
      window.setTimeout(() => {
        if (!useUiStore.getState().paletteOffen) paletteEintragEntfernen()
      }, 0)
    }
  }, [mobil])
  /** Palette schließen, dann (mobil erst nach dem Entfernen des Verlaufseintrags) die Aktion ausführen. */
  const fertig = (aktion: () => void) => {
    schliessen()
    if (mobil) paletteEintragEntfernen(aktion)
    else aktion()
  }

  // `me` aus der View crm.members (useMe); bis sie geladen ist, der Auth-Member (id · email · display_name)
  const meView = useMe()
  const me = useMemo<Member>(
    () =>
      meView ??
      ({
        id: member?.user_id ?? '',
        email: member?.email ?? '',
        display_name: member?.display_name ?? '',
        short_name: member?.display_name ?? '',
      } as unknown as Member),
    [meView, member],
  )
  const ctx: BefehlKontext = useMemo(() => ({ navigate, leadId: params.get('lead'), me }), [navigate, params, me])

  const ausfuehren = (b: Befehl) => {
    merkeZuletzt(b.id)
    fertig(() => b.ausfuehren(ctx))
  }

  const sichtbar = BEFEHLE.filter((b) => (b.sichtbar ? b.sichtbar(ctx) : true) && passtSuche(b.label, q))
  const zeigeGruppe = (g: 'aktionen' | 'seiten' | 'leads' | 'leitfaeden' | 'ansichten') => !praefix || praefix === g
  const kuerzlich =
    !q && !praefix ? zuletzt.map((id) => sichtbar.find((b) => b.id === id)).filter((b): b is Befehl => !!b) : []
  const gruppen = (['aktionen', 'seiten'] as const).map((g) => ({
    g,
    eintraege: sichtbar.filter((b) => b.gruppe === g && !kuerzlich.includes(b)),
  }))

  const eintrag = (b: Befehl, praefixId: string) => (
    <Command.Item
      key={`${praefixId}${b.id}`}
      value={`${praefixId}${b.id}`}
      onSelect={() => ausfuehren(b)}
      className="text-ui data-[selected=true]:cursor-bar relative flex h-10 cursor-default items-center gap-3 rounded-sm px-2.5"
    >
      <span>{b.label}</span>
      {b.tasten?.length ? (
        <span className="ml-auto flex gap-1">
          {b.tasten.map((k) => (k.includes(' ') ? <Kbd key={k} akkord={k} /> : <Kbd key={k}>{k}</Kbd>))}
        </span>
      ) : null}
    </Command.Item>
  )
  const gruppeKlasse =
    'p-2 [&+[cmdk-group]]:border-t [&+[cmdk-group]]:border-line [&_[cmdk-group-heading]]:label [&_[cmdk-group-heading]]:block [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-1.5'

  return (
    <div
      onKeyDownCapture={(e) => {
        meta.current = e.key === 'Enter' && (e.metaKey || e.ctrlKey)
      }}
    >
      <div className="border-line flex h-12 items-center gap-2.5 border-b px-[18px]">
        <Search size={16} strokeWidth={1.75} aria-hidden className="text-ink-3" />
        <Command.Input
          autoFocus
          value={text}
          onValueChange={setText}
          placeholder="Lead, Aktion, Seite oder Leitfaden …"
          className="placeholder:text-ink-4 min-w-0 flex-1 bg-transparent text-[15px] outline-none"
        />
        {/* Telefon hat kein Esc: sichtbarer Ausgang (Runde 3, 390 × 844 – vorher kein einziger Button im Dialog) */}
        {mobil ? (
          <button
            type="button"
            onClick={schliessen}
            className="text-ui text-ink-2 hover:text-ink -mr-2 flex h-11 flex-none items-center px-2"
          >
            Abbrechen
          </button>
        ) : (
          <Kbd>Esc</Kbd>
        )}
      </div>
      <Command.List className="max-h-[min(60vh,520px)] overflow-auto max-md:max-h-none">
        <Command.Empty className="text-small text-ink-3 px-[18px] py-6">
          {/* Runde 2: während die Lead-Suche läuft stand ~1 s „Nichts gefunden.“, dann kamen 12 Treffer */}
          {sucheLaeuft ? 'Suche …' : 'Nichts gefunden.'}
        </Command.Empty>
        {kuerzlich.length > 0 ? (
          <Command.Group heading="Zuletzt" className={gruppeKlasse}>
            {kuerzlich.map((b) => eintrag(b, 'zuletzt:'))}
          </Command.Group>
        ) : null}
        {PALETTE_QUELLEN.map((qu) =>
          zeigeGruppe(qu.gruppe) ? (
            <QuelleGruppe
              key={qu.gruppe}
              gruppe={qu.gruppe}
              useTreffer={qu.useTreffer}
              q={q}
              nurGruppe={praefix === qu.gruppe}
              ctx={ctx}
              vollansicht={() => meta.current}
              onFertig={fertig}
            />
          ) : null,
        )}
        {gruppen.map(({ g, eintraege }) =>
          zeigeGruppe(g) && eintraege.length > 0 ? (
            <Command.Group key={g} heading={GRUPPEN_LABEL[g]} className={gruppeKlasse}>
              {eintraege.map((b) => eintrag(b, ''))}
            </Command.Group>
          ) : null,
        )}
      </Command.List>
      <div className="border-line text-ink-3 flex h-9 flex-wrap items-center gap-4 border-t px-[18px] text-[12px]">
        <span className="inline-flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> wählen
        </span>
        <span className="inline-flex items-center gap-1">
          <Kbd>↵</Kbd> öffnen · <Kbd>⌘</Kbd>
          <Kbd>↵</Kbd> Vollansicht
        </span>
        <span>
          <span className="font-mono">&gt;</span> Aktionen · <span className="font-mono">#</span> Leitfäden ·{' '}
          <span className="font-mono">@</span> Leads · <span className="font-mono">*</span> Ansichten
        </span>
      </div>
    </div>
  )
}
