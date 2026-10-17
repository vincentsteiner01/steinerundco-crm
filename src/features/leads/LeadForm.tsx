// BAUPLAN § 3.3 `LeadForm.tsx` (ux § 3.2.5, § 4.6, § 4.9, LE-11): Felder in Reihenfolge, Live-Dublette (useDubletteCheck, 300 ms),
// E.164-Formatierung, Rolle-Erkennung aus Freitext, ⌘Enter speichert + Peek, ⌘⇧Enter speichert + nächster.
// Exakte URL-Dublette blockiert das Anlegen (Unique-Index); Telefon/E-Mail-Treffer sind nur eine Warnung.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { PFADE } from '@/app/pfade'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { firmaFuerName, firmaInListe, useCompanies } from '@/data/companies'
import { mutationFehler } from '@/data/errors'
import { useDubletteCheck, useLeadErstellen, type LeadTreffer } from '@/data/leads'
import { useMeId, useMembers } from '@/data/members'
import { useSettings } from '@/data/settings'
import { useLeadTagSetzen, useTags } from '@/data/tags'
import { fmtDatumKurz } from '@/lib/format'
import { useHotkeyScope } from '@/lib/keyboard'
import { phaseVon, stageLabel, STUFEN } from '@/lib/stufen'
import { landVon, nachE164, STANDARD_LAND, telefonTyp, type Land } from '@/lib/telefon'
import { LandWahl } from './kanal/Nummern'
import { istFirmenseite, istSalesNav, normalizeLinkedinUrl } from '@/lib/url'
import { ALLGEMEIN, GRUND_LABEL, PHASE_LABEL } from '@/texte/de'
import type { LeadInsert, LeadRole, LeadStage, PhoneSource, Salutation } from '@/types/domain'
import { rolleAusFreitext } from './detailLogik'
import { jetztIso } from './hilfen'
import { ANREDE_OPTIONEN, ROLLE_OPTIONEN } from './spalten'
import { anzeigeName } from '@/lib/mitglied'

export type LeadFormProps = {
  vorbelegung?: Partial<LeadInsert>
  onGespeichert: (id: string, weiter: boolean) => void
  onAbbrechen: () => void
}

const QUELLEN: { value: PhoneSource; label: string }[] = [
  { value: 'website_kontakt', label: 'Website-Kontakt' },
  { value: 'google_profil', label: 'Google-Profil' },
  { value: 'branchenverzeichnis', label: 'Branchenverzeichnis' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'visitenkarte', label: 'Visitenkarte' },
  { value: 'mitgeteilt', label: 'mitgeteilt' },
  { value: 'impressum', label: 'Impressum' },
  { value: 'unbekannt', label: 'unbekannt' },
]

export function LeadForm({ vorbelegung, onGespeichert, onAbbrechen }: LeadFormProps) {
  useHotkeyScope('formular')
  const navigate = useNavigate()
  const me = useMeId()
  const { data: members } = useMembers()
  const { data: settings } = useSettings()
  const { data: tags } = useTags()
  const { data: firmen } = useCompanies()
  const erstellen = useLeadErstellen()
  const [firmaSuche, setFirmaSuche] = useState(false)
  const tagSetzen = useLeadTagSetzen()
  const [vorname, setVorname] = useState(vorbelegung?.first_name ?? '')
  const [nachname, setNachname] = useState(vorbelegung?.last_name ?? '')
  const [anrede, setAnrede] = useState<Salutation>(vorbelegung?.salutation ?? 'neutral')
  const [unternehmen, setUnternehmen] = useState(vorbelegung?.company_name ?? '')
  const [rolleText, setRolleText] = useState(vorbelegung?.role_title ?? '')
  const [rolle, setRolle] = useState<LeadRole>(vorbelegung?.role ?? rolleAusFreitext(vorbelegung?.role_title))
  const [rolleManuell, setRolleManuell] = useState(!!vorbelegung?.role)
  const [ort, setOrt] = useState(vorbelegung?.city ?? '')
  const [url, setUrl] = useState(vorbelegung?.linkedin_url ?? '')
  const [telefon, setTelefon] = useState(vorbelegung?.phone_e164 ?? '')
  const [land, setLand] = useState<Land>(landVon(vorbelegung?.phone_e164) ?? STANDARD_LAND)
  const [telefonQuelle, setTelefonQuelle] = useState<PhoneSource>(vorbelegung?.phone_source ?? 'unbekannt')
  const [email, setEmail] = useState(vorbelegung?.email ?? '')
  const [zustaendig, setZustaendig] = useState<string>(vorbelegung?.owner_id ?? '')
  const [stufe, setStufe] = useState<LeadStage | ''>(vorbelegung?.stage ?? '')
  const [tagIds, setTagIds] = useState<Set<string>>(new Set())
  const [notiz, setNotiz] = useState(vorbelegung?.notes ?? '')
  const [versuch, setVersuch] = useState(false)
  const vornameRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    vornameRef.current?.focus()
  }, [])

  const urlNorm = useMemo(() => normalizeLinkedinUrl(url), [url])
  const e164 = useMemo(() => nachE164(telefon, land), [telefon, land])
  const emailNorm = email.trim().toLowerCase()
  const { data: dubletten } = useDubletteCheck(urlNorm ?? undefined, e164 ?? undefined, emailNorm || undefined)

  const urlDublette: LeadTreffer | undefined = urlNorm
    ? dubletten?.find((d) => d.linkedin_url && normalizeLinkedinUrl(d.linkedin_url) === urlNorm)
    : undefined
  const sonstigeDublette = dubletten?.find((d) => d !== urlDublette)
  const owner = zustaendig || me || ''
  const stufeEffektiv: LeadStage = stufe || (urlNorm ? 'vernetzt' : 'neu')
  const urlArtHinweis = url.trim()
    ? istFirmenseite(url)
      ? 'Das ist eine Firmenseite'
      : istSalesNav(url)
        ? 'Sales-Navigator-Link – wird als Sales-Nav-URL gespeichert'
        : !urlNorm
          ? 'Keine Profil-URL (linkedin.com/in/…)'
          : null
    : null
  const telefonHinweis = telefon.trim() && !e164 ? ALLGEMEIN.nummerUnvollstaendig : null
  const emailHinweis =
    emailNorm && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)
      ? 'Keine gültige Adresse'
      : /^(info|kontakt|office|mail|hallo|hello)@/.test(emailNorm)
        ? 'Sammeladresse – Erlaubnis muss von der Person kommen'
        : null

  const fehler = {
    vorname: versuch && !vorname.trim() ? 'Pflichtfeld' : undefined,
    nachname: versuch && !nachname.trim() ? 'Pflichtfeld' : undefined,
  }
  const blockiert = !!urlDublette || istFirmenseite(url)
  // Firmensperre (§ 1.5 Nr. 27) wirkt über `company_id` – schon im Formular zeigen, wenn der Name eine gesperrte Firma trifft
  const firmaTreffer = firmaInListe(firmen, unternehmen)

  const speichern = async (weiter: boolean) => {
    setVersuch(true)
    if (!vorname.trim() || !nachname.trim()) {
      ;(!vorname.trim() ? vornameRef.current : null)?.focus()
      return
    }
    if (blockiert || erstellen.isPending || firmaSuche) return
    const vn = vorname.trim()
    const nn = nachname.trim()
    // Firma verknüpfen (finden oder anlegen): ohne `company_id` griff die Firmensperre bei Hand-Leads nie (Review)
    let firma: { id: string; name: string } | null = null
    if (unternehmen.trim()) {
      setFirmaSuche(true)
      try {
        firma = await firmaFuerName(unternehmen)
      } catch (e) {
        mutationFehler(e)
        return
      } finally {
        setFirmaSuche(false)
      }
    }
    // `full_name` und `linkedin_url_norm` sind generierte Spalten – die DB berechnet sie, ein Wert im Insert wird abgelehnt (Review)
    const insert: LeadInsert = {
      first_name: vn,
      last_name: nn,
      salutation: anrede,
      company_id: firma?.id ?? null,
      company_name: firma?.name ?? (unternehmen.trim() || null),
      role: rolle,
      role_title: rolleText.trim() || null,
      city: ort.trim() || null,
      linkedin_url: urlNorm ? url.trim() : null,
      sales_nav_url: istSalesNav(url) ? url.trim() : null,
      phone_e164: e164,
      phone_type: e164 ? telefonTyp(e164) : 'unbekannt',
      phone_source: telefonQuelle,
      phone_collected_at: e164 ? jetztIso() : null,
      email: emailNorm || null,
      owner_id: owner || null,
      stage: stufeEffektiv,
      notes: notiz.trim() || null,
      source: 'app',
      created_by: me,
    }
    let id: string
    try {
      const l = await erstellen.mutateAsync(insert)
      id = l.id
    } catch {
      return
    }
    for (const t of tagIds) tagSetzen.mutate({ leadId: id, tagId: t })
    onGespeichert(id, weiter)
  }

  const tasten = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      void speichern(e.shiftKey)
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      onAbbrechen()
    }
  }

  const dublettenText = (d: LeadTreffer) => {
    const phase = PHASE_LABEL[phaseVon(d.stage).key]
    const m = members?.find((x) => x.id === d.owner_id)
    const wer = anzeigeName(m, 'Frei')
    return `${d.full_name ?? '–'} · ${phase} · ${wer}`
  }

  return (
    <form
      className="grid grid-cols-[minmax(0,1fr)] gap-4"
      onKeyDown={tasten}
      onSubmit={(e) => {
        e.preventDefault()
        void speichern(false)
      }}
      aria-label="Lead anlegen"
    >
      <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 max-md:grid-cols-1">
        <FormField label="Vorname" pflicht htmlFor="lf-vorname" fehler={fehler.vorname}>
          <Input
            id="lf-vorname"
            ref={vornameRef}
            value={vorname}
            onChange={(e) => setVorname(e.target.value)}
            autoComplete="off"
          />
        </FormField>
        <FormField label="Nachname" pflicht htmlFor="lf-nachname" fehler={fehler.nachname}>
          <Input id="lf-nachname" value={nachname} onChange={(e) => setNachname(e.target.value)} autoComplete="off" />
        </FormField>
      </div>
      <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 max-md:grid-cols-1">
        <FormField label="Anrede" htmlFor="lf-anrede">
          <Select
            id="lf-anrede"
            value={anrede}
            onChange={(e) => setAnrede(e.target.value as Salutation)}
            optionen={ANREDE_OPTIONEN}
          />
        </FormField>
        <FormField label="Unternehmen" htmlFor="lf-unternehmen">
          <Input id="lf-unternehmen" value={unternehmen} onChange={(e) => setUnternehmen(e.target.value)} />
          {firmaTreffer?.do_not_contact ? (
            <span className="flex flex-wrap items-center gap-2" role="status" data-firma-gesperrt>
              <Chip ton="danger">Firma gesperrt</Chip>
              <span className="text-small text-ink-3">Nicht anschreiben – Kontaktaktionen bleiben gesperrt.</span>
            </span>
          ) : null}
        </FormField>
      </div>
      <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 max-md:grid-cols-1">
        <FormField
          label="Rolle (Freitext)"
          htmlFor="lf-rolle-text"
          hinweis={
            !rolleManuell && rolleText
              ? `erkannt: ${ROLLE_OPTIONEN.find((o) => o.value === rolle)?.label ?? ''}`
              : undefined
          }
        >
          <Input
            id="lf-rolle-text"
            value={rolleText}
            placeholder="Geschäftsführer, Key Account …"
            onChange={(e) => {
              setRolleText(e.target.value)
              if (!rolleManuell) setRolle(rolleAusFreitext(e.target.value))
            }}
          />
        </FormField>
        <FormField label="Rolle" htmlFor="lf-rolle">
          <Select
            id="lf-rolle"
            value={rolle}
            onChange={(e) => {
              setRolle(e.target.value as LeadRole)
              setRolleManuell(true)
            }}
            optionen={ROLLE_OPTIONEN}
          />
        </FormField>
      </div>
      <FormField label="Ort" htmlFor="lf-ort">
        <Input id="lf-ort" value={ort} onChange={(e) => setOrt(e.target.value)} />
      </FormField>
      <FormField
        label="LinkedIn-URL"
        htmlFor="lf-url"
        hinweis={urlArtHinweis ?? undefined}
        fehler={
          urlDublette ? undefined : istFirmenseite(url) ? 'Firmenseiten werden nicht als Lead angelegt' : undefined
        }
      >
        <Input
          id="lf-url"
          mono
          value={url}
          placeholder="linkedin.com/in/…"
          onChange={(e) => setUrl(e.target.value)}
          autoComplete="off"
        />
        {urlDublette ? (
          <p className="text-small text-danger flex flex-wrap items-center gap-2" role="alert" data-dublette="url">
            Bereits vorhanden: {dublettenText(urlDublette)}
            {urlDublette.deleted_at ? (
              <Chip ton="muted">im Papierkorb seit {fmtDatumKurz(urlDublette.deleted_at)}</Chip>
            ) : null}
            <Button variante="quiet" groesse="S" onClick={() => navigate(`${PFADE.leads}?lead=${urlDublette.id}`)}>
              öffnen
            </Button>
          </p>
        ) : null}
      </FormField>
      <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 max-md:grid-cols-1">
        <FormField
          label="Telefon"
          htmlFor="lf-telefon"
          hinweis={e164 ? `gespeichert als ${e164}` : (telefonHinweis ?? undefined)}
        >
          {/* Land gilt für Nummern ohne Ländervorwahl („0…“), Feedback ebfc59a0 */}
          <div className="flex min-w-0 gap-1.5">
            <LandWahl wert={land} onChange={setLand} className="h-9 w-[100px] font-mono text-[12.5px]" />
            <Input
              id="lf-telefon"
              mono
              value={telefon}
              placeholder="0… oder +…"
              onChange={(e) => setTelefon(e.target.value)}
              autoComplete="off"
              className="min-w-0"
            />
          </div>
        </FormField>
        <FormField label="Telefon-Quelle" htmlFor="lf-telefon-quelle">
          <Select
            id="lf-telefon-quelle"
            value={telefonQuelle}
            onChange={(e) => setTelefonQuelle(e.target.value as PhoneSource)}
            optionen={QUELLEN}
          />
        </FormField>
      </div>
      <FormField label="E-Mail" htmlFor="lf-email" hinweis={emailHinweis ?? undefined}>
        <Input id="lf-email" mono value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
      </FormField>
      {sonstigeDublette && !urlDublette ? (
        <p className="text-small text-overdue" role="status" data-dublette="warnung">
          Möglicherweise bereits vorhanden: {dublettenText(sonstigeDublette)} – Anlegen ist möglich.
        </p>
      ) : null}
      <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 max-md:grid-cols-1">
        <FormField label="Zuständig" htmlFor="lf-zustaendig">
          <Select
            id="lf-zustaendig"
            value={owner}
            onChange={(e) => setZustaendig(e.target.value)}
            optionen={(members ?? [])
              .filter((m) => !!m.id)
              .map((m) => ({
                value: m.id as string,
                label: m.id === me ? `${anzeigeName(m)} (ich)` : anzeigeName(m, ''),
              }))}
          />
        </FormField>
        <FormField
          label="Phase"
          htmlFor="lf-phase"
          hinweis={!stufe ? (urlNorm ? 'vorbelegt: Vernetzt' : 'vorbelegt: Neu ohne LinkedIn') : undefined}
        >
          <Select id="lf-phase" value={stufeEffektiv} onChange={(e) => setStufe(e.target.value as LeadStage)}>
            {STUFEN.filter((s) => s !== 'beendet').map((s) => (
              <option key={s} value={s}>
                {PHASE_LABEL[phaseVon(s).key]} · {stageLabel(s, settings)}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      {tags?.length ? (
        <div className="grid gap-1.5">
          <span className="label">Tags</span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tags">
            {tags.map((t) => (
              <Chip
                key={t.id}
                interaktiv
                ton={tagIds.has(t.id) ? 'neutral' : 'muted'}
                aria-pressed={tagIds.has(t.id)}
                onClick={() =>
                  setTagIds((s) => {
                    const n = new Set(s)
                    if (n.has(t.id)) n.delete(t.id)
                    else n.add(t.id)
                    return n
                  })
                }
              >
                {t.name}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}
      <FormField label="Notiz" htmlFor="lf-notiz">
        <Textarea id="lf-notiz" value={notiz} onChange={(e) => setNotiz(e.target.value)} />
      </FormField>
      <div className="border-line flex flex-wrap items-center justify-end gap-1.5 border-t pt-4">
        <Button variante="quiet" kbd="Esc" onClick={onAbbrechen}>
          Abbrechen
        </Button>
        <Button
          variante="secondary"
          kbd="⌘⇧↵"
          disabled={blockiert}
          disabledGrund={urlDublette ? `Gibt es schon – ${GRUND_LABEL.duplikat}` : undefined}
          busy={erstellen.isPending || firmaSuche}
          onClick={() => void speichern(true)}
        >
          Speichern und nächster
        </Button>
        <Button
          type="submit"
          variante="primary"
          kbd="⌘↵"
          disabled={blockiert}
          disabledGrund={urlDublette ? `Gibt es schon – ${GRUND_LABEL.duplikat}` : undefined}
          busy={erstellen.isPending || firmaSuche}
        >
          Lead anlegen
        </Button>
      </div>
    </form>
  )
}
