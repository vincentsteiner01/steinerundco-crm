// „Leitfaden bearbeiten“ / „Leitfaden schreiben“ als Fenster (23.10.2026, Mikes Editor): Titel, Kategorie, Text mit
// Formatleiste (Telefon & Sales), Aktiv. Weitere Felder (Wann verwenden, Notizen, Anrede) auf der Detailseite.
import { useId, useRef, useState } from 'react'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useTemplateSave } from '@/data/templates'
import type { Template } from '@/types/domain'
import { Editor } from './Editor'
import { Fenster } from '@/components/Fenster'
import { neuerKey } from './helfer'
import { zielOptionen, zielTeile, zielWert, type Bereich, type Ziel } from './kategorien'

export function LeitfadenBearbeiten({
  vorlage,
  ziel: zielStart,
  bereich,
  keys,
  onClose,
  onGespeichert,
}: {
  vorlage: Template | null
  ziel: Ziel
  bereich: Bereich
  keys: readonly string[]
  onClose: () => void
  onGespeichert: (t: Template) => void
}) {
  const id = useId()
  const feld = useRef<HTMLTextAreaElement | null>(null)
  const speichern = useTemplateSave()
  const start = {
    name: vorlage?.name ?? '',
    ziel: vorlage ? zielWert(vorlage.channel, vorlage.phase) : zielStart,
    subject: vorlage?.subject ?? '',
    body: vorlage?.body ?? '',
    active: vorlage?.active !== false,
  }
  const [f, setF] = useState(start)
  const [fehler, setFehler] = useState<string | null>(null)
  const [warnung, setWarnung] = useState(false)
  const geaendert = JSON.stringify(f) !== JSON.stringify(start)
  const { kanal, phase } = zielTeile(f.ziel)
  const optionen = zielOptionen(bereich)

  const setze = (p: Partial<typeof f>) => {
    setFehler(null)
    setWarnung(false)
    setF((x) => ({ ...x, ...p }))
  }

  const absenden = async () => {
    if (!f.name.trim()) return setFehler('Titel fehlt.')
    if (!f.body.trim()) return setFehler('Text fehlt.')
    const key = vorlage?.key ?? neuerKey(kanal, f.name, keys)
    const t = await speichern.mutateAsync({
      ...(vorlage ?? { key, sort_order: 0 }),
      channel: kanal,
      phase,
      name: f.name.trim(),
      subject: kanal === 'email' ? f.subject.trim() || null : (vorlage?.subject ?? null),
      body: f.body,
      active: f.active,
    })
    toast(vorlage ? 'Leitfaden gespeichert.' : 'Leitfaden angelegt.')
    onGespeichert(t)
  }

  return (
    <Fenster
      offen
      breit={820}
      onOpenChange={(o) => {
        if (o) return
        // Ungespeicherte Änderungen: erst warnen, zweites Schließen verwirft
        if (geaendert && !warnung) return setWarnung(true)
        onClose()
      }}
      titel={vorlage ? 'Leitfaden bearbeiten' : 'Leitfaden schreiben'}
      fuss={
        <>
          {warnung ? (
            <span className="text-small text-overdue" role="status">
              Nicht gespeichert – noch einmal „Schließen“ verwirft die Änderungen.
            </span>
          ) : fehler ? (
            <span className="text-small text-danger" role="alert">
              {fehler}
            </span>
          ) : null}
          <span className="ml-auto flex gap-2">
            <Button variante="quiet" onClick={onClose}>
              Abbrechen
            </Button>
            <Button variante="primary" kbd="⌘↵" busy={speichern.isPending} onClick={() => void absenden()}>
              Speichern
            </Button>
          </span>
        </>
      }
    >
      <div className="grid gap-3.5">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <FormField label="Titel" htmlFor={`${id}-titel`} pflicht>
            <Input
              id={`${id}-titel`}
              value={f.name}
              onChange={(e) => setze({ name: e.target.value })}
              placeholder="Problem A, B oder C?"
              autoFocus={!vorlage}
            />
          </FormField>
          <FormField label="Kategorie" htmlFor={`${id}-kategorie`}>
            <Select
              id={`${id}-kategorie`}
              value={f.ziel}
              onChange={(e) => setze({ ziel: e.target.value as Ziel })}
              optionen={
                optionen.some((o) => o.value === f.ziel) ? optionen : [{ value: f.ziel, label: f.ziel }, ...optionen]
              }
            />
          </FormField>
        </div>
        <Editor
          kanal={kanal}
          wert={{ subject: f.subject, body: f.body }}
          onChange={(w) => setze({ subject: w.subject, body: w.body })}
          onSpeichern={() => void absenden()}
          textareaRef={feld}
        />
        <Checkbox
          label="Aktiv – wird im Anruf-Skript und in Sequenzen vorgeschlagen"
          checked={f.active}
          onChange={(e) => setze({ active: e.target.checked })}
        />
      </div>
    </Fenster>
  )
}
