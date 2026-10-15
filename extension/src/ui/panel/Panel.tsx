// Seitenleiste neben LinkedIn: wer die Person im CRM ist und die nächste vorbereitete Nachricht.
// Liest nur die sichtbare Seite, solange die Leiste offen ist; alles andere passiert erst auf Klick oder Taste.
import { useCallback, useEffect, useRef, useState } from 'react'
import { CRM_LIVE, istLinkedin } from '../../shared/konfig'
import type { Erledigt, Extrakt, HeuteZahlen, LeadAnsicht, Rueckgabe, Sitzung, SuchErgebnis } from '../../shared/typen'
import { Anmelden } from '../Anmelden'
import { beiSitzungswechsel, crmBasis, eingangOeffnen, fehlerText, senden } from '../api'
import { Avatar, istEingabe, Knopf, Laden } from '../teile'
import { LeadKarte } from './LeadKarte'
import { NichtImCrm } from './NichtImCrm'
import { aktiverTab, beobachteTabs, leseTab, tabAusAdresse, type TabInfo } from './seite'

const UNDO_MS = 6000

type Suche =
  | { schluessel: string; status: 'laedt' }
  | { schluessel: string; status: 'fertig'; ergebnis: SuchErgebnis }
  | { schluessel: string; status: 'fehler'; fehler: string }

type Undo = { text: string; rueckgabe: Rueckgabe | null; bis: number; id: number }

const warte = (ms: number) => new Promise((r) => window.setTimeout(r, ms))

function suchSchluessel(e: Extrakt | null): string | null {
  const p = e?.person
  if (!p || (!p.norm && !p.name)) return null
  return `${p.norm ?? ''}|${p.name ?? ''}`
}

export function Panel() {
  const festerTab = useRef(tabAusAdresse()).current
  const [sitzung, setSitzung] = useState<Sitzung | null>(null)
  const [basis, setBasis] = useState(CRM_LIVE)
  const [zahlen, setZahlen] = useState<HeuteZahlen | null>(null)
  const [tab, setTab] = useState<TabInfo | null>(null)
  const [extrakt, setExtrakt] = useState<Extrakt | null>(null)
  const [lesend, setLesend] = useState(false)
  const [leseFehler, setLeseFehler] = useState<string | null>(null)
  const [suche, setSuche] = useState<Suche | null>(null)
  const [ansicht, setAnsicht] = useState<LeadAnsicht | null>(null)
  const [undo, setUndo] = useState<Undo | null>(null)
  const [undoFehler, setUndoFehler] = useState<string | null>(null)
  const tabRef = useRef<TabInfo | null>(null)
  const lauf = useRef(0)
  const nachlesen = useRef<number | null>(null)

  const ichName = sitzung?.angemeldet ? sitzung.ich.name : null

  // ── Sitzung ──────────────────────────────────────────────────────────────
  const sitzungLaden = useCallback(async () => {
    try {
      const s = await senden('sitzung', {})
      setSitzung(s)
      if (s.angemeldet) setZahlen(await senden('heute', {}).catch(() => null))
    } catch (e) {
      setSitzung({ angemeldet: false })
      setLeseFehler(fehlerText(e))
    }
  }, [])

  useEffect(() => {
    void sitzungLaden()
    void crmBasis().then(setBasis)
    return beiSitzungswechsel(() => void sitzungLaden())
  }, [sitzungLaden])

  // ── Seite lesen ──────────────────────────────────────────────────────────
  const lesen = useCallback(
    async (neuerTab: boolean) => {
      const nr = ++lauf.current
      setLesend(true)
      setLeseFehler(null)
      const t = await aktiverTab(festerTab)
      if (nr !== lauf.current) return
      tabRef.current = t
      setTab(t)
      if (neuerTab) {
        setExtrakt(null)
        setAnsicht(null)
        setSuche(null)
      }
      if (!t || !istLinkedin(t.url)) {
        setExtrakt(null)
        setAnsicht(null)
        setSuche(null)
        setLesend(false)
        return
      }
      try {
        // LinkedIn rendert nach dem Seitenwechsel nach – bis zu viermal kurz nachlesen, solange der Name fehlt
        let e: Extrakt | null = null
        for (let versuch = 0; versuch < 5; versuch++) {
          e = await leseTab(t, { ichName })
          if (nr !== lauf.current) return
          const fertig = e.art === 'andere' || !!e.person?.name || !!e.person?.norm
          if (fertig && (e.art !== 'profil' || !!e.person?.name)) break
          await warte(700)
          if (nr !== lauf.current) return
        }
        setExtrakt(e)
      } catch (err) {
        if (nr === lauf.current) setLeseFehler(fehlerText(err))
      } finally {
        if (nr === lauf.current) setLesend(false)
      }
    },
    [festerTab, ichName],
  )

  useEffect(() => {
    void lesen(true)
    const stopp = beobachteTabs(
      festerTab,
      () => tabRef.current?.fensterId ?? null,
      () => tabRef.current?.id ?? null,
      (grund) => {
        if (nachlesen.current) window.clearTimeout(nachlesen.current)
        nachlesen.current = window.setTimeout(() => void lesen(grund === 'tab'), grund === 'tab' ? 50 : 600)
      },
    )
    return () => {
      stopp()
      if (nachlesen.current) window.clearTimeout(nachlesen.current)
    }
  }, [festerTab, lesen])

  // ── Im CRM suchen ────────────────────────────────────────────────────────
  const angemeldet = !!sitzung?.angemeldet
  const schluessel = suchSchluessel(extrakt)
  const [suchZaehler, setSuchZaehler] = useState(0)
  const personRef = useRef(extrakt?.person ?? null)
  personRef.current = extrakt?.person ?? null
  const letzterSchluessel = useRef<string | null>(null)
  const neuSuchen = useCallback(() => setSuchZaehler((n) => n + 1), [])

  useEffect(() => {
    if (letzterSchluessel.current !== schluessel) {
      // andere Person → alte Ansicht sofort weg, nie unter falschem Namen zeigen
      setAnsicht(null)
      letzterSchluessel.current = schluessel
    }
    const p = personRef.current
    if (!angemeldet || !schluessel || !p) {
      setSuche(null)
      return
    }
    let aktiv = true
    setSuche({ schluessel, status: 'laedt' })
    senden('suchen', { norm: p.norm, name: p.name }).then(
      (ergebnis) => {
        if (!aktiv) return
        setSuche({ schluessel, status: 'fertig', ergebnis })
        setAnsicht(ergebnis.ansicht)
      },
      (e: unknown) => {
        if (aktiv) setSuche({ schluessel, status: 'fehler', fehler: fehlerText(e) })
      },
    )
    return () => {
      aktiv = false
    }
  }, [angemeldet, schluessel, suchZaehler])

  // ── Aktionen, Rückgängig ─────────────────────────────────────────────────
  const erledigt = useCallback((e: Erledigt) => {
    if (e.ansicht) setAnsicht(e.ansicht)
    setUndoFehler(null)
    setUndo({ text: e.text, rueckgabe: e.rueckgabe, bis: Date.now() + UNDO_MS, id: Date.now() })
    void senden('heute', {})
      .then(setZahlen)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!undo) return
    const t = window.setTimeout(() => setUndo(null), Math.max(0, undo.bis - Date.now()))
    return () => window.clearTimeout(t)
  }, [undo])

  const rueckgaengig = useCallback(async () => {
    if (!undo?.rueckgabe) return
    const r = undo.rueckgabe
    setUndo(null)
    try {
      const e = await senden('rueckgaengig', r)
      setUndo({ text: e.text, rueckgabe: null, bis: Date.now() + 3000, id: Date.now() })
      if (e.ansicht) setAnsicht(e.ansicht)
      else neuSuchen()
      void senden('heute', {})
        .then(setZahlen)
        .catch(() => {})
    } catch (err) {
      setUndoFehler(fehlerText(err))
    }
  }, [undo, neuSuchen])

  /** Seite jetzt noch einmal lesen (neueste Nachricht, aktuelle Markierung) – nur auf Klick. */
  const leseFrisch = useCallback(async (): Promise<Extrakt | null> => {
    const t = tabRef.current
    if (!t || !istLinkedin(t.url)) return null
    try {
      return await leseTab(t, { ichName })
    } catch {
      return null
    }
  }, [ichName])

  const neuLesen = useCallback(async () => {
    await lesen(false)
    neuSuchen()
  }, [lesen, neuSuchen])

  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (istEingabe(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'z' || e.key === 'Z') void rueckgaengig()
      if (e.key === 'r' || e.key === 'R') void neuLesen()
    }
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  }, [rueckgaengig, neuLesen])

  // ── Darstellung ──────────────────────────────────────────────────────────
  const person = extrakt?.person ?? null
  const ich = sitzung?.angemeldet ? sitzung.ich : null

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="kopf">
        <span className="links">
          <span className="marke">Steiner &amp; Co.</span>
          <span className="label">CRM</span>
        </span>
        {ich ? (
          <span className="reihe" style={{ gap: 8, flexWrap: 'nowrap' }}>
            {zahlen ? (
              <span className="mono-s ink-3" title="Heute: fällige LinkedIn-Schritte · offene Antworten">
                <span className={zahlen.linkedinUeberfaellig ? 'amber' : zahlen.linkedinFaellig ? 'lime' : ''}>
                  {zahlen.linkedinFaellig}
                </span>{' '}
                fällig · {zahlen.antwortenOffen} Antw.
              </span>
            ) : null}
            {zahlen && zahlen.eingangOffen > 0 ? (
              <button
                type="button"
                className="knopf leise klein"
                title="LinkedIn-Mails, die das CRM nicht allein zuordnen konnte"
                onClick={eingangOeffnen}
              >
                <span className="amber tnum">{zahlen.eingangOffen}</span> Eingang
              </button>
            ) : null}
            <Avatar member={ich} groesse={22} />
          </span>
        ) : null}
      </header>

      <section className="abschnitt stapel" style={{ gap: 6 }} aria-label="Auf LinkedIn">
        <div className="abschnitt-kopf" style={{ marginBottom: 4 }}>
          <span className="label">{extrakt?.art === 'nachrichten' ? 'Unterhaltung mit' : 'Auf LinkedIn'}</span>
          <Knopf art="leise" groesse="klein" taste="R" onClick={() => void neuLesen()} disabled={lesend}>
            {lesend ? 'Lese …' : 'Neu lesen'}
          </Knopf>
        </div>
        {!tab && !lesend ? <p className="voice">Kein Tab gefunden.</p> : null}
        {tab && !istLinkedin(tab.url) ? (
          <p className="voice">Öffne ein Profil oder eine Unterhaltung auf LinkedIn.</p>
        ) : null}
        {lesend && !extrakt && tab && istLinkedin(tab.url) ? <Laden text="Lese die Seite …" /> : null}
        {extrakt && !person ? (
          <>
            <p className="voice">Öffne ein Profil oder eine Unterhaltung.</p>
            {extrakt.hinweis ? <p className="klein ink-3" style={{ margin: 0 }}>{extrakt.hinweis}</p> : null}
          </>
        ) : null}
        {person ? (
          <>
            <h1 className="name">{person.name ?? 'Name nicht erkannt'}</h1>
            {person.headline ? <p className="klein ink-2 zeilen-2" style={{ margin: 0 }}>{person.headline}</p> : null}
            {person.unternehmen || person.ort ? (
              <p className="klein ink-3" style={{ margin: 0 }}>
                {[person.unternehmen, person.ort].filter(Boolean).join(' · ')}
              </p>
            ) : null}
            <span className="mono-s ink-3">{person.norm ? person.norm.replace(/^linkedin\.com\//, '') : 'Profil-Adresse nicht erkannt'}</span>
          </>
        ) : null}
        {leseFehler ? (
          <p className="fehler" role="alert" style={{ margin: 0 }}>
            {leseFehler}
          </p>
        ) : null}
      </section>

      <div style={{ flex: '1 1 auto' }}>
        {sitzung && !sitzung.angemeldet ? (
          <section className="abschnitt">
            <Anmelden kompakt onAngemeldet={(s) => (setSitzung(s), void sitzungLaden())} />
          </section>
        ) : null}

        {ich && person && suche?.status === 'laedt' && !ansicht ? (
          <section className="abschnitt">
            <Laden text="Suche im CRM …" />
          </section>
        ) : null}

        {ich && person && suche?.status === 'fehler' ? (
          <section className="abschnitt stapel" style={{ gap: 8 }}>
            <p className="fehler" role="alert" style={{ margin: 0 }}>
              {suche.fehler}
            </p>
            <Knopf groesse="klein" onClick={neuSuchen}>
              Nochmal suchen
            </Knopf>
          </section>
        ) : null}

        {ich && ansicht && person ? (
          <LeadKarte
            key={ansicht.lead.id}
            ansicht={ansicht}
            ich={ich}
            extrakt={extrakt}
            basis={basis}
            onErledigt={erledigt}
            leseFrisch={leseFrisch}
          />
        ) : null}

        {ich && person && !ansicht && suche?.status === 'fertig' ? (
          <NichtImCrm
            key={schluessel ?? 'ohne'}
            ergebnis={suche.ergebnis}
            person={person}
            ich={ich}
            basis={basis}
            onErledigt={erledigt}
          />
        ) : null}
      </div>

      {undo ? (
        <div className="rueckgaengig" role="status" key={undo.id}>
          <span className="text">{undo.text}</span>
          {undo.rueckgabe ? (
            <Knopf groesse="klein" taste="Z" onClick={() => void rueckgaengig()}>
              Rückgängig
            </Knopf>
          ) : null}
        </div>
      ) : null}
      {undoFehler ? (
        <p className="fehler" role="alert" style={{ margin: 0, padding: '8px 16px' }}>
          {undoFehler}
        </p>
      ) : null}

      <footer className="fuss">
        Liest nur diese Seite, solange die Leiste offen ist. Sendet nie etwas auf LinkedIn. <kbd>⌥C</kbd> öffnet,{' '}
        <kbd>R</kbd> liest neu.
      </footer>
    </main>
  )
}
