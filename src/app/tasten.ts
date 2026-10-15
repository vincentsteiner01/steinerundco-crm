// BAUPLAN § 3.1.8 – Zusammenführung aller features/<m>/tasten.ts + globale Tasten (Anhang A). Quelle des `?`-Overlays.
import { TASTEN as EINSTELLUNGEN } from '@/features/einstellungen/tasten'
import { TASTEN as EMAIL } from '@/features/email/tasten'
import { TASTEN as FEEDBACK } from '@/features/feedback/tasten'
import { TASTEN as HEUTE } from '@/features/heute/tasten'
import { TASTEN as HILFE } from '@/features/hilfe/tasten'
import { TASTEN as IMPORT } from '@/features/import/tasten'
import { TASTEN as KPIS } from '@/features/kpis/tasten'
import { TASTEN as LEADS } from '@/features/leads/tasten'
import { TASTEN as LEITFAEDEN } from '@/features/leitfaeden/tasten'
import { TASTEN as PIPELINE } from '@/features/pipeline/tasten'
import { TASTEN as SEQUENZEN } from '@/features/sequenzen/tasten'
import { TASTEN as TEAM } from '@/features/team/tasten'
import { TASTEN as TELEFON } from '@/features/telefon/tasten'

export type TastenEintrag = { tasten: string[]; beschreibung: string }
export type TastenGruppe = { gruppe: string; eintraege: TastenEintrag[] }

export const GLOBALE_TASTEN: TastenGruppe[] = [
  {
    gruppe: 'Global',
    eintraege: [
      { tasten: ['⌘K'], beschreibung: 'Palette' },
      { tasten: ['/'], beschreibung: 'Suche fokussieren' },
      { tasten: ['?'], beschreibung: 'Tastenkürzel' },
      // Runde 2: eine Zeile je Ziel – zehn Einzeltasten „G H G L G P …“ in einer Zeile waren nicht zuzuordnen
      ...(
        [
          ['G H', 'Gehe zu Heute'],
          ['G L', 'Gehe zu Leads'],
          ['G P', 'Gehe zu Pipeline'],
          ['G T', 'Gehe zu Telefon'],
          ['G M', 'Gehe zu E-Mail'],
          ['G K', 'Gehe zu KPIs'],
          ['G A', 'Gehe zu Team'],
          ['G F', 'Gehe zu Leitfäden'],
          ['G I', 'Gehe zu Import'],
          ['G E', 'Gehe zu Einstellungen'],
          ['G S', 'Gehe zu Hilfe'],
          ['G B', 'Gehe zu Feedback'],
        ] as const
      ).map(([t, b]) => ({ tasten: [t], beschreibung: b })),
      { tasten: ['⌥N'], beschreibung: 'Lead anlegen' },
      { tasten: ['⌘⇧O'], beschreibung: 'Schnellimport' },
      { tasten: ['Z'], beschreibung: 'Rückgängig (letzter Toast)' },
      { tasten: ['R'], beschreibung: 'Erneut versuchen (bei Fehler-Toast)' },
      { tasten: ['Esc'], beschreibung: 'Schließen · Abbrechen · Auswahl aufheben' },
      { tasten: ['⌘↵'], beschreibung: 'Formular speichern' },
    ],
  },
  {
    gruppe: 'Lead-Aktionen',
    eintraege: [
      { tasten: ['A'], beschreibung: 'Antwort erhalten (1–9 Reaktion)' },
      { tasten: ['B'], beschreibung: 'Beenden (Grund 1–9)' },
      { tasten: ['S'], beschreibung: 'Später (1 morgen · 2 +3 T · 3 Mo · 4 +1 W · 5 +2 Mo · D Datum)' },
      { tasten: ['W'], beschreibung: 'Wiedervorlage' },
      { tasten: ['T'], beschreibung: 'Termin eintragen' },
      { tasten: ['N'], beschreibung: 'Notiz' },
      { tasten: ['⌘⇧U'], beschreibung: 'Übergeben' },
      { tasten: ['⌘⇧F'], beschreibung: 'Freigeben' },
      { tasten: ['Ü'], beschreibung: 'Übernehmen' },
      { tasten: ['⌘⇧K'], beschreibung: 'Anrufen' },
      { tasten: ['⌥M'], beschreibung: 'E-Mail verfassen' },
      { tasten: ['⌘⇧E'], beschreibung: 'Vorlage wechseln' },
    ],
  },
]

export const TASTEN: TastenGruppe[] = [
  ...GLOBALE_TASTEN,
  ...HEUTE,
  ...SEQUENZEN,
  ...LEADS,
  ...PIPELINE,
  ...TELEFON,
  ...EMAIL,
  ...KPIS,
  ...TEAM,
  ...LEITFAEDEN,
  ...IMPORT,
  ...EINSTELLUNGEN,
  ...FEEDBACK,
  ...HILFE,
].filter((g) => g.eintraege.length > 0)
