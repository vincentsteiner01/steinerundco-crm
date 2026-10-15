// Team (`/team?zeitraum=heute|woche|monat&person=&kanal=`): „Wie performt Mike, was macht er – und umgekehrt?“ Kopf mit Dateline und
// Zeitraum-Segment (Tasten 1 2 3), Vergleich Vincent | Mike (Fotos, zuletzt aktiv, Heute-Status, Kennzahlen mit Balken) und das
// Team-Protokoll (live, Keyset 50). Zahlen aus denselben Quellen wie die KPI-Seite; Lead-Namen öffnen den Peek (`?lead=`).
import { useEffect, useMemo, useRef } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useUiStore } from '@/app/uiStore'
import { SeitenKopf } from '@/components/ui/SeitenKopf'
import { Segment } from '@/components/ui/Segment'
import { Skeleton } from '@/components/ui/Skeleton'
import { useMeId, useMembers } from '@/data/members'
import { fmtZeit, heuteBerlin } from '@/lib/format'
import { useHotkeys } from '@/lib/keyboard'
import { Protokoll } from './Protokoll'
import { teamPersonen, type TeamPerson } from './personen'
import { useJetzt } from './useJetzt'
import { Vergleich } from './Vergleich'
import { kpiLink, parseTeamZeitraum, TEAM_ZEITRAEUME, teamSpanne, teamZeitraum, type TeamZeitraumArt } from './zeitraum'

export function Component() {
  const { data: members, isError } = useMembers()
  const personen = useMemo(() => teamPersonen(members ?? []), [members])
  const [links, rechts] = personen
  if (!links || !rechts) {
    return (
      <>
        <SeitenKopf titel="Team" kontext="Vincent · Mike" />
        {isError ? (
          <p className="text-ui text-ink-2">Mitglieder konnten nicht geladen werden – Seite neu laden.</p>
        ) : (
          <Skeleton zeilen={6} />
        )}
      </>
    )
  }
  return <TeamInhalt personen={personen} links={links} rechts={rechts} />
}

function TeamInhalt({ personen, links, rechts }: { personen: TeamPerson[]; links: TeamPerson; rechts: TeamPerson }) {
  const [params, setParams] = useSearchParams()
  const meId = useMeId()
  const jetzt = useJetzt()
  const heute = heuteBerlin(jetzt)
  const art = parseTeamZeitraum(params.get('zeitraum'))
  const z = useMemo(() => teamZeitraum(art, heute), [art, heute])

  const setzeZeitraum = (a: TeamZeitraumArt) => {
    const p = new URLSearchParams(params)
    p.set('zeitraum', a)
    setParams(p, { replace: true })
  }

  // 1 2 3 = Heute · Woche · Monat; nicht bei offenem Peek oder Dialog (dort gehören Ziffern den Popovers/Reaktionen)
  const aktuell = useRef(setzeZeitraum)
  useEffect(() => {
    aktuell.current = setzeZeitraum
  })
  const frei = () => {
    const ui = useUiStore.getState()
    return !ui.peekLeadId && ui.hotkeyScope === 'global' && !ui.paletteOffen
  }
  useHotkeys('global', {
    '1': () => frei() && aktuell.current('heute'),
    '2': () => frei() && aktuell.current('woche'),
    '3': () => frei() && aktuell.current('monat'),
  })

  const dateline = `${personen.map((p) => p.name).join(' · ')} · ${teamSpanne(z, heute)} · Stand ${fmtZeit(jetzt)}`

  return (
    <>
      <SeitenKopf
        titel="Team"
        dateline={dateline}
        rechts={
          <>
            <Segment<TeamZeitraumArt>
              ariaLabel="Zeitraum"
              optionen={TEAM_ZEITRAEUME.map((o) => ({
                key: o.key,
                label: o.key === 'woche' && art === 'woche' ? `Woche · ${z.label}` : o.label,
                icon: <kbd className="kbd max-md:hidden">{o.taste}</kbd>,
              }))}
              wert={art}
              onChange={setzeZeitraum}
            />
            <Link
              to={kpiLink(z)}
              className="text-ui text-ink-2 hover:text-ink hover:bg-surface-hover inline-flex h-9 items-center rounded-sm px-3.5 whitespace-nowrap max-md:h-7 max-md:px-0 max-md:hover:bg-transparent"
            >
              In den KPIs ansehen →
            </Link>
          </>
        }
      />
      <Vergleich links={links} rechts={rechts} meId={meId} z={z} heute={heute} onZeitraum={setzeZeitraum} />
      <Protokoll personen={personen} z={z} heute={heute} onMonat={() => setzeZeitraum('monat')} />
    </>
  )
}
