// Person ist im CRM: Stufe, Zuständig, Vernetzung je Person, Sequenz + nächste Nachricht, Antwort/Notiz erfassen.
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { REAKTION_LABEL } from '@/texte/de'
import { crmLink, PFAD } from '../../shared/konfig'
import type { AntwortLabel, Erledigt, Extrakt, Ich, LeadAnsicht, VerbindungInfo } from '../../shared/typen'
import { faelligChip, fmtDatum, fmtDatumKurz } from '../../shared/zeit'
import type { Req, Res, Typ } from '../../shared/protokoll'
import { fehlerText, oeffne, senden } from '../api'
import { Avatar, Chip, istEingabe, Knopf, ZeitChipAnzeige } from '../teile'
import { NaechsteNachricht } from './NaechsteNachricht'

const ANTWORT_CHIPS: { label: AntwortLabel; taste: string }[] = [
  { label: 'interessiert', taste: '1' },
  { label: 'frage', taste: '2' },
  { label: 'kein_bedarf', taste: '3' },
  { label: 'spaeter', taste: '4' },
  { label: 'nicht_icp', taste: '5' },
]

function verbindungText(v: VerbindungInfo): string {
  switch (v.status) {
    case 'ausstehend':
      return v.angefragtAm ? `angefragt ${fmtDatumKurz(v.angefragtAm)}` : 'angefragt'
    case 'angenommen':
      return v.angenommenAm ? `vernetzt seit ${fmtDatum(v.angenommenAm)}` : 'vernetzt'
    case 'zurueckgezogen':
      return 'Anfrage zurückgezogen'
    case 'abgelaufen':
      return 'Anfrage abgelaufen'
  }
}

type Modus = null | 'antwort' | 'notiz'

export function LeadKarte({
  ansicht,
  ich,
  extrakt,
  basis,
  onErledigt,
  leseFrisch,
}: {
  ansicht: LeadAnsicht
  ich: Ich
  extrakt: Extrakt | null
  basis: string
  onErledigt: (e: Erledigt) => void
  leseFrisch: () => Promise<Extrakt | null>
}) {
  const { lead, gate, sequenz, vorlage, antwortOffen } = ansicht
  const [modus, setModus] = useState<Modus>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState<string | null>(null)
  const [label, setLabel] = useState<AntwortLabel | null>(null)
  const [zitat, setZitat] = useState('')
  const [zitatQuelle, setZitatQuelle] = useState<string | null>(null)
  const [notiz, setNotiz] = useState('')
  const zitatFeld = useRef<HTMLTextAreaElement | null>(null)
  const notizFeld = useRef<HTMLTextAreaElement | null>(null)
  const gesperrt = gate.erlaubt ? null : (gate.text ?? 'Kontakt gesperrt')
  // Antwort schon erfasst (z. B. aus der LinkedIn-Mail), Reaktion fehlt → A trägt nur die Reaktion nach
  const nachtragen = !!antwortOffen && antwortOffen.label === null && antwortOffen.aktivitaetId !== null
  const vorhandenesZitat = nachtragen ? (antwortOffen?.zitat ?? null) : null
  const leadLink = crmLink(basis, PFAD.lead(lead.id))

  async function aktion<K extends Typ>(name: string, typ: K, daten: Req<K>): Promise<boolean> {
    setLaeuft(name)
    setFehler(null)
    try {
      const e = (await senden(typ, daten)) as Res<K> & Erledigt
      onErledigt(e)
      return true
    } catch (err) {
      setFehler(fehlerText(err))
      return false
    } finally {
      setLaeuft(null)
    }
  }

  const zitatVorschlag = (e: Extrakt | null) => {
    // Markierung schlägt die automatisch gelesene Nachricht (die Person hat bewusst markiert)
    if (e?.auswahl) return { text: e.auswahl, quelle: 'aus deiner Markierung' }
    if (e?.letzteNachricht) return { text: e.letzteNachricht, quelle: 'aus der Unterhaltung' }
    return null
  }
  const zitatBearbeitet = useRef(false)
  const antwortOeffnen = () => {
    setModus('antwort')
    zitatBearbeitet.current = false
    const v = zitatVorschlag(extrakt)
    setZitat(v?.text ?? '')
    setZitatQuelle(v?.quelle ?? null)
    window.setTimeout(() => zitatFeld.current?.focus(), 0)
    if (vorhandenesZitat) return
    // gleich noch einmal lesen: neueste Nachricht bzw. aktuelle Markierung
    void leseFrisch().then((e) => {
      const f = zitatVorschlag(e)
      if (f && !zitatBearbeitet.current) {
        setZitat(f.text)
        setZitatQuelle(f.quelle)
      }
    })
  }
  const notizOeffnen = () => {
    setModus('notiz')
    window.setTimeout(() => notizFeld.current?.focus(), 0)
  }

  const antwortSpeichern = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!label) {
      setFehler('Erst die Reaktion wählen (1–5).')
      return
    }
    const ok = await aktion('antwort', 'antwortErhalten', { leadId: lead.id, label, zitat: vorhandenesZitat ? null : zitat.trim() || null })
    if (ok) {
      setModus(null)
      setLabel(null)
      setZitat('')
    }
  }

  const notizSpeichern = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!notiz.trim()) return
    const ok = await aktion('notiz', 'notiz', { leadId: lead.id, text: notiz })
    if (ok) {
      setModus(null)
      setNotiz('')
    }
  }

  const markierungHolen = async () => {
    const a = (await leseFrisch())?.auswahl
    if (a) {
      zitatBearbeitet.current = true
      setZitat(a)
      setZitatQuelle('aus deiner Markierung')
    } else setFehler('Auf der LinkedIn-Seite ist nichts markiert.')
  }

  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modus) {
        setModus(null)
        return
      }
      if (istEingabe(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (modus === 'antwort') {
        const chip = ANTWORT_CHIPS.find((c) => c.taste === e.key)
        if (chip) {
          setLabel(chip.label)
          return
        }
        if (e.key === 'Enter') void antwortSpeichern()
        return
      }
      if (k === 'a') {
        e.preventDefault()
        antwortOeffnen()
      } else if (k === 'n') {
        e.preventDefault()
        notizOeffnen()
      } else if (k === 'o') {
        oeffne(leadLink)
      }
    }
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  })

  const chip = faelligChip(sequenz?.faelligAm)
  const andere = ansicht.verbindungen.find((v) => !v.ich && v.status === 'ausstehend')

  return (
    <div className="stapel" style={{ gap: 0 }}>
      <section className="abschnitt stapel" style={{ gap: 8 }} aria-label="Im CRM">
        <div className="abschnitt-kopf" style={{ marginBottom: 2 }}>
          <span className="label">Im CRM</span>
          <Knopf art="leise" groesse="klein" taste="O" onClick={() => oeffne(leadLink)}>
            Im CRM öffnen ↗
          </Knopf>
        </div>
        <h2 className="name">{lead.titel ? `${lead.titel} ${lead.name}` : lead.name}</h2>
        {lead.unternehmen || lead.rollenTitel ? (
          <p className="klein ink-2" style={{ margin: 0 }}>
            {[lead.unternehmen, lead.rollenTitel].filter(Boolean).join(' · ')}
          </p>
        ) : null}
        <div className="reihe" style={{ marginTop: 4 }}>
          <Chip ton={lead.phaseTon === 'neutral' ? '' : lead.phaseTon}>{lead.stufeLabel}</Chip>
          {lead.beendetGrund ? <Chip ton="ended">{lead.beendetGrund}</Chip> : null}
          {gesperrt ? <Chip ton="gefahr">{gesperrt}</Chip> : null}
          <span className="reihe klein ink-3" style={{ gap: 6 }}>
            <Avatar member={lead.owner} titel={lead.owner ? `Zuständig: ${lead.owner.name}` : 'Frei'} />
            {lead.owner ? `Zuständig: ${lead.owner.kurz}` : 'Frei'}
          </span>
        </div>
      </section>

      <section className="abschnitt" aria-label="Vernetzung">
        <div className="abschnitt-kopf">
          <span className="label">Vernetzung</span>
        </div>
        <div className="stapel" style={{ gap: 0 }}>
          {ansicht.verbindungen.length === 0 ? <p className="klein ink-3" style={{ margin: '0 0 6px' }}>Noch keine Anfrage.</p> : null}
          {ansicht.verbindungen.map((v) => (
            <div className="zeile" key={v.memberId}>
              <Avatar member={{ kuerzel: v.kuerzel, personId: v.personId, name: v.name }} groesse={18} />
              <span className="wachsen klein">
                {v.ich ? 'Du' : v.name} · <span className="ink-2">{verbindungText(v)}</span>
              </span>
            </div>
          ))}
        </div>
        <div className="knopf-reihe" style={{ marginTop: 8 }}>
          {ansicht.meineVerbindung === 'ausstehend' ? (
            <Knopf groesse="klein" disabled={!!laeuft} onClick={() => void aktion('angenommen', 'angenommen', { leadId: lead.id })}>
              {laeuft === 'angenommen' ? 'Speichere …' : 'Angenommen'}
            </Knopf>
          ) : null}
          {ansicht.meineVerbindung === null && !andere ? (
            <Knopf
              groesse="klein"
              disabled={!!laeuft || !!gesperrt}
              title={gesperrt ?? 'Du hast die Anfrage gerade auf LinkedIn gesendet'}
              onClick={() => void aktion('anfrage', 'anfrageGesendet', { leadId: lead.id })}
            >
              {laeuft === 'anfrage' ? 'Speichere …' : 'Anfrage gesendet'}
            </Knopf>
          ) : null}
          {ansicht.meineVerbindung === null && andere ? (
            <p className="klein ink-3" style={{ margin: 0 }}>
              {andere.name} hat schon angefragt – nur eine Anfrage je Lead.
            </p>
          ) : null}
        </div>
      </section>

      {antwortOffen ? (
        <section className="abschnitt stapel" style={{ gap: 10 }} aria-label="Antwort offen">
          <div className="abschnitt-kopf" style={{ marginBottom: 0 }}>
            <span className="label">Antwort offen</span>
            <span className="mono-s amber">seit {fmtDatumKurz(antwortOffen.seit)}</span>
          </div>
          {antwortOffen.zitat ? <p className="zitat" style={{ margin: 0 }}>‚{antwortOffen.zitat}‘</p> : null}
          {antwortOffen.vorlage ? (
            <NaechsteNachricht
              key={`antwort-${antwortOffen.vorlage.id}-${antwortOffen.seit}`}
              vorlage={antwortOffen.vorlage}
              lead={ansicht.platzhalterLead}
              me={ich.platzhalter}
              kopf={`Vorschlag · ${antwortOffen.vorlage.name}`}
              gesperrt={gesperrt}
              tastenAktiv={modus === null}
              onGesendet={(templateId) => aktion('gesendet', 'antwortGesendet', { leadId: lead.id, templateId })}
            />
          ) : (
            <p className="klein ink-2" style={{ margin: 0 }}>
              {nachtragen
                ? 'Die Antwort ist schon erfasst, die Reaktion fehlt noch. Mit A trägst du sie nach – dann erscheint der Vorschlag.'
                : 'Ohne Reaktion kein Vorschlag – erfasse unten die Reaktion oder antworte im CRM.'}
            </p>
          )}
        </section>
      ) : null}

      {!antwortOffen && sequenz ? (
        <section className="abschnitt stapel" style={{ gap: 10 }} aria-label="Nächster Schritt">
          <div className="abschnitt-kopf" style={{ marginBottom: 0 }}>
            <span className="label">Nächster Schritt</span>
            <span className="reihe" style={{ gap: 6 }}>
              {sequenz.status === 'pausiert' ? <Chip ton="muted">pausiert</Chip> : null}
              <ZeitChipAnzeige chip={chip} />
            </span>
          </div>
          <p className="klein ink-2" style={{ margin: 0 }}>
            {sequenz.sequenzName} · <span className="tnum">{sequenz.position}</span> von <span className="tnum">{sequenz.anzahl}</span> ·{' '}
            {sequenz.schrittName}
          </p>
          {sequenz.member && sequenz.member.id !== ich.id ? (
            <p className="klein ink-3" style={{ margin: 0 }}>
              Sequenz läuft für {sequenz.member.kurz}.
            </p>
          ) : null}
          {vorlage ? (
            <NaechsteNachricht
              key={`schritt-${sequenz.enrollmentId}-${sequenz.schrittId}-${vorlage.id}`}
              vorlage={vorlage}
              lead={ansicht.platzhalterLead}
              me={ich.platzhalter}
              kopf={`Vorlage · ${vorlage.name}`}
              gesperrt={gesperrt}
              tastenAktiv={modus === null}
              onGesendet={(templateId) =>
                aktion('gesendet', 'schrittGesendet', {
                  leadId: lead.id,
                  enrollmentId: sequenz.enrollmentId,
                  schrittId: sequenz.schrittId,
                  templateId,
                })
              }
            />
          ) : (
            <p className="klein ink-3" style={{ margin: 0 }}>
              Für diesen Schritt ist keine Vorlage hinterlegt – im CRM ansehen.
            </p>
          )}
        </section>
      ) : null}

      {!antwortOffen && !sequenz ? (
        <section className="abschnitt" aria-label="Nächster Schritt">
          <p className="voice">Gerade kein Schritt fällig.</p>
          <p className="klein ink-3" style={{ margin: '4px 0 0' }}>
            {ansicht.meineVerbindung === 'ausstehend'
              ? 'Sobald die Anfrage angenommen ist, startet die Sequenz mit dem Opener.'
              : lead.stufe === 'beendet'
                ? 'Der Lead ist beendet.'
                : 'Sequenzen startest du im CRM.'}
          </p>
        </section>
      ) : null}

      <section className="abschnitt stapel" style={{ gap: 10 }} aria-label="Erfassen">
        {modus === null ? (
          <div className="knopf-reihe">
            <Knopf className="wachsen" taste="A" onClick={antwortOeffnen}>
              {nachtragen ? 'Reaktion nachtragen' : 'Antwort erhalten'}
            </Knopf>
            <Knopf className="wachsen" taste="N" onClick={notizOeffnen}>
              Notiz
            </Knopf>
          </div>
        ) : null}

        {modus === 'antwort' ? (
          <form className="stapel" style={{ gap: 10 }} onSubmit={antwortSpeichern} aria-label={nachtragen ? 'Reaktion nachtragen' : 'Antwort erhalten'}>
            <span className="label">{nachtragen ? 'Reaktion zur erfassten Antwort' : 'Antwort erhalten · Reaktion'}</span>
            <div className="reihe" role="group" aria-label="Reaktion">
              {ANTWORT_CHIPS.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  className="chip auswahl"
                  aria-pressed={label === c.label}
                  onClick={() => setLabel(c.label)}
                >
                  {REAKTION_LABEL[c.label]} <kbd>{c.taste}</kbd>
                </button>
              ))}
            </div>
            {vorhandenesZitat ? (
              <p className="zitat" style={{ margin: 0 }}>‚{vorhandenesZitat}‘</p>
            ) : (
            <label className="feld">
              <span>Zitat {zitatQuelle ? <span className="ink-3" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>· {zitatQuelle}</span> : null}</span>
              <textarea
                ref={zitatFeld}
                className="textfeld"
                value={zitat}
                placeholder="Was hat die Person geschrieben? (optional)"
                onChange={(e) => {
                  zitatBearbeitet.current = true
                  setZitat(e.target.value)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void antwortSpeichern()
                }}
              />
            </label>
            )}
            <div className="knopf-reihe">
              <Knopf art="primaer" type="submit" className="wachsen" taste="↵" disabled={!label || laeuft === 'antwort'}>
                {laeuft === 'antwort' ? 'Speichere …' : nachtragen ? 'Reaktion speichern' : 'Antwort speichern'}
              </Knopf>
              {vorhandenesZitat ? null : (
                <Knopf art="leise" onClick={() => void markierungHolen()}>
                  Markierung holen
                </Knopf>
              )}
              <Knopf art="leise" taste="Esc" onClick={() => setModus(null)}>
                Abbrechen
              </Knopf>
            </div>
            {label === 'nicht_icp' ? <p className="klein amber" style={{ margin: 0 }}>Nicht ICP beendet den Lead.</p> : null}
          </form>
        ) : null}

        {modus === 'notiz' ? (
          <form className="stapel" style={{ gap: 10 }} onSubmit={notizSpeichern} aria-label="Notiz">
            <label className="feld">
              <span>Notiz</span>
              <textarea
                ref={notizFeld}
                className="textfeld"
                value={notiz}
                onChange={(e) => setNotiz(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void notizSpeichern()
                }}
              />
            </label>
            <div className="knopf-reihe">
              <Knopf art="primaer" type="submit" className="wachsen" taste="⌘↵" disabled={!notiz.trim() || laeuft === 'notiz'}>
                {laeuft === 'notiz' ? 'Speichere …' : 'Notiz speichern'}
              </Knopf>
              <Knopf art="leise" taste="Esc" onClick={() => setModus(null)}>
                Abbrechen
              </Knopf>
            </div>
          </form>
        ) : null}

        {fehler ? (
          <p className="fehler" role="alert" style={{ margin: 0 }}>
            {fehler}
          </p>
        ) : null}
      </section>
    </div>
  )
}
