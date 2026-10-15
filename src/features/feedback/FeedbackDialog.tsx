// Feedback-Dialog (nachgeladen beim ersten ⌥F): Art (1–3), Beschreibung (Pflicht, ⌘↵ sendet), Titel (optional), Screenshot
// (automatisch, entfernbar, ersetzbar per ⌘V/Ziehen), Kontextzeile. Senden: Bild in den Bucket, Zeile anlegen, Toast.
// Eigener Radix-Dialog statt components/ui/Dialog (der ist 440 px und „nur für Unumkehrbares“): 560 px, gleiche Flächen und
// Radien (DESIGN-SYSTEM § 5.20); auf dem Telefon als Blatt von unten.
import * as RD from '@radix-ui/react-dialog'
import { ImageOff, ImagePlus, X } from 'lucide-react'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
} from 'react'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { Input } from '@/components/ui/Input'
import { Segment } from '@/components/ui/Segment'
import { Textarea } from '@/components/ui/Textarea'
import { FEEDBACK_ARTEN, useFeedbackSenden, type FeedbackArt } from '@/data/feedback'
import { istEingabe, MOD_LABEL, useHotkeyScope } from '@/lib/keyboard'
import { IGNORIEREN_ATTR, normalisiereBild } from './aufnahme'
import type { FeedbackKontext } from './kontext'
import { ART_LABEL, ART_PLATZHALTER, TEXT } from './texte'

export type FeedbackDialogProps = {
  bild: Blob | null
  kontext: FeedbackKontext
  onSchliessen: () => void
}

const ignorieren = { [IGNORIEREN_ATTR]: '' }

function neueId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(16)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`
  )
}

export function FeedbackDialog({ bild: startBild, kontext, onSchliessen }: FeedbackDialogProps) {
  useHotkeyScope('formular')
  const [offen, setOffen] = useState(true)
  const [art, setArt] = useState<FeedbackArt>('fehler')
  const [beschreibung, setBeschreibung] = useState('')
  const [titel, setTitel] = useState('')
  const [bild, setBild] = useState<{ blob: Blob; eigenes: boolean } | null>(
    startBild ? { blob: startBild, eigenes: false } : null,
  )
  const [fehler, setFehler] = useState<string | null>(null)
  const [bildHinweis, setBildHinweis] = useState<string | null>(null)
  const [ziehen, setZiehen] = useState(false)
  const senden = useFeedbackSenden()
  const idRef = useRef(neueId())
  const dateiRef = useRef<HTMLInputElement | null>(null)
  const feldId = useId()

  // Runde 2: useMemo(createObjectURL) + Cleanup-Effekt widerrief die URL im StrictMode-Doppellauf – die Vorschau zeigte ein
  // kaputtes Bild (ERR_FILE_NOT_FOUND). Die URL entsteht deshalb im Effekt und lebt genau so lange wie er.
  const [bildUrl, setBildUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!bild) {
      setBildUrl(null)
      return
    }
    const u = URL.createObjectURL(bild.blob)
    setBildUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [bild])

  const schliessen = () => {
    setOffen(false)
    onSchliessen()
  }

  const absenden = () => {
    if (senden.isPending) return
    if (!beschreibung.trim()) {
      setFehler(TEXT.beschreibungLeer)
      return
    }
    senden.mutate(
      {
        id: idRef.current,
        art,
        titel: titel.trim() || null,
        beschreibung,
        route: kontext.route,
        url: kontext.url,
        viewport: kontext.viewport,
        user_agent: kontext.user_agent,
        app_version: kontext.app_version,
        konsole: kontext.konsole,
        bild: bild?.blob ?? null,
      },
      {
        onSuccess: (r) => {
          toast(r.bildFehler ? TEXT.dankeOhneBild : TEXT.danke)
          schliessen()
        },
      },
    )
  }

  const uebernimmBild = async (datei: Blob) => {
    const b = await normalisiereBild(datei)
    if (!b) {
      setBildHinweis(TEXT.bildFalsch)
      return
    }
    setBildHinweis(null)
    setBild({ blob: b, eigenes: true })
  }

  const beimEinfuegen = (e: ClipboardEvent<HTMLDivElement>) => {
    const datei = [...e.clipboardData.items].find((i) => i.kind === 'file' && i.type.startsWith('image/'))?.getAsFile()
    if (!datei) return // Text einfügen bleibt normal
    e.preventDefault()
    void uebernimmBild(datei)
  }
  const beimZiehen = (e: DragEvent<HTMLDivElement>) => {
    if (![...e.dataTransfer.types].includes('Files')) return
    e.preventDefault()
    setZiehen(true)
  }
  const beimAblegen = (e: DragEvent<HTMLDivElement>) => {
    setZiehen(false)
    const datei = [...e.dataTransfer.files].find((f) => f.type.startsWith('image/')) ?? e.dataTransfer.files[0]
    if (!datei) return
    e.preventDefault()
    void uebernimmBild(datei)
  }

  // Tasten im Dialog: 1–3 (außerhalb von Feldern) bzw. ⌥1–3 (überall) = Art; ⌘↵ sendet; sonst bleiben Tasten im Dialog
  // (globale Einzelbuchstaben wie Z/R/G-Akkorde dürfen nicht hinter dem Dialog wirken).
  const tasten = (e: KeyboardEvent<HTMLDivElement>) => {
    const ziffer = /^Digit([1-3])$/.exec(e.nativeEvent.code)?.[1]
    if (ziffer && !e.metaKey && !e.ctrlKey && (e.altKey || !istEingabe(e.target as Element))) {
      e.preventDefault()
      setArt(FEEDBACK_ARTEN[Number(ziffer) - 1] as FeedbackArt)
      return
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.defaultPrevented) {
      e.preventDefault()
      absenden()
      return
    }
    if (e.key !== 'Escape' && e.key !== 'Tab') e.stopPropagation()
  }

  const kontextZeile = [
    `Seite ${kontext.route.split('?')[0] || '/'}`,
    `Breite ${kontext.breite} px`,
    `Version ${kontext.app_version}`,
    kontext.konsole.length === 1
      ? '1 Konsolen-Eintrag'
      : kontext.konsole.length
        ? `${kontext.konsole.length} Konsolen-Einträge`
        : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <RD.Root open={offen} onOpenChange={(o) => (o ? setOffen(true) : schliessen())}>
      <RD.Portal>
        <RD.Overlay {...ignorieren} className="bg-canvas/50 fixed inset-0 z-[60]" />
        <RD.Content
          {...ignorieren}
          onKeyDown={tasten}
          onPaste={beimEinfuegen}
          onDragOver={beimZiehen}
          onDragLeave={() => setZiehen(false)}
          onDrop={beimAblegen}
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            document.getElementById(`${feldId}-text`)?.focus()
          }}
          className={cn(
            'bg-surface-raised shadow-float fixed z-[61] flex max-h-[calc(100dvh-32px)] flex-col overflow-hidden rounded-lg outline-none',
            'top-1/2 left-1/2 w-[min(560px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2',
            'max-md:inset-x-0 max-md:top-auto max-md:bottom-0 max-md:left-0 max-md:max-h-[92dvh] max-md:w-full max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-b-none',
            'animate-[screen-in_var(--t-3)_var(--ease-brand)]',
            ziehen && 'outline-signal outline-2 -outline-offset-2',
          )}
        >
          <div className="flex items-start gap-3 px-6 pt-5 max-md:px-4">
            <div className="min-w-0 flex-1">
              <RD.Title className="text-h2 text-ink-bright">{TEXT.dialogTitel}</RD.Title>
              <RD.Description className="text-small text-ink-3 mt-1">{TEXT.dialogSatz}</RD.Description>
            </div>
            <RD.Close asChild>
              <Button variante="icon" aria-label="Schließen" icon={X} className="-mt-1 -mr-2" />
            </RD.Close>
          </div>

          <div className="grid min-h-0 gap-4 overflow-y-auto px-6 pt-4 pb-5 max-md:px-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <Segment<FeedbackArt>
                ariaLabel="Art der Meldung"
                wert={art}
                onChange={setArt}
                optionen={FEEDBACK_ARTEN.map((a, i) => ({
                  key: a,
                  label: (
                    <>
                      {ART_LABEL[a]}
                      <kbd className="kbd">{i + 1}</kbd>
                    </>
                  ),
                }))}
              />
            </div>

            <div className="grid gap-1.5">
              <label htmlFor={`${feldId}-text`} className="label">
                Beschreibung
              </label>
              <Textarea
                id={`${feldId}-text`}
                value={beschreibung}
                onChange={(e) => {
                  setBeschreibung(e.target.value)
                  if (fehler) setFehler(null)
                }}
                placeholder={ART_PLATZHALTER[art]}
                fehler={fehler ?? undefined}
                aria-required
                rows={4}
                className="text-[14px] leading-[1.5]"
              />
            </div>

            <div className="grid gap-1.5">
              <label htmlFor={`${feldId}-titel`} className="label">
                Titel
              </label>
              <Input
                id={`${feldId}-titel`}
                value={titel}
                maxLength={200}
                onChange={(e) => setTitel(e.target.value)}
                placeholder={TEXT.titelPlatzhalter}
              />
            </div>

            <div className="grid gap-1.5">
              <span className="label">Screenshot</span>
              <input
                ref={dateiRef}
                type="file"
                accept="image/*"
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(e) => {
                  const datei = e.target.files?.[0]
                  e.target.value = ''
                  if (datei) void uebernimmBild(datei)
                }}
              />
              {bild && bildUrl ? (
                <div className="flex min-w-0 items-start gap-3.5">
                  <a
                    href={bildUrl}
                    target="_blank"
                    rel="noopener"
                    className="border-line-strong block h-[115px] w-[184px] flex-none overflow-hidden rounded-sm border max-sm:h-[168px] max-sm:w-[96px]"
                    title="In neuem Tab öffnen"
                  >
                    <img
                      src={bildUrl}
                      alt="Screenshot der aktuellen Seite"
                      className="bg-canvas block h-full w-full object-cover object-top"
                    />
                  </a>
                  <div className="text-small text-ink-3 grid min-w-0 gap-1.5">
                    <span className="text-ink-2">
                      {bild.eigenes ? TEXT.bildEigenes : TEXT.bildAuto}
                      <span className="tnum font-mono"> · {Math.max(1, Math.round(bild.blob.size / 1024))} kB</span>
                    </span>
                    <span className="max-md:hidden">{TEXT.bildHinweis.replace('⌘', MOD_LABEL)}</span>
                    {bildHinweis ? <span className="text-danger">{bildHinweis}</span> : null}
                    <span className="flex flex-wrap gap-x-1">
                      <Button
                        variante="quiet"
                        groesse="S"
                        icon={ImageOff}
                        onClick={() => setBild(null)}
                        className="-ml-2.5"
                        aria-label="Screenshot entfernen"
                      >
                        Entfernen
                      </Button>
                      <Button variante="quiet" groesse="S" icon={ImagePlus} onClick={() => dateiRef.current?.click()}>
                        Anderes Bild
                      </Button>
                    </span>
                  </div>
                </div>
              ) : (
                <div className="border-line-strong text-small text-ink-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-sm border border-dashed px-3.5 py-2.5">
                  <span className="min-w-0">
                    <span className="max-md:hidden">{TEXT.bildKeins.replace('⌘', MOD_LABEL)}</span>
                    <span className="md:hidden">{TEXT.bildKeinsTelefon}</span>
                    {bildHinweis ? <span className="text-danger block">{bildHinweis}</span> : null}
                  </span>
                  <Button
                    variante="quiet"
                    groesse="S"
                    icon={ImagePlus}
                    onClick={() => dateiRef.current?.click()}
                    className="-mr-2"
                  >
                    Bild wählen
                  </Button>
                </div>
              )}
            </div>

            <p className="text-ink-3 tnum min-w-0 font-mono text-[11.5px] leading-[1.4] break-words">{kontextZeile}</p>
          </div>

          <div className="border-line flex items-center justify-end gap-1.5 border-t px-6 py-3.5 max-md:px-4 max-md:pb-[calc(14px+env(safe-area-inset-bottom))]">
            <RD.Close asChild>
              <Button variante="quiet" kbd="Esc">
                Abbrechen
              </Button>
            </RD.Close>
            <Button variante="primary" kbd={`${MOD_LABEL}↵`} onClick={absenden} busy={senden.isPending}>
              {TEXT.senden}
            </Button>
          </div>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  )
}
