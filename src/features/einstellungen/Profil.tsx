// Einstellungen → Profil (Neustart 25.11.2026): Name und E-Mail zum Lesen, dazu Kürzel (Avatar), E-Mail-Signatur und
// Calendly-Link (beide für Einzelmails). Gespeichert wird die ganze eigene member_profiles-Zeile: `profilAusMember(me)` trägt
// die Werte der entfallenen Felder (LinkedIn-Plan, Wochenbudget, Tagesziel, Rufnummer, preferences) unverändert mit.
import { useId, useState } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { Feld } from '@/components/ui/Feld'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { Textarea } from '@/components/ui/Textarea'
import { toast } from '@/components/toast'
import { profilAusMember, useMe, useMembers, useProfilSpeichern } from '@/data'
import { Block, NichtGeladen } from './components/Formular'
import { useEntwurf } from './components/formularLogik'
import { pruefeProfil, type ProfilEntwurf, type ProfilFehler } from './logik'

export function Profil() {
  const id = useId()
  const mitglieder = useMembers()
  const me = useMe()
  const speichern = useProfilSpeichern()
  const [fehler, setFehler] = useState<ProfilFehler>({})

  const quelle: ProfilEntwurf | undefined = me
    ? { short_name: me.short_name ?? '', signature: me.signature ?? '', calendly_url: me.calendly_url ?? '' }
    : undefined
  const { entwurf, setEntwurf, geaendert, zuruecksetzen } = useEntwurf(quelle)

  if (!me || !entwurf) {
    // Geladen, aber ohne eigene Zeile, oder gar nicht geladen: beides ist kein Grund für endlose Ladebalken
    return mitglieder.isPending ? (
      <Skeleton zeilen={5} />
    ) : (
      <NichtGeladen text="Dein Profil konnte nicht geladen werden." onNochmal={() => void mitglieder.refetch()} />
    )
  }

  const absenden = () => {
    const f = pruefeProfil(entwurf, quelle)
    setFehler(f)
    if (Object.keys(f).length) return
    speichern.mutate(
      {
        ...profilAusMember(me),
        short_name: entwurf.short_name.trim() || null,
        signature: entwurf.signature.trim() || null,
        calendly_url: entwurf.calendly_url.trim() || null,
      },
      {
        onSuccess: () => {
          zuruecksetzen()
          toast('Profil gespeichert.')
        },
      },
    )
  }

  return (
    <div className="grid gap-7">
      <div className="flex items-center gap-3.5">
        {/* Der Name steht daneben – das Bild muss nicht noch einmal vorgelesen werden */}
        <span aria-hidden className="inline-flex">
          <Avatar member={me} groesse={48} />
        </span>
        <dl className="min-w-0">
          <dt className="sr-only">Anzeigename</dt>
          <dd className="text-h2 text-ink-bright truncate">{me.display_name ?? '–'}</dd>
          <dt className="sr-only">E-Mail</dt>
          <dd className="text-body text-ink-2 break-all">{me.email ?? '–'}</dd>
        </dl>
      </div>

      <Block titel="Profil" ohneKopf onSpeichern={absenden} geaendert={geaendert} busy={speichern.isPending}>
        <Feld label="Kürzel" htmlFor={`${id}-kuerzel`}>
          <Input
            id={`${id}-kuerzel`}
            groesse="L"
            mono
            maxLength={3}
            autoComplete="off"
            rahmenClassName="w-24"
            fehler={fehler.short_name}
            value={entwurf.short_name}
            onChange={(e) => setEntwurf((x) => ({ ...x, short_name: e.target.value.toUpperCase() }))}
          />
        </Feld>
        <Feld label="E-Mail-Signatur" htmlFor={`${id}-sig`} hinweis="Steht unter jeder Einzelmail.">
          <Textarea
            id={`${id}-sig`}
            rows={4}
            className="min-h-24 text-[15px] max-md:text-[16px]"
            value={entwurf.signature}
            onChange={(e) => setEntwurf((x) => ({ ...x, signature: e.target.value }))}
          />
        </Feld>
        <Feld
          label="Calendly-Link"
          htmlFor={`${id}-cal`}
          hinweis={fehler.calendly_url ? undefined : 'Für den Platzhalter [Termin-Link] in E-Mails.'}
        >
          <Input
            id={`${id}-cal`}
            groesse="L"
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://calendly.com/…"
            fehler={fehler.calendly_url}
            value={entwurf.calendly_url}
            onChange={(e) => setEntwurf((x) => ({ ...x, calendly_url: e.target.value }))}
          />
        </Feld>
      </Block>
    </div>
  )
}
