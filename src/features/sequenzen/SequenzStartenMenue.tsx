// „Sequenz starten“ (BAUPLAN § 3.2 SequenzStartenMenue.tsx, § 5.1): DropdownMenu kanalgültiger Sequenzen → rpc.enroll (Keys aus den
// Daten, nie als Literal); inaktive (z. B. „A alt“) ausgegraut mit „in Einstellungen aktivieren“ (SE-02); läuft bereits eine Sequenz im
// Kanal: „Eine aktive Sequenz je Kanal – ‚…‘ läuft bereits (Schritt 3/6)“; bei firma_gesperrt gesamt gesperrt (kontaktGate).
// Kein Undo-Toast: `undo_activity` lehnt ein einzelnes `sequenz_gestartet` ab (BAUPLAN § 3.1.12 F-06) – Stoppen ist der Rückweg.
import { Play } from 'lucide-react'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { DropdownMenu, type MenuEintrag } from '@/components/ui/DropdownMenu'
import { useEnroll, useEnrollments } from '@/data/enrollments'
import { useLead } from '@/data/leads'
import { useSequencesIndex } from '@/data/sequences'
import { useSettings } from '@/data/settings'
import { fmtDatumKurz, heuteBerlin } from '@/lib/format'
import { emailSequenzStartbar, kontaktGate, sperrlistenEintraege } from '@/lib/gates'
import { GATE_GRUND_LABEL, KANAL_LABEL } from '@/texte/de'
import type { Channel, SequenceMitSchritten } from '@/types/domain'
import { useSperrliste } from '@/data/sperrliste'
import { naechsteFaelligkeit } from './planer'

export function SequenzStartenMenue({
  leadId,
  kanal,
  onGestartet,
}: {
  leadId: string
  kanal?: Channel
  onGestartet?: () => void
}) {
  const { data: lead } = useLead(leadId)
  const { data: enrollments } = useEnrollments(leadId)
  const { data: idx } = useSequencesIndex()
  const { data: settings } = useSettings()
  const enroll = useEnroll()

  const { data: sperrliste } = useSperrliste()
  // Sperrliste wie Kanal-Karten und Heute (Integration); kontaktGate prüft den Kanal LinkedIn der Treffer
  const gate = kontaktGate(lead ?? {}, lead ? sperrlistenEintraege(sperrliste, lead) : false)
  const gateGrund = gate.grund ? GATE_GRUND_LABEL[gate.grund] : undefined
  const laufend = (enrollments ?? []).filter((e) => e.status === 'aktiv' || e.status === 'pausiert')
  const sequenzen = (idx?.sequenzen ?? []).filter((s) => !kanal || s.channel === kanal)

  const starten = async (s: SequenceMitSchritten) => {
    if (enroll.isPending) return
    try {
      await enroll.mutateAsync({ leadId, sequenceKey: s.key })
    } catch {
      return
    }
    const erster = s.steps[0]
    const wann = erster
      ? fmtDatumKurz(
          naechsteFaelligkeit(heuteBerlin(), erster.delay_days, s.weekdays_only ?? true, settings?.feiertage),
        )
      : null
    toast(
      erster && wann ? `Sequenz ‚${s.name}‘ gestartet · ${erster.name} am ${wann}.` : `Sequenz ‚${s.name}‘ gestartet.`,
    )
    onGestartet?.()
  }

  const eintraege: (MenuEintrag | 'trenner')[] = sequenzen.map((s) => {
    const l = laufend.find((e) => e.channel === s.channel)
    const lSeq = l ? idx?.sequenzen.find((x) => x.id === l.sequence_id) : undefined
    const startbar = emailSequenzStartbar(s, lead)
    const hinweis = !s.active
      ? ' – in Einstellungen aktivieren'
      : !startbar.startbar
        ? ` – ${GATE_GRUND_LABEL[startbar.grund ?? 'keine_grundlage']}`
        : l
          ? ` – Eine aktive Sequenz je Kanal: ‚${lSeq?.name ?? 'Sequenz'}‘ läuft bereits (Schritt ${l.current_position}/${lSeq?.steps.length ?? 0})`
          : ''
    return {
      label: `${s.name} · ${KANAL_LABEL[s.channel]}${hinweis}`,
      disabled: !gate.erlaubt || !s.active || !startbar.startbar || !!l,
      onSelect: () => void starten(s),
    }
  })
  if (!eintraege.length) eintraege.push({ label: 'Keine Sequenz für diesen Kanal', disabled: true, onSelect: () => {} })

  return (
    <DropdownMenu
      titel={gate.erlaubt ? 'Sequenz starten · eine aktive je Kanal' : (gateGrund ?? 'Gesperrt')}
      eintraege={eintraege}
      trigger={
        <Button groesse="S" icon={Play} disabled={!gate.erlaubt} disabledGrund={gateGrund} busy={enroll.isPending}>
          Sequenz starten
        </Button>
      }
    />
  )
}
