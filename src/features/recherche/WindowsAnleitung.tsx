// Einrichtung des Recherche-Diensts unter Windows als freundliche Schritt-für-Schritt-Anleitung (30.10.2026, Vincent: Mike
// „kennt sich mit Computern nicht gut aus“ – kein sichtbarer Code, „Kopieren“-Knöpfe, farbig, je Schritt ein „Warum?“).
// Farben mit fester Bedeutung, gleich wie im PowerShell-Fenster (einrichten.ps1): Blau = das machst du, Gelb = warum,
// Grün = erledigt, Rot = Foto an Vincent. Jeder Schritt hat zusätzlich seine eigene Farbe in der Fortschrittsleiste.
import { AppWindow, Check, Copy, Globe, MousePointerClick, Puzzle, Store } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Button, cn } from '@/components/ui'
import { WINDOWS_TITEL } from './logik'

/** Text, den Mike in der ChatGPT-App einfügt, damit LinkedIn einmal erlaubt wird (einrichten.ps1 kopiert ihn ebenfalls). */
const LINKEDIN_TEXT = '@Chrome öffne https://www.linkedin.com/feed/'

const SCHRITT_FARBE = [
  { balken: 'bg-signal', zahl: 'bg-signal text-signal-ink' },
  { balken: 'bg-tag-lila-ink', zahl: 'bg-tag-lila-ink text-signal-ink' },
  { balken: 'bg-tag-orange-ink', zahl: 'bg-tag-orange-ink text-signal-ink' },
  { balken: 'bg-done', zahl: 'bg-done text-signal-ink' },
] as const

/** Fortschritt: farbige Leiste je Schritt und die Überschrift mit Nummer. */
export function Fortschritt({ seite }: { seite: number }) {
  return (
    <div className="grid gap-2.5">
      <div className="grid grid-cols-4 gap-1.5" aria-hidden>
        {SCHRITT_FARBE.map((f, i) => (
          <span key={f.balken} className={cn('h-1.5 rounded-full', i <= seite ? f.balken : 'bg-line-strong')} />
        ))}
      </div>
      <h3 className="text-ink-bright flex items-center gap-2.5 text-[17px] font-semibold" data-seite={seite}>
        <span
          className={cn('grid size-7 shrink-0 place-items-center rounded-full text-[14px]', SCHRITT_FARBE[seite]?.zahl)}
          aria-hidden
        >
          {seite + 1}
        </span>
        <span>
          <span className="sr-only">
            Schritt {seite + 1} von {WINDOWS_TITEL.length}:{' '}
          </span>
          {WINDOWS_TITEL[seite]}
        </span>
      </h3>
    </div>
  )
}

const Warum = ({ children }: { children: ReactNode }) => (
  <p className="bg-tag-gelb text-tag-gelb-ink text-small rounded-md px-3.5 py-2.5">
    <span className="font-semibold">Warum? </span>
    {children}
  </p>
)

const Tun = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('bg-signal-tint text-ink grid gap-3 rounded-md px-4 py-3.5', className)}>{children}</div>
)

const Gut = ({ children }: { children: ReactNode }) => (
  <p className="bg-done-tint text-done flex items-center gap-2 rounded-md px-3.5 py-2.5 font-semibold" role="status">
    <Check size={18} strokeWidth={2.5} aria-hidden /> {children}
  </p>
)

// Taste als Inhalt der Anleitung – kein <kbd>: das blendet tokens.css auf Touch-Geräten aus (dort sind es nur Kürzel-Hinweise)
const Taste = ({ children }: { children: ReactNode }) => (
  <span className="border-line-strong bg-surface-raised text-ink inline-block rounded-[6px] border border-b-2 px-2 py-0.5 text-[14px] leading-tight font-semibold">
    {children}
  </span>
)

/** Kleiner „Kopieren“-Knopf mit kurzer Bestätigung im Knopf selbst. */
function KopierKnopf({ text, label, onKopieren }: { text: string; label: string; onKopieren: (t: string) => void }) {
  const [fertig, setFertig] = useState(false)
  return (
    <Button
      variante="secondary"
      icon={fertig ? Check : Copy}
      onClick={() => {
        onKopieren(text)
        setFertig(true)
        setTimeout(() => setFertig(false), 2500)
      }}
    >
      {fertig ? 'Kopiert' : label}
    </Button>
  )
}

/** Was im PowerShell-Fenster passieren kann – mit Symbol, Handlung und Grund. */
const UNTERWEGS = [
  {
    icon: Store,
    tun: 'Microsoft Store: „Herunterladen“ klicken, danach in der ChatGPT-App anmelden.',
    warum: 'Die App erledigt die Recherche – über deinen ChatGPT-Zugang.',
  },
  {
    icon: Puzzle,
    tun: 'Chrome: „Hinzufügen“ klicken und die Rückfrage bestätigen.',
    warum: 'So kann ChatGPT in Chrome lesen und klicken. Darum fragt Chrome auch nach.',
  },
  {
    icon: AppWindow,
    tun: 'ChatGPT-App: „Computer Use“ einschalten. Das Fenster sagt dir, wo.',
    warum: 'Erst damit darf ChatGPT dein Chrome bedienen.',
  },
  {
    icon: Globe,
    tun: 'ChatGPT-App: diesen Text einfügen und LinkedIn erlauben.',
    warum: 'ChatGPT fragt bei neuen Seiten einmal nach – später arbeitet es ohne Rückfrage.',
    text: LINKEDIN_TEXT,
  },
] as const

// Farben wie im PowerShell-Fenster (Windows-Konsolenfarben Cyan, DarkYellow, Green, Red im Standard-Farbschema)
const LEGENDE = [
  { farbe: 'bg-[#61d6d6]', text: 'Hellblau: das machst du' },
  { farbe: 'bg-[#c19c00]', text: 'Gelb: warum' },
  { farbe: 'bg-[#16c60c]', text: 'Grün: erledigt' },
  { farbe: 'bg-[#e74856]', text: 'Rot: Foto an Vincent' },
] as const

/** Inhalt einer Seite (Index in WINDOWS_TITEL, logik.ts); „Weiter“/„Zurück“ stellt der Dialog. */
export function WindowsSeite({
  seite,
  befehl,
  kopiert,
  busy,
  onBefehl,
  onKopieren,
  verbunden,
}: {
  seite: number
  befehl: string | null
  /** null, solange nicht versucht; false, wenn der Browser nicht kopieren durfte */
  kopiert: boolean | null
  busy: boolean
  /** erzeugt den Befehl und kopiert ihn – bzw. kopiert ihn erneut */
  onBefehl: () => void
  onKopieren: (text: string) => void
  verbunden: boolean | undefined
}) {
  const [zeigen, setZeigen] = useState(false)
  switch (seite) {
    case 0:
      return (
        <>
          <p className="text-body text-ink-2">
            Hallo! In etwa 10 Minuten ist alles eingerichtet. Du wirst bei jedem Schritt geführt und kannst nichts
            kaputt machen.
          </p>
          <Tun className="justify-items-start">
            <p className="font-semibold">Klick auf den Knopf – dein Befehl liegt dann in der Zwischenablage.</p>
            <Button variante="primary" groesse="L" icon={Copy} busy={busy} onClick={onBefehl}>
              {befehl ? 'Nochmal kopieren' : 'Befehl kopieren'}
            </Button>
          </Tun>
          {kopiert ? <Gut>Kopiert! Weiter geht’s mit „Weiter“.</Gut> : null}
          {kopiert === false ? (
            <div className="bg-danger-tint text-danger text-small grid gap-2 rounded-md px-3.5 py-2.5">
              <p>Das Kopieren hat nicht geklappt. Klick bitte noch einmal auf „Nochmal kopieren“.</p>
              {befehl && !zeigen ? (
                <button type="button" className="justify-self-start underline" onClick={() => setZeigen(true)}>
                  Klappt immer noch nicht? Befehl anzeigen
                </button>
              ) : null}
              {befehl && zeigen ? (
                <pre className="text-ink bg-surface-raised rounded-sm px-2.5 py-2 font-mono text-[11px] break-all whitespace-pre-wrap select-all">
                  {befehl}
                </pre>
              ) : null}
            </div>
          ) : null}
          <Warum>
            Der Befehl enthält deinen persönlichen Schlüssel. Damit darf nur dein Computer für dich im CRM arbeiten –
            gib ihn nicht weiter.
          </Warum>
        </>
      )
    case 1:
      return (
        <>
          <ol className="grid gap-2" aria-label="So geht’s">
            {[
              <>
                <Taste>⊞ Windows</Taste>-Taste drücken
              </>,
              <>
                <span className="font-semibold">PowerShell</span> tippen und <Taste>Enter</Taste>
              </>,
              <>
                <Taste>Strg</Taste> + <Taste>V</Taste> drücken
              </>,
              <>
                <Taste>Enter</Taste> drücken
              </>,
            ].map((inhalt, i) => (
              <li key={i} className="bg-signal-tint text-ink flex items-center gap-3 rounded-md px-3.5 py-3">
                <span className="bg-signal text-signal-ink grid size-6 shrink-0 place-items-center rounded-full text-[13px] font-semibold">
                  {i + 1}
                </span>
                <span className="text-body flex flex-wrap items-center gap-1">{inhalt}</span>
              </li>
            ))}
          </ol>
          <p className="text-small text-ink-2 flex items-start gap-2">
            <MousePointerClick size={16} className="mt-0.5 shrink-0" aria-hidden />
            Es geht ein dunkles Fenster auf – das ist richtig so. Klappt Strg + V nicht: einmal mit der rechten
            Maustaste ins Fenster klicken.
          </p>
          <Warum>In diesem Fenster richtet sich alles von selbst ein. Du musst dort nichts selbst schreiben.</Warum>
        </>
      )
    case 2:
      return (
        <>
          <p className="text-body text-ink-2">
            Das Fenster sagt dir, was zu tun ist. Mach es und drück dann im Fenster <Taste>Enter</Taste>.
          </p>
          <ul
            className="bg-surface-hover text-small text-ink-2 grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-md px-3.5 py-2.5"
            aria-label="Farben im Fenster"
          >
            {LEGENDE.map((l) => (
              <li key={l.text} className="flex items-center gap-2">
                <span className={cn('size-2.5 shrink-0 rounded-full', l.farbe)} aria-hidden />
                {l.text}
              </li>
            ))}
          </ul>
          <p className="text-ink text-body font-semibold">Das kann unterwegs kommen:</p>
          <ul className="grid gap-2">
            {UNTERWEGS.map((u) => (
              <li
                key={u.tun}
                className="bg-signal-tint grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 rounded-md px-3.5 py-3"
              >
                <u.icon size={20} className="text-signal mt-0.5" aria-hidden />
                <span className="text-body text-ink">{u.tun}</span>
                <span className="text-small text-tag-gelb-ink col-start-2">
                  <span className="font-semibold">Warum? </span>
                  {u.warum}
                </span>
                {'text' in u ? (
                  <span className="col-start-2">
                    <KopierKnopf text={u.text} label="Text kopieren" onKopieren={onKopieren} />
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )
    default:
      return (
        <>
          {verbunden ? (
            <Gut>Recherche-Dienst verbunden – alles bereit!</Gut>
          ) : (
            <p className="bg-tag-orange text-tag-orange-ink rounded-md px-3.5 py-2.5 font-semibold" role="status">
              Noch nicht verbunden. Steht im Fenster schon grün „Alles fertig!“? Sonst einfach dem Fenster weiter
              folgen.
            </p>
          )}
          <p className="text-ink text-body font-semibold">So geht’s ab jetzt:</p>
          <ol className="grid gap-2">
            {[
              'Links im CRM auf den blauen Knopf „Recherche starten“ klicken.',
              'ChatGPT sucht in deinem Chrome passende Leute. Chrome offen und Computer an lassen.',
              'Steht „Freigabe nötig“ am blauen Knopf: Liste ansehen und „Freigeben“ klicken.',
            ].map((t, i) => (
              <li key={t} className="bg-done-tint text-ink flex items-start gap-3 rounded-md px-3.5 py-3">
                <span className="bg-done text-signal-ink grid size-6 shrink-0 place-items-center rounded-full text-[13px] font-semibold">
                  {i + 1}
                </span>
                <span className="text-body">{t}</span>
              </li>
            ))}
          </ol>
          <Warum>Die Anfragen gehen in deinem Namen raus – deshalb entscheidest du, wer angefragt wird.</Warum>
        </>
      )
  }
}
