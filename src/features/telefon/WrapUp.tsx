// M3 – Wrap-up-Zeile (BAUPLAN § 3.4 WrapUp.tsx, ux § 2.5 Schritt 3): Folgeaktion vorbelegt (Datum/Uhrzeit editierbar),
// Gesprächspartner (Gruppe C Pflicht), Pflichtfelder je Ergebnis (5 Zentrale · 7 Datum/Uhrzeit · 9 Termin · 0 Zitat + Rückruf ·
// W Datum · K/Q Grund · D Dialog Widerspruch), „Weiter ↵“, „Weiter ohne Wrap-up ⌘↵“.
// `9`: BAUPLAN nennt den Termin-Dialog; `log_call` legt das Meeting selbst aus `p_meeting_at` an – ein zweiter Dialog würde ein
// zweites Meeting erzeugen → Datum/Uhrzeit inline, keine `TerminEintragen`-Komponente (BAUPLAN-intern: § 3.4 Tabelle vor Dateiliste).
import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { DatePicker } from '@/components/ui/DatePicker'
import { Dialog } from '@/components/ui/Dialog'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { ErlaubnisErfassen } from '@/features/email/public'
import { heuteBerlin } from '@/lib/format'
import { DIALOG, GRUND_LABEL } from '@/texte/de'
import type { Channel, EndedReason, ReachedPerson } from '@/types/domain'
import { ScopeFormular } from '@/components/ui/ScopeFormular'
import { PFLICHT_LABEL, type ErgebnisDef, type PflichtFeld, type WrapUpWerte } from './ergebnisse'

const PARTNER: { value: ReachedPerson; label: string }[] = [
  { value: 'entscheider', label: 'Entscheider' },
  { value: 'assistenz', label: 'Assistenz' },
  { value: 'sonstige', label: 'Sonstige' },
]

// Umfang als native Radiogruppe (Pfeiltasten); keine Ziffern-Kbds, weil das Zitat-Feld den Fokus hält und Ziffern dort Text sind.
const UMFANG: { key: string; label: string; kanaele: Channel[] }[] = [
  { key: 'telefon', label: 'nur Telefon', kanaele: ['telefon'] },
  { key: 'email', label: 'nur E-Mail', kanaele: ['email'] },
  { key: 'alle', label: 'alle Kanäle', kanaele: ['linkedin', 'telefon', 'email'] },
]

const GRUENDE_K: EndedReason[] = ['kein_interesse', 'kein_bedarf', 'sonstiges']
const GRUENDE_Q: EndedReason[] = ['nicht_icp', 'nicht_qualifiziert']

export type WrapUpProps = {
  leadId: string
  leadName: string
  def: ErgebnisDef
  werte: WrapUpWerte
  onChange: (w: WrapUpWerte) => void
  fehlt: PflichtFeld[]
  /** Fehler erst nach einem Speicherversuch zeigen */
  versucht: boolean
  folgeText: string
  onWeiter: () => void
  onWeiterOhne: () => void
  /** Widerspruch-Dialog geschlossen (Esc/Abbrechen): Ergebnis zurücknehmen, Anruf bleibt offen */
  onAbbrechen?: () => void
  busy?: boolean
  weiterDisabledGrund?: string
  gross?: boolean
  className?: string
}

export function WrapUp({
  leadId,
  leadName,
  def,
  werte,
  onChange,
  fehlt,
  versucht,
  folgeText,
  onWeiter,
  onWeiterOhne,
  onAbbrechen,
  busy,
  weiterDisabledGrund,
  gross,
  className,
}: WrapUpProps) {
  const setze = <K extends keyof WrapUpWerte>(k: K, v: WrapUpWerte[K]) => onChange({ ...werte, [k]: v })
  const fehler = (f: PflichtFeld) => (versucht && fehlt.includes(f) ? `${PFLICHT_LABEL[f]} ist Pflicht.` : undefined)
  const erstesFeld = useRef<HTMLInputElement | null>(null)
  const heute = heuteBerlin()
  const widerspruch = def.outcome === 'do_not_call'

  // 20-s-Fokus (ux § 2.5 Schritt 3): erstes Pflichtfeld bekommt den Fokus, Weiter bleibt per Enter erreichbar
  useEffect(() => {
    const t = window.setTimeout(() => erstesFeld.current?.focus(), 50)
    return () => window.clearTimeout(t)
  }, [def.taste])

  const gruppeC = def.gruppe === 'C' && !widerspruch

  return (
    <div
      className={cn('border-line grid gap-3 border-t pt-2.5', className)}
      role="group"
      aria-label="Wrap-up"
      data-ergebnis={def.taste}
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="label">Folgeaktion</span>
        <span className="text-small text-ink tnum font-mono" data-testid="folgeaktion">
          {folgeText}
        </span>
      </div>

      <div className={cn('grid gap-3', gross ? 'grid-cols-1' : 'grid-cols-[repeat(auto-fit,minmax(220px,1fr))]')}>
        {gruppeC ? (
          <>
            <FormField
              label="Gesprächspartner"
              pflicht
              htmlFor={`wu-name-${leadId}`}
              fehler={fehler('gespraechspartner')}
            >
              <Input
                id={`wu-name-${leadId}`}
                ref={erstesFeld}
                value={werte.reachedName}
                placeholder={leadName}
                onChange={(e) => setze('reachedName', e.target.value)}
              />
            </FormField>
            <FormField label="Rolle" htmlFor={`wu-rolle-${leadId}`}>
              <Input
                id={`wu-rolle-${leadId}`}
                value={werte.reachedRolle}
                onChange={(e) => setze('reachedRolle', e.target.value)}
              />
            </FormField>
            <FormField label="Erreicht" htmlFor={`wu-wer-${leadId}`}>
              <Select
                id={`wu-wer-${leadId}`}
                value={werte.reachedPerson ?? 'entscheider'}
                onChange={(e) => setze('reachedPerson', e.target.value as ReachedPerson)}
                optionen={PARTNER}
              />
            </FormField>
          </>
        ) : null}

        {def.outcome === 'gatekeeper' ? (
          <>
            <FormField label="Name Zentrale" pflicht htmlFor={`wu-zentrale-${leadId}`} fehler={fehler('zentrale')}>
              <Input
                id={`wu-zentrale-${leadId}`}
                ref={erstesFeld}
                value={werte.zentraleName}
                placeholder="Frau Behrens"
                onChange={(e) => setze('zentraleName', e.target.value)}
              />
            </FormField>
            <FormField label="Durchwahl" htmlFor={`wu-durchwahl-${leadId}`}>
              <Input
                id={`wu-durchwahl-${leadId}`}
                mono
                value={werte.zentraleDurchwahl}
                onChange={(e) => setze('zentraleDurchwahl', e.target.value)}
              />
            </FormField>
            <FormField
              label="Bester Zeitpunkt"
              htmlFor={`wu-zeit-${leadId}`}
              hinweis="Freitext, z. B. „morgens vor 11“"
            >
              <Input
                id={`wu-zeit-${leadId}`}
                value={werte.zentraleZeitpunkt}
                onChange={(e) => setze('zentraleZeitpunkt', e.target.value)}
              />
            </FormField>
            <FormField label="Rückruf" pflicht htmlFor={`wu-rueckruf-${leadId}`} fehler={fehler('callback_at')}>
              <DatePicker
                id={`wu-rueckruf-${leadId}`}
                wert={werte.callbackAt}
                onChange={(v) => setze('callbackAt', v)}
                mitUhrzeit
                min={heute}
                presets={['heute', 'morgen', '+3', '+7']}
                placeholder="Datum, Uhrzeit"
              />
            </FormField>
          </>
        ) : null}

        {def.outcome === 'gatekeeper_blocked' ? (
          <div className="col-span-full flex flex-wrap items-center gap-3">
            <span className="text-small text-ink-2">
              E-Mail nur mit Erlaubnis – wenn die Zentrale ausdrücklich darum bat, Erlaubnis mit Zitat erfassen.
            </span>
            <ErlaubnisErfassen
              leadId={leadId}
              trigger={
                <Button variante="secondary" groesse="S">
                  Erlaubnis erfassen
                </Button>
              }
            />
          </div>
        ) : null}

        {def.outcome === 'callback_scheduled' || def.outcome === 'send_info' ? (
          <FormField label="Rückruf" pflicht htmlFor={`wu-rueckruf-${leadId}`} fehler={fehler('callback_at')}>
            <DatePicker
              id={`wu-rueckruf-${leadId}`}
              wert={werte.callbackAt}
              onChange={(v) => setze('callbackAt', v)}
              mitUhrzeit
              min={heute}
              presets={['heute', 'morgen', '+3', '+7']}
              placeholder="Datum, Uhrzeit"
            />
          </FormField>
        ) : null}

        {def.outcome === 'meeting_booked' ? (
          <FormField label="Erstgespräch" pflicht htmlFor={`wu-termin-${leadId}`} fehler={fehler('meeting_at')}>
            <DatePicker
              id={`wu-termin-${leadId}`}
              wert={werte.meetingAt}
              onChange={(v) => setze('meetingAt', v)}
              mitUhrzeit
              min={heute}
              presets={['morgen', '+3', '+7']}
              placeholder="Datum, Uhrzeit"
            />
          </FormField>
        ) : null}

        {def.outcome === 'not_now' ? (
          <FormField
            label="Wiedervorlage"
            pflicht
            htmlFor={`wu-wv-${leadId}`}
            fehler={fehler('callback_at')}
            hinweis="+3 Monate vorbelegt"
          >
            <DatePicker
              id={`wu-wv-${leadId}`}
              wert={werte.callbackAt}
              onChange={(v) => setze('callbackAt', v)}
              min={heute}
              presets={['+1w', '+2m', '+3m']}
            />
          </FormField>
        ) : null}

        {def.outcome === 'send_info' ? (
          <FormField
            label="Zitat"
            pflicht
            htmlFor={`wu-zitat-${leadId}`}
            fehler={fehler('zitat')}
            hinweis="Erlaubnis „Am Telefon um Infos gebeten“ – wörtlich"
            className="col-span-full"
          >
            <Textarea
              id={`wu-zitat-${leadId}`}
              value={werte.zitat}
              placeholder="„Schicken Sie mir gern etwas per Mail.“"
              onChange={(e) => setze('zitat', e.target.value)}
            />
          </FormField>
        ) : null}

        {def.outcome === 'not_interested' || def.outcome === 'not_icp' ? (
          <FormField label="Grund" pflicht htmlFor={`wu-grund-${leadId}`} fehler={fehler('ended_reason')}>
            <Select
              id={`wu-grund-${leadId}`}
              value={werte.endedReason ?? ''}
              platzhalter="Grund wählen"
              onChange={(e) => setze('endedReason', (e.target.value || null) as EndedReason | null)}
              optionen={(def.outcome === 'not_icp' ? GRUENDE_Q : GRUENDE_K).map((g) => ({
                value: g,
                label: GRUND_LABEL[g],
              }))}
            />
          </FormField>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {widerspruch ? null : (
          <>
            <Button
              variante="quiet"
              kbd="⌘↵"
              onClick={onWeiterOhne}
              disabled={!!weiterDisabledGrund}
              disabledGrund={weiterDisabledGrund}
            >
              Weiter ohne Wrap-up
            </Button>
            <Button
              variante="primary"
              kbd="↵"
              busy={busy}
              onClick={onWeiter}
              disabled={!!weiterDisabledGrund}
              disabledGrund={weiterDisabledGrund}
            >
              Weiter
            </Button>
          </>
        )}
      </div>

      {widerspruch ? (
        <Dialog
          offen
          onOpenChange={(o) => {
            if (!o) onAbbrechen?.()
          }}
          titel={`Werbewiderspruch für ${leadName} erfassen?`}
          text={DIALOG.widerspruch(leadName).text}
          primaer={{
            label: DIALOG.widerspruch(leadName).primaer,
            onClick: onWeiter,
            danger: true,
            busy,
            disabled: !!weiterDisabledGrund,
          }}
          kinder={
            <>
              <ScopeFormular />
              <FormField label="Umfang">
                <div role="radiogroup" aria-label="Umfang" className="grid gap-0.5">
                  {UMFANG.map((u) => {
                    const aktiv = u.kanaele.join() === werte.widerspruchKanaele.join()
                    return (
                      <label
                        key={u.key}
                        className={cn(
                          'text-ui text-ink hover:bg-surface-hover flex h-9 cursor-pointer items-center gap-2.5 rounded-sm px-2.5',
                          aktiv && 'bg-surface-hover',
                        )}
                      >
                        <input
                          type="radio"
                          name={`widerspruch-${leadId}`}
                          value={u.key}
                          checked={aktiv}
                          onChange={() => setze('widerspruchKanaele', u.kanaele)}
                          className="checkbox"
                        />
                        <span className="flex-1">{u.label}</span>
                      </label>
                    )
                  })}
                </div>
              </FormField>
              <FormField label="Gesprächspartner" htmlFor={`wu-wname-${leadId}`}>
                <Input
                  id={`wu-wname-${leadId}`}
                  value={werte.reachedName}
                  placeholder={leadName}
                  onChange={(e) => setze('reachedName', e.target.value)}
                />
              </FormField>
              <FormField label="Zitat" pflicht htmlFor={`wu-wzitat-${leadId}`} fehler={fehler('zitat')}>
                <Textarea
                  id={`wu-wzitat-${leadId}`}
                  autoFocus
                  value={werte.zitat}
                  placeholder="Wortlaut des Widerspruchs"
                  onChange={(e) => setze('zitat', e.target.value)}
                  onSubmit={onWeiter}
                />
              </FormField>
            </>
          }
        />
      ) : null}
    </div>
  )
}
