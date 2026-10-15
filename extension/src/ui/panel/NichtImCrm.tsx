// Person ist (noch) nicht im CRM: Namensvorschläge (verknüpfen), Sperrliste/Papierkorb-Hinweis, „Als Lead anlegen“.
import { useEffect, useState, type FormEvent } from 'react'
import { anredeVorschlag } from '@/features/import/components/vornamen'
import type { Salutation } from '@/types/domain'
import { crmLink, PFAD, SPEICHER } from '../../shared/konfig'
import type { Angelegt, Erledigt, Ich, LeadKurz, PersonExtrakt, SuchErgebnis } from '../../shared/typen'
import { fehlerText, lies, oeffne, schreibe, senden } from '../api'
import { Avatar, Knopf } from '../teile'

function Vorschlag({
  v,
  person,
  basis,
  onVerknuepft,
}: {
  v: LeadKurz
  person: PersonExtrakt
  basis: string
  onVerknuepft: (e: Erledigt) => void
}) {
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const verknuepfen = async () => {
    if (!person.profilUrl) return
    setLaeuft(true)
    setFehler(null)
    try {
      onVerknuepft(await senden('verknuepfen', { leadId: v.id, profilUrl: person.profilUrl }))
    } catch (e) {
      setFehler(fehlerText(e))
    } finally {
      setLaeuft(false)
    }
  }
  return (
    <div className="vorschlag">
      <div className="reihe zwischen" style={{ flexWrap: 'nowrap' }}>
        <span style={{ fontWeight: 500, minWidth: 0 }}>{v.name}</span>
        <Avatar member={v.owner} groesse={18} />
      </div>
      <span className="klein ink-3">{[v.unternehmen, v.stufeLabel].filter(Boolean).join(' · ')}</span>
      {v.linkedinNorm ? (
        <span className="mono-s ink-3">hat anderes Profil: {v.linkedinNorm.replace(/^linkedin\.com\//, '')}</span>
      ) : (
        <span className="mono-s ink-3">ohne LinkedIn-Profil im CRM</span>
      )}
      <div className="knopf-reihe">
        <Knopf groesse="klein" disabled={!person.profilUrl || laeuft} onClick={() => void verknuepfen()}>
          {laeuft ? 'Speichere …' : 'Ist diese Person – Profil verknüpfen'}
        </Knopf>
        <Knopf art="leise" groesse="klein" onClick={() => oeffne(crmLink(basis, PFAD.lead(v.id)))}>
          Öffnen ↗
        </Knopf>
      </div>
      {fehler ? <p className="fehler" style={{ margin: 0 }}>{fehler}</p> : null}
    </div>
  )
}

function stadtAus(ort: string | null): string {
  return (ort ?? '').split(',')[0]?.trim() ?? ''
}

export function LeadAnlegen({
  person,
  ich,
  onAngelegt,
}: {
  person: PersonExtrakt
  ich: Ich
  onAngelegt: (e: Angelegt) => void
}) {
  const vorschlag = anredeVorschlag(person.vorname)
  const [anrede, setAnrede] = useState<Salutation | null>(vorschlag)
  const [titel, setTitel] = useState(person.titel ?? '')
  const [vorname, setVorname] = useState(person.vorname ?? '')
  const [nachname, setNachname] = useState(person.nachname ?? '')
  const [unternehmen, setUnternehmen] = useState(person.unternehmen ?? '')
  const [rolle, setRolle] = useState(person.rolle ?? '')
  const [stadt, setStadt] = useState(stadtAus(person.ort))
  const [anfrage, setAnfrage] = useState(false)
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<{ text: string; fehler: boolean } | null>(null)

  useEffect(() => {
    void lies<boolean>(SPEICHER.anfrageVorwahl, false).then(setAnfrage)
  }, [])

  const fehlt = !person.profilUrl
    ? 'Öffne das Profil der Person, um sie anzulegen.'
    : !vorname.trim() && !nachname.trim()
      ? 'Vor- oder Nachname fehlt.'
      : !anrede
        ? 'Anrede wählen (Herr, Frau oder –).'
        : null

  const absenden = async (e: FormEvent) => {
    e.preventDefault()
    if (fehlt || laeuft || !person.profilUrl || !anrede) return
    setLaeuft(true)
    setMeldung(null)
    void schreibe(SPEICHER.anfrageVorwahl, anfrage)
    try {
      const r = await senden('anlegen', {
        entwurf: {
          titel: titel.trim() || null,
          vorname: vorname.trim() || null,
          nachname: nachname.trim() || null,
          unternehmen: unternehmen.trim() || null,
          rolle: rolle.trim() || null,
          stadt: stadt.trim() || null,
          anrede,
          profilUrl: person.profilUrl,
        },
        anfrageGesendet: anfrage,
      })
      if (r.ansicht) onAngelegt(r)
      else setMeldung({ text: r.text, fehler: true })
    } catch (err) {
      setMeldung({ text: fehlerText(err), fehler: true })
    } finally {
      setLaeuft(false)
    }
  }

  const feld = (label: string, wert: string, setzen: (s: string) => void, auto?: string) => (
    <label className="feld">
      <span>{label}</span>
      <input className="eingabe" value={wert} autoComplete={auto ?? 'off'} onChange={(e) => setzen(e.target.value)} />
    </label>
  )

  return (
    <form className="stapel" style={{ gap: 12 }} onSubmit={absenden} aria-label="Als Lead anlegen">
      <div className="reihe zwischen">
        <div className="segment" role="group" aria-label="Anrede">
          {(
            [
              ['herr', 'Herr'],
              ['frau', 'Frau'],
              ['neutral', '–'],
            ] as const
          ).map(([k, t]) => (
            <button key={k} type="button" aria-pressed={anrede === k} onClick={() => setAnrede(k)}>
              {t}
            </button>
          ))}
        </div>
        {vorschlag && anrede === vorschlag ? <span className="klein ink-3">Vorschlag aus dem Vornamen</span> : null}
      </div>
      {titel ? feld('Titel', titel, setTitel) : null}
      <div className="raster-2">
        {feld('Vorname', vorname, setVorname)}
        {feld('Nachname', nachname, setNachname)}
      </div>
      {feld('Unternehmen', unternehmen, setUnternehmen)}
      <div className="raster-2">
        {feld('Rolle', rolle, setRolle)}
        {feld('Ort', stadt, setStadt)}
      </div>
      <label className="haken">
        <input type="checkbox" checked={anfrage} onChange={(e) => setAnfrage(e.target.checked)} />
        <span>Vernetzungsanfrage gerade gesendet</span>
      </label>
      <div className="reihe klein ink-3" style={{ gap: 6 }}>
        <Avatar member={ich} groesse={18} /> Zuständig: {ich.kurz}
      </div>
      <Knopf art="primaer" groesse="gross" voll type="submit" taste="↵" disabled={!!fehlt || laeuft} title={fehlt ?? undefined}>
        {laeuft ? 'Lege an …' : 'Als Lead anlegen'}
      </Knopf>
      {fehlt && person.profilUrl === null ? <p className="klein ink-3" style={{ margin: 0 }}>{fehlt}</p> : null}
      {meldung ? (
        <p className={meldung.fehler ? 'fehler' : 'klein ink-2'} role="alert" style={{ margin: 0 }}>
          {meldung.text}
        </p>
      ) : null}
    </form>
  )
}

export function NichtImCrm({
  ergebnis,
  person,
  ich,
  basis,
  onErledigt,
}: {
  ergebnis: SuchErgebnis
  person: PersonExtrakt
  ich: Ich
  basis: string
  onErledigt: (e: Erledigt) => void
}) {
  return (
    <div className="stapel" style={{ gap: 0 }}>
      <section className="abschnitt stapel" style={{ gap: 10 }} aria-label="Nicht im CRM">
        <span className="label">Nicht im CRM</span>
        {ergebnis.gesperrt ? (
          <p className="hinweis gefahr" style={{ margin: 0 }}>
            Steht auf der Sperrliste – nicht anlegen, nicht kontaktieren.
          </p>
        ) : null}
        {ergebnis.papierkorb ? (
          <div className="hinweis stapel" style={{ gap: 8 }}>
            <span>{ergebnis.papierkorb.name} liegt im Papierkorb des CRM.</span>
            <Knopf groesse="klein" onClick={() => oeffne(crmLink(basis, PFAD.lead(ergebnis.papierkorb?.id ?? '')))}>
              Im CRM ansehen ↗
            </Knopf>
          </div>
        ) : null}
        {ergebnis.vorschlaege.length > 0 ? (
          <div className="stapel" style={{ gap: 0 }}>
            <span className="klein ink-2">Ähnliche Namen im CRM:</span>
            {ergebnis.vorschlaege.map((v) => (
              <Vorschlag key={v.id} v={v} person={person} basis={basis} onVerknuepft={onErledigt} />
            ))}
          </div>
        ) : !ergebnis.gesperrt && !ergebnis.papierkorb ? (
          <p className="klein ink-3" style={{ margin: 0 }}>
            Kein Lead mit diesem Profil und keine ähnlichen Namen.
          </p>
        ) : null}
      </section>
      {!ergebnis.gesperrt && !ergebnis.papierkorb ? (
        <section className="abschnitt stapel" style={{ gap: 10 }} aria-label="Als Lead anlegen">
          <span className="label">Als Lead anlegen</span>
          <LeadAnlegen person={person} ich={ich} onAngelegt={onErledigt} />
        </section>
      ) : null}
    </div>
  )
}
