// Sequenz-Editor v1 (BAUPLAN § 3.2 SequenzEditor.tsx, SE-01): Tabelle Position · Name · Verzögerung (Input 72 px) · Kanal · Leitfaden
// (VorlageWaehlen, M6) · Vorschau „fällig am“ für einen Beispielstart heute (planer.vorschau) · „Sa/So → Montag“ (Switch, sequenzweit) ·
// Exit-Chips muted ohne ×. Speichern = useSequenceStepSave je geänderter Zeile; mobil nur Lesen („Am Desktop bearbeiten“, MO-08).
import { useMemo, useState } from 'react'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { cn } from '@/components/ui/cn'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { Switch } from '@/components/ui/Switch'
import { useSequences, useSequenceSave, useSequenceStepSave } from '@/data/sequences'
import { useSettings } from '@/data/settings'
import { useTemplates } from '@/data/templates'
import { useIstTelefon } from '@/lib/useMediaQuery'
import { VorlageWaehlen } from '@/features/leitfaeden/public'
import { fmtDatumKurz, heuteBerlin } from '@/lib/format'
import { useHotkeys } from '@/lib/keyboard'
import { KANAL_LABEL } from '@/texte/de'
import type { SequenceStep } from '@/types/domain'
import { vorschau } from './planer'

type Entwurf = Pick<SequenceStep, 'name' | 'delay_days' | 'template_id'>

export function SequenzEditor({ sequenceId }: { sequenceId: string }) {
  const { data: sequenzen, isPending } = useSequences()
  const { data: templates } = useTemplates()
  const { data: settings } = useSettings()
  const stepSave = useSequenceStepSave()
  const seqSave = useSequenceSave()
  const telefon = useIstTelefon()
  const seq = sequenzen?.find((s) => s.id === sequenceId)
  // Entwurf gehört zu genau einer Sequenz: wechselt `sequenceId`, gilt er nicht mehr (kein setState im Effekt)
  const [entwurfVon, setEntwurfVon] = useState<{ id: string; zeilen: Record<string, Entwurf> }>({
    id: sequenceId,
    zeilen: {},
  })
  const entwurf = useMemo(() => (entwurfVon.id === sequenceId ? entwurfVon.zeilen : {}), [entwurfVon, sequenceId])
  const setEntwurf = (f: (alt: Record<string, Entwurf>) => Record<string, Entwurf>) =>
    setEntwurfVon((v) => ({ id: sequenceId, zeilen: f(v.id === sequenceId ? v.zeilen : {}) }))

  const steps = useMemo(
    () =>
      (seq?.steps ?? []).map((s) => {
        const e = entwurf[s.id]
        return e ? { ...s, ...e } : s
      }),
    [seq, entwurf],
  )
  const heute = heuteBerlin()
  const termine = useMemo(
    () => (seq ? vorschau({ steps, weekdays_only: seq.weekdays_only }, heute, settings?.feiertage) : []),
    [seq, steps, heute, settings?.feiertage],
  )

  const geaendert = Object.keys(entwurf).length > 0
  const aendern = (id: string, patch: Partial<Entwurf>) => {
    const orig = seq?.steps.find((s) => s.id === id)
    if (!orig) return
    setEntwurf((alt) => {
      const basis: Entwurf = alt[id] ?? { name: orig.name, delay_days: orig.delay_days, template_id: orig.template_id }
      const neu = { ...basis, ...patch }
      const gleich =
        neu.name === orig.name && neu.delay_days === orig.delay_days && neu.template_id === orig.template_id
      const { [id]: _weg, ...rest } = alt
      void _weg
      return gleich ? rest : { ...rest, [id]: neu }
    })
  }
  const speichern = async () => {
    if (!seq || !geaendert || telefon || stepSave.isPending) return
    for (const [id, e] of Object.entries(entwurf)) {
      const orig = seq.steps.find((s) => s.id === id)
      if (!orig) continue
      try {
        await stepSave.mutateAsync({ ...orig, ...e })
      } catch {
        return
      }
    }
    setEntwurf(() => ({}))
    toast('Sequenz gespeichert.')
  }
  // ⌘↵ speichert (auch aus dem Verzögerungs-Feld heraus – ⌘Enter ist in Eingabefeldern erlaubt, lib/keyboard)
  useHotkeys('liste', { 'mod+enter': () => void speichern() }, [entwurf, seq, telefon, stepSave.isPending])

  if (isPending) return <Skeleton zeilen={4} />
  if (!seq) return <p className="text-small text-ink-3">Sequenz nicht gefunden.</p>

  const exits = [
    seq.stop_on_reply ? 'Antwort erhalten' : null,
    seq.stop_on_meeting ? 'Termin gebucht' : null,
    'Lead beendet',
    'Widerspruch',
  ].filter((s): s is string => !!s)

  return (
    <div className="grid gap-4" data-sequenz-editor>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-h2 text-ink-bright m-0">{seq.name}</h2>
        <Chip ton={seq.active ? 'neutral' : 'ended'}>{seq.active ? 'aktiv' : 'inaktiv'}</Chip>
        <Chip ton="muted">{KANAL_LABEL[seq.channel]}</Chip>
        <span className="text-ink-3 tnum font-mono text-[12px]">Version {seq.version}</span>
        <span className="flex-1" />
        <label className="text-small text-ink-2 flex items-center gap-2">
          Sa/So → Montag
          <Switch
            checked={seq.weekdays_only}
            disabled={telefon || seqSave.isPending}
            onCheckedChange={(an) => seqSave.mutate({ ...seq, weekdays_only: an })}
            label="Wochenenden und Feiertage auf den nächsten Werktag rollen"
          />
        </label>
      </div>
      {telefon ? <p className="text-small text-ink-3">Am Desktop bearbeiten.</p> : null}
      <div className="border-line overflow-x-auto rounded-md border">
        <table className="w-full border-collapse text-[14px]">
          <thead>
            <tr className="border-line text-ink-3 border-b text-left">
              <th className="label px-3 py-2 font-semibold">Pos.</th>
              <th className="label px-3 py-2 font-semibold">Name</th>
              <th className="label px-3 py-2 font-semibold">Verzögerung</th>
              <th className="label px-3 py-2 font-semibold">Kanal</th>
              <th className="label px-3 py-2 font-semibold">Leitfaden</th>
              <th className="label px-3 py-2 text-right font-semibold">Fällig am (Start heute)</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((s, i) => {
              const t = templates?.find((x) => x.id === s.template_id)
              return (
                <tr
                  key={s.id}
                  className={cn('border-line border-b last:border-b-0', entwurf[s.id] && 'bg-surface-hover')}
                >
                  <td className="tnum px-3 py-2 font-mono text-[12.5px]">{s.position}</td>
                  <td className="px-3 py-2">
                    <Input
                      aria-label={`Name Schritt ${s.position}`}
                      value={s.name}
                      disabled={telefon}
                      onChange={(e) => aendern(s.id, { name: e.target.value })}
                      className="min-w-[180px]"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-1.5">
                      <Input
                        aria-label={`Verzögerung Schritt ${s.position}`}
                        mono
                        inputMode="numeric"
                        value={String(s.delay_days)}
                        disabled={telefon}
                        rahmenClassName="w-[72px]"
                        className="text-right"
                        onChange={(e) => {
                          const n = Number.parseInt(e.target.value.replace(/[^\d]/g, ''), 10)
                          aendern(s.id, { delay_days: Number.isFinite(n) ? n : 0 })
                        }}
                      />
                      <span className="text-ink-3 text-[12.5px]">T</span>
                    </span>
                  </td>
                  <td className="text-ink-2 px-3 py-2">{KANAL_LABEL[s.channel ?? seq.channel]}</td>
                  <td className="px-3 py-2">
                    <VorlageWaehlen
                      kanal={s.channel ?? seq.channel}
                      aktuellId={s.template_id ?? undefined}
                      onSelect={(v) => aendern(s.id, { template_id: v.id })}
                      trigger={
                        <Button variante="quiet" groesse="S" disabled={telefon}>
                          {t?.name ?? (s.template_id ? '…' : 'Leitfaden wählen')}
                        </Button>
                      }
                    />
                  </td>
                  <td
                    className="tnum px-3 py-2 text-right font-mono text-[12.5px]"
                    data-vorschau={termine[i]?.faelligAm}
                  >
                    {termine[i] ? fmtDatumKurz(termine[i].faelligAm) : '–'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-small text-ink-3 mr-1">Endet bei:</span>
        {exits.map((x) => (
          <Chip key={x} ton="muted">
            {x}
          </Chip>
        ))}
        <span className="flex-1" />
        <Button
          variante="primary"
          kbd="⌘↵"
          disabled={!geaendert || telefon}
          busy={stepSave.isPending}
          onClick={() => void speichern()}
        >
          Speichern
        </Button>
      </div>
    </div>
  )
}
