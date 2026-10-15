// BAUPLAN § 3.6 / § 7.4 – KPIs (`/kpis?person&zeitraum&von&bis&kanal`): Kopf (Dateline, ← Headline →, Segmente Person · Zeitraum ·
// Kanal, „Export CSV“), Blöcke in fester Reihenfolge: Kennzahlenzeile · Funnel · Tagesverlauf + Wochentabelle · Sales-Calls ·
// No-Shows · Leitfäden · Ohne Bewegung. Tasten: ← → Zeitraum, 1 2 3 Person, Enter in Listen → Peek (`?lead=`).
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { PFADE } from '@/app/pfade'
import { useUiStore } from '@/app/uiStore'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Segment } from '@/components/ui/Segment'
import { Skeleton } from '@/components/ui/Skeleton'
import { useMe, useMembers } from '@/data/members'
import { PERSONEN } from '@/features/auth/personen'
import { fmtZeit, heuteBerlin } from '@/lib/format'
import { useHotkeys } from '@/lib/keyboard'
import { KANAL_LABEL, LEER } from '@/texte/de'
import type { Member } from '@/types/domain'
import { KPIS_EXPORT_EVENT } from './befehle'
import { exportiereKpis } from './exportCsv'
import { FunnelTabelle } from './FunnelTabelle'
import {
  funnelZeilen,
  kachelnEmail,
  kachelnLinkedin,
  kachelnTelefon,
  TAGES_METRIKEN,
  wert,
  type TagesMetrik,
} from './kennzahlen'
import { Kennzahlenzeile } from './Kennzahlenzeile'
import { KpisKopf } from './KpisKopf'
import { LeitfaedenTabelle, type KanalWahl } from './LeitfaedenTabelle'
import { NoShows } from './NoShows'
import { OhneBewegung } from './OhneBewegung'
import { SalesCalls } from './SalesCalls'
import { Tagesverlauf } from './Tagesverlauf'
import { useKpis } from './useKpis'
import { Wochentabelle } from './Wochentabelle'
import {
  datelineSpanne,
  eigenerZeitraum,
  folgezeitraumMoeglich,
  parseZeitraum,
  verschoben,
  ZEITRAUM_ARTEN,
  zeitraumFuerArt,
  zeitraumParams,
  type Zeitraum,
  type ZeitraumArt,
} from './zeitraum'

type Person = { slug: string; id: string; label: string }
type PersonWahl = Person | 'team'

const KANAELE: { key: KanalWahl; label: string }[] = [
  { key: 'alle', label: 'Alle' },
  { key: 'linkedin', label: KANAL_LABEL.linkedin },
  { key: 'telefon', label: KANAL_LABEL.telefon },
  { key: 'email', label: KANAL_LABEL.email },
]

const slugVon = (m: Member): string =>
  PERSONEN.find((p) => p.email === m.email)?.id ?? (m.short_name ?? m.display_name ?? m.id ?? '').toLowerCase()

/** Mitglieder in fester Reihenfolge (Vincent · Mike, Rest alphabetisch) als Segment-Personen. */
function personenAus(members: readonly Member[]): Person[] {
  const rang = (p: Person) => {
    const i = PERSONEN.findIndex((x) => x.id === p.slug)
    return i < 0 ? 99 : i
  }
  return members
    .filter((m): m is Member & { id: string } => !!m.id)
    .map((m) => ({ slug: slugVon(m), id: m.id, label: m.short_name ?? m.display_name ?? m.id }))
    .sort((a, b) => rang(a) - rang(b) || a.label.localeCompare(b.label))
}

function parseKanal(s: string | null): KanalWahl {
  return s === 'linkedin' || s === 'telefon' || s === 'email' ? s : 'alle'
}

const standZeit = (): string => fmtZeit(new Date())

function standardMetrik(kanal: KanalWahl): TagesMetrik {
  return kanal === 'telefon' ? 'anrufe' : kanal === 'email' ? 'emails_gesendet' : 'gespraeche_eroeffnet'
}

export function Component() {
  const [params] = useSearchParams()
  const { data: members } = useMembers()
  const me = useMe()
  const personen = useMemo(() => personenAus(members ?? []), [members])
  const personParam = params.get('person')
  const wahl: PersonWahl | null =
    personParam === 'team'
      ? 'team'
      : (personen.find((p) => p.slug === personParam) ??
        (me ? (personen.find((p) => p.id === me.id) ?? personen[0] ?? null) : null))

  if (!wahl || !personen.length) {
    return (
      <>
        <KpisKopf
          dateline="KPIs"
          titel="KPIs"
          onZurueck={() => {}}
          onVor={() => {}}
          vorMoeglich={false}
          zurueckLabel="Vorperiode"
          vorLabel="Folgeperiode"
        />
        <Skeleton zeilen={6} />
      </>
    )
  }
  return <KpisInhalt wahl={wahl} personen={personen} />
}

function KpisInhalt({ wahl, personen }: { wahl: PersonWahl; personen: Person[] }) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const heute = heuteBerlin()
  const zeitraum = useMemo(() => parseZeitraum(params, heute), [params, heute])
  const kanal = parseKanal(params.get('kanal'))
  const member: string | 'team' = wahl === 'team' ? 'team' : wahl.id
  const mitglieder = useMemo(() => (wahl === 'team' ? personen.map((p) => p.id) : [wahl.id]), [wahl, personen])
  const personLabel = wahl === 'team' ? 'Team' : wahl.label

  const d = useKpis(member, mitglieder, zeitraum)
  const [metrikWahl, setMetrik] = useState<TagesMetrik>(() => standardMetrik(kanal))
  const [cursor, setCursor] = useState<string | null>(null)

  const setze = (patch: Record<string, string | null | undefined>) => {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === undefined) p.delete(k)
      else p.set(k, v)
    }
    setParams(p, { replace: true })
  }
  const setzeZeitraum = (z: Zeitraum) => {
    const zp = zeitraumParams(z, heute)
    setze({ zeitraum: zp.zeitraum, von: zp.von ?? null, bis: zp.bis ?? null })
  }
  const setzeKanal = (k: KanalWahl) => {
    setMetrik(standardMetrik(k))
    setze({ kanal: k === 'alle' ? null : k })
  }
  const setzePerson = (slug: string) => setze({ person: slug })
  const vorMoeglich = folgezeitraumMoeglich(zeitraum, heute)
  const oeffnePeek = (leadId: string) => setze({ lead: leadId })

  const metriken = useMemo(() => TAGES_METRIKEN.filter((m) => kanal === 'alle' || m.kanal === kanal), [kanal])
  // Metrik des Tagesverlaufs: Wahl, sofern sie zum Kanal passt, sonst die erste Metrik des Kanals
  const metrik: TagesMetrik = metriken.some((m) => m.key === metrikWahl)
    ? metrikWahl
    : (metriken[0]?.key ?? 'gespraeche_eroeffnet')

  const ziele = d.settings?.kpi_targets
  const zeilen = useMemo(
    () => funnelZeilen(d.werte, d.vorwerte, ziele, d.nurSheet, d.manuell),
    [d.werte, d.vorwerte, ziele, d.nurSheet, d.manuell],
  )
  const linkedin = kachelnLinkedin(
    d.werte,
    d.vorwerte,
    { antwortzeit: d.antwortzeit, antwortzeitVor: d.antwortzeitVor, manuell: d.manuell, nurSheet: d.nurSheet },
    ziele,
  )
  const telefon = kachelnTelefon(
    d.werte,
    d.vorwerte,
    { dauer: d.dauer, dauerVor: d.dauerVor, nurSheet: d.nurSheet },
    ziele,
  )
  const email = kachelnEmail(d.werte, d.vorwerte, {
    beantwortet: d.emailQuote,
    beantwortetVor: d.emailQuoteVor,
    widersprueche: d.widersprueche,
    widerspruecheVor: d.widerspruecheVor,
    nurSheet: d.nurSheet,
  })
  const dials = wert(d.werte.summen, 'anrufe')

  const exportieren = () =>
    exportiereKpis({
      person: personLabel,
      kanal: kanal === 'alle' ? 'Alle Kanäle' : KANAL_LABEL[kanal],
      zeitraumLabel: zeitraum.label,
      von: zeitraum.von,
      bis: zeitraum.bis,
      vorLabel: zeitraum.vorperiode.label,
      zeilen,
      tage: d.tage,
    })
  useEffect(() => {
    const h = () => exportieren()
    window.addEventListener(KPIS_EXPORT_EVENT, h)
    return () => window.removeEventListener(KPIS_EXPORT_EVENT, h)
  })

  // ← → Zeitraum · 1 2 3 Person · Esc hebt den Listen-Cursor auf. Im offenen Peek gehören ←/→ dem Peek (PeekPanel).
  // useHotkeys registriert die Handler einmal; alles Veränderliche kommt aus diesem Ref (wie DataTable).
  const aktuell = useRef({ zeitraum, vorMoeglich, cursor, personen, setzeZeitraum, setzePerson })
  useEffect(() => {
    aktuell.current = { zeitraum, vorMoeglich, cursor, personen, setzeZeitraum, setzePerson }
  })
  useHotkeys('global', {
    arrowleft: (e) => {
      const a = aktuell.current
      if (useUiStore.getState().peekLeadId || a.cursor) return
      e.preventDefault()
      a.setzeZeitraum(verschoben(a.zeitraum, -1))
    },
    arrowright: (e) => {
      const a = aktuell.current
      if (useUiStore.getState().peekLeadId || a.cursor || !a.vorMoeglich) return
      e.preventDefault()
      a.setzeZeitraum(verschoben(a.zeitraum, 1))
    },
    '1': () => {
      const p = aktuell.current.personen[0]
      if (p) aktuell.current.setzePerson(p.slug)
    },
    '2': () => {
      const p = aktuell.current.personen[1]
      if (p) aktuell.current.setzePerson(p.slug)
    },
    '3': () => aktuell.current.setzePerson('team'),
    escape: () => {
      if (aktuell.current.cursor && !useUiStore.getState().peekLeadId) setCursor(null)
    },
  })

  const kanalText = kanal === 'alle' ? 'Alle Kanäle' : KANAL_LABEL[kanal]
  const dateline = `${kanalText} · ${personLabel} · ${datelineSpanne(zeitraum, heute)} · Stand ${standZeit()}`
  const leadsKontext = { von: zeitraum.von, bis: zeitraum.bis, member }
  const sichtbareLeads = useMemo(
    () => (wahl === 'team' ? d.ohneBewegung : d.ohneBewegung.filter((l) => l.owner_id === wahl.id)),
    [d.ohneBewegung, wahl],
  )

  return (
    <>
      <KpisKopf
        dateline={dateline}
        titel={zeitraum.label}
        onZurueck={() => setzeZeitraum(verschoben(zeitraum, -1))}
        onVor={() => setzeZeitraum(verschoben(zeitraum, 1))}
        vorMoeglich={vorMoeglich}
        zurueckLabel="Vorperiode"
        vorLabel="Folgeperiode"
        rechts={
          <>
            <Segment
              ariaLabel="Person"
              optionen={[
                ...personen.map((p, i) => ({ key: p.slug, label: p.label, icon: <kbd className="kbd">{i + 1}</kbd> })),
                { key: 'team', label: 'Team', icon: <kbd className="kbd">3</kbd> },
              ]}
              wert={wahl === 'team' ? 'team' : wahl.slug}
              onChange={setzePerson}
            />
            <Segment<ZeitraumArt>
              ariaLabel="Zeitraum"
              optionen={ZEITRAUM_ARTEN}
              wert={zeitraum.art}
              onChange={(art) => setzeZeitraum(zeitraumFuerArt(art, heute, zeitraum))}
            />
            {zeitraum.art === 'custom' ? (
              <span className="flex items-center gap-1.5">
                <Input
                  type="date"
                  aria-label="Von"
                  mono
                  value={zeitraum.von}
                  max={zeitraum.bis}
                  className="w-[150px]"
                  onChange={(e) => e.target.value && setzeZeitraum(eigenerZeitraum(e.target.value, zeitraum.bis))}
                />
                <span className="text-ink-3">–</span>
                <Input
                  type="date"
                  aria-label="Bis"
                  mono
                  value={zeitraum.bis}
                  min={zeitraum.von}
                  className="w-[150px]"
                  onChange={(e) => e.target.value && setzeZeitraum(eigenerZeitraum(zeitraum.von, e.target.value))}
                />
              </span>
            ) : null}
            <Segment<KanalWahl> ariaLabel="Kanal" optionen={KANAELE} wert={kanal} onChange={setzeKanal} />
            <Button variante="quiet" onClick={exportieren} disabled={d.laden} disabledGrund="Daten laden noch">
              Export CSV
            </Button>
          </>
        }
      />

      {d.fehler && !d.laden ? (
        <div role="alert" className="flex items-center gap-3 text-[14px]">
          <span className="text-ink-2">Kennzahlen nicht geladen.</span>
          <Button groesse="S" onClick={d.nachladen}>
            Erneut versuchen
          </Button>
        </div>
      ) : d.laden ? (
        <Skeleton zeilen={6} />
      ) : d.keineDaten ? (
        <EmptyState
          titel={LEER.kpisPeriode(zeitraum.label).titel}
          satz={LEER.kpisPeriode(zeitraum.label).satz}
          primaer={{ label: LEER.kpisPeriode(zeitraum.label).aktion, onClick: () => navigate(PFADE.import) }}
          sekundaer={{ label: 'Letzte 30 Tage', onClick: () => setzeZeitraum(zeitraumFuerArt('30t', heute, zeitraum)) }}
        />
      ) : (
        <div className="grid gap-10">
          <div className="grid gap-6">
            {kanal === 'alle' || kanal === 'linkedin' ? (
              <Kennzahlenzeile
                kacheln={linkedin}
                vorLabel={zeitraum.vorperiode.label}
                ariaLabel="Kennzahlen LinkedIn"
              />
            ) : null}
            {kanal === 'telefon' || (kanal === 'alle' && dials > 0) ? (
              <Kennzahlenzeile kacheln={telefon} vorLabel={zeitraum.vorperiode.label} ariaLabel="Kennzahlen Telefon" />
            ) : null}
            {kanal === 'email' ? (
              <Kennzahlenzeile kacheln={email} vorLabel={zeitraum.vorperiode.label} ariaLabel="Kennzahlen E-Mail" />
            ) : null}
          </div>

          {/* Layout wie reference.html (kpi-grid 7fr/5fr ab 1180 px): Funnel links, rechts Tagesverlauf · Wochen · Sales-Calls · No-Shows.
              § 7.4 Nr. 4 „nebeneinander ab 1180 px“ ist damit als Zweispalter erfüllt; der Mock ist der visuelle Vertrag. */}
          <div className="wide:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] grid items-start gap-10">
            <section aria-label="Funnel">
              <div className="mb-3.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="text-h3 text-ink">Funnel</h2>
                <span className="text-small text-ink-3">
                  Konversion zur Vorstufe · Vergleich {zeitraum.vorperiode.label} · Klick öffnet die Leads
                </span>
              </div>
              <FunnelTabelle zeilen={zeilen} vorLabel={zeitraum.vorperiode.label} kontext={leadsKontext} />
            </section>
            <div className="grid gap-8">
              <Tagesverlauf
                tage={d.tage}
                metrik={metrik}
                onMetrik={setMetrik}
                metriken={metriken}
                heute={heute}
                zeitraumLabel={zeitraum.label}
              />
              <Wochentabelle
                tage={d.tage}
                heute={heute}
                metriken={metriken}
                aktiv={metrik}
                gesamtLabel={zeitraum.art === 'monat' ? 'Monat gesamt' : 'Gesamt'}
              />
              <SalesCalls werte={d.werte} naechsterTermin={d.naechsterTermin} zeitraumLabel={zeitraum.label} />
              <NoShows werte={d.werte} />
            </div>
          </div>

          <LeitfaedenTabelle
            templates={d.templates}
            kanal={kanal}
            nachSchritt={d.nachSchritt}
            sequenzen={d.sequenzen}
            notizVarianten={d.notizVarianten}
            aktivitaeten={d.aktivitaeten}
          />

          <OhneBewegung
            leads={sichtbareLeads}
            settings={d.settings}
            cursorId={cursor}
            onCursor={setCursor}
            onOeffnen={oeffnePeek}
          />
        </div>
      )}
    </>
  )
}
