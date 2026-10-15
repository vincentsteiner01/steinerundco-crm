// Einstellungen → Sperrliste (BAUPLAN § 3.9 Sperrliste.tsx, ux § 3.10 Nr. 8, § 4.8, E-08): Tabelle 40 px (Name · Unternehmen ·
// Kanal-Umfang · Grund · Datum · erfasst von · Quelle), Suche, „Eintrag hinzufügen“ (URL/E-Mail/Telefon mind. eins, Grund Pflicht),
// „Entfernen“ (Dialog mit Grund → Notiz-Aktivität am Lead, falls lead_id).
import { Plus } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { Button, Checkbox, Chip, Dialog, EmptyState, FormField, Input, Skeleton, Textarea } from '@/components/ui'
import { DataTable, spaltenHelper, type DataTableSpalte } from '@/components/tabelle'
import { toast } from '@/components/toast'
import {
  useAktivitaetErstellen,
  useMeId,
  useMembers,
  useSperrliste,
  useSperrlisteEintrag,
  useSperrlisteEntfernen,
} from '@/data'
import { useHotkeys } from '@/lib/keyboard'
import { fmtDatum } from '@/lib/format'
import { fmtTelefon, nachE164 } from '@/lib/telefon'
import { normalizeLinkedinUrl } from '@/lib/url'
import { ALLGEMEIN, DIALOG, KANAL_LABEL } from '@/texte/de'
import type { Channel, SperrlisteEintrag } from '@/types/domain'
import {
  KANAELE,
  LEERER_EINTRAG,
  kanalUmfang,
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
  const kanal = (c: Channel, an: boolean) =>
    setE((x) => ({ ...x, kanaele: an ? [...new Set([...x.kanaele, c])] : x.kanaele.filter((k) => k !== c) }))

  return (
    <Dialog
      offen={offen}
      onOpenChange={schliessen}
      titel="Eintrag hinzufügen"
      text="Wird beim Import und vor jedem Kontakt geprüft – LinkedIn-URL, E-Mail oder Telefon."
      primaer={{ label: 'Eintragen', onClick: absenden, busy: anlegen.isPending }}
      kinder={
        <>
          {fehler.schluessel ? (
            <p className="text-small text-danger" role="alert">
              {fehler.schluessel}
            </p>
          ) : null}
          <FormField label="LinkedIn-URL" htmlFor={`${id}-url`} fehler={fehler.url}>
            <Input id={`${id}-url`} value={e.url} onChange={(ev) => setE((x) => ({ ...x, url: ev.target.value }))} />
          </FormField>
          <div className="grid items-start gap-3.5 sm:grid-cols-2">
            <FormField label="E-Mail" htmlFor={`${id}-mail`} fehler={fehler.email}>
              <Input
                id={`${id}-mail`}
                type="email"
                value={e.email}
                onChange={(ev) => setE((x) => ({ ...x, email: ev.target.value }))}
              />
            </FormField>
            <FormField label="Telefon" htmlFor={`${id}-tel`} fehler={fehler.telefon}>
              <Input
                id={`${id}-tel`}
                type="tel"
                mono
                value={e.telefon}
                onChange={(ev) => setE((x) => ({ ...x, telefon: ev.target.value }))}
              />
            </FormField>
          </div>
          <div className="grid items-start gap-3.5 sm:grid-cols-2">
            <FormField label="Name" htmlFor={`${id}-name`}>
              <Input
                id={`${id}-name`}
                value={e.name}
                onChange={(ev) => setE((x) => ({ ...x, name: ev.target.value }))}
              />
            </FormField>
            <FormField label="Unternehmen" htmlFor={`${id}-firma`}>
              <Input
                id={`${id}-firma`}
                value={e.firma}
                onChange={(ev) => setE((x) => ({ ...x, firma: ev.target.value }))}
              />
            </FormField>
          </div>
          <FormField label="Kanäle" fehler={fehler.kanaele}>
            <div className="flex flex-wrap gap-4">
              {KANAELE.map((c) => (
                <Checkbox
                  key={c}
                  label={KANAL_LABEL[c]}
                  checked={e.kanaele.includes(c)}
                  onChange={(ev) => kanal(c, ev.target.checked)}
                />
              ))}
            </div>
          </FormField>
          <FormField label="Grund" htmlFor={`${id}-grund`} fehler={fehler.grund} pflicht>
            <Input
              id={`${id}-grund`}
              placeholder="Widerspruch per Telefon am …"
              value={e.grund}
              onChange={(ev) => setE((x) => ({ ...x, grund: ev.target.value }))}
            />
          </FormField>
          <FormField label="Notiz" htmlFor={`${id}-notiz`}>
            <Textarea
              id={`${id}-notiz`}
              rows={2}
              value={e.notiz}
              onChange={(ev) => setE((x) => ({ ...x, notiz: ev.target.value }))}
              onSubmit={absenden}
            />
          </FormField>
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
        <FormField label="Grund" htmlFor={`${id}-grund`} fehler={fehler} pflicht>
          <Input
            id={`${id}-grund`}
            autoFocus
            value={grund}
            onChange={(e) => setGrund(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void absenden()
            }}
          />
        </FormField>
      }
    />
  )
}

export function Sperrliste() {
  const id = useId()
  const { data: eintraege } = useSperrliste()
  const { data: members } = useMembers()
  const [q, setQ] = useState('')
  const [neuOffen, setNeuOffen] = useState(false)
  const [entfernen, setEntfernen] = useState<SperrlisteEintrag | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)

  useHotkeys('global', { n: () => setNeuOffen(true) }, [])

  const name = (mid: string | null) => members?.find((m) => m.id === mid)?.display_name ?? '–'

  const spalten = useMemo<DataTableSpalte<SperrlisteEintrag>[]>(() => {
    const h = spaltenHelper<SperrlisteEintrag>()
    return h.columns([
      h.accessor('name', {
        header: 'Name',
        meta: { oeffnet: true, breite: '15%' },
        cell: (c) => (
          <span className="grid">
            <span className="text-ink font-medium">{c.getValue() ?? '–'}</span>
            <span className="text-small text-ink-3 truncate-1">
              {[c.row.original.linkedin_url_norm, c.row.original.email, fmtTelefon(c.row.original.phone_e164)]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </span>
        ),
      }),
      // Runde 3: „Unternehmen“ (95/98 px) und „Erfasst von“ (86/89 px) waren selbst bei leerer Liste gekürzt – 1 % mehr je Spalte,
      // dafür Kanal-Umfang und Grund je 1 % weniger; Köpfe dürfen zweizeilig umbrechen
      h.accessor('company', {
        header: 'Unternehmen',
        meta: { breite: '14%', kopfUmbruch: true },
        cell: (c) => c.getValue() ?? '–',
      }),
      h.accessor('channels', {
        header: 'Kanal-Umfang',
        meta: { breite: '15%', kopfUmbruch: true },
        enableSorting: false,
        cell: (c) => kanalUmfang(c.getValue()),
      }),
      h.accessor('reason', {
        header: 'Grund',
        meta: { breite: '14%' },
        cell: (c) => {
          const text = sperrGrundText(c.getValue(), c.row.original.note)
          return (
            <Chip ton="danger" title={text}>
              <span className="truncate-1 max-w-[180px]">{text}</span>
            </Chip>
          )
        },
      }),
      h.accessor('created_at', {
        header: 'Datum',
        meta: { mono: true, rechts: true, breite: '9%' },
        cell: (c) => fmtDatum(c.getValue()),
      }),
      h.accessor('created_by', {
        header: 'Erfasst von',
        meta: { breite: '13%', kopfUmbruch: true },
        cell: (c) => name(c.getValue()),
      }),
      h.accessor('lead_id', {
        header: 'Quelle',
        meta: { breite: '7.5%' },
        enableSorting: false,
        cell: (c) => (c.getValue() ? 'Lead' : 'manuell'),
      }),
      h.display({
        id: 'aktion',
        header: '',
        meta: { rechts: true, breite: '110px' },
        cell: (c) => (
          <Button variante="danger" groesse="S" onClick={() => setEntfernen(c.row.original)} kbd="↵">
            Entfernen
          </Button>
        ),
      }),
    ])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members])

  if (!eintraege) return <Skeleton zeilen={4} />

  const gefiltert = eintraege.filter((e) => passtSperrsuche(e, q))

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-full max-w-[360px]">
          <Input
            id={`${id}-suche`}
            type="search"
            aria-label="Sperrliste durchsuchen"
            placeholder="Suchen – Name, Firma, E-Mail, URL, Grund"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-small text-ink-3 tnum">
            {gefiltert.length} von {eintraege.length}
          </span>
          <Button variante="primary" icon={Plus} kbd="N" onClick={() => setNeuOffen(true)}>
            Eintrag hinzufügen
          </Button>
        </div>
      </div>
      <DataTable<SperrlisteEintrag>
        daten={gefiltert}
        spalten={spalten}
        rowId={(e) => e.id}
        cursorId={cursor}
        onCursor={setCursor}
        onEnter={(e) => setEntfernen(e)}
        zeilenHoehe={40}
        ariaLabel="Sperrliste"
        leer={
          eintraege.length === 0 ? (
            <EmptyState
              titel="Sperrliste ist leer."
              satz="Widersprüche landen hier automatisch; Einträge von Hand mit „Eintrag hinzufügen“."
              primaer={{ label: 'Eintrag hinzufügen', onClick: () => setNeuOffen(true), kbd: 'N' }}
            />
          ) : (
            <EmptyState
              titel={`Nichts gefunden für ‚${q}‘.`}
              primaer={{ label: 'Suche leeren', onClick: () => setQ('') }}
            />
          )
        }
      />
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
