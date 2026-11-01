// /email/postfaecher (01.11.2026): Einrichtung Schritt für Schritt mit „Warum?“, Versand-Domains mit DNS-Ampel, Versand-Postfächer
// mit Hochlauf-Stufe, Prüf-Postfächer mit passiven Platzierungstests und Sperr-Domains. Ersetzt Instantlys „Email Accounts“ –
// aber ohne Aufwärm-Netz (Heatwave-Blockliste seit 09/2026), stattdessen verdienter Hochlauf mit echten Mails.
import { FlaskConical, Mail, Pause, Play, Plus, Send, Trash2, Wifi } from 'lucide-react'
import { useState } from 'react'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Dialog } from '@/components/ui/Dialog'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { LadeFehler } from '@/components/ui/LadeFehler'
import { KopfStats, SeitenKopf } from '@/components/ui/SeitenKopf'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { Textarea } from '@/components/ui/Textarea'
import { useMe } from '@/data'
import {
  type Postfach,
  useAntworten,
  useDomains,
  useDomainSpeichern,
  usePlatzierungsTests,
  usePlatzierungStarten,
  usePostfachAendern,
  usePostfachLoeschen,
  usePostfaecher,
  usePostfachTesten,
  useSperrdomains,
  useSperrdomainSetzen,
  useTestmail,
} from '@/data/mailing'
import { fmtDatumZeit } from '@/lib/format'
import { DomainKarte } from './DomainKarte'
import { ANBIETER, HOCHLAUF, hochlaufLage, POSTFACH_STATUS, quote, type Anbieter } from './logik'
import { PostfachDialog } from './PostfachDialog'
import { Abschnitt, Ampel, Leer, MailNav, Warum } from './Teile'
import { useBestaetigung } from './useBestaetigung'

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/

export function Component() {
  const postfaecher = usePostfaecher()
  const domains = useDomains()
  const { data: antworten } = useAntworten()
  const [dialog, setDialog] = useState<null | 'versand' | 'saat'>(null)
  const [testDialog, setTestDialog] = useState(false)
  const alle = postfaecher.data ?? []
  const versand = alle.filter((p) => p.rolle === 'versand')
  const saat = alle.filter((p) => p.rolle === 'saat')
  const heute = versand.reduce((s, p) => s + (hochlaufLage(p.hochlauf_lage)?.heute ?? 0), 0)
  const offen = (antworten ?? []).filter((a) => !a.erledigt_at).length

  return (
    <>
      <SeitenKopf
        titel="Postfächer"
        kontext="E-Mail"
        rechts={
          <KopfStats
            eintraege={[
              { wert: versand.filter((p) => p.status === 'bereit').length, label: 'verbunden' },
              { wert: heute, label: 'heute gesendet' },
              { wert: saat.length, label: 'Prüf-Postfächer' },
            ]}
          />
        }
      />
      <MailNav antworten={offen} />
      <Einrichtung
        versand={versand}
        domainsOk={(domains.data ?? []).some((d) => (d.dns as { ok?: boolean } | null)?.ok)}
      />

      <Abschnitt
        titel="Versand-Domains"
        satz="Gesendet wird nie von steinerundco.de, sondern von einer eigenen Versand-Domain – so bleibt eure Hauptadresse geschützt."
        rechts={<DomainHinzufuegen />}
      >
        {domains.isPending ? (
          <Skeleton className="h-40" />
        ) : domains.isError ? (
          <LadeFehler text="Domains konnten nicht geladen werden" onNochmal={() => void domains.refetch()} />
        ) : domains.data?.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {domains.data.map((d) => (
              <DomainKarte key={d.id} domain={d} />
            ))}
          </div>
        ) : (
          <Leer
            titel="Noch keine Versand-Domain"
            satz="Oben rechts eine Domain eintragen – danach zeigt die Ampel, welche DNS-Einträge noch fehlen."
          />
        )}
      </Abschnitt>

      <Abschnitt
        titel="Versand-Postfächer"
        satz="Ein Postfach je echter Person. Der Hochlauf steigert die Tagesmenge über sechs Wochen – nur, solange kaum etwas unzustellbar ist."
        rechts={
          <Button variante="primary" icon={Plus} onClick={() => setDialog('versand')}>
            Postfach verbinden
          </Button>
        }
      >
        {postfaecher.isPending ? (
          <Skeleton className="h-32" />
        ) : postfaecher.isError ? (
          <LadeFehler text="Postfächer konnten nicht geladen werden" onNochmal={() => void postfaecher.refetch()} />
        ) : versand.length ? (
          <ul className="grid gap-2">
            {versand.map((p) => (
              <PostfachZeile key={p.id} p={p} />
            ))}
          </ul>
        ) : (
          <Leer
            titel="Noch kein Postfach verbunden"
            satz="Erst die Versand-Domain einrichten, dann das Postfach mit App-Passwort verbinden."
          />
        )}
      </Abschnitt>

      <Abschnitt
        titel="Prüf-Postfächer und Platzierungstests"
        satz="Eigene Postfächer bei GMX, WEB.DE, T-Online und Gmail. Ein Test schickt eine echte Mail dorthin und schaut nur nach, wo sie landet."
        rechts={
          <>
            <Button variante="secondary" icon={Plus} onClick={() => setDialog('saat')}>
              Prüf-Postfach
            </Button>
            <Button
              variante="secondary"
              icon={FlaskConical}
              disabled={!saat.length || !versand.length}
              onClick={() => setTestDialog(true)}
            >
              Test starten
            </Button>
          </>
        }
      >
        {saat.length ? (
          <ul className="mb-4 grid gap-2">
            {saat.map((p) => (
              <PostfachZeile key={p.id} p={p} />
            ))}
          </ul>
        ) : (
          <Leer
            titel="Noch kein Prüf-Postfach"
            satz="Viele Solar- und Handwerksbetriebe haben Adressen bei T-Online, GMX oder IONOS – deren Filter sind strenger als Gmail. Mit je einem eigenen Prüf-Postfach seht ihr, wo eure Mails dort landen."
          />
        )}
        <Tests />
        <Warum label="Warum nur nachsehen und nichts anklicken?">
          Werkzeuge wie Instantly öffnen Test-Mails automatisch, antworten und holen sie aus dem Spam. Genau dieses
          Muster erkennt die Blockliste „Heatwave“ seit September 2026 und sperrt die Domain dauerhaft. Unsere Tests
          bleiben deshalb rein passiv.
        </Warum>
      </Abschnitt>

      <SperrDomains />

      {dialog ? <PostfachDialog offen onClose={() => setDialog(null)} rolle={dialog} /> : null}
      {testDialog ? <TestDialog versand={versand} onClose={() => setTestDialog(false)} /> : null}
    </>
  )
}

// ---------------------------------------------------------------- Einrichtung Schritt für Schritt
function Einrichtung({ versand, domainsOk }: { versand: Postfach[]; domainsOk: boolean }) {
  const verbunden = versand.some((p) => p.status === 'bereit')
  const startklar = versand.some((p) => {
    const h = hochlaufLage(p.hochlauf_lage)
    return h && h.stufe !== 'vorbereitung' && h.stufe !== 'pause'
  })
  const schritte: { titel: string; ok: boolean; warum: string }[] = [
    {
      titel: 'Versand-Domain kaufen (z. B. steinerundco-team.de) – mindestens 30 Tage vor der ersten Kampagne',
      ok: domainsOk || versand.length > 0,
      warum:
        'Wird eine Versand-Domain gesperrt, bleibt steinerundco.de sauber. Eine neue Domain wirkt auf Spamfilter verdächtig – nach 30 Tagen ist sie „gereift“. Ein, höchstens zwei Domains, klar als Steiner & Co. erkennbar – keine Domain-Familien.',
    },
    {
      titel: 'DNS-Einträge setzen: SPF, DKIM, DMARC und MX (unten zum Kopieren)',
      ok: domainsOk,
      warum: 'Ohne diese Einträge lehnen Gmail, Microsoft, GMX und T-Online die Mails ab oder legen sie in den Spam.',
    },
    {
      titel: 'Postfach anlegen – am besten in einem eigenen Google-Workspace-Konto, nicht im Konto von steinerundco.de',
      ok: versand.length > 0,
      warum:
        'Google sperrt bei Verdacht ganze Konten. Liegt das Versand-Postfach in einem eigenen Workspace, bleibt euer normales Postfach (vincent@steinerundco.de) unberührt.',
    },
    {
      titel: 'Postfach hier verbinden und testen (App-Passwort)',
      ok: verbunden,
      warum:
        'Das CRM sendet und liest über das echte Postfach – mit dessen Unterschrift (DKIM) und im „Gesendet“-Ordner sichtbar.',
    },
    {
      titel: 'Hochlauf: erste Wochen echte Mails schreiben, das CRM steigert die Menge selbst',
      ok: startklar,
      warum:
        'Woche 1–2 höchstens 10 Mails am Tag, Woche 3–4 15, Woche 5–6 25. Werden zu viele Mails abgelehnt oder sind unzustellbar, bremst das CRM automatisch.',
    },
  ]
  const fertig = schritte.filter((s) => s.ok).length
  return (
    <Abschnitt
      titel={`Einrichtung · ${fertig} von ${schritte.length} erledigt`}
      satz="So wird ein Postfach startklar – jeder Schritt mit Begründung."
    >
      <ol className="grid gap-2">
        {schritte.map((s, i) => (
          <li key={s.titel} className="border-line rounded-md border px-3.5 py-2.5">
            <Ampel ok={s.ok} warn={!s.ok && i === fertig}>
              <span className="text-ink-bright">
                {i + 1}. {s.titel}
              </span>
            </Ampel>
            <Warum>{s.warum}</Warum>
          </li>
        ))}
      </ol>
    </Abschnitt>
  )
}

// ---------------------------------------------------------------- Domains
function DomainHinzufuegen() {
  const speichern = useDomainSpeichern()
  const [domain, setDomain] = useState('')
  const [anbieter, setAnbieter] = useState<Anbieter>('google')
  const d = domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
  const gueltig = DOMAIN_RE.test(d)
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (!gueltig) return
        speichern.mutate(
          { domain: d, anbieter, zweck: d === 'steinerundco.de' ? 'haupt' : 'versand', dns: {} },
          { onSuccess: () => (setDomain(''), toast(`${d} hinzugefügt – jetzt „Prüfen“`)) },
        )
      }}
    >
      <Input
        aria-label="Domain"
        placeholder="versand-domain.de"
        value={domain}
        onChange={(e) => setDomain(e.target.value)}
        className="w-[200px]"
      />
      <Select
        aria-label="Mail-Anbieter der Domain"
        value={anbieter}
        onChange={(e) => setAnbieter(e.target.value as Anbieter)}
        optionen={ANBIETER.filter((a) => !a.nurPruef && !a.spaeter).map((a) => ({ value: a.key, label: a.label }))}
      />
      <Button
        type="submit"
        variante="secondary"
        icon={Plus}
        disabled={!gueltig}
        disabledGrund={gueltig ? undefined : 'Domain eingeben'}
        busy={speichern.isPending}
      >
        Domain
      </Button>
    </form>
  )
}

// ---------------------------------------------------------------- Postfach-Zeile
function PostfachZeile({ p }: { p: Postfach }) {
  const testen = usePostfachTesten()
  const aendern = usePostfachAendern()
  const loeschen = usePostfachLoeschen()
  const { dialog, fragen } = useBestaetigung()
  const [testmailOffen, setTestmailOffen] = useState(false)
  const h = hochlaufLage(p.hochlauf_lage)
  const status = POSTFACH_STATUS[p.status ?? 'neu'] ?? POSTFACH_STATUS.neu!
  const stufe = h ? HOCHLAUF[h.stufe] : null
  const [jetzt] = useState(() => Date.now())
  const gesperrt = p.gesperrt_bis && new Date(p.gesperrt_bis).getTime() > jetzt
  return (
    <li className="border-line-strong rounded-md border px-4 py-3" data-postfach={p.adresse}>
      {dialog}
      {testmailOffen ? <TestmailDialog postfachId={p.id as string} onClose={() => setTestmailOffen(false)} /> : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Mail size={16} className="text-ink-3 shrink-0" aria-hidden />
          <span className="text-ui text-ink-bright truncate">{p.adresse}</span>
          {p.rolle === 'versand' && p.absender_name ? (
            <span className="text-small text-ink-3 truncate">{p.absender_name}</span>
          ) : null}
          <Chip ton={status.ton}>{status.label}</Chip>
          {stufe && p.status === 'bereit' ? <Chip ton={stufe.ton}>{stufe.label}</Chip> : null}
          {gesperrt ? <Chip ton="overdue">Pause bis {fmtDatumZeit(p.gesperrt_bis as string)}</Chip> : null}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Button
            variante="quiet"
            groesse="S"
            icon={Wifi}
            busy={testen.isPending}
            onClick={() =>
              testen.mutate(p.id as string, {
                onSuccess: (t) => toast(t.ok ? 'Verbindung klappt' : `Verbindung fehlgeschlagen: ${t.fehler ?? ''}`),
              })
            }
          >
            Testen
          </Button>
          {p.rolle === 'versand' && p.status === 'bereit' ? (
            <Button variante="quiet" groesse="S" icon={Send} onClick={() => setTestmailOffen(true)}>
              Testmail
            </Button>
          ) : null}
          {p.status === 'pausiert' ? (
            <Button
              variante="quiet"
              groesse="S"
              icon={Play}
              onClick={() => aendern.mutate({ id: p.id as string, werte: { status: 'bereit' } })}
            >
              Fortsetzen
            </Button>
          ) : p.status === 'bereit' ? (
            <Button
              variante="quiet"
              groesse="S"
              icon={Pause}
              onClick={() => aendern.mutate({ id: p.id as string, werte: { status: 'pausiert' } })}
            >
              Pausieren
            </Button>
          ) : null}
          <Button
            variante="icon"
            icon={Trash2}
            aria-label={`${p.adresse} entfernen`}
            onClick={() =>
              fragen({
                titel: `${p.adresse} entfernen?`,
                text: 'Das gespeicherte Passwort wird gelöscht. Das Postfach selbst bleibt beim Anbieter bestehen.',
                label: 'Entfernen',
                los: () => loeschen.mutate(p.id as string),
              })
            }
          />
        </div>
      </div>
      {p.status_text ? (
        <p className={p.status === 'fehler' ? 'text-small text-danger mt-1.5' : 'text-small text-overdue mt-1.5'}>
          {p.status_text}
        </p>
      ) : null}
      {h && p.rolle === 'versand' && p.status === 'bereit' ? (
        <div className="text-small text-ink-2 mt-2 grid gap-1">
          <span>
            {stufe?.satz} Heute <b className="text-ink-bright tnum">{h.heute}</b> von{' '}
            <b className="text-ink-bright tnum">{h.limit}</b>
            {h.woche ? ` · Woche ${h.woche}` : ''}
            {h.sends_14 ? ` · 14 Tage: ${h.sends_14} gesendet, Bounces ${quote(h.bounces_14, h.sends_14)}` : ''}
            {h.platzierung
              ? ` · letzter Test: ${h.platzierung.posteingang}/${h.platzierung.geprueft} im Posteingang`
              : ''}
          </span>
          {h.gruende.map((g) => (
            <span key={g} className="text-overdue">
              {g}
            </span>
          ))}
        </div>
      ) : null}
      {p.abruf_ok_at ? (
        <p className="text-ink-3 mt-1 text-[12px]">Zuletzt abgerufen {fmtDatumZeit(p.abruf_ok_at)}</p>
      ) : null}
    </li>
  )
}

// ---------------------------------------------------------------- Platzierungstests
function Tests() {
  const { data: tests } = usePlatzierungsTests()
  if (!tests?.length) return null
  return (
    <ul className="mb-3 grid gap-2">
      {tests.map((t) => {
        const geprueft = (t.posteingang ?? 0) + (t.spam ?? 0) + (t.fehlt ?? 0)
        return (
          <li key={t.test} className="bg-sidebar text-small rounded-sm px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-ink-bright">{t.betreff}</span>
              <span className="text-ink-3">{t.gestartet_at ? fmtDatumZeit(t.gestartet_at) : ''}</span>
              {(t.offen ?? 0) > 0 ? <Chip ton="blau">läuft · {t.offen} offen</Chip> : null}
              {geprueft ? (
                <Chip ton={(t.posteingang ?? 0) / geprueft >= 0.8 ? 'done' : 'overdue'}>
                  {t.posteingang}/{geprueft} im Posteingang
                </Chip>
              ) : null}
            </div>
            <div className="text-ink-2 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
              {((t.details as { saat: string; ordner: string | null; status: string }[] | null) ?? []).map((d) => (
                <span key={d.saat}>
                  {d.saat}:{' '}
                  {d.ordner === 'posteingang'
                    ? 'Posteingang'
                    : d.ordner === 'spam'
                      ? 'Spam'
                      : d.ordner === 'fehlt'
                        ? 'nicht angekommen'
                        : d.status === 'fehler'
                          ? 'Fehler'
                          : '…'}
                </span>
              ))}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function TestDialog({ versand, onClose }: { versand: Postfach[]; onClose: () => void }) {
  const starten = usePlatzierungStarten()
  const bereit = versand.filter((p) => p.status === 'bereit')
  const [postfach, setPostfach] = useState(bereit[0]?.id ?? '')
  const [betreff, setBetreff] = useState('')
  const [text, setText] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  return (
    <Dialog
      offen
      onOpenChange={(o) => !o && onClose()}
      titel="Platzierungstest starten"
      text="Am besten den echten Text der nächsten Kampagne einfügen (mit ausgefüllten Platzhaltern). Ergebnis nach wenigen Minuten hier auf der Seite."
      primaer={{
        label: 'Test senden',
        busy: starten.isPending,
        onClick: () =>
          starten.mutate(
            { postfach, betreff, text },
            {
              onSuccess: () => (toast('Test läuft – Ergebnis in wenigen Minuten'), onClose()),
              onError: (e) => setFehler((e as Error).message),
            },
          ),
      }}
      kinder={
        <div className="grid gap-3">
          <FormField label="Von" htmlFor="t-von">
            <Select
              id="t-von"
              value={postfach}
              onChange={(e) => setPostfach(e.target.value)}
              optionen={bereit.map((p) => ({ value: p.id as string, label: p.adresse as string }))}
            />
          </FormField>
          <FormField label="Betreff" htmlFor="t-betreff">
            <Input id="t-betreff" value={betreff} onChange={(e) => setBetreff(e.target.value)} />
          </FormField>
          <FormField label="Text" htmlFor="t-text">
            <Textarea id="t-text" rows={8} value={text} onChange={(e) => setText(e.target.value)} />
          </FormField>
          {fehler ? <p className="text-small text-danger">{fehler}</p> : null}
        </div>
      }
    />
  )
}

// ---------------------------------------------------------------- Sperr-Domains
function SperrDomains() {
  const { data } = useSperrdomains()
  const setzen = useSperrdomainSetzen()
  const [d, setD] = useState('')
  const wert = d.trim().toLowerCase().replace(/^.*@/, '')
  return (
    <Abschnitt
      titel="Nie anschreiben"
      satz="Domains von Kunden, Partnern und Wettbewerbern – Kampagnen überspringen alle Adressen dieser Domains. Einzelne Adressen stehen in Einstellungen → Sperrliste."
    >
      <form
        className="mb-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (DOMAIN_RE.test(wert)) setzen.mutate({ domain: wert }, { onSuccess: () => setD('') })
        }}
      >
        <Input
          aria-label="Domain sperren"
          placeholder="kunde.de"
          value={d}
          onChange={(e) => setD(e.target.value)}
          className="w-[220px]"
        />
        <Button type="submit" variante="secondary" disabled={!DOMAIN_RE.test(wert)}>
          Sperren
        </Button>
      </form>
      <div className="flex flex-wrap gap-1.5">
        {(data ?? []).map((s) => (
          <Chip key={s.domain} ton="grau" onRemove={() => setzen.mutate({ domain: s.domain, weg: true })}>
            {s.domain}
          </Chip>
        ))}
      </div>
    </Abschnitt>
  )
}

function TestmailDialog({ postfachId, onClose }: { postfachId: string; onClose: () => void }) {
  const me = useMe()
  const testmail = useTestmail()
  const [an, setAn] = useState(me?.email ?? '')
  return (
    <Dialog
      offen
      onOpenChange={(o) => !o && onClose()}
      titel="Testmail senden"
      text="Am besten an dein eigenes Postfach. In Gmail unter ⋮ → „Original anzeigen“ sollte bei SPF, DKIM und DMARC „PASS“ stehen."
      primaer={{
        label: 'Senden',
        busy: testmail.isPending,
        disabled: !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(an.trim()),
        onClick: () =>
          testmail.mutate(
            { postfachId, an: an.trim() },
            {
              onSuccess: (r) => (
                toast(r.ok ? `Testmail an ${an.trim()} gesendet` : `Fehlgeschlagen: ${r.fehler ?? ''}`),
                onClose()
              ),
            },
          ),
      }}
      kinder={
        <FormField label="An" htmlFor="tm-an">
          <Input id="tm-an" type="email" value={an} onChange={(e) => setAn(e.target.value)} />
        </FormField>
      }
    />
  )
}
