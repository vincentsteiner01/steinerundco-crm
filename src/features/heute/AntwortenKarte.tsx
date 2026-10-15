// Antworten-Karte (BAUPLAN § 3.2 AntwortenKarte.tsx, § 1.5 Nr. 25/26): item_kind antworten, enrollment_id null. Zitat, Label und
// Note der letzten nachricht_erhalten-Aktivität; vorgeschlagene Phase-2-Vorlage nach PHASE2_VORLAGE_NACH_LABEL; Aktionen
// C E P T S B – E/P schreiben über log_outbound (+ enroll C bzw. set_wiedervorlage), H-09/H-21/H-22.
import { ExternalLink } from 'lucide-react'
import { useRef, useState } from 'react'
import { Beenden, NotizFeld, TerminEintragen } from '@/components/aktionen'
import { Button } from '@/components/ui/Button'
import { useActivities } from '@/data/activities'
import { kontaktGate, sperrlistenEintraege } from '@/lib/gates'
import { useHotkeys } from '@/lib/keyboard'
import { phaseVon } from '@/lib/stufen'
import { GATE_GRUND_LABEL, reaktionLabel } from '@/texte/de'
import type { ReplyLabel } from '@/types/domain'
import { faelligVon } from './karten'
import { useGateMelden } from './kartenStore'
import { KartenAktionen, KartenFuss, KartenKopf, KartenRahmen, KartenSub, KartenWer, Reaktion } from './KartenTeile'
import { useHeuteKontext } from './kontext'
import { NachrichtBlock } from './NachrichtBlock'
import type { AntwortInfo } from './nachricht'
import type { VariantenProps } from './QueueKarte'
import { useKarteDaten } from './useKarteDaten'
import { useQueueAktionen } from './useQueueAktionen'
import { berlinTag, tageDifferenz } from '@/lib/zeit'
import { useSperrliste } from '@/data/sperrliste'

const PITCH_STUFEN = new Set(['dm_beantwortet', 'bedarfsermittlung', 'pitch'])

export function AntwortenKarte({ item, onAktion }: VariantenProps) {
  const h = useHeuteKontext()
  const a = useQueueAktionen()
  const { data: akt } = useActivities(item.lead_id, { types: ['nachricht_erhalten'] })
  const letzte = akt?.pages[0]?.[0] ?? null
  const antwort: AntwortInfo | null = letzte
    ? { label: (letzte.reply_label as ReplyLabel | null) ?? null, note: letzte.note, occurredAt: letzte.occurred_at }
    : null
  const d = useKarteDaten(item, { antwort })
  const vorlageKnopf = useRef<HTMLButtonElement | null>(null)
  const [kopiert, setKopiert] = useState(false)

  const leadId = item.lead_id ?? ''
  const { data: sperrliste } = useSperrliste()
  const gateLead = d.lead ?? { do_not_contact: item.do_not_contact ?? false }
  // Sperrliste wie Kanal-Karten (Integration); kontaktGate prüft den Kanal LinkedIn der Treffer
  const gate = kontaktGate(
    gateLead,
    sperrlistenEintraege(sperrliste, { id: item.lead_id, email: item.email, ...d.lead }),
  )
  const gateGrund = gate.grund ? GATE_GRUND_LABEL[gate.grund] : undefined
  useGateMelden(d.key, gate.erlaubt ? null : (gateGrund ?? 'Gesperrt'))
  const offen = d.ergebnis.offen
  const kopierenGrund = !gate.erlaubt ? gateGrund : offen.length ? `Erst ${offen[0]} eintragen` : undefined
  const kopierenAus = !gate.erlaubt || offen.length > 0 || !d.ergebnis.text.trim()
  const pitchMoeglich = !!item.stage && PITCH_STUFEN.has(item.stage)
  const seit = item.due_at ? tageDifferenz(berlinTag(item.due_at), h.heute) : 0
  const phase = item.stage ? phaseVon(item.stage).label : null
  const label = `Antwort offen · seit ${seit} T${phase ? ` · ${phase}` : ''}`

  const kopieren = async () => {
    if (await a.kopieren(item)) {
      setKopiert(true)
      window.setTimeout(() => setKopiert(false), 2000)
      onAktion('kopieren')
    }
  }
  const gesendet = () => {
    if (!gate.erlaubt) return
    void a.gesendet(item, { antwort })
    onAktion('gesendet')
  }
  const pitch = () => {
    if (!gate.erlaubt || !pitchMoeglich) return
    void a.pitch(item)
    onAktion('pitch')
  }
  const oeffnen = () => {
    a.profilOeffnen(item)
    onAktion('oeffnen')
  }

  useHotkeys('karte', { 'mod+shift+e': () => vorlageKnopf.current?.click() }, [])

  const sub = [d.lead?.role_title, d.lead?.city ?? undefined].filter((s): s is string => !!s)

  return (
    <KartenRahmen aktiv faellig={faelligVon(item, h.heute) ?? 'today'} data-key={item.item_id ?? undefined}>
      <KartenKopf label={label} item={item} heute={h.heute} />
      <KartenWer item={item} owner={d.owner} salesOwner={d.salesOwner} />
      {sub.length ? <KartenSub>{sub.join(' · ')}</KartenSub> : null}
      <Reaktion
        wann={antwort?.occurredAt}
        zitat={antwort?.note}
        label={antwort?.label ? reaktionLabel(antwort.label, !!antwort.note) : null}
      />
      <NachrichtBlock
        itemKey={d.key}
        vorlage={d.vorlage}
        lead={d.fLead}
        ctx={d.ctx}
        ergebnis={d.ergebnis}
        zustand={d.zustand}
        kanal="linkedin"
        phase={d.vorlage?.phase ?? 'bedarfsermittlung'}
        vorlageRef={vorlageKnopf}
        onAnrede={d.setzeAnrede}
      />
      <KartenAktionen
        rechts={
          <Button variante="quiet" groesse="S" kbd="O" icon={ExternalLink} onClick={oeffnen}>
            Profil öffnen
          </Button>
        }
      >
        <Button
          variante="primary"
          kbd="C"
          copied={kopiert}
          disabled={kopierenAus}
          disabledGrund={kopierenGrund}
          onClick={kopieren}
        >
          Kopieren
        </Button>
        {offen.length > 0 && gate.erlaubt ? (
          <span className="text-overdue text-[12.5px]">Erst {offen[0]} eintragen</span>
        ) : null}
        <Button kbd="E" onClick={gesendet} disabled={!gate.erlaubt} disabledGrund={gateGrund}>
          Gesendet
        </Button>
        <Button
          variante="quiet"
          groesse="S"
          kbd="P"
          onClick={pitch}
          disabled={!gate.erlaubt || !pitchMoeglich}
          disabledGrund={!gate.erlaubt ? gateGrund : 'Nur in Phase Beantwortet/Gepitcht'}
        >
          Pitch
        </Button>
        <TerminEintragen leadId={leadId} aktiv onFertig={() => onAktion('termin')} />
        {/* Sektion „Antworten“: Später nur +1 Tag (BAUPLAN § 3.2) – die Seite blendet die Karte bis morgen aus. */}
        <Button
          variante="quiet"
          groesse="S"
          kbd="S"
          onClick={() => onAktion('spaeter')}
          title="Morgen wieder hier (+1 Tag)"
        >
          Später
        </Button>
        <NotizFeld
          leadId={leadId}
          aktiv
          trigger={
            <Button variante="quiet" groesse="S" kbd="N">
              Notiz
            </Button>
          }
          onFertig={() => onAktion('notiz')}
        />
        <Beenden leadId={leadId} aktiv onFertig={() => onAktion('beenden')} />
      </KartenAktionen>
      <KartenFuss kopiertUm={d.zustand.kopiertUm} kanal="linkedin" />
    </KartenRahmen>
  )
}
