// Einstellungen: CRM-Adresse (Live oder lokal), LinkedIn-Mails ins CRM (eigenes Profil, Eingangs-Schlüssel), Tastenkürzel, Grundsätze.
import { useEffect, useState } from 'react'
import { CRM_LIVE, CRM_LOKAL, pruefeCrmBasis, SPEICHER } from '../../shared/konfig'
import type { EingangEinstellungen } from '../../shared/typen'
import { crmBasis, eingangOeffnen, fehlerText, kopiere, schreibe, senden } from '../api'
import { seit } from '../../shared/zeit'
import { Knopf } from '../teile'

/** Abschnitt „LinkedIn-Mails ins CRM“: eigenes LinkedIn-Profil (damit die Mail-Erkennung es nicht für einen Lead hält) und
 *  der Eingangs-Schlüssel für das Apps Script – erzeugt im Namen der angemeldeten Person, nur einmal sichtbar, gleich kopiert. */
function MailsInsCrm() {
  const [e, setE] = useState<EingangEinstellungen | null>(null)
  const [profil, setProfil] = useState('')
  const [neu, setNeu] = useState<string | null>(null)
  const [meldung, setMeldung] = useState<{ text: string; fehler: boolean } | null>(null)
  const [laeuft, setLaeuft] = useState<string | null>(null)

  useEffect(() => {
    senden('eingangEinstellungen', {}).then(
      (x) => (setE(x), setProfil(x.profilUrl ?? '')),
      (err) => setMeldung({ text: fehlerText(err), fehler: true }),
    )
  }, [])

  const tun = async (name: string, f: () => Promise<void>) => {
    setLaeuft(name)
    setMeldung(null)
    try {
      await f()
    } catch (err) {
      setMeldung({ text: fehlerText(err), fehler: true })
    } finally {
      setLaeuft(null)
    }
  }

  const profilSpeichern = () =>
    tun('profil', async () => {
      const x = await senden('eingangProfil', { profilUrl: profil.trim() || null })
      setE(x)
      setProfil(x.profilUrl ?? '')
      setMeldung({ text: x.profilUrl ? 'Profil gespeichert.' : 'Profil entfernt.', fehler: false })
    })

  const erzeugen = () => {
    if (e?.schluessel && !window.confirm('Ein neuer Schlüssel macht den bisherigen sofort ungültig. Weiter?')) return
    void tun('erzeugen', async () => {
      const r = await senden('eingangSchluessel', { aktion: 'erzeugen' })
      setE(r.einstellungen)
      setNeu(r.schluessel)
      const ok = r.schluessel ? await kopiere(r.schluessel) : false
      setMeldung({
        text: ok ? 'Neuer Schlüssel ist in der Zwischenablage.' : 'Neuer Schlüssel erzeugt – unten kopieren.',
        fehler: false,
      })
    })
  }

  const widerrufen = () => {
    if (!window.confirm('Schlüssel widerrufen? Das Apps Script überträgt danach nichts mehr, bis du einen neuen einträgst.')) return
    void tun('widerrufen', async () => {
      const r = await senden('eingangSchluessel', { aktion: 'widerrufen' })
      setE(r.einstellungen)
      setNeu(null)
      setMeldung({ text: 'Schlüssel widerrufen.', fehler: false })
    })
  }

  return (
    <section className="stapel" style={{ gap: 12, padding: '20px 0', borderBottom: '1px solid var(--line)' }}>
      <span className="label">LinkedIn-Mails ins CRM</span>
      <p className="klein ink-2" style={{ margin: 0 }}>
        Ein Google-Script in deinem eigenen Gmail schickt LinkedIn-Benachrichtigungen („… hat Ihre Einladung angenommen“,
        „Neue Nachricht von …“) alle 5 Minuten ans CRM. Einrichtung: tools/apps-script/ANLEITUNG.md.
      </p>

      <label className="feld">
        <span>Dein LinkedIn-Profil</span>
        <span className="reihe" style={{ flexWrap: 'nowrap' }}>
          <input
            className="eingabe mono"
            placeholder="linkedin.com/in/dein-name"
            value={profil}
            onChange={(x) => setProfil(x.target.value)}
          />
          <Knopf disabled={!e || laeuft === 'profil'} onClick={() => void profilSpeichern()}>
            {laeuft === 'profil' ? 'Speichere …' : 'Speichern'}
          </Knopf>
        </span>
      </label>
      <p className="klein ink-3" style={{ margin: '-4px 0 0' }}>
        LinkedIn verlinkt in jeder Mail auch dein eigenes Profil. Mit deiner Adresse hält das CRM es nie für einen Lead.
      </p>

      <div className="stapel" style={{ gap: 8 }}>
        <span className="feld">
          <span>Eingangs-Schlüssel</span>
        </span>
        <p className="klein ink-2" style={{ margin: 0 }}>
          {!e
            ? 'Lade …'
            : e.schluessel
              ? `Aktiv seit ${new Date(e.schluessel.erstelltAm).toLocaleDateString('de-DE')} · Apps Script zuletzt gemeldet: ${seit(e.schluessel.zuletztGenutzt)}`
              : 'Noch kein Schlüssel – erzeuge einen und trag ihn im Apps Script als Skripteigenschaft CRM_SCHLUESSEL ein.'}
        </p>
        <div className="knopf-reihe">
          <Knopf art={e?.schluessel ? 'sekundaer' : 'primaer'} disabled={!e || !!laeuft} onClick={erzeugen}>
            {laeuft === 'erzeugen' ? 'Erzeuge …' : e?.schluessel ? 'Neuen Schlüssel erzeugen' : 'Schlüssel erzeugen'}
          </Knopf>
          {e?.schluessel ? (
            <Knopf art="leise" disabled={!!laeuft} onClick={widerrufen}>
              Widerrufen
            </Knopf>
          ) : null}
          <Knopf art="leise" onClick={eingangOeffnen}>
            Eingang ansehen ↗
          </Knopf>
        </div>
        {neu ? (
          <div className="hinweis stapel" style={{ gap: 8 }}>
            <span className="klein">
              Nur jetzt sichtbar. Direkt in die Skripteigenschaft <span className="mono">CRM_SCHLUESSEL</span> einfügen – nicht in
              Dateien oder Chats. Wer ihn hat, kann in deinem Namen Annahmen und Antworten ins CRM buchen.
            </span>
            <input className="eingabe mono" readOnly value={neu} onFocus={(x) => x.target.select()} aria-label="Neuer Eingangs-Schlüssel" />
            <span className="knopf-reihe">
              <Knopf onClick={() => void kopiere(neu).then((ok) => setMeldung({ text: ok ? 'Kopiert.' : 'Kopieren ging nicht – markieren und ⌘C.', fehler: !ok }))}>
                Kopieren
              </Knopf>
              <Knopf art="leise" onClick={() => setNeu(null)}>
                Ausblenden
              </Knopf>
            </span>
          </div>
        ) : null}
      </div>
      {meldung ? (
        <p className={meldung.fehler ? 'fehler' : 'klein ink-2'} role="status" style={{ margin: 0 }}>
          {meldung.text}
        </p>
      ) : null}
    </section>
  )
}

export function Optionen() {
  const [basis, setBasis] = useState(CRM_LIVE)
  const [eigen, setEigen] = useState('')
  const [meldung, setMeldung] = useState<{ text: string; fehler: boolean } | null>(null)

  useEffect(() => {
    void crmBasis().then((b) => {
      setBasis(b)
      if (b !== CRM_LIVE && b !== CRM_LOKAL) setEigen(b)
    })
  }, [])

  const speichern = async (wert: string) => {
    const b = pruefeCrmBasis(wert)
    if (!b) {
      setMeldung({ text: 'Nur https://… oder http://localhost:… – ohne Pfad.', fehler: true })
      return
    }
    await schreibe(SPEICHER.crmBasis, b)
    setBasis(b)
    setMeldung({ text: `Gespeichert: ${b}`, fehler: false })
  }

  return (
    <main style={{ maxWidth: 560, padding: '32px 24px' }} className="stapel">
      <header className="stapel" style={{ gap: 4, marginBottom: 20 }}>
        <span className="label">Steiner &amp; Co. CRM für LinkedIn</span>
        <h1 className="name" style={{ fontSize: 32 }}>
          Einstellungen
        </h1>
      </header>

      <section className="stapel" style={{ gap: 12, paddingBottom: 20, borderBottom: '1px solid var(--line)' }}>
        <span className="label">CRM-Adresse</span>
        <p className="klein ink-2" style={{ margin: 0 }}>
          Wohin „CRM öffnen“ und „Im CRM öffnen“ führen. Die Daten kommen immer aus demselben Supabase-Projekt.
        </p>
        <div className="segment" role="group" aria-label="CRM-Adresse" style={{ width: 'fit-content' }}>
          <button type="button" aria-pressed={basis === CRM_LIVE} onClick={() => void speichern(CRM_LIVE)}>
            Live · crm.steinerundco.de
          </button>
          <button type="button" aria-pressed={basis === CRM_LOKAL} onClick={() => void speichern(CRM_LOKAL)}>
            Lokal · localhost:8768
          </button>
        </div>
        <label className="feld">
          <span>Eigene Adresse</span>
          <span className="reihe" style={{ flexWrap: 'nowrap' }}>
            <input
              className="eingabe mono"
              placeholder="https://…"
              value={eigen}
              onChange={(e) => setEigen(e.target.value)}
            />
            <Knopf onClick={() => void speichern(eigen)}>Speichern</Knopf>
          </span>
        </label>
        {meldung ? (
          <p className={meldung.fehler ? 'fehler' : 'klein ink-2'} role="status" style={{ margin: 0 }}>
            {meldung.text}
          </p>
        ) : null}
      </section>

      <MailsInsCrm />

      <section className="stapel" style={{ gap: 10, padding: '20px 0', borderBottom: '1px solid var(--line)' }}>
        <span className="label">Tastenkürzel</span>
        <p className="klein ink-2" style={{ margin: 0 }}>
          <kbd>⌥C</kbd> öffnet die Seitenleiste. In der Leiste: <kbd>C</kbd> Kopieren · <kbd>E</kbd> Gesendet ·{' '}
          <kbd>A</kbd> Antwort erhalten · <kbd>N</kbd> Notiz · <kbd>O</kbd> Im CRM öffnen · <kbd>Z</kbd> Rückgängig ·{' '}
          <kbd>R</kbd> neu lesen.
        </p>
        <div>
          <Knopf groesse="klein" onClick={() => void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })}>
            Kürzel ändern ↗
          </Knopf>
        </div>
      </section>

      <section className="stapel" style={{ gap: 8, paddingTop: 20 }}>
        <span className="label">Was die Erweiterung tut – und was nie</span>
        <p className="klein ink-2" style={{ margin: 0 }}>
          Sie liest die LinkedIn-Seite, die du gerade ansiehst – nur solange die Seitenleiste offen ist oder du klickst.
          Sie klickt, tippt, sendet und navigiert nie auf LinkedIn und ruft keine weiteren Seiten ab. Nachrichten sendest
          du selbst; die Erweiterung trägt nur ins CRM ein, was du bestätigst.
        </p>
      </section>
    </main>
  )
}
