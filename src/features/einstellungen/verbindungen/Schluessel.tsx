// Eingangs-Schlüssel für das Apps Script: erzeugen (crm.eingang_token_erzeugen – der Klartext kommt genau einmal zurück) und
// widerrufen (crm.eingang_token_widerrufen). Der Klartext lebt nur im State dieser Komponente: nicht im Query-Cache, nicht im
// Speicher des Browsers, nicht in der Konsole; „Ausblenden“ oder Verlassen der Seite löscht ihn.
import { KeyRound } from 'lucide-react'
import { useId, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button, Dialog, Input } from '@/components/ui'
import { toast } from '@/components/toast'
import { zeigeFehler } from '@/data'
import { fmtDatum } from '@/lib/format'
import { qkEingang, schluesselErzeugen, schluesselWiderrufen, type SchluesselInfo } from '@/features/eingang/public'
import { SKRIPT_EIGENSCHAFT } from './konstanten'
import { Code, KopierKnopf, Text } from './Teile'

function useStatusNeuLaden(me: string | null) {
  const qc = useQueryClient()
  return () => void qc.invalidateQueries({ queryKey: qkEingang.status(me ?? '') })
}

export function SchluesselErzeugen({ me, aktiv }: { me: string | null; aktiv: SchluesselInfo | null }) {
  const id = useId()
  const neuLaden = useStatusNeuLaden(me)
  const [schluessel, setSchluessel] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)
  const [frage, setFrage] = useState(false)

  const erzeugen = async () => {
    setFrage(false)
    setLaeuft(true)
    try {
      setSchluessel(await schluesselErzeugen())
      neuLaden()
    } catch (e) {
      zeigeFehler(e)
    } finally {
      setLaeuft(false)
    }
  }

  if (schluessel) {
    return (
      <div
        className="border-line-strong bg-surface-raised grid gap-3 rounded-md border p-3.5"
        role="group"
        aria-label="Neuer Schlüssel"
      >
        <label htmlFor={`${id}-s`} className="label">
          Dein Schlüssel – nur jetzt sichtbar
        </label>
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="min-w-0 flex-1 basis-[260px]">
            <Input
              id={`${id}-s`}
              value={schluessel}
              readOnly
              mono
              autoComplete="off"
              spellCheck={false}
              onFocus={(e) => e.currentTarget.select()}
              className="text-[12.5px]"
            />
          </div>
          <KopierKnopf text={schluessel} variante="primary">
            Kopieren
          </KopierKnopf>
        </div>
        <Text>
          Füge ihn gleich als Wert von <Code>{SKRIPT_EIGENSCHAFT}</Code> ein – nicht in eine Datei, eine Mail oder einen
          Chat. Wer ihn hat, kann in deinem Namen Annahmen und Antworten ins CRM buchen. Das CRM speichert nur einen
          nicht umkehrbaren Abdruck; verloren ist verloren, dann einfach einen neuen erzeugen.
        </Text>
        <div>
          <Button variante="quiet" groesse="S" onClick={() => setSchluessel(null)}>
            Eingetragen – ausblenden
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <Button
        variante={aktiv ? 'secondary' : 'primary'}
        icon={KeyRound}
        busy={laeuft}
        onClick={() => (aktiv ? setFrage(true) : void erzeugen())}
      >
        {aktiv ? 'Neuen Schlüssel erzeugen' : 'Schlüssel erzeugen'}
      </Button>
      {aktiv ? (
        <span className="text-small text-ink-3">Aktiver Schlüssel seit {fmtDatum(aktiv.created_at)}</span>
      ) : null}
      <Dialog
        offen={frage}
        onOpenChange={setFrage}
        titel="Neuen Schlüssel erzeugen?"
        text={`Der bisherige Schlüssel wird sofort ungültig. Bis du den neuen in ${SKRIPT_EIGENSCHAFT} einträgst, überträgt dein Script nichts.`}
        primaer={{ label: 'Neuen Schlüssel erzeugen', onClick: () => void erzeugen(), busy: laeuft }}
      />
    </div>
  )
}

export function SchluesselWiderrufen({ me }: { me: string | null }) {
  const neuLaden = useStatusNeuLaden(me)
  const [frage, setFrage] = useState(false)
  const [laeuft, setLaeuft] = useState(false)
  const widerrufen = async () => {
    setLaeuft(true)
    try {
      await schluesselWiderrufen()
      toast('Schlüssel widerrufen – dein Script überträgt nichts mehr.')
      setFrage(false)
      neuLaden()
    } catch (e) {
      zeigeFehler(e)
    } finally {
      setLaeuft(false)
    }
  }
  return (
    <>
      <Button variante="danger" groesse="S" onClick={() => setFrage(true)}>
        Widerrufen
      </Button>
      <Dialog
        offen={frage}
        onOpenChange={setFrage}
        titel="Schlüssel widerrufen?"
        text="Dein Script kann danach nichts mehr ins CRM übertragen, bis du einen neuen Schlüssel erzeugst und einträgst. Was schon verbucht ist, bleibt."
        primaer={{ label: 'Widerrufen', danger: true, onClick: () => void widerrufen(), busy: laeuft }}
      />
    </>
  )
}
