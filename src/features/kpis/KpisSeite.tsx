// KPIs (Route /kpis?person=<slug|team>&zeitraum=<monat|kw|7t|30t>) – zurück aus dem alten CRM, verkleinert (26.11.2026).
// Kopf: ← Zeitraum → mit den Segmenten Person und Zeitraum; die Auswahl steht in der URL. Darunter in fester Reihenfolge:
// „Meine Vernetzungen“ (immer da, immer für die angemeldete Person) · Kennzahlen des Boards · Funnel neben Tagesverlauf ·
// Wochentabelle in voller Breite · E-Mail. Bewusst nichts weiter: keine Tasten, kein Export, kein Kanal, keine Ziele, keine
// Hinweistexte. „Heute“ kommt aus useHeute: bleibt der Reiter über Nacht offen, wechselt der Tag mit.
// Beim Blättern und beim Personenwechsel bleiben die bisherigen Zahlen stehen (blasser), bis die neuen geladen sind.
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { Segment } from '@/components/ui/Segment'
import { Skeleton } from '@/components/ui/Skeleton'
import { useMeId, useMembers } from '@/data/members'
import { teamPersonen } from '@/features/team/personen'
import { personSlug } from '@/lib/mitglied'
import { useHeute } from '@/lib/useHeute'
import type { Tag } from '@/lib/zeit'
import { FunnelTabelle } from './FunnelTabelle'
import { funnelZeilen, kachelnBoard, kachelnEmail, TAGES_METRIKEN, type TagesMetrik } from './kennzahlen'
import { Kennzahlenzeile } from './Kennzahlenzeile'
import { KpisKopf } from './KpisKopf'
import { Tagesverlauf } from './Tagesverlauf'
import { Tageszaehler } from './Tageszaehler'
import { BlockKopf } from './_Teile'
import { useKpis } from './useKpis'
import { Wochentabelle } from './Wochentabelle'
import {
  datelineSpanne,
  folgezeitraumMoeglich,
  parseZeitraum,
  verschoben,
  ZEITRAUM_ARTEN,
  zeitraumFuerArt,
  zeitraumParams,
  zeitraumWahl,
  type Zeitraum,
  type ZeitraumArt,
} from './zeitraum'

type Person = { slug: string; id: string; label: string }

/** Kennzahlen in der genannten Reihenfolge. */
const metriken = (...keys: TagesMetrik[]) => keys.flatMap((k) => TAGES_METRIKEN.filter((m) => m.key === k))
/** Der Tagesverlauf bietet nur drei Kennzahlen zur Wahl. */
const VERLAUF = metriken('angeschrieben', 'vernetzungen_versendet', 'gespraech')
/** Spalten der Wochentabelle – ohne Wert im Zeitraum fällt eine Spalte weg. */
const WOCHEN = metriken(
  'vernetzungen_versendet',
  'vernetzungen_angenommen',
  'angeschrieben',
  'gespraech',
  'im_geschaeft',
  'verloren',
)

function NichtGeladen({ onNochmal }: { onNochmal: () => void }) {
  return (
    <div role="alert" className="grid justify-items-start gap-5 py-4">
      <p className="text-body text-ink-2">Die KPIs konnten nicht geladen werden.</p>
      <Button groesse="L" onClick={onNochmal}>
        Erneut versuchen
      </Button>
    </div>
  )
}

export function Component() {
  const [params, setParams] = useSearchParams()
  const meId = useMeId()
  const mitglieder = useMembers()
  const heute = useHeute()
  const zeitraum = useMemo(() => parseZeitraum(params, heute), [params, heute])
  const personen = useMemo(
    () =>
      teamPersonen(mitglieder.data ?? []).map((p): Person => ({ slug: personSlug(p.member), id: p.id, label: p.name })),
    [mitglieder.data],
  )

  // Ohne (gültige) Wahl in der URL: die angemeldete Person. „Team“ braucht die Mitglieder nicht.
  const personParam = params.get('person')
  const wahl: Person | 'team' | null =
    personParam === 'team'
      ? 'team'
      : (personen.find((p) => p.slug === personParam) ?? personen.find((p) => p.id === meId) ?? personen[0] ?? null)
  const personLabel = wahl === 'team' ? 'Team' : wahl?.label

  const setze = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) p.delete(k)
      else p.set(k, v)
    }
    setParams(p, { replace: true })
  }
  const setzeZeitraum = (z: Zeitraum) => {
    const zp = zeitraumParams(z, heute)
    setze({ zeitraum: zp.zeitraum, von: zp.von ?? null, bis: zp.bis ?? null })
  }
  // Die Tageszähler gehören immer der angemeldeten Person. Zeigt die Seite gerade jemand anderen, wechselt sie nach dem
  // Speichern zu ihr – sonst stünde „Gespeichert.“ über Zahlen, an denen sich nichts ändert.
  const zuMir = () => {
    const ich = personen.find((p) => p.id === meId)
    if (ich && wahl && wahl !== 'team' && wahl.id !== ich.id) setze({ person: ich.slug })
  }

  return (
    <>
      <KpisKopf
        dateline={[personLabel, datelineSpanne(zeitraum, heute)].filter(Boolean).join(' · ')}
        titel={zeitraum.label}
        onZurueck={() => setzeZeitraum(verschoben(zeitraum, -1))}
        onVor={() => setzeZeitraum(verschoben(zeitraum, 1, heute))}
        vorMoeglich={folgezeitraumMoeglich(zeitraum, heute)}
        zurueckLabel="Früher"
        vorLabel="Später"
        rechts={
          <>
            {personen.length ? (
              <Segment
                ariaLabel="Person"
                className="max-md:h-11!"
                optionen={[...personen.map((p) => ({ key: p.slug, label: p.label })), { key: 'team', label: 'Team' }]}
                wert={wahl === 'team' ? 'team' : (wahl?.slug ?? null)}
                onChange={(slug) => setze({ person: slug })}
              />
            ) : null}
            <Segment<Exclude<ZeitraumArt, 'custom'>>
              ariaLabel="Zeitraum"
              className="max-md:h-11!"
              optionen={ZEITRAUM_ARTEN}
              wert={zeitraumWahl(zeitraum)}
              onChange={(art) => setzeZeitraum(zeitraumFuerArt(art, heute, zeitraum))}
            />
          </>
        }
      />

      {/* Eine minmax(0,1fr)-Spur: kein Block kann die Seite in die Breite ziehen (Wochentabelle scrollt in sich) */}
      <div className="grid grid-cols-1 gap-10">
        {meId ? <Tageszaehler meId={meId} heute={heute} onGespeichert={zuMir} /> : null}
        {wahl ? (
          <Zahlen member={wahl === 'team' ? 'team' : wahl.id} zeitraum={zeitraum} heute={heute} />
        ) : mitglieder.isError ? (
          <NichtGeladen onNochmal={() => void mitglieder.refetch()} />
        ) : (
          <Skeleton zeilen={6} />
        )}
      </div>
    </>
  )
}

function Zahlen({ member, zeitraum, heute }: { member: string | 'team'; zeitraum: Zeitraum; heute: Tag }) {
  const neu = useKpis(member, zeitraum)
  // Die Ansicht, deren Zahlen dastehen: die gewählte, sobald sie geladen ist – bis dahin bleibt die bisherige stehen.
  // Ersetzten Platzhalter den Inhalt, schrumpfte die Seite für die Ladezeit und der Browser warf sie an den Anfang (wer in
  // der Wochentabelle blättert, musste nach jedem Klick neu hinunterscrollen). Der Platzhalter steht nur beim ersten Laden.
  const [gezeigt, setGezeigt] = useState({ member, zeitraum })
  const wechselt = gezeigt.member !== member || gezeigt.zeitraum !== zeitraum
  if (wechselt && !neu.laden) setGezeigt({ member, zeitraum })
  // nur lesen: die bisherige Ansicht lädt nichts mehr nach
  const bisher = useKpis(gezeigt.member, gezeigt.zeitraum, false)
  const wartet = wechselt && neu.laden && bisher.da
  const d = wartet ? bisher : neu
  const z = wartet ? gezeigt.zeitraum : zeitraum
  const [metrik, setMetrik] = useState<TagesMetrik>('angeschrieben')
  const vorLabel = z.vorperiode.label

  if (d.laden) return <Skeleton zeilen={6} />
  if (d.fehler) return <NichtGeladen onNochmal={d.nachladen} />
  return (
    <div
      aria-busy={wartet || undefined}
      className={cn(
        'ease-brand grid min-w-0 grid-cols-1 gap-10 transition-opacity duration-[var(--t-1)]',
        // erst nach einem Augenblick blasser: eine schnelle Antwort flackert nicht
        wartet && 'opacity-60 delay-150',
      )}
    >
      <Kennzahlenzeile
        kacheln={kachelnBoard(d.werte, d.vorwerte, d.sheet)}
        vorLabel={vorLabel}
        ariaLabel="Kennzahlen"
      />

      {/* Ab 1180 px Funnel links (7fr), rechts der Tagesverlauf (5fr); darunter untereinander */}
      <div className="wide:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] grid grid-cols-1 items-start gap-10">
        <section aria-label="Funnel" className="min-w-0">
          <BlockKopf
            titel="Funnel"
            hinweis={
              <>
                Anteil zur Vorstufe
                {/* am Telefon ist die Vergleichsspalte des Funnels ausgeblendet – dann auch ihr Name */}
                <span className="max-md:hidden"> · Vergleich {vorLabel}</span>
              </>
            }
          />
          <FunnelTabelle zeilen={funnelZeilen(d.werte, d.vorwerte, d.sheet)} vorLabel={vorLabel} />
        </section>
        <Tagesverlauf
          tage={d.tage}
          metrik={metrik}
          onMetrik={setMetrik}
          metriken={VERLAUF}
          heute={heute}
          zeitraumLabel={z.label}
        />
      </div>

      {/* Eigene Zeile in voller Breite: in der schmalen rechten Spalte lag die halbe Tabelle unsichtbar außerhalb */}
      <Wochentabelle
        tage={d.tage}
        heute={heute}
        metriken={WOCHEN}
        aktiv={metrik}
        // In einem Monat mit alten Monatszählern sind die Wochen nicht der ganze Monat (Kachel 412, Wochen 107)
        gesamtLabel={z.art === 'monat' && !WOCHEN.some((m) => d.monatszaehler.has(m.key)) ? 'Monat gesamt' : 'Gesamt'}
        leereAusblenden
      />

      <section aria-label="E-Mail" className="min-w-0">
        <BlockKopf titel="E-Mail" />
        <Kennzahlenzeile
          kacheln={kachelnEmail(d.werte, d.vorwerte)}
          vorLabel={vorLabel}
          ariaLabel="Kennzahlen E-Mail"
        />
      </section>
    </div>
  )
}
