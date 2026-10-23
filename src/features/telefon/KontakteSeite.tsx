// Telefon › Kontakte (`/telefon/kontakte`, 23.10.2026): Mikes Lead-Tabelle aus dem Sales Hub auf den CRM-Daten – alle Leads mit
// Telefonnummer, Spalten Kontakt · Unternehmen · Telefon · Erstgespräch · Strategiegespräch · Status · Follow-up, fällige
// Follow-ups zuerst. Klick öffnet die Schnellnotiz (Notiz, Ergebnis, nächster Anruf; „Akte öffnen“ darin); Anlegen/Import =
// bestehende Seiten.
import { Phone, Plus, Search, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { PFADE } from '@/app/pfade'
import { Button } from '@/components/ui/Button'
import { Chip, StatusChip } from '@/components/ui/Chip'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { LadeFehler } from '@/components/ui/LadeFehler'
import { SeitenKopf } from '@/components/ui/SeitenKopf'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/components/ui/cn'
import { useSettings } from '@/data/settings'
import { useLetzteKontakte, useTelefonKontakte, type TelefonLead, type TelefonTermin } from '@/data/telefonAnsichten'
import { fmtDatumKurz, fmtZeit, heuteBerlin } from '@/lib/format'
import { PHASEN, phaseVon } from '@/lib/stufen'
import { fmtTelefon } from '@/lib/telefon'
import type { PhaseKey } from '@/types/domain'
import {
  AUFGABE_LABEL,
  istFaellig,
  kontakteSortiert,
  naechstesFollowUp,
  TELEFON_TYP,
  terminVon,
} from './ansichten/logik'
import { Kachel, Kacheln, TelefonUnterNav } from './ansichten/Teile'
import { SchnellNotiz } from './SchnellNotiz'

const STATUS_HINWEIS: Partial<Record<TelefonTermin['status'], string>> = {
  geplant: 'geplant',
  no_show: 'No-Show',
  abgesagt: 'abgesagt',
  stattgefunden: 'war',
}

function Termin({ t }: { t: TelefonTermin | null }) {
  if (!t) return <span className="text-ink-3">–</span>
  return (
    <span className="grid leading-tight">
      <span className="tnum">{fmtDatumKurz(t.scheduled_at)}</span>
      <span
        className={cn('text-[12px]', t.status === 'no_show' || t.status === 'abgesagt' ? 'text-overdue' : 'text-ink-3')}
      >
        {STATUS_HINWEIS[t.status] ?? ''}
      </span>
    </span>
  )
}

function FollowUp({ lead, heute }: { lead: TelefonLead; heute: string }) {
  const f = naechstesFollowUp(lead)
  if (!f?.due_at) return <span className="text-ink-3">–</span>
  return (
    <Chip
      ton={istFaellig(f.due_at, heute) ? 'overdue' : 'later'}
      className="font-mono"
      title={f.title ?? AUFGABE_LABEL[f.kind]}
    >
      {fmtDatumKurz(f.due_at)} · {fmtZeit(f.due_at)}
    </Chip>
  )
}

function Anrufen({ lead }: { lead: TelefonLead }) {
  if (lead.do_not_contact) return <span className="text-small text-ink-3">gesperrt</span>
  return (
    <Link
      to={PFADE.anruf(lead.id)}
      onClick={(e) => e.stopPropagation()}
      className="border-line-strong text-small text-ink hover:bg-surface-hover inline-flex h-7 items-center gap-1.5 rounded-sm border px-2.5"
    >
      <Phone size={14} strokeWidth={1.75} aria-hidden />
      Anrufen
    </Link>
  )
}

export function Component() {
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useTelefonKontakte()
  const { data: settings } = useSettings()
  const [q, setQ] = useState('')
  const [phase, setPhase] = useState<PhaseKey | ''>('')
  const heute = heuteBerlin()

  const alle = useMemo(() => data ?? [], [data])
  const zahlen = useMemo(
    () => ({
      gesamt: alle.length,
      offen: alle.filter((l) => l.stage !== 'kunde' && l.stage !== 'beendet').length,
      faellig: alle.filter((l) => istFaellig(naechstesFollowUp(l)?.due_at, heute)).length,
      kunden: alle.filter((l) => l.stage === 'kunde').length,
    }),
    [alle, heute],
  )
  const liste = useMemo(() => {
    const s = q.trim().toLowerCase()
    return kontakteSortiert(
      alle.filter(
        (l) =>
          (!phase || phaseVon(l.stage).key === phase) &&
          (!s ||
            [l.full_name, l.company_name, l.city, l.phone_e164, l.role_title]
              .filter(Boolean)
              .join(' ')
              .toLowerCase()
              .includes(s)),
      ),
    )
  }, [alle, q, phase])

  // Klick öffnet die Schnellnotiz (Mike: „ohne in der Akte zu wühlen“); die Akte selbst über „Akte öffnen“ darin
  const [notizId, setNotizId] = useState<string | null>(null)
  const oeffnen = (id: string) => setNotizId(id)
  const notizIndex = liste.findIndex((l) => l.id === notizId)
  const notizLead = notizIndex >= 0 ? liste[notizIndex] : null
  const naechster = notizIndex >= 0 ? liste[notizIndex + 1] : undefined
  const { data: kontakte } = useLetzteKontakte(notizLead ? [notizLead.id] : [])

  return (
    <>
      <TelefonUnterNav />
      <SeitenKopf
        titel="Kontakte"
        kontext="Telefon · alle Leads mit Nummer"
        rechts={
          <>
            <Button
              variante="secondary"
              icon={Upload}
              onClick={() => navigate(PFADE.schnellimport(PFADE.telefonKontakte))}
            >
              Leads importieren
            </Button>
            <Button variante="primary" icon={Plus} onClick={() => navigate(PFADE.leadNeu)}>
              Lead hinzufügen
            </Button>
          </>
        }
      />

      <Kacheln>
        <Kachel label="Leads gesamt" wert={zahlen.gesamt} hinweis="Alle Kontakte mit Nummer" />
        <Kachel label="Offene Kontakte" wert={zahlen.offen} hinweis="Noch in Bearbeitung" />
        <Kachel
          label="Follow-ups fällig"
          wert={zahlen.faellig}
          hinweis="Heute oder überfällig"
          ton={zahlen.faellig ? 'overdue' : undefined}
        />
        <Kachel
          label="Gewonnene Kunden"
          wert={zahlen.kunden}
          hinweis="Status: Kunde"
          ton={zahlen.kunden ? 'done' : undefined}
        />
      </Kacheln>

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="w-[300px] max-w-full">
          <Input
            aria-label="Kontakte durchsuchen"
            placeholder="Name, Firma, Ort, Nummer …"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            rechts={<Search size={14} strokeWidth={1.75} aria-hidden className="text-ink-3" />}
          />
        </div>
        <Select
          aria-label="Status"
          className="w-[180px] max-w-full"
          value={phase}
          onChange={(e) => setPhase(e.target.value as PhaseKey | '')}
          optionen={[{ value: '', label: 'Alle Status' }, ...PHASEN.map((p) => ({ value: p.key, label: p.label }))]}
        />
        <span className="text-small text-ink-3 ml-auto">
          {liste.length} {liste.length === 1 ? 'Kontakt' : 'Kontakte'}
        </span>
      </div>

      {isError ? (
        <LadeFehler text="Kontakte konnten nicht geladen werden." onNochmal={() => void refetch()} />
      ) : isLoading ? (
        <Skeleton zeilen={8} />
      ) : alle.length === 0 ? (
        <EmptyState
          titel="Noch keine Telefon-Kontakte"
          satz="Sobald ein Lead eine Telefonnummer hat, steht er hier – importiere z. B. eine Anrufliste."
          primaer={{ label: 'Leads importieren', onClick: () => navigate(PFADE.schnellimport(PFADE.telefonKontakte)) }}
        />
      ) : (
        <>
          {/* ab 768 px: Tabelle wie in Mikes Sales Hub */}
          <div className="overflow-x-auto max-md:hidden">
            <table className="w-full min-w-[880px] border-collapse text-[13.5px]" aria-label="Telefon-Kontakte">
              <thead>
                <tr className="label border-line-strong border-b text-left">
                  <th className="py-2 pr-3 font-medium">Kontakt</th>
                  <th className="py-2 pr-3 font-medium">Unternehmen</th>
                  <th className="py-2 pr-3 font-medium">Telefon</th>
                  <th className="py-2 pr-3 font-medium">Erstgespräch</th>
                  <th className="py-2 pr-3 font-medium">Strategiegespräch</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Follow-up</th>
                  <th className="py-2 font-medium">
                    <span className="sr-only">Aktion</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {liste.map((l) => (
                  <tr
                    key={l.id}
                    onClick={() => oeffnen(l.id)}
                    className="border-line hover:bg-surface-hover cursor-pointer border-b align-middle"
                  >
                    <td className="max-w-[220px] py-2.5 pr-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          oeffnen(l.id)
                        }}
                        className="text-ink-bright block max-w-full truncate text-left font-medium hover:underline"
                      >
                        {l.full_name ?? '–'}
                      </button>
                      <span className="text-ink-3 block truncate text-[12px]">{l.role_title ?? ''}</span>
                    </td>
                    <td className="max-w-[200px] py-2.5 pr-3">
                      <span className="block truncate">{l.company_name ?? '–'}</span>
                      <span className="text-ink-3 block truncate text-[12px]">{l.city ?? ''}</span>
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      <span className="tnum block font-mono text-[12.5px]">{fmtTelefon(l.phone_e164)}</span>
                      <span className="text-ink-3 block text-[12px]">
                        {TELEFON_TYP[l.phone_type ?? 'unbekannt'] ?? ''}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      <Termin t={terminVon(l, 'erstgespraech')} />
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      <Termin t={terminVon(l, 'strategiegespraech')} />
                    </td>
                    <td className="py-2.5 pr-3">
                      <StatusChip stage={l.stage} settings={settings} />
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      <FollowUp lead={l} heute={heute} />
                    </td>
                    <td className="py-2.5 text-right">
                      <Anrufen lead={l} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* iPhone: Karten statt Tabelle */}
          {/* grid-cols-1 = minmax(0, 1fr): lange Firmennamen kürzen statt die Karte über den Rand zu schieben */}
          <ul className="grid grid-cols-1 gap-2 md:hidden" aria-label="Telefon-Kontakte">
            {liste.map((l) => (
              <li key={l.id} className="border-line min-w-0 rounded-md border px-3.5 py-3">
                <button type="button" onClick={() => oeffnen(l.id)} className="block w-full min-w-0 text-left">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-ink-bright min-w-0 truncate font-medium">{l.full_name ?? '–'}</span>
                    <StatusChip stage={l.stage} settings={settings} />
                  </span>
                  <span className="text-small text-ink-2 block truncate">
                    {[l.company_name, l.city].filter(Boolean).join(' · ') || '–'}
                  </span>
                </button>
                <span className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="tnum font-mono text-[12.5px]">{fmtTelefon(l.phone_e164)}</span>
                  <FollowUp lead={l} heute={heute} />
                  <span className="ml-auto">
                    <Anrufen lead={l} />
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {liste.length === 0 ? <p className="text-ui text-ink-2 py-6">Kein Kontakt passt zur Suche.</p> : null}
        </>
      )}
      {notizLead ? (
        <SchnellNotiz
          key={notizLead.id}
          lead={notizLead}
          verlauf={kontakte?.get(notizLead.id) ?? []}
          onClose={() => setNotizId(null)}
          onWeiter={naechster ? () => setNotizId(naechster.id) : undefined}
        />
      ) : null}
    </>
  )
}
