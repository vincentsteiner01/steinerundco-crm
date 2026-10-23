// Leitfäden (`/leitfaeden?kanal=`, 23.10.2026 nach Mikes Sales Hub – Vincent: „zu viel Text überall“): je Bereich (Telefon &
// Sales · LinkedIn · E-Mail) Kategorien als Abschnitte mit „+ Leitfaden“ und Karten (Titel, kurzer Auszug, 1–3 Sterne).
// Klick öffnet das Lesefenster, „Bearbeiten“ das Bearbeiten-Fenster. Die alte Detailseite (/leitfaeden/:id) bleibt für Statistik,
// Vorschau mit Lead und alle Felder. `?id=` öffnet einen Leitfaden direkt.
import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { EmptyState } from '@/components/ui/EmptyState'
import { Segment } from '@/components/ui/Segment'
import { SeitenKopf } from '@/components/ui/SeitenKopf'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/components/ui/cn'
import { fehlerMeldung } from '@/data/errors'
import { useSequences } from '@/data/sequences'
import { useTemplatePerformance, useTemplates, useTemplateSave } from '@/data/templates'
import { auszug } from '@/lib/leitfadenFormat'
import type { Template, TemplatePerformance } from '@/types/domain'
import { nutzung, nutzungText, standardChip } from './helfer'
import {
  BEREICHE_UEBERSICHT,
  bereichAusParam,
  kartenVon,
  kategorienFuer,
  phaseHinweis,
  zielWert,
  type Bereich,
  type Kategorie,
  type Ziel,
} from './kategorien'
import { LeitfadenBearbeiten } from './LeitfadenBearbeiten'
import { LeitfadenLesen } from './LeitfadenLesen'
import { Sterne } from './Sterne'

type Verwendung = { sequenzName: string; position: number }
type Bearbeiten = { vorlage: Template | null; ziel: Ziel }

function Karte({
  t,
  perf,
  standard,
  onOeffnen,
  onBewerten,
}: {
  t: Template
  perf: TemplatePerformance | undefined
  standard: string | null
  onOeffnen: () => void
  onBewerten: (r: number | null) => void
}) {
  const n = nutzung(perf)
  const hinweis = phaseHinweis(t)
  return (
    <div
      onClick={onOeffnen}
      data-leitfaden={t.id}
      className={cn(
        'border-line bg-surface-raised shadow-card hover:shadow-float flex min-w-0 cursor-pointer flex-col rounded-md border px-4 py-3.5 transition-shadow',
        t.active === false && 'opacity-60',
      )}
    >
      {hinweis ? <span className="text-ink-3 mb-0.5 text-[11.5px]">{hinweis}</span> : null}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onOeffnen()
        }}
        className="text-ink-bright line-clamp-2 text-left text-[15px] leading-snug font-semibold"
      >
        {t.name}
      </button>
      <p className="text-ink-2 mt-1.5 line-clamp-3 text-[13px] leading-relaxed">{auszug(t.body) || '–'}</p>
      <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-3">
        <Sterne wert={t.rating} onChange={onBewerten} groesse={16} />
        {t.active === false ? <Chip ton="ended">inaktiv</Chip> : null}
        {standard ? (
          <Chip ton="neutral" className="ml-auto">
            {standard}
          </Chip>
        ) : null}
      </div>
      {n ? <span className="text-ink-3 mt-1 text-[11.5px]">{nutzungText(n)}</span> : null}
    </div>
  )
}

function Abschnitt({
  k,
  karten,
  perf,
  verwendungen,
  onOeffnen,
  onNeu,
  onBewerten,
}: {
  k: Kategorie
  karten: Template[]
  perf: Map<string, TemplatePerformance>
  verwendungen: Map<string, Verwendung[]>
  onOeffnen: (t: Template) => void
  onNeu: () => void
  onBewerten: (t: Template, r: number | null) => void
}) {
  return (
    <section aria-label={k.label} data-kategorie={k.key} className="mb-9">
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-ink-bright text-[17px] font-semibold">
          {k.label} <span className="text-ink-3 text-[13px] font-normal">({karten.length})</span>
        </h2>
        <Button variante="quiet" groesse="S" icon={Plus} className="ml-auto" onClick={onNeu}>
          Leitfaden
        </Button>
      </div>
      {karten.length === 0 ? (
        <p className="bg-sidebar text-ink-3 rounded-md px-4 py-6 text-center text-[13px]">
          Noch keine Leitfäden in dieser Kategorie.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {karten.map((t) => (
            <Karte
              key={t.id}
              t={t}
              perf={perf.get(t.id)}
              standard={standardChip(verwendungen.get(t.id) ?? [])?.text ?? null}
              onOeffnen={() => onOeffnen(t)}
              onBewerten={(r) => onBewerten(t, r)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export function Component() {
  const [params, setParams] = useSearchParams()
  const bereich = bereichAusParam(params.get('kanal'))
  const offenId = params.get('id')

  const { data: vorlagen, isPending, isError, error, refetch } = useTemplates()
  const { data: perfListe } = useTemplatePerformance()
  const { data: sequenzen } = useSequences()
  const speichern = useTemplateSave()
  const [bearbeiten, setBearbeiten] = useState<Bearbeiten | null>(null)

  const perf = useMemo(() => {
    const m = new Map<string, TemplatePerformance>()
    for (const p of perfListe ?? []) if (p.template_id) m.set(p.template_id, p)
    return m
  }, [perfListe])
  const verwendungen = useMemo(() => {
    const m = new Map<string, Verwendung[]>()
    for (const s of sequenzen ?? [])
      for (const st of s.steps)
        if (st.template_id)
          m.set(st.template_id, [...(m.get(st.template_id) ?? []), { sequenzName: s.name, position: st.position }])
    return m
  }, [sequenzen])

  const kategorien = kategorienFuer(bereich)
  const alle = useMemo(() => vorlagen ?? [], [vorlagen])
  const zaehler = useMemo(() => {
    const z: Record<Bereich, number> = { telefon: 0, linkedin: 0, email: 0 }
    for (const b of BEREICHE_UEBERSICHT) z[b.key] = alle.filter((t) => b.kanaele.includes(t.channel)).length
    return z
  }, [alle])
  const offen = offenId ? (alle.find((t) => t.id === offenId) ?? null) : null
  const offenKategorie = offen
    ? kategorien.find((k) => k.kanal === offen.channel && k.phasen.includes(offen.phase))
    : null

  const setzeParam = (key: string, wert: string | null) => {
    const p = new URLSearchParams(params)
    if (wert) p.set(key, wert)
    else p.delete(key)
    setParams(p, { replace: true })
  }
  const ersteZiel = (): Ziel => {
    const k = kategorien[0]
    return zielWert(k?.kanal ?? 'linkedin', k?.phasen[0] ?? 'eroeffnung')
  }
  const verwendet = (t: Template) => (perf.get(t.id)?.gesendet ?? 0) > 0 || (verwendungen.get(t.id)?.length ?? 0) > 0

  return (
    <>
      <SeitenKopf
        titel="Leitfäden"
        kontext="Wissen & Gesprächsführung"
        voice="Deine Leitfäden für Akquise, Gespräche und Einwände."
        rechts={
          <>
            <Segment<Bereich>
              ariaLabel="Bereich"
              optionen={BEREICHE_UEBERSICHT.map((b) => ({ key: b.key, label: b.label, zaehler: zaehler[b.key] }))}
              wert={bereich}
              onChange={(b) => {
                const p = new URLSearchParams(params)
                p.set('kanal', b)
                p.delete('id')
                setParams(p, { replace: true })
              }}
            />
            <Button variante="primary" icon={Plus} onClick={() => setBearbeiten({ vorlage: null, ziel: ersteZiel() })}>
              Leitfaden schreiben
            </Button>
          </>
        }
      />

      {isPending ? (
        <Skeleton zeilen={6} />
      ) : isError ? (
        <EmptyState
          titel="Leitfäden konnten nicht geladen werden."
          satz={fehlerMeldung(error).meldung}
          primaer={{ label: 'Erneut versuchen', onClick: () => void refetch(), kbd: 'R' }}
        />
      ) : (
        kategorien.map((k) => (
          <Abschnitt
            key={k.key}
            k={k}
            karten={kartenVon(alle, k)}
            perf={perf}
            verwendungen={verwendungen}
            onOeffnen={(t) => setzeParam('id', t.id)}
            onNeu={() => setBearbeiten({ vorlage: null, ziel: zielWert(k.kanal, k.phasen[0] ?? 'gatekeeper') })}
            onBewerten={(t, rating) => speichern.mutate({ ...t, rating })}
          />
        ))
      )}

      {offen && !bearbeiten ? (
        <LeitfadenLesen
          key={offen.id}
          t={offen}
          oberzeile={[offenKategorie?.label, phaseHinweis(offen)].filter(Boolean).join(' · ')}
          nutzung={nutzung(perf.get(offen.id)) ? nutzungText(nutzung(perf.get(offen.id))!) : null}
          standard={standardChip(verwendungen.get(offen.id) ?? [])?.text ?? null}
          verwendet={verwendet(offen)}
          onBearbeiten={() => setBearbeiten({ vorlage: offen, ziel: zielWert(offen.channel, offen.phase) })}
          onClose={() => setzeParam('id', null)}
        />
      ) : null}
      {bearbeiten ? (
        <LeitfadenBearbeiten
          key={bearbeiten.vorlage?.id ?? 'neu'}
          vorlage={bearbeiten.vorlage}
          ziel={bearbeiten.ziel}
          bereich={bereich}
          keys={alle.map((t) => t.key)}
          onClose={() => setBearbeiten(null)}
          onGespeichert={(t) => {
            setBearbeiten(null)
            setzeParam('id', t.id)
          }}
        />
      ) : null}
    </>
  )
}
