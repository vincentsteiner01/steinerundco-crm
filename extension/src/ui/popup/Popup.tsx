// Popup (Klick auf das S&-Symbol): Anmeldung, angemeldete Person mit Foto, Zahlen für heute, Seitenleiste öffnen, CRM öffnen.
import { useCallback, useEffect, useState } from 'react'
import { ALLGEMEIN } from '@/texte/de'
import { crmLink, PFAD } from '../../shared/konfig'
import type { HeuteZahlen, Sitzung } from '../../shared/typen'
import { Anmelden } from '../Anmelden'
import { beiSitzungswechsel, crmBasis, eingangOeffnen, fehlerText, oeffne, senden } from '../api'
import { Avatar, Knopf, Laden } from '../teile'

export function Popup() {
  const [sitzung, setSitzung] = useState<Sitzung | null>(null)
  const [zahlen, setZahlen] = useState<HeuteZahlen | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)

  const laden = useCallback(async () => {
    setFehler(null)
    try {
      const s = await senden('sitzung', {})
      setSitzung(s)
      if (s.angemeldet) setZahlen(await senden('heute', {}))
    } catch (e) {
      setFehler(fehlerText(e))
      setSitzung((alt) => alt ?? { angemeldet: false })
    }
  }, [])

  useEffect(() => {
    void laden()
    return beiSitzungswechsel(() => void laden())
  }, [laden])

  // Fenster vorab ermitteln: sidePanel.open muss direkt im Klick laufen (Nutzergeste), ohne await davor
  const [fensterId, setFensterId] = useState<number | null>(null)
  useEffect(() => {
    void chrome.windows.getCurrent().then((w) => setFensterId(w.id ?? null))
  }, [])
  const seitenleiste = () => {
    if (fensterId === null) return
    chrome.sidePanel.open({ windowId: fensterId }).then(
      () => window.close(),
      () => setFehler('Die Seitenleiste lässt sich hier nicht öffnen – versuch ⌥C.'),
    )
  }

  const crm = async () => oeffne(crmLink(await crmBasis(), PFAD.heute))

  const abmelden = async () => {
    try {
      setSitzung(await senden('abmelden', {}))
      setZahlen(null)
    } catch (e) {
      setFehler(fehlerText(e))
    }
  }

  return (
    <main>
      <header className="kopf">
        <span className="links">
          <span className="marke">
            <img src="/icons/icon-32.png" alt="" />
            Steiner &amp; Co.
          </span>
          <span className="label">CRM</span>
        </span>
        <button className="knopf leise klein" type="button" onClick={() => void chrome.runtime.openOptionsPage()}>
          Einstellungen
        </button>
      </header>

      {!sitzung ? (
        <section className="abschnitt">
          <Laden />
        </section>
      ) : !sitzung.angemeldet ? (
        <section className="abschnitt">
          <Anmelden onAngemeldet={(s) => (setSitzung(s), void laden())} />
        </section>
      ) : (
        <>
          <section className="abschnitt stapel" style={{ gap: 14 }}>
            <div className="reihe" style={{ gap: 12, flexWrap: 'nowrap' }}>
              <Avatar member={sitzung.ich} groesse={48} />
              <div className="stapel" style={{ gap: 2, minWidth: 0 }}>
                <p className="name" style={{ fontSize: 20 }}>
                  {sitzung.ich.name}
                </p>
                <span className="klein ink-3">{ALLGEMEIN.angemeldet}</span>
              </div>
            </div>
            <div className="zahlen" aria-label="Heute">
              <div className="zahl">
                <b className={zahlen && zahlen.linkedinFaellig > 0 ? 'lime' : ''}>{zahlen ? zahlen.linkedinFaellig : '–'}</b>
                <span className="klein ink-2">fällige LinkedIn-Schritte</span>
                {zahlen && zahlen.linkedinUeberfaellig > 0 ? (
                  <span className="mono-s amber">davon {zahlen.linkedinUeberfaellig} überfällig</span>
                ) : null}
              </div>
              <div className="zahl">
                <b>{zahlen ? zahlen.antwortenOffen : '–'}</b>
                <span className="klein ink-2">Antworten offen</span>
                {zahlen && zahlen.annahmePruefen > 0 ? (
                  <span className="mono-s ink-3">{zahlen.annahmePruefen} Annahmen prüfen</span>
                ) : null}
              </div>
            </div>
            {zahlen && zahlen.eingangOffen > 0 ? (
              <div className="hinweis reihe" style={{ justifyContent: 'space-between', flexWrap: 'nowrap', padding: '8px 10px 8px 14px' }}>
                <span className="klein">
                  <span className="mono-s amber tnum">{zahlen.eingangOffen}</span> aus LinkedIn-Mails offen
                </span>
                <Knopf groesse="klein" onClick={() => (eingangOeffnen(), window.close())}>
                  Eingang ansehen
                </Knopf>
              </div>
            ) : null}
            <div className="stapel" style={{ gap: 8 }}>
              <Knopf art="primaer" voll groesse="gross" taste="⌥C" onClick={seitenleiste}>
                Seitenleiste öffnen
              </Knopf>
              <div className="knopf-reihe">
                <Knopf className="wachsen" onClick={() => void crm()}>
                  CRM öffnen ↗
                </Knopf>
                <Knopf art="leise" onClick={() => void abmelden()}>
                  {ALLGEMEIN.abmelden}
                </Knopf>
              </div>
            </div>
          </section>
        </>
      )}
      {fehler ? (
        <p className="fehler" role="alert" style={{ margin: 0, padding: '0 16px 12px' }}>
          {fehler}
        </p>
      ) : null}
      <footer className="fuss">Liest LinkedIn nur, wenn die Seitenleiste offen ist. Sendet dort nie etwas.</footer>
    </main>
  )
}
