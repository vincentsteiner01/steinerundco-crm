// BAUPLAN § 3.1.4 `/email` (`?tab=faellig|entwuerfe|gesendet`, `?lead=` → PeekOutlet), § 3.5 `EmailSeite.tsx`:
// Hinweiszeile „Versand läuft über dein Gmail-Postfach (…). Antworten kommen dort an.“, Tabs Fällig · Entwürfe · Gesendet.
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { HinweisKarte } from '@/components/ui/HinweisKarte'
import { KopfStats, SeitenKopf } from '@/components/ui/SeitenKopf'
import { Tabs } from '@/components/ui/Tabs'
import { useEmailsStatus, useMe, useMeId, useQueueZaehler } from '@/data'
import { useHotkeyScope } from '@/lib/keyboard'
import { istEmailTab, type EmailTab } from './links'
import { TabEntwuerfe } from './TabEntwuerfe'
import { TabFaellig } from './TabFaellig'
import { TabGesendet } from './TabGesendet'
import { anzeigeName } from '@/lib/mitglied'

const HINWEIS_KEY = 'crm.email.hinweis'

function hinweisAusgeblendet(): boolean {
  try {
    return sessionStorage.getItem(HINWEIS_KEY) === 'aus'
  } catch {
    return false
  }
}

export function Component() {
  const [params, setParams] = useSearchParams()
  const tab: EmailTab = istEmailTab(params.get('tab')) ? (params.get('tab') as EmailTab) : 'faellig'
  const me = useMe()
  const meId = useMeId()
  const { data: zaehler } = useQueueZaehler(meId)
  const { data: entwuerfe } = useEmailsStatus(meId, ['draft', 'opened_in_client'])
  const { data: gesendet } = useEmailsStatus(meId, ['sent_confirmed', 'replied', 'bounced'])
  const [hinweis, setHinweis] = useState(() => !hinweisAusgeblendet())
  useHotkeyScope('liste')

  const tabSetzen = (t: EmailTab) => {
    const p = new URLSearchParams(params)
    p.set('tab', t)
    setParams(p, { replace: true })
  }
  const hinweisAus = () => {
    setHinweis(false)
    try {
      sessionStorage.setItem(HINWEIS_KEY, 'aus')
    } catch {
      /* kein Storage – nur für diese Ansicht */
    }
  }

  const faellig = zaehler?.email ?? 0
  // Ohne hinterlegte Adresse kein „(dein Gmail-Postfach)“ in Klammern – das doppelte den Satz (Sichtprüfung)
  const postfach = me?.email_address?.trim() ? ` (${me.email_address.trim()})` : ''

  return (
    <>
      <SeitenKopf
        titel="E-Mail"
        kontext={anzeigeName(me) || undefined}
        rechts={
          <KopfStats
            eintraege={[
              { wert: faellig, label: 'fällig', ton: faellig > 0 ? 'signal' : undefined },
              { wert: entwuerfe?.length ?? 0, label: 'Entwürfe' },
              { wert: gesendet?.length ?? 0, label: 'gesendet' },
            ]}
          />
        }
      />
      {hinweis ? (
        <HinweisKarte
          text={`Versand läuft über dein Gmail-Postfach${postfach}. Antworten kommen dort an.`}
          onAusblenden={hinweisAus}
        />
      ) : null}
      <Tabs
        ariaLabel="E-Mail"
        wert={tab}
        onChange={tabSetzen}
        className="mb-4"
        tabs={[
          { key: 'faellig', label: 'Fällig', zaehler: faellig },
          { key: 'entwuerfe', label: 'Entwürfe', zaehler: entwuerfe?.length ?? 0 },
          { key: 'gesendet', label: 'Gesendet', zaehler: gesendet?.length ?? 0 },
        ]}
      />
      <div role="tabpanel" aria-label={tab === 'faellig' ? 'Fällig' : tab === 'entwuerfe' ? 'Entwürfe' : 'Gesendet'}>
        {tab === 'faellig' ? <TabFaellig /> : tab === 'entwuerfe' ? <TabEntwuerfe /> : <TabGesendet />}
      </div>
    </>
  )
}
