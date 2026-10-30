// Einrichtung des Recherche-Diensts unter Windows als Schritt-für-Schritt-Anleitung (30.10.2026, Vincent: Mike „kennt sich mit
// Computern nicht gut aus – so viel es geht vorkauen und sagen, WARUM“). Jede Seite sagt, was zu tun ist und warum; das
// Einrichtungsfenster (public/recherche-dienst/einrichten.ps1) führt danach selbst durch App, Erweiterung und Computer Use.
import { Check, Copy } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui'

function Warum({ children }: { children: ReactNode }) {
  return (
    <p className="bg-surface-hover text-small text-ink-2 rounded-sm px-3 py-2">
      <span className="text-ink font-semibold">Warum? </span>
      {children}
    </p>
  )
}

function Liste({ children }: { children: ReactNode }) {
  return <ol className="text-body text-ink-2 grid list-decimal gap-2 pl-5">{children}</ol>
}

// Taste als Inhalt der Anleitung – kein <kbd>: das blendet tokens.css auf Touch-Geräten aus (dort sind es nur Kürzel-Hinweise)
const Taste = ({ children }: { children: ReactNode }) => (
  <span className="border-line-strong text-ink inline-block rounded-[4px] border px-1 py-px text-[12px] leading-tight font-semibold">
    {children}
  </span>
)

/** Inhalt einer Seite (Index in WINDOWS_TITEL, logik.ts); „Weiter“/„Zurück“ stellt der Dialog. */
export function WindowsSeite({
  seite,
  befehl,
  kopiert,
  onKopieren,
  verbunden,
}: {
  seite: number
  befehl: string | null
  /** null, solange nicht versucht; false, wenn der Browser nur markieren konnte */
  kopiert: boolean | null
  onKopieren: () => void
  verbunden: boolean | undefined
}) {
  switch (seite) {
    case 0:
      return (
        <>
          <p className="text-body text-ink-2">
            Wir richten einmal den Recherche-Dienst auf deinem Computer ein. Danach findet ChatGPT auf Knopfdruck
            passende Leute auf LinkedIn – und vernetzt dich erst, wenn du die Liste freigegeben hast.
          </p>
          <Warum>
            ChatGPT arbeitet in deinem Chrome, weil du dort bei LinkedIn angemeldet bist. So sieht LinkedIn ganz normal
            dich – du gibst kein Passwort weiter.
          </Warum>
          <p className="text-body text-ink-2">
            <span className="text-ink font-semibold">Dauer:</span> etwa 10 Minuten.{' '}
            <span className="text-ink font-semibold">Du brauchst:</span> Google Chrome, in dem du bei LinkedIn
            angemeldet bist, und deine Zugangsdaten für ChatGPT.
          </p>
          <p className="text-small text-ink-3">
            Du kannst nichts kaputt machen. Klemmt etwas: Foto vom Bildschirm an Vincent schicken.
          </p>
        </>
      )
    case 1:
      return (
        <>
          <p className="text-body text-ink-2">
            Klick unten auf „Befehl erzeugen und kopieren“. Der Befehl landet automatisch in deiner Zwischenablage – du
            musst nichts abschreiben.
          </p>
          <Warum>
            Der Befehl enthält einen Schlüssel nur für dich. Damit weiß das CRM, dass dieser Computer in deinem Namen
            arbeiten darf. Gib ihn deshalb nicht weiter.
          </Warum>
          {befehl ? (
            <div className="grid gap-1.5">
              <pre
                className="bg-surface-hover border-line text-ink rounded-sm border px-3 py-2.5 font-mono text-[12px] break-all whitespace-pre-wrap"
                data-befehl
              >
                {befehl}
              </pre>
              <div className="flex flex-wrap items-center justify-between gap-2">
                {kopiert ? (
                  <span className="text-small text-done flex items-center gap-1.5">
                    <Check size={14} aria-hidden /> Kopiert – weiter mit „Weiter“.
                  </span>
                ) : (
                  <span className="text-small text-ink-2">
                    Noch nicht kopiert – bitte auf „Nochmal kopieren“ klicken.
                  </span>
                )}
                <Button variante="quiet" icon={Copy} onClick={onKopieren}>
                  Nochmal kopieren
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )
    case 2:
      return (
        <>
          <p className="text-body text-ink-2">Jetzt fügst du den Befehl in Windows ein:</p>
          <Liste>
            <li>
              Drück die <Taste>Windows</Taste>-Taste – unten links auf der Tastatur, die mit dem Fenster-Symbol.
            </li>
            <li>
              Tippe <span className="text-ink font-semibold">PowerShell</span> und drück <Taste>Enter</Taste>. Ein
              blaues oder schwarzes Fenster geht auf – das ist richtig so.
            </li>
            <li>
              Klick einmal in das Fenster und drück <Taste>Strg</Taste> + <Taste>V</Taste>. Jetzt steht dein Befehl
              darin. Klappt das nicht: Rechtsklick ins Fenster.
            </li>
            <li>
              Drück <Taste>Enter</Taste>.
            </li>
          </Liste>
          <Warum>
            PowerShell ist das Windows-Werkzeug, mit dem man Programme einrichtet. Du musst dort nichts selbst
            schreiben, nur einfügen. Administrator-Rechte braucht es nicht.
          </Warum>
        </>
      )
    case 3:
      return (
        <>
          <p className="text-body text-ink-2">
            Das Fenster führt dich jetzt durch sechs kurze Schritte. Es prüft selbst, was schon da ist, und öffnet dir
            die richtigen Seiten. Lies, was dort steht, mach es und drück dann im Fenster <Taste>Enter</Taste>.
          </p>
          <p className="text-body text-ink font-semibold">Das kann dich unterwegs erwarten:</p>
          <Liste>
            <li>
              Der Microsoft Store mit der ChatGPT-App: auf „Herunterladen“ klicken, danach in der App anmelden.
              <Warum>Die App bringt das Programm mit, das die Recherche macht – über deinen ChatGPT-Zugang.</Warum>
            </li>
            <li>
              Die Chrome-Seite der Erweiterung „ChatGPT“: auf „Zu Chrome hinzufügen“ und dann „Erweiterung hinzufügen“
              klicken.
              <Warum>
                Darüber kann ChatGPT in Chrome lesen und klicken. Chrome warnt, dass die Erweiterung Webseiten ändern
                darf – genau das soll sie für dich auf LinkedIn tun.
              </Warum>
            </li>
            <li>
              In der ChatGPT-App „Computer Use“ einschalten – das Fenster sagt dir genau, wo.
              <Warum>Erst damit darf ChatGPT dein Chrome bedienen. Ohne kann es nur chatten.</Warum>
            </li>
            <li>
              LinkedIn einmal erlauben.
              <Warum>
                ChatGPT fragt bei jeder neuen Webseite einmal nach. Später arbeitet es im Hintergrund und kann dich
                nicht fragen – deshalb erlaubst du LinkedIn jetzt einmal vorab.
              </Warum>
            </li>
          </Liste>
          <p className="text-small text-ink-3">
            Am Ende steht grün „Alles fertig!“ – dann kannst du das Fenster schließen. Steht dort etwas in Rot: Foto
            davon an Vincent.
          </p>
        </>
      )
    default:
      return (
        <>
          <p
            className="text-body text-ink flex items-center gap-2 font-semibold"
            role="status"
            data-verbunden={verbunden}
          >
            {verbunden ? (
              <>
                <Check size={16} className="text-done" aria-hidden /> Recherche-Dienst verbunden – alles bereit.
              </>
            ) : (
              'Noch nicht verbunden. Steht im Fenster schon „Alles fertig!“? Sonst einfach dem Fenster weiter folgen.'
            )}
          </p>
          <p className="text-body text-ink font-semibold">So läuft eine Recherche:</p>
          <Liste>
            <li>Links im CRM auf den blauen Knopf „Recherche starten“ klicken.</li>
            <li>
              ChatGPT sucht in deinem Chrome passende Leute. Lass Chrome offen und den Computer an – zuschauen kannst
              du, musst du aber nicht.
            </li>
            <li>
              Ist die Liste fertig, steht am blauen Knopf „Freigabe nötig“. Schau dir die Personen an und klick
              „Freigeben“ – oder „Nicht freigeben“.
              <Warum>Die Anfragen gehen in deinem Namen raus. Deshalb entscheidest du, wer angefragt wird.</Warum>
            </li>
            <li>Jede angefragte Person landet als Lead im CRM, die KPIs zählen mit.</li>
          </Liste>
        </>
      )
  }
}
