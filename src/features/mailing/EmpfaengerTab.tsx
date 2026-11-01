// Empfänger einer Kampagne (01.11.2026): Stand je Lead, Gründe für Stopps, Leads mit E-Mail-Adresse auswählen. Die Erlaubnis-
// Grundlage steht bei jedem Lead dabei; ohne Grundlage wird beim Versand gestoppt (crm.mail_gate) – die Auswahl zeigt das vorher.
import { Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { PFADE } from '@/app/pfade'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Chip } from '@/components/ui/Chip'
import { cn } from '@/components/ui/cn'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import {
  type Empfaenger,
  type MailLead,
  useEmpfaengerEntfernen,
  useEmpfaengerHinzufuegen,
  useKampagnePruefen,
  useMailLeads,
} from '@/data/mailing'
import { ERLAUBNIS_KURZ } from '@/features/email/erlaubnis'
import { fmtDatumZeit } from '@/lib/format'
import type { EmailConsentBasis } from '@/types/domain'
import { EMPFAENGER_STATUS } from './logik'
import { Leer, Warum } from './Teile'

export function EmpfaengerTab({
  kampagneId,
  empfaenger,
  schritte,
  beendet,
}: {
  kampagneId: string
  empfaenger: Empfaenger[]
  schritte: number
  beendet: boolean
}) {
  const [waehlen, setWaehlen] = useState(false)
  const entfernen = useEmpfaengerEntfernen()
  const { data: gesperrt } = useKampagnePruefen(kampagneId)
  const sperre = useMemo(() => new Map((gesperrt ?? []).map((g) => [g.empfaenger_id, g.grund])), [gesperrt])
  const gruende = useMemo(() => {
    const m = new Map<string, number>()
    for (const g of gesperrt ?? []) m.set(g.grund, (m.get(g.grund) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [gesperrt])
  const zaehler = useMemo(() => {
    const m: Record<string, number> = {}
    for (const e of empfaenger) m[e.status] = (m[e.status] ?? 0) + 1
    return m
  }, [empfaenger])

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(EMPFAENGER_STATUS)
            .filter(([k]) => zaehler[k])
            .map(([k, s]) => (
              <Chip key={k} ton={s.ton}>
                {s.label} · {zaehler[k]}
              </Chip>
            ))}
        </div>
        {!beendet ? (
          <Button variante="primary" icon={Plus} onClick={() => setWaehlen(true)}>
            Leads hinzufügen
          </Button>
        ) : null}
      </div>
      {gruende.length ? (
        <div className="bg-overdue-tint text-small text-overdue rounded-sm px-3 py-2">
          Werden beim Versand übersprungen: {gruende.map(([g, n]) => `${n} × ${g}`).join(' · ')}
        </div>
      ) : null}
      {empfaenger.length ? (
        <div className="border-line-strong overflow-x-auto rounded-md border">
          <table className="text-table w-full min-w-[820px]">
            <thead className="text-ink-3 text-label border-line border-b text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Lead</th>
                <th className="px-3 py-2 font-medium">E-Mail</th>
                <th className="px-3 py-2 font-medium">Stand</th>
                <th className="px-3 py-2 font-medium">Mail</th>
                <th className="px-3 py-2 font-medium">Nächste Mail</th>
                <th className="px-3 py-2 font-medium">Grund</th>
                <th className="w-10 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {empfaenger.map((e) => {
                const st = EMPFAENGER_STATUS[e.status] ?? EMPFAENGER_STATUS.wartet!
                const name = `${e.leads?.first_name ?? ''} ${e.leads?.last_name ?? ''}`.trim() || e.email
                return (
                  <tr key={e.id} className="border-line border-b last:border-b-0">
                    <td className="px-3 py-2">
                      <Link to={PFADE.lead(e.lead_id)} className="text-ink-bright hover:underline">
                        {name}
                      </Link>
                      {e.leads?.company_name ? (
                        <span className="text-ink-3 block text-[12px]">{e.leads.company_name}</span>
                      ) : null}
                    </td>
                    <td className="text-ink-2 max-w-[220px] truncate px-3 py-2">{e.email}</td>
                    <td className="px-3 py-2">
                      <Chip ton={st.ton}>{st.label}</Chip>
                    </td>
                    <td className="tnum px-3 py-2">
                      {Math.min(e.schritt, schritte)}/{schritte}
                    </td>
                    <td className="text-ink-2 px-3 py-2">
                      {e.naechster_versand_at && e.status === 'aktiv' ? fmtDatumZeit(e.naechster_versand_at) : '–'}
                    </td>
                    <td
                      className={cn(
                        'max-w-[240px] truncate px-3 py-2',
                        sperre.get(e.id) && !e.stopp_grund ? 'text-overdue' : 'text-ink-3',
                      )}
                      title={e.stopp_grund ?? sperre.get(e.id) ?? ''}
                    >
                      {e.stopp_grund ?? (sperre.get(e.id) ? `Wird übersprungen: ${sperre.get(e.id)}` : '')}
                    </td>
                    <td className="px-2 py-2">
                      {['wartet', 'gestoppt', 'fehler'].includes(e.status) ? (
                        <Button
                          variante="icon"
                          icon={Trash2}
                          aria-label={`${name} aus der Kampagne nehmen`}
                          onClick={() => entfernen.mutate(e.id)}
                        />
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Leer titel="Noch keine Empfänger" satz="Leads mit E-Mail-Adresse und Erlaubnis-Grundlage hinzufügen." />
      )}
      <Warum label="Woher kommt die Erlaubnis?">
        Am Telefon („Darf ich Ihnen das per Mail schicken?“), als schriftliches „Ja“ auf LinkedIn, nach einem Gespräch
        oder bei Bestandskunden. Im Lead unter E-Mail → „Erlaubnis erfassen“ eintragen, möglichst mit Datum und Wortlaut
        – das ist euer Beleg. Eine LinkedIn-Vernetzung allein ist keine Erlaubnis (AG Düsseldorf, 20.11.2025).
      </Warum>
      {waehlen ? (
        <LeadsWaehlen
          kampagneId={kampagneId}
          vorhanden={new Set(empfaenger.map((e) => e.lead_id))}
          onClose={() => setWaehlen(false)}
        />
      ) : null}
    </div>
  )
}

const mitGrundlage = (l: MailLead) => l.email_consent_basis !== 'none' && l.email_consent_basis !== 'revoked'

function LeadsWaehlen({
  kampagneId,
  vorhanden,
  onClose,
}: {
  kampagneId: string
  vorhanden: Set<string>
  onClose: () => void
}) {
  const { data: leads, isPending } = useMailLeads()
  const hinzufuegen = useEmpfaengerHinzufuegen()
  const [suche, setSuche] = useState('')
  const [nurErlaubt, setNurErlaubt] = useState(true)
  const [gewaehlt, setGewaehlt] = useState<string[]>([])
  const treffer = useMemo(() => {
    const q = suche.trim().toLowerCase()
    return (leads ?? [])
      .filter((l) => !vorhanden.has(l.id) && (!nurErlaubt || mitGrundlage(l)))
      .filter(
        (l) =>
          !q ||
          `${l.first_name ?? ''} ${l.last_name ?? ''} ${l.company_name ?? ''} ${l.email ?? ''} ${l.city ?? ''}`
            .toLowerCase()
            .includes(q),
      )
      .slice(0, 300)
  }, [leads, vorhanden, nurErlaubt, suche])
  const umschalten = (id: string) => setGewaehlt((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]))
  return (
    <Dialog
      offen
      onOpenChange={(o) => !o && onClose()}
      titel="Leads hinzufügen"
      text="Nur Leads mit E-Mail-Adresse. Ohne Erlaubnis-Grundlage würde das CRM die Mail nicht senden."
      className="max-h-[90dvh] overflow-y-auto sm:max-w-[640px]"
      primaer={{
        label: gewaehlt.length ? `${gewaehlt.length} hinzufügen` : 'Hinzufügen',
        disabled: !gewaehlt.length,
        busy: hinzufuegen.isPending,
        onClick: () =>
          hinzufuegen.mutate(
            { kampagne: kampagneId, leads: gewaehlt },
            {
              onSuccess: (r) => {
                toast(
                  `${r.neu} aufgenommen${r.gesperrt ? ` · ${r.gesperrt} werden übersprungen (keine Erlaubnis o. Ä.)` : ''}`,
                )
                onClose()
              },
            },
          ),
      }}
      kinder={
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              aria-label="Leads suchen"
              placeholder="Name, Firma, Ort, E-Mail"
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
              className="min-w-[220px] flex-1"
            />
            <Checkbox
              checked={nurErlaubt}
              onChange={(e) => setNurErlaubt(e.target.checked)}
              label="Nur mit Erlaubnis"
            />
          </div>
          {isPending ? (
            <p className="text-small text-ink-3">Lädt …</p>
          ) : treffer.length ? (
            <>
              <button
                type="button"
                className="text-small text-signal justify-self-start hover:underline"
                onClick={() => setGewaehlt((g) => [...new Set([...g, ...treffer.map((l) => l.id)])])}
              >
                Alle {treffer.length} auswählen
              </button>
              <ul className="border-line grid max-h-[50dvh] overflow-y-auto rounded-sm border">
                {treffer.map((l) => (
                  <li key={l.id} className="border-line border-b last:border-b-0">
                    <label className="hover:bg-surface-hover flex cursor-pointer items-center gap-3 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={gewaehlt.includes(l.id)}
                        onChange={() => umschalten(l.id)}
                        className="accent-signal size-4"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="text-ui text-ink-bright block truncate">
                          {`${l.first_name ?? ''} ${l.last_name ?? ''}`.trim() || l.email}
                          {l.company_name ? <span className="text-ink-3 font-normal"> · {l.company_name}</span> : null}
                        </span>
                        <span className="text-ink-3 block truncate text-[12px]">{l.email}</span>
                      </span>
                      <Chip ton={mitGrundlage(l) ? 'done' : 'danger'}>
                        {ERLAUBNIS_KURZ[l.email_consent_basis as EmailConsentBasis] ?? l.email_consent_basis}
                      </Chip>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-small text-ink-3">
              {nurErlaubt
                ? 'Keine Leads mit E-Mail-Adresse und Erlaubnis gefunden. Erst im Lead die Adresse eintragen und „Erlaubnis erfassen“.'
                : 'Keine Leads mit E-Mail-Adresse gefunden.'}
            </p>
          )}
        </div>
      }
    />
  )
}
