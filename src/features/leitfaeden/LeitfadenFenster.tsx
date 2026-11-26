// Leitfaden schreiben / bearbeiten (Neustart 25.11.2026): ein Fenster mit Titel, Text und Platzhalter-Chips – mehr nicht.
// Neue Leitfäden bekommen feste, unsichtbare Werte (Kanal sonstiges, Phase erstgespraech); ein vorhandener behält Kanal, Phase
// und Schlüssel – auch die aus dem alten CRM (Kanal linkedin). „Löschen“ setzt nur `archiviert_at`: der Leitfaden verschwindet
// aus der Liste, die Zeile bleibt in der Datenbank.
import * as RD from '@radix-ui/react-dialog'
import { useId, useLayoutEffect, useRef, useState, type RefObject, type TextareaHTMLAttributes } from 'react'
import { PlatzhalterChips } from '@/components/PlatzhalterChips'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { seitenInhalt, useFokusZurueck } from '@/components/ui/useFokusZurueck'
import { useMeId } from '@/data/members'
import { useTemplateSave } from '@/data/templates'
import type { Template } from '@/types/domain'
import { neuerKey } from './helfer'

// „Position“ ist ein freier Platzhalter (Mike setzt ihn von Hand ein, z. B. die Stelle aus der Stellenanzeige)
const CHIPS = ['Anrede', 'Vorname', 'Nachname', 'Unternehmen', 'Position', 'Absender Vorname'] as const

/**
 * Textfeld, das mit dem Text wächst – es scrollt das Fenster, nicht das Feld. Eigenes Feld statt ui/Textarea: dessen Messung
 * (height: auto) warf die Ansicht in einem scrollenden Fenster bei jedem Tastendruck an den Anfang; hier bleibt die
 * Scroll-Position stehen. Eigene Komponente, weil das Feld erst mit dem Portal des Fensters im Dokument steht.
 */
function TextFeld({
  feldRef,
  rollenRef,
  fehler,
  ...rest
}: {
  feldRef: RefObject<HTMLTextAreaElement | null>
  /** der scrollende Bereich um das Feld */
  rollenRef: RefObject<HTMLElement | null>
  fehler: boolean
} & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { value } = rest
  useLayoutEffect(() => {
    const el = feldRef.current
    if (!el) return
    const wachse = () => {
      const oben = rollenRef.current?.scrollTop ?? 0
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`
      if (rollenRef.current) rollenRef.current.scrollTop = oben
    }
    wachse()
    // andere Fensterbreite (Telefon gedreht) = anderer Umbruch
    window.addEventListener('resize', wachse)
    return () => window.removeEventListener('resize', wachse)
  }, [value, feldRef, rollenRef])
  return (
    <textarea
      ref={feldRef}
      rows={10}
      aria-invalid={fehler || undefined}
      className={cn(
        'bg-surface-hover text-body block w-full resize-none overflow-hidden rounded-sm border px-3 py-2.5 outline-none',
        'max-md:text-[16px]', // iOS zoomt beim Antippen in Felder unter 16 px
        'ease-brand focus:border-signal transition-[border-color] duration-[var(--t-1)]',
        fehler ? 'border-danger' : 'border-line-strong',
      )}
      {...rest}
    />
  )
}

export function LeitfadenFenster({
  vorlage,
  keys,
  onClose,
}: {
  /** `null` = neuer Leitfaden */
  vorlage: Template | null
  /** Schlüssel ALLER Vorlagen, auch der archivierten – der neue Schlüssel muss in der ganzen Tabelle eindeutig sein */
  keys: readonly string[]
  onClose: () => void
}) {
  const id = useId()
  const meId = useMeId()
  const speichern = useTemplateSave()
  const inhalt = useRef<HTMLDivElement | null>(null)
  const rollen = useRef<HTMLDivElement | null>(null)
  const titelFeld = useRef<HTMLInputElement | null>(null)
  const textFeld = useRef<HTMLTextAreaElement | null>(null)
  const [titel, setTitel] = useState(vorlage?.name ?? '')
  const [text, setText] = useState(vorlage?.body ?? '')
  const [fehler, setFehler] = useState<{ titel?: string; text?: string }>({})
  const [frage, setFrage] = useState<'loeschen' | 'verwerfen' | null>(null)
  const geaendert = titel !== (vorlage?.name ?? '') || text !== (vorlage?.body ?? '')
  // Nach dem Schließen zurück zu „Leitfaden schreiben“ bzw. zur Karte des Leitfadens; gibt es sie nicht mehr (gelöscht), zum Seiteninhalt
  const fokusZurueck = useFokusZurueck(true, seitenInhalt)

  // Rückfrage auf und zu: ui/Dialog hat keinen Auslöser, zu dem der Fokus von selbst zurückkehrt – er fiele sonst auf <body>
  const vorFrage = useRef<HTMLElement | null>(null)
  const fragen = (f: 'loeschen' | 'verwerfen') => {
    vorFrage.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setFrage(f)
  }
  const frageZu = () => {
    setFrage(null)
    const ziel = vorFrage.current
    requestAnimationFrame(() => (ziel?.isConnected ? ziel : inhalt.current)?.focus())
  }

  // Esc, Klick daneben und „Abbrechen“ gehen denselben Weg: Geschriebenes geht nie ohne Rückfrage verloren
  const schliessen = () => (geaendert ? fragen('verwerfen') : onClose())

  const sichern = async () => {
    if (speichern.isPending) return
    const name = titel.trim()
    if (!name) {
      setFehler({ titel: 'Bitte einen Titel eingeben' })
      titelFeld.current?.focus()
      return
    }
    if (!text.trim()) {
      setFehler({ text: 'Bitte einen Text eingeben' })
      textFeld.current?.focus()
      return
    }
    try {
      await speichern.mutateAsync(
        vorlage
          ? { ...vorlage, name, body: text }
          : {
              key: neuerKey('sonstiges', name, keys),
              channel: 'sonstiges',
              phase: 'erstgespraech',
              name,
              body: text,
              created_by: meId,
            },
      )
    } catch {
      return // die Meldung zeigt useTemplateSave; das Fenster bleibt mit dem Text offen
    }
    toast('Leitfaden gespeichert.')
    onClose()
  }

  const archivieren = async () => {
    if (!vorlage || speichern.isPending) return
    try {
      await speichern.mutateAsync({ ...vorlage, archiviert_at: new Date().toISOString() })
    } catch {
      frageZu()
      return
    }
    toast('Leitfaden gelöscht.')
    onClose()
  }

  return (
    <>
      <RD.Root
        open
        onOpenChange={(o) => {
          if (!o) schliessen()
        }}
      >
        <RD.Portal>
          {/* Ebene 58/59: unter den Rückfragen (ui/Dialog 60/61), damit deren Abdunklung auch dieses Fenster bedeckt */}
          <RD.Overlay className="bg-scrim fixed inset-0 z-[58] data-[state=open]:animate-[screen-in_var(--t-3)_var(--ease-brand)]" />
          <RD.Content
            ref={inhalt}
            aria-describedby={undefined}
            // Vorhandenen Leitfaden erst lesen lassen: kein Cursor im Feld, auf dem Telefon klappt keine Tastatur auf
            onOpenAutoFocus={(e) => {
              if (!vorlage) return
              e.preventDefault()
              inhalt.current?.focus()
            }}
            onCloseAutoFocus={fokusZurueck}
            className={cn(
              'bg-surface-raised shadow-float fixed top-1/2 left-1/2 z-[59] flex max-h-[min(88dvh,900px)] w-[min(760px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg outline-none',
              'data-[state=open]:animate-[screen-in_var(--t-3)_var(--ease-brand)]',
            )}
          >
            <RD.Title className="text-h2 text-ink-bright px-6 pt-5 pb-4 max-md:px-4">
              {vorlage ? 'Leitfaden bearbeiten' : 'Leitfaden schreiben'}
            </RD.Title>
            <div ref={rollen} className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto px-6 pb-5 max-md:px-4">
              <div className="grid min-w-0 gap-1.5">
                <label htmlFor={`${id}-titel`} className="text-small text-ink-2 font-medium">
                  Titel
                </label>
                <Input
                  ref={titelFeld}
                  id={`${id}-titel`}
                  groesse="L"
                  className="max-md:text-[16px]"
                  value={titel}
                  fehler={fehler.titel}
                  onChange={(e) => {
                    setFehler({})
                    setTitel(e.target.value)
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    e.preventDefault()
                    textFeld.current?.focus()
                  }}
                />
              </div>
              <div className="grid min-w-0 gap-1.5">
                <label htmlFor={`${id}-text`} className="text-small text-ink-2 font-medium">
                  Text
                </label>
                <TextFeld
                  feldRef={textFeld}
                  rollenRef={rollen}
                  id={`${id}-text`}
                  value={text}
                  fehler={!!fehler.text}
                  aria-describedby={fehler.text ? `${id}-text-fehler` : undefined}
                  onChange={(e) => {
                    setFehler({})
                    setText(e.target.value)
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey)) return
                    e.preventDefault()
                    void sichern()
                  }}
                />
                {fehler.text ? (
                  <p id={`${id}-text-fehler`} className="text-small text-danger" role="alert">
                    {fehler.text}
                  </p>
                ) : null}
              </div>
            </div>
            {/* Chips stehen fest unter dem Text (scrollen nicht mit): bei langen Leitfäden bleiben Cursor und Chips zusammen sichtbar */}
            <PlatzhalterChips
              namen={CHIPS}
              feld={textFeld}
              wert={text}
              onChange={(t) => {
                setFehler({})
                setText(t)
              }}
              className="border-line border-t px-6 py-3 max-md:px-4"
            />
            {/* max-md:px-3 an den Knöpfen: alle drei passen auf dem Telefon in eine Zeile */}
            <footer className="border-line flex flex-wrap items-center gap-2 border-t px-6 py-3.5 max-md:px-4">
              {vorlage ? (
                <Button variante="quiet" groesse="L" className="max-md:px-3" onClick={() => fragen('loeschen')}>
                  Löschen
                </Button>
              ) : null}
              <span className="ml-auto flex gap-2">
                <Button variante="quiet" groesse="L" className="max-md:px-3" onClick={schliessen}>
                  Abbrechen
                </Button>
                <Button
                  variante="primary"
                  groesse="L"
                  className="max-md:px-3"
                  busy={speichern.isPending && frage !== 'loeschen'}
                  onClick={() => void sichern()}
                >
                  Speichern
                </Button>
              </span>
            </footer>
          </RD.Content>
        </RD.Portal>
      </RD.Root>

      <Dialog
        gross
        offen={frage === 'loeschen'}
        onOpenChange={(o) => !o && frageZu()}
        titel="Leitfaden löschen?"
        text={`„${vorlage?.name ?? ''}“ verschwindet aus deiner Liste.`}
        primaer={{ label: 'Löschen', onClick: () => void archivieren(), busy: speichern.isPending }}
      />
      <Dialog
        gross
        offen={frage === 'verwerfen'}
        onOpenChange={(o) => !o && frageZu()}
        titel="Änderungen verwerfen?"
        primaer={{ label: 'Verwerfen', onClick: onClose }}
        abbrechen="Weiter schreiben"
      />
    </>
  )
}
