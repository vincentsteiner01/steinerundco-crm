// Nachrichten-Block (DESIGN-SYSTEM § 5.7 Nr. 5/6): gefüllte Vorlage, offene Platzhalter in Amber und direkt editierbar,
// „Text bearbeiten“, Kopieren (gesperrt, solange Platzhalter offen sind) und „Gesendet“ erst nach dem Kopieren.
import { Fragment, useEffect, useMemo, useState } from 'react'
import { fmtZeit } from '@/lib/format'
import { fuellen, type PlatzhalterLead, type PlatzhalterMe } from '@/lib/platzhalter'
import { fuelleVorlage, offeneImText } from '../../shared/nachricht'
import type { VorlageInfo } from '../../shared/typen'
import { kopiere } from '../api'
import { istEingabe, Knopf } from '../teile'

export function NaechsteNachricht({
  vorlage,
  lead,
  me,
  kopf,
  gesperrt,
  tastenAktiv,
  onGesendet,
}: {
  vorlage: VorlageInfo
  lead: PlatzhalterLead
  me: PlatzhalterMe | null
  kopf: string
  /** Grund, warum kein Kontakt erlaubt ist (Gate) – sperrt Kopieren und Gesendet */
  gesperrt: string | null
  tastenAktiv: boolean
  onGesendet: (templateId: string) => Promise<boolean>
}) {
  const [werte, setWerte] = useState<Record<string, string>>({})
  const [freitext, setFreitext] = useState<string | null>(null)
  const [kopiertUm, setKopiertUm] = useState<string | null>(null)
  const [frisch, setFrisch] = useState(false)
  const [hinweis, setHinweis] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)

  const f = useMemo(() => fuelleVorlage(vorlage.body, lead, me, werte), [vorlage.body, lead, me, werte])
  // Platzhalter, die ohne Eingabe offen wären, bleiben Eingabefelder – auch während des Tippens
  const manuell = useMemo(() => new Set(fuellen(vorlage.body, lead, { me, werte: {} }).offen), [vorlage.body, lead, me])
  const text = freitext ?? f.text
  const offen = freitext !== null ? offeneImText(freitext) : f.offen
  const gefuellt = f.alle.length - f.offen.length

  const kopieren = async () => {
    if (gesperrt) return
    if (offen.length > 0) {
      setHinweis(`Erst [${offen[0]}] eintragen.`)
      return
    }
    const ok = await kopiere(text)
    if (!ok) {
      setHinweis('Kopieren ging nicht – Text markieren und ⌘C drücken.')
      return
    }
    setHinweis(null)
    setKopiertUm(fmtZeit(new Date()))
    setFrisch(true)
    window.setTimeout(() => setFrisch(false), 2000)
  }

  const gesendet = async () => {
    if (!kopiertUm || gesperrt || laeuft) return
    setLaeuft(true)
    const ok = await onGesendet(vorlage.id)
    setLaeuft(false)
    if (ok) setKopiertUm(null)
  }

  useEffect(() => {
    if (!tastenAktiv) return
    const taste = (e: KeyboardEvent) => {
      if (istEingabe(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault()
        void kopieren()
      }
      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault()
        void gesendet()
      }
    }
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  })

  return (
    <div className="stapel" style={{ gap: 10 }}>
      <div className="nachricht">
        <div className="nachricht-kopf">
          <span>
            {kopf}
            {f.alle.length > 0 && freitext === null ? ` · Platzhalter ${gefuellt}/${f.alle.length}` : ''}
            {freitext !== null ? ' · bearbeitet' : ''}
          </span>
          <button type="button" onClick={() => setFreitext((t) => (t === null ? f.text : null))}>
            {freitext === null ? 'Text bearbeiten' : 'Vorlage'}
          </button>
        </div>
        {freitext !== null ? (
          <textarea
            aria-label="Nachricht bearbeiten"
            value={freitext}
            onChange={(e) => setFreitext(e.target.value)}
          />
        ) : (
          <div className="nachricht-text" aria-label="Nachricht">
            {f.teile.map((t, i) =>
              t.art === 'text' ? (
                <Fragment key={i}>{t.text}</Fragment>
              ) : manuell.has(t.name) ? (
                <input
                  key={i}
                  className="ph-offen"
                  aria-label={`Platzhalter ${t.name}`}
                  placeholder={t.name}
                  value={werte[t.name] ?? ''}
                  size={Math.max(t.name.length, (werte[t.name] ?? '').length) + 1}
                  style={werte[t.name] ? { borderStyle: 'solid', color: 'var(--ink)', background: 'transparent' } : undefined}
                  onChange={(e) => setWerte((w) => ({ ...w, [t.name]: e.target.value }))}
                />
              ) : (
                <mark key={i} className="ph" title={`aus ${t.name}`}>
                  {t.wert ?? `[${t.name}]`}
                </mark>
              ),
            )}
          </div>
        )}
      </div>
      <div className="knopf-reihe">
        <Knopf
          art={kopiertUm && !frisch ? 'sekundaer' : 'primaer'}
          className={`wachsen ${frisch ? 'kopiert' : ''}`}
          taste="C"
          disabled={!!gesperrt}
          title={gesperrt ?? (offen.length ? `Erst [${offen[0]}] eintragen` : undefined)}
          onClick={() => void kopieren()}
        >
          {frisch ? 'Kopiert' : 'Kopieren'}
        </Knopf>
        <Knopf
          art={kopiertUm && !frisch ? 'primaer' : 'sekundaer'}
          className="wachsen"
          taste="E"
          disabled={!kopiertUm || !!gesperrt || laeuft}
          title={kopiertUm ? undefined : 'Erst kopieren und in LinkedIn senden'}
          onClick={() => void gesendet()}
        >
          {laeuft ? 'Speichere …' : 'Gesendet'}
        </Knopf>
      </div>
      {gesperrt ? <p className="fehler" style={{ margin: 0 }}>{gesperrt} – kein Kontakt.</p> : null}
      {hinweis ? (
        <p className="klein amber" role="status" style={{ margin: 0 }}>
          {hinweis}
        </p>
      ) : null}
      {kopiertUm ? (
        <p className="mono-s ink-3" style={{ margin: 0 }}>
          kopiert {kopiertUm} · jetzt in LinkedIn einfügen und senden – dann E drücken.
        </p>
      ) : null}
    </div>
  )
}
