// Telefon › Follow-ups (`/telefon/follow-ups`, 23.10.2026 – 1:1 nach Mikes „Follow-ups & nächste Schritte“): alle offenen
// Telefon-Leads als Arbeitsliste – Datum (rot = fällig), Name, Unternehmen, Nummer zum Abtippen, letzte Notiz, Status, nächster
// Schritt. Klick öffnet die Schnellnotiz (Ergebnis, Notiz, nächster Anruf) – „Speichern & nächster“ springt zur nächsten Zeile.
import { useMemo, useState } from 'react'
import { LadeFehler } from '@/components/ui/LadeFehler'
import { KopfStats, SeitenKopf } from '@/components/ui/SeitenKopf'
import { Segment } from '@/components/ui/Segment'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/components/ui/cn'
import { useMeId } from '@/data/members'
import { useLetzteKontakte, useTelefonKontakte, type TelefonLead } from '@/data/telefonAnsichten'
import { heuteBerlin } from '@/lib/format'
import { fmtTelefon } from '@/lib/telefon'
import { berlinTag } from '@/lib/zeit'
import { arbeitsliste, kontaktText, TELEFON_TYP, telefonStatus, type NaechsterSchritt } from './ansichten/logik'
import { SchnellNotiz } from './SchnellNotiz'

type Wer = 'alle' | 'meine'
const SPALTEN =
  'md:grid-cols-[112px_minmax(0,1.1fr)_minmax(0,1.2fr)_150px_minmax(0,1.1fr)_minmax(90px,0.5fr)_minmax(90px,0.5fr)]'
type Zeile = TelefonLead & { schritt: NaechsterSchritt }

const datumLang = (iso: string) => {
  const [j, m, t] = berlinTag(iso).split('-')
  return `${t}.${m}.${j}`
}

function DatumPille({ zeit, heute }: { zeit: string | null; heute: string }) {
  if (!zeit) return <span className="text-ink-3 px-2.5 text-[13px]">–</span>
  const faellig = berlinTag(zeit) <= heute
  return (
    <span
      className={cn(
        'tnum inline-flex h-7 items-center rounded-full px-3 text-[12.5px] font-semibold whitespace-nowrap',
        faellig ? 'bg-tag-rot text-tag-rot-ink' : 'bg-surface-hover text-ink-2',
      )}
    >
      {datumLang(zeit)}
    </span>
  )
}

export function Component() {
  const { data, isLoading, isError, refetch } = useTelefonKontakte()
  const meId = useMeId()
  const [wer, setWer] = useState<Wer>('alle')
  const [offenId, setOffenId] = useState<string | null>(null)
  const heute = heuteBerlin()

  const zeilen: Zeile[] = useMemo(
    () => arbeitsliste(data ?? []).filter((l) => wer === 'alle' || l.owner_id === meId || l.sales_owner_id === meId),
    [data, wer, meId],
  )
  const { data: kontakte } = useLetzteKontakte(zeilen.map((z) => z.id))
  const faellig = zeilen.filter((z) => z.schritt.zeit && berlinTag(z.schritt.zeit) <= heute).length
  const index = zeilen.findIndex((z) => z.id === offenId)
  const offen = index >= 0 ? zeilen[index] : null
  const naechste = index >= 0 ? zeilen[index + 1] : undefined

  return (
    <>
      <SeitenKopf
        titel="Follow-ups"
        kontext="Nummer abtippen · anrufen · Notiz"
        voice="Deine Follow-ups und nächsten Schritte."
        rechts={
          <>
            <KopfStats
              eintraege={[
                { wert: faellig, label: 'fällig', ton: 'overdue' },
                { wert: zeilen.length, label: 'offen' },
              ]}
            />
            <Segment<Wer>
              ariaLabel="Wessen Follow-ups"
              optionen={[
                { key: 'alle', label: 'Alle' },
                { key: 'meine', label: 'Meine' },
              ]}
              wert={wer}
              onChange={setWer}
            />
          </>
        }
      />

      {isError ? (
        <LadeFehler text="Follow-ups konnten nicht geladen werden." onNochmal={() => void refetch()} />
      ) : isLoading ? (
        <Skeleton zeilen={8} />
      ) : zeilen.length === 0 ? (
        <p className="text-ui text-ink-2 py-6">Keine offenen Telefon-Kontakte.</p>
      ) : (
        <div className="border-line rounded-md border">
          <div aria-hidden className={cn('label border-line grid gap-x-4 border-b px-4 py-2 max-md:hidden', SPALTEN)}>
            <span>Datum</span>
            <span>Kontakt</span>
            <span>Unternehmen</span>
            <span>Telefon</span>
            <span>Letzte Notiz</span>
            <span>Status</span>
            <span>Nächster Schritt</span>
          </div>
          <ul className="divide-line grid grid-cols-1 divide-y" aria-label="Follow-ups">
            {zeilen.map((z) => {
              const letzte = kontakte?.get(z.id)?.[0]
              const ueberfaellig = !!z.schritt.zeit && berlinTag(z.schritt.zeit) < heute
              return (
                <li
                  key={z.id}
                  data-lead={z.id}
                  onClick={() => setOffenId(z.id)}
                  className={cn(
                    'grid min-w-0 cursor-pointer items-start gap-x-4 gap-y-1.5 px-4 py-3.5',
                    SPALTEN,
                    'max-md:grid-cols-[minmax(0,1fr)_auto]',
                    ueberfaellig ? 'bg-tag-rot/30 hover:bg-tag-rot/45' : 'hover:bg-surface-hover',
                  )}
                >
                  <span className="max-md:order-2 max-md:justify-self-end">
                    <DatumPille zeit={z.schritt.zeit} heute={heute} />
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setOffenId(z.id)
                    }}
                    className="text-ink-bright decoration-line-strong min-w-0 text-left text-[15px] font-semibold underline underline-offset-4 max-md:order-1"
                  >
                    {z.full_name ?? z.company_name ?? '–'}
                  </button>
                  <span className="text-ink min-w-0 text-[14px] max-md:order-3 max-md:col-span-2">
                    {z.company_name ?? '–'}
                  </span>
                  <span className="max-md:order-4">
                    <span className="tnum text-ink block font-mono text-[14px] whitespace-nowrap">
                      {fmtTelefon(z.phone_e164)}
                    </span>
                    <span className="text-ink-3 block text-[12px]">{TELEFON_TYP[z.phone_type ?? 'unbekannt']}</span>
                  </span>
                  <span className="text-ink-3 line-clamp-2 min-w-0 text-[13px] max-md:order-6 max-md:col-span-2">
                    {letzte ? kontaktText(letzte) : '–'}
                  </span>
                  <span className="text-ink text-[14px] max-md:order-5 max-md:justify-self-end">
                    {telefonStatus(z)}
                  </span>
                  <span className="text-ink-bright text-[14px] font-semibold max-md:hidden">{z.schritt.label}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {offen ? (
        <SchnellNotiz
          key={offen.id}
          lead={offen}
          verlauf={kontakte?.get(offen.id) ?? []}
          onClose={() => setOffenId(null)}
          onWeiter={naechste ? () => setOffenId(naechste.id) : undefined}
        />
      ) : null}
    </>
  )
}
