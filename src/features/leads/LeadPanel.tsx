// BAUPLAN § 3.3 `LeadPanel.tsx` – Peek-Inhalt (DESIGN-SYSTEM § 5.11): Kopf (Icon-Buttons, Name lead-name, Unternehmen · Rolle · Ort,
// Chips/Badges inkl. „Firma gesperrt“), NaechsterSchritt, FelderRaster, Kanal-Akkordeon (LinkedIn offen, Telefon/E-Mail zu), Timeline,
// NotizFeld, Fuß (Übergeben ⌘⇧U · Freigeben ⌘⇧F · Beenden B · Übernehmen Ü). Der Container (n von m, ←/→, Esc, Schließen) ist
// components/peek/PeekPanel (M0). Tasten im Scope karte: O · ⌘↵ · ⌘⇧K · ⌥M; Aktionen über ihre eigenen Tasten (aktiv).
import { ExternalLink, Mail, NotebookPen, Phone } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { PFADE } from '@/app/pfade'
import {
  AntwortErhalten,
  Beenden,
  Freigeben,
  NotizFeld,
  Spaeter,
  TerminEintragen,
  Uebergeben,
  Uebernehmen,
  Wiedervorlage,
} from '@/components/aktionen'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { useEmails } from '@/data/emails'
import { useLead, useLeadLoeschen, useLeadUpdate } from '@/data/leads'
import { useMeId, useMembers } from '@/data/members'
import { useQueue } from '@/data/queue'
import { useSettings } from '@/data/settings'
import { useSperrliste } from '@/data/sperrliste'
import { useTags } from '@/data/tags'
import { emailGate, nachfassZaehler, sperrlistenEintraege, telefonGate } from '@/lib/gates'
import { useHotkeys } from '@/lib/keyboard'
import { ERSTE_STAGE_DER_PHASE } from '@/lib/stufen'
import { linkedinHref } from '@/lib/url'
import { GATE_GRUND_LABEL } from '@/texte/de'
import { ROLLE_LABEL } from './spalten'
import type { LeadMitBezug, PhaseKey } from '@/types/domain'
import { useLeadAktionen, type LeadAktion } from './aktionsBus'
import { phasenAktion, queueItemFuer } from './detailLogik'
import { FelderRaster } from './FelderRaster'
import { EmailKarte } from './kanal/EmailKarte'
import { LinkedInKarte } from './kanal/LinkedInKarte'
import { TelefonKarte } from './kanal/TelefonKarte'
import { KopfAktionen, KopfChips } from './LeadKopf'
import { NaechsterSchritt } from './NaechsterSchritt'
import { Timeline } from './Timeline'

/**
 * Kopf-Aktionen für die Kopfzeile des Peek-Containers (`PeekPanel kopfRechts`, DESIGN-SYSTEM § 5.11, reference.html): neben
 * „n von m ← →“ und „Schließen Esc“ statt einer eigenen Zeile im Panel (Review: Kopf war ~40 px höher als der Mock).
 */
export function PeekKopfAktionen({ leadId }: { leadId: string }) {
  const { data: lead } = useLead(leadId)
  const { data: settings } = useSettings()
  const { data: sperrliste } = useSperrliste()
  if (!lead) return null
  return (
    <KopfAktionen lead={lead} sperrliste={sperrlistenEintraege(sperrliste, lead)} settings={settings} vollansicht />
  )
}

export function LeadPanel({ leadId }: { leadId: string }) {
  const { data: lead, isPending, error } = useLead(leadId)
  if (isPending)
    return (
      <div className="px-6 py-6">
        <Skeleton zeilen={6} />
      </div>
    )
  if (error || !lead) return <p className="text-small text-ink-3 px-6 py-6">Lead nicht (mehr) vorhanden.</p>
  return <PanelInhalt lead={lead} />
}

function PanelInhalt({ lead }: { lead: LeadMitBezug }) {
  const navigate = useNavigate()
  const me = useMeId()
  const { data: members } = useMembers()
  const { data: settings } = useSettings()
  const { data: tags } = useTags()
  const { data: sperrliste } = useSperrliste()
  const { data: emails } = useEmails(lead.id)
  const { data: queue } = useQueue(lead.owner_id ?? null)
  const update = useLeadUpdate()
  const loeschen = useLeadLoeschen()
  const item = queueItemFuer(queue, lead.id)
  const aktivesEnrollment = lead.enrollments?.find((e) => e.status === 'aktiv')
  const offeneAufgabe = lead.tasks?.find((t) => t.status === 'offen')
  // Kanalgenau: die Gates prüfen die Kanäle der Treffer (Integration: vorher sperrte jeder Treffer alle Kanäle)
  const treffer = sperrlistenEintraege(sperrliste, lead)
  const [akk, setAkk] = useState<Record<'linkedin' | 'telefon' | 'email', boolean>>({
    linkedin: true,
    telefon: false,
    email: false,
  })
  const [aktion, setAktion] = useState<LeadAktion | null>(null)
  const [terminTyp, setTerminTyp] = useState<'erstgespraech' | 'strategiegespraech'>('erstgespraech')

  const ausfuehren = (a: LeadAktion) => {
    if (a === 'notiz') {
      document.querySelector<HTMLTextAreaElement>('[data-notizfeld] textarea')?.focus()
      return
    }
    if (a === 'anrufgrund') {
      setAkk((s) => ({ ...s, telefon: true }))
      setTimeout(
        () =>
          document.querySelector<HTMLSelectElement>('[data-kanal="telefon"] select[aria-label="Anrufgrund"]')?.focus(),
        0,
      )
      return
    }
    if (a === 'tag') {
      document.querySelector<HTMLElement>('[data-felder] [data-tags] button')?.focus()
      return
    }
    if (a === 'papierkorb') {
      void loeschen.mutateAsync(lead.id).then(() => {
        toast('In Papierkorb – wiederherstellen unter Leads → Papierkorb.')
        navigate(PFADE.leads)
      })
      return
    }
    if (a === 'uebernehmen') {
      if (!me) return
      void update.mutateAsync({
        id: lead.id,
        erwartetUpdatedAt: lead.updated_at,
        patch: { owner_id: me, released: false },
      })
      return
    }
    setAktion(a)
  }
  useLeadAktionen(lead.id, ausfuehren)

  const phaseWechsel = (ziel: PhaseKey) => {
    const a = phasenAktion(ziel)
    if (a === 'termin') setTerminTyp(ziel === 'strategiegespraech' ? 'strategiegespraech' : 'erstgespraech')
    if (a) return setAktion(a)
    void update.mutateAsync({
      id: lead.id,
      erwartetUpdatedAt: lead.updated_at,
      patch: { stage: ERSTE_STAGE_DER_PHASE[ziel] },
    })
  }

  const href = linkedinHref(lead.linkedin_url)
  const tel = telefonGate(lead, treffer)
  const mail = emailGate(lead, nachfassZaehler(emails, lead), treffer)
  useHotkeys(
    'karte',
    {
      o: () => {
        if (href) window.open(href, '_blank', 'noopener')
      },
      'mod+enter': () => navigate(PFADE.lead(lead.id)),
      'mod+shift+k': () => {
        if (tel.erlaubt) navigate(PFADE.anruf(lead.id))
      },
      'alt+m': () => {
        if (mail.erlaubt) navigate(`${PFADE.emailVerfassen}?lead=${encodeURIComponent(lead.id)}`)
      },
    },
    [lead.id, href, tel.erlaubt, mail.erlaubt],
  )

  // Kontrollierte Aktionen: Öffnen über den eigenen Button/die eigene Taste setzt die Aktion, Schließen räumt sie ab
  const umschalten = (a: LeadAktion) => (o: boolean) => setAktion(o ? a : null)
  const unsichtbar = <span className="sr-only" aria-hidden />
  const fremd = !!me && (lead.released || lead.owner_id !== me)

  return (
    <div className="flex min-h-full flex-col" data-lead-panel={lead.id}>
      <div className="border-line border-b px-6 pb-4 max-md:px-4">
        <h2 className="lead-name">{lead.full_name ?? '–'}</h2>
        <p className="text-small text-ink-2 mt-0.5">
          {[lead.company_name, lead.role !== 'unbekannt' ? ROLLE_LABEL[lead.role] : lead.role_title, lead.city]
            .filter(Boolean)
            .join(' · ') || '–'}
        </p>
        <KopfChips
          lead={lead}
          members={members ?? []}
          settings={settings}
          tags={tags}
          sperrliste={treffer}
          onPhase={phaseWechsel}
          className="mt-2.5"
        />
        {/* Mobil/Sheet (< 1024, DESIGN-SYSTEM § 5.11): Aktionszeile mit vier Icon+Label-Buttons */}
        <div className="mt-3 grid grid-cols-4 gap-1.5 lg:hidden" data-mobil-aktionen>
          <Button
            variante="secondary"
            groesse="S"
            icon={Phone}
            disabled={!tel.erlaubt}
            disabledGrund={tel.grund ? GATE_GRUND_LABEL[tel.grund] : undefined}
            onClick={() => navigate(PFADE.anruf(lead.id))}
          >
            Anrufen
          </Button>
          <Button
            variante="secondary"
            groesse="S"
            icon={ExternalLink}
            disabled={!href}
            disabledGrund="Keine Profil-URL"
            onClick={() => href && window.open(href, '_blank', 'noopener')}
          >
            LinkedIn
          </Button>
          <Button
            variante="secondary"
            groesse="S"
            icon={Mail}
            disabled={!mail.erlaubt}
            disabledGrund={mail.grund ? GATE_GRUND_LABEL[mail.grund] : undefined}
            onClick={() => navigate(`${PFADE.emailVerfassen}?lead=${encodeURIComponent(lead.id)}`)}
          >
            E-Mail
          </Button>
          <Button variante="secondary" groesse="S" icon={NotebookPen} onClick={() => ausfuehren('notiz')}>
            Notiz
          </Button>
        </div>
      </div>
      <div className="flex-1 px-6 pt-5 pb-6 max-md:px-4">
        <NaechsterSchritt lead={lead} item={item} kontext="peek" aktiv sperrliste={treffer} />
        <div data-felder>
          <FelderRaster lead={lead} members={members ?? []} settings={settings} />
        </div>
        <div className="border-line mb-5 border-t">
          <LinkedInKarte
            lead={lead}
            members={members ?? []}
            offen={akk.linkedin}
            onToggle={() => setAkk((s) => ({ ...s, linkedin: !s.linkedin }))}
            sperrliste={treffer}
          />
          <TelefonKarte
            lead={lead}
            offen={akk.telefon}
            onToggle={() => setAkk((s) => ({ ...s, telefon: !s.telefon }))}
            sperrliste={treffer}
          />
          <EmailKarte
            lead={lead}
            offen={akk.email}
            onToggle={() => setAkk((s) => ({ ...s, email: !s.email }))}
            sperrliste={treffer}
            settings={settings}
          />
        </div>
        <Timeline leadId={lead.id} kompakt />
        <div className="mt-4" data-notizfeld>
          <NotizFeld leadId={lead.id} aktiv bleibtOffen />
        </div>
      </div>
      <div className="border-line flex flex-wrap items-center gap-1.5 border-t px-6 py-3">
        <Uebergeben
          leadId={lead.id}
          aktiv
          offen={aktion === 'uebergeben'}
          onOpenChange={umschalten('uebergeben')}
          trigger={aktion === 'uebergeben' ? unsichtbar : undefined}
        />
        <Freigeben
          leadId={lead.id}
          aktiv
          offen={aktion === 'freigeben'}
          onOpenChange={umschalten('freigeben')}
          trigger={aktion === 'freigeben' ? unsichtbar : undefined}
        />
        <Beenden leadId={lead.id} aktiv={!item} offen={aktion === 'beenden'} onOpenChange={umschalten('beenden')} />
        {fremd ? <Uebernehmen leadId={lead.id} aktiv /> : null}
        {/* Aktionen aus Palette/Inline-Phase – ohne eigenen Button, nur kontrolliert geöffnet */}
        <AntwortErhalten
          leadId={lead.id}
          offen={aktion === 'antwort'}
          onOpenChange={umschalten('antwort')}
          trigger={<Button variante="quiet" groesse="S" className="hidden" aria-hidden tabIndex={-1} />}
        />
        <TerminEintragen
          leadId={lead.id}
          typ={terminTyp}
          offen={aktion === 'termin'}
          onOpenChange={umschalten('termin')}
          trigger={unsichtbar}
        />
        <Wiedervorlage
          leadId={lead.id}
          offen={aktion === 'wiedervorlage'}
          onOpenChange={umschalten('wiedervorlage')}
          trigger={unsichtbar}
        />
        <Spaeter
          leadId={lead.id}
          enrollmentId={aktivesEnrollment?.id ?? null}
          taskId={offeneAufgabe?.id ?? null}
          faelligAm={aktivesEnrollment ? aktivesEnrollment.next_due_at : (offeneAufgabe?.due_at ?? null)}
          offen={aktion === 'spaeter'}
          onOpenChange={umschalten('spaeter')}
          trigger={unsichtbar}
        />
      </div>
    </div>
  )
}
