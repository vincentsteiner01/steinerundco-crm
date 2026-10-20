// Hilfe (`/hilfe`, `/hilfe/:thema`): redaktionelles Handbuch. Links Suche + Themenliste (sticky), rechts der Lesetext auf 64 ch
// (Titel Newsreader, ein Satz Voice, Blöcke aus themen.ts) mit „Zeig’s mir“ → Mini-Tour auf dem echten Screen.
// `/hilfe` ohne Thema: häufige Fragen. Mobil: `/hilfe` = Suche + Liste + Fragen, `/hilfe/:thema` = nur Text mit „← Alle Themen“.
import { ArrowLeft, ArrowRight, Play } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, Navigate, NavLink, useNavigate, useParams } from 'react-router'
import { PFADE } from '@/app/pfade'
import { useUiStore } from '@/app/uiStore'
import { personVon } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { Input } from '@/components/ui/Input'
import { SeitenKopf } from '@/components/ui/SeitenKopf'
import { useAuth } from '@/features/auth/authStore'
import { useIstTelefon } from '@/lib/useMediaQuery'
import type { PersonId } from '@/features/auth/personen'
import { Bloecke } from './Bloecke'
import { tourStarten } from './ereignis'
import { Inline } from './Inline'
import { bloeckeVon, HAEUFIGE_FRAGEN, sucheThemen, THEMEN, themaVon, type Thema } from './themen'

const nr = (i: number) => String(i + 1).padStart(2, '0')

export function Component() {
  const { thema: key } = useParams()
  const thema = themaVon(key)
  const member = useAuth((s) => s.member)
  const person = personVon(member)?.id ?? null
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const treffer = useMemo(() => sucheThemen(q, person), [q, person])
  const telefon = useIstTelefon()

  if (key && !thema) return <Navigate to={PFADE.hilfe()} replace />

  return (
    <>
      <SeitenKopf
        titel="Hilfe"
        kontext={telefon ? undefined : (thema?.titel ?? 'Handbuch')}
        rechts={
          // Telefon: im Thema reicht „Zeig’s mir“ – der Kopf bleibt kurz
          telefon && thema ? undefined : (
            <Button icon={Play} onClick={() => tourStarten('onboarding')}>
              Tour erneut starten
            </Button>
          )
        }
      />
      <div className="grid gap-x-12 gap-y-8 md:grid-cols-[232px_minmax(0,1fr)]">
        <aside
          aria-label="Themen"
          className={cn(
            'grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-3 md:sticky md:top-[calc(var(--head-h,92px)+8px)] md:max-h-[calc(100dvh-var(--head-h,92px)-24px)] md:self-start md:overflow-auto',
            thema && 'max-md:hidden',
            // Telefon: erst Einleitung und „Was das CRM kann – und was nicht“, das Themenverzeichnis darunter (Runde 2)
            'max-md:order-last',
          )}
        >
          <Input
            type="search"
            data-suche
            aria-label="Hilfe durchsuchen"
            placeholder="Hilfe durchsuchen …"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && treffer[0]) navigate(PFADE.hilfe(treffer[0].key))
            }}
            rechts={<kbd className="kbd">/</kbd>}
          />
          <nav aria-label="Hilfe-Themen">
            <ol className="grid grid-cols-[minmax(0,1fr)] gap-0.5">
              {treffer.map((t) => (
                <li key={t.key}>
                  <NavLink
                    to={PFADE.hilfe(t.key)}
                    className={({ isActive }) =>
                      cn(
                        'text-ui ease-brand flex min-h-[34px] min-w-0 items-baseline gap-2.5 rounded-sm px-2.5 py-[7px] leading-[1.35] transition-[background,color] duration-[var(--t-1)] max-md:min-h-11 max-md:items-center',
                        isActive ? 'bg-surface-hover text-ink' : 'text-ink-2 hover:bg-surface-hover hover:text-ink',
                      )
                    }
                  >
                    <span className="text-ink-3 tnum w-5 flex-none font-mono text-[11.5px]">
                      {nr(THEMEN.indexOf(t))}
                    </span>
                    <span className="min-w-0">{t.titel}</span>
                  </NavLink>
                </li>
              ))}
            </ol>
            {treffer.length === 0 ? (
              <p className="text-small text-ink-3 px-2.5 py-3">
                Nichts gefunden. Fehlt etwas?{' '}
                <Link to={PFADE.feedback} className="text-ink-2 underline underline-offset-2">
                  Sag es uns
                </Link>
                .
              </p>
            ) : q ? (
              <p className="text-small text-ink-3 tnum px-2.5 pt-2">
                {treffer.length === 1 ? '1 Thema' : `${treffer.length} Themen`} · ↵ öffnet das erste
              </p>
            ) : null}
          </nav>
        </aside>

        <article className="min-w-0 pb-8 max-md:pb-20" aria-labelledby="hilfe-titel">
          {thema ? <ThemaText thema={thema} person={person} /> : <Uebersicht />}
        </article>
      </div>
    </>
  )
}

function Uebersicht() {
  return (
    <div className="max-w-[64ch]">
      <span className="label">Handbuch</span>
      <h2
        id="hilfe-titel"
        className="text-ink-bright mt-2 text-[30px] leading-[1.15] font-bold tracking-[-0.02em] max-md:text-[26px]"
      >
        Was das CRM kann – und was nicht.
      </h2>
      <p className="voice mt-3">Kurz erklärt, zum Nachschlagen, mit „Zeig’s mir“ direkt auf dem echten Screen.</p>

      <h3 className="label mt-10 mb-1">Häufige Fragen</h3>
      <dl className="border-line border-t">
        {HAEUFIGE_FRAGEN.map((f) => (
          <div key={f.frage} className="border-line border-b py-4">
            <dt className="text-h3 text-ink-bright">{f.frage}</dt>
            <dd className="text-body text-ink-2 mt-1">
              {f.antwort}{' '}
              <Link
                to={PFADE.hilfe(f.thema)}
                className="text-ink decoration-line-strong hover:decoration-ink whitespace-nowrap underline underline-offset-[3px]"
              >
                Weiterlesen
              </Link>
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-small text-ink-3 mt-6">
        Etwas fehlt oder ist falsch beschrieben? Drück <kbd className="kbd">⌥F</kbd> oder schreib es unter{' '}
        <Link to={PFADE.feedback} className="text-ink-2 underline underline-offset-2">
          Feedback
        </Link>
        .
      </p>
    </div>
  )
}

function ThemaText({ thema, person }: { thema: Thema; person: PersonId | null }) {
  const setHilfeOffen = useUiStore((s) => s.setHilfeOffen)
  const i = THEMEN.indexOf(thema)
  const vor = THEMEN[i - 1]
  const nach = THEMEN[i + 1]
  const tour = person === 'mike' ? (thema.tourMike ?? thema.tour) : thema.tour
  return (
    <div>
      <Link
        to={PFADE.hilfe()}
        className="text-small text-ink-3 hover:text-ink mb-4 inline-flex items-center gap-1.5 md:hidden"
      >
        <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
        Alle Themen
      </Link>
      <div className="max-w-[64ch]">
        <span className="mono-sm text-ink-3 tnum block">
          {nr(i)} / {nr(THEMEN.length - 1)}
        </span>
        <h2
          id="hilfe-titel"
          className="text-ink-bright mt-2 text-[30px] leading-[1.15] font-bold tracking-[-0.02em] max-md:text-[26px]"
        >
          {thema.titel}
        </h2>
        <p className="voice mt-3">
          <Inline text={thema.kurz} />
        </p>
        {tour ? (
          <Button variante="primary" icon={Play} className="mt-5" onClick={() => tourStarten(tour)}>
            Zeig’s mir
          </Button>
        ) : thema.key === 'tastenkuerzel' ? (
          <Button className="mt-5" kbd="?" onClick={() => setHilfeOffen(true)}>
            Tastenliste öffnen
          </Button>
        ) : null}
      </div>

      <div className="mt-8">
        <Bloecke bloecke={bloeckeVon(thema, person)} />
      </div>

      <nav aria-label="Weitere Themen" className="border-line mt-12 grid max-w-[64ch] grid-cols-2 gap-4 border-t pt-4">
        {vor ? (
          <Link to={PFADE.hilfe(vor.key)} className="group text-small text-ink-3 hover:text-ink grid gap-0.5">
            <span className="inline-flex items-center gap-1.5">
              <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
              Zurück
            </span>
            <span className="text-ui text-ink-2 group-hover:text-ink truncate-1">{vor.titel}</span>
          </Link>
        ) : (
          <span />
        )}
        {nach ? (
          <Link
            to={PFADE.hilfe(nach.key)}
            className="group text-small text-ink-3 hover:text-ink grid justify-items-end gap-0.5 text-right"
          >
            <span className="inline-flex items-center gap-1.5">
              Weiter
              <ArrowRight size={14} strokeWidth={1.75} aria-hidden />
            </span>
            <span className="text-ui text-ink-2 group-hover:text-ink truncate-1 max-w-full">{nach.titel}</span>
          </Link>
        ) : null}
      </nav>
    </div>
  )
}
