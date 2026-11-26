// Karte eines großen Ziels (Jahr, Quartal): kleine Kopfzeile „JAHR · Dez. 2026 – Nov. 2027“, Titel, rechts der Ring mit dem
// Fortschritt; darunter je Key Result eine Zeile mit „Ist / Soll“ und einem schlanken Balken. Gilt ein Key Result je Person,
// zeigt die Karte alle zusammen. Von Hand gezählte bekommen „−“/„+“ (gebucht wird für die angemeldete Person).
import { useId } from 'react'
import { zusammen, type ErgebnisAnsicht, type OkrAktionen, type ZielAnsicht } from './ansicht'
import { Balken } from './Balken'
import { EBENE_LABEL, istSollText, zeitraumText, type OkrZiel } from './rechnen'
import { Ring } from './Ring'
import { ErstesErgebnis, ZielMenue } from './ZielKarte'
import { Menue, PlusMinus } from './_Teile'

function Zeile({
  ziel,
  ansicht,
  meId,
  aktionen,
}: {
  ziel: OkrZiel
  ansicht: ErgebnisAnsicht
  meId: string | null
  aktionen: OkrAktionen
}) {
  const e = ansicht.ergebnis
  const stand = zusammen(ansicht.fortschritte)
  const wert = istSollText(stand, e.einheit)
  return (
    <li className="min-w-0">
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-ui text-ink min-w-0 flex-1 [overflow-wrap:anywhere]">{e.titel}</span>
        <span data-wert className="text-ui text-ink-bright tnum flex-none whitespace-nowrap">
          {wert}
        </span>
        <Menue
          label={`Menü für „${e.titel}“`}
          className="-mr-2 max-md:-mr-2.5"
          eintraege={[
            { label: 'Bearbeiten', onSelect: () => aktionen.ergebnisBearbeiten(ziel, e) },
            { label: 'Löschen', danger: true, onSelect: () => aktionen.ergebnisLoeschen(e) },
          ]}
        />
      </div>
      <div className="mt-1 flex min-w-0 items-center gap-3">
        <Balken
          schlank
          anteil={stand.anteil}
          tempo={stand.tempo}
          status={stand.status}
          label={e.titel}
          wert={wert}
          className="flex-1"
        />
        {e.quelle === 'manuell' ? (
          <PlusMinus
            gesperrt={!meId}
            minusMoeglich={stand.ist > 0}
            onPlus={() => aktionen.zaehlen(e, null, 1)}
            onMinus={() => aktionen.zaehlen(e, null, -1)}
          />
        ) : null}
      </div>
    </li>
  )
}

export function GrossesZiel({
  ansicht,
  meId,
  aktionen,
}: {
  ansicht: ZielAnsicht
  meId: string | null
  aktionen: OkrAktionen
}) {
  const { ziel, ergebnisse, anteil, status } = ansicht
  const titelId = useId()
  return (
    <article
      aria-labelledby={titelId}
      className="border-line bg-surface shadow-card min-w-0 rounded-md border px-6 pt-5 pb-6 max-md:px-4 max-md:pt-4 max-md:pb-5"
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="min-w-0 flex-1 pt-1">
          <p className="text-small text-ink-3 font-medium">
            <span className="tracking-[0.06em] uppercase">{EBENE_LABEL[ziel.ebene]}</span> ·{' '}
            {/* bricht die Zeile um (Telefon), dann vor dem Zeitraum – nicht mitten in ihm */}
            <span className="whitespace-nowrap">{zeitraumText(ziel)}</span>
          </p>
          <h2 id={titelId} className="text-h2 text-ink-bright mt-1 [overflow-wrap:anywhere]">
            {ziel.titel}
          </h2>
        </div>
        {ergebnisse.length ? <Ring anteil={anteil} status={status} className="mt-1" /> : null}
        <ZielMenue ziel={ziel} aktionen={aktionen} className="-mr-2 max-md:-mr-2.5" />
      </div>
      {ergebnisse.length ? (
        <ul aria-label={`Key Results: ${ziel.titel}`} className="mt-4 grid grid-cols-1 gap-3">
          {ergebnisse.map((e) => (
            <Zeile key={e.ergebnis.id} ziel={ziel} ansicht={e} meId={meId} aktionen={aktionen} />
          ))}
        </ul>
      ) : (
        <div className="mt-2">
          <ErstesErgebnis ziel={ziel} aktionen={aktionen} />
        </div>
      )}
    </article>
  )
}
