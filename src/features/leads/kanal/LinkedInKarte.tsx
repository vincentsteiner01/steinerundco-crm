// BAUPLAN § 3.3 `kanal/LinkedInKarte.tsx` (ux § 3.3.3): Zustand-Chip (Nicht angefragt · Angefragt seit n T · Angenommen · Zurückgezogen ·
// Abgelehnt · Abgelaufen · Kontakt entfernt), Felder, Aktionen „Anfrage gesendet“ (log_request) · „Angenommen“ (mark_accepted) ·
// „Antwort erhalten“ (A) · „Nachricht gesendet (ohne Sequenz)“ (log_outbound + VorlageWaehlen) · Sequenz pausieren/fortsetzen/stoppen ·
// „Kontakt entfernt“ (→ Freigeben). Alle Kontaktaktionen über lib/gates.kontaktGate gesperrt (Widerspruch, Sperrliste, Firmensperre).
import { Copy, ExternalLink } from 'lucide-react'
import { AntwortErhalten, Freigeben } from '@/components/aktionen'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { useLogRequest, useMarkAccepted } from '@/data/connections'
import { useEnrollmentFortsetzen, useEnrollmentPausieren, useEnrollmentStoppen } from '@/data/enrollments'
import { useLogOutbound } from '@/data/outbound'
import { useSequencesIndex } from '@/data/sequences'
import { useUndo } from '@/data/undo'
import { istEmailSequenzAktiv } from '@/features/email/public'
import { VorlageWaehlen } from '@/features/leitfaeden/public'
import { fmtDatum, fmtDatumKurz, heuteBerlin, relativ } from '@/lib/format'
import { kontaktGate, type SperrlistenTreffer } from '@/lib/gates'
import { kopieren } from '@/lib/zwischenablage'
import { linkedinAnzeige, linkedinHref } from '@/lib/url'
import { GATE_GRUND_LABEL, TOAST } from '@/texte/de'
import type { LeadMitBezug, Member } from '@/types/domain'
import { useLeadInvalidierungLokal } from './_invalidierung'
import { Akkordeon, KarteAktionen, KarteFeld, KarteFelder } from './_Akkordeon'
import { linkedinZustand } from './zustaende'
import { anzeigeName } from '@/lib/mitglied'

const VARIANTE: Record<string, string> = { ohne: 'ohne Notiz', note_v1: 'Notiz V1', note_v2: 'Notiz V2' }

export function LinkedInKarte({
  lead,
  members,
  offen,
  onToggle,
  immerOffen,
  sperrliste,
}: {
  lead: LeadMitBezug
  members: readonly Member[]
  offen: boolean
  onToggle: () => void
  immerOffen?: boolean
  sperrliste?: SperrlistenTreffer
}) {
  const heute = heuteBerlin()
  const z = linkedinZustand(lead, heute)
  const gate = kontaktGate(lead, sperrliste)
  const grund = gate.grund ? GATE_GRUND_LABEL[gate.grund] : undefined
  // § 8.4: bei Firmensperre bleiben Annahmen und Antworten loggen möglich – Historie ist kein Kontakt (Review)
  const historieGesperrt = !gate.erlaubt && gate.grund !== 'firma_gesperrt'
  const inval = useLeadInvalidierungLokal()
  const { anbieten } = useUndo()
  const logOutbound = useLogOutbound()
  const pausieren = useEnrollmentPausieren()
  const fortsetzen = useEnrollmentFortsetzen()
  const stoppen = useEnrollmentStoppen()
  const { data: seq } = useSequencesIndex()
  const logRequest = useLogRequest()
  const markAccepted = useMarkAccepted()
  const laeuft = logRequest.isPending || markAccepted.isPending
  // Parallel-Regel (ux § 3.6.4, M-08): läuft eine E-Mail-Sequenz, Chip „pausiert wegen E-Mail-Sequenz“ – v1 nur Anzeige
  const emailSequenz = istEmailSequenzAktiv(lead.enrollments)

  const name = (id: string | null | undefined) => {
    const m = id ? members.find((x) => x.id === id) : null
    return anzeigeName(m, '–')
  }
  const cs = [...(lead.linkedin_connections ?? [])].sort((a, b) =>
    (a.requested_at ?? a.created_at).localeCompare(b.requested_at ?? b.created_at),
  )
  const erste = cs[0]
  const zweite = cs.find((c) => c.member_id !== erste?.member_id)
  const angenommen = cs.find((c) => c.status === 'angenommen')
  const enrollment = (lead.enrollments ?? []).find(
    (e) => e.channel === 'linkedin' && (e.status === 'aktiv' || e.status === 'pausiert'),
  )
  const sequenz = enrollment ? seq?.sequenzen.find((s) => s.id === enrollment.sequence_id) : undefined
  const href = linkedinHref(lead.linkedin_url)

  // log_request / mark_accepted über die M0-Hooks (Integration: vorher direkte rpc-Aufrufe; Fehler-Toast kommt aus der Mutation)
  const anfrage = async () => {
    if (laeuft) return
    try {
      await logRequest.mutateAsync({ leadId: lead.id })
      inval(lead.id)
      toast('Anfrage gesendet.')
    } catch {
      /* Toast aus der Mutation */
    }
  }
  const annehmen = async () => {
    if (laeuft) return
    try {
      await markAccepted.mutateAsync({ leadId: lead.id })
      inval(lead.id)
      toast(TOAST.angenommen)
    } catch {
      /* Toast aus der Mutation */
    }
  }
  const nachricht = async (templateId: string, templateName: string) => {
    try {
      const id = await logOutbound.mutateAsync({ leadId: lead.id, channel: 'linkedin', templateId, kind: 'nachricht' })
      anbieten(id, `Nachricht gesendet · ${templateName}.`, lead.id)
    } catch {
      /* Toast aus der Mutation */
    }
  }

  const kopierenUrl = async () => {
    if (!lead.linkedin_url) return
    await kopieren(href ?? lead.linkedin_url)
    toast(TOAST.kopiert)
  }

  return (
    <Akkordeon
      kanal="linkedin"
      titel="LinkedIn"
      chip={
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <Chip ton={z.ton}>{z.label}</Chip>
          {emailSequenz ? <Chip ton="muted">pausiert wegen E-Mail-Sequenz</Chip> : null}
        </span>
      }
      offen={offen}
      onToggle={onToggle}
      immerOffen={immerOffen}
    >
      <KarteFelder>
        <KarteFeld
          label="Profil-URL"
          mono
          wert={
            lead.linkedin_url ? (
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="min-w-0 truncate" title={lead.linkedin_url}>
                  {linkedinAnzeige(lead.linkedin_url, 36)}
                </span>
                {/* Icons statt „kopieren“/„öffnen ↗“: in der Drittel-Spalte der Vollseite blieb sonst nur „in…“ von der URL übrig */}
                <button
                  type="button"
                  aria-label="Profil-URL kopieren"
                  title="Kopieren"
                  className="text-ink-3 hover:text-ink grid h-5 w-5 shrink-0 place-items-center"
                  onClick={() => void kopierenUrl()}
                >
                  <Copy size={13} strokeWidth={1.75} aria-hidden />
                </button>
                {href ? (
                  <a
                    aria-label="Profil öffnen"
                    title="Öffnen ↗"
                    className="text-ink-3 hover:text-ink grid h-5 w-5 shrink-0 place-items-center"
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink size={13} strokeWidth={1.75} aria-hidden />
                  </a>
                ) : null}
              </span>
            ) : null
          }
          leer="keine"
        />
        <KarteFeld
          label="Angefragt von"
          wert={
            erste ? `${name(erste.member_id)}${erste.requested_at ? ` · ${fmtDatum(erste.requested_at)}` : ''}` : null
          }
          leer="noch nicht"
        />
        {zweite ? (
          <KarteFeld
            label="Zweite Anfrage von"
            wert={
              <span className="inline-flex items-center gap-1.5">
                {name(zweite.member_id)}
                {zweite.requested_at ? ` · ${fmtDatum(zweite.requested_at)}` : ''}
                <Chip ton="muted">beide angefragt</Chip>
              </span>
            }
          />
        ) : null}
        <KarteFeld label="Notiz-Variante" wert={erste ? VARIANTE[erste.note_variant] : null} leer="–" />
        <KarteFeld
          label="Angenommen am"
          mono
          wert={angenommen?.accepted_at ? fmtDatum(angenommen.accepted_at) : null}
          leer="noch nicht"
        />
        <KarteFeld
          label="Gespräch eröffnet von"
          wert={lead.opened_by_id ? name(lead.opened_by_id) : null}
          leer="noch nicht"
        />
        <KarteFeld
          label="Antwort am"
          mono
          wert={lead.last_inbound_at ? fmtDatum(lead.last_inbound_at) : null}
          leer="keine"
        />
        <KarteFeld
          label="Sequenz"
          wert={
            enrollment && sequenz
              ? `${sequenz.name} · Version ${sequenz.version} · Schritt ${enrollment.current_position ?? 1}/${sequenz.steps.length}${enrollment.next_due_at ? ` · nächster ${fmtDatumKurz(enrollment.next_due_at)}` : ''}${enrollment.snooze_count ? ` · ${enrollment.snooze_count}× später` : ''}${enrollment.status === 'pausiert' ? ' · pausiert' : ''}`
              : null
          }
          leer="keine"
        />
        <KarteFeld label="Follow-ups gesendet" mono wert={String(lead.follow_up_count)} />
        {z.key === 'angefragt' && erste?.requested_at ? (
          <KarteFeld label="Offen seit" mono wert={relativ(erste.requested_at, heute)} />
        ) : null}
      </KarteFelder>
      <KarteAktionen>
        {z.key === 'nicht_angefragt' ||
        z.key === 'zurueckgezogen' ||
        z.key === 'abgelaufen' ||
        z.key === 'abgelehnt' ? (
          <Button
            variante="secondary"
            groesse="S"
            busy={laeuft}
            disabled={!gate.erlaubt || !lead.linkedin_url}
            disabledGrund={grund ?? (!lead.linkedin_url ? 'Keine Profil-URL' : undefined)}
            onClick={() => void anfrage()}
          >
            Anfrage gesendet
          </Button>
        ) : null}
        {z.key === 'angefragt' ? (
          <Button
            variante="secondary"
            groesse="S"
            busy={laeuft}
            disabled={historieGesperrt}
            disabledGrund={historieGesperrt ? grund : undefined}
            onClick={() => void annehmen()}
          >
            Angenommen
          </Button>
        ) : null}
        <AntwortErhalten
          leadId={lead.id}
          trigger={
            <Button
              variante="secondary"
              groesse="S"
              kbd="A"
              disabled={historieGesperrt}
              disabledGrund={historieGesperrt ? grund : undefined}
            >
              Antwort erhalten
            </Button>
          }
        />
        <VorlageWaehlen
          kanal="linkedin"
          onSelect={(t) => void nachricht(t.id, t.name)}
          trigger={
            <Button
              variante="quiet"
              groesse="S"
              disabled={!gate.erlaubt}
              disabledGrund={grund}
              busy={logOutbound.isPending}
            >
              Nachricht gesendet (ohne Sequenz)
            </Button>
          }
        />
        {enrollment?.status === 'aktiv' ? (
          <Button
            variante="quiet"
            groesse="S"
            busy={pausieren.isPending}
            onClick={() => pausieren.mutate({ enrollmentId: enrollment.id, leadId: lead.id })}
          >
            Sequenz pausieren
          </Button>
        ) : null}
        {enrollment?.status === 'pausiert' ? (
          <Button
            variante="quiet"
            groesse="S"
            busy={fortsetzen.isPending}
            onClick={() => fortsetzen.mutate({ enrollmentId: enrollment.id, leadId: lead.id })}
          >
            Sequenz fortsetzen
          </Button>
        ) : null}
        {enrollment ? (
          <Button
            variante="quiet"
            groesse="S"
            busy={stoppen.isPending}
            onClick={() => stoppen.mutate({ enrollmentId: enrollment.id, leadId: lead.id })}
          >
            Sequenz stoppen
          </Button>
        ) : null}
        <Freigeben
          leadId={lead.id}
          trigger={
            <Button variante="quiet" groesse="S">
              Kontakt entfernt
            </Button>
          }
        />
      </KarteAktionen>
    </Akkordeon>
  )
}
