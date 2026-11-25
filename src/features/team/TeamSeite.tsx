// Team (`/team?zeitraum=heute|woche|monat&person=&kanal=`): „Wie performt Mike, was macht er – und umgekehrt?“ Kopf mit Dateline und
// Zeitraum-Segment, Vergleich Vincent | Mike (Fotos, zuletzt aktiv, Heute-Status, Kennzahlen mit Balken) und das
// Team-Protokoll (live, Keyset 50). Lead-Namen öffnen das Lead-Blatt (`?lead=`).
// 25.11.2026 (Neustart): Die Links auf die KPI-Seite und die Heute-Liste sind mit diesen Seiten entfallen.
import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { SeitenKopf } from '@/components/ui/SeitenKopf'
import { Segment } from '@/components/ui/Segment'
import { Skeleton } from '@/components/ui/Skeleton'
import { useMembers } from '@/data/members'
import { fmtZeit, heuteBerlin } from '@/lib/format'
import { Protokoll } from './Protokoll'
import { teamPersonen, type TeamPerson } from './personen'
import { useJetzt } from './useJetzt'
import { Vergleich } from './Vergleich'
import { parseTeamZeitraum, TEAM_ZEITRAEUME, teamSpanne, teamZeitraum, type TeamZeitraumArt } from './zeitraum'

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
  const jetzt = useJetzt()
  const heute = heuteBerlin(jetzt)
  const art = parseTeamZeitraum(params.get('zeitraum'))
  const z = useMemo(() => teamZeitraum(art, heute), [art, heute])

  const setzeZeitraum = (a: TeamZeitraumArt) => {
    const p = new URLSearchParams(params)
    p.set('zeitraum', a)
    setParams(p, { replace: true })
  }

  const dateline = `${personen.map((p) => p.name).join(' · ')} · ${teamSpanne(z, heute)} · Stand ${fmtZeit(jetzt)}`

  return (
    <>
      <SeitenKopf
        titel="Team"
        dateline={dateline}
        rechts={
          <Segment<TeamZeitraumArt>
            ariaLabel="Zeitraum"
            optionen={TEAM_ZEITRAEUME.map((o) => ({
              key: o.key,
              label: o.key === 'woche' && art === 'woche' ? `Woche · ${z.label}` : o.label,
            }))}
            wert={art}
            onChange={setzeZeitraum}
          />
        }
      />
      <Vergleich links={links} rechts={rechts} z={z} heute={heute} onZeitraum={setzeZeitraum} />
      <Protokoll personen={personen} z={z} heute={heute} onMonat={() => setzeZeitraum('monat')} />
    </>
  )
}
