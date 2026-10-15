// BAUPLAN § 3.7 LeitfaedenSeite.tsx – Zwei Spalten 280px 1fr: Baum + Detail (DESIGN-SYSTEM § 5.16); mobil: Liste → Detail.
// Query: ?kanal= · ?phase= · ?vorschau=<lead_id>. Tasten: / Suche (data-suche, global) · J/K Cursor · ↵ öffnen.
import { Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { PFADE } from '@/app/pfade'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Segment } from '@/components/ui/Segment'
import { SeitenKopf } from '@/components/ui/SeitenKopf'
import { Skeleton } from '@/components/ui/Skeleton'
import { fehlerMeldung } from '@/data/errors'
import { useSequences } from '@/data/sequences'
import { useTemplatePerformance, useTemplates } from '@/data/templates'
import { useHotkeys } from '@/lib/keyboard'
import { KANAL_LABEL, LEER } from '@/texte/de'
import type { Channel, TemplatePerformance, TemplatePhase } from '@/types/domain'
import { MEDIEN, useMediaQuery } from '@/lib/useMediaQuery'
import { Baum, type Verwendung } from './Baum'
import { baumGruppen, baumReihenfolge, kanalAusParam } from './helfer'
import { LeitfadenDetail } from './LeitfadenDetail'
import { KANAELE, phaseDef, phasenFuer } from './phasen'

export function Component() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const kanal = kanalAusParam(params.get('kanal'))
  const phaseParam = params.get('phase') as TemplatePhase | null
  const phase = phaseParam && phasenFuer(kanal).some((p) => p.key === phaseParam) ? phaseParam : null
  const vorschau = params.get('vorschau')
  const desktop = useMediaQuery(MEDIEN.desktop)

  const { data: vorlagen, isPending, isError, error, refetch } = useTemplates()
  const { data: perfListe } = useTemplatePerformance()
  const { data: sequenzen } = useSequences()
  const [q, setQ] = useState('')
  const [cursorWunsch, setCursorWunsch] = useState<string | null>(null)

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

  const gruppen = useMemo(() => baumGruppen(vorlagen ?? [], kanal, q, phase), [vorlagen, kanal, q, phase])
  const reihenfolge = useMemo(() => baumReihenfolge(gruppen), [gruppen])
  const zaehler = useMemo(() => {
    const z: Record<Channel, number> = { linkedin: 0, telefon: 0, email: 0, sonstiges: 0 }
    for (const t of vorlagen ?? []) z[t.channel]++
    return z
  }, [vorlagen])

  // Cursor: Wunsch, solange der Eintrag sichtbar ist; sonst erster Eintrag (abgeleitet, kein Effekt)
  const cursorId = cursorWunsch && reihenfolge.includes(cursorWunsch) ? cursorWunsch : (reihenfolge[0] ?? null)

  const setzeParam = (key: string, wert: string | null) => {
    const p = new URLSearchParams(params)
    if (wert) p.set(key, wert)
    else p.delete(key)
    setParams(p, { replace: true })
  }

  const oeffnen = (id: string) =>
    navigate(vorschau ? `${PFADE.leitfaden(id)}?vorschau=${encodeURIComponent(vorschau)}` : PFADE.leitfaden(id))
  const bewege = (delta: number) => {
    if (reihenfolge.length === 0) return
    const i = cursorId ? reihenfolge.indexOf(cursorId) : -1
    const n = (i + delta + reihenfolge.length) % reihenfolge.length
    setCursorWunsch(reihenfolge[n] ?? null)
  }

  useHotkeys(
    'liste',
    {
      j: () => bewege(1),
      k: () => bewege(-1),
      arrowdown: () => bewege(1),
      arrowup: () => bewege(-1),
      enter: (e) => {
        // ↵ auf einem Button/Link/Menü gehört dem Element, nicht dem Baum
        if ((e.target as HTMLElement | null)?.closest?.('button, a, [role="dialog"], [role="menu"], [role="listbox"]'))
          return
        if (cursorId) oeffnen(cursorId)
      },
    },
    [reihenfolge, cursorId, vorschau],
  )

  const anzahl = zaehler[kanal]
  const kontext = `${KANAL_LABEL[kanal]} · ${phasenFuer(kanal).length} Phasen · ${anzahl} ${anzahl === 1 ? 'Leitfaden' : 'Leitfäden'}`
  const neuAnlegen = () => navigate(PFADE.leitfadenNeu(kanal))

  return (
    <>
      <SeitenKopf
        titel="Leitfäden"
        kontext={kontext}
        rechts={
          <>
            <Segment
              ariaLabel="Kanal"
              optionen={KANAELE.map((k) => ({ key: k, label: KANAL_LABEL[k], zaehler: zaehler[k] }))}
              wert={kanal}
              onChange={(k) => {
                const p = new URLSearchParams(params)
                p.set('kanal', k)
                p.delete('phase')
                setParams(p, { replace: true })
              }}
            />
            <Button variante="primary" icon={Plus} onClick={neuAnlegen}>
              Leitfaden anlegen
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
      ) : anzahl === 0 ? (
        <EmptyState
          titel={LEER.leitfaedenKanal(KANAL_LABEL[kanal]).titel}
          primaer={{ label: LEER.leitfaedenKanal(KANAL_LABEL[kanal]).aktion, onClick: neuAnlegen }}
        />
      ) : (
        <div className={desktop ? 'grid grid-cols-[280px_1fr] gap-8' : 'grid gap-5'}>
          <aside aria-label="Baum" className="grid content-start gap-3">
            <Input
              aria-label="Leitfaden suchen"
              placeholder="Suchen …"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              data-suche
              rechts={
                <span className="inline-flex items-center gap-1.5">
                  <Search size={14} strokeWidth={1.75} aria-hidden className="text-ink-3" />
                  <kbd className="kbd">/</kbd>
                </span>
              }
            />
            {phase ? (
              <div className="flex items-center gap-1.5">
                <Chip ton="neutral" onRemove={() => setzeParam('phase', null)}>
                  {phaseDef(kanal, phase).label}
                </Chip>
              </div>
            ) : null}
            <Baum
              kanal={kanal}
              vorlagen={vorlagen ?? []}
              perf={perf}
              verwendungen={verwendungen}
              q={q}
              phase={phase}
              cursorId={cursorId}
              onCursor={(id) => {
                setCursorWunsch(id)
                if (!desktop) oeffnen(id)
              }}
              onOeffnen={oeffnen}
            />
          </aside>
          {desktop ? (
            <div className="min-w-0">
              {cursorId ? (
                <LeitfadenDetail
                  key={cursorId}
                  id={cursorId}
                  vorschauLeadId={vorschau}
                  onVorschauLead={(lid) => setzeParam('vorschau', lid)}
                />
              ) : (
                <EmptyState
                  titel="Kein Leitfaden gewählt."
                  satz="Wähle links einen Eintrag – J und K bewegen den Cursor."
                />
              )}
            </div>
          ) : null}
        </div>
      )}
    </>
  )
}
