// Key Result anlegen oder bearbeiten: Titel, Zielwert, „Gilt“ (nur bei Monatszielen – Quartal und Jahr gelten immer für den
// ganzen Zeitraum), „Für“ (Team zusammen · Jede Person) und „Wie wird gezählt?“. Der Eintrag „Umsatz aus Neukunden“ fragt
// zusätzlich nach dem Wert je Kunde und speichert Neukunden × diesen Wert in Euro.
import { useId, useState, type KeyboardEvent } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Feld } from '@/components/ui/Feld'
import { Input } from '@/components/ui/Input'
import { Segment } from '@/components/ui/Segment'
import { Select } from '@/components/ui/Select'
import { useErgebnisSpeichern } from '@/data/okr'
import {
  istZaehlart,
  parseZahl,
  UMSATZ,
  ZAEHLARTEN,
  zaehlartFelder,
  zaehlartVon,
  zahlFuerFeld,
  type Zaehlart,
} from './eingabe'
import { TAKT_LABEL, TAKTE, zeitraumText, type OkrErgebnis, type OkrZiel, type Takt } from './rechnen'
import { AUSWAHL_GROSS, FENSTER, WAHL_BREIT } from './ZielDialog'

const TAKT_WAHL = TAKTE.map((t) => ({ key: t, label: TAKT_LABEL[t] }))
// „im ganzen Zeitraum“ ist länger als die beiden anderen: die Flächen teilen sich die Breite nach ihrem Text; am Telefon
// steht der lange Eintrag in einer eigenen Zeile über den zwei kurzen (sonst liefe das Segment unsichtbar zur Seite).
const TAKT_SEGMENT =
  'h-11! w-full [&>button]:flex-auto [&>button]:justify-center max-md:grid! max-md:h-auto! max-md:grid-cols-2 max-md:[&>button]:h-10 max-md:[&>button:first-child]:col-span-2'

type Wer = 'team' | 'person'
const WER_WAHL: { key: Wer; label: string }[] = [
  { key: 'team', label: 'Team zusammen' },
  { key: 'person', label: 'Jede Person' },
]

const ZAHL_FEHLT = 'Bitte eine Zahl über 0 eingeben'

type Fehler = { titel?: string; zielwert?: string; kundenwert?: string }

export function ErgebnisDialog({
  ziel,
  ergebnis,
  onClose,
}: {
  ziel: OkrZiel
  /** `null` = neues Key Result */
  ergebnis: OkrErgebnis | null
  onClose: () => void
}) {
  const id = useId()
  const speichern = useErgebnisSpeichern()
  const mitTakt = ziel.ebene === 'monat'
  const [titel, setTitel] = useState(ergebnis?.titel ?? '')
  const [zielwert, setZielwert] = useState(ergebnis ? zahlFuerFeld(ergebnis.zielwert) : '')
  const [takt, setTakt] = useState<Takt>(ergebnis?.takt ?? 'zeitraum')
  const [wer, setWer] = useState<Wer>(ergebnis?.je_person ? 'person' : 'team')
  const [art, setArt] = useState<Zaehlart>(ergebnis ? zaehlartVon(ergebnis) : 'manuell')
  const [kundenwert, setKundenwert] = useState(
    ergebnis && zaehlartVon(ergebnis) === UMSATZ ? zahlFuerFeld(ergebnis.faktor) : '',
  )
  const [fehler, setFehler] = useState<Fehler>({})

  const sichern = async () => {
    if (speichern.isPending) return
    const wert = parseZahl(zielwert)
    const jeKunde = art === UMSATZ ? parseZahl(kundenwert) : 1
    const f: Fehler = {}
    if (!titel.trim()) f.titel = 'Bitte einen Titel eingeben'
    if (wert === null || wert <= 0) f.zielwert = ZAHL_FEHLT
    if (jeKunde === null || jeKunde <= 0) f.kundenwert = ZAHL_FEHLT
    setFehler(f)
    if (f.titel || wert === null || wert <= 0 || jeKunde === null || jeKunde <= 0) return
    try {
      await speichern.mutateAsync({
        ...(ergebnis ? { id: ergebnis.id } : {}),
        ziel_id: ziel.id,
        titel,
        zielwert: wert,
        takt: mitTakt ? takt : 'zeitraum',
        je_person: wer === 'person',
        ...zaehlartFelder(art, jeKunde),
      })
    } catch {
      return // die Meldung zeigt die Daten-Schicht; das Fenster bleibt mit den Eingaben offen
    }
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
      titel={ergebnis ? 'Key Result bearbeiten' : 'Key Result hinzufügen'}
      text={`${ziel.titel} · ${zeitraumText(ziel)}`}
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
              fehler={fehler.titel}
              onChange={(e) => {
                setFehler((f) => ({ ...f, titel: undefined }))
                setTitel(e.target.value)
              }}
              onKeyDown={mitEnter}
            />
          </Feld>
          <Feld label="Zielwert" htmlFor={`${id}-zielwert`}>
            <Input
              id={`${id}-zielwert`}
              groesse="L"
              mono
              inputMode="decimal"
              autoComplete="off"
              value={zielwert}
              fehler={fehler.zielwert}
              onChange={(e) => {
                setFehler((f) => ({ ...f, zielwert: undefined }))
                setZielwert(e.target.value)
              }}
              onKeyDown={mitEnter}
            />
          </Feld>
          {mitTakt ? (
            <Feld label="Gilt">
              <Segment ariaLabel="Gilt" className={TAKT_SEGMENT} optionen={TAKT_WAHL} wert={takt} onChange={setTakt} />
            </Feld>
          ) : null}
          <Feld label="Für">
            <Segment ariaLabel="Für" className={WAHL_BREIT} optionen={WER_WAHL} wert={wer} onChange={setWer} />
          </Feld>
          <Feld label="Wie wird gezählt?" htmlFor={`${id}-art`}>
            <Select
              id={`${id}-art`}
              className={AUSWAHL_GROSS}
              optionen={[...ZAEHLARTEN]}
              value={art}
              onChange={(e) => {
                if (istZaehlart(e.target.value)) setArt(e.target.value)
              }}
            />
          </Feld>
          {art === UMSATZ ? (
            <Feld label="Wert je Kunde in €" htmlFor={`${id}-kundenwert`}>
              <Input
                id={`${id}-kundenwert`}
                groesse="L"
                mono
                inputMode="decimal"
                autoComplete="off"
                value={kundenwert}
                fehler={fehler.kundenwert}
                onChange={(e) => {
                  setFehler((f) => ({ ...f, kundenwert: undefined }))
                  setKundenwert(e.target.value)
                }}
                onKeyDown={mitEnter}
              />
            </Feld>
          ) : null}
        </>
      }
    />
  )
}
