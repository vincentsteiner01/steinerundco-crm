// Eingang: LinkedIn-Benachrichtigungs-Mails (Apps Script → crm.eingang), die das CRM nicht allein zuordnen konnte, und
// Einladungen von Leads. Zuordnen (Lead-Suche → crm.eingang_zuordnen verbucht sofort) oder Ignorieren. Alle Mitglieder sehen alles.
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { crmLink, CRM_LIVE, PFAD } from '../../shared/konfig'
import type { EingangArt, EingangEintrag, EingangListe, LeadKurz, SchluesselInfo, Sitzung } from '../../shared/typen'
import { fmtZeit, seit } from '../../shared/zeit'
import { Anmelden } from '../Anmelden'
import { beiSitzungswechsel, crmBasis, fehlerText, oeffne, senden } from '../api'
import { Avatar, Chip, istEingabe, Knopf, Laden } from '../teile'

const ART: Record<EingangArt, string> = {
  nachricht: 'Nachricht',
  annahme: 'Einladung angenommen',
  einladung: 'Einladung erhalten',
  sonstiges: 'Sonstiges',
}

function statusChip(e: EingangEintrag) {
  if (e.status === 'fehler') return <Chip ton="gefahr">Fehler</Chip>
  if (e.status === 'unbekannt') return <Chip ton="ueberfaellig">zuordnen</Chip>
  if (e.lead) return <Chip ton="heute">Lead</Chip>
  return <Chip ton="muted">wird verbucht …</Chip>
}

function Eintrag({ e, basis, onFertig }: { e: EingangEintrag; basis: string; onFertig: (text: string) => void }) {
  const [suche, setSuche] = useState<string | null>(null)
  const [treffer, setTreffer] = useState<LeadKurz[] | null>(null)
  const [laeuft, setLaeuft] = useState<string | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)

  const tun = async (name: string, f: () => Promise<{ text: string }>) => {
    setLaeuft(name)
    setFehler(null)
    try {
      onFertig((await f()).text)
    } catch (err) {
      setFehler(fehlerText(err))
    } finally {
      setLaeuft(null)
    }
  }

  const suchen = async (ev?: FormEvent) => {
    ev?.preventDefault()
    const name = (suche ?? '').trim()
    if (name.length < 3) {
      setFehler('Mindestens 3 Buchstaben.')
      return
    }
    setLaeuft('suche')
    setFehler(null)
    try {
      const r = await senden('suchen', { norm: null, name })
      setTreffer(r.vorschlaege)
    } catch (err) {
      setFehler(fehlerText(err))
    } finally {
      setLaeuft(null)
    }
  }

  const zuordnen = (leadId: string) => tun('zuordnen', () => senden('eingangZuordnen', { id: e.id, leadId }))
  const ignorieren = () => tun('ignorieren', () => senden('eingangIgnorieren', { id: e.id }))
  const einladungVomLead = e.status === 'neu' && e.art === 'einladung' && !!e.lead

  return (
    <article className="vorschlag" aria-label={`${ART[e.art]} von ${e.absender ?? 'unbekannt'}`}>
      <div className="reihe" style={{ justifyContent: 'space-between' }}>
        <span className="reihe" style={{ gap: 6 }}>
          <Chip>{ART[e.art]}</Chip>
          {statusChip(e)}
        </span>
        <span className="reihe klein ink-3" style={{ gap: 6 }}>
          <span className="mono-s tnum">{fmtZeit(e.empfangenAm)}</span>
          {e.member ? <Avatar member={e.member} groesse={18} titel={`Postfach von ${e.member.kurz}`} /> : null}
        </span>
      </div>
      <p className="name" style={{ fontSize: 20, margin: 0 }}>
        {e.absender ?? 'Absender nicht erkannt'}
      </p>
      {e.slug ? <span className="mono-s ink-3">linkedin.com/in/{e.slug}</span> : null}
      {e.text ? (
        <p className="zitat" style={{ margin: 0 }}>
          ‚{e.text.length > 400 ? `${e.text.slice(0, 399)}…` : e.text}‘
        </p>
      ) : null}
      {e.ergebnis ? (
        <p className={`klein ${e.status === 'fehler' ? 'rot' : 'ink-2'}`} style={{ margin: 0 }}>
          {e.ergebnis}
        </p>
      ) : null}
      {e.lead ? (
        <p className="klein ink-2" style={{ margin: 0 }}>
          Lead:{' '}
          <button type="button" className="knopf leise klein" onClick={() => oeffne(crmLink(basis, PFAD.lead(e.lead!.id)))}>
            {e.lead.name} ↗
          </button>
        </p>
      ) : null}

      <div className="knopf-reihe">
        {einladungVomLead ? (
          <>
            <Knopf groesse="klein" onClick={() => oeffne(crmLink(basis, PFAD.lead(e.lead!.id)))}>
              Im CRM öffnen ↗
            </Knopf>
            <Knopf art="leise" groesse="klein" disabled={!!laeuft} onClick={() => void ignorieren()}>
              {laeuft === 'ignorieren' ? 'Speichere …' : 'Erledigt'}
            </Knopf>
          </>
        ) : (
          <>
            {e.status === 'fehler' && e.lead ? (
              <Knopf groesse="klein" disabled={!!laeuft} onClick={() => void zuordnen(e.lead!.id)}>
                {laeuft === 'zuordnen' ? 'Verbuche …' : 'Erneut verbuchen'}
              </Knopf>
            ) : null}
            {suche === null ? (
              <Knopf groesse="klein" art={e.status === 'unbekannt' ? 'primaer' : 'sekundaer'} onClick={() => setSuche(e.absender ?? '')}>
                {e.status === 'fehler' && e.lead ? 'Anderem Lead zuordnen' : 'Lead zuordnen'}
              </Knopf>
            ) : null}
            <Knopf art="leise" groesse="klein" disabled={!!laeuft} onClick={() => void ignorieren()}>
              {laeuft === 'ignorieren' ? 'Speichere …' : 'Ignorieren'}
            </Knopf>
          </>
        )}
      </div>

      {suche !== null ? (
        <form className="stapel" style={{ gap: 8 }} onSubmit={suchen} aria-label="Lead suchen">
          <span className="reihe" style={{ flexWrap: 'nowrap' }}>
            <input
              className="eingabe"
              autoFocus
              value={suche}
              placeholder="Name des Leads"
              onChange={(ev) => setSuche(ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === 'Escape') {
                  setSuche(null)
                  setTreffer(null)
                }
              }}
            />
            <Knopf type="submit" disabled={laeuft === 'suche'}>
              {laeuft === 'suche' ? 'Suche …' : 'Suchen'}
            </Knopf>
          </span>
          {treffer && treffer.length === 0 ? <p className="klein ink-3" style={{ margin: 0 }}>Kein Lead mit diesem Namen.</p> : null}
          {treffer?.map((l) => (
            <div className="zeile" key={l.id}>
              <Avatar member={l.owner} groesse={18} titel={l.owner ? `Zuständig: ${l.owner.kurz}` : 'Frei'} />
              <span className="wachsen klein">
                {l.name}
                <span className="ink-3"> · {[l.unternehmen, l.stufeLabel].filter(Boolean).join(' · ')}</span>
              </span>
              <Knopf groesse="klein" art="primaer" disabled={!!laeuft} onClick={() => void zuordnen(l.id)}>
                {laeuft === 'zuordnen' ? 'Verbuche …' : 'Zuordnen'}
              </Knopf>
            </div>
          ))}
          <p className="klein ink-3" style={{ margin: 0 }}>
            Zuordnen verbucht sofort im Namen von {e.member?.kurz ?? 'dem Postfach-Inhaber'}:{' '}
            {e.art === 'annahme' ? 'Vernetzung angenommen, die Sequenz startet.' : e.art === 'nachricht' ? 'Antwort erhalten, Sequenzen stoppen.' : 'nur die Zuordnung.'}
          </p>
        </form>
      ) : null}
      {fehler ? (
        <p className="fehler" role="alert" style={{ margin: 0 }}>
          {fehler}
        </p>
      ) : null}
    </article>
  )
}

function SchluesselZeile({ s }: { s: SchluesselInfo | null }) {
  if (!s) {
    return (
      <p className="klein ink-3" style={{ margin: 0 }}>
        Für dich ist noch kein Eingangs-Schlüssel aktiv – Einstellungen → „LinkedIn-Mails ins CRM“.
      </p>
    )
  }
  const alt = !s.zuletztGenutzt || Date.now() - new Date(s.zuletztGenutzt).getTime() > 30 * 60_000
  return (
    <p className="klein ink-3" style={{ margin: 0 }}>
      Dein Apps Script hat zuletzt gemeldet: <span className={`mono-s ${alt ? 'amber' : ''}`}>{seit(s.zuletztGenutzt)}</span>
      {alt ? ' – läuft der 5-Minuten-Takt noch? (script.google.com → Ausführungen)' : ''}
    </p>
  )
}

export function Eingang() {
  const [sitzung, setSitzung] = useState<Sitzung | null>(null)
  const [daten, setDaten] = useState<EingangListe | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [meldung, setMeldung] = useState<string | null>(null)
  const [basis, setBasis] = useState(CRM_LIVE)

  const laden = useCallback(async () => {
    setFehler(null)
    try {
      const s = await senden('sitzung', {})
      setSitzung(s)
      if (s.angemeldet) setDaten(await senden('eingang', {}))
    } catch (e) {
      setFehler(fehlerText(e))
      setSitzung((alt) => alt ?? { angemeldet: false })
    }
  }, [])

  useEffect(() => {
    void crmBasis().then(setBasis)
    void laden()
    const weg = beiSitzungswechsel(() => void laden())
    const fokus = () => void laden()
    window.addEventListener('focus', fokus)
    const takt = window.setInterval(() => void laden(), 60_000)
    const taste = (e: KeyboardEvent) => {
      if (istEingabe(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'r' || e.key === 'R') void laden()
    }
    window.addEventListener('keydown', taste)
    return () => {
      weg()
      window.removeEventListener('focus', fokus)
      window.removeEventListener('keydown', taste)
      window.clearInterval(takt)
    }
  }, [laden])

  const fertig = (text: string) => {
    setMeldung(text)
    void laden()
  }

  const offen = daten?.eintraege ?? []
  return (
    <main style={{ maxWidth: 720, padding: '32px 24px', margin: '0 auto' }} className="stapel">
      <header className="stapel" style={{ gap: 4, marginBottom: 12 }}>
        <span className="label">Steiner &amp; Co. CRM · LinkedIn-Mails</span>
        <div className="reihe" style={{ justifyContent: 'space-between' }}>
          <h1 className="name" style={{ fontSize: 32, margin: 0 }}>
            Eingang
          </h1>
          {sitzung?.angemeldet ? (
            <Knopf art="leise" groesse="klein" taste="R" onClick={() => void laden()}>
              Neu laden
            </Knopf>
          ) : null}
        </div>
        <p className="klein ink-2" style={{ margin: 0 }}>
          Was das CRM aus deinen LinkedIn-Benachrichtigungen nicht allein zuordnen konnte, und Einladungen von Leads. Alles andere
          steht schon am Lead.
        </p>
      </header>

      {!sitzung ? (
        <Laden />
      ) : !sitzung.angemeldet ? (
        <section className="abschnitt" style={{ maxWidth: 360 }}>
          <Anmelden onAngemeldet={(s) => (setSitzung(s), void laden())} />
        </section>
      ) : !daten ? (
        <Laden />
      ) : (
        <>
          {meldung ? (
            <p className="hinweis" role="status" style={{ margin: '0 0 8px' }}>
              {meldung}
            </p>
          ) : null}
          {offen.length === 0 ? (
            <section style={{ padding: '16px 0' }}>
              <p className="voice">Nichts offen.</p>
              <p className="klein ink-3" style={{ margin: '4px 0 0' }}>
                Annahmen und Antworten aus den LinkedIn-Mails sind am Lead verbucht.
              </p>
            </section>
          ) : (
            <section aria-label="Offene Einträge">
              <p className="mono-s ink-3" style={{ margin: '0 0 4px' }}>
                <span className="tnum">{offen.length}</span> offen
              </p>
              {offen.map((e) => (
                <Eintrag key={e.id} e={e} basis={basis} onFertig={fertig} />
              ))}
            </section>
          )}
          <section style={{ paddingTop: 16, borderTop: '1px solid var(--line)', marginTop: 8 }}>
            <SchluesselZeile s={daten.schluessel} />
          </section>
        </>
      )}
      {fehler ? (
        <p className="fehler" role="alert">
          {fehler}
        </p>
      ) : null}
    </main>
  )
}
