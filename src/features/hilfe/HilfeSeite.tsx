// Hilfe (`/hilfe`, `/hilfe/:thema`): kurzes Handbuch. Links Suche + Themenliste (sticky), rechts der Lesetext auf 64 ch
// (Titel, ein Satz Voice, Blöcke aus themen.ts).
// `/hilfe` ohne Thema: häufige Fragen. Mobil: `/hilfe` = Fragen + Suche + Liste, `/hilfe/:thema` = nur Text mit „← Alle Themen“.
// 25.11.2026 (Neustart): sieben kurze Themen; Touren, Feedback-Verweise und Tastenhinweise sind entfallen. Kopf wie auf Leads,
// Leitfäden, Team und Einstellungen (nur der Titel – keine Datumszeile, keine Themen-Nummern, kleinste Schrift 13 px).
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, Navigate, NavLink, useNavigate, useParams } from 'react-router'
import { PFADE } from '@/app/pfade'
import { personVon } from '@/components/ui/Avatar'
import { cn } from '@/components/ui/cn'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/features/auth/authStore'
import type { PersonId } from '@/features/auth/personen'
import { Bloecke } from './Bloecke'
import { Inline } from './Inline'
import { bloeckeVon, HAEUFIGE_FRAGEN, sucheThemen, THEMEN, themaVon, type Thema } from './themen'

export function Component() {
  const { thema: key } = useParams()
  const thema = themaVon(key)
  const member = useAuth((s) => s.member)
  const person = personVon(member)?.id ?? null
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const treffer = useMemo(() => sucheThemen(q, person), [q, person])

  if (key && !thema) return <Navigate to={PFADE.hilfe()} replace />

  return (
    <>
      <header className="pt-7 pb-6 max-md:pt-5 max-md:pb-5">
        <h1 className="headline flex min-h-11 items-center">Hilfe</h1>
      </header>
      <div className="grid gap-x-12 gap-y-8 md:grid-cols-[232px_minmax(0,1fr)]">
        <aside
          aria-label="Themen"
          className={cn(
            'grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-3 md:sticky md:top-6 md:max-h-[calc(100dvh-48px)] md:self-start md:overflow-auto',
            thema && 'max-md:hidden',
            // Telefon: erst Einleitung und häufige Fragen, das Themenverzeichnis darunter
            'max-md:order-last',
          )}
        >
          <Input
            type="search"
            aria-label="Hilfe durchsuchen"
            placeholder="Hilfe durchsuchen …"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && treffer[0]) navigate(PFADE.hilfe(treffer[0].key))
            }}
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
                    <span className="min-w-0">{t.titel}</span>
                  </NavLink>
                </li>
              ))}
            </ol>
            {treffer.length === 0 ? (
              <p className="text-small text-ink-3 px-2.5 py-3">Nichts gefunden.</p>
            ) : q ? (
              <p className="text-small text-ink-3 tnum px-2.5 pt-2">
                {treffer.length === 1 ? '1 Thema' : `${treffer.length} Themen`}
              </p>
            ) : null}
          </nav>
        </aside>

        {/* Telefon, Übersicht: darunter folgt das Themenverzeichnis – kein Abstand für die Tab-Leiste dazwischen */}
        <article className={cn('min-w-0 pb-8', thema ? 'max-md:pb-20' : 'max-md:pb-0')} aria-labelledby="hilfe-titel">
          {thema ? <ThemaText thema={thema} person={person} /> : <Uebersicht />}
        </article>
      </div>
    </>
  )
}

function Uebersicht() {
  return (
    <div className="max-w-[64ch]">
      <span className="text-small text-ink-3 font-medium">Handbuch</span>
      <h2
        id="hilfe-titel"
        className="text-ink-bright mt-2 text-[30px] leading-[1.15] font-bold tracking-[-0.02em] max-md:text-[26px]"
      >
        So funktioniert das CRM.
      </h2>
      <p className="voice mt-3">Kurz erklärt, zum Nachschlagen.</p>

      <h3 className="text-small text-ink-3 mt-10 mb-1 font-medium">Häufige Fragen</h3>
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
    </div>
  )
}

function ThemaText({ thema, person }: { thema: Thema; person: PersonId | null }) {
  const i = THEMEN.indexOf(thema)
  const vor = THEMEN[i - 1]
  const nach = THEMEN[i + 1]
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
        <h2
          id="hilfe-titel"
          className="text-ink-bright text-[30px] leading-[1.15] font-bold tracking-[-0.02em] max-md:text-[26px]"
        >
          {thema.titel}
        </h2>
        <p className="voice mt-3">
          <Inline text={thema.kurz} />
        </p>
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
