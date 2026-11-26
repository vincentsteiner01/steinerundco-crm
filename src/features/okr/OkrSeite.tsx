// Ziele (Route /ziele?monat=YYYY-MM, 26.11.2026): OKR für zwei Inhaber auf einer Seite. Kopf: ← Monat → und „Ziel hinzufügen“.
// Darunter: die großen Ziele (Jahr, Quartal) als Karten mit Ring · „Heute“ und „Diese Woche“ (nur im laufenden Monat; ab
// 1180 px als rechte Spalte neben den Monatszielen, darunter über ihnen – am Telefon ganz oben, noch vor den großen Zielen) ·
// die Monatsziele mit ihren Key Results, Fortschritt je Person und To-dos. Bewusst nichts weiter: keine Hinweistexte, keine Tasten.
// Ohne Monat in der Adresse: der laufende Monat, sonst der nächste mit Zielen (startMonat). Beim Blättern bleibt der bisherige
// Monat stehen (blasser), bis der neue geladen ist – wie auf der KPI-Seite.
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { Dialog } from '@/components/ui/Dialog'
import { Skeleton } from '@/components/ui/Skeleton'
import { useErgebnisLoeschen, useMonatUebernehmen, useOkr, useZaehlen, useZielLoeschen } from '@/data/okr'
import { KpisKopf } from '@/features/kpis/KpisKopf'
import { monatLabel } from '@/lib/format'
import { useHeute } from '@/lib/useHeute'
import { monatePlus, type Tag } from '@/lib/zeit'
import { ausschnittZeilen, zaehlPerson, type OkrAktionen } from './ansicht'
import { monatAusParam, monatParam } from './eingabe'
import { ErgebnisDialog } from './ErgebnisDialog'
import { GrossesZiel } from './GrossesZiel'
import { monatsErster, monatsLetzter, startMonat, type OkrErgebnis, type OkrZiel } from './rechnen'
import { baueAnsicht, useOkrQuellen } from './useOkrAnsicht'
import { WocheHeute } from './WocheHeute'
import { ZielDialog } from './ZielDialog'
import { ZielKarte } from './ZielKarte'

type Fenster =
  | { art: 'ziel'; ziel: OkrZiel | null }
  | { art: 'ergebnis'; ziel: OkrZiel; ergebnis: OkrErgebnis | null }
  | { art: 'zielLoeschen'; ziel: OkrZiel }
  | { art: 'ergebnisLoeschen'; ergebnis: OkrErgebnis }

export function Component() {
  const [params, setParams] = useSearchParams()
  const heute = useHeute()
  const okr = useOkr()
  const monat = monatAusParam(params.get('monat')) ?? startMonat(okr.data?.ziele ?? [], heute)
  const [fenster, setFenster] = useState<Fenster | null>(null)
  const zaehlen = useZaehlen()
  const zielLoeschen = useZielLoeschen()
  const ergebnisLoeschen = useErgebnisLoeschen()
  const uebernehmen = useMonatUebernehmen()

  // Der Monat, dessen Ziele dastehen: der gewählte, sobald er geladen ist – bis dahin bleibt der bisherige stehen.
  // Ersetzten Platzhalter den Inhalt, schrumpfte die Seite für die Ladezeit und spränge beim Blättern an den Anfang.
  const neu = useOkrQuellen(monat, heute)
  const [gezeigt, setGezeigt] = useState<Tag | null>(null)
  if (!neu.laden && gezeigt !== monat) setGezeigt(monat)
  // nur lesen: der bisherige Monat lädt nichts mehr nach
  const bisher = useOkrQuellen(gezeigt ?? monat, heute, false)
  const wartet = gezeigt !== null && gezeigt !== monat && neu.laden && bisher.da
  const q = wartet ? bisher : neu
  const ansicht = q.da ? baueAnsicht(q) : null

  const setzeMonat = (m: Tag) => {
    const p = new URLSearchParams(params)
    p.set('monat', monatParam(m))
    setParams(p, { replace: true })
  }
  const zu = () => setFenster(null)

  const aktionen: OkrAktionen = {
    zielBearbeiten: (ziel) => setFenster({ art: 'ziel', ziel }),
    zielLoeschen: (ziel) => setFenster({ art: 'zielLoeschen', ziel }),
    ergebnisNeu: (ziel) => setFenster({ art: 'ergebnis', ziel, ergebnis: null }),
    ergebnisBearbeiten: (ziel, ergebnis) => setFenster({ art: 'ergebnis', ziel, ergebnis }),
    ergebnisLoeschen: (ergebnis) => setFenster({ art: 'ergebnisLoeschen', ergebnis }),
    zaehlen: (ergebnis, zeile, delta) => {
      const memberId = zaehlPerson(ergebnis.id, zeile, delta, q.meId, q.zahlen.eintraege)
      if (memberId) zaehlen.mutate({ ergebnisId: ergebnis.id, memberId, delta })
    },
  }

  const zielHinzufuegen = (
    <Button variante="primary" groesse="L" icon={Plus} onClick={() => setFenster({ art: 'ziel', ziel: null })}>
      Ziel hinzufügen
    </Button>
  )
  const monatsName = monatLabel(q.monat)
  const leer = ansicht !== null && ansicht.monatsziele.length === 0
  const heuteZeilen = ansicht?.laeuft ? ausschnittZeilen(ansicht.monatsziele, 'heute') : []
  const wocheZeilen = ansicht?.laeuft ? ausschnittZeilen(ansicht.monatsziele, 'woche') : []
  const mitTafeln = heuteZeilen.length > 0 || wocheZeilen.length > 0
  const mitGrossen = ansicht !== null && ansicht.gross.length > 0

  return (
    <>
      <KpisKopf
        dateline="Ziele"
        titel={monatLabel(monat)}
        onZurueck={() => setzeMonat(monatePlus(monat, -1))}
        onVor={() => setzeMonat(monatePlus(monat, 1))}
        vorMoeglich
        zurueckLabel="Früher"
        vorLabel="Später"
        // Ohne Monatsziele steht der Knopf unten beim Satz – zwei gleiche blaue Knöpfe wären einer zu viel
        rechts={ansicht && !leer ? zielHinzufuegen : undefined}
      />

      {ansicht ? (
        // Ein Raster für alle drei Teile. Im Dokument stehen „Heute“/„Diese Woche“ zuerst – am Telefon also ganz oben. Ab 768 px
        // rücken die großen Ziele in die erste Zeile (row-start-1), die Tafeln folgen; ab 1180 px stehen die Tafeln als rechte
        // Spalte neben den Monatszielen und bleiben beim Scrollen im Blick.
        <div
          aria-busy={wartet || undefined}
          className={cn(
            'ease-brand grid min-w-0 grid-cols-1 items-start gap-8 transition-opacity duration-[var(--t-1)] max-md:gap-6',
            mitTafeln && 'wide:grid-cols-[minmax(0,1fr)_340px]',
            // erst nach einem Augenblick blasser: eine schnelle Antwort flackert nicht
            wartet && 'opacity-60 delay-150',
          )}
        >
          {mitTafeln ? (
            <WocheHeute
              heute={q.heute}
              heuteZeilen={heuteZeilen}
              wocheZeilen={wocheZeilen}
              personen={q.personen}
              className={cn(
                // höher als das Fenster (viele Key Results): die Spalte scrollt in sich, statt unten abgeschnitten zu kleben
                'wide:sticky wide:top-[calc(var(--head-h)+16px)] wide:col-start-2 wide:max-h-[calc(100dvh-var(--head-h)-32px)] wide:overflow-y-auto',
                mitGrossen ? 'wide:row-start-2' : 'wide:row-start-1',
              )}
            />
          ) : null}

          {mitGrossen ? (
            <section
              aria-label="Große Ziele"
              className={cn(
                'grid min-w-0 grid-cols-1 items-start gap-4 min-[900px]:grid-cols-2 md:row-start-1',
                mitTafeln && 'wide:col-span-2',
              )}
            >
              {ansicht.gross.map((z) => (
                <GrossesZiel key={z.ziel.id} ansicht={z} meId={q.meId} aktionen={aktionen} />
              ))}
            </section>
          ) : null}

          <section
            aria-label="Monatsziele"
            className={cn(
              'grid min-w-0 grid-cols-1 gap-4',
              mitTafeln && 'wide:col-start-1',
              mitTafeln && (mitGrossen ? 'wide:row-start-2' : 'wide:row-start-1'),
            )}
          >
            {leer ? (
              <div className="grid justify-items-start gap-5 py-4">
                <p className="text-body text-ink-2">Noch keine Ziele für {monatsName}.</p>
                <div className="flex flex-wrap gap-2">
                  {zielHinzufuegen}
                  {ansicht.vormonat ? (
                    <Button
                      groesse="L"
                      busy={uebernehmen.isPending}
                      onClick={() => {
                        if (!ansicht.vormonat) return
                        uebernehmen.mutate(
                          { von: ansicht.vormonat, nach: monatsErster(q.monat) },
                          { onSuccess: () => toast('Übernommen.') },
                        )
                      }}
                    >
                      Aus {monatLabel(ansicht.vormonat)} übernehmen
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : (
              ansicht.monatsziele.map((z) => (
                <ZielKarte key={z.ziel.id} ansicht={z} personen={q.personen} meId={q.meId} aktionen={aktionen} />
              ))
            )}
          </section>
        </div>
      ) : q.fehler ? (
        <div role="alert" className="grid justify-items-start gap-5 py-4">
          <p className="text-body text-ink-2">Die Ziele konnten nicht geladen werden.</p>
          <Button groesse="L" onClick={q.nachladen}>
            Erneut versuchen
          </Button>
        </div>
      ) : (
        <Skeleton zeilen={6} />
      )}

      {fenster?.art === 'ziel' ? (
        <ZielDialog
          ziel={fenster.ziel}
          monat={monat}
          heute={heute}
          onClose={zu}
          // Beginnt das Ziel in einem anderen Monat, blättert die Seite dorthin – sonst wäre es nach dem Speichern nicht zu sehen
          onGespeichert={({ von, bis }) => {
            if (von > monatsLetzter(monat) || bis < monatsErster(monat)) setzeMonat(von)
          }}
        />
      ) : null}
      {fenster?.art === 'ergebnis' ? (
        <ErgebnisDialog ziel={fenster.ziel} ergebnis={fenster.ergebnis} onClose={zu} />
      ) : null}
      {fenster?.art === 'zielLoeschen' ? (
        <Dialog
          gross
          offen
          onOpenChange={(o) => !o && zu()}
          titel="Ziel löschen?"
          text={`„${fenster.ziel.titel}“ wird mit seinen Key Results und To-dos gelöscht.`}
          primaer={{
            label: 'Löschen',
            danger: true,
            busy: zielLoeschen.isPending,
            onClick: () =>
              zielLoeschen.mutate(fenster.ziel.id, {
                onSuccess: () => toast('Ziel gelöscht.'),
                onSettled: zu,
              }),
          }}
        />
      ) : null}
      {fenster?.art === 'ergebnisLoeschen' ? (
        <Dialog
          gross
          offen
          onOpenChange={(o) => !o && zu()}
          titel="Key Result löschen?"
          text={`„${fenster.ergebnis.titel}“ wird mit seinem Fortschritt und seinen To-dos gelöscht.`}
          primaer={{
            label: 'Löschen',
            danger: true,
            busy: ergebnisLoeschen.isPending,
            onClick: () =>
              ergebnisLoeschen.mutate(fenster.ergebnis.id, {
                onSuccess: () => toast('Key Result gelöscht.'),
                onSettled: zu,
              }),
          }}
        />
      ) : null}
    </>
  )
}
