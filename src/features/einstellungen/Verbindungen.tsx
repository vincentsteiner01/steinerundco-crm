// Einstellungen → Verbindungen (/einstellungen/verbindungen): Einrichtung (LinkedIn-Mails aus Gmail · Chrome-Erweiterung ·
// Eingang) und als zweiter Tab der Eingang selbst (?tab=eingang – keine eigene Top-Level-Route). Neue Eingänge erscheinen live.
import { Inbox } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { Button, Tabs } from '@/components/ui'
import { EingangListe, useEingangLive, useEingangOffenAnzahl } from '@/features/eingang/public'
import { ErweiterungAbschnitt } from './verbindungen/ErweiterungAbschnitt'
import { GmailAbschnitt } from './verbindungen/GmailAbschnitt'
import { VERBINDUNGEN_TABS, type VerbindungenTab } from './verbindungen/konstanten'
import { Abschnitt, Text } from './verbindungen/Teile'

export function Verbindungen() {
  useEingangLive()
  const [params, setParams] = useSearchParams()
  const tab: VerbindungenTab = params.get('tab') === 'eingang' ? 'eingang' : 'einrichtung'
  const { data: offen } = useEingangOffenAnzahl()

  const wechseln = (t: VerbindungenTab) => {
    // Filter des Eingangs gehören nur zum Eingang
    setParams(t === 'eingang' ? { tab: 'eingang' } : {}, { replace: false })
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="grid gap-6">
      <Tabs
        ariaLabel="Verbindungen"
        tabs={VERBINDUNGEN_TABS.map((t) => (t.key === 'eingang' ? { ...t, zaehler: offen || undefined } : t))}
        wert={tab}
        onChange={wechseln}
      />
      {tab === 'eingang' ? (
        <EingangListe />
      ) : (
        <div className="grid">
          <GmailAbschnitt onEingang={() => wechseln('eingang')} />
          <ErweiterungAbschnitt />
          <Abschnitt
            id="verbindungen-eingang"
            titel="Eingang"
            beschreibung="LinkedIn-Mails beider Postfächer, die das CRM nicht allein zuordnen konnte, und Einladungen von Leads."
          >
            <Text>
              Lässt sich eine Mail keinem Lead sicher zuordnen, landet sie hier als „unbekannt“. Lead suchen, „Zuordnen“
              – dann wird sofort verbucht.
            </Text>
            <div>
              <Button variante={offen ? 'primary' : 'secondary'} icon={Inbox} onClick={() => wechseln('eingang')}>
                {offen ? `Eingang ansehen · ${offen} offen` : 'Eingang ansehen'}
              </Button>
            </div>
          </Abschnitt>
        </div>
      )}
    </div>
  )
}
