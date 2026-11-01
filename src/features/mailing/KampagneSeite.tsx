// /email/kampagnen/:id (01.11.2026): eine Kampagne mit Übersicht (Zahlen, Start-Checkliste, A/B je Mail), Ablauf (Editor),
// Empfängern und Einstellungen (Zeitplan, Limits, Postfächer, Abmelde-/Datenschutz-Hinweise, Bounce-Schutz).
// Starten prüft die Datenbank (crm.mail_kampagne_status); was ihr fehlt, steht vorher in der Checkliste.
import { Pause, Play, Save, Square, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { PFADE } from '@/app/pfade'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Chip } from '@/components/ui/Chip'
import { cn } from '@/components/ui/cn'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { LadeFehler } from '@/components/ui/LadeFehler'
import { SeitenKopf } from '@/components/ui/SeitenKopf'
import { Skeleton } from '@/components/ui/Skeleton'
import { Tabs } from '@/components/ui/Tabs'
import {
  type KampagneZahlen,
  type Postfach,
  type Schritt,
  useAntworten,
  useEmpfaenger,
  useKampagne,
  useKampagneLoeschen,
  useKampagnePruefen,
  useKampagneSpeichern,
  useKampagneStatus,
  usePostfaecher,
  useVariantenZahlen,
} from '@/data/mailing'
import { Kachel, Kacheln } from '@/features/telefon/ansichten/Teile'
import { AblaufEditor } from './AblaufEditor'
import { EmpfaengerTab } from './EmpfaengerTab'
import {
  HOCHLAUF,
  hochlaufLage,
  KAMPAGNE_STATUS,
  offenePlatzhalter,
  MAIL_PLATZHALTER,
  quote,
  WOCHENTAGE,
  zeitplanAus,
  type Zeitplan,
} from './logik'
import { Abschnitt, Ampel, MailNav, Warum } from './Teile'
import { useBestaetigung } from './useBestaetigung'

type Tab = 'uebersicht' | 'ablauf' | 'empfaenger' | 'einstellungen'
const TABS: Tab[] = ['uebersicht', 'ablauf', 'empfaenger', 'einstellungen']

export function Component() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const tab: Tab = TABS.includes(params.get('tab') as Tab) ? (params.get('tab') as Tab) : 'uebersicht'
  const daten = useKampagne(id)
  const { data: empfaenger } = useEmpfaenger(id)
  const { data: postfaecher } = usePostfaecher()
  const { data: antworten } = useAntworten()
  const status = useKampagneStatus()
  const loeschen = useKampagneLoeschen()
  const navigate = useNavigate()
  const { dialog, fragen } = useBestaetigung()
  const k = daten.data?.kampagne
  const offen = (antworten ?? []).filter((a) => !a.erledigt_at).length

  if (daten.isPending) return <Skeleton className="mt-10 h-60" />
  if (daten.isError || !k)
    return (
      <LadeFehler
        text="Die Kampagne konnte nicht geladen werden"
        onNochmal={() => void daten.refetch()}
        className="mt-10"
      />
    )

  const st = KAMPAGNE_STATUS[k.status ?? 'entwurf'] ?? KAMPAGNE_STATUS.entwurf!
  const gewaehlt = (postfaecher ?? []).filter((p) => daten.data?.postfaecher.includes(p.id as string))
  const setzeTab = (t: Tab) => {
    const p = new URLSearchParams(params)
    p.set('tab', t)
    setParams(p, { replace: true })
  }
  const starten = () =>
    status.mutate(
      { id: k.id as string, status: 'aktiv' },
      { onSuccess: () => toast('Kampagne läuft – die erste Mail geht im nächsten passenden Takt raus') },
    )

  return (
    <>
      {dialog}
      <SeitenKopf
        titel={k.name ?? 'Kampagne'}
        kontext="Kampagne"
        titelRechts={<Chip ton={st.ton}>{st.label}</Chip>}
        rechts={
          <>
            {k.status === 'entwurf' || k.status === 'pausiert' ? (
              <Button variante="primary" icon={Play} busy={status.isPending} onClick={starten}>
                {k.status === 'entwurf' ? 'Starten' : 'Fortsetzen'}
              </Button>
            ) : null}
            {k.status === 'aktiv' ? (
              <Button
                variante="secondary"
                icon={Pause}
                busy={status.isPending}
                onClick={() => status.mutate({ id: k.id as string, status: 'pausiert' })}
              >
                Pausieren
              </Button>
            ) : null}
            {k.status !== 'beendet' && k.status !== 'entwurf' ? (
              <Button
                variante="quiet"
                icon={Square}
                onClick={() =>
                  fragen({
                    titel: 'Kampagne beenden?',
                    text: 'Offene Empfänger bekommen keine Mails mehr. Eine beendete Kampagne lässt sich nicht wieder starten.',
                    label: 'Beenden',
                    los: () => status.mutate({ id: k.id as string, status: 'beendet' }),
                  })
                }
              >
                Beenden
              </Button>
            ) : null}
            {k.status === 'entwurf' ? (
              <Button
                variante="quiet"
                icon={Trash2}
                onClick={() =>
                  fragen({
                    titel: 'Entwurf löschen?',
                    text: 'Die Kampagne mit allen Texten und Empfängern wird gelöscht. Die Leads bleiben erhalten.',
                    label: 'Löschen',
                    los: () => loeschen.mutate(k.id as string, { onSuccess: () => navigate(PFADE.emailKampagnen) }),
                  })
                }
              >
                Löschen
              </Button>
            ) : null}
          </>
        }
      />
      <MailNav antworten={offen} />
      {k.status_text ? (
        <p className="bg-overdue-tint text-small text-overdue mb-4 rounded-sm px-3 py-2">{k.status_text}</p>
      ) : null}
      <Tabs
        ariaLabel="Kampagne"
        className="mb-5"
        wert={tab}
        onChange={setzeTab}
        tabs={[
          { key: 'uebersicht', label: 'Übersicht' },
          { key: 'ablauf', label: 'Ablauf', zaehler: daten.data?.schritte.length },
          { key: 'empfaenger', label: 'Empfänger', zaehler: k.empfaenger ?? 0 },
          { key: 'einstellungen', label: 'Einstellungen' },
        ]}
      />
      <div role="tabpanel">
        {tab === 'uebersicht' ? (
          <Uebersicht k={k} schritte={daten.data?.schritte ?? []} postfaecher={gewaehlt} onTab={setzeTab} />
        ) : tab === 'ablauf' ? (
          <AblaufEditor
            key={(daten.data?.schritte ?? [])
              .map((x) => `${x.updated_at}:${x.mail_varianten.map((v) => v.updated_at).join()}`)
              .join('|')}
            kampagne={k}
            schritte={daten.data?.schritte ?? []}
            empfaenger={empfaenger ?? []}
            postfaecher={gewaehlt}
          />
        ) : tab === 'empfaenger' ? (
          <EmpfaengerTab
            kampagneId={k.id as string}
            empfaenger={empfaenger ?? []}
            schritte={daten.data?.schritte.length ?? 0}
            beendet={k.status === 'beendet'}
          />
        ) : (
          <Einstellungen
            key={`${k.updated_at}-${(daten.data?.postfaecher ?? []).join()}`}
            k={k}
            gewaehlt={daten.data?.postfaecher ?? []}
            postfaecher={postfaecher ?? []}
          />
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------- Übersicht
function Uebersicht({
  k,
  schritte,
  postfaecher,
  onTab,
}: {
  k: KampagneZahlen
  schritte: Schritt[]
  postfaecher: Postfach[]
  onTab: (t: Tab) => void
}) {
  const { data: varianten } = useVariantenZahlen(k.id)
  const { data: gesperrt } = useKampagnePruefen(k.id)
  const kontaktiert = (k.empfaenger ?? 0) - (k.wartend ?? 0)
  const aktiveTexte = schritte.flatMap((s) =>
    s.mail_varianten.filter((v) => v.aktiv).map((v) => `${v.betreff}\n${v.text}`),
  )
  const unbekannt = [...new Set(aktiveTexte.flatMap((t) => offenePlatzhalter(t)))].filter(
    (p) => !(MAIL_PLATZHALTER as readonly string[]).includes(p),
  )
  const startklar = postfaecher.filter((p) => (hochlaufLage(p.hochlauf_lage)?.limit ?? 0) > 0)
  const ersteOk = schritte[0]?.mail_varianten.some((v) => v.aktiv && v.betreff.trim() && v.text.trim())
  const offenZahl = (k.wartend ?? 0) + (k.laufend ?? 0)
  const pruefpunkte = [
    {
      ok: postfaecher.length > 0,
      text: postfaecher.length ? `${postfaecher.length} Postfach gewählt` : 'Kein Postfach gewählt',
      tab: 'einstellungen' as Tab,
    },
    {
      ok: startklar.length > 0,
      text: startklar.length
        ? `Startklar: ${startklar.map((p) => `${p.adresse} (${HOCHLAUF[hochlaufLage(p.hochlauf_lage)!.stufe].label}, heute ${hochlaufLage(p.hochlauf_lage)!.limit})`).join(', ')}`
        : `Kein Postfach darf gerade senden${postfaecher[0] ? ` – ${hochlaufLage(postfaecher[0].hochlauf_lage)?.gruende[0] ?? 'siehe Postfächer'}` : ''}`,
      tab: 'einstellungen' as Tab,
    },
    {
      ok: !!ersteOk,
      text: ersteOk ? 'Erste Mail hat Betreff und Text' : 'Die erste Mail braucht Betreff und Text',
      tab: 'ablauf' as Tab,
    },
    {
      ok: unbekannt.length === 0,
      text: unbekannt.length
        ? `Noch auszufüllen: ${unbekannt.map((p) => `[${p}]`).join(', ')}`
        : 'Alle Platzhalter bekannt',
      tab: 'ablauf' as Tab,
    },
    {
      ok: offenZahl - (gesperrt?.length ?? 0) > 0,
      text: `${Math.max(offenZahl - (gesperrt?.length ?? 0), 0)} von ${offenZahl} offenen Empfängern dürfen angeschrieben werden`,
      tab: 'empfaenger' as Tab,
    },
  ]
  return (
    <>
      <Kacheln>
        <Kachel
          label="Empfänger"
          wert={k.empfaenger ?? 0}
          hinweis={`${k.wartend ?? 0} warten · ${k.laufend ?? 0} laufen`}
        />
        <Kachel label="Gesendet" wert={k.gesendet ?? 0} hinweis={`heute ${k.heute ?? 0}`} />
        <Kachel
          label="Antworten"
          wert={k.beantwortet ?? 0}
          hinweis={`${quote(k.beantwortet ?? 0, kontaktiert)} der Angeschriebenen`}
          ton={(k.beantwortet ?? 0) > 0 ? 'done' : undefined}
        />
        <Kachel
          label="Unzustellbar"
          wert={k.bounces ?? 0}
          hinweis={`${quote(k.bounces ?? 0, kontaktiert)} · Ziel unter 2 %`}
          ton={kontaktiert >= 20 && (k.bounces ?? 0) / kontaktiert > 0.02 ? 'overdue' : undefined}
        />
      </Kacheln>
      {k.status !== 'aktiv' && k.status !== 'beendet' ? (
        <Abschnitt titel="Vor dem Start">
          <ul className="grid gap-1.5">
            {pruefpunkte.map((p) => (
              <li key={p.text}>
                <button type="button" onClick={() => onTab(p.tab)} className="text-left hover:underline">
                  <Ampel ok={p.ok}>{p.text}</Ampel>
                </button>
              </li>
            ))}
          </ul>
        </Abschnitt>
      ) : null}
      <Abschnitt
        titel="Je Mail und Variante"
        satz="Antworten zählen für die Mail, auf die geantwortet wurde. Öffnungen misst das CRM bewusst nicht – sie sind ungenau und schaden der Zustellung."
      >
        {schritte.length ? (
          <div className="border-line-strong overflow-x-auto rounded-md border">
            <table className="text-table w-full min-w-[560px]">
              <thead className="text-ink-3 text-label border-line border-b text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Mail</th>
                  <th className="px-3 py-2 font-medium">Variante</th>
                  <th className="px-3 py-2 text-right font-medium">Gesendet</th>
                  <th className="px-3 py-2 text-right font-medium">Antworten</th>
                  <th className="px-3 py-2 text-right font-medium">Quote</th>
                  <th className="px-3 py-2 text-right font-medium">Unzustellbar</th>
                </tr>
              </thead>
              <tbody>
                {schritte.flatMap((s) =>
                  s.mail_varianten.map((v) => {
                    const z = varianten?.find((x) => x.variante_id === v.id)
                    return (
                      <tr key={v.id} className={cn('border-line border-b last:border-b-0', !v.aktiv && 'text-ink-3')}>
                        <td className="px-3 py-2">Mail {s.position + 1}</td>
                        <td className="px-3 py-2">
                          {v.kennung}
                          <span className="text-ink-3 ml-2 inline-block max-w-[260px] truncate align-bottom">
                            {v.betreff || 'Re: …'}
                          </span>
                        </td>
                        <td className="tnum px-3 py-2 text-right">{z?.gesendet ?? 0}</td>
                        <td className="tnum px-3 py-2 text-right">{z?.beantwortet ?? 0}</td>
                        <td className="tnum px-3 py-2 text-right">{quote(z?.beantwortet ?? 0, z?.gesendet ?? 0)}</td>
                        <td className="tnum px-3 py-2 text-right">{z?.bounces ?? 0}</td>
                      </tr>
                    )
                  }),
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-small text-ink-3">Noch keine Mails angelegt.</p>
        )}
      </Abschnitt>
    </>
  )
}

// ---------------------------------------------------------------- Einstellungen
function Einstellungen({
  k,
  gewaehlt,
  postfaecher,
}: {
  k: KampagneZahlen
  gewaehlt: string[]
  postfaecher: Postfach[]
}) {
  const speichern = useKampagneSpeichern()
  const versand = useMemo(() => postfaecher.filter((p) => p.rolle === 'versand'), [postfaecher])
  const start = useMemo(
    () => ({
      name: k.name ?? '',
      zeitplan: zeitplanAus(k.zeitplan),
      tageslimit: k.tageslimit ?? 50,
      neue: k.neue_pro_tag ?? 20,
      postfaecher: gewaehlt,
      stopp_firma: k.stopp_firma ?? true,
      abmelde_satz: k.abmelde_satz ?? true,
      abmelde_kopf: k.abmelde_kopf ?? true,
      datenschutz_satz: k.datenschutz_satz ?? true,
      bounce_schutz: k.bounce_schutz ?? true,
    }),
    [k, gewaehlt],
  )
  const [f, setF] = useState(start)
  const setze = <K extends keyof typeof f>(key: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [key]: v }))
  const zp = (z: Partial<Zeitplan>) => setze('zeitplan', { ...f.zeitplan, ...z })
  const geaendert = JSON.stringify(f) !== JSON.stringify(start)

  return (
    <div className="grid max-w-[760px] gap-6">
      <FormField label="Name" htmlFor="k-name">
        <Input id="k-name" value={f.name} onChange={(e) => setze('name', e.target.value)} />
      </FormField>

      <fieldset className="grid gap-2">
        <legend className="text-label text-ink-2 mb-1">Postfächer</legend>
        {versand.length ? (
          versand.map((p) => {
            const h = hochlaufLage(p.hochlauf_lage)
            return (
              <label key={p.id} className="flex flex-wrap items-center gap-2">
                <Checkbox
                  checked={f.postfaecher.includes(p.id as string)}
                  onChange={(e) =>
                    setze(
                      'postfaecher',
                      e.target.checked ? [...f.postfaecher, p.id as string] : f.postfaecher.filter((x) => x !== p.id),
                    )
                  }
                  label={`${p.adresse} · ${p.absender_name}`}
                />
                {h ? <Chip ton={HOCHLAUF[h.stufe].ton}>{HOCHLAUF[h.stufe].label}</Chip> : null}
              </label>
            )
          })
        ) : (
          <p className="text-small text-ink-3">Noch kein Versand-Postfach verbunden (E-Mail → Postfächer).</p>
        )}
        <Warum label="Mehrere Postfächer?">
          Jeder Empfänger bleibt bei seinem ersten Postfach (Antworten und Folgemails im selben Verlauf). Mehrere
          Postfächer verteilen nur die Menge – eines je echter Person, keine erfundenen Absender.
        </Warum>
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="text-label text-ink-2 mb-1">Versandzeiten (deutsche Zeit, Feiertage ausgenommen)</legend>
        <div className="flex flex-wrap gap-1.5">
          {WOCHENTAGE.map((w) => {
            const an = f.zeitplan.tage.includes(w.nr)
            return (
              <button
                key={w.nr}
                type="button"
                aria-pressed={an}
                onClick={() =>
                  zp({ tage: an ? f.zeitplan.tage.filter((t) => t !== w.nr) : [...f.zeitplan.tage, w.nr].sort() })
                }
                className={cn(
                  'text-ui h-9 w-11 rounded-sm border transition-colors',
                  an
                    ? 'border-signal bg-signal-tint text-signal'
                    : 'border-line-strong text-ink-2 hover:bg-surface-hover',
                )}
              >
                {w.kurz}
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="time"
            aria-label="von"
            value={f.zeitplan.von}
            onChange={(e) => zp({ von: e.target.value })}
            className="w-[120px]"
          />
          <span className="text-ink-3">bis</span>
          <Input
            type="time"
            aria-label="bis"
            value={f.zeitplan.bis}
            onChange={(e) => zp({ bis: e.target.value })}
            className="w-[120px]"
          />
        </div>
        <p className="text-small text-ink-3">
          Die meisten Antworten kommen vormittags; Mo–Fr 8–16 Uhr ist ein guter Start.
        </p>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Höchstens Mails am Tag (Kampagne)"
          htmlFor="k-limit"
          hinweis="Die Postfächer haben zusätzlich ihr eigenes Limit aus dem Hochlauf."
        >
          <Input
            id="k-limit"
            type="number"
            min={1}
            max={1000}
            value={f.tageslimit}
            onChange={(e) => setze('tageslimit', Number(e.target.value) || 1)}
          />
        </FormField>
        <FormField
          label="Höchstens neue Empfänger am Tag"
          htmlFor="k-neue"
          hinweis="Folgemails haben Vorrang vor neuen Erstkontakten."
        >
          <Input
            id="k-neue"
            type="number"
            min={1}
            max={500}
            value={f.neue}
            onChange={(e) => setze('neue', Number(e.target.value) || 1)}
          />
        </FormField>
      </div>

      <fieldset className="grid gap-2.5">
        <legend className="text-label text-ink-2 mb-1">Regeln</legend>
        <Checkbox
          checked={f.stopp_firma}
          onChange={(e) => setze('stopp_firma', e.target.checked)}
          label="Antwortet jemand, stoppt die Kampagne für die ganze Firma"
        />
        <Checkbox
          checked={f.abmelde_satz}
          onChange={(e) => setze('abmelde_satz', e.target.checked)}
          label="Abmelde-Satz unter jeder Mail („… genügt eine kurze Antwort“)"
        />
        <Checkbox
          checked={f.abmelde_kopf}
          onChange={(e) => setze('abmelde_kopf', e.target.checked)}
          label="Abmelden mit einem Klick im Mailprogramm (unsichtbare Kopfzeile)"
        />
        <Checkbox
          checked={f.datenschutz_satz}
          onChange={(e) => setze('datenschutz_satz', e.target.checked)}
          label="Datenschutz-Hinweis in der ersten Mail (Art. 14 DSGVO)"
        />
        <Checkbox
          checked={f.bounce_schutz}
          onChange={(e) => setze('bounce_schutz', e.target.checked)}
          label="Automatisch anhalten, wenn mehr als 3 % unzustellbar sind"
        />
        <Warum>
          Widerspruch muss jederzeit einfach möglich sein (Art. 21 DSGVO) – darum der Satz unter jeder Mail und die
          Ein-Klick-Abmeldung, die Gmail und Apple Mail neben dem Absender anzeigen. Wer abmeldet oder „Bitte keine
          Mails“ schreibt, landet sofort auf der Sperrliste. Viele Unzustellbare schaden dem Ruf des Postfachs – deshalb
          hält das CRM vorher an.
        </Warum>
      </fieldset>

      <div className="bg-canvas border-line sticky bottom-0 z-10 flex justify-end border-t py-3">
        <Button
          variante="primary"
          icon={Save}
          disabled={!geaendert || !f.zeitplan.tage.length || f.zeitplan.von >= f.zeitplan.bis}
          busy={speichern.isPending}
          onClick={() =>
            speichern.mutate(
              {
                id: k.id as string,
                name: f.name.trim() || 'Kampagne',
                zeitplan: f.zeitplan,
                tageslimit: f.tageslimit,
                neue_pro_tag: f.neue,
                postfaecher: f.postfaecher,
                stopp_firma: f.stopp_firma,
                abmelde_satz: f.abmelde_satz,
                abmelde_kopf: f.abmelde_kopf,
                datenschutz_satz: f.datenschutz_satz,
                bounce_schutz: f.bounce_schutz,
              },
              { onSuccess: () => toast('Einstellungen gespeichert') },
            )
          }
        >
          {geaendert ? 'Speichern' : 'Gespeichert'}
        </Button>
      </div>
    </div>
  )
}
