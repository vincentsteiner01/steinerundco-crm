// Einstellungen → Sperrliste (BAUPLAN § 3.9 Sperrliste.tsx, ux § 3.10 Nr. 8, § 4.8, E-08): Suche, „Eintrag hinzufügen“
// (Link/E-Mail/Telefon mind. eins, Grund Pflicht), „Entfernen“ (Dialog mit Grund → Notiz-Aktivität am Lead, falls lead_id).
// Neustart 25.11.2026: keine Tasten (N, ↵) und keine Tastenhinweise mehr; eine leere Liste zeigt nur einen Satz und den Knopf.
// Statt der Tabelle mit sieben Spalten eine schlichte Liste – je Eintrag Name bzw. Adresse, Grund, Datum und „Entfernen“
// (44 px): Die Tabelle schnitt bei 1440 px Texte ab, und am Telefon lag „Entfernen“ außerhalb des Bildschirms. Kanal-Umfang,
// „Erfasst von“, Quelle und der Zähler sind entfallen; ein neuer Eintrag gilt immer für alle Kanäle.
import { Plus } from 'lucide-react'
import { useId, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Feld } from '@/components/ui/Feld'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { Textarea } from '@/components/ui/Textarea'
import { toast } from '@/components/toast'
import { useAktivitaetErstellen, useMeId, useSperrliste, useSperrlisteEintrag, useSperrlisteEntfernen } from '@/data'
import { fmtDatum } from '@/lib/format'
import { fmtTelefon, nachE164 } from '@/lib/telefon'
import { normalizeLinkedinUrl } from '@/lib/url'
import { ALLGEMEIN, DIALOG } from '@/texte/de'
import type { SperrlisteEintrag } from '@/types/domain'
import { NichtGeladen } from './components/Formular'
import {
  LEERER_EINTRAG,
  passtSperrsuche,
  pruefeEintrag,
  sperrGrundText,
  sperrNotiz,
  type EintragFehler,
  type NeuerEintrag,
} from './logik'

function HinzufuegenDialog({
  offen,
  onOpenChange,
  onAngelegt,
}: {
  offen: boolean
  onOpenChange: (o: boolean) => void
  onAngelegt: () => void
}) {
  const id = useId()
  const me = useMeId()
  const anlegen = useSperrlisteEintrag()
  const [e, setE] = useState<NeuerEintrag>(LEERER_EINTRAG)
  const [fehler, setFehler] = useState<EintragFehler>({})
  const schliessen = (o: boolean) => {
    if (!o) {
      setE(LEERER_EINTRAG)
      setFehler({})
    }
    onOpenChange(o)
  }
  const absenden = () => {
    const f = pruefeEintrag(e)
    setFehler(f)
    if (Object.keys(f).length) return
    anlegen.mutate(
      {
        linkedin_url_norm: e.url.trim() ? normalizeLinkedinUrl(e.url) : null,
        email: e.email.trim() ? e.email.trim().toLowerCase() : null,
        phone_e164: e.telefon.trim() ? nachE164(e.telefon) : null,
        name: e.name.trim() || null,
        company: e.firma.trim() || null,
        // immer alle Kanäle (LEERER_EINTRAG) – die Auswahl im Dialog ist mit dem Neustart entfallen
        channels: e.kanaele,
        // `reason` ist ein Enum (check widerspruch|abmeldung|bounce|manuell) – manuelle Einträge sind `manuell`, der Freitext-Grund
        // steht in `note` (Review: vorher Constraint-Verletzung bei jedem manuellen Eintrag)
        reason: 'manuell',
        note: sperrNotiz(e.grund, e.notiz),
        created_by: me,
      },
      {
        onSuccess: () => {
          toast('Eintrag in der Sperrliste.')
          onAngelegt()
          schliessen(false)
        },
      },
    )
  }
  return (
    <Dialog
      offen={offen}
      onOpenChange={schliessen}
      gross
      titel="Eintrag hinzufügen"
      text="Wird vor jeder E-Mail und beim Hinzufügen einer Karte geprüft."
      // Sieben Felder: auf dem Telefon höher als der Bildschirm – dann scrollt der Dialog in sich, statt oben und unten abzuschneiden
      className="max-h-[calc(100dvh-24px)] overflow-y-auto"
      primaer={{ label: 'Eintragen', onClick: absenden, busy: anlegen.isPending }}
      kinder={
        <>
          {fehler.schluessel ? (
            <p className="text-small text-danger" role="alert">
              {fehler.schluessel}
            </p>
          ) : null}
          <Feld label="LinkedIn-Link" htmlFor={`${id}-url`}>
            <Input
              id={`${id}-url`}
              groesse="L"
              fehler={fehler.url}
              value={e.url}
              onChange={(ev) => setE((x) => ({ ...x, url: ev.target.value }))}
            />
          </Feld>
          <div className="grid items-start gap-3.5 sm:grid-cols-2">
            <Feld label="E-Mail" htmlFor={`${id}-mail`}>
              <Input
                id={`${id}-mail`}
                groesse="L"
                type="email"
                fehler={fehler.email}
                value={e.email}
                onChange={(ev) => setE((x) => ({ ...x, email: ev.target.value }))}
              />
            </Feld>
            <Feld label="Telefon" htmlFor={`${id}-tel`}>
              <Input
                id={`${id}-tel`}
                groesse="L"
                type="tel"
                mono
                fehler={fehler.telefon}
                value={e.telefon}
                onChange={(ev) => setE((x) => ({ ...x, telefon: ev.target.value }))}
              />
            </Feld>
          </div>
          <div className="grid items-start gap-3.5 sm:grid-cols-2">
            <Feld label="Name" htmlFor={`${id}-name`}>
              <Input
                id={`${id}-name`}
                groesse="L"
                value={e.name}
                onChange={(ev) => setE((x) => ({ ...x, name: ev.target.value }))}
              />
            </Feld>
            <Feld label="Unternehmen" htmlFor={`${id}-firma`}>
              <Input
                id={`${id}-firma`}
                groesse="L"
                value={e.firma}
                onChange={(ev) => setE((x) => ({ ...x, firma: ev.target.value }))}
              />
            </Feld>
          </div>
          <Feld label="Grund" htmlFor={`${id}-grund`}>
            <Input
              id={`${id}-grund`}
              groesse="L"
              aria-required
              placeholder="Widerspruch per Telefon am …"
              fehler={fehler.grund}
              value={e.grund}
              onChange={(ev) => setE((x) => ({ ...x, grund: ev.target.value }))}
            />
          </Feld>
          <Feld label="Notiz" htmlFor={`${id}-notiz`}>
            <Textarea
              id={`${id}-notiz`}
              rows={2}
              className="text-[15px] max-md:text-[16px]"
              value={e.notiz}
              onChange={(ev) => setE((x) => ({ ...x, notiz: ev.target.value }))}
              onSubmit={absenden}
            />
          </Feld>
        </>
      }
    />
  )
}

function EntfernenDialog({
  eintrag,
  onOpenChange,
}: {
  eintrag: SperrlisteEintrag | null
  onOpenChange: (o: boolean) => void
}) {
  const id = useId()
  const entfernen = useSperrlisteEntfernen()
  const notiz = useAktivitaetErstellen()
  const [grund, setGrund] = useState('')
  const [fehler, setFehler] = useState<string | undefined>()
  const schliessen = (o: boolean) => {
    if (!o) {
      setGrund('')
      setFehler(undefined)
    }
    onOpenChange(o)
  }
  const absenden = async () => {
    if (!eintrag) return
    if (!grund.trim()) {
      setFehler(ALLGEMEIN.grundEingeben)
      return
    }
    try {
      await entfernen.mutateAsync(eintrag.id)
      if (eintrag.lead_id)
        await notiz.mutateAsync({
          lead_id: eintrag.lead_id,
          type: 'notiz',
          channel: 'sonstiges',
          note: `Sperrlisten-Eintrag entfernt – Grund: ${grund.trim()}`,
          metadata: { kind: 'sperrliste_entfernt', reason: grund.trim() },
        })
      toast('Eintrag entfernt.')
      schliessen(false)
    } catch {
      // Fehler-Toast aus der Daten-Schicht
    }
  }
  return (
    <Dialog
      offen={eintrag !== null}
      onOpenChange={schliessen}
      gross
      titel="Eintrag entfernen"
      text={DIALOG.sperrlisteEntfernen.text}
      primaer={{
        label: DIALOG.sperrlisteEntfernen.primaer,
        onClick: () => void absenden(),
        danger: true,
        disabled: !grund.trim(),
        busy: entfernen.isPending || notiz.isPending,
      }}
      kinder={
        <Feld label="Grund" htmlFor={`${id}-grund`}>
          <Input
            id={`${id}-grund`}
            groesse="L"
            aria-required
            autoFocus
            fehler={fehler}
            value={grund}
            onChange={(e) => setGrund(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void absenden()
            }}
          />
        </Feld>
      }
    />
  )
}

/**
 * Eine Zeile der Liste: Name (ohne Namen die Adresse), Grund, Datum, rechts „Entfernen“. Ab 1280 px steht alles in einer Zeile;
 * darunter (und am Telefon) stehen Grund und Datum in voller Breite unter dem Namen – „Entfernen“ bleibt rechts im Bild.
 */
function Zeile({ eintrag, onEntfernen }: { eintrag: SperrlisteEintrag; onEntfernen: () => void }) {
  const adresse = [eintrag.linkedin_url_norm, eintrag.email, fmtTelefon(eintrag.phone_e164)].filter(Boolean).join(' · ')
  const grund = sperrGrundText(eintrag.reason, eintrag.note)
  return (
    <li
      data-id={eintrag.id}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 py-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
    >
      <div className="grid min-w-0">
        <span className="text-body text-ink truncate-1 font-medium">{eintrag.name ?? (adresse || '–')}</span>
        {eintrag.name && adresse ? <span className="text-small text-ink-3 truncate-1">{adresse}</span> : null}
      </div>
      <div className="flex min-w-0 items-center gap-3 max-xl:col-span-2 max-xl:row-start-2">
        <Chip ton="danger" title={grund} className="min-w-0">
          {grund}
        </Chip>
        <span className="text-small text-ink-2 tnum flex-none whitespace-nowrap">{fmtDatum(eintrag.created_at)}</span>
      </div>
      <Button variante="danger" groesse="L" className="max-xl:col-start-2 max-xl:row-start-1" onClick={onEntfernen}>
        Entfernen
      </Button>
    </li>
  )
}

export function Sperrliste() {
  const id = useId()
  const { data: eintraege, isPending, refetch } = useSperrliste()
  const [q, setQ] = useState('')
  const [neuOffen, setNeuOffen] = useState(false)
  const [entfernen, setEntfernen] = useState<SperrlisteEintrag | null>(null)

  if (!eintraege) {
    return isPending ? (
      <Skeleton zeilen={4} />
    ) : (
      <NichtGeladen text="Die Sperrliste konnte nicht geladen werden." onNochmal={() => void refetch()} />
    )
  }

  const gefiltert = eintraege.filter((e) => passtSperrsuche(e, q))
  const hinzufuegen = (
    <Button variante="primary" groesse="L" icon={Plus} onClick={() => setNeuOffen(true)}>
      Eintrag hinzufügen
    </Button>
  )

  return (
    <div className="grid gap-4">
      {eintraege.length === 0 ? (
        <div className="grid justify-items-start gap-5 py-2">
          <p className="text-body text-ink-2">Die Sperrliste ist leer.</p>
          {hinzufuegen}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="w-full max-w-[360px]">
              <Input
                id={`${id}-suche`}
                groesse="L"
                type="search"
                aria-label="Sperrliste durchsuchen"
                placeholder="Suchen"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            {hinzufuegen}
          </div>
          {gefiltert.length === 0 ? (
            <EmptyState
              titel={`Nichts gefunden für ‚${q}‘.`}
              primaer={{ label: 'Suche leeren', onClick: () => setQ('') }}
            />
          ) : (
            // Reihenfolge wie geladen: neueste zuerst (useSperrliste, created_at absteigend)
            <ul aria-label="Sperrliste" className="divide-line border-line divide-y border-y">
              {gefiltert.map((e) => (
                <Zeile key={e.id} eintrag={e} onEntfernen={() => setEntfernen(e)} />
              ))}
            </ul>
          )}
        </>
      )}
      <HinzufuegenDialog offen={neuOffen} onOpenChange={setNeuOffen} onAngelegt={() => setQ('')} />
      <EntfernenDialog
        eintrag={entfernen}
        onOpenChange={(o) => {
          if (!o) setEntfernen(null)
        }}
      />
    </div>
  )
}
