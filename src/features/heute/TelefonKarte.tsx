// Telefon-Karte (BAUPLAN § 3.2 TelefonKarte.tsx, DESIGN-SYSTEM § 5.8): Kopf „RÜCKRUF · 10:30 · …“ / „VERSUCH 3 VON 5 · SLOT C“,
// Nummer (Mono, tel:), Anrufgrund-Chip, Skript als Stichpunkte (Einstieg V1/V2), Anrufen ↵ (→ /telefon/anruf/:id?zurueck=/heute),
// Später S, Notiz N, Schnell-Ergebnis 1 2 3 7 → ?ergebnis= (M3 speichert). Keine Telefon-Ergebnisse hier (Tabu).
import { Phone } from 'lucide-react'
import { useRef } from 'react'
import { NotizFeld, Spaeter } from '@/components/aktionen'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { fmtZeit } from '@/lib/format'
import { fmtTelefon } from '@/lib/telefon'
import { sperrlistenEintraege, telefonGate } from '@/lib/gates'
import { useHotkeys } from '@/lib/keyboard'
import { ANRUFGRUND_LABEL, GATE_GRUND_LABEL } from '@/texte/de'
import type { QueueItem } from '@/types/domain'
import { VORLAGE } from '@/lib/vorlagenKeys'
import { faelligVon, kartenLabel } from './karten'
import { useGateMelden } from './kartenStore'
import { KartenAktionen, KartenKopf, KartenRahmen, KartenSub, KartenWer } from './KartenTeile'
import { useHeuteKontext } from './kontext'
import { NachrichtBlock } from './NachrichtBlock'
import { nachKey } from './nachricht'
import type { VariantenProps } from './QueueKarte'
import { useKarteDaten } from './useKarteDaten'
import { useQueueAktionen } from './useQueueAktionen'
import { useLead } from '@/data/leads'
import { useTemplates } from '@/data/templates'
import { useIstTelefon } from '@/lib/useMediaQuery'
import { useSperrliste } from '@/data/sperrliste'

const SCHNELL: { taste: '1' | '2' | '3' | '7'; label: string }[] = [
  { taste: '1', label: 'Nicht erreicht' },
  { taste: '2', label: 'Besetzt' },
  { taste: '3', label: 'Mailbox' },
  { taste: '7', label: 'Rückruf' },
]

function skriptVorlage(
  templates: ReturnType<typeof useTemplates>['data'],
  item: QueueItem,
  callBasis: string | null | undefined,
) {
  const eigene = item.template_id ? (templates?.find((t) => t.id === item.template_id) ?? null) : null
  if (eigene) return eigene
  // „Einstieg V2“ nur, wenn der Anrufgrund nicht LinkedIn ist (ux § 3.5.2)
  const linkedin = !callBasis || callBasis.startsWith('linkedin')
  return nachKey(templates, linkedin ? VORLAGE.tel_einstieg_1 : VORLAGE.tel_einstieg_2)
}

export function TelefonKarte({ item, onAktion }: VariantenProps) {
  const h = useHeuteKontext()
  const a = useQueueAktionen()
  const { data: templates } = useTemplates()
  const vorlageKnopf = useRef<HTMLButtonElement | null>(null)
  const telefon = useIstTelefon()
  const { data: leadVorab } = useLead(item.lead_id)
  const vorlage = skriptVorlage(templates, item, leadVorab?.call_basis)
  const d = useKarteDaten(item, { vorlageVorgabe: vorlage })

  const leadId = item.lead_id ?? ''
  const { data: sperrliste } = useSperrliste()
  const gateLead = d.lead ?? { phone_e164: item.phone_e164, do_not_contact: item.do_not_contact ?? false }
  // Sperrliste wie Anrufliste/AnrufButton (Integration); telefonGate prüft den Kanal der Treffer
  const gate = telefonGate(gateLead, sperrlistenEintraege(sperrliste, { id: item.lead_id, ...gateLead }))
  const gateGrund = gate.grund ? GATE_GRUND_LABEL[gate.grund] : undefined
  useGateMelden(d.key, gate.erlaubt ? null : (gateGrund ?? 'Gesperrt'))
  const rueckruf = item.item_kind === 'rueckruf'
  const label =
    rueckruf && item.due_at
      ? `Rückruf · ${fmtZeit(item.due_at)}${item.subtitle ? ` · ${item.subtitle}` : ''}`
      : kartenLabel(item)
  const nummer = d.lead?.phone_e164 ?? item.phone_e164
  const anrufgrund = d.lead?.call_basis ? ANRUFGRUND_LABEL[d.lead.call_basis] : null

  const anrufen = () => {
    if (!gate.erlaubt) return
    a.anrufen(item)
    onAktion('anrufen')
  }

  // Schnell-Ergebnis nur mit offenem Gate (§ 8.2 Nr. 2) – sonst führte 1/2/3/7 in den Anruf-Screen eines gesperrten Leads (Review)
  const schnell = (t: '1' | '2' | '3' | '7') => {
    if (gate.erlaubt) a.schnellErgebnis(item, t)
  }
  useHotkeys(
    'karte',
    {
      '1': () => schnell('1'),
      '2': () => schnell('2'),
      '3': () => schnell('3'),
      '7': () => schnell('7'),
      'mod+shift+e': () => vorlageKnopf.current?.click(),
    },
    [item.lead_id, gate.erlaubt],
  )

  const sub = [d.lead?.role_title, d.lead?.city ?? undefined].filter((s): s is string => !!s)

  return (
    <KartenRahmen aktiv faellig={faelligVon(item, h.heute)} data-key={item.item_id ?? undefined}>
      <KartenKopf label={label} item={item} heute={h.heute} />
      <KartenWer item={item} owner={d.owner} salesOwner={d.salesOwner} />
      <KartenSub>
        {sub.length ? `${sub.join(' · ')} · ` : null}
        {nummer ? (
          <a href={`tel:${nummer}`} className="text-ink hover:text-ink-bright font-mono text-[12px]">
            {fmtTelefon(nummer)}
          </a>
        ) : (
          <span className="text-overdue">keine Nummer</span>
        )}
        {!rueckruf && item.subtitle ? ` · ${item.subtitle}` : null}
      </KartenSub>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {anrufgrund ? <Chip ton="neutral">Anrufgrund · {anrufgrund}</Chip> : <Chip ton="muted">Ohne Anrufgrund</Chip>}
        {(item.days_overdue ?? 0) >= 14 ? <Chip ton="overdue">lange überfällig</Chip> : null}
      </div>
      <NachrichtBlock
        itemKey={d.key}
        vorlage={d.vorlage}
        lead={d.fLead}
        ctx={d.ctx}
        ergebnis={d.ergebnis}
        zustand={d.zustand}
        kanal="telefon"
        phase="einstieg"
        vorlageRef={vorlageKnopf}
        skript
      />
      <KartenAktionen
        rechts={
          !telefon ? (
            <span className="flex items-center gap-1.5" role="group" aria-label="Schnell-Ergebnis">
              <span className="text-small text-ink-3">Schnell-Ergebnis</span>
              {SCHNELL.map((s) => (
                <Button
                  key={s.taste}
                  groesse="S"
                  disabled={!gate.erlaubt}
                  disabledGrund={gateGrund}
                  onClick={() => schnell(s.taste)}
                >
                  <kbd className="kbd">{s.taste}</kbd>
                  {s.label}
                </Button>
              ))}
            </span>
          ) : null
        }
      >
        <Button
          variante="primary"
          icon={Phone}
          kbd="↵"
          onClick={anrufen}
          disabled={!gate.erlaubt}
          disabledGrund={gateGrund}
        >
          Anrufen
        </Button>
        <Spaeter
          leadId={leadId}
          enrollmentId={item.enrollment_id}
          taskId={item.task_id}
          snoozeCount={item.snooze_count ?? undefined}
          faelligAm={item.due_at}
          aktiv
          onFertig={() => onAktion('spaeter')}
        />
        <NotizFeld
          leadId={leadId}
          aktiv
          kanal="telefon"
          trigger={
            <Button variante="quiet" groesse="S" kbd="N">
              Notiz
            </Button>
          }
          onFertig={() => onAktion('notiz')}
        />
      </KartenAktionen>
    </KartenRahmen>
  )
}
