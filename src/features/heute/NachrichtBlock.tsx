// Nachrichten-Block der Queue-Karte (DESIGN-SYSTEM § 5.7 Nr. 5, ux § 3.1.2 Nr. 4): Kopfleiste „Leitfaden · … · Platzhalter n/m
// gefüllt“ + „ändern ⌘⇧E“ (VorlageWaehlen, M6) + „Text bearbeiten“; gefüllte Platzhalter als <mark class="ph">, offene als
// Eingabefeld im Text (Amber auf overdue-tint). Werte und Snapshot liegen im kartenStore (nur diese Karte).
import { useRef, type Ref } from 'react'
import { cn } from '@/components/ui/cn'
import { Textarea } from '@/components/ui/Textarea'
import { VorlageWaehlen } from '@/features/leitfaeden/public'
import { platzhalterWert, type PlatzhalterKontext, type PlatzhalterLead } from '@/lib/platzhalter'
import type { Channel, Template, TemplatePhase } from '@/types/domain'
import { useKartenStore, type KartenZustand } from './kartenStore'
import { blockKopf, skriptPunkte, type NachrichtErgebnis } from './nachricht'

const TOKEN_RE = /\[([^[\]\n]{1,40})\]/g
const LITERAL_ANREDE_RE = /\b(Herr|Frau)\s+\[Nachname\]/g

export type NachrichtBlockProps = {
  itemKey: string
  vorlage: Template | null
  lead: PlatzhalterLead
  ctx: PlatzhalterKontext
  ergebnis: NachrichtErgebnis
  zustand: KartenZustand
  kanal: Channel
  phase?: TemplatePhase
  /** Ref auf „ändern“ – ⌘⇧E klickt ihn */
  vorlageRef?: Ref<HTMLButtonElement>
  /** `[Anrede]` bei `neutral`: einmal Herr/Frau wählen, wird am Lead gespeichert */
  onAnrede?: (anrede: 'herr' | 'frau') => void
  /** Telefon: Stichpunkte statt Fließtext, nicht editierbar */
  skript?: boolean
  /** E-Mail: Betreff als Überschrift, Vorschau 3 Zeilen */
  betreff?: string | null
  className?: string
}

type Stueck = { art: 'text'; text: string } | { art: 'token'; name: string; wert: string | null; manuell: boolean }

function zerlege(body: string, lead: PlatzhalterLead, ctx: PlatzhalterKontext): Stueck[] {
  const norm = body.replace(LITERAL_ANREDE_RE, '[Anrede] [Nachname]')
  const out: Stueck[] = []
  let pos = 0
  for (const m of norm.matchAll(TOKEN_RE)) {
    const i = m.index ?? 0
    if (i > pos) out.push({ art: 'text', text: norm.slice(pos, i) })
    const name = (m[1] as string).trim()
    out.push({ art: 'token', name, wert: platzhalterWert(name, lead, ctx), manuell: !!ctx.werte?.[name]?.trim() })
    pos = i + m[0].length
  }
  if (pos < norm.length) out.push({ art: 'text', text: norm.slice(pos) })
  return out
}

function OffenerPlatzhalter({
  name,
  wert,
  onChange,
  onAnrede,
}: {
  name: string
  wert: string
  onChange: (w: string) => void
  onAnrede?: (a: 'herr' | 'frau') => void
}) {
  if (name === 'Anrede' && onAnrede) {
    return (
      <span className="inline-flex items-center gap-1 align-baseline" role="group" aria-label="Anrede wählen">
        {(['herr', 'frau'] as const).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => onAnrede(a)}
            className="bg-overdue-tint text-overdue border-overdue rounded-xs border-b border-dotted px-1 text-[0.95em] hover:border-solid"
          >
            {a === 'herr' ? 'Herr' : 'Frau'}
          </button>
        ))}
      </span>
    )
  }
  return (
    <input
      aria-label={`${name} eintragen`}
      placeholder={`${name} eintragen`}
      value={wert}
      size={Math.max(10, (wert || `${name} eintragen`).length)}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur()
      }}
      className="bg-overdue-tint text-overdue border-overdue placeholder:text-overdue/70 inline-block max-w-full rounded-none border-0 border-b border-dotted px-1 align-baseline font-[inherit] leading-[inherit] text-[inherit] outline-none focus:border-solid"
    />
  )
}

export function NachrichtBlock({
  itemKey,
  vorlage,
  lead,
  ctx,
  ergebnis,
  zustand,
  kanal,
  phase,
  vorlageRef,
  onAnrede,
  skript,
  betreff,
  className,
}: NachrichtBlockProps) {
  const setze = useKartenStore((s) => s.setze)
  const setzeWert = useKartenStore((s) => s.setzeWert)
  const feld = useRef<HTMLTextAreaElement | null>(null)
  const kopf = blockKopf(vorlage, ergebnis, skript)
  const offenZahl = ergebnis.offen.length

  const absaetze = (body: string) =>
    body
      .split(/\n{2,}/)
      .map((a) => a.trim())
      .filter(Boolean)

  const rendereAbsatz = (absatz: string, i: number) => (
    <p key={i} className="m-0 mb-[0.9em] last:mb-0">
      {zerlege(absatz, lead, ctx).map((s, j) =>
        s.art === 'text' ? (
          <span key={j}>{s.text}</span>
        ) : s.wert !== null ? (
          <mark
            key={j}
            className="decoration-line-strong hover:decoration-ink-3 ease-brand bg-transparent text-inherit underline decoration-dotted decoration-1 underline-offset-[3px] transition-[text-decoration-color] duration-[var(--t-1)]"
            title={s.manuell ? `${s.name} eingetragen` : `aus ${s.name}`}
            data-platzhalter={s.name}
          >
            {s.wert}
          </mark>
        ) : (
          <OffenerPlatzhalter
            key={j}
            name={s.name}
            wert={zustand.werte[s.name] ?? ''}
            onChange={(w) => setzeWert(itemKey, s.name, w)}
            onAnrede={onAnrede}
          />
        ),
      )}
    </p>
  )

  return (
    <div
      className={cn('border-line bg-surface-hover mt-3.5 max-w-[64ch] rounded-sm border', className)}
      data-nachricht-block
    >
      <div className="border-line text-ink-3 tnum flex min-h-7 flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-3 py-1 font-mono text-[11.5px] tracking-[0.02em]">
        <span className="min-w-0 truncate" title={kopf}>
          {offenZahl > 0 && ergebnis.alle.length ? (
            <>
              {kopf.replace(/Platzhalter \d+\/\d+ gefüllt$/, 'Platzhalter ')}
              <span className="text-overdue">
                {ergebnis.alle.length - offenZahl}/{ergebnis.alle.length}
              </span>{' '}
              gefüllt
            </>
          ) : (
            kopf
          )}
        </span>
        <span className="flex-1" />
        <VorlageWaehlen
          kanal={kanal}
          phase={phase ?? vorlage?.phase ?? undefined}
          aktuellId={vorlage?.id}
          onSelect={(t) => setze(itemKey, { vorlageId: t.id, text: null, bearbeiten: false })}
          trigger={
            <button
              ref={vorlageRef}
              type="button"
              className="hover:text-ink inline-flex items-center gap-1.5 whitespace-nowrap"
              aria-label="Vorlage wechseln"
            >
              ändern <kbd className="kbd">⌘⇧E</kbd>
            </button>
          }
        />
        {!skript ? (
          zustand.bearbeiten ? (
            <button
              type="button"
              className="hover:text-ink whitespace-nowrap"
              onClick={() => setze(itemKey, { bearbeiten: false, text: null })}
            >
              Original
            </button>
          ) : (
            <button
              type="button"
              className="hover:text-ink whitespace-nowrap"
              onClick={() => {
                setze(itemKey, { bearbeiten: true, text: ergebnis.text })
                setTimeout(() => feld.current?.focus(), 0)
              }}
            >
              Text bearbeiten
            </button>
          )
        ) : null}
      </div>
      {betreff ? <div className="text-h3 text-ink-bright px-4 pt-3">{betreff}</div> : null}
      {zustand.bearbeiten ? (
        <div className="p-2">
          <Textarea
            ref={feld}
            aria-label="Text bearbeiten"
            value={zustand.text ?? ergebnis.text}
            onChange={(e) => setze(itemKey, { text: e.target.value })}
            className="text-body"
          />
          {offenZahl > 0 ? (
            <p className="text-small text-overdue mt-1.5 px-1">
              Noch offen: {ergebnis.offen.map((o) => `[${o}]`).join(' · ')}
            </p>
          ) : null}
        </div>
      ) : skript && !skriptPunkte(ergebnis.text).length ? (
        // Ohne Skript stand hier ein leerer Kasten (Runde 2, Mikes Rückruf ohne Leitfaden)
        <div className="px-4 py-3.5">
          <p className="text-small text-ink-3 m-0">Kein Skript hinterlegt – über „ändern“ wählen.</p>
        </div>
      ) : skript ? (
        <ul className="m-0 grid list-none gap-1.5 p-3.5 pl-4 text-[14px] leading-[1.5]">
          {skriptPunkte(ergebnis.text).map((p, i) => (
            <li key={i} className="text-ink-3 relative pl-3.5 before:absolute before:left-0 before:content-['–']">
              <span className="text-ink">{p}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className={cn('text-body px-4 py-3.5', betreff && 'line-clamp-3 pt-1.5')}>
          {vorlage ? (
            absaetze(vorlage.body).map(rendereAbsatz)
          ) : (
            <p className="text-small text-ink-3 m-0">Keine Vorlage hinterlegt – über „ändern“ wählen.</p>
          )}
        </div>
      )}
    </div>
  )
}
