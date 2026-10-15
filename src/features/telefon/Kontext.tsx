// M3 – Kontext-Spalte des Anruf-Screens (BAUPLAN § 3.4 Kontext.tsx, DESIGN-SYSTEM § 5.13): Name, Firma · Rolle · Ort,
// Website/LinkedIn ↗, Anrufgrund-Badge, Phase-Chip, Zuständig, Telefon-Historie (5), LinkedIn-Verlauf (3), gepinnte Notizen.
import { ExternalLink } from 'lucide-react'
import { useActivities } from '@/data/activities'
import { useCalls } from '@/data/calls'
import { useMembers } from '@/data/members'
import { useSettings } from '@/data/settings'
import { Avatar } from '@/components/ui/Avatar'
import { Chip, StatusChip } from '@/components/ui/Chip'
import { cn } from '@/components/ui/cn'
import { fmtDatumKurz, fmtDauer } from '@/lib/format'
import { ANRUFGRUND_LABEL, ERGEBNIS_LABEL, TIMELINE_TEXT } from '@/texte/de'
import type { CallOutcome, LeadMitBezug } from '@/types/domain'
import { ERGEBNISSE } from './ergebnisse'

const ROLLE: Record<string, string> = {
  geschaeftsfuehrer: 'Geschäftsführer',
  inhaber: 'Inhaber',
  kundenbetreuer: 'Kundenbetreuer',
  innendienst: 'Innendienst',
  vertrieb: 'Vertrieb',
  projektleiter: 'Projektleiter',
  sonstiges: 'Sonstiges',
  unbekannt: '',
}

function websiteAnzeige(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
}

function kurzErgebnis(outcome: CallOutcome): string {
  return ERGEBNISSE.find((e) => e.outcome === outcome)?.kurz ?? ERGEBNIS_LABEL[outcome]
}

export type KontextProps = {
  lead: LeadMitBezug
  versuch: number
  maxVersuche: number
  className?: string
  /** Mobil: `kopf` = Name, Links, Chips (direkt darunter Nummer + Anrufen), `rest` = Verlauf und Notizen (Runde 3, 390 px) */
  teil?: 'alles' | 'kopf' | 'rest'
}

export function Kontext({ lead, versuch, maxVersuche, className, teil = 'alles' }: KontextProps) {
  const { data: calls } = useCalls(lead.id, 5)
  const linkedin = useActivities(lead.id, { channel: 'linkedin' })
  const { data: settings } = useSettings()
  const { data: members } = useMembers()
  const zustaendig = members?.find((m) => m.id === lead.owner_id) ?? null
  const rolle = lead.role_title || ROLLE[lead.role ?? 'unbekannt'] || ''
  const zeile2 = [lead.company_name, rolle, lead.city].filter(Boolean).join(' · ')
  const verlauf = (linkedin.data?.pages.flat() ?? []).slice(0, 3)

  const kopf = (
    <>
      <div>
        <h2 className="lead-name">{lead.full_name ?? '–'}</h2>
        {zeile2 ? <p className="text-ink-2 mt-0.5 text-[13.5px]">{zeile2}</p> : null}
        <div className="text-ink-2 mt-2 flex gap-3 text-[12.5px]">
          {lead.website ? (
            <a className="link hover:text-ink" href={lead.website} target="_blank" rel="noreferrer">
              {websiteAnzeige(lead.website)}
            </a>
          ) : null}
          {lead.linkedin_url ? (
            <a
              className="link hover:text-ink inline-flex items-center gap-1"
              href={lead.linkedin_url}
              target="_blank"
              rel="noreferrer"
            >
              LinkedIn <ExternalLink size={14} strokeWidth={1.75} aria-hidden />
            </a>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {lead.call_basis ? (
          <Chip title={lead.call_basis_note ?? undefined}>
            Anrufgrund · {ANRUFGRUND_LABEL[lead.call_basis]}
            {lead.call_basis_note ? ` – ${lead.call_basis_note}` : ''}
          </Chip>
        ) : (
          <Chip ton="danger">Anrufgrund fehlt</Chip>
        )}
        {settings ? <StatusChip stage={lead.stage} settings={settings} /> : null}
        {lead.companies?.do_not_contact ? <Chip ton="danger">Firma gesperrt</Chip> : null}
        {zustaendig ? (
          <Avatar member={zustaendig} groesse={22} title={`Zuständig: ${zustaendig.display_name ?? ''}`} />
        ) : null}
      </div>
    </>
  )
  const rest = (
    <>
      <div>
        <span className="label mb-1.5 block">
          Telefon-Verlauf · Versuch {versuch} von {maxVersuche}
        </span>
        {calls?.length ? (
          <ul className="text-[12.5px]">
            {calls.map((c) => (
              <li key={c.id} className="border-line flex h-8 items-center gap-2.5 border-b">
                <span className="text-ink-3 w-[76px] flex-none font-mono text-[12px]">
                  {fmtDatumKurz(c.started_at)}
                </span>
                <Chip ton="muted">{kurzErgebnis(c.outcome)}</Chip>
                {c.reached_name ? <span className="text-ink-2 truncate-1 min-w-0">{c.reached_name}</span> : null}
                <span className="text-ink-3 tnum ml-auto font-mono text-[12px]">{fmtDauer(c.duration_sec ?? 0)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-small text-ink-3">Noch kein Anruf.</p>
        )}
      </div>

      <div>
        <span className="label mb-1.5 block">LinkedIn-Verlauf</span>
        {verlauf.length ? (
          <ol className="text-[12.5px]">
            {verlauf.map((a) => (
              <li key={a.id} className="flex items-start gap-2.5 py-1">
                <span className="text-ink-3 w-[76px] flex-none font-mono text-[12px]">
                  {fmtDatumKurz(a.occurred_at)}
                </span>
                <span className="text-ink-2 min-w-0">
                  {TIMELINE_TEXT(a, { datum: fmtDatumKurz })}
                  {a.member_id ? (
                    <Avatar
                      member={members?.find((m) => m.id === a.member_id) ?? null}
                      groesse={22}
                      className="ml-1.5 inline-grid align-middle"
                    />
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-small text-ink-3">Noch nichts passiert.</p>
        )}
      </div>

      {lead.notes ? (
        <div>
          <span className="label mb-1.5 block">Notizen · gepinnt</span>
          <p className="text-small text-ink-2 border-line-strong border-l pl-2.5 whitespace-pre-line">{lead.notes}</p>
        </div>
      ) : null}
    </>
  )

  if (teil === 'kopf') return <div className={cn('grid gap-[18px]', className)}>{kopf}</div>
  return (
    <aside aria-label="Kontext" className={className}>
      <div className="grid gap-[18px]">
        {teil === 'alles' ? kopf : null}
        {rest}
      </div>
    </aside>
  )
}
