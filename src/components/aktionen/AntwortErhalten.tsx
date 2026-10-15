// „Antwort erhalten“ `A` (BAUPLAN § 3.1.10b, ux § 2.3 Schritt 3 / § 2.4): Inline-Block mit Zitat, Datum (heute),
// Reaktions-Chips `1–9`; `⌘Enter` → rpc.logReply (ohne Auto-Park, § 1.5 Nr. 26); Toast mit Undo über die
// `nachricht_erhalten`-Aktivität (Rückgabe von log_reply). Chip 4 „Nein (mit Grund)“ ohne Zitat ist blockiert.
import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { cn } from '@/components/ui/cn'
import { DatePicker } from '@/components/ui/DatePicker'
import { FormField } from '@/components/ui/FormField'
import { Textarea } from '@/components/ui/Textarea'
import { mutationFehler } from '@/data/errors'
import { useLead } from '@/data/leads'
import { useAndere, useMeId } from '@/data/members'
import { rpc } from '@/data/rpc'
import { useTemplates } from '@/data/templates'
import { useUndo } from '@/data/undo'
import { heuteBerlin } from '@/lib/format'
import { tagZuDate } from '@/lib/zeit'
import { VORLAGE } from '@/lib/vorlagenKeys'
import { TOAST } from '@/texte/de'
import type { Channel } from '@/types/domain'
import {
  getrimmt,
  useAktionTaste,
  useLeadInvalidierung,
  useOffen,
  useTastenWaehrendOffen,
  type AktionProps,
} from './_gemeinsam'
import { AktionButton, ScopeFormular, TriggerHuelle } from './_Teile'
import { chipBlockiert, REAKTION_CHIPS, vorlageFuerChip, ZITAT_PFLICHT_TEXT, type ReaktionChip } from './reaktionen'

export type AntwortErhaltenProps = AktionProps & {
  /** Kanal der Antwort (Standard LinkedIn; E-Mail-Antwort → `email_erhalten`). */
  kanal?: Channel
  /** Nach dem Speichern: vorgeschlagene Vorlage (Key) – z. B. für die Antworten-Karte. */
  onVorschlag?: (vorlageKey: string | null) => void
}

export function AntwortErhalten({
  leadId,
  trigger,
  offen: offenProp,
  onOpenChange,
  onFertig,
  aktiv,
  kanal = 'linkedin',
  onVorschlag,
  className,
}: AntwortErhaltenProps) {
  const [offen, setOffen] = useOffen(offenProp, onOpenChange)
  const [zitat, setZitat] = useState('')
  const [datum, setDatum] = useState<string | null>(null)
  const [chip, setChip] = useState<ReaktionChip | null>(null)
  // Fokus auf den Block (nicht ins Zitat): so wirken `1–9` und ⌘Enter sofort, Tab führt ins Zitat
  const block = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (offen) block.current?.focus()
  }, [offen])
  const heute = heuteBerlin()
  const tag = datum ?? heute

  const { data: lead } = useLead(leadId)
  const me = useMeId()
  const andere = useAndere()
  const { data: vorlagen } = useTemplates()
  const { anbieten } = useUndo()
  const inval = useLeadInvalidierung()

  const blockiert = chipBlockiert(chip, zitat)
  const fremd = !!lead?.owner_id && !!me && lead.owner_id !== me

  const zuruecksetzen = () => {
    setZitat('')
    setDatum(null)
    setChip(null)
  }

  const speichern = useMutation({
    mutationFn: (c: ReaktionChip) =>
      rpc.logReply({
        leadId,
        channel: kanal,
        label: c.reply,
        note: getrimmt(zitat),
        occurredAt: tag === heute ? undefined : tagZuDate(tag, '09:00').toISOString(),
      }),
    onError: mutationFehler,
    onSuccess: (activityId, c) => {
      inval(leadId)
      const key = vorlageFuerChip(c)
      const name = key ? (vorlagen?.find((t) => t.key === VORLAGE[key])?.name ?? VORLAGE[key]) : null
      const text = name ? TOAST.antwortErhalten(name) : 'Antwort erhalten – Lead beendet · Nicht ICP.'
      if (typeof activityId === 'number') anbieten(activityId, text, leadId)
      else toast(text)
      onVorschlag?.(key ? VORLAGE[key] : null)
      zuruecksetzen()
      setOffen(false)
      onFertig?.()
    },
  })

  const absenden = () => {
    if (!chip || blockiert || speichern.isPending) return
    speichern.mutate(chip)
  }

  useAktionTaste('a', trigger === undefined && !!aktiv, () => setOffen(true))
  useTastenWaehrendOffen(offen, (b) => {
    const c = REAKTION_CHIPS.find((x) => x.kbd === b)
    if (c) {
      setChip(c)
      return true
    }
    if (b === 'mod+enter') {
      absenden()
      return true
    }
    if (b === 'escape') {
      setOffen(false)
      return true
    }
    return undefined
  })

  const ausloeser =
    trigger === undefined ? (
      <AktionButton kbd="A" onClick={() => setOffen(!offen)} aria-expanded={offen}>
        Antwort
      </AktionButton>
    ) : (
      <TriggerHuelle onClick={() => setOffen(true)}>{trigger}</TriggerHuelle>
    )

  return (
    <div className={cn('grid gap-2.5', className)}>
      {ausloeser}
      {offen ? (
        <div
          ref={block}
          tabIndex={-1}
          role="group"
          aria-label="Antwort erhalten"
          className="border-line bg-surface-hover grid gap-3 rounded-sm border p-3 outline-none"
        >
          <ScopeFormular />
          <FormField
            label="Zitat"
            fehler={blockiert ? ZITAT_PFLICHT_TEXT : undefined}
            htmlFor={`antwort-zitat-${leadId}`}
          >
            <Textarea
              id={`antwort-zitat-${leadId}`}
              value={zitat}
              placeholder="Was hat die Person geschrieben?"
              onChange={(e) => setZitat(e.target.value)}
              fehler={blockiert ? ZITAT_PFLICHT_TEXT : undefined}
              onSubmit={absenden}
            />
          </FormField>
          <FormField label="Datum" htmlFor={`antwort-datum-${leadId}`}>
            <DatePicker id={`antwort-datum-${leadId}`} wert={tag} onChange={setDatum} presets={['heute', 'morgen']} />
          </FormField>
          <div className="grid gap-1.5">
            <span className="label">Reaktion</span>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Reaktion">
              {REAKTION_CHIPS.map((c) => (
                <Chip
                  key={c.kbd}
                  ton={chip?.kbd === c.kbd ? 'today' : 'neutral'}
                  onClick={() => setChip(c)}
                  aria-pressed={chip?.kbd === c.kbd}
                  className="h-7 gap-2 px-2.5"
                >
                  <kbd className="kbd">{c.kbd}</kbd>
                  {c.label}
                </Chip>
              ))}
            </div>
          </div>
          {fremd ? (
            <p className="text-small text-overdue">
              Zuständig ist {andere?.short_name ?? 'die andere Person'} – trotzdem loggen?
            </p>
          ) : null}
          <div className="flex items-center justify-end gap-1.5">
            <Button variante="quiet" groesse="S" kbd="Esc" onClick={() => setOffen(false)}>
              Abbrechen
            </Button>
            <Button
              variante="primary"
              groesse="S"
              kbd="⌘↵"
              onClick={absenden}
              busy={speichern.isPending}
              disabled={!chip || blockiert}
              disabledGrund={!chip ? TOAST.erstReaktion : ZITAT_PFLICHT_TEXT}
            >
              Speichern
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
