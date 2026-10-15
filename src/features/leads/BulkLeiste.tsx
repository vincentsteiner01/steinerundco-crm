// BAUPLAN § 3.3 `BulkLeiste.tsx` (ux § 3.2.4, DESIGN-SYSTEM § 5.10, LE-08): „3 ausgewählt“ + S-Buttons (Zuständig · Später · Sequenz starten ·
// Beenden …) + „Mehr ⌥B“ mit allen Aktionen (Übergeben · Freigeben · Phase · Wiedervorlage · Sequenz stoppen · Tag · Anrufgrund ·
// Zur Anrufliste · Exportieren (CSV) · Zusammenführen (v1.1) · In Papierkorb). Jede Aktion ist ein Stapel mit einem Toast
// „12 Leads beendet · Rückgängig“ (useUndo mit Stapel: `Z` macht alle rückgängig, soweit eine reversible Aktivität entstand).
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { PFADE } from '@/app/pfade'
import { beendenGruende, FREIGABE_GRUND, FREIGABE_PER_TABELLE, type BeendenGrund } from '@/components/aktionen'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { DatePicker } from '@/components/ui/DatePicker'
import { Dialog } from '@/components/ui/Dialog'
import { FormField } from '@/components/ui/FormField'
import { Popover, PopoverEintrag } from '@/components/ui/Popover'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { nachleseAktivitaet, useAktivitaetErstellen } from '@/data/activities'
import { zeigeFehler } from '@/data/errors'
import { ladeLead, useLeadLoeschen, useLeadUpdate } from '@/data/leads'
import { useMeId, useMembers } from '@/data/members'
import { queryClient } from '@/data/queryClient'
import { qk } from '@/data/queryKeys'
import { rpc } from '@/data/rpc'
import { useSequences } from '@/data/sequences'
import { useSettings } from '@/data/settings'
import { useLeadTagEntfernen, useLeadTagSetzen, useTags } from '@/data/tags'
import { useUndo } from '@/data/undo'
import { csvExport, download, type CsvSpalte } from '@/lib/csv'
import { fmtDatum, heuteBerlin } from '@/lib/format'
import { emailSequenzStartbar, kontaktGate, telefonGate } from '@/lib/gates'
import { ERSTE_STAGE_DER_PHASE, PHASEN } from '@/lib/stufen'
import { rollToWeekday } from '@/lib/werktage'
import { monatePlus } from '@/lib/zeit'
import { ANRUFGRUND_LABEL, GATE_GRUND_LABEL, KANAL_LABEL } from '@/texte/de'
import type { ActivityType, CallBasis, PhaseKey } from '@/types/domain'
import type { LeadZeile } from './spalten'

type DialogArt =
  | 'zustaendig'
  | 'uebergeben'
  | 'freigeben'
  | 'phase'
  | 'wiedervorlage'
  | 'sequenz'
  | 'sequenzStop'
  | 'tag'
  | 'tagEntfernen'
  | 'anrufgrund'
  | 'beenden'
  | 'papierkorb'

export type BulkLeisteProps = {
  ausgewaehlt: readonly LeadZeile[]
  csvSpalten: readonly CsvSpalte<LeadZeile>[]
  ansichtKey: string
  menuOffen: boolean
  onMenuOffen: (o: boolean) => void
  onFertig: () => void
}

const DIREKTE_PHASEN: PhaseKey[] = ['angefragt', 'vernetzt', 'eroeffnet', 'beantwortet', 'gepitcht']

export function BulkLeiste({ ausgewaehlt, csvSpalten, ansichtKey, menuOffen, onMenuOffen, onFertig }: BulkLeisteProps) {
  const navigate = useNavigate()
  const me = useMeId()
  const { data: members } = useMembers()
  const { data: settings } = useSettings()
  const { data: tags } = useTags()
  const { data: sequenzen } = useSequences()
  const update = useLeadUpdate()
  const { anbieten } = useUndo()
  const loeschen = useLeadLoeschen()
  const tagSetzen = useLeadTagSetzen()
  const tagEntfernen = useLeadTagEntfernen()
  const aktivitaet = useAktivitaetErstellen()
  const [dialog, setDialog] = useState<DialogArt | null>(null)
  const [laeuft, setLaeuft] = useState(false)
  const [wert, setWert] = useState('')
  const [notiz, setNotiz] = useState('')
  const [datum, setDatum] = useState<string | null>(null)
  const n = ausgewaehlt.length
  const heute = heuteBerlin()
  const andere = members?.find((m) => m.id !== me)

  const oeffne = (d: DialogArt) => {
    setWert('')
    setNotiz('')
    setDatum(null)
    setDialog(d)
    onMenuOffen(false)
  }

  /** Stapel: je Lead `fn`, danach Nachlese der reversiblen Aktivität (types) für den Sammel-Undo. */
  const stapel = async (
    text: (ok: number) => string,
    types: ActivityType[] | null,
    fn: (l: LeadZeile) => Promise<unknown>,
    liste: readonly LeadZeile[] = ausgewaehlt,
  ) => {
    if (laeuft) return
    setLaeuft(true)
    let ok = 0
    const ids: number[] = []
    for (const l of liste) {
      try {
        await fn(l)
        ok++
        if (types) {
          const a = await nachleseAktivitaet(l.id, types)
          if (a) ids.push(a.id)
        }
      } catch (e) {
        zeigeFehler(e)
        break
      }
    }
    setLaeuft(false)
    setDialog(null)
    for (const key of [qk.leads.all, qk.queue.all, qk.nav, qk.kpis.all, ['activities'], ['enrollments'], ['tasks']])
      void queryClient.invalidateQueries({ queryKey: key })
    if (ok > 0) anbieten(ids, text(ok))
    else if (liste.length === 0) toast(text(0))
    onFertig()
  }

  /**
   * Gates wie im Einzel-Menü (SequenzStartenMenue): kontaktGate (Widerspruch, Sperrliste, Firmensperre) und für E-Mail-Sequenzen
   * emailSequenzStartbar (Erlaubnis, M-13). `enroll` prüft serverseitig nur do_not_contact und die Firmensperre (Review).
   */
  const sequenzKandidaten = (key: string) => {
    const seq = sequenzen?.find((s) => s.key === key)
    const start: LeadZeile[] = []
    const gruende = new Map<string, number>()
    for (const l of ausgewaehlt) {
      const k = kontaktGate(l, l.sperrliste)
      const e = seq ? emailSequenzStartbar(seq, l) : { startbar: true }
      const grund = !k.erlaubt ? k.grund : !e.startbar ? e.grund : undefined
      if (grund) gruende.set(GATE_GRUND_LABEL[grund], (gruende.get(GATE_GRUND_LABEL[grund]) ?? 0) + 1)
      else start.push(l)
    }
    const uebersprungen = ausgewaehlt.length - start.length
    const zusatz = uebersprungen ? ` · ${uebersprungen} übersprungen (${[...gruende.keys()].join(', ')})` : ''
    return { start, zusatz }
  }

  const leads = (ok: number) => `${ok} ${ok === 1 ? 'Lead' : 'Leads'}`
  const patch = (l: LeadZeile, p: Parameters<typeof update.mutateAsync>[0]['patch']) =>
    update.mutateAsync({ id: l.id, erwartetUpdatedAt: l.updated_at, patch: p })

  const exportCsv = () => {
    download(csvExport(ausgewaehlt, csvSpalten), `crm-leads-${ansichtKey}-auswahl-${heute}.csv`)
    toast(`${n} ${n === 1 ? 'Lead' : 'Leads'} exportiert.`)
    onMenuOffen(false)
  }

  // „Zur Anrufliste“ (ux § 3.2.4): die Anrufliste (M3) rechnet sich aus Nummer + Anrufgrund ohne Sperre – es gibt keine Auswahl-Liste.
  // Fehlt bei Leads mit Nummer der Anrufgrund, setzt man ihn zuerst (Dialog); sonst geht es mit der Zahl der anrufbaren Leads nach /telefon.
  const zurAnrufliste = () => {
    if (ausgewaehlt.some((l) => l.phone_e164 && !l.call_basis)) {
      oeffne('anrufgrund')
      return
    }
    const bereit = ausgewaehlt.filter((l) => telefonGate(l, l.sperrliste).erlaubt).length
    onMenuOffen(false)
    toast(`${bereit} von ${n} ${n === 1 ? 'Lead' : 'Leads'} in der Anrufliste.`)
    navigate(PFADE.telefon)
  }

  const gruende = beendenGruende(settings?.ended_reason_labels)
  const wvVorgabe = rollToWeekday(monatePlus(heute, 3), settings?.feiertage)

  const dialogInhalt = () => {
    switch (dialog) {
      case 'zustaendig':
        return {
          titel: 'Zuständig ändern',
          primaer: {
            label: 'Zuständig ändern',
            disabled: !wert,
            onClick: () =>
              void stapel(
                (ok) => (wert === 'frei' ? `${leads(ok)} freigegeben.` : `${leads(ok)} übergeben.`),
                wert === 'frei' ? ['freigabe'] : ['uebergabe'],
                (l) =>
                  wert === 'frei'
                    ? rpc.releaseLead({ leadId: l.id, reason: FREIGABE_PER_TABELLE })
                    : rpc.transferLead({ leadId: l.id, toMember: wert, note: FREIGABE_PER_TABELLE }),
              ),
          },
          kinder: (
            <FormField label="Zuständig" htmlFor="bulk-zustaendig">
              <Select
                id="bulk-zustaendig"
                value={wert}
                platzhalter="Wählen"
                onChange={(e) => setWert(e.target.value)}
                optionen={[
                  ...(members ?? [])
                    .filter((m) => !!m.id)
                    .map((m) => ({ value: m.id as string, label: m.short_name ?? m.display_name ?? '' })),
                  { value: 'frei', label: 'Frei' },
                ]}
              />
            </FormField>
          ),
        }
      case 'uebergeben':
        return {
          titel: `An ${andere?.short_name ?? 'die andere Person'} übergeben`,
          primaer: {
            label: 'Übergeben',
            disabled: !notiz.trim() || !andere?.id,
            onClick: () =>
              void stapel(
                (ok) => `${leads(ok)} an ${andere?.short_name ?? 'die andere Person'} übergeben.`,
                ['uebergabe'],
                (l) => rpc.transferLead({ leadId: l.id, toMember: andere?.id as string, note: notiz.trim() }),
              ),
          },
          kinder: (
            <FormField label="Warum? (Pflicht)" pflicht htmlFor="bulk-notiz">
              <Textarea
                id="bulk-notiz"
                value={notiz}
                onChange={(e) => setNotiz(e.target.value)}
                placeholder="Kurz für die andere Person"
              />
            </FormField>
          ),
        }
      case 'freigeben':
        return {
          titel: 'Freigeben',
          primaer: {
            label: 'Freigeben',
            disabled: !wert,
            onClick: () =>
              void stapel(
                (ok) => `${leads(ok)} freigegeben.`,
                ['freigabe'],
                (l) =>
                  rpc.releaseLead({
                    leadId: l.id,
                    reason: wert === 'sonstiges' ? `${FREIGABE_GRUND.sonstiges} – ${notiz.trim()}` : wert,
                  }),
              ),
          },
          kinder: (
            <>
              <FormField label="Grund" htmlFor="bulk-grund">
                <Select
                  id="bulk-grund"
                  value={wert}
                  platzhalter="Wählen"
                  onChange={(e) => setWert(e.target.value)}
                  optionen={Object.entries(FREIGABE_GRUND).map(([k, label]) => ({
                    value: k === 'sonstiges' ? 'sonstiges' : label,
                    label,
                  }))}
                />
              </FormField>
              {wert === 'sonstiges' ? (
                <FormField label="Notiz" htmlFor="bulk-frei-notiz">
                  <Textarea id="bulk-frei-notiz" value={notiz} onChange={(e) => setNotiz(e.target.value)} />
                </FormField>
              ) : null}
            </>
          ),
        }
      case 'phase':
        return {
          titel: 'Phase setzen',
          primaer: {
            label: 'Phase setzen',
            disabled: !wert,
            onClick: () =>
              void stapel(
                (ok) => `${leads(ok)} auf ${PHASEN.find((p) => p.key === wert)?.label ?? wert} gesetzt.`,
                ['stage_wechsel'],
                (l) => patch(l, { stage: ERSTE_STAGE_DER_PHASE[wert as PhaseKey] }),
              ),
          },
          kinder: (
            <FormField
              label="Phase"
              htmlFor="bulk-phase"
              hinweis="Erstgespräch, Strategiegespräch, Kunde, Wiedervorlage und Beendet brauchen je Lead eine Angabe – über Termin, Wiedervorlage oder Beenden."
            >
              <Select
                id="bulk-phase"
                value={wert}
                platzhalter="Wählen"
                onChange={(e) => setWert(e.target.value)}
                optionen={DIREKTE_PHASEN.map((k) => ({ value: k, label: PHASEN.find((p) => p.key === k)?.label ?? k }))}
              />
            </FormField>
          ),
        }
      case 'wiedervorlage':
        return {
          titel: 'Wiedervorlage',
          primaer: {
            label: 'Wiedervorlage',
            onClick: () =>
              void stapel(
                (ok) => `${leads(ok)} auf Wiedervorlage am ${fmtDatum(datum ?? wvVorgabe)}.`,
                ['stage_wechsel'],
                (l) => rpc.setWiedervorlage({ leadId: l.id, due: datum ?? wvVorgabe, note: notiz.trim() || null }),
              ),
          },
          kinder: (
            <>
              <FormField label="Datum" htmlFor="bulk-wv">
                <DatePicker
                  id="bulk-wv"
                  wert={datum ?? wvVorgabe}
                  onChange={setDatum}
                  presets={['+1w', '+2m', '+3m']}
                />
              </FormField>
              <FormField label="Notiz" htmlFor="bulk-wv-notiz">
                <Textarea id="bulk-wv-notiz" value={notiz} onChange={(e) => setNotiz(e.target.value)} />
              </FormField>
            </>
          ),
        }
      case 'sequenz':
        return {
          titel: 'Sequenz starten',
          primaer: {
            label: 'Sequenz starten',
            disabled: !wert,
            onClick: () => {
              const { start, zusatz } = sequenzKandidaten(wert)
              void stapel(
                (ok) =>
                  `${leads(ok)} in Sequenz ${sequenzen?.find((s) => s.key === wert)?.name ?? ''} gestartet${zusatz}.`,
                null,
                (l) => rpc.enroll({ leadId: l.id, sequenceKey: wert, memberId: l.owner_id }),
                start,
              )
            },
          },
          kinder: (
            <FormField label="Sequenz" htmlFor="bulk-seq">
              <Select
                id="bulk-seq"
                value={wert}
                platzhalter="Wählen"
                onChange={(e) => setWert(e.target.value)}
                optionen={(sequenzen ?? []).map((s) => ({
                  value: s.key,
                  label: `${s.name} · ${KANAL_LABEL[s.channel]}${s.active ? '' : ' (inaktiv – in Einstellungen aktivieren)'}`,
                  disabled: !s.active,
                }))}
              />
            </FormField>
          ),
        }
      case 'sequenzStop':
        return {
          titel: 'Sequenzen stoppen',
          text: `Alle aktiven Sequenzen der ${n} ${n === 1 ? 'Lead' : 'Leads'} werden gestoppt (Timeline: „Sequenz beendet: manuell“).`,
          primaer: {
            label: 'Sequenzen stoppen',
            onClick: () =>
              void stapel(
                (ok) => `Sequenzen von ${leads(ok)} gestoppt.`,
                null,
                async (l) => {
                  const voll = await ladeLead(l.id)
                  for (const e of voll.enrollments ?? [])
                    if (e.status === 'aktiv' || e.status === 'pausiert')
                      await rpc.completeStep({ enrollmentId: e.id, outcome: 'abgebrochen' })
                },
              ),
          },
          kinder: null,
        }
      case 'tag':
      case 'tagEntfernen':
        return {
          titel: dialog === 'tag' ? 'Tag hinzufügen' : 'Tag entfernen',
          primaer: {
            label: dialog === 'tag' ? 'Tag hinzufügen' : 'Tag entfernen',
            disabled: !wert,
            onClick: () =>
              void stapel(
                (ok) =>
                  `Tag ${tags?.find((t) => t.id === wert)?.name ?? ''} bei ${leads(ok)} ${dialog === 'tag' ? 'hinzugefügt' : 'entfernt'}.`,
                null,
                (l) =>
                  dialog === 'tag'
                    ? tagSetzen.mutateAsync({ leadId: l.id, tagId: wert })
                    : tagEntfernen.mutateAsync({ leadId: l.id, tagId: wert }),
              ),
          },
          kinder: (
            <FormField label="Tag" htmlFor="bulk-tag">
              <Select
                id="bulk-tag"
                value={wert}
                platzhalter="Wählen"
                onChange={(e) => setWert(e.target.value)}
                optionen={(tags ?? []).map((t) => ({ value: t.id, label: t.name }))}
              />
            </FormField>
          ),
        }
      case 'anrufgrund':
        return {
          titel: 'Anrufgrund setzen',
          text: 'Die Leads erscheinen mit Nummer und Anrufgrund in der Anrufliste.',
          primaer: {
            label: 'Anrufgrund setzen',
            disabled: !wert || (wert === 'sonstiger_konkreter_anlass' && !notiz.trim()),
            onClick: () =>
              void stapel(
                (ok) => `Anrufgrund bei ${leads(ok)} gesetzt.`,
                null,
                async (l) => {
                  await patch(l, { call_basis: wert as CallBasis, call_basis_note: notiz.trim() || null })
                  await aktivitaet.mutateAsync({
                    lead_id: l.id,
                    type: 'einwilligung',
                    channel: 'telefon',
                    outcome: wert,
                    note: notiz.trim() || null,
                    metadata: { kind: 'anrufgrund' },
                  })
                },
              ),
          },
          kinder: (
            <>
              <FormField label="Anrufgrund" htmlFor="bulk-anrufgrund">
                <Select
                  id="bulk-anrufgrund"
                  value={wert}
                  platzhalter="Wählen"
                  onChange={(e) => setWert(e.target.value)}
                  optionen={(Object.keys(ANRUFGRUND_LABEL) as CallBasis[]).map((k) => ({
                    value: k,
                    label: ANRUFGRUND_LABEL[k],
                  }))}
                />
              </FormField>
              {wert === 'sonstiger_konkreter_anlass' ? (
                <FormField label="Anlass (Pflicht)" pflicht htmlFor="bulk-anrufgrund-notiz">
                  <Textarea id="bulk-anrufgrund-notiz" value={notiz} onChange={(e) => setNotiz(e.target.value)} />
                </FormField>
              ) : null}
            </>
          ),
        }
      case 'beenden': {
        const g = gruende.find((x) => x.key === wert)
        return {
          titel: 'Beenden – Grund',
          primaer: {
            label: 'Beenden',
            disabled: !g || (g.notizPflicht && !notiz.trim()),
            onClick: () =>
              void stapel(
                (ok) => `${leads(ok)} beendet · ${g?.label ?? ''}.`,
                ['stage_wechsel'],
                (l) =>
                  patch(l, {
                    stage: 'beendet',
                    ended_reason: (g as BeendenGrund).reason,
                    ended_note: g?.notizPflicht ? notiz.trim() : (g?.note ?? null),
                  }),
              ),
          },
          kinder: (
            <>
              <FormField label="Grund" htmlFor="bulk-beenden">
                <Select
                  id="bulk-beenden"
                  value={wert}
                  platzhalter="Wählen"
                  onChange={(e) => setWert(e.target.value)}
                  optionen={gruende.map((x) => ({ value: x.key, label: x.label }))}
                />
              </FormField>
              {g?.notizPflicht ? (
                <FormField label="Notiz (Pflicht)" pflicht htmlFor="bulk-beenden-notiz">
                  <Textarea id="bulk-beenden-notiz" value={notiz} onChange={(e) => setNotiz(e.target.value)} />
                </FormField>
              ) : null}
            </>
          ),
        }
      }
      case 'papierkorb':
        return {
          titel: 'In Papierkorb',
          text: `${n} ${n === 1 ? 'Lead' : 'Leads'} in den Papierkorb legen? Wiederherstellen ist 30 Tage lang unter Leads → Papierkorb möglich.`,
          primaer: {
            label: 'In Papierkorb',
            onClick: () =>
              void stapel(
                (ok) => `${leads(ok)} in den Papierkorb gelegt.`,
                null,
                (l) => loeschen.mutateAsync(l.id),
              ),
          },
          kinder: null,
        }
      default:
        return null
    }
  }
  const d = dialogInhalt()

  return (
    <>
      <div
        role="toolbar"
        aria-label="Bulk-Aktionen"
        className="bg-surface-raised shadow-float fixed bottom-6 left-1/2 z-30 flex h-12 -translate-x-1/2 items-center gap-1.5 rounded-md py-0 pr-2.5 pl-4 text-[13.5px] max-md:bottom-[calc(var(--spacing-tabbar)+12px)] max-md:max-w-[calc(100vw-24px)] max-md:overflow-auto"
        data-bulk
      >
        <span className="tnum mr-2 font-mono whitespace-nowrap">{n} ausgewählt</span>
        <Button variante="secondary" groesse="S" onClick={() => oeffne('zustaendig')}>
          Zuständig
        </Button>
        <Button variante="secondary" groesse="S" onClick={() => oeffne('wiedervorlage')}>
          Später
        </Button>
        <Button variante="secondary" groesse="S" onClick={() => oeffne('sequenz')}>
          Sequenz starten
        </Button>
        <Button variante="secondary" groesse="S" onClick={() => oeffne('beenden')}>
          Beenden …
        </Button>
        <Popover
          offen={menuOffen}
          onOpenChange={onMenuOffen}
          side="top"
          align="end"
          titel={`${n} ausgewählt`}
          trigger={
            <Button variante="quiet" groesse="S" kbd="⌥B" aria-haspopup="menu" aria-expanded={menuOffen}>
              Mehr
            </Button>
          }
        >
          <div role="menu" aria-label="Bulk-Menü">
            <PopoverEintrag role="menuitem" onClick={() => oeffne('zustaendig')}>
              Zuständig ändern
            </PopoverEintrag>
            <PopoverEintrag role="menuitem" onClick={() => oeffne('uebergeben')}>
              Übergeben (mit Notiz)
            </PopoverEintrag>
            <PopoverEintrag role="menuitem" onClick={() => oeffne('freigeben')}>
              Freigeben
            </PopoverEintrag>
            <PopoverEintrag role="menuitem" onClick={() => oeffne('phase')}>
              Phase setzen
            </PopoverEintrag>
            <PopoverEintrag role="menuitem" onClick={() => oeffne('wiedervorlage')}>
              Später / Wiedervorlage
            </PopoverEintrag>
            <PopoverEintrag role="menuitem" onClick={() => oeffne('sequenz')}>
              Sequenz starten
            </PopoverEintrag>
            <PopoverEintrag role="menuitem" onClick={() => oeffne('sequenzStop')}>
              Sequenz stoppen
            </PopoverEintrag>
            <PopoverEintrag role="menuitem" onClick={() => oeffne('tag')}>
              Tag hinzufügen
            </PopoverEintrag>
            <PopoverEintrag role="menuitem" onClick={() => oeffne('tagEntfernen')}>
              Tag entfernen
            </PopoverEintrag>
            <PopoverEintrag role="menuitem" onClick={() => oeffne('anrufgrund')}>
              Anrufgrund setzen
            </PopoverEintrag>
            <PopoverEintrag role="menuitem" onClick={zurAnrufliste}>
              Zur Anrufliste
            </PopoverEintrag>
            <PopoverEintrag role="menuitem" onClick={() => oeffne('beenden')}>
              Beenden (Grund)
            </PopoverEintrag>
            <PopoverEintrag role="menuitem" onClick={exportCsv}>
              Exportieren (CSV)
            </PopoverEintrag>
            <PopoverEintrag role="menuitem" disabled title={n === 2 ? 'Kommt in v1.1' : 'Nur bei genau 2 Leads · v1.1'}>
              Zusammenführen
            </PopoverEintrag>
            <PopoverEintrag role="menuitem" className="text-danger" onClick={() => oeffne('papierkorb')}>
              In Papierkorb
            </PopoverEintrag>
          </div>
        </Popover>
      </div>
      {d ? (
        <Dialog
          offen
          onOpenChange={(o) => {
            if (!o) setDialog(null)
          }}
          titel={d.titel}
          text={'text' in d ? d.text : undefined}
          kinder={d.kinder}
          primaer={{ ...d.primaer, busy: laeuft }}
        />
      ) : null}
    </>
  )
}
