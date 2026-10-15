// BAUPLAN § 3.7 – Detail eines Leitfadens (rechte Spalte der Übersicht und Vollseite /leitfaeden/:id): Name text-h2,
// Felder-Raster (Kanal, Phase, Wann verwenden?, Anredeform, Notizen/Tests, Variante von), Editor, Vorschau, Statistik,
// Aktionen (Duplizieren · Deaktivieren/Aktivieren · Als Standard für Schritt … · Löschen nur wenn ungenutzt).
// Entwurf liegt in localStorage `crm.leitfaden.entwurf.<id>`; Versionen sind v1.1 (LF-05) – der Editor speichert direkt.
import { Copy, MoreHorizontal, Trash2 } from 'lucide-react'
import { useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { PFADE } from '@/app/pfade'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Dialog } from '@/components/ui/Dialog'
import { DropdownMenu, type MenuEintrag } from '@/components/ui/DropdownMenu'
import { EmptyState } from '@/components/ui/EmptyState'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { Textarea } from '@/components/ui/Textarea'
import { cn } from '@/components/ui/cn'
import { useSequences } from '@/data/sequences'
import { useTemplateLoeschen, useTemplatePerformance, useTemplates, useTemplateSave } from '@/data/templates'
import { useHotkeys } from '@/lib/keyboard'
import { ALLGEMEIN, KANAL_LABEL } from '@/texte/de'
import type { Channel, SequenceMitSchritten, Template, TemplatePerformance, TemplatePhase } from '@/types/domain'
import { NEU } from './befehle'
import { Editor } from './Editor'
import {
  entwurfLeer,
  entwurfVon,
  istGleich,
  kopieVon,
  liesEntwurf,
  schreibeEntwurf,
  zeileAusEntwurf,
  type Entwurf,
} from './entwurf'
import { kopieKey, neuerKey, schrittVerwendungen } from './helfer'
import { KANAELE, phaseDef, phasenFuer } from './phasen'
import { Statistik } from './Statistik'
import { Vorschau } from './Vorschau'

export type LeitfadenDetailProps = {
  /** Vorlagen-ID oder `neu` */
  id: string
  /** Kanal für neue Vorlagen (`?kanal=`) */
  kanalNeu?: Channel
  vorschauLeadId?: string | null
  onVorschauLead?: (leadId: string | null) => void
  /** Nur lesen (Mobil, E28): Text + Kopieren, Editor ausgeblendet */
  nurLesen?: boolean
  /** Nach dem ersten Speichern einer neuen Vorlage */
  onAngelegt?: (id: string) => void
}

/** Lädt Vorlagen, Nutzung und Sequenzen; rendert das Formular erst, wenn die Vorlage da ist (Entwurf wird einmal initialisiert). */
export function LeitfadenDetail({ id, kanalNeu = 'linkedin', ...rest }: LeitfadenDetailProps) {
  const navigate = useNavigate()
  const neu = id === NEU
  const { data: alle, isPending, isError } = useTemplates()
  const { data: perf } = useTemplatePerformance()
  const { data: sequenzen } = useSequences()
  const vorlage = useMemo(() => (neu ? null : (alle?.find((t) => t.id === id) ?? null)), [alle, id, neu])

  if (!neu && isPending) return <Skeleton zeilen={6} />
  if (!neu && isError) return <EmptyState titel="Leitfaden konnte nicht geladen werden." />
  if (!neu && !vorlage)
    return (
      <EmptyState
        titel="Leitfaden nicht gefunden."
        satz="Vielleicht wurde er gelöscht."
        primaer={{ label: 'Zu den Leitfäden', onClick: () => navigate(PFADE.leitfaeden) }}
      />
    )
  return (
    <Formular
      key={id}
      id={id}
      vorlage={vorlage}
      kanalNeu={kanalNeu}
      alle={alle ?? []}
      perfZeile={perf?.find((p) => p.template_id === id) ?? null}
      sequenzen={sequenzen ?? []}
      {...rest}
    />
  )
}

type FormularProps = Omit<LeitfadenDetailProps, 'id' | 'kanalNeu'> & {
  id: string
  kanalNeu: Channel
  vorlage: Template | null
  alle: Template[]
  perfZeile: TemplatePerformance | null
  sequenzen: SequenceMitSchritten[]
}

function Formular({
  id,
  vorlage,
  kanalNeu,
  alle,
  perfZeile,
  sequenzen,
  vorschauLeadId,
  onVorschauLead,
  nurLesen,
  onAngelegt,
}: FormularProps) {
  const uid = useId()
  const navigate = useNavigate()
  const neu = vorlage === null
  const kanal: Channel = vorlage?.channel ?? kanalNeu
  const speichern = useTemplateSave()
  const loeschen = useTemplateLoeschen()
  const [entwurf, setEntwurf] = useState<Entwurf>(
    () => liesEntwurf(id) ?? (vorlage ? entwurfVon(vorlage) : entwurfLeer(kanalNeu)),
  )
  const [fehler, setFehler] = useState<Partial<Record<'name' | 'body', string>>>({})
  const [loeschDialog, setLoeschDialog] = useState(false)
  const textarea = useRef<HTMLTextAreaElement | null>(null)

  const basis = vorlage ? entwurfVon(vorlage) : entwurfLeer(kanalNeu)
  const geaendert = !istGleich(entwurf, basis)
  const verwendungen = useMemo(() => schrittVerwendungen(id, sequenzen), [sequenzen, id])
  const verwendet = (perfZeile?.gesendet ?? 0) > 0 || verwendungen.length > 0
  const keys = useMemo(() => alle.map((t) => t.key), [alle])
  const original = vorlage?.variant_of ? (alle.find((t) => t.id === vorlage.variant_of) ?? null) : null

  const aendern = (patch: Partial<Entwurf>) => {
    setEntwurf((e) => {
      const n = { ...e, ...patch }
      schreibeEntwurf(id, istGleich(n, basis) ? null : n)
      return n
    })
    setFehler({})
  }

  const sichern = async () => {
    const f: typeof fehler = {}
    if (!entwurf.name.trim()) f.name = 'Name fehlt.'
    if (!entwurf.body.trim()) f.body = 'Text fehlt.'
    setFehler(f)
    if (Object.keys(f).length) return
    const key = vorlage?.key ?? neuerKey(kanal, entwurf.name, keys)
    const gespeichert = await speichern.mutateAsync(zeileAusEntwurf(vorlage, entwurf, kanal, key))
    schreibeEntwurf(id, null)
    toast('Gespeichert.')
    if (neu) onAngelegt?.(gespeichert.id)
  }

  const duplizieren = async () => {
    if (!vorlage) return
    const kopie = await speichern.mutateAsync(kopieVon(vorlage, kopieKey(vorlage.key, keys)))
    toast(`Kopie angelegt – ‚${kopie.name}‘.`)
    navigate(PFADE.leitfaden(kopie.id))
  }

  const aktivSchalten = async () => {
    if (!vorlage) return
    await speichern.mutateAsync({ ...vorlage, active: !vorlage.active })
    toast(vorlage.active ? 'Deaktiviert – bleibt in der Historie, verschwindet aus den Auswahlmenüs.' : 'Aktiviert.')
  }

  const endgueltigLoeschen = async () => {
    if (!vorlage || verwendet) return
    await loeschen.mutateAsync(vorlage.id)
    schreibeEntwurf(id, null)
    setLoeschDialog(false)
    toast('Gelöscht.')
    navigate(`${PFADE.leitfaeden}?kanal=${vorlage.channel}`)
  }

  useHotkeys('karte', nurLesen ? {} : { e: () => textarea.current?.focus() }, [nurLesen])

  const phasen = phasenFuer(kanal)
  const sequenzenKanal = sequenzen.filter((s) => s.channel === kanal)
  const standardEintraege: (MenuEintrag | 'trenner')[] = sequenzenKanal.length
    ? sequenzenKanal.map((s) => ({
        label: `${s.name}${s.active ? '' : ' (inaktiv)'}`,
        onSelect: () => navigate(`${PFADE.einstellungen('sequenzen')}?id=${s.id}`),
      }))
    : [
        {
          label: 'Keine Sequenz für diesen Kanal',
          onSelect: () => navigate(PFADE.einstellungen('sequenzen')),
          disabled: true,
        },
      ]

  const menue: (MenuEintrag | 'trenner')[] = vorlage
    ? [
        { label: 'Duplizieren', icon: Copy, onSelect: () => void duplizieren() },
        { label: vorlage.active ? 'Deaktivieren' : 'Aktivieren', onSelect: () => void aktivSchalten() },
        'trenner',
        {
          label: verwendet ? 'Löschen – verwendet, nur deaktivieren' : 'Löschen …',
          icon: Trash2,
          danger: !verwendet,
          disabled: verwendet,
          onSelect: () => setLoeschDialog(true),
        },
      ]
    : []

  return (
    <article aria-labelledby={`${uid}-name`} className="grid content-start gap-6" data-leitfaden={id}>
      <header className="grid gap-2.5">
        <div className="flex flex-wrap items-start gap-2.5">
          <div className="min-w-0 flex-1">
            {nurLesen ? (
              <h2 id={`${uid}-name`} className="text-h2 text-ink-bright">
                {entwurf.name || 'Ohne Namen'}
              </h2>
            ) : (
              <>
                <label htmlFor={`${uid}-name`} className="sr-only">
                  Name
                </label>
                <input
                  id={`${uid}-name`}
                  value={entwurf.name}
                  onChange={(e) => aendern({ name: e.target.value })}
                  placeholder="Name des Leitfadens"
                  aria-invalid={fehler.name ? true : undefined}
                  className={cn(
                    'text-h2 text-ink-bright placeholder:text-ink-4 w-full border-b bg-transparent pb-1 outline-none',
                    'ease-brand focus:border-signal transition-[border-color] duration-[var(--t-1)]',
                    fehler.name ? 'border-danger' : 'hover:border-line-strong border-transparent',
                  )}
                />
                {fehler.name ? (
                  <p className="text-small text-danger mt-1" role="alert">
                    {fehler.name}
                  </p>
                ) : null}
              </>
            )}
          </div>
          {vorlage && !vorlage.active ? <Chip ton="ended">inaktiv</Chip> : null}
          {verwendungen.map((v) => (
            <Chip key={v.stepId} ton="muted" title={`${v.sequenzName} · Schritt ${v.position}`}>
              Standard für Schritt {v.position}
            </Chip>
          ))}
          {vorlage && !nurLesen ? (
            <DropdownMenu
              trigger={
                <Button variante="icon" aria-label="Weitere Aktionen">
                  <MoreHorizontal size={16} strokeWidth={1.75} aria-hidden />
                </Button>
              }
              eintraege={menue}
              titel="Leitfaden"
            />
          ) : null}
        </div>
        {geaendert && !nurLesen ? <p className="text-small text-ink-3">Entwurf – noch nicht gespeichert.</p> : null}
      </header>

      {nurLesen ? (
        <dl className="grid grid-cols-2 gap-x-5 gap-y-3.5">
          <Feld label="Kanal">{KANAL_LABEL[kanal]}</Feld>
          <Feld label="Phase">{phaseDef(kanal, entwurf.phase).label}</Feld>
          <Feld label="Wann verwenden?">{entwurf.when_to_use || '–'}</Feld>
          <Feld label="Anredeform">
            {entwurf.form_of_address === 'sie' ? 'Sie' : entwurf.form_of_address === 'du' ? 'du' : '–'}
          </Feld>
          {entwurf.notes ? (
            <Feld label="Notizen / Tests" breit>
              {entwurf.notes}
            </Feld>
          ) : null}
          <p className="text-small text-ink-3 col-span-2">Am Desktop bearbeiten.</p>
        </dl>
      ) : (
        <div className="grid grid-cols-2 gap-x-5 gap-y-3.5 max-sm:grid-cols-1">
          <FormField label="Kanal" htmlFor={`${uid}-kanal`}>
            {neu ? (
              <Select
                id={`${uid}-kanal`}
                value={kanal}
                onChange={(e) => {
                  const k = e.target.value as Channel
                  schreibeEntwurf(id, null)
                  navigate(PFADE.leitfadenNeu(k), { replace: true })
                }}
                optionen={KANAELE.map((k) => ({ value: k, label: KANAL_LABEL[k] }))}
              />
            ) : (
              <p id={`${uid}-kanal`} className="text-ui text-ink h-9 leading-9">
                {KANAL_LABEL[kanal]}
              </p>
            )}
          </FormField>
          <FormField label="Phase" htmlFor={`${uid}-phase`}>
            <Select
              id={`${uid}-phase`}
              value={entwurf.phase}
              onChange={(e) => aendern({ phase: e.target.value as TemplatePhase })}
              optionen={phasen.map((p) => ({ value: p.key, label: p.label }))}
            />
          </FormField>
          <FormField
            label="Wann verwenden?"
            htmlFor={`${uid}-wann`}
            hinweis={phaseDef(kanal, entwurf.phase).beschreibung}
          >
            <Input
              id={`${uid}-wann`}
              value={entwurf.when_to_use}
              onChange={(e) => aendern({ when_to_use: e.target.value })}
              placeholder="Situation, in der dieser Text passt"
            />
          </FormField>
          <FormField label="Anredeform" htmlFor={`${uid}-anrede`}>
            <Select
              id={`${uid}-anrede`}
              value={entwurf.form_of_address}
              onChange={(e) => aendern({ form_of_address: e.target.value as Entwurf['form_of_address'] })}
              optionen={[
                { value: '', label: '–' },
                { value: 'sie', label: 'Sie' },
                { value: 'du', label: 'du' },
              ]}
            />
          </FormField>
          <FormField label="Notizen / Tests" htmlFor={`${uid}-notizen`} className="col-span-2 max-sm:col-span-1">
            <Textarea
              id={`${uid}-notizen`}
              value={entwurf.notes}
              onChange={(e) => aendern({ notes: e.target.value })}
              onSubmit={() => void sichern()}
              placeholder="Was wurde getestet, was funktioniert"
              className="min-h-16"
            />
          </FormField>
          <FormField label="Variante von">
            {original ? (
              <a
                href={PFADE.leitfaden(original.id)}
                className="text-ui text-ink h-9 leading-9 underline-offset-4 hover:underline"
              >
                {original.name}
              </a>
            ) : (
              <p className="text-ui text-ink-3 h-9 leading-9">–</p>
            )}
          </FormField>
        </div>
      )}

      {nurLesen ? null : (
        <>
          <Editor
            kanal={kanal}
            wert={{ subject: entwurf.subject, body: entwurf.body }}
            onChange={(w) => aendern({ subject: w.subject, body: w.body })}
            onSpeichern={() => void sichern()}
            textareaRef={textarea}
          />
          {fehler.body ? (
            <p className="text-small text-danger -mt-4" role="alert">
              {fehler.body}
            </p>
          ) : null}
          <div className="flex items-center gap-1.5">
            <Button
              variante="primary"
              kbd="⌘↵"
              onClick={() => void sichern()}
              busy={speichern.isPending}
              disabled={!neu && !geaendert}
              disabledGrund={!neu && !geaendert ? ALLGEMEIN.nichtsGeaendert : undefined}
            >
              {neu ? 'Leitfaden anlegen' : ALLGEMEIN.speichern}
            </Button>
            {geaendert && vorlage ? (
              <Button
                variante="quiet"
                onClick={() => {
                  schreibeEntwurf(id, null)
                  setEntwurf(entwurfVon(vorlage))
                }}
              >
                Verwerfen
              </Button>
            ) : null}
          </div>
        </>
      )}

      <Vorschau
        kanal={kanal}
        subject={entwurf.subject}
        body={entwurf.body}
        leadId={vorschauLeadId}
        onLeadChange={onVorschauLead}
      />

      {vorlage ? <Statistik templateId={vorlage.id} perf={perfZeile} /> : null}

      {vorlage && !nurLesen ? (
        <section aria-label="Aktionen" className="border-line flex flex-wrap items-center gap-1.5 border-t pt-4">
          <Button
            variante="secondary"
            groesse="S"
            icon={Copy}
            onClick={() => void duplizieren()}
            busy={speichern.isPending}
          >
            Duplizieren
          </Button>
          <Button variante="secondary" groesse="S" onClick={() => void aktivSchalten()} busy={speichern.isPending}>
            {vorlage.active ? 'Deaktivieren' : 'Aktivieren'}
          </Button>
          <DropdownMenu
            trigger={
              <Button variante="secondary" groesse="S">
                Als Standard für Schritt …
              </Button>
            }
            eintraege={standardEintraege}
            titel="Sequenz-Editor öffnen"
            align="start"
          />
          <span className="ml-auto">
            <Button
              variante="danger"
              groesse="S"
              icon={Trash2}
              disabled={verwendet}
              disabledGrund={verwendet ? 'Verwendet – stattdessen deaktivieren' : undefined}
              onClick={() => setLoeschDialog(true)}
            >
              Löschen
            </Button>
          </span>
        </section>
      ) : null}

      <Dialog
        offen={loeschDialog}
        onOpenChange={setLoeschDialog}
        titel="Leitfaden löschen?"
        text="Unwiderruflich. Ein verwendeter Leitfaden lässt sich nur deaktivieren."
        primaer={{
          label: 'Löschen',
          danger: true,
          onClick: () => void endgueltigLoeschen(),
          busy: loeschen.isPending,
        }}
      />
    </article>
  )
}

function Feld({ label, children, breit }: { label: string; children: ReactNode; breit?: boolean }) {
  return (
    <div className={cn('grid min-w-0 gap-1', breit && 'col-span-2')}>
      <dt className="label">{label}</dt>
      <dd className="text-ui text-ink font-normal whitespace-pre-wrap">{children}</dd>
    </div>
  )
}
