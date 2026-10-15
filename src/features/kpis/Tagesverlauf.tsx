// BAUPLAN § 3.6 Tagesverlauf: Balken je Kalendertag (Balken.tsx), Metrik-Segment (Gespräche eröffnet · Anfragen · Antworten ·
// Dials · Connects), Wochenende deco, heute Lime, Hover-Wert; Blockkopf „Max. 28 · Ø 5,9/Tag“. Mobil: 7-Tage-Fenster mit Wochentabs.
import { useMemo, useState } from 'react'
import { Segment } from '@/components/ui/Segment'
import { fmtZahl } from '@/lib/format'
import type { Tag } from '@/lib/zeit'
import { useIstTelefon } from '@/lib/useMediaQuery'
import { Balken } from './charts/Balken'
import { TAGES_METRIKEN, wochen, type TagesMetrik, type TagesMetrikDef, type TagesWert } from './kennzahlen'
import { BlockKopf } from './_Teile'

export type TagesverlaufProps = {
  tage: readonly TagesWert[]
  metrik: TagesMetrik
  onMetrik: (m: TagesMetrik) => void
  metriken: readonly TagesMetrikDef[]
  heute: Tag
  zeitraumLabel: string
}

const dezimal = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export function Tagesverlauf({ tage, metrik, onMetrik, metriken, heute, zeitraumLabel }: TagesverlaufProps) {
  const def = TAGES_METRIKEN.find((m) => m.key === metrik) ?? TAGES_METRIKEN[0]!
  const mobil = useIstTelefon()
  const wochenZeilen = useMemo(() => wochen(tage, heute), [tage, heute])
  const [woche, setWoche] = useState<string | null>(null)
  const aktuelleWoche = wochenZeilen.find((w) => w.aktuell) ?? wochenZeilen[wochenZeilen.length - 1]
  const gewaehlt = (woche && wochenZeilen.find((w) => w.von === woche)) || aktuelleWoche

  const sichtbar = mobil && gewaehlt ? tage.filter((t) => t.tag >= gewaehlt.von && t.tag <= gewaehlt.bis) : tage
  const balken = sichtbar.map((t) => ({ tag: t.tag, wert: t.werte[metrik] }))

  const vergangen = tage.filter((t) => t.tag <= heute)
  const max = Math.max(0, ...vergangen.map((t) => t.werte[metrik]))
  const schnitt = vergangen.length ? vergangen.reduce((a, t) => a + t.werte[metrik], 0) / vergangen.length : 0

  return (
    <section aria-label="Tagesverlauf">
      <BlockKopf
        titel={`${def.label} pro Tag`}
        hinweis={
          <>
            Max. <span className="tnum text-ink-2 font-mono">{fmtZahl(max)}</span> · Ø{' '}
            <span className="tnum text-ink-2 font-mono">{dezimal(schnitt)}</span>/Tag
          </>
        }
        rechts={
          metriken.length > 1 ? (
            <Segment
              klein
              ariaLabel="Metrik"
              optionen={metriken.map((m) => ({ key: m.key, label: m.kurz }))}
              wert={metrik}
              onChange={onMetrik}
            />
          ) : null
        }
      />
      {mobil && wochenZeilen.length > 1 ? (
        <Segment
          klein
          className="mb-3"
          ariaLabel="Woche"
          optionen={wochenZeilen.map((w) => ({ key: w.von, label: `KW ${w.kw}` }))}
          wert={gewaehlt?.von ?? ''}
          onChange={setWoche}
        />
      ) : null}
      <Balken tage={balken} heute={heute} label={`Balkendiagramm: ${def.label} pro Tag, ${zeitraumLabel}`} />
    </section>
  )
}
