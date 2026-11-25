// Das Lead-Blatt (25.11.2026): Sheet von rechts, auf dem Telefon von unten. Die Hülle öffnet es über `?lead=<id>` auf jeder
// Seite – auch für Leads von vor dem Neustart, die auf keiner Liste liegen (dann ist bei „Liste“ nichts gewählt; eine Liste
// wählen und speichern legt die Karte aufs Board). Der E-Mail-Bereich hält Erlaubnis und Einzelmail erreichbar.
import { useId, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { toast } from '@/components/toast'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LadeFehler } from '@/components/ui/LadeFehler'
import { Sheet } from '@/components/ui/Sheet'
import { Skeleton } from '@/components/ui/Skeleton'
import { Textarea } from '@/components/ui/Textarea'
import { useLead, useMembers } from '@/data'
import { useKarteSpeichern } from '@/data/board'
import { verfassenUrl } from '@/features/email/links'
import { ErlaubnisBadge, ErlaubnisErfassen } from '@/features/email/public'
import { anzeigeName } from '@/lib/mitglied'
import type { LeadMitBezug, Member, Salutation } from '@/types/domain'
import { blattPatch, blattWerte, pruefeBlatt, type BlattWerte } from './blatt'
import { Feld, Wahl } from './Feld'
import { useKartenAktionen } from './kartenAktionen'
import { BOARD_LISTEN } from './listen'
import { kartenName, sortiereMitglieder } from './logik'

const ANREDEN: { key: Exclude<Salutation, 'neutral'>; label: string }[] = [
  { key: 'herr', label: 'Herr' },
  { key: 'frau', label: 'Frau' },
]
const LISTEN = BOARD_LISTEN.map((l) => ({ key: l.key, label: l.titel }))

export function LeadBlatt({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const { data: lead, isError, refetch } = useLead(leadId)
  return (
    <Sheet
      offen
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
      titel={lead ? kartenName(lead) : 'Lead'}
      breite={440}
    >
      {isError ? (
        <LadeFehler text="Der Lead konnte nicht geladen werden" onNochmal={() => void refetch()} />
      ) : !lead ? (
        <Skeleton zeilen={5} />
      ) : lead.deleted_at ? (
        <p className="text-body text-ink-2">Dieser Lead wurde gelöscht.</p>
      ) : (
        <Formular key={lead.id} lead={lead} onClose={onClose} />
      )}
    </Sheet>
  )
}

function Formular({ lead, onClose }: { lead: LeadMitBezug; onClose: () => void }) {
  const id = useId()
  const { pathname, search } = useLocation()
  const { data: alleMitglieder } = useMembers()
  const speichern = useKarteSpeichern()
  const { entferne } = useKartenAktionen()
  // Stand beim Öffnen: Vergleichsbasis für den Patch. Der E-Mail-Bereich liest dagegen immer den aktuellen Lead.
  const [basis] = useState<BlattWerte>(() => blattWerte(lead))
  const [w, setW] = useState<BlattWerte>(basis)
  const [versucht, setVersucht] = useState(false)
  const setze = <K extends keyof BlattWerte>(feld: K, wert: BlattWerte[K]) => setW((alt) => ({ ...alt, [feld]: wert }))
  const fehler = versucht ? pruefeBlatt(basis, w) : {}
  const members = sortiereMitglieder(alleMitglieder).filter((m): m is Member & { id: string } => !!m.id)

  const absenden = (e: FormEvent) => {
    e.preventDefault()
    setVersucht(true)
    if (speichern.isPending || Object.keys(pruefeBlatt(basis, w)).length > 0) return
    const patch = blattPatch(basis, w)
    if (Object.keys(patch).length === 0) return onClose()
    speichern.mutate(
      { id: lead.id, patch },
      {
        onSuccess: () => {
          toast('Gespeichert.')
          onClose()
        },
      },
    )
  }

  // Wo die Karte jetzt liegt (nicht der Stand beim Öffnen): dorthin legt „Rückgängig“ sie zurück
  const aktuelleListe = blattWerte(lead).board_liste
  const entfernen = () => {
    entferne({ id: lead.id, board_liste: aktuelleListe, board_seit: lead.board_seit })
    onClose()
  }

  return (
    <form onSubmit={absenden} noValidate className="flex min-h-full flex-col">
      <div className="grid gap-4 pb-6">
        <div className="grid grid-cols-2 gap-3">
          <Feld label="Vorname" htmlFor={`${id}-vorname`}>
            <Input
              id={`${id}-vorname`}
              groesse="L"
              autoComplete="off"
              value={w.first_name}
              onChange={(e) => setze('first_name', e.target.value)}
              aria-invalid={fehler.name ? true : undefined}
            />
          </Feld>
          <Feld label="Nachname" htmlFor={`${id}-nachname`}>
            <Input
              id={`${id}-nachname`}
              groesse="L"
              autoComplete="off"
              value={w.last_name}
              onChange={(e) => setze('last_name', e.target.value)}
              aria-invalid={fehler.name ? true : undefined}
            />
          </Feld>
          {fehler.name ? (
            <p className="text-small text-danger col-span-2" role="alert">
              {fehler.name}
            </p>
          ) : null}
        </div>
        <Feld label="Anrede">
          {/* Noch einmal auf die gewählte Anrede tippen nimmt sie zurück (neutral: „Guten Tag Vorname Nachname“) */}
          <Wahl
            ariaLabel="Anrede"
            optionen={ANREDEN}
            wert={w.salutation === 'neutral' ? null : w.salutation}
            onChange={(k) => setze('salutation', k === w.salutation ? 'neutral' : k)}
          />
        </Feld>
        <Feld label="Firma" htmlFor={`${id}-firma`}>
          {/* Mit verknüpftem Unternehmen (alte Leads) schreibt die Datenbank den Firmennamen selbst – das Feld zeigt ihn nur */}
          <Input
            id={`${id}-firma`}
            groesse="L"
            autoComplete="off"
            disabled={!!lead.company_id}
            className="disabled:text-ink-2"
            value={w.company_name}
            onChange={(e) => setze('company_name', e.target.value)}
          />
        </Feld>
        <Feld label="LinkedIn-Link" htmlFor={`${id}-link`}>
          <Input
            id={`${id}-link`}
            groesse="L"
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="linkedin.com/in/…"
            value={w.linkedin_url}
            onChange={(e) => setze('linkedin_url', e.target.value)}
            fehler={fehler.link}
          />
        </Feld>
        <Feld label="Zugehörigkeit">
          <Wahl
            ariaLabel="Zugehörigkeit"
            wert={w.owner_id}
            onChange={(k) => setze('owner_id', k)}
            optionen={members.map((m) => ({
              key: m.id,
              label: anzeigeName(m, m.id),
              icon: (
                <span aria-hidden className="inline-flex">
                  <Avatar member={m} groesse={22} />
                </span>
              ),
            }))}
          />
        </Feld>
        <Feld label="Liste">
          <Wahl
            raster
            ariaLabel="Liste"
            optionen={LISTEN}
            wert={w.board_liste}
            onChange={(k) => setze('board_liste', k)}
          />
        </Feld>
        <Feld label="Notiz" htmlFor={`${id}-notiz`}>
          <Textarea
            id={`${id}-notiz`}
            className="min-h-24 text-[15px]"
            value={w.notes}
            onChange={(e) => setze('notes', e.target.value)}
          />
        </Feld>
        <section aria-labelledby={`${id}-email`} className="border-line grid gap-2.5 border-t pt-4">
          <h3 id={`${id}-email`} className="text-small text-ink-2 font-medium">
            E-Mail
          </h3>
          <p className="text-body text-ink break-all">{lead.email ?? '–'}</p>
          <ErlaubnisBadge lead={lead} />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <ErlaubnisErfassen leadId={lead.id} trigger={<Button groesse="L">Erlaubnis erfassen</Button>} />
            <Link
              to={verfassenUrl({ leadId: lead.id, zurueck: `${pathname}${search}` })}
              className="text-signal inline-flex h-11 items-center rounded-xs text-[15px] font-medium hover:underline"
            >
              E-Mail schreiben
            </Link>
          </div>
        </section>
        {aktuelleListe ? (
          <div className="border-line border-t pt-3">
            <Button variante="quiet" groesse="L" className="-ml-4" onClick={entfernen}>
              Karte entfernen
            </Button>
          </div>
        ) : null}
      </div>
      {/* Fuß bleibt beim Scrollen stehen. Das Sheet hat innen 24/20 px Abstand (px-6 py-5): -mx-6 und -mb-5 heben ihn auf,
          -bottom-5 lässt den Fuß bis an die Unterkante reichen (sonst scheint darunter ein Streifen Inhalt durch). */}
      <div className="bg-surface-raised border-line sticky -bottom-5 -mx-6 mt-auto -mb-5 flex justify-end gap-2 border-t px-6 pt-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
        <Button groesse="L" variante="quiet" onClick={onClose}>
          Abbrechen
        </Button>
        <Button groesse="L" variante="primary" type="submit" busy={speichern.isPending}>
          Speichern
        </Button>
      </div>
    </form>
  )
}
