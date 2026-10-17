// M3 – Mittlere Spalte des Anruf-Screens (BAUPLAN § 3.4 AnrufMitte.tsx, DESIGN-SYSTEM § 5.13): Nummer Mono 20 px + Typ,
// Button „Timer starten“ L (Enter), Timer display 40 (Klick = Korrektur), Notizfeld (Autosave 2 s), Qualifizierung (4 Segmente →
// leads.qualification), Datenschutz-Zeile „Hinweis genannt“ (Aktivität einwilligung, metadata.kind = 'datenschutz_hinweis').
// 16.10.2026 (Vincent): kein `tel:` mehr – gewählt wird am eigenen Telefon, der Knopf startet nur den Timer (kein System-Popup).
import { Copy, Timer } from 'lucide-react'
import { useState, type Ref } from 'react'
import { useAktivitaetErstellen } from '@/data/activities'
import { useLeadUpdate } from '@/data/leads'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { Input } from '@/components/ui/Input'
import { Segment } from '@/components/ui/Segment'
import { Textarea } from '@/components/ui/Textarea'
import { fmtDatum, fmtDauer } from '@/lib/format'
import { fmtTelefon, NUMMER_TYP_LABEL, weitereNummern } from '@/lib/telefon'
import { kopieren } from '@/lib/zwischenablage'
import { TOAST } from '@/texte/de'
import type { Json } from '@/types/database'
import type { LeadMitBezug, PhoneSource, PhoneType } from '@/types/domain'
import { parseDauer, QUALIFIZIERUNG, qualifikation } from './qualifizierung'
import type { Anruf } from './useAnruf'

const TYP_LABEL: Record<PhoneType, string> = {
  zentrale: 'Zentrale',
  durchwahl: 'Durchwahl',
  mobil: 'Mobil',
  unbekannt: 'Nummer',
}
const QUELLE_LABEL: Record<PhoneSource, string> = {
  website_kontakt: 'Website-Kontakt',
  google_profil: 'Google-Profil',
  branchenverzeichnis: 'Branchenverzeichnis',
  linkedin: 'LinkedIn',
  visitenkarte: 'Visitenkarte',
  mitgeteilt: 'mitgeteilt',
  impressum: 'Impressum',
  unbekannt: 'unbekannt',
}

export type AnrufMitteProps = {
  lead: LeadMitBezug
  anruf: Anruf
  notizRef?: Ref<HTMLTextAreaElement>
  /** Datenschutz-Satz (Skript-Vorlage, gefüllt) */
  datenschutzText: string | null
  privacyVersion: string
  gross?: boolean
  /** Telefon-Gate zu (§ 8.2 Nr. 2): Grund als Tooltip, Timer-Knopf deaktiviert (Review) */
  gesperrtGrund?: string | null
  /** Der Timer-Knopf – `Enter` im Screen klickt ihn, damit Tastatur und Maus denselben Weg nehmen */
  anrufenRef?: Ref<HTMLButtonElement>
  className?: string
}

export function AnrufMitte({
  lead,
  anruf,
  notizRef,
  datenschutzText,
  privacyVersion,
  gross,
  gesperrtGrund,
  anrufenRef,
  className,
}: AnrufMitteProps) {
  const [korrektur, setKorrektur] = useState<string | null>(null)
  const [kopiert, setKopiert] = useState(false)
  const update = useLeadUpdate()
  const aktivitaet = useAktivitaetErstellen()
  const nummer = lead.phone_e164 ?? ''
  const weitere = weitereNummern(lead.phone_numbers)
  const [kopiertWeitere, setKopiertWeitere] = useState<string | null>(null)
  const qual = qualifikation(lead)

  const weitereKopieren = async (e164: string) => {
    const r = await kopieren(e164)
    if (r === 'ok') {
      setKopiertWeitere(e164)
      toast(TOAST.kopiert)
      window.setTimeout(() => setKopiertWeitere(null), 2000)
    }
  }

  const nummerKopieren = async () => {
    const r = await kopieren(nummer)
    if (r === 'ok') {
      setKopiert(true)
      toast(TOAST.kopiert)
      window.setTimeout(() => setKopiert(false), 2000)
    }
  }

  const qualSetzen = (key: string, wert: string) => {
    const neu: Record<string, Json | undefined> = { ...qual, [key]: qual[key] === wert ? null : wert }
    void update
      .mutateAsync({ id: lead.id, erwartetUpdatedAt: lead.updated_at, patch: { qualification: neu as Json } })
      .catch(() => {})
  }

  const hinweisGenannt = async () => {
    try {
      await aktivitaet.mutateAsync({
        lead_id: lead.id,
        type: 'einwilligung',
        channel: 'telefon',
        note: datenschutzText,
        metadata: { kind: 'datenschutz_hinweis', version: privacyVersion, kanal: 'Telefon' },
      })
      await update.mutateAsync({
        id: lead.id,
        erwartetUpdatedAt: lead.updated_at,
        patch: { privacy_notice_sent_at: new Date().toISOString(), privacy_notice_version: privacyVersion },
      })
      toast('Datenschutz-Hinweis notiert.')
    } catch {
      // Toast aus den Hooks
    }
  }

  const dauerUebernehmen = () => {
    if (korrektur === null) return
    const sec = parseDauer(korrektur)
    if (sec !== null) anruf.dauerKorrigieren(sec)
    setKorrektur(null)
  }

  return (
    <div className={cn('grid gap-5', className)}>
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="text-ink-bright tnum font-mono text-[20px]" data-testid="nummer">
          {fmtTelefon(nummer) || '–'}
        </span>
        {nummer ? (
          <Button
            variante="quiet"
            groesse="S"
            icon={Copy}
            copied={kopiert}
            onClick={() => void nummerKopieren()}
            className="self-center"
          >
            Kopieren
          </Button>
        ) : null}
        <span className="text-small text-ink-3">
          {TYP_LABEL[lead.phone_type ?? 'unbekannt']}
          {lead.phone_source ? ` · Quelle: ${QUELLE_LABEL[lead.phone_source]}` : ''}
          {lead.phone_source === 'impressum' ? ' – Impressumsdaten nicht für Werbung' : ''}
        </span>
      </div>
      {/* Weitere Nummern (Feedback 9f9301ea): Zentrale/Durchwahl/Mobil zum Kopieren, gewählt wird am eigenen Telefon */}
      {weitere.length ? (
        <ul className="-mt-3 grid gap-1" aria-label="Weitere Nummern">
          {weitere.map((n) => (
            <li key={n.e164} className="flex items-baseline gap-3" data-weitere-nummer={n.e164}>
              <span className="text-small text-ink-3 w-[72px] flex-none">{NUMMER_TYP_LABEL[n.typ]}</span>
              <span className="tnum text-ink-2 font-mono text-[14px]">{fmtTelefon(n.e164)}</span>
              <Button
                variante="quiet"
                groesse="S"
                icon={Copy}
                copied={kopiertWeitere === n.e164}
                onClick={() => void weitereKopieren(n.e164)}
                aria-label={`${NUMMER_TYP_LABEL[n.typ]} kopieren`}
              >
                Kopieren
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        {/* Nur Timer, kein Wählen: Vincent und Mike wählen am eigenen Telefon (16.10.2026) */}
        <Button
          ref={anrufenRef}
          variante={anruf.laeuft ? 'secondary' : 'primary'}
          groesse="L"
          icon={Timer}
          kbd={gross || anruf.laeuft ? undefined : '↵'}
          disabled={!!gesperrtGrund || !nummer || anruf.laeuft}
          disabledGrund={gesperrtGrund ?? (!nummer ? 'Keine Nummer' : undefined)}
          onClick={() => anruf.anrufen()}
          data-testid="anrufen"
          className={gross ? 'h-14 w-full text-[16px]' : undefined}
        >
          {anruf.laeuft ? 'Timer läuft' : 'Timer starten'}
        </Button>
        {korrektur === null ? (
          <button
            type="button"
            title="Klick korrigiert die Dauer"
            aria-label={`Dauer ${fmtDauer(anruf.dauerSec)} – korrigieren`}
            onClick={() => anruf.laeuft && setKorrektur(fmtDauer(anruf.dauerSec))}
            className={cn('display cursor-text', anruf.laeuft ? 'text-ink-bright' : 'text-ink-3')}
            data-testid="timer"
          >
            {fmtDauer(anruf.dauerSec)}
          </button>
        ) : (
          <Input
            mono
            aria-label="Dauer korrigieren (mm:ss)"
            autoFocus
            value={korrektur}
            className="w-20"
            onChange={(e) => setKorrektur(e.target.value)}
            onBlur={dauerUebernehmen}
            onKeyDown={(e) => {
              if (e.key === 'Enter') dauerUebernehmen()
              if (e.key === 'Escape') setKorrektur(null)
            }}
          />
        )}
        <span className="text-small text-ink-3">
          {anruf.laeuft ? 'Gespräch läuft' : 'Wählen am eigenen Telefon'} · <kbd className="kbd">Esc</kbd> Abbrechen
        </span>
      </div>

      <div className="grid gap-1.5">
        <label className="label block" htmlFor={`notiz-${lead.id}`}>
          Notiz · speichert automatisch
        </label>
        <Textarea
          id={`notiz-${lead.id}`}
          ref={notizRef}
          rows={3}
          placeholder="Was wurde gesagt? (N fokussiert)"
          value={anruf.entwurf?.notiz ?? ''}
          onChange={(e) => anruf.notizSetzen(e.target.value)}
        />
      </div>

      <div className="grid gap-2.5" role="group" aria-label="Qualifizierung">
        <span className="label">Qualifizierung · schreibt in den Lead</span>
        {QUALIFIZIERUNG.map((q) => (
          <div key={q.key} className="flex flex-wrap items-center gap-3">
            <span className="label w-[148px] flex-none whitespace-nowrap">{q.label}</span>
            <Segment
              klein
              ariaLabel={q.label}
              optionen={q.optionen}
              wert={typeof qual[q.key] === 'string' ? (qual[q.key] as string) : ''}
              onChange={(k) => qualSetzen(q.key, k)}
            />
          </div>
        ))}
      </div>

      <div role="note" className="border-line-strong flex flex-wrap items-center gap-3 rounded-md border px-3.5 py-2.5">
        <span className="text-small text-ink-2 min-w-0 flex-1">
          Datenschutz: {datenschutzText ?? 'Skript-Tab „Datenschutz“ – Ein-Satz-Formel.'}
          {lead.privacy_notice_sent_at ? (
            <span className="text-ink-3"> · genannt am {fmtDatum(lead.privacy_notice_sent_at)}</span>
          ) : null}
        </span>
        <Button
          variante="secondary"
          groesse="S"
          busy={aktivitaet.isPending || update.isPending}
          onClick={() => void hinweisGenannt()}
        >
          Hinweis genannt
        </Button>
      </div>
    </div>
  )
}
