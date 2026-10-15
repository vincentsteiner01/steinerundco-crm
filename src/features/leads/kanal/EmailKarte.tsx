// BAUPLAN § 3.3 `kanal/EmailKarte.tsx` (ux § 3.3.3, LD-04): Zustand-Chip, Felder, ErlaubnisBadge + ErlaubnisErfassen (M4 public),
// „E-Mail verfassen ⌥M“ (emailGate; Navigation /email/verfassen?lead=), „Widerspruch erfassen“ (aktionen/WiderspruchErfassen),
// SequenzStatus (M1 public). Keine E-Mail-Erstellung hier (Tabu).
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { PFADE } from '@/app/pfade'
import { WiderspruchErfassen } from '@/components/aktionen'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Input } from '@/components/ui/Input'
import { useEmails } from '@/data/emails'
import { useLeadUpdate } from '@/data/leads'
import { useSettings } from '@/data/settings'
import { ErlaubnisBadge, ErlaubnisErfassen } from '@/features/email/public'
import { SequenzStatus } from '@/features/sequenzen/public'
import { fmtDatum } from '@/lib/format'
import { emailGate, nachfassZaehler, type SperrlistenTreffer } from '@/lib/gates'
import { emailGateText } from '@/texte/de'
import type { LeadMitBezug, Settings } from '@/types/domain'
import { Akkordeon, KarteAktionen, KarteFeld, KarteFelder } from './_Akkordeon'
import { emailZustand } from './zustaende'

export function EmailKarte({
  lead,
  offen,
  onToggle,
  immerOffen,
  sperrliste,
  settings: settingsProp,
}: {
  lead: LeadMitBezug
  offen: boolean
  onToggle: () => void
  immerOffen?: boolean
  sperrliste?: SperrlistenTreffer
  settings?: Settings | null
}) {
  const navigate = useNavigate()
  const { data: settingsGeladen } = useSettings()
  const settings = settingsProp ?? settingsGeladen
  const { data: emails } = useEmails(lead.id)
  const update = useLeadUpdate()
  const [edit, setEdit] = useState(false)
  const [text, setText] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const nachfass = nachfassZaehler(emails, lead)
  const gate = emailGate(lead, nachfass, sperrliste, {
    maxNachfass: settings?.email.max_followups_per_consent,
    maxAlterMonate: settings?.email.consent_max_age_months,
  })
  const z = emailZustand(lead, gate)
  const max = settings?.email.max_followups_per_consent ?? 3
  const grund = gate.grund ? emailGateText(gate.grund, lead.first_name) : undefined

  const speichern = async () => {
    setEdit(false)
    const v = text.trim().toLowerCase()
    if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      setFehler('Keine gültige E-Mail-Adresse')
      return
    }
    setFehler(null)
    try {
      await update.mutateAsync({ id: lead.id, erwartetUpdatedAt: lead.updated_at, patch: { email: v || null } })
    } catch {
      /* Toast aus der Mutation */
    }
  }
  const sammel = lead.email ? /^(info|kontakt|office|mail|hallo|hello)@/i.test(lead.email) : false

  return (
    <Akkordeon
      kanal="email"
      titel="E-Mail"
      chip={<Chip ton={z.ton}>{z.label}</Chip>}
      offen={offen}
      onToggle={onToggle}
      immerOffen={immerOffen}
    >
      {!gate.erlaubt && gate.grund === 'keine_grundlage' ? <p className="text-small text-ink-2 mb-3">{grund}</p> : null}
      <KarteFelder>
        {edit ? (
          <div className="grid min-w-0 gap-[3px]">
            <span className="label">E-Mail-Adresse</span>
            <Input
              autoFocus
              aria-label="E-Mail-Adresse"
              mono
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void speichern()
                if (e.key === 'Escape') setEdit(false)
              }}
              onBlur={() => void speichern()}
            />
          </div>
        ) : (
          <div className="grid min-w-0 gap-[3px]">
            <span className="label">E-Mail-Adresse</span>
            <button
              type="button"
              aria-label="E-Mail-Adresse bearbeiten"
              onClick={() => {
                setText(lead.email ?? '')
                setEdit(true)
              }}
              className={`hover:border-line-strong tnum truncate border-b border-dashed border-transparent py-0.5 text-left font-mono text-[13px] ${lead.email ? 'text-ink-2' : 'text-ink-4'}`}
            >
              {lead.email ?? 'hinzufügen'}
            </button>
            {fehler ? <span className="text-small text-danger">{fehler}</span> : null}
            {sammel ? (
              <span className="text-small text-overdue">Sammeladresse – Erlaubnis muss von der Person kommen</span>
            ) : null}
          </div>
        )}
        <div className="grid min-w-0 gap-[3px]">
          <span className="label">Erlaubnis-Grundlage</span>
          <span className="flex flex-wrap items-center gap-1.5 py-0.5">
            <ErlaubnisBadge lead={lead} />
            {lead.email_consent_at ? (
              <span className="mono-sm text-ink-3">{fmtDatum(lead.email_consent_at)}</span>
            ) : null}
          </span>
          {lead.email_consent_note ? (
            <span className="text-small text-ink-3 truncate">‚{lead.email_consent_note}‘</span>
          ) : null}
        </div>
        <div className="grid min-w-0 gap-[3px]">
          <span className="label">Sequenz</span>
          <span className="py-0.5">
            <SequenzStatus leadId={lead.id} kanal="email" />
          </span>
        </div>
        <KarteFeld label="Nachfass-Zähler" mono wert={`${nachfass}/${max} unter dieser Erlaubnis`} />
        <KarteFeld
          label="Datenschutz-Info gesendet"
          mono
          wert={
            lead.privacy_notice_sent_at
              ? `${fmtDatum(lead.privacy_notice_sent_at)}${lead.privacy_notice_version ? ` (${lead.privacy_notice_version})` : ''}`
              : null
          }
          leer="noch nicht"
        />
        {lead.do_not_contact ? (
          <KarteFeld
            label="Widerspruch"
            warnung
            wert={`${lead.objection_at ? fmtDatum(lead.objection_at) : ''}${lead.objection_note ? ` · ‚${lead.objection_note}‘` : ''}`}
          />
        ) : null}
      </KarteFelder>
      <KarteAktionen>
        <ErlaubnisErfassen
          leadId={lead.id}
          trigger={
            <Button variante="secondary" groesse="S">
              Erlaubnis erfassen
            </Button>
          }
        />
        <Button
          variante="secondary"
          groesse="S"
          kbd="⌥M"
          disabled={!gate.erlaubt}
          disabledGrund={grund}
          onClick={() => navigate(`${PFADE.emailVerfassen}?lead=${encodeURIComponent(lead.id)}`)}
        >
          E-Mail verfassen
        </Button>
        {!lead.do_not_contact ? (
          <WiderspruchErfassen
            leadId={lead.id}
            umfang="email"
            trigger={
              <Button variante="quiet" groesse="S">
                Widerspruch erfassen
              </Button>
            }
          />
        ) : null}
      </KarteAktionen>
    </Akkordeon>
  )
}
