// Gemeinsamer Kopf von Peek (LeadPanel) und Vollseite (LeadSeite), DESIGN-SYSTEM § 5.11 / ux § 3.3.1: Icon-Buttons LinkedIn ↗ `O` ·
// Anrufen `⌘⇧K` · E-Mail `⌥M` · Vollansicht `⌘↵`; Chips Kanal-Glyph · Phase (editierbar) · Schritt · Zuständig (editierbar) ·
// Sales-Verantwortlich · Tags · Badges (Freigegeben · Sperrliste · Firma gesperrt · Widerspruch · n T ohne Bewegung) · #kurzId.
import { ExternalLink, Mail, Phone } from 'lucide-react'
import { useNavigate } from 'react-router'
import { PFADE } from '@/app/pfade'
import { ZustaendigWaehlen } from '@/components/aktionen'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Chip, StatusChip } from '@/components/ui/Chip'
import { cn } from '@/components/ui/cn'
import { Popover, PopoverEintrag } from '@/components/ui/Popover'
import { useEmails } from '@/data/emails'
import { heuteBerlin } from '@/lib/format'
import { emailGate, hatSperrlistenTreffer, nachfassZaehler, type SperrlistenTreffer, telefonGate } from '@/lib/gates'
import { kurzId } from '@/lib/ids'
import { PHASEN, phaseVon } from '@/lib/stufen'
import { linkedinHref } from '@/lib/url'
import { emailGateText, GATE_GRUND_LABEL } from '@/texte/de'
import type { LeadMitBezug, Member, PhaseKey, Settings, Tag } from '@/types/domain'
import { ohneBewegungTage } from '@/features/pipeline/logik'
import { istFrei, schrittText } from './spalten'
import { anzeigeName } from '@/lib/mitglied'

export function KopfAktionen({
  lead,
  sperrliste,
  settings,
  vollansicht,
  className,
}: {
  lead: LeadMitBezug
  sperrliste?: SperrlistenTreffer
  settings?: Settings | null
  /** Button „Vollansicht ⌘↵“ zeigen (Peek) */
  vollansicht?: boolean
  className?: string
}) {
  const navigate = useNavigate()
  const { data: emails } = useEmails(lead.id)
  const href = linkedinHref(lead.linkedin_url)
  const tel = telefonGate(lead, sperrliste)
  const mail = emailGate(lead, nachfassZaehler(emails, lead), sperrliste, {
    maxNachfass: settings?.email.max_followups_per_consent,
    maxAlterMonate: settings?.email.consent_max_age_months,
  })
  const mailGrund = mail.grund ? emailGateText(mail.grund, lead.first_name) : undefined
  return (
    <div className={cn('flex items-center gap-1', className)} role="toolbar" aria-label="Lead-Aktionen">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="LinkedIn öffnen (O)"
          title="LinkedIn öffnen · O"
          className="text-ink-2 hover:bg-surface-hover hover:text-ink grid h-8 w-8 place-items-center rounded-sm"
        >
          <span className="glyph">in</span>
        </a>
      ) : (
        <Button
          variante="icon"
          icon={ExternalLink}
          aria-label="LinkedIn öffnen (O)"
          disabled
          disabledGrund="Keine Profil-URL"
        />
      )}
      <Button
        variante="icon"
        icon={Phone}
        aria-label="Anrufen (⌘⇧K)"
        title="Anrufen · ⌘⇧K"
        disabled={!tel.erlaubt}
        disabledGrund={tel.grund ? GATE_GRUND_LABEL[tel.grund] : undefined}
        onClick={() => navigate(PFADE.anruf(lead.id))}
      />
      <Button
        variante="icon"
        icon={Mail}
        aria-label="E-Mail (⌥M)"
        title="E-Mail verfassen · ⌥M"
        disabled={!mail.erlaubt}
        disabledGrund={mailGrund}
        onClick={() => navigate(`${PFADE.emailVerfassen}?lead=${encodeURIComponent(lead.id)}`)}
      />
      {vollansicht ? (
        <Button
          variante="icon"
          icon={ExternalLink}
          aria-label="Vollansicht (⌘↵)"
          title="Vollansicht · ⌘↵"
          onClick={() => navigate(PFADE.lead(lead.id))}
        />
      ) : null}
    </div>
  )
}

export function KopfChips({
  lead,
  members,
  settings,
  tags,
  sperrliste,
  onPhase,
  className,
}: {
  lead: LeadMitBezug
  members: readonly Member[]
  settings?: Settings | null
  tags?: readonly Tag[]
  sperrliste?: SperrlistenTreffer
  /** Phase per Klick (Pflichtdialoge regelt der Aufrufer) */
  onPhase: (ziel: PhaseKey) => void
  className?: string
}) {
  const heute = heuteBerlin()
  const owner = istFrei(lead) ? null : (members.find((m) => m.id === lead.owner_id) ?? null)
  const sales =
    lead.sales_owner_id && lead.sales_owner_id !== lead.owner_id
      ? (members.find((m) => m.id === lead.sales_owner_id) ?? null)
      : null
  const ohne = ohneBewegungTage(lead, heute, settings?.feiertage)
  const schritt = schrittText(lead)
  const leadTags = new Set((lead.lead_tags ?? []).map((t) => t.tag_id))
  const phase = phaseVon(lead.stage)
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {lead.linkedin_url ? <span className="glyph text-ink">in</span> : null}
      <Popover
        titel="Phase ändern"
        trigger={
          <StatusChip stage={lead.stage} settings={settings} interaktiv aria-label={`Phase: ${phase.label} – ändern`} />
        }
      >
        <div role="menu" aria-label="Phase">
          {PHASEN.map((p) => (
            <PopoverEintrag key={p.key} role="menuitem" aktiv={p.key === phase.key} onClick={() => onPhase(p.key)}>
              {p.label}
            </PopoverEintrag>
          ))}
        </div>
      </Popover>
      {schritt !== '–' ? <Chip ton="muted">{schritt}</Chip> : null}
      <Popover
        titel="Zuständig"
        trigger={
          <button
            type="button"
            aria-label={`Zuständig: ${owner ? (anzeigeName(owner)) : 'Frei'} – ändern`}
            className="rounded-full"
          >
            <Avatar member={owner} zweiter={sales} />
          </button>
        }
      >
        <div className="p-1.5">
          <ZustaendigWaehlen leadId={lead.id} lead={lead} autoFocus />
        </div>
      </Popover>
      {(tags ?? [])
        .filter((t) => leadTags.has(t.id))
        .map((t) => (
          <Chip key={t.id} ton="muted">
            {t.name}
          </Chip>
        ))}
      {lead.released ? <Chip ton="muted">Freigegeben</Chip> : null}
      {hatSperrlistenTreffer(sperrliste) ? <Chip ton="danger">Sperrliste</Chip> : null}
      {lead.companies?.do_not_contact ? <Chip ton="danger">Firma gesperrt</Chip> : null}
      {lead.do_not_contact ? <Chip ton="danger">Widerspruch</Chip> : null}
      {ohne !== null ? <Chip ton="muted">{ohne} T ohne Bewegung</Chip> : null}
      <span className="mono-sm text-ink-3">#{kurzId(lead.id)}</span>
    </div>
  )
}
