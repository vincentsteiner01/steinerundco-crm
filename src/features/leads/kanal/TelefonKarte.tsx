// BAUPLAN § 3.3 `kanal/TelefonKarte.tsx` (ux § 3.3.3): Zustand-Chip (Keine Nummer · Nummer ohne Anrufgrund · Bereit · Versuch n/5 ·
// Rückruf · Nicht erreichbar · Gesperrt · Firma gesperrt), Felder (Nummer, Typ, Quelle + URL, Anrufgrund-Select mit Pflichtnotiz bei
// „sonstiger konkreter Anlass“, Beste Erreichbarkeit → custom.erreichbarkeit, Versuche), INFO-Regel (§ 1.5 Nr. 35), Aktionen AnrufButton (M3) ·
// Rückruf planen · Nummer recherchieren · Ausdrückliche Einwilligung notieren (Aktivität einwilligung, metadata.kind einwilligung_telefon).
import { useState } from 'react'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { DatePicker } from '@/components/ui/DatePicker'
import { Dialog } from '@/components/ui/Dialog'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Popover } from '@/components/ui/Popover'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { useAktivitaetErstellen } from '@/data/activities'
import { useCalls } from '@/data/calls'
import { useLeadUpdate } from '@/data/leads'
import { useSettings } from '@/data/settings'
import { useTaskErstellen } from '@/data/tasks'
import { AnrufButton } from '@/features/telefon/public'
import { fmtDatumKurz, fmtDatumZeit, fmtZeit, heuteBerlin } from '@/lib/format'
import { type SperrlistenTreffer, telefonGate } from '@/lib/gates'
import { fmtTelefon, nachE164, telHref } from '@/lib/telefon'
import { tagZuDate } from '@/lib/zeit'
import { ALLGEMEIN, ANRUFGRUND_LABEL, ERGEBNIS_LABEL, GATE_GRUND_LABEL } from '@/texte/de'
import type { Json } from '@/types/database'
import type { CallBasis, LeadMitBezug, PhoneSource, PhoneType } from '@/types/domain'
import { jetztIso } from '../hilfen'
import { Akkordeon, KarteAktionen, KarteFeld, KarteFelder } from './_Akkordeon'
import { infoRegelSichtbar, telefonZustand } from './zustaende'

const TYP_LABEL: Record<PhoneType, string> = {
  zentrale: 'Zentrale',
  durchwahl: 'Durchwahl',
  mobil: 'Mobil',
  unbekannt: 'Unbekannt',
}
const QUELLE_LABEL: Record<PhoneSource, string> = {
  website_kontakt: 'Website-Kontakt',
  google_profil: 'Google-Profil',
  branchenverzeichnis: 'Branchenverzeichnis',
  linkedin: 'LinkedIn',
  visitenkarte: 'Visitenkarte',
  mitgeteilt: 'mitgeteilt',
  impressum: 'Impressum',
  unbekannt: 'unbekannt (Alt-Import)',
}
const ANRUFGRUENDE = Object.keys(ANRUFGRUND_LABEL) as CallBasis[]

export function TelefonKarte({
  lead,
  offen,
  onToggle,
  immerOffen,
  sperrliste,
}: {
  lead: LeadMitBezug
  offen: boolean
  onToggle: () => void
  immerOffen?: boolean
  sperrliste?: SperrlistenTreffer
}) {
  const { data: settings } = useSettings()
  const { data: calls } = useCalls(lead.id, 50)
  const update = useLeadUpdate()
  const aktivitaet = useAktivitaetErstellen()
  const task = useTaskErstellen()
  const max = settings?.telefon.max_attempts ?? 5
  const z = telefonZustand(lead, calls ?? [], max, sperrliste)
  const gate = telefonGate(lead, sperrliste)
  const custom = (lead.custom ?? {}) as Record<string, unknown>
  const [feld, setFeld] = useState<'nummer' | 'erreichbarkeit' | 'zentrale' | null>(null)
  const [text, setText] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [grundEntwurf, setGrundEntwurf] = useState<{ basis: CallBasis; note: string; url: string } | null>(null)
  const [rueckrufOffen, setRueckrufOffen] = useState(false)
  const [rueckrufWann, setRueckrufWann] = useState<string | null>(null)
  const [einwilligungOffen, setEinwilligungOffen] = useState(false)
  const [zitat, setZitat] = useState('')
  const heute = heuteBerlin()

  const patch = async (p: Parameters<typeof update.mutateAsync>[0]['patch']) => {
    try {
      await update.mutateAsync({ id: lead.id, erwartetUpdatedAt: lead.updated_at, patch: p })
      return true
    } catch {
      return false
    }
  }

  const nummerSpeichern = async () => {
    setFeld(null)
    const roh = text.trim()
    if (!roh) {
      await patch({ phone_e164: null })
      return
    }
    const e164 = nachE164(roh)
    if (!e164) {
      setFehler(ALLGEMEIN.nummerUnvollstaendig)
      return
    }
    setFehler(null)
    await patch({ phone_e164: e164, phone_collected_at: jetztIso() })
  }

  /** Anrufgrund setzen = Patch + Beleg-Aktivität (§ 1.5 Nr. 14, Timeline „Anrufgrund gesetzt: …“). */
  const anrufgrundSetzen = async (basis: CallBasis, note: string | null, url: string | null) => {
    const ok = await patch({ call_basis: basis, call_basis_note: note, call_basis_url: url })
    if (!ok) return
    try {
      await aktivitaet.mutateAsync({
        lead_id: lead.id,
        type: 'einwilligung',
        channel: 'telefon',
        outcome: basis,
        note,
        metadata: { kind: 'anrufgrund', url },
      })
    } catch {
      /* Toast aus der Mutation */
    }
    setGrundEntwurf(null)
  }

  const grundWaehlen = (v: string) => {
    if (!v) {
      void patch({ call_basis: null, call_basis_note: null, call_basis_url: null })
      return
    }
    const basis = v as CallBasis
    if (basis === 'sonstiger_konkreter_anlass') setGrundEntwurf({ basis, note: '', url: '' })
    else void anrufgrundSetzen(basis, null, null)
  }

  const rueckrufPlanen = async () => {
    if (!rueckrufWann || rueckrufWann.length < 16) return
    const wann = tagZuDate(rueckrufWann.slice(0, 10), rueckrufWann.slice(11, 16))
    try {
      await task.mutateAsync({
        lead_id: lead.id,
        kind: 'rueckruf',
        title: 'Rückruf',
        due_at: wann.toISOString(),
        member_id: lead.owner_id,
        status: 'offen',
      })
      toast(`Rückruf vereinbart ${fmtDatumKurz(wann)} ${fmtZeit(wann)}.`)
      setRueckrufOffen(false)
      setRueckrufWann(null)
    } catch {
      /* Toast aus der Mutation */
    }
  }

  const nummerRecherchieren = async () => {
    try {
      await task.mutateAsync({
        lead_id: lead.id,
        kind: 'aufgabe',
        title: 'Nummer recherchieren',
        due_at: tagZuDate(heute, settings?.queue.due_time ?? '09:00').toISOString(),
        member_id: lead.owner_id,
        status: 'offen',
      })
      toast('Aufgabe angelegt – Nummer recherchieren.')
    } catch {
      /* Toast aus der Mutation */
    }
  }

  const einwilligungNotieren = async () => {
    const note = zitat.trim()
    if (!note) return
    try {
      await aktivitaet.mutateAsync({
        lead_id: lead.id,
        type: 'einwilligung',
        channel: 'telefon',
        outcome: lead.call_basis ?? 'bestandskontakt',
        note,
        metadata: { kind: 'einwilligung_telefon' },
      })
      toast('Einwilligung notiert.')
      setEinwilligungOffen(false)
      setZitat('')
    } catch {
      /* Toast aus der Mutation */
    }
  }

  const versuche = (calls ?? []).filter((c) => c.direction === 'out')
  const letzter = versuche[0]
  const rueckruf = lead.tasks?.find((t) => t.kind === 'rueckruf' && t.status === 'offen')
  const erreichbarkeit = typeof custom.erreichbarkeit === 'string' ? custom.erreichbarkeit : null
  const zentrale = typeof custom.zentrale_name === 'string' ? custom.zentrale_name : null

  const editFeld = (
    key: 'nummer' | 'erreichbarkeit' | 'zentrale',
    label: string,
    wert: string | null,
    mono?: boolean,
    leer = 'hinzufügen',
  ) =>
    feld === key ? (
      <div className="grid min-w-0 gap-[3px]">
        <span className="label">{label}</span>
        <Input
          autoFocus
          aria-label={label}
          mono={mono}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (key === 'nummer') void nummerSpeichern()
              else {
                setFeld(null)
                void patch({
                  custom: {
                    ...custom,
                    [key === 'erreichbarkeit' ? 'erreichbarkeit' : 'zentrale_name']: text.trim() || null,
                  } as Json,
                })
              }
            }
            if (e.key === 'Escape') setFeld(null)
          }}
          onBlur={() => {
            if (key === 'nummer') void nummerSpeichern()
            else {
              setFeld(null)
              void patch({
                custom: {
                  ...custom,
                  [key === 'erreichbarkeit' ? 'erreichbarkeit' : 'zentrale_name']: text.trim() || null,
                } as Json,
              })
            }
          }}
        />
      </div>
    ) : (
      <div className="grid min-w-0 gap-[3px]">
        <span className="label">{label}</span>
        <button
          type="button"
          aria-label={`${label} bearbeiten`}
          onClick={() => {
            setText(wert ?? '')
            setFeld(key)
          }}
          className={`hover:border-line-strong truncate border-b border-dashed border-transparent py-0.5 text-left text-[14px] ${mono ? 'tnum font-mono text-[13px]' : ''} ${wert ? (mono ? 'text-ink-2' : 'text-ink') : 'text-ink-4'}`}
        >
          {wert ?? leer}
        </button>
        {key === 'nummer' && fehler ? <span className="text-small text-danger">{fehler}</span> : null}
      </div>
    )

  return (
    <Akkordeon
      kanal="telefon"
      titel="Telefon"
      chip={<Chip ton={z.ton}>{z.label}</Chip>}
      offen={offen}
      onToggle={onToggle}
      immerOffen={immerOffen}
    >
      {infoRegelSichtbar(lead) ? (
        <p className="text-small text-overdue mb-3" role="note">
          INFO-Regel: Follow-ups bevorzugt telefonisch – Anrufgrund setzen
        </p>
      ) : null}
      <KarteFelder>
        {editFeld('nummer', 'Telefon', lead.phone_e164 ? fmtTelefon(lead.phone_e164) : null, true)}
        <div className="grid min-w-0 gap-[3px]">
          <span className="label">Typ</span>
          <Select
            aria-label="Typ"
            className="h-8"
            value={lead.phone_type}
            onChange={(e) => void patch({ phone_type: e.target.value as PhoneType })}
            optionen={(Object.keys(TYP_LABEL) as PhoneType[]).map((t) => ({ value: t, label: TYP_LABEL[t] }))}
          />
        </div>
        <div className="grid min-w-0 gap-[3px]">
          <span className="label">Quelle</span>
          <Select
            aria-label="Quelle der Nummer"
            className="h-8"
            value={lead.phone_source}
            onChange={(e) => void patch({ phone_source: e.target.value as PhoneSource })}
            optionen={(Object.keys(QUELLE_LABEL) as PhoneSource[]).map((q) => ({ value: q, label: QUELLE_LABEL[q] }))}
          />
          {lead.phone_source === 'impressum' ? (
            <span className="text-small text-overdue">Impressumsdaten nicht für Werbung</span>
          ) : null}
          {lead.phone_source_url ? (
            <a
              className="mono-sm text-ink-3 truncate"
              href={lead.phone_source_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {lead.phone_source_url}
            </a>
          ) : null}
        </div>
        <div className="grid min-w-0 gap-[3px]">
          <span className="label">Anrufgrund</span>
          <Select
            aria-label="Anrufgrund"
            className="h-8"
            value={grundEntwurf?.basis ?? lead.call_basis ?? ''}
            platzhalter="Pflicht vor Anruf"
            onChange={(e) => grundWaehlen(e.target.value)}
            optionen={ANRUFGRUENDE.map((g) => ({ value: g, label: ANRUFGRUND_LABEL[g] }))}
          />
          {!lead.call_basis && !grundEntwurf ? (
            <span className="text-small text-overdue">fehlt – Pflicht vor Anruf</span>
          ) : null}
          {lead.call_basis === 'linkedin_vernetzt' ? (
            <span className="text-small text-ink-3">‚nur vernetzt‘ ist die schwächere Grundlage</span>
          ) : null}
          {lead.call_basis_note ? <span className="text-small text-ink-3 truncate">{lead.call_basis_note}</span> : null}
        </div>
        {grundEntwurf ? (
          <div className="col-span-2 grid gap-2" role="group" aria-label="Sonstiger konkreter Anlass">
            <FormField label="Anlass (Pflicht)" htmlFor={`grund-note-${lead.id}`}>
              <Textarea
                id={`grund-note-${lead.id}`}
                value={grundEntwurf.note}
                placeholder="Was genau war der Anlass?"
                onChange={(e) => setGrundEntwurf({ ...grundEntwurf, note: e.target.value })}
              />
            </FormField>
            <FormField label="Beleg-URL (Pflicht)" htmlFor={`grund-url-${lead.id}`}>
              <Input
                id={`grund-url-${lead.id}`}
                mono
                value={grundEntwurf.url}
                placeholder="https://…"
                onChange={(e) => setGrundEntwurf({ ...grundEntwurf, url: e.target.value })}
              />
            </FormField>
            <div className="flex justify-end gap-1.5">
              <Button variante="quiet" groesse="S" onClick={() => setGrundEntwurf(null)}>
                Abbrechen
              </Button>
              <Button
                variante="primary"
                groesse="S"
                disabled={!grundEntwurf.note.trim() || !grundEntwurf.url.trim()}
                busy={update.isPending}
                onClick={() =>
                  void anrufgrundSetzen(grundEntwurf.basis, grundEntwurf.note.trim(), grundEntwurf.url.trim())
                }
              >
                Anrufgrund setzen
              </Button>
            </div>
          </div>
        ) : null}
        {editFeld('erreichbarkeit', 'Beste Erreichbarkeit', erreichbarkeit, false, 'z. B. morgens vor 9')}
        {editFeld('zentrale', 'Name Zentrale', zentrale)}
        <KarteFeld
          label="Versuche"
          mono
          wert={`${versuche.length}/${max}${letzter ? ` · ${ERGEBNIS_LABEL[letzter.outcome] ?? letzter.outcome} · ${fmtDatumKurz(letzter.started_at)}` : ''}`}
        />
        <KarteFeld label="Rückruf am" mono wert={rueckruf ? fmtDatumZeit(rueckruf.due_at) : null} leer="keiner" />
      </KarteFelder>
      <KarteAktionen>
        <AnrufButton leadId={lead.id} groesse="S" />
        {lead.phone_e164 && gate.erlaubt ? (
          <a className="text-ink-3 hover:text-ink mono-sm" href={telHref(lead.phone_e164)}>
            tel:
          </a>
        ) : null}
        <Popover
          offen={rueckrufOffen}
          onOpenChange={setRueckrufOffen}
          titel="Rückruf planen"
          trigger={
            <Button
              variante="secondary"
              groesse="S"
              disabled={!lead.phone_e164}
              disabledGrund={GATE_GRUND_LABEL.keine_nummer}
            >
              Rückruf planen
            </Button>
          }
        >
          <div className="grid gap-2 p-1.5">
            <DatePicker
              wert={rueckrufWann}
              onChange={setRueckrufWann}
              mitUhrzeit
              min={heute}
              presets={['heute', 'morgen', '+3']}
              placeholder="Datum, Uhrzeit"
            />
            <div className="flex justify-end">
              <Button
                variante="primary"
                groesse="S"
                busy={task.isPending}
                disabled={!rueckrufWann || rueckrufWann.length < 16}
                onClick={() => void rueckrufPlanen()}
              >
                Rückruf eintragen
              </Button>
            </div>
          </div>
        </Popover>
        {!lead.phone_e164 ? (
          <Button variante="secondary" groesse="S" busy={task.isPending} onClick={() => void nummerRecherchieren()}>
            Nummer recherchieren
          </Button>
        ) : null}
        <Button variante="quiet" groesse="S" onClick={() => setEinwilligungOffen(true)}>
          Ausdrückliche Einwilligung notieren
        </Button>
        <Dialog
          offen={einwilligungOffen}
          onOpenChange={(o) => {
            setEinwilligungOffen(o)
            if (!o) setZitat('')
          }}
          titel="Ausdrückliche Einwilligung notieren"
          text="Zitat ist Pflicht – was genau hat die Person gesagt?"
          primaer={{
            label: 'Einwilligung notieren',
            onClick: () => void einwilligungNotieren(),
            disabled: !zitat.trim(),
            busy: aktivitaet.isPending,
          }}
          kinder={
            <FormField label="Zitat" pflicht htmlFor={`einw-${lead.id}`}>
              <Textarea
                id={`einw-${lead.id}`}
                value={zitat}
                placeholder="‚Rufen Sie gern wieder an …‘"
                onChange={(e) => setZitat(e.target.value)}
                onSubmit={() => void einwilligungNotieren()}
              />
            </FormField>
          }
        />
      </KarteAktionen>
    </Akkordeon>
  )
}
