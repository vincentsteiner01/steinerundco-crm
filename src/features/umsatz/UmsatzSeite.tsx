// Umsatz (`/umsatz`, 23.10.2026, aus Mikes Sales Hub): Kennzahlen (Monat · Jahr · gesamt erhalten · Auftragsvolumen), 12-Monats-
// Verlauf erhalten vs. geplant, Kunden & Aufträge, Zahlungseingänge. Daten in crm.contracts / crm.payments (Migration 13), live
// für beide. Rechnung in rechnung.ts (wie bei Mike: wiederkehrend auf Monate umgelegt, einmalig im Startmonat).
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { LadeFehler } from '@/components/ui/LadeFehler'
import { SeitenKopf } from '@/components/ui/SeitenKopf'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { Textarea } from '@/components/ui/Textarea'
import { toast } from '@/components/toast'
import { cn } from '@/components/ui/cn'
import {
  useAuftraege,
  useAuftragLoeschen,
  useAuftragSpeichern,
  useZahlungen,
  useZahlungLoeschen,
  useZahlungSpeichern,
} from '@/data/umsatz'
import { fmtDatumKurz, heuteBerlin } from '@/lib/format'
import { istTag } from '@/lib/zeit'
import type { Contract, ContractFrequency, Payment } from '@/types/domain'
import { Kachel, Kacheln } from '@/features/telefon/ansichten/Teile'
import {
  betrag,
  erhaltenJeAuftrag,
  fmtEuro,
  kennzahlen,
  monatsreihe,
  parseEuro,
  rhythmusLabel,
  RHYTHMUS,
  unbefristetLaufend,
  volumen,
  type MonatsWert,
} from './rechnung'

const MONAT_KURZ = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
const DIALOG_HOCH = 'max-h-[calc(100dvh-32px)] overflow-y-auto'

// ── Verlauf ────────────────────────────────────────────────────────────────────────────────────────────────

function Verlauf({ reihe }: { reihe: MonatsWert[] }) {
  const max = Math.max(100, ...reihe.flatMap((r) => [r.erhalten, r.geplant])) * 1.1
  return (
    <section aria-label="Umsatzentwicklung" className="mb-10">
      <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-h3 text-ink">Umsatzentwicklung</h2>
        <span className="text-small text-ink-2 flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="bg-signal inline-block h-2.5 w-2.5 rounded-xs" aria-hidden /> Erhaltene Zahlungen
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="bg-tag-gelb border-tag-gelb-ink/30 inline-block h-2.5 w-2.5 rounded-xs border"
              aria-hidden
            />
            Geplante Monatsumsätze
          </span>
        </span>
      </div>
      <div className="border-line grid h-[200px] grid-cols-12 items-end gap-1 border-b pb-px md:gap-2.5" role="list">
        {reihe.map((r) => (
          <div
            key={r.monat}
            role="listitem"
            aria-label={`${r.monat}: erhalten ${fmtEuro(r.erhalten)}, geplant ${fmtEuro(r.geplant)}`}
            title={`Erhalten ${fmtEuro(r.erhalten)} · geplant ${fmtEuro(r.geplant)}`}
            className="flex h-full items-end justify-center gap-0.5 md:gap-1"
          >
            <span
              className="bg-signal block w-1/3 max-w-[18px] rounded-t-xs"
              style={{ height: `${(r.erhalten / max) * 100}%` }}
            />
            <span
              className="bg-tag-gelb border-tag-gelb-ink/30 block w-1/3 max-w-[18px] rounded-t-xs border border-b-0"
              style={{ height: `${(r.geplant / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-12 gap-1 md:gap-2.5">
        {reihe.map((r) => (
          <span key={r.monat} className="text-ink-3 text-center text-[11.5px]">
            {MONAT_KURZ[Number(r.monat.slice(5, 7)) - 1]}
          </span>
        ))}
      </div>
      <p className="text-small text-ink-3 mt-3 max-w-[75ch]">
        Erhaltene Zahlungen zählen, sobald du sie als Zahlung erfasst. Geplante Umsätze sind Prognosen aus den
        Aufträgen, keine bestätigten Zahlungseingänge.
      </p>
    </section>
  )
}

// ── Formulare ──────────────────────────────────────────────────────────────────────────────────────────────

type AuftragForm = {
  customer: string
  product: string
  start_date: string
  setup: string
  recurring: string
  frequency: ContractFrequency
  term: string
  notes: string
}

const fmtEingabe = (n: number | string | null | undefined): string => {
  const b = betrag(n)
  return b ? String(b).replace('.', ',') : ''
}

function auftragForm(c: Contract | null): AuftragForm {
  return {
    customer: c?.customer ?? '',
    product: c?.product ?? '',
    start_date: c?.start_date ?? `${heuteBerlin().slice(0, 7)}-01`,
    setup: fmtEingabe(c?.setup_amount),
    recurring: fmtEingabe(c?.recurring_amount),
    frequency: (c?.frequency as ContractFrequency | undefined) ?? 'monatlich',
    term: c?.term_months ? String(c.term_months) : '',
    notes: c?.notes ?? '',
  }
}

function AuftragDialog({ auftrag, onClose }: { auftrag: Contract | null | 'neu'; onClose: () => void }) {
  const alt = auftrag === 'neu' ? null : auftrag
  const [f, setF] = useState<AuftragForm>(() => auftragForm(alt))
  const [fehler, setFehler] = useState<string | null>(null)
  const speichern = useAuftragSpeichern()
  const setze = (k: keyof AuftragForm, v: string) => {
    setFehler(null)
    setF((x) => ({ ...x, [k]: v }))
  }

  const absenden = () => {
    if (!f.customer.trim()) return setFehler('Kunde eintragen.')
    if (!istTag(f.start_date)) return setFehler('Beginn als Datum eintragen.')
    const setup = parseEuro(f.setup)
    const recurring = parseEuro(f.recurring)
    if (setup === null || recurring === null) return setFehler('Beträge als Zahl eintragen, z. B. 1.500 oder 1500,50.')
    const term = f.term.trim() ? Number(f.term) : null
    if (term !== null && (!Number.isInteger(term) || term < 1 || term > 600))
      return setFehler('Laufzeit in ganzen Monaten (1–600) oder leer lassen.')
    speichern.mutate(
      {
        ...(alt ? { id: alt.id } : {}),
        customer: f.customer.trim(),
        product: f.product.trim() || null,
        start_date: f.start_date,
        setup_amount: setup,
        recurring_amount: recurring,
        frequency: f.frequency,
        term_months: term,
        notes: f.notes.trim() || null,
      },
      {
        onSuccess: () => {
          toast(alt ? 'Auftrag gespeichert.' : 'Auftrag erfasst.')
          onClose()
        },
      },
    )
  }

  return (
    <Dialog
      offen
      onOpenChange={(o) => !o && onClose()}
      titel={alt ? 'Auftrag bearbeiten' : 'Auftrag erfassen'}
      className={DIALOG_HOCH}
      kinder={
        <>
          <FormField label="Kunde / Unternehmen" pflicht htmlFor="a-kunde">
            <Input
              id="a-kunde"
              value={f.customer}
              onChange={(e) => setze('customer', e.target.value)}
              placeholder="Muster Solar GmbH"
            />
          </FormField>
          <FormField label="Produkt / Leistung" htmlFor="a-produkt">
            <Input
              id="a-produkt"
              value={f.product}
              onChange={(e) => setze('product', e.target.value)}
              placeholder="Wissensassistent"
            />
          </FormField>
          <FormField label="Beginn" pflicht htmlFor="a-beginn">
            <Input
              id="a-beginn"
              type="date"
              value={f.start_date}
              onChange={(e) => setze('start_date', e.target.value)}
            />
          </FormField>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <FormField label="Einmaliger Betrag (€)" htmlFor="a-einmal">
              <Input
                id="a-einmal"
                inputMode="decimal"
                value={f.setup}
                onChange={(e) => setze('setup', e.target.value)}
                placeholder="0"
              />
            </FormField>
            <FormField label="Wiederkehrend (€)" htmlFor="a-wieder">
              <Input
                id="a-wieder"
                inputMode="decimal"
                value={f.recurring}
                onChange={(e) => setze('recurring', e.target.value)}
                placeholder="0"
              />
            </FormField>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <FormField label="Zahlungsrhythmus" htmlFor="a-rhythmus">
              <Select
                id="a-rhythmus"
                value={f.frequency}
                onChange={(e) => setze('frequency', e.target.value)}
                optionen={RHYTHMUS.map((r) => ({ value: r.key, label: r.label }))}
              />
            </FormField>
            <FormField label="Laufzeit in Monaten" hinweis="leer = unbefristet" htmlFor="a-laufzeit">
              <Input
                id="a-laufzeit"
                inputMode="numeric"
                value={f.term}
                onChange={(e) => setze('term', e.target.value.replace(/\D/g, ''))}
              />
            </FormField>
          </div>
          <FormField label="Notizen" htmlFor="a-notiz">
            <Textarea
              id="a-notiz"
              value={f.notes}
              onChange={(e) => setze('notes', e.target.value)}
              className="min-h-[72px]"
            />
          </FormField>
          {fehler ? (
            <p className="text-small text-danger" role="alert">
              {fehler}
            </p>
          ) : null}
        </>
      }
      primaer={{ label: alt ? 'Speichern' : 'Erfassen', onClick: absenden, busy: speichern.isPending }}
    />
  )
}

function ZahlungDialog({
  zahlung,
  auftraege,
  onClose,
}: {
  zahlung: Payment | 'neu'
  auftraege: readonly Contract[]
  onClose: () => void
}) {
  const alt = zahlung === 'neu' ? null : zahlung
  const [vertrag, setVertrag] = useState(alt?.contract_id ?? auftraege[0]?.id ?? '')
  const [datum, setDatum] = useState(alt?.paid_on ?? heuteBerlin())
  const [summe, setSumme] = useState(fmtEingabe(alt?.amount))
  const [notiz, setNotiz] = useState(alt?.notes ?? '')
  const [fehler, setFehler] = useState<string | null>(null)
  const speichern = useZahlungSpeichern()

  const absenden = () => {
    if (!vertrag) return setFehler('Auftrag wählen.')
    if (!istTag(datum)) return setFehler('Datum eintragen.')
    const n = parseEuro(summe)
    if (!n) return setFehler('Erhaltenen Betrag eintragen.')
    speichern.mutate(
      { ...(alt ? { id: alt.id } : {}), contract_id: vertrag, paid_on: datum, amount: n, notes: notiz.trim() || null },
      {
        onSuccess: () => {
          toast(alt ? 'Zahlung gespeichert.' : 'Zahlung erfasst.')
          onClose()
        },
      },
    )
  }

  return (
    <Dialog
      offen
      onOpenChange={(o) => !o && onClose()}
      titel={alt ? 'Zahlung bearbeiten' : 'Zahlung erfassen'}
      className={DIALOG_HOCH}
      kinder={
        <>
          <FormField label="Kunde / Auftrag" pflicht htmlFor="z-auftrag">
            <Select
              id="z-auftrag"
              value={vertrag}
              onChange={(e) => {
                setFehler(null)
                setVertrag(e.target.value)
              }}
              optionen={auftraege.map((a) => ({
                value: a.id,
                label: a.product ? `${a.customer} · ${a.product}` : a.customer,
              }))}
            />
          </FormField>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <FormField label="Erhalten am" pflicht htmlFor="z-datum">
              <Input id="z-datum" type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
            </FormField>
            <FormField label="Betrag (€)" pflicht htmlFor="z-betrag">
              <Input
                id="z-betrag"
                inputMode="decimal"
                value={summe}
                onChange={(e) => {
                  setFehler(null)
                  setSumme(e.target.value)
                }}
                placeholder="1.500"
              />
            </FormField>
          </div>
          <FormField label="Art / Notiz" htmlFor="z-notiz">
            <Input
              id="z-notiz"
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              placeholder="Rechnung 2026-014"
            />
          </FormField>
          {fehler ? (
            <p className="text-small text-danger" role="alert">
              {fehler}
            </p>
          ) : null}
        </>
      }
      primaer={{ label: alt ? 'Speichern' : 'Erfassen', onClick: absenden, busy: speichern.isPending }}
    />
  )
}

function ZeilenAktionen({
  onBearbeiten,
  onLoeschen,
  was,
}: {
  onBearbeiten: () => void
  onLoeschen: () => void
  was: string
}) {
  return (
    <span className="flex justify-end gap-0.5">
      <Button variante="icon" icon={Pencil} aria-label={`${was} bearbeiten`} onClick={onBearbeiten} />
      <Button variante="icon" icon={Trash2} aria-label={`${was} löschen`} onClick={onLoeschen} />
    </span>
  )
}

// ── Seite ──────────────────────────────────────────────────────────────────────────────────────────────────

type Loeschen = { art: 'auftrag'; c: Contract } | { art: 'zahlung'; p: Payment }

export function Component() {
  const auftraegeQ = useAuftraege()
  const zahlungenQ = useZahlungen()
  const auftraege = useMemo(() => auftraegeQ.data ?? [], [auftraegeQ.data])
  const zahlungen = useMemo(() => zahlungenQ.data ?? [], [zahlungenQ.data])
  const [auftragDialog, setAuftragDialog] = useState<Contract | 'neu' | null>(null)
  const [zahlungDialog, setZahlungDialog] = useState<Payment | 'neu' | null>(null)
  const [loeschen, setLoeschen] = useState<Loeschen | null>(null)
  const auftragLoeschen = useAuftragLoeschen()
  const zahlungLoeschen = useZahlungLoeschen()
  const heute = heuteBerlin()

  const k = useMemo(() => kennzahlen(auftraege, zahlungen, heute), [auftraege, zahlungen, heute])
  const reihe = useMemo(() => monatsreihe(auftraege, zahlungen, heute), [auftraege, zahlungen, heute])
  const erhalten = useMemo(() => erhaltenJeAuftrag(zahlungen), [zahlungen])
  const kunde = (id: string) => auftraege.find((a) => a.id === id)?.customer ?? 'Unbekannter Kunde'

  const zahlungNeu = () => {
    if (!auftraege.length) {
      toast('Lege zuerst einen Auftrag an.')
      return
    }
    setZahlungDialog('neu')
  }

  const loeschenBestaetigt = () => {
    if (!loeschen) return
    const fertig = { onSuccess: () => setLoeschen(null) }
    if (loeschen.art === 'auftrag') auftragLoeschen.mutate(loeschen.c.id, fertig)
    else zahlungLoeschen.mutate(loeschen.p.id, fertig)
  }

  const laden = auftraegeQ.isLoading || zahlungenQ.isLoading
  const fehler = auftraegeQ.isError || zahlungenQ.isError

  return (
    <>
      <SeitenKopf
        titel="Umsatz"
        kontext="Aufträge · Zahlungseingänge"
        rechts={
          <>
            <Button variante="secondary" icon={Plus} onClick={zahlungNeu}>
              Zahlung erfassen
            </Button>
            <Button variante="primary" icon={Plus} onClick={() => setAuftragDialog('neu')}>
              Auftrag erfassen
            </Button>
          </>
        }
      />

      {fehler ? (
        <LadeFehler
          text="Umsatz konnte nicht geladen werden."
          onNochmal={() => {
            void auftraegeQ.refetch()
            void zahlungenQ.refetch()
          }}
        />
      ) : laden ? (
        <Skeleton zeilen={8} />
      ) : (
        <>
          <Kacheln>
            <Kachel label="Zahlungen diesen Monat" wert={fmtEuro(k.monat)} hinweis="Tatsächlich erhalten" />
            <Kachel label="Zahlungen dieses Jahr" wert={fmtEuro(k.jahr)} hinweis="Tatsächlich erhalten" />
            <Kachel label="Gesamt erhalten" wert={fmtEuro(k.gesamt)} hinweis="Alle Zahlungseingänge" />
            <Kachel label="Auftragsvolumen" wert={fmtEuro(k.volumen)} hinweis="Bei Laufzeitangaben berechnet" />
          </Kacheln>

          <Verlauf reihe={reihe} />

          <section aria-label="Kunden und Aufträge" className="mb-10">
            <h2 className="text-h3 text-ink mb-3.5">Kunden &amp; Aufträge</h2>
            {auftraege.length === 0 ? (
              <p className="text-ui text-ink-2">
                Noch keine Aufträge erfasst. Ein Auftrag kann z. B. 17.500 € einmalig plus 1.500 € monatlich enthalten.
              </p>
            ) : (
              <div className="-mx-1 overflow-x-auto px-1">
                <table className="w-full min-w-[900px] border-collapse text-[13.5px]" aria-label="Aufträge">
                  <thead>
                    <tr className="label border-line-strong border-b text-left">
                      <th className="py-2 pr-3 font-medium">Kunde</th>
                      <th className="py-2 pr-3 font-medium">Beginn</th>
                      <th className="py-2 pr-3 font-medium">Produkt</th>
                      <th className="py-2 pr-3 text-right font-medium">Einmalig</th>
                      <th className="py-2 pr-3 text-right font-medium">Wiederkehrend</th>
                      <th className="py-2 pr-3 font-medium">Laufzeit</th>
                      <th className="py-2 pr-3 text-right font-medium">Auftragsvolumen</th>
                      <th className="py-2 pr-3 text-right font-medium">Erhalten</th>
                      <th className="py-2 font-medium">
                        <span className="sr-only">Aktionen</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {auftraege.map((a) => (
                      <tr key={a.id} className="border-line border-b align-middle">
                        <td className="max-w-[220px] py-2.5 pr-3">
                          <span className="text-ink-bright block truncate font-medium">{a.customer}</span>
                          {a.notes ? <span className="text-ink-3 block truncate text-[12px]">{a.notes}</span> : null}
                        </td>
                        <td className="tnum py-2.5 pr-3 whitespace-nowrap">{fmtDatumKurz(a.start_date)}</td>
                        <td className="max-w-[180px] truncate py-2.5 pr-3">{a.product || '–'}</td>
                        <td className="tnum py-2.5 pr-3 text-right font-mono text-[12.5px]">
                          {fmtEuro(betrag(a.setup_amount))}
                        </td>
                        <td className="tnum py-2.5 pr-3 text-right font-mono text-[12.5px] whitespace-nowrap">
                          {betrag(a.recurring_amount)
                            ? `${fmtEuro(betrag(a.recurring_amount))} / ${rhythmusLabel(a.frequency)}`
                            : '–'}
                        </td>
                        <td className="py-2.5 pr-3 whitespace-nowrap">
                          {a.term_months ? `${a.term_months} Monate` : 'Unbefristet'}
                        </td>
                        <td className="tnum text-ink-bright py-2.5 pr-3 text-right font-mono text-[12.5px] font-medium whitespace-nowrap">
                          {fmtEuro(volumen(a))}
                          {unbefristetLaufend(a) ? (
                            <span className="text-ink-3 font-sans font-normal"> + laufend</span>
                          ) : null}
                        </td>
                        <td className="tnum py-2.5 pr-3 text-right font-mono text-[12.5px]">
                          {fmtEuro(erhalten.get(a.id) ?? 0)}
                        </td>
                        <td className="py-1.5">
                          <ZeilenAktionen
                            was={`Auftrag ${a.customer}`}
                            onBearbeiten={() => setAuftragDialog(a)}
                            onLoeschen={() => setLoeschen({ art: 'auftrag', c: a })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section aria-label="Zahlungseingänge" className="mb-6">
            <h2 className="text-h3 text-ink mb-3.5">Zahlungseingänge</h2>
            {zahlungen.length === 0 ? (
              <p className="text-ui text-ink-2">
                Noch keine Zahlungen erfasst – erfasse sie, sobald Geld tatsächlich eingeht.
              </p>
            ) : (
              <ul className="border-line divide-line divide-y rounded-md border">
                {zahlungen.map((p) => (
                  <li
                    key={p.id}
                    className="grid grid-cols-[92px_minmax(0,1fr)_auto_auto] items-center gap-3 px-3.5 py-2 max-md:grid-cols-[minmax(0,1fr)_auto_auto]"
                  >
                    <span className="tnum text-ink-2 font-mono text-[12.5px] max-md:hidden">
                      {fmtDatumKurz(p.paid_on)}
                    </span>
                    <span className="min-w-0">
                      <span className="text-ink block truncate">{kunde(p.contract_id)}</span>
                      <span className="text-ink-3 block truncate text-[12px]">
                        <span className="md:hidden">{fmtDatumKurz(p.paid_on)} · </span>
                        {p.notes || '–'}
                      </span>
                    </span>
                    <span className={cn('tnum text-ink-bright text-right font-mono text-[13px] font-medium')}>
                      {fmtEuro(betrag(p.amount))}
                    </span>
                    <ZeilenAktionen
                      was="Zahlung"
                      onBearbeiten={() => setZahlungDialog(p)}
                      onLoeschen={() => setLoeschen({ art: 'zahlung', p })}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
          <p className="text-small text-ink-3 max-w-[75ch]">
            Das Auftragsvolumen ergibt sich aus der vereinbarten Laufzeit; ohne Laufzeit zählt nur der einmalige Betrag
            fest. Zahlungen erfasst du separat, sobald Geld tatsächlich eingeht.
          </p>
        </>
      )}

      {auftragDialog ? <AuftragDialog auftrag={auftragDialog} onClose={() => setAuftragDialog(null)} /> : null}
      {zahlungDialog ? (
        <ZahlungDialog zahlung={zahlungDialog} auftraege={auftraege} onClose={() => setZahlungDialog(null)} />
      ) : null}
      <Dialog
        offen={!!loeschen}
        onOpenChange={(o) => !o && setLoeschen(null)}
        titel={loeschen?.art === 'auftrag' ? 'Auftrag löschen?' : 'Zahlung löschen?'}
        text={
          loeschen?.art === 'auftrag'
            ? `„${loeschen.c.customer}“ und alle zugehörigen Zahlungen werden gelöscht. Das lässt sich nicht rückgängig machen.`
            : loeschen?.art === 'zahlung'
              ? `${fmtEuro(betrag(loeschen.p.amount))} vom ${fmtDatumKurz(loeschen.p.paid_on)} wird gelöscht.`
              : undefined
        }
        primaer={{
          label: 'Löschen',
          danger: true,
          onClick: loeschenBestaetigt,
          busy: auftragLoeschen.isPending || zahlungLoeschen.isPending,
        }}
      />
    </>
  )
}
