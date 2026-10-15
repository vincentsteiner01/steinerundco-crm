// Queue-Karte (BAUPLAN § 3.1.10a Vertrag, § 3.2 QueueKarte.tsx, DESIGN-SYSTEM § 5.7): LinkedIn-, E-Mail-, Wiedervorlage-, Aufgaben-
// Variante hier; Telefon-, Antworten- und Meeting-Karte als eigene Komponenten. Kollabiert (52 px) außer der aktiven Karte.
// Die Karte führt ihre Aktionen selbst aus (useQueueAktionen liest den Seiten-Kontext) und meldet sie über `onAktion`.
import { ExternalLink } from 'lucide-react'
import { useRef, useState } from 'react'
import { AntwortErhalten, Beenden, NotizFeld, Spaeter, TerminEintragen, Wiedervorlage } from '@/components/aktionen'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { DropdownMenu, type MenuEintrag } from '@/components/ui/DropdownMenu'
import { useEmails } from '@/data/emails'
import { useSettings } from '@/data/settings'
import { useSperrliste } from '@/data/sperrliste'
import { ErlaubnisBadge, useIstEmailSequenzAktiv } from '@/features/email/public'
import { emailGate, kontaktGate, nachfassZaehler, sperrlistenEintraege } from '@/lib/gates'
import { useHotkeys } from '@/lib/keyboard'
import { fuellen } from '@/lib/platzhalter'
import { emailGateText, GATE_GRUND_LABEL, GRUND_LABEL } from '@/texte/de'
import type { QueueItem } from '@/types/domain'
import { useIstTelefon } from '@/lib/useMediaQuery'
import { AntwortenKarte } from './AntwortenKarte'
import { faelligVon, kartenLabel, vorbereitetText } from './karten'
import { useGateMelden } from './kartenStore'
import {
  KartenAktionen,
  KartenFuss,
  KartenKopf,
  KartenRahmen,
  KartenSub,
  KartenWer,
  KollabierteKarte,
} from './KartenTeile'
import { KarteEingebettet, useHeuteKontext } from './kontext'
import { MeetingKarte } from './MeetingKarte'
import { NachrichtBlock } from './NachrichtBlock'
import { kartenArt } from './nachricht'
import { TelefonKarte } from './TelefonKarte'
import { useKarteDaten } from './useKarteDaten'
import { useQueueAktionen } from './useQueueAktionen'

/** Button in einer Zelle des 4er-Aktionsrasters (Telefon) */
const ZELLE = 'w-full min-w-0 overflow-hidden px-1.5!'

export type QueueAktion =
  | 'kopieren'
  | 'gesendet'
  | 'spaeter'
  | 'notiz'
  | 'antwort'
  | 'beenden'
  | 'oeffnen'
  | 'anrufen'
  | 'pitch'
  | 'termin'
  | 'wiedervorlage'

export type QueueKarteProps = {
  item: QueueItem
  aktiv: boolean
  onAktion: (a: QueueAktion) => void
  kontext?: 'heute' | 'peek'
}

export type VariantenProps = { item: QueueItem; onAktion: (a: QueueAktion) => void; kontext: 'heute' | 'peek' }

export function QueueKarte({ item, aktiv, onAktion, kontext = 'heute' }: QueueKarteProps) {
  const h = useHeuteKontext()
  if (!aktiv) {
    const zu = <KollabierteKarte item={item} heute={h.heute} vorbereitet={vorbereitetText(item)} />
    // Runde 3 (Wunsch leads-pipeline Nr. 1): auch die zugeklappte Karte (Lead-Vollseite, `aktiv={false}`) eingebettet – Name und
    // Firma stehen schon in der H1, keine Box in der Box
    return kontext === 'peek' ? <KarteEingebettet.Provider value>{zu}</KarteEingebettet.Provider> : zu
  }
  const karte = (() => {
    switch (kartenArt(item)) {
      case 'telefon':
        return <TelefonKarte item={item} onAktion={onAktion} kontext={kontext} />
      case 'antworten':
        return <AntwortenKarte item={item} onAktion={onAktion} kontext={kontext} />
      case 'meeting':
        return <MeetingKarte item={item} onAktion={onAktion} kontext={kontext} />
      default:
        return <NachrichtKarte item={item} onAktion={onAktion} kontext={kontext} />
    }
  })()
  // Im Peek eingebettet: ohne Namenszeile und ohne eigenen Rahmen (Runde 2: Name/Firma doppelt, Box in Box)
  return kontext === 'peek' ? <KarteEingebettet.Provider value>{karte}</KarteEingebettet.Provider> : karte
}

/** LinkedIn / E-Mail / Wiedervorlage / Aufgabe (DESIGN-SYSTEM § 5.7, Varianten). */
function NachrichtKarte({ item, onAktion, kontext }: VariantenProps) {
  const h = useHeuteKontext()
  const a = useQueueAktionen()
  const d = useKarteDaten(item)
  const { data: settings } = useSettings()
  const email = d.art === 'email'
  const { data: mails } = useEmails(email ? item.lead_id : null)
  const { data: sperrliste } = useSperrliste()
  const emailSequenz = useIstEmailSequenzAktiv(d.art === 'linkedin' ? item.lead_id : null)
  const telefon = useIstTelefon()
  const vorlageKnopf = useRef<HTMLButtonElement | null>(null)
  const [kopiert, setKopiert] = useState(false)
  const [mehr, setMehr] = useState<'notiz' | 'antwort' | 'beenden' | null>(null)
  const [weiterWv, setWeiterWv] = useState(false)

  const leadId = item.lead_id ?? ''
  const wiedervorlage = d.art === 'wiedervorlage'
  const gateLead = d.lead ?? { email: item.email, do_not_contact: item.do_not_contact ?? false }
  // Sperrliste wie Composer und Kanal-Karte (Integration: vorher `false`); die Gates prüfen die Kanäle der Treffer
  const treffer = sperrlistenEintraege(sperrliste, { id: item.lead_id, email: d.lead?.email ?? item.email, ...d.lead })
  const gateEmail = email
    ? emailGate(gateLead, nachfassZaehler(mails, d.lead), treffer, {
        maxNachfass: settings?.email.max_followups_per_consent,
        maxAlterMonate: settings?.email.consent_max_age_months,
        // Transaktions-Vorlagen (No-Show N0, Terminbestätigung) brauchen keine Werbe-Erlaubnis (BAUPLAN § 1.5 Nr. 28, M-12)
        transaktional: d.vorlage?.phase === 'transaktional',
      })
    : null
  const gate = gateEmail ?? kontaktGate(gateLead, treffer)
  const gesperrt = !gate.erlaubt
  const gateGrund = gateEmail
    ? gateEmail.grund
      ? emailGateText(gateEmail.grund, d.lead?.first_name ?? item.first_name)
      : undefined
    : gate.grund
      ? GATE_GRUND_LABEL[gate.grund]
      : undefined
  useGateMelden(d.key, gesperrt ? (gateGrund ?? 'Gesperrt') : null)

  const offen = d.ergebnis.offen
  // Ein Wortlaut für Tooltip und Hinweis (DESIGN-SYSTEM § 5.1/§ 5.7, TOAST.erstReaktion): ohne Vorlagen-Klammern. BAUPLAN § 3.1.9a
  // zitiert den Platzhalter in Vorlagen-Schreibweise („Erst [Reaktion] eintragen“) – Konfliktentscheid: Anzeige ohne Klammern.
  const kopierenGrund = gesperrt ? gateGrund : offen.length ? `Erst ${offen[0]} eintragen` : undefined
  const kopierenAus = gesperrt || offen.length > 0 || !d.ergebnis.text.trim()

  const kopieren = async () => {
    if (await a.kopieren(item)) {
      setKopiert(true)
      window.setTimeout(() => setKopiert(false), 2000)
      onAktion('kopieren')
    }
  }
  const gesendet = () => {
    void a.gesendet(item)
    onAktion('gesendet')
  }
  const oeffnen = () => {
    if (email) a.emailOeffnen(item)
    else a.profilOeffnen(item)
    onAktion('oeffnen')
  }
  // `O` = Profil/LinkedIn öffnen (ux § 5.3) – auch auf der E-Mail-Karte; „In Gmail öffnen“ ist dort ↵
  const profil = () => {
    a.profilOeffnen(item)
    onAktion('oeffnen')
  }

  useHotkeys(
    'karte',
    {
      'mod+shift+e': () => vorlageKnopf.current?.click(),
      // Wiedervorlage-Karte: `W` = „Weiter Wiedervorlage (+3 Monate)“ (eigener Trigger, deshalb Taste hier)
      ...(wiedervorlage ? { w: () => setWeiterWv(true) } : {}),
      // Im Peek gibt es keine Seiten-Tasten (Heute: useQueueHotkeys) – die Karte bindet `C`/`E` selbst (Review: auf Leads tat `C`
      // nichts, `E` öffnete die Inline-Bearbeitung der Tabellenzeile hinter dem Peek)
      ...(kontext === 'peek'
        ? {
            c: (e: KeyboardEvent) => {
              e.preventDefault()
              if (!kopierenAus) void kopieren()
            },
            e: (e: KeyboardEvent) => {
              e.preventDefault()
              if (!gesperrt) gesendet()
            },
          }
        : {}),
    },
    [wiedervorlage, kontext, kopierenAus, gesperrt],
  )

  const betreff = email && d.vorlage?.subject ? fuellen(d.vorlage.subject, d.fLead, d.ctx).text : null
  const grund = wiedervorlage && d.lead?.ended_reason ? GRUND_LABEL[d.lead.ended_reason] : null
  const sub = [
    d.lead?.role_title,
    d.lead?.city ?? undefined,
    grund ? `Grund: ${grund}` : undefined,
    item.follow_up_count
      ? `${item.follow_up_count} ${item.follow_up_count === 1 ? 'Follow-up' : 'Follow-ups'}`
      : undefined,
    item.snooze_count ? `${item.snooze_count}× verschoben` : undefined,
  ].filter((s): s is string => !!s)

  const mehrEintraege: MenuEintrag[] = [
    { label: 'Notiz', kbd: 'N', onSelect: () => setMehr('notiz') },
    ...(email ? [] : [{ label: 'Antwort erhalten', kbd: 'A', onSelect: () => setMehr('antwort') }]),
    { label: 'Beenden', kbd: 'B', onSelect: () => setMehr('beenden') },
    { label: 'Profil öffnen', kbd: 'O', onSelect: profil },
  ]

  return (
    <KartenRahmen aktiv faellig={faelligVon(item, h.heute)} data-key={item.item_id ?? undefined}>
      <KartenKopf
        label={kartenLabel(item)}
        item={item}
        heute={h.heute}
        rechts={
          <>
            {email && d.lead ? <ErlaubnisBadge lead={d.lead} /> : null}
            {/* DESIGN-SYSTEM § 5.7 „pausiert: keine Aktionen außer Notiz“ ↔ BAUPLAN § 3.5 (M-08): v1 nur Anzeige – BAUPLAN gilt. */}
            {emailSequenz ? <Chip ton="muted">pausiert wegen E-Mail-Sequenz</Chip> : null}
            {(item.days_overdue ?? 0) >= 14 ? <Chip ton="overdue">lange überfällig</Chip> : null}
          </>
        }
      />
      <KartenWer item={item} owner={d.owner} salesOwner={d.salesOwner} />
      {sub.length ? <KartenSub>{sub.join(' · ')}</KartenSub> : null}
      <NachrichtBlock
        itemKey={d.key}
        vorlage={d.vorlage}
        lead={d.fLead}
        ctx={d.ctx}
        ergebnis={d.ergebnis}
        zustand={d.zustand}
        kanal={email ? 'email' : 'linkedin'}
        vorlageRef={vorlageKnopf}
        betreff={betreff}
        onAnrede={d.setzeAnrede}
      />
      {telefon ? (
        // Telefon: vier gleich breite Zellen; Buttons füllen ihre Zelle und schrumpfen (min-w-0, px-1.5) statt in die Nachbarzelle
        // zu ragen (Runde 2: gesperrtes „Kopieren“ 87 px in 71-px-Zelle)
        <div className="mt-3.5 grid grid-cols-4 gap-1.5 [&>*]:min-w-0" role="group" aria-label="Aktionen">
          <Button
            variante="primary"
            copied={kopiert}
            disabled={email ? gesperrt : kopierenAus}
            disabledGrund={email ? gateGrund : kopierenGrund}
            onClick={email ? oeffnen : kopieren}
            className={ZELLE}
          >
            {email ? 'Öffnen' : 'Kopieren'}
          </Button>
          <Button onClick={gesendet} disabled={gesperrt} disabledGrund={gateGrund} className={ZELLE}>
            Gesendet
          </Button>
          <Spaeter
            leadId={leadId}
            enrollmentId={item.enrollment_id}
            taskId={item.task_id}
            snoozeCount={item.snooze_count ?? undefined}
            faelligAm={item.due_at}
            onFertig={() => onAktion('spaeter')}
            trigger={<Button className={ZELLE}>Später</Button>}
          />
          <DropdownMenu trigger={<Button className={ZELLE}>Mehr</Button>} eintraege={mehrEintraege} />
          {mehr === 'notiz' ? (
            <NotizFeld
              leadId={leadId}
              offen
              onOpenChange={(o) => !o && setMehr(null)}
              trigger={<span />}
              onFertig={() => setMehr(null)}
              className="col-span-4"
            />
          ) : null}
          {mehr === 'antwort' ? (
            <AntwortErhalten
              leadId={leadId}
              offen
              onOpenChange={(o) => !o && setMehr(null)}
              trigger={<span />}
              onFertig={() => onAktion('antwort')}
              className="col-span-4"
            />
          ) : null}
          {mehr === 'beenden' ? (
            <Beenden
              leadId={leadId}
              offen
              onOpenChange={(o) => !o && setMehr(null)}
              trigger={<span />}
              onFertig={() => onAktion('beenden')}
            />
          ) : null}
        </div>
      ) : (
        <KartenAktionen
          rechts={
            <Button variante="quiet" groesse="S" kbd="O" icon={ExternalLink} onClick={profil}>
              Profil öffnen
            </Button>
          }
        >
          {email ? (
            <>
              <Button variante="primary" kbd="↵" disabled={gesperrt} disabledGrund={gateGrund} onClick={oeffnen}>
                In Gmail öffnen
              </Button>
              <Button kbd="C" copied={kopiert} disabled={kopierenAus} disabledGrund={kopierenGrund} onClick={kopieren}>
                Kopieren
              </Button>
            </>
          ) : (
            <Button
              variante="primary"
              kbd="C"
              copied={kopiert}
              disabled={kopierenAus}
              disabledGrund={kopierenGrund}
              onClick={kopieren}
            >
              Kopieren
            </Button>
          )}
          {offen.length > 0 && !gesperrt ? (
            <span className="text-overdue text-[12.5px]">Erst {offen[0]} eintragen</span>
          ) : null}
          <Button kbd="E" onClick={gesendet} disabled={gesperrt} disabledGrund={gateGrund}>
            Gesendet
          </Button>
          <Spaeter
            leadId={leadId}
            enrollmentId={item.enrollment_id}
            taskId={item.task_id}
            snoozeCount={item.snooze_count ?? undefined}
            faelligAm={item.due_at}
            aktiv
            onFertig={() => onAktion('spaeter')}
          />
          <NotizFeld
            leadId={leadId}
            aktiv
            trigger={
              <Button variante="quiet" groesse="S" kbd="N">
                Notiz
              </Button>
            }
            onFertig={() => onAktion('notiz')}
          />
          {!email ? <AntwortErhalten leadId={leadId} aktiv onFertig={() => onAktion('antwort')} /> : null}
          {!email ? <TerminEintragen leadId={leadId} aktiv onFertig={() => onAktion('termin')} /> : null}
          {wiedervorlage ? (
            <Wiedervorlage
              leadId={leadId}
              offen={weiterWv}
              onOpenChange={setWeiterWv}
              onFertig={() => onAktion('wiedervorlage')}
              trigger={
                <Button variante="quiet" groesse="S" kbd="W">
                  Weiter Wiedervorlage (+3 Monate)
                </Button>
              }
            />
          ) : !email ? (
            <Wiedervorlage leadId={leadId} aktiv onFertig={() => onAktion('wiedervorlage')} />
          ) : null}
          <Beenden leadId={leadId} aktiv onFertig={() => onAktion('beenden')} />
        </KartenAktionen>
      )}
      <KartenFuss kopiertUm={d.zustand.kopiertUm} kanal={item.channel} />
    </KartenRahmen>
  )
}
