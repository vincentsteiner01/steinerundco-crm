// Verlauf eines Leads in der Seitenleiste (17.10.2026, Vincent: „wer hat was wie und wo gesagt“). Gleiche Einträge und Texte
// wie die Timeline im CRM; Standard „Gespräche“ (Nachrichten, Anrufe, E-Mails, Notizen, Termine), „Alles“ zeigt auch System-
// Einträge. Lädt neu, wenn sich die Lead-Ansicht ändert (nach Gesendet, Antwort, Notiz …).
import { useEffect, useMemo, useState } from 'react'
import { berlinTag, tagPlus } from '@/lib/zeit'
import type { LeadAnsicht, VerlaufCursor, VerlaufEintrag } from '../../shared/typen'
import { fmtDatumKurz } from '../../shared/zeit'
import { fehlerText, senden } from '../api'
import { Knopf } from '../teile'

type Ansicht = 'gespraeche' | 'alles'

const KANAL_KURZ: Record<string, string> = { linkedin: 'in', telefon: 'Tel', email: 'Mail' }
const KANAL_TITEL: Record<string, string> = { linkedin: 'LinkedIn', telefon: 'Telefon', email: 'E-Mail' }
const TERMINE = new Set(['meeting_geplant', 'meeting_stattgefunden', 'meeting_no_show', 'meeting_abgesagt', 'meeting_verschoben'])

/** Gespräche = alles, was zwischen Menschen passiert ist (plus Notizen und Termine) – ohne Stufen-/Sequenz-/Import-Einträge. */
export function istGespraech(e: Pick<VerlaufEintrag, 'kategorie' | 'typ'>): boolean {
  return (
    e.kategorie === 'nachrichten' ||
    e.kategorie === 'anrufe' ||
    e.kategorie === 'emails' ||
    e.kategorie === 'notizen' ||
    TERMINE.has(e.typ)
  )
}

const uhrzeit = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' })

/** „Heute“ · „Gestern“ · „Mi 14.10.“ (Berliner Kalendertag) */
export function tagLabel(iso: string, jetzt: Date = new Date()): string {
  const tag = berlinTag(iso)
  const heute = berlinTag(jetzt)
  if (tag === heute) return 'Heute'
  if (tag === tagPlus(heute, -1)) return 'Gestern'
  return fmtDatumKurz(iso)
}

export function Verlauf({ leadId, stand }: { leadId: string; stand: LeadAnsicht }) {
  const [eintraege, setEintraege] = useState<VerlaufEintrag[]>([])
  const [weiter, setWeiter] = useState<VerlaufCursor | null>(null)
  const [laedt, setLaedt] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)
  const [ansicht, setAnsicht] = useState<Ansicht>('gespraeche')
  const [offen, setOffen] = useState<Set<number>>(() => new Set())

  // erste Seite: beim Öffnen und nach jeder Aktion (neue Ansicht vom Service Worker)
  useEffect(() => {
    let aktiv = true
    setLaedt(true)
    setFehler(null)
    senden('verlauf', { leadId, vor: null })
      .then((s) => {
        if (!aktiv) return
        setEintraege(s.eintraege)
        setWeiter(s.weiter)
      })
      .catch((e) => aktiv && setFehler(fehlerText(e)))
      .finally(() => aktiv && setLaedt(false))
    return () => {
      aktiv = false
    }
  }, [leadId, stand])

  const mehr = async () => {
    if (!weiter) return
    setLaedt(true)
    try {
      const s = await senden('verlauf', { leadId, vor: weiter })
      setEintraege((alt) => [...alt, ...s.eintraege.filter((e) => !alt.some((x) => x.id === e.id))])
      setWeiter(s.weiter)
    } catch (e) {
      setFehler(fehlerText(e))
    } finally {
      setLaedt(false)
    }
  }

  const sichtbar = useMemo(
    () => (ansicht === 'alles' ? eintraege : eintraege.filter(istGespraech)),
    [ansicht, eintraege],
  )
  const ausgeblendet = eintraege.length - sichtbar.length

  const umschalten = (id: number) =>
    setOffen((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  let letzterTag = ''
  return (
    <section className="abschnitt" aria-label="Verlauf">
      <div className="abschnitt-kopf">
        <span className="label">Verlauf</span>
        <div className="segment klein-segment" role="group" aria-label="Verlauf zeigen">
          <button type="button" aria-pressed={ansicht === 'gespraeche'} onClick={() => setAnsicht('gespraeche')}>
            Gespräche
          </button>
          <button type="button" aria-pressed={ansicht === 'alles'} onClick={() => setAnsicht('alles')}>
            Alles
          </button>
        </div>
      </div>

      {fehler ? (
        <p className="fehler" role="alert" style={{ margin: 0 }}>
          {fehler}
        </p>
      ) : null}

      {laedt && eintraege.length === 0 ? <p className="klein ink-3" style={{ margin: 0 }}>Lade …</p> : null}

      {!laedt && sichtbar.length === 0 && !fehler ? (
        <p className="klein ink-3" style={{ margin: 0 }}>
          {ansicht === 'gespraeche' && ausgeblendet > 0
            ? `Noch kein Gespräch – „Alles“ zeigt ${ausgeblendet} ${ausgeblendet === 1 ? 'Eintrag' : 'Einträge'}.`
            : 'Noch nichts passiert.'}
        </p>
      ) : null}

      {sichtbar.length ? (
        <ol className="verlauf" aria-label="Einträge">
          {sichtbar.map((e) => {
            const tag = tagLabel(e.zeit)
            const neuerTag = tag !== letzterTag
            letzterTag = tag
            const kanal = e.kanal && KANAL_KURZ[e.kanal] ? e.kanal : null
            return (
              <li key={e.id} className="verlauf-eintrag" data-typ={e.typ} data-eingehend={e.eingehend || undefined}>
                <span className="verlauf-zeit mono-s">
                  {neuerTag ? <span className="verlauf-tag">{tag}</span> : null}
                  {uhrzeit.format(new Date(e.zeit))}
                </span>
                <span className="verlauf-punkt" aria-hidden />
                <span className="verlauf-inhalt">
                  <span className="verlauf-kopf">
                    {kanal ? (
                      <span className="verlauf-kanal mono-s" title={KANAL_TITEL[kanal]}>
                        {KANAL_KURZ[kanal]}
                      </span>
                    ) : null}
                    {e.wer ? (
                      <span className={e.eingehend ? 'verlauf-wer eingehend' : 'verlauf-wer mono-s'}>{e.wer}</span>
                    ) : null}
                  </span>
                  <span className="verlauf-text">{e.text}</span>
                  {e.details ? (
                    <button
                      type="button"
                      className="verlauf-auf"
                      aria-expanded={offen.has(e.id)}
                      onClick={() => umschalten(e.id)}
                    >
                      {offen.has(e.id) ? 'ausblenden' : 'anzeigen'}
                    </button>
                  ) : null}
                  {e.notiz ? <span className="zitat verlauf-block">{e.notiz}</span> : null}
                  {e.details && offen.has(e.id) ? <span className="verlauf-details">{e.details}</span> : null}
                </span>
              </li>
            )
          })}
        </ol>
      ) : null}

      {weiter ? (
        <Knopf art="leise" groesse="klein" style={{ marginTop: 8 }} disabled={laedt} onClick={() => void mehr()}>
          {laedt ? 'Lade …' : 'Ältere laden'}
        </Knopf>
      ) : null}
    </section>
  )
}
