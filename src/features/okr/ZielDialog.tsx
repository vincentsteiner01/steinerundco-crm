// Ziel anlegen oder bearbeiten: Titel, Zeitraum (Monat · Quartal · Jahr) und der Monat, in dem es beginnt. Darunter steht
// leise, welcher Zeitraum sich daraus ergibt. Die Komponente wird beim Öffnen eingehängt – die Felder beginnen so immer frisch.
import { useId, useState, type KeyboardEvent } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Feld } from '@/components/ui/Feld'
import { Input } from '@/components/ui/Input'
import { Segment } from '@/components/ui/Segment'
import { Select } from '@/components/ui/Select'
import { useZielSpeichern } from '@/data/okr'
import { fmtDatum } from '@/lib/format'
import type { Tag } from '@/lib/zeit'
import { monatsOptionen } from './eingabe'
import { EBENE_LABEL, monatsErster, zeitraumFuer, type Ebene, type OkrZiel } from './rechnen'

/** Segment in voller Breite mit gleich breiten, 44 px hohen Flächen (Segment setzt Höhe und Breite selbst – daher „!“). */
export const WAHL_BREIT = 'h-11! w-full [&>button]:flex-1 [&>button]:justify-center'
/** Auswahl so hoch wie die Eingabefelder daneben (44 px); am Telefon 16 px, sonst zoomt iOS beim Antippen. */
export const AUSWAHL_GROSS = 'h-11! text-[15px]! max-md:text-[16px]!'
/** Auf kleinen Bildschirmen (und mit offener Tastatur) scrollt das Fenster in sich. */
export const FENSTER = 'max-h-[calc(100dvh-24px)] overflow-y-auto'

// in der Reihenfolge der Auswahl: vom Kleinen zum Großen
const EBENEN_WAHL: { key: Ebene; label: string }[] = [
  { key: 'monat', label: EBENE_LABEL.monat },
  { key: 'quartal', label: EBENE_LABEL.quartal },
  { key: 'jahr', label: EBENE_LABEL.jahr },
]

export function ZielDialog({
  ziel,
  monat,
  heute,
  onClose,
  onGespeichert,
}: {
  /** `null` = neues Ziel */
  ziel: OkrZiel | null
  /** der gezeigte Monat – damit ist „Beginnt im“ vorbelegt */
  monat: Tag
  heute: Tag
  onClose: () => void
  /** nach dem Speichern, mit dem Zeitraum des Ziels (die Seite blättert hin, wenn er den gezeigten Monat nicht berührt) */
  onGespeichert: (zeitraum: { von: Tag; bis: Tag }) => void
}) {
  const id = useId()
  const speichern = useZielSpeichern()
  const [titel, setTitel] = useState(ziel?.titel ?? '')
  const [ebene, setEbene] = useState<Ebene>(ziel?.ebene ?? 'monat')
  const [start, setStart] = useState<Tag>(monatsErster(ziel?.von ?? monat))
  const [fehler, setFehler] = useState<string | null>(null)
  const zeitraum = zeitraumFuer(ebene, start)

  const sichern = async () => {
    if (speichern.isPending) return
    if (!titel.trim()) return setFehler('Bitte einen Titel eingeben')
    try {
      await speichern.mutateAsync({ ...(ziel ? { id: ziel.id } : {}), titel, ebene, ...zeitraum })
    } catch {
      return // die Meldung zeigt die Daten-Schicht; das Fenster bleibt mit den Eingaben offen
    }
    onGespeichert(zeitraum)
    onClose()
  }
  const mitEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    void sichern()
  }

  return (
    <Dialog
      gross
      offen
      onOpenChange={(o) => !o && onClose()}
      titel={ziel ? 'Ziel bearbeiten' : 'Ziel hinzufügen'}
      className={FENSTER}
      primaer={{ label: 'Speichern', onClick: () => void sichern(), busy: speichern.isPending }}
      kinder={
        <>
          <Feld label="Titel" htmlFor={`${id}-titel`}>
            <Input
              id={`${id}-titel`}
              groesse="L"
              autoFocus
              autoComplete="off"
              value={titel}
              fehler={fehler ?? undefined}
              onChange={(e) => {
                setFehler(null)
                setTitel(e.target.value)
              }}
              onKeyDown={mitEnter}
            />
          </Feld>
          <Feld label="Zeitraum">
            <Segment
              ariaLabel="Zeitraum"
              className={WAHL_BREIT}
              optionen={EBENEN_WAHL}
              wert={ebene}
              onChange={setEbene}
            />
          </Feld>
          <Feld label="Beginnt im" htmlFor={`${id}-start`}>
            <Select
              id={`${id}-start`}
              className={AUSWAHL_GROSS}
              optionen={monatsOptionen(heute, [monat, start])}
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
            <p data-zeitraum className="text-small text-ink-3 tnum">
              {fmtDatum(zeitraum.von)} – {fmtDatum(zeitraum.bis)}
            </p>
          </Feld>
        </>
      }
    />
  )
}
