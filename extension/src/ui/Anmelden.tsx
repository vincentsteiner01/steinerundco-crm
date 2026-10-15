// Anmeldung wie im CRM (Login „Wer bist du?“): zwei Personenkacheln mit Foto, Passcode, „Angemeldet bleiben“.
// Der Passcode geht nur an den Service Worker (supabase.auth.signInWithPassword) und wird nirgends gespeichert.
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { PERSONEN } from '@/features/auth/personen'
import { ALLGEMEIN } from '@/texte/de'
import { SPEICHER } from '../shared/konfig'
import type { PersonId, Sitzung } from '../shared/typen'
import { fehlerText, lies, schreibe, senden } from './api'
import { Avatar, istEingabe, Knopf } from './teile'

const MAX_VERSUCHE = 5
const SPERRE_S = 30

export function Anmelden({ onAngemeldet, kompakt = false }: { onAngemeldet: (s: Sitzung) => void; kompakt?: boolean }) {
  const [person, setPerson] = useState<PersonId>('vincent')
  const [passcode, setPasscode] = useState('')
  const [sichtbar, setSichtbar] = useState(false)
  const [bleiben, setBleiben] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)
  const [versuche, setVersuche] = useState(0)
  const [gesperrtBis, setGesperrtBis] = useState<number | null>(null)
  const [rest, setRest] = useState(0)
  const feld = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    void lies<string>(SPEICHER.person, 'vincent').then((p) => setPerson(p === 'mike' ? 'mike' : 'vincent'))
    void lies<string>(SPEICHER.bleiben, 'ja').then((b) => setBleiben(b !== 'nein'))
    feld.current?.focus()
  }, [])

  useEffect(() => {
    if (!gesperrtBis) return
    const tick = () => {
      const r = Math.max(0, Math.ceil((gesperrtBis - Date.now()) / 1000))
      setRest(r)
      if (r === 0) {
        setGesperrtBis(null)
        setVersuche(0)
      }
    }
    tick()
    const t = window.setInterval(tick, 250)
    return () => window.clearInterval(t)
  }, [gesperrtBis])

  const waehle = (p: PersonId) => {
    setPerson(p)
    void schreibe(SPEICHER.person, p)
    feld.current?.focus()
  }

  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (istEingabe(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'v' || e.key === 'V') waehle('vincent')
      if (e.key === 'm' || e.key === 'M') waehle('mike')
    }
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  }, [])

  const absenden = async (e: FormEvent) => {
    e.preventDefault()
    if (laeuft || gesperrtBis) return
    if (passcode.length < 10) {
      setFehler(ALLGEMEIN.passcodeZuKurz)
      feld.current?.focus()
      return
    }
    setLaeuft(true)
    setFehler(null)
    try {
      const s = await senden('anmelden', { person, passcode, bleiben })
      setPasscode('')
      onAngemeldet(s)
    } catch (err) {
      setFehler(fehlerText(err))
      const n = versuche + 1
      setVersuche(n)
      if (n >= MAX_VERSUCHE) setGesperrtBis(Date.now() + SPERRE_S * 1000)
      feld.current?.focus()
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <form className="stapel" style={{ gap: 14 }} onSubmit={absenden} noValidate aria-label="Anmelden">
      {kompakt ? (
        <p className="klein ink-2" style={{ margin: 0 }}>
          Melde dich an, dann zeigt die Leiste, was das CRM zu dieser Person weiß.
        </p>
      ) : (
        <h1 className="name" style={{ fontSize: 26 }}>
          {ALLGEMEIN.werBistDu}
        </h1>
      )}
      <div className="kacheln" role="group" aria-label="Person wählen">
        {PERSONEN.map((p) => (
          <button
            key={p.id}
            type="button"
            className="kachel"
            aria-pressed={person === p.id}
            onClick={() => waehle(p.id)}
          >
            <Avatar member={{ kuerzel: p.initialen, personId: p.id, name: p.name }} groesse={36} />
            <span className="stapel" style={{ gap: 2 }}>
              <span style={{ fontWeight: 550, fontSize: 15 }}>{p.name}</span>
              <span className="klein ink-3">
                {p.rolle} · <kbd>{p.taste}</kbd>
              </span>
            </span>
          </button>
        ))}
      </div>
      <label className="feld">
        <span>{ALLGEMEIN.passcode}</span>
        <span className="passcode-feld">
          <input
            ref={feld}
            className="eingabe passcode"
            type={sichtbar ? 'text' : 'password'}
            autoComplete="current-password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            aria-invalid={!!fehler}
          />
          <button type="button" onClick={() => setSichtbar((s) => !s)} aria-label={sichtbar ? 'Passcode verbergen' : 'Passcode zeigen'}>
            {sichtbar ? 'verbergen' : 'zeigen'}
          </button>
        </span>
      </label>
      <label className="haken">
        <input type="checkbox" checked={bleiben} onChange={(e) => setBleiben(e.target.checked)} />
        <span>{ALLGEMEIN.angemeldetBleiben}</span>
      </label>
      {fehler ? (
        <p className="fehler" role="alert" style={{ margin: 0 }}>
          {fehler}
        </p>
      ) : null}
      <Knopf art="primaer" groesse="gross" voll type="submit" disabled={laeuft || !!gesperrtBis} taste={gesperrtBis ? undefined : '↵'}>
        {gesperrtBis ? ALLGEMEIN.nochmalIn(rest) : laeuft ? 'Melde an …' : ALLGEMEIN.anmelden}
      </Knopf>
      <p className="klein ink-3" style={{ margin: 0 }}>
        {ALLGEMEIN.nurFuer}
      </p>
    </form>
  )
}
