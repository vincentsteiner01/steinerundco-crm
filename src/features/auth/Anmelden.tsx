// oxlint-disable react/only-export-components -- sicheresZiel/MAX_VERSUCHE werden vom Test geprüft
import { Eye, EyeOff } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Input } from '@/components/ui/Input'
import { cn } from '@/components/ui/cn'
import { liesBleiben, setzeBleiben, supabase } from '@/data/supabase'
import { dateline } from '@/lib/format'
import { useHotkeys } from '@/lib/keyboard'
import { ALLGEMEIN } from '@/texte/de'
import { internesZiel } from '@/lib/url'
import { PFADE } from '@/app/pfade'
import { useAuth } from './authStore'
import { PERSONEN, PERSON_KEY, type PersonId } from './personen'

export const MAX_VERSUCHE = 5
export const SPERRE_S = 30

/** Rücksprungziel nur, wenn es mit `/` und nicht mit `//` beginnt (kein Open Redirect, § 1.5 Nr. 31). */
export function sicheresZiel(von: string | null): string {
  const ziel = internesZiel(von, PFADE.heute)
  return ziel.startsWith(PFADE.anmelden) ? PFADE.heute : ziel
}

function gemerktRoh(): string | null {
  try {
    return localStorage.getItem(PERSON_KEY)
  } catch {
    return null
  }
}

function gemerktePerson(): PersonId {
  return gemerktRoh() === 'mike' ? 'mike' : 'vincent'
}

/**
 * Login (DESIGN-SYSTEM § 6, reference.html „Login“): Vollbild canvas, Kopf Marke + Dateline, Mitte 400 px: Headline „Wer bist du?“,
 * zwei Personenkacheln (V/M), Passcode (Input L, Mono, Auge), Checkbox „Angemeldet bleiben“, Button L „Anmelden ↵“, Kleinzeile.
 * Kein vorbelegter Passcode, kein Technik-Footer.
 */
export function Component() {
  const status = useAuth((s) => s.status)
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const ziel = sicheresZiel(params.get('von'))

  const [person, setPerson] = useState<PersonId>(gemerktePerson)
  const [passcode, setPasscode] = useState('')
  const [sichtbar, setSichtbar] = useState(false)
  const [bleiben, setBleiben] = useState<boolean>(() => liesBleiben())
  const [fehler, setFehler] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)
  const [versuche, setVersuche] = useState(0)
  const [gesperrtBis, setGesperrtBis] = useState<number | null>(null)
  const [restSekunden, setRestSekunden] = useState(0)
  const feld = useRef<HTMLInputElement | null>(null)
  const kacheln = useRef<Partial<Record<PersonId, HTMLButtonElement | null>>>({})
  const [gemerkt] = useState(() => gemerktRoh() !== null)

  // L-07: gemerkte Person → Fokus im Passcode-Feld. Erster Besuch → Fokus auf der Kachel, damit `V`/`M` wählen (L-01) statt ins
  // Passcode-Feld zu tippen (Einzeltasten sind in Feldern aus) – Review
  useEffect(() => {
    if (gemerkt) feld.current?.focus()
    else kacheln.current[person]?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem(PERSON_KEY, person)
    } catch {
      /* ohne Storage keine Vorauswahl */
    }
  }, [person])
  useEffect(() => {
    if (!gesperrtBis) return
    const tick = () => {
      const rest = Math.max(0, Math.ceil((gesperrtBis - Date.now()) / 1000))
      setRestSekunden(rest)
      if (rest === 0) {
        setGesperrtBis(null)
        setVersuche(0)
        feld.current?.focus()
      }
    }
    tick()
    const t = window.setInterval(tick, 250)
    return () => window.clearInterval(t)
  }, [gesperrtBis])

  const waehle = (id: PersonId) => {
    setPerson(id)
    feld.current?.focus()
  }
  useHotkeys('global', { v: () => waehle('vincent'), m: () => waehle('mike') })

  if (status === 'mitglied') return <Navigate to={ziel} replace />

  const gesperrt = gesperrtBis !== null
  const gewaehlt = PERSONEN.find((p) => p.id === person) ?? PERSONEN[0]

  const absenden = async (e: FormEvent) => {
    e.preventDefault()
    if (gesperrt || laeuft) return
    if (passcode.length < 10) {
      setFehler(ALLGEMEIN.passcodeZuKurz) // L-02: clientseitig, ohne Request
      feld.current?.focus()
      return
    }
    setLaeuft(true)
    setFehler(null)
    setzeBleiben(bleiben) // § 1.5 Nr. 39: vor signInWithPassword, damit die Session im richtigen Speicher landet
    const { error } = await supabase.auth.signInWithPassword({ email: gewaehlt.email, password: passcode })
    setLaeuft(false)
    if (!error) {
      navigate(ziel, { replace: true })
      return
    }
    const code = (error as { code?: string }).code
    if (code === 'over_request_rate_limit') setFehler(ALLGEMEIN.zuVieleVersuche)
    else if (/fetch|network/i.test(error.message)) setFehler(ALLGEMEIN.keineVerbindung)
    else setFehler(ALLGEMEIN.passcodeFalsch) // L-03: Text bleibt im Feld, Fokus bleibt
    const n = versuche + 1
    setVersuche(n)
    if (n >= MAX_VERSUCHE) setGesperrtBis(Date.now() + SPERRE_S * 1000) // L-04
    feld.current?.focus()
  }

  return (
    <section
      className="p-gutter relative z-[1] grid min-h-dvh grid-rows-[auto_1fr_auto] max-md:px-4 max-md:py-5"
      aria-label="Anmelden"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-2.5">
          <span className="text-ink-bright font-serif text-[26px] leading-none italic">Steiner &amp; Co.</span>
          <span className="label">CRM</span>
        </div>
        {/* Dateline nach ux § 6.4 („Mittwoch, 14. Oktober 2026 · KW 42“); reference.html kürzt das Datum – ux gilt für Wortlaut. */}
        <span className="text-ink-3 tnum font-mono text-[12.5px] tracking-[0.02em]">
          {dateline()} · crm.steinerundco.de
        </span>
      </header>

      <div className="grid place-items-center py-12">
        <form className="w-[min(100%,400px)]" onSubmit={absenden} noValidate>
          <h1 className="headline mb-7">{ALLGEMEIN.werBistDu}</h1>

          <div className="mb-5 grid grid-cols-2 gap-2.5" role="group" aria-label="Person wählen">
            {PERSONEN.map((p) => {
              const aktiv = p.id === person
              return (
                <button
                  key={p.id}
                  ref={(el) => {
                    kacheln.current[p.id] = el
                  }}
                  type="button"
                  aria-pressed={aktiv}
                  onClick={() => waehle(p.id)}
                  className={cn(
                    'ease-brand hover:bg-surface-raised grid gap-3.5 rounded-md border px-4 pt-[18px] pb-4 text-left transition-[border-color,background] duration-[var(--t-1)]',
                    aktiv ? 'border-ink bg-surface-raised' : 'border-line-strong',
                  )}
                >
                  <span className="text-ink-bright tnum font-mono text-[28px] leading-none font-medium tracking-[-0.02em]">
                    {p.initialen}
                  </span>
                  <span className="grid gap-0.5">
                    <span className="font-strong text-[15px] leading-tight">{p.name}</span>
                    <span className="text-small text-ink-3">
                      {p.rolle} · <kbd className="kbd">{p.taste}</kbd>
                    </span>
                  </span>
                </button>
              )
            })}
          </div>

          <div className="mb-3.5 grid gap-1.5">
            <label className="label block" htmlFor="passcode">
              {ALLGEMEIN.passcode}
            </label>
            <Input
              ref={feld}
              id="passcode"
              type={sichtbar ? 'text' : 'password'}
              groesse="L"
              mono
              className="tracking-[0.3em] placeholder:tracking-[0.3em]"
              placeholder="••••••••••"
              autoComplete="current-password"
              minLength={10}
              value={passcode}
              onChange={(e) => {
                setPasscode(e.target.value)
                if (fehler) setFehler(null)
              }}
              disabled={gesperrt}
              aria-describedby="passcode-hinweis"
              fehler={fehler ?? undefined}
              rechts={
                <Button
                  variante="icon"
                  className="h-7 w-7"
                  aria-label={sichtbar ? 'Passcode verbergen' : 'Passcode anzeigen'}
                  aria-pressed={sichtbar}
                  onClick={() => setSichtbar((s) => !s)}
                  tabIndex={-1}
                >
                  {sichtbar ? (
                    <EyeOff size={16} strokeWidth={1.75} aria-hidden />
                  ) : (
                    <Eye size={16} strokeWidth={1.75} aria-hidden />
                  )}
                </Button>
              }
            />
            {!fehler ? (
              <span id="passcode-hinweis" className="text-small text-ink-3">
                {ALLGEMEIN.passcodeZuKurz}
              </span>
            ) : null}
          </div>

          <Checkbox
            className="mb-5"
            label={ALLGEMEIN.angemeldetBleiben}
            checked={bleiben}
            onChange={(e) => {
              setBleiben(e.target.checked)
              setzeBleiben(e.target.checked)
            }}
          />

          <Button
            type="submit"
            variante="primary"
            groesse="L"
            className="w-full"
            kbd={gesperrt ? undefined : '↵'}
            disabled={gesperrt}
            busy={laeuft}
          >
            {gesperrt ? ALLGEMEIN.nochmalIn(restSekunden) : ALLGEMEIN.anmelden}
          </Button>
          {gesperrt ? (
            <p className="sr-only" role="status" aria-live="polite">
              {ALLGEMEIN.nochmalIn(restSekunden)}
            </p>
          ) : null}

          <p className="text-small text-ink-3 mt-[18px]">{ALLGEMEIN.passcodeVergessen}</p>
        </form>
      </div>

      <footer className="text-small text-ink-3">{ALLGEMEIN.nurFuer}</footer>
    </section>
  )
}
