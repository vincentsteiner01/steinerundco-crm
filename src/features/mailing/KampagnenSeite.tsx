// /email/kampagnen (01.11.2026): alle Kampagnen mit Stand und Zahlen; „Neue Kampagne“ legt eine Vorlage mit drei Mails an
// (Tag 0, +3, +8 im selben Verlauf – Recherche 02 § 9) und öffnet sie. Kampagnen gehen nur an Leads mit Erlaubnis-Grundlage.
import { Plus } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { PFADE } from '@/app/pfade'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { LadeFehler } from '@/components/ui/LadeFehler'
import { KopfStats, SeitenKopf } from '@/components/ui/SeitenKopf'
import { Skeleton } from '@/components/ui/Skeleton'
import { type KampagneEingabe, useAntworten, useKampagnen, useKampagneSpeichern } from '@/data/mailing'
import { KAMPAGNE_STATUS, quote, zeitplanAus, zeitplanText } from './logik'
import { Abschnitt, Leer, MailNav, Warum } from './Teile'

/** Vorlage einer neuen Kampagne – die eckigen Platzhalter [hier …] müssen vor dem Start ersetzt werden (sonst sendet nichts). */
const NEUE_KAMPAGNE: KampagneEingabe = {
  name: 'Neue Kampagne',
  zeitplan: { tage: [1, 2, 3, 4, 5], von: '08:00', bis: '16:00' },
  schritte: [
    {
      wartetage: 0,
      im_thread: true,
      varianten: [
        {
          kennung: 'A',
          aktiv: true,
          betreff: '[hier Betreff, kurz und sachlich]',
          text: '[Briefanrede],\n\n[hier der Anlass – z. B. „wie am Telefon besprochen“ – und in zwei, drei Sätzen der Nutzen für [Unternehmen]]\n\nPasst Ihnen ein kurzes Gespräch in den nächsten Tagen?\n\nViele Grüße\n[Absender Vorname]',
        },
      ],
    },
    {
      wartetage: 3,
      im_thread: true,
      varianten: [
        {
          kennung: 'A',
          aktiv: true,
          betreff: '',
          text: '[Briefanrede],\n\nich wollte kurz nachfassen – ist das Thema für Sie gerade relevant?\n\nViele Grüße\n[Absender Vorname]',
        },
      ],
    },
    {
      wartetage: 5,
      im_thread: true,
      varianten: [
        {
          kennung: 'A',
          aktiv: true,
          betreff: '',
          text: '[Briefanrede],\n\nich melde mich ein letztes Mal dazu. Wenn es gerade nicht passt, ist das völlig in Ordnung – eine kurze Antwort genügt.\n\nViele Grüße\n[Absender Vorname]',
        },
      ],
    },
  ],
}

export function Component() {
  const kampagnen = useKampagnen()
  const { data: antworten } = useAntworten()
  const anlegen = useKampagneSpeichern()
  const navigate = useNavigate()
  const liste = kampagnen.data ?? []
  const neu = () =>
    anlegen.mutate(NEUE_KAMPAGNE, { onSuccess: (id) => navigate(`${PFADE.emailKampagne(id)}?tab=ablauf`) })
  const offen = (antworten ?? []).filter((a) => !a.erledigt_at).length

  return (
    <>
      <SeitenKopf
        titel="Kampagnen"
        kontext="E-Mail"
        rechts={
          <>
            <KopfStats
              eintraege={[
                { wert: liste.filter((k) => k.status === 'aktiv').length, label: 'laufen' },
                { wert: liste.reduce((s, k) => s + (k.heute ?? 0), 0), label: 'heute gesendet' },
                { wert: offen, label: 'Antworten offen', ton: offen ? 'signal' : undefined },
              ]}
            />
            <Button variante="primary" icon={Plus} busy={anlegen.isPending} onClick={neu}>
              Neue Kampagne
            </Button>
          </>
        }
      />
      <MailNav antworten={offen} />
      <Abschnitt
        titel="Alle Kampagnen"
        satz="Eine Kampagne ist eine kurze Folge von Mails im selben Verlauf. Sie stoppt bei jeder Antwort – auch für die ganze Firma."
      >
        {kampagnen.isPending ? (
          <Skeleton className="h-40" />
        ) : kampagnen.isError ? (
          <LadeFehler text="Kampagnen konnten nicht geladen werden" onNochmal={() => void kampagnen.refetch()} />
        ) : liste.length ? (
          <div className="border-line-strong overflow-x-auto rounded-md border">
            <table className="text-table w-full min-w-[760px]">
              <thead className="text-ink-3 text-label border-line border-b text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Kampagne</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Empfänger</th>
                  <th className="px-3 py-2 text-right font-medium">Gesendet</th>
                  <th className="px-3 py-2 text-right font-medium">Antworten</th>
                  <th className="px-3 py-2 text-right font-medium">Interesse</th>
                  <th className="px-3 py-2 text-right font-medium">Unzustellbar</th>
                </tr>
              </thead>
              <tbody>
                {liste.map((k) => {
                  const st = KAMPAGNE_STATUS[k.status ?? 'entwurf'] ?? KAMPAGNE_STATUS.entwurf!
                  return (
                    <tr key={k.id} className="border-line hover:bg-surface-hover border-b last:border-b-0">
                      <td className="px-3 py-2.5">
                        <Link
                          to={PFADE.emailKampagne(k.id as string)}
                          className="text-ink-bright font-medium hover:underline"
                        >
                          {k.name}
                        </Link>
                        <span className="text-ink-3 block text-[12px]">{zeitplanText(zeitplanAus(k.zeitplan))}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <Chip ton={st.ton}>{st.label}</Chip>
                        {k.status_text ? (
                          <span className="text-overdue block max-w-[220px] truncate text-[12px]" title={k.status_text}>
                            {k.status_text}
                          </span>
                        ) : null}
                      </td>
                      <td className="tnum px-3 py-2.5 text-right">{k.empfaenger}</td>
                      <td className="tnum px-3 py-2.5 text-right">{k.gesendet}</td>
                      <td className="tnum px-3 py-2.5 text-right">
                        {k.antworten}{' '}
                        <span className="text-ink-3">
                          ({quote(k.beantwortet ?? 0, (k.empfaenger ?? 0) - (k.wartend ?? 0))})
                        </span>
                      </td>
                      <td className="tnum px-3 py-2.5 text-right">{k.interessiert}</td>
                      <td className="tnum px-3 py-2.5 text-right">{k.bounces}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Leer
            titel="Noch keine Kampagne"
            satz="Erst ein Postfach verbinden (Postfächer), dann hier eine Kampagne anlegen: Texte schreiben, Leads mit Erlaubnis auswählen, starten."
          >
            <Button variante="primary" icon={Plus} onClick={neu} busy={anlegen.isPending}>
              Erste Kampagne anlegen
            </Button>
          </Leer>
        )}
        <Warum label="Wen darf eine Kampagne anschreiben?">
          Nur Leads mit Erlaubnis-Grundlage: Sie haben am Telefon, per LinkedIn oder per Mail zugestimmt, ihr hattet ein
          Gespräch, oder es sind Bestandskunden. Kalte Werbe-Mails an Firmen sind in Deutschland auch im B2B verboten (§
          7 Abs. 2 Nr. 2 UWG) – schon eine einzige kann eine Abmahnung kosten. Das CRM prüft das vor jeder Mail. Der Weg
          zur Erlaubnis: anrufen, vernetzen und im Gespräch fragen („Darf ich Ihnen das per Mail schicken?“) – dann im
          Lead „Erlaubnis erfassen“.
        </Warum>
      </Abschnitt>
    </>
  )
}
