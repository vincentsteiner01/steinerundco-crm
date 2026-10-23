// Schnellnotiz („Klopf-Notiz“, 23.10.2026 – Mike: „Nummer abtippen, mit dem Handy anrufen, direkt eine Notiz machen, ohne in
// der Akte zu wühlen“): große Nummer zum Abtippen, Ergebnis-Knöpfe (verbuchen den Anruf über log_call – zählt in den Sales-KPIs
// und legt Rückrufe an), Notiz, optional „Nächster Anruf am“, darunter die letzten Einträge. Endgültige Ergebnisse (Termin,
// kein Interesse) laufen weiter über den Anruf-Screen.
import { Copy, Phone } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { PFADE } from '@/app/pfade'
import { Fenster } from '@/components/Fenster'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { cn } from '@/components/ui/cn'
import { useNotizErstellen } from '@/data/activities'
import { useLogCall } from '@/data/calls'
import { useMeId } from '@/data/members'
import { qk } from '@/data/queryKeys'
import { useTaskErstellen } from '@/data/tasks'
import type { LetzterKontakt, TelefonLead } from '@/data/telefonAnsichten'
import { fmtDatumKurz, fmtZeit, heuteBerlin } from '@/lib/format'
import { fmtTelefon, NUMMER_TYP_LABEL, weitereNummern } from '@/lib/telefon'
import { istTag, tagZuDate } from '@/lib/zeit'
import { kopieren } from '@/lib/zwischenablage'
import type { CallOutcome } from '@/types/domain'
import { ERGEBNIS_KURZ, kontaktText, naechstesFollowUp, SCHNELL_ERGEBNISSE, TELEFON_TYP } from './ansichten/logik'

export function SchnellNotiz({
  lead,
  verlauf,
  onClose,
  onWeiter,
}: {
  lead: TelefonLead
  verlauf: readonly LetzterKontakt[]
  onClose: () => void
  /** „Speichern & nächster“ – öffnet die nächste Zeile der Liste */
  onWeiter?: () => void
}) {
  const me = useMeId()
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const logCall = useLogCall()
  const notiz = useNotizErstellen()
  const aufgabe = useTaskErstellen()
  const [ergebnis, setErgebnis] = useState<CallOutcome | null>(null)
  const [text, setText] = useState('')
  const [datum, setDatum] = useState('')
  const [zeit, setZeit] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const laeuft = logCall.isPending || notiz.isPending || aufgabe.isPending
  const weitere = weitereNummern(lead.phone_numbers)

  const akte = new URLSearchParams(params)
  akte.set('lead', lead.id)

  const speichern = async (weiter: boolean) => {
    const note = text.trim() || null
    if (!ergebnis && !note && !datum)
      return setFehler('Ergebnis wählen, Notiz schreiben oder nächsten Anruf eintragen.')
    if (datum && (!istTag(datum) || datum < heuteBerlin())) return setFehler('Nächster Anruf: heute oder später.')
    const wann = datum ? tagZuDate(datum, zeit || '09:00').toISOString() : null
    try {
      if (ergebnis) {
        const offen = naechstesFollowUp(lead)
        await logCall.mutateAsync({
          leadId: lead.id,
          outcome: ergebnis,
          note,
          callbackAt: wann,
          taskId: offen?.kind === 'rueckruf' ? offen.id : null,
        })
      } else {
        if (note) await notiz.mutateAsync({ leadId: lead.id, note })
        if (wann && me)
          await aufgabe.mutateAsync({
            lead_id: lead.id,
            member_id: me,
            created_by: me,
            kind: 'rueckruf',
            title: 'Rückruf',
            due_at: wann,
          })
      }
      void qc.invalidateQueries({ queryKey: qk.leads.telefon })
      toast(ergebnis ? `${ERGEBNIS_KURZ[ergebnis]} – eingetragen.` : 'Notiz gespeichert.')
      if (weiter && onWeiter) onWeiter()
      else onClose()
    } catch {
      // Toast kommt aus der Mutation (mutationFehler)
    }
  }

  return (
    <Fenster
      offen
      breit={620}
      onOpenChange={(o) => !o && onClose()}
      oberzeile={[lead.company_name, lead.city].filter(Boolean).join(' · ') || undefined}
      titel={lead.full_name ?? lead.company_name ?? 'Kontakt'}
      unterTitel={
        <div className="grid gap-1">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="tnum text-ink-bright font-mono text-[24px] leading-tight font-medium" data-nummer>
              {fmtTelefon(lead.phone_e164)}
            </span>
            <span className="text-ink-3 text-[13px]">{TELEFON_TYP[lead.phone_type ?? 'unbekannt']}</span>
            <Button
              variante="quiet"
              groesse="S"
              icon={Copy}
              onClick={() => void kopieren(lead.phone_e164 ?? '').then(() => toast('Nummer kopiert.'))}
            >
              Kopieren
            </Button>
          </span>
          {weitere.map((n) => (
            <span key={n.e164} className="text-ink-2 tnum font-mono text-[13px]">
              {fmtTelefon(n.e164)} <span className="text-ink-3 font-sans">{NUMMER_TYP_LABEL[n.typ]}</span>
            </span>
          ))}
        </div>
      }
      fuss={
        <>
          {fehler ? (
            <span className="text-small text-danger w-full" role="alert">
              {fehler}
            </span>
          ) : null}
          <Link
            to={{ search: akte.toString() }}
            onClick={onClose}
            className="text-small text-ink-3 hover:text-ink hover:underline"
          >
            Akte öffnen
          </Link>
          <Link
            to={PFADE.anruf(lead.id)}
            className="text-small text-ink-3 hover:text-ink inline-flex items-center gap-1 hover:underline"
          >
            <Phone size={13} strokeWidth={1.75} aria-hidden />
            Anruf-Screen
          </Link>
          <span className="ml-auto flex gap-2">
            {onWeiter ? (
              <Button variante="secondary" busy={laeuft} onClick={() => void speichern(true)}>
                Speichern &amp; nächster
              </Button>
            ) : null}
            <Button variante="primary" kbd="⌘↵" busy={laeuft} onClick={() => void speichern(false)}>
              Speichern
            </Button>
          </span>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <span className="label">Ergebnis des Anrufs (optional)</span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Ergebnis des Anrufs">
            {SCHNELL_ERGEBNISSE.map((o) => (
              <button
                key={o}
                type="button"
                aria-pressed={ergebnis === o}
                onClick={() => {
                  setFehler(null)
                  setErgebnis((x) => (x === o ? null : o))
                }}
                className={cn(
                  'text-ui h-8 rounded-full border px-3',
                  ergebnis === o
                    ? 'bg-signal border-transparent font-medium text-white'
                    : 'border-line-strong text-ink-2 hover:bg-surface-hover',
                )}
              >
                {ERGEBNIS_KURZ[o]}
              </button>
            ))}
          </div>
        </div>
        <FormField label="Notiz" htmlFor="schnellnotiz-text">
          <Textarea
            id="schnellnotiz-text"
            autoFocus
            value={text}
            onChange={(e) => {
              setFehler(null)
              setText(e.target.value)
            }}
            onSubmit={() => void speichern(false)}
            placeholder="Was ist passiert? z. B. Sekretariat: ab 14 Uhr erreichbar"
            className="min-h-[96px]"
          />
        </FormField>
        <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3">
          <FormField label="Nächster Anruf am (optional)" htmlFor="schnellnotiz-datum">
            <Input
              id="schnellnotiz-datum"
              type="date"
              min={heuteBerlin()}
              value={datum}
              onChange={(e) => {
                setFehler(null)
                setDatum(e.target.value)
              }}
            />
          </FormField>
          <FormField label="Uhrzeit" htmlFor="schnellnotiz-zeit">
            <Input id="schnellnotiz-zeit" type="time" value={zeit} onChange={(e) => setZeit(e.target.value)} />
          </FormField>
        </div>
        {verlauf.length ? (
          <div className="grid gap-1.5">
            <span className="label">Bisher</span>
            <ul className="grid gap-1.5">
              {verlauf.map((k, i) => (
                <li key={i} className="grid grid-cols-[92px_minmax(0,1fr)] gap-2 text-[13px]">
                  <span className="text-ink-3 tnum font-mono text-[12px]">
                    {fmtDatumKurz(k.zeit)} {fmtZeit(k.zeit)}
                  </span>
                  <span className="text-ink-2 line-clamp-3">{kontaktText(k)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Fenster>
  )
}
