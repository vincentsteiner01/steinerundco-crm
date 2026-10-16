// Eine Aufgabe auf der Auftragsseite. Bewusst ohne Tastenkürzel und ohne verschwindende Zeilen: Ein Browser-Agent liest Text
// und klickt beschriftete Knöpfe. Nach einer Aktion bleibt die Zeile stehen und zeigt, was passiert ist (+ Rückgängig).
import { useState } from 'react'
import { Check, Copy, ExternalLink, Undo2 } from 'lucide-react'
import { Button, Chip, cn, Textarea } from '@/components/ui'
import { toast } from '@/components/toast'
import { nachleseAktivitaet } from '@/data/activities'
import { lastUnlabeledReply } from '@/data/antworten'
import { useMarkAccepted } from '@/data/connections'
import { useCompleteStep } from '@/data/enrollments'
import { zeigeFehler } from '@/data/errors'
import { useLogOutbound } from '@/data/outbound'
import { rpc } from '@/data/rpc'
import { useSequencesIndex } from '@/data/sequences'
import { useCompleteTask } from '@/data/tasks'
import { undoActivityAusfuehren } from '@/data/undo'
import { fmtDatumKurz, fmtZeit, heuteBerlin } from '@/lib/format'
import { kopieren } from '@/lib/zwischenablage'
import type { QueueItem } from '@/types/domain'
import { SCHRITT_TYPEN } from '@/features/heute/daten/nachlese'
import { useKarteDaten } from '@/features/heute/useKarteDaten'
import { profilUrl, type AuftragArt } from './auftrag'

export type ZeilenStatus = {
  art: 'gesendet' | 'schon_gesendet' | 'geantwortet' | 'angenommen'
  text: string
  activityId: number | null
}

type ZeilenProps = {
  item: QueueItem
  nr: number
  gesamt: number
  status: ZeilenStatus | undefined
  setStatus: (s: ZeilenStatus | undefined) => void
}

const ART_LABEL: Record<AuftragArt, string> = {
  annahme: 'Annahme prüfen',
  opener: 'Opener senden',
  follow_up: 'Follow-up senden',
}

function Kopf({
  item,
  nr,
  gesamt,
  art,
  schritt,
}: {
  item: QueueItem
  nr: number
  gesamt: number
  art: AuftragArt
  schritt?: string | null
}) {
  const heute = heuteBerlin()
  const ueberfaellig = item.section === 'ueberfaellig'
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
      <span className="label">
        Aufgabe {nr} von {gesamt} · {ART_LABEL[art]}
        {schritt ? ` · ${schritt}` : ''}
      </span>
      {item.due_date && art !== 'annahme' ? (
        <Chip ton={ueberfaellig ? 'overdue' : 'today'}>
          {item.due_date === heute ? 'heute fällig' : `fällig seit ${fmtDatumKurz(item.due_date)}`}
        </Chip>
      ) : null}
    </div>
  )
}

function Person({ item }: { item: QueueItem }) {
  const url = profilUrl(item.linkedin_url)
  return (
    <div className="mt-2 grid gap-0.5">
      <div className="flex flex-wrap items-baseline gap-x-2.5">
        <span className="text-lead font-serif italic" data-auftrag-name>
          {item.lead_name ?? '–'}
        </span>
        <span className="text-ink-3 text-small">{item.company_name ?? 'ohne Firma'}</span>
      </div>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-ink-2 tnum inline-flex w-fit items-center gap-1.5 font-mono text-[12.5px] underline-offset-2 hover:underline"
          data-auftrag-linkedin
        >
          LinkedIn: {url}
          <ExternalLink size={12} strokeWidth={1.75} aria-hidden />
        </a>
      ) : (
        <span className="text-overdue text-small">Kein LinkedIn-Link im CRM – Aufgabe überspringen.</span>
      )}
    </div>
  )
}

function Erledigt({ status, onUndo }: { status: ZeilenStatus; onUndo: (() => void) | null }) {
  return (
    <div className="text-done mt-3 flex flex-wrap items-center gap-2.5 text-[13.5px]" role="status">
      <Check size={16} strokeWidth={2} aria-hidden />
      <span>{status.text}</span>
      {onUndo ? (
        <Button variante="quiet" groesse="S" icon={Undo2} onClick={onUndo}>
          Rückgängig
        </Button>
      ) : null}
    </div>
  )
}

function Rahmen({ fertig, children }: { fertig: boolean; children: React.ReactNode }) {
  return (
    <li
      className={cn(
        'border-line rounded-md border px-4 py-3.5 transition-colors',
        fertig ? 'bg-surface opacity-80' : 'bg-surface-raised',
      )}
      data-auftrag-zeile
      data-erledigt={fertig ? 'ja' : 'nein'}
    >
      {children}
    </li>
  )
}

/** „Annahme prüfen“: Anfrage im CRM gesendet, Annahme noch offen. */
export function AnnahmeZeile({ item, nr, gesamt, status, setStatus }: ZeilenProps) {
  const markAccepted = useMarkAccepted()
  const [laeuft, setLaeuft] = useState(false)

  const angenommen = async () => {
    if (!item.lead_id) return
    setLaeuft(true)
    try {
      await markAccepted.mutateAsync({ leadId: item.lead_id, memberId: item.member_id, date: heuteBerlin() })
      const a = await nachleseAktivitaet(item.lead_id, ['vernetzung_angenommen'])
      setStatus({
        art: 'angenommen',
        text: `Als angenommen eingetragen um ${fmtZeit(new Date())}. Der Opener erscheint nach „Liste aktualisieren“ unten.`,
        activityId: a?.id ?? null,
      })
    } catch (e) {
      zeigeFehler(e)
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <Rahmen fertig={!!status}>
      <Kopf item={item} nr={nr} gesamt={gesamt} art="annahme" />
      <Person item={item} />
      {status ? (
        <Erledigt status={status} onUndo={status.activityId ? () => void rueckgaengig(status, setStatus) : null} />
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variante="primary"
            groesse="M"
            busy={laeuft}
            onClick={() => void angenommen()}
            aria-label={`Angenommen: ${item.lead_name ?? ''}`}
          >
            Angenommen
          </Button>
        </div>
      )}
    </Rahmen>
  )
}

async function rueckgaengig(status: ZeilenStatus, setStatus: (s: ZeilenStatus | undefined) => void) {
  if (!status.activityId) return
  try {
    await undoActivityAusfuehren(status.activityId)
    setStatus(undefined)
    toast('Rückgängig gemacht.')
  } catch (e) {
    zeigeFehler(e)
  }
}

/** Opener oder Follow-up: fertiger Text aus derselben Logik wie „Heute“ (useKarteDaten), dann Gesendet / Hat geantwortet. */
export function NachrichtZeile({
  item,
  nr,
  gesamt,
  status,
  setStatus,
  art,
}: ZeilenProps & { art: 'opener' | 'follow_up' }) {
  const daten = useKarteDaten(item)
  const { data: idx } = useSequencesIndex()
  const completeStep = useCompleteStep()
  const completeTask = useCompleteTask()
  const logOutbound = useLogOutbound()
  const [laeuft, setLaeuft] = useState<null | 'gesendet' | 'schon' | 'antwort'>(null)
  const [antwortOffen, setAntwortOffen] = useState(false)
  const [antwortText, setAntwortText] = useState('')

  const schritt = item.step_id ? (idx?.stepsById.get(item.step_id)?.name ?? null) : (daten.vorlage?.name ?? null)
  const text = daten.ergebnis.text
  const anredeFehlt = daten.ergebnis.offen.includes('Anrede')
  const andereOffen = daten.ergebnis.offen.filter((o) => o !== 'Anrede')
  const gesperrtGrund = !item.linkedin_url
    ? 'Kein LinkedIn-Link'
    : !daten.vorlage
      ? 'Keine Vorlage'
      : anredeFehlt
        ? 'Erst Anrede wählen'
        : andereOffen.length
          ? `Platzhalter offen: ${andereOffen.join(', ')}`
          : null

  const gesendet = async (schonVorher: boolean) => {
    if (!item.lead_id) return
    setLaeuft(schonVorher ? 'schon' : 'gesendet')
    const notiz = schonVorher ? 'War schon gesendet – per Auftragsseite bestätigt' : null
    try {
      let folgeText = ''
      if (item.item_kind === 'sequenz_schritt' && item.enrollment_id) {
        const templateId = daten.vorlage && daten.vorlage.id !== item.template_id ? daten.vorlage.id : null
        const e = await completeStep.mutateAsync({
          enrollmentId: item.enrollment_id,
          leadId: item.lead_id,
          outcome: 'gesendet',
          templateId,
          note: notiz,
        })
        const naechster =
          e.status === 'abgeschlossen' ? null : (idx?.stepsById.get(e.current_step_id ?? '')?.name ?? null)
        folgeText =
          naechster && e.next_due_at
            ? ` Nächster Schritt: ${naechster} am ${fmtDatumKurz(e.next_due_at)}.`
            : ' Sequenz abgeschlossen.'
      } else if (item.task_id) {
        // Sheet-Wiedervorlage: Nachricht protokollieren (zählt in KPIs), dann Aufgabe schließen
        await logOutbound.mutateAsync({
          leadId: item.lead_id,
          channel: 'linkedin',
          templateId: daten.vorlage?.id ?? null,
          kind: 'nachricht',
          note: notiz,
        })
        await completeTask.mutateAsync({ taskId: item.task_id, leadId: item.lead_id })
      }
      const a = await nachleseAktivitaet(item.lead_id, SCHRITT_TYPEN)
      setStatus({
        art: schonVorher ? 'schon_gesendet' : 'gesendet',
        text: `${schonVorher ? 'Als schon gesendet eingetragen' : 'Gesendet eingetragen'} um ${fmtZeit(new Date())}.${folgeText}`,
        activityId: a?.id ?? null,
      })
    } catch (e) {
      zeigeFehler(e)
    } finally {
      setLaeuft(null)
    }
  }

  const antwortEintragen = async () => {
    if (!item.lead_id) return
    setLaeuft('antwort')
    try {
      const schonDa = await lastUnlabeledReply(item.lead_id, 'linkedin')
      if (schonDa) {
        setStatus({
          art: 'geantwortet',
          text: 'Die Antwort war schon im CRM (aus Gmail). Vincent sieht sie in Heute unter „Antworten“.',
          activityId: null,
        })
      } else {
        const id = await rpc.logReply({
          leadId: item.lead_id,
          channel: 'linkedin',
          label: null,
          note: antwortText.trim() || null,
        })
        setStatus({
          art: 'geantwortet',
          text: `Antwort eingetragen um ${fmtZeit(new Date())}. Die Sequenz stoppt, Vincent antwortet selbst.`,
          activityId: id,
        })
      }
    } catch (e) {
      zeigeFehler(e)
    } finally {
      setLaeuft(null)
    }
  }

  const textKopieren = async () => {
    if (gesperrtGrund) return toast(`${gesperrtGrund}.`)
    const r = await kopieren(text)
    toast(r === 'ok' ? 'Text kopiert.' : 'Text markiert – ⌘C')
  }

  return (
    <Rahmen fertig={!!status}>
      <Kopf item={item} nr={nr} gesamt={gesamt} art={art} schritt={schritt} />
      <Person item={item} />
      {status ? (
        <Erledigt status={status} onUndo={status.activityId ? () => void rueckgaengig(status, setStatus) : null} />
      ) : (
        <>
          {anredeFehlt ? (
            <div className="mt-3 flex flex-wrap items-center gap-2" data-auftrag-anrede>
              <span className="text-overdue text-[13.5px]">Anrede fehlt:</span>
              <Button variante="secondary" groesse="S" onClick={() => daten.setzeAnrede('herr')}>
                Herr
              </Button>
              <Button variante="secondary" groesse="S" onClick={() => daten.setzeAnrede('frau')}>
                Frau
              </Button>
            </div>
          ) : null}
          <div className="mt-3 grid gap-1.5">
            <span className="label">Nachricht{daten.vorlage ? ` · Leitfaden ${daten.vorlage.name}` : ''}</span>
            <p
              className="bg-surface-hover border-line text-body max-w-[64ch] rounded-sm border px-3.5 py-3 whitespace-pre-wrap"
              data-auftrag-nachricht
            >
              {text || 'Keine Vorlage hinterlegt.'}
            </p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variante="secondary"
              groesse="M"
              icon={Copy}
              onClick={() => void textKopieren()}
              disabled={!!gesperrtGrund}
              disabledGrund={gesperrtGrund ?? undefined}
            >
              Text kopieren
            </Button>
            <Button
              variante="primary"
              groesse="M"
              busy={laeuft === 'gesendet'}
              disabled={!!gesperrtGrund || !!laeuft}
              disabledGrund={gesperrtGrund ?? undefined}
              onClick={() => void gesendet(false)}
              aria-label={`Gesendet: ${item.lead_name ?? ''}`}
            >
              Gesendet
            </Button>
            <Button
              variante="secondary"
              groesse="M"
              busy={laeuft === 'schon'}
              disabled={!!laeuft}
              onClick={() => void gesendet(true)}
            >
              War schon gesendet
            </Button>
            <Button
              variante="quiet"
              groesse="M"
              disabled={!!laeuft}
              onClick={() => setAntwortOffen((o) => !o)}
              aria-expanded={antwortOffen}
            >
              Hat geantwortet
            </Button>
          </div>
          {antwortOffen ? (
            <div className="mt-3 grid max-w-[64ch] gap-2">
              <label className="label" htmlFor={`antwort-${nr}`}>
                Letzte Nachricht der Person (optional)
              </label>
              <Textarea
                id={`antwort-${nr}`}
                value={antwortText}
                onChange={(e) => setAntwortText(e.target.value)}
                rows={3}
              />
              <div>
                <Button
                  variante="primary"
                  groesse="M"
                  busy={laeuft === 'antwort'}
                  onClick={() => void antwortEintragen()}
                >
                  Antwort eintragen
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </Rahmen>
  )
}
