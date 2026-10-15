// BAUPLAN § 3.8 SchrittSpalten: Quellspalte → Zielfeld (Select), erkannte Zuordnungen mit Punkt ink, unerkannte Amber-Text,
// Beispielwert Mono rechts, Datumsformat, Zuständig-Fallback. Sheet-Presets zeigen die erkannten Spalten/Tabs.
import { useMembers } from '@/data'
import { Chip, cn, FormField, Select } from '@/components/ui'
import { fmtZahl } from '@/lib/format'
import { ZIEL_FELDER, ZIEL_LABEL, type ZielFeld } from './parser/kopfwort'
import { textZuIso, zelleZuText, type Zelle } from './parser/xlsx'
import { tagesSumme } from './presets/kpiMonat'
import type { ImportApi } from './useImport'
import { anzeigeName } from '@/lib/mitglied'

function Punkt({ erkannt }: { erkannt: boolean }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block h-1.5 w-1.5 rounded-full', erkannt ? 'bg-ink' : 'border-overdue border')}
    />
  )
}

function beispiel(zeilen: readonly (readonly Zelle[])[], j: number): string | null {
  for (const z of zeilen) {
    const t = zelleZuText(z[j] ?? null)
    if (t) return t
  }
  return null
}

function datumsformat(zeilen: readonly (readonly Zelle[])[]): string {
  for (const z of zeilen.slice(0, 50))
    for (const c of z) {
      if (c instanceof Date) return 'Excel-Datum'
      if (typeof c === 'string' && /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(c.trim()) && textZuIso(c)) return 'DD.MM.YYYY'
      if (typeof c === 'string' && /^\d{4}-\d{2}-\d{2}/.test(c.trim())) return 'YYYY-MM-DD'
    }
  return 'kein Datum erkannt'
}

export function SchrittSpalten({ api }: { api: ImportApi }) {
  const { state, crm, kpi, leitfaeden, allgemein } = api
  const members = useMembers()

  if (state.preset === 'allgemein' && allgemein) {
    const optionen = [
      { value: '', label: '– ignorieren' },
      ...ZIEL_FELDER.map((f) => ({ value: f, label: ZIEL_LABEL[f] })),
    ]
    return (
      <div className="grid max-w-[880px] gap-6">
        <table className="w-full border-collapse" aria-label="Spaltenzuordnung">
          <thead>
            <tr className="hairline">
              <th className="label h-8 w-5 text-left" />
              <th className="label h-8 text-left">Quellspalte</th>
              <th className="label h-8 text-left">Zielfeld</th>
              <th className="label h-8 text-right max-md:hidden">Beispiel</th>
            </tr>
          </thead>
          <tbody>
            {allgemein.kopf.map((k, j) => {
              const feld = state.mapping[j] ?? null
              const quelle = zelleZuText(k) ?? `Spalte ${j + 1}`
              return (
                <tr key={j} className="hairline h-10">
                  <td className="pr-2">
                    <Punkt erkannt={feld !== null} />
                  </td>
                  <td className={cn('text-ui pr-4', feld ? 'text-ink' : 'text-overdue')}>{quelle}</td>
                  <td className="w-[260px] py-1 pr-4">
                    <Select
                      aria-label={`Zielfeld für ${quelle}`}
                      optionen={optionen}
                      value={feld ?? ''}
                      onChange={(e) => api.setzeMapping(j, (e.target.value || null) as ZielFeld | null)}
                    />
                  </td>
                  <td className="text-ink-3 tnum max-w-[240px] truncate text-right font-mono text-[12.5px] max-md:hidden">
                    {beispiel(allgemein.zeilen, j) ?? '–'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Zuständig-Fallback"
            hinweis="Für Zeilen ohne Zuständigen – Standard: du."
            htmlFor="zustaendig-fallback"
          >
            <Select
              id="zustaendig-fallback"
              value={state.zustaendigFallback ?? ''}
              onChange={(e) => api.setzeZustaendigFallback(e.target.value || null)}
              optionen={[
                { value: '', label: 'Ich' },
                ...(members.data ?? []).map((m) => ({
                  value: m.id ?? '',
                  label: anzeigeName(m, '–'),
                })),
              ]}
            />
          </FormField>
          <FormField label="Datumsformat" hinweis="Wird beim Import nach ISO umgewandelt.">
            <p className="text-ui text-ink tnum h-9 pt-2 font-mono">{datumsformat(allgemein.zeilen)}</p>
          </FormField>
        </div>
        <p className="text-small text-ink-3">
          {fmtZahl(allgemein.rows.length)} Zeilen mit Name oder URL · {fmtZahl(allgemein.zeilen.length)} Zeilen in der
          Datei
        </p>
      </div>
    )
  }

  if (state.preset === 'crm_tabelle' && crm) {
    return (
      <div className="grid max-w-[880px] gap-5">
        <p className="text-ui text-ink-2">
          Tab <span className="text-ink">{crm.tab ?? '–'}</span> ·{' '}
          <span className="tnum font-mono">{fmtZahl(crm.rows.length)}</span> Zeilen ·{' '}
          <span className="tnum font-mono">{crm.spalten.filter((s) => s.erkannt).length}</span> von 24 Spalten erkannt
          {crm.fehlend.length > 0 ? <span className="text-overdue"> · fehlt: {crm.fehlend.join(', ')}</span> : null}
        </p>
        <table className="w-full border-collapse" aria-label="Erkannte Spalten">
          <thead>
            <tr className="hairline">
              <th className="label h-8 w-5 text-left" />
              <th className="label h-8 text-left">Quellspalte</th>
              <th className="label h-8 text-left">Key</th>
              <th className="label h-8 text-right max-md:hidden">Beispiel</th>
            </tr>
          </thead>
          <tbody>
            {crm.spalten.map((s, j) => (
              <tr key={j} className="hairline h-10">
                <td className="pr-2">
                  <Punkt erkannt={s.erkannt} />
                </td>
                <td className={cn('text-ui pr-4', s.erkannt ? 'text-ink' : 'text-overdue')}>{s.spalte}</td>
                <td className="text-ink-2 pr-4 font-mono text-[12.5px]">{s.key}</td>
                <td className="text-ink-3 tnum max-w-[240px] truncate text-right font-mono text-[12.5px] max-md:hidden">
                  {s.beispiel ?? '–'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (state.preset === 'kpi_monat' && kpi) {
    return (
      <div className="grid max-w-[880px] gap-5">
        <FormField label="Person" hinweis="Standard Vincent – das KPI-Sheet ist sein Dashboard." htmlFor="kpi-person">
          <Select
            id="kpi-person"
            value={state.person}
            onChange={(e) => api.setzePerson(e.target.value)}
            optionen={
              members.data && members.data.length > 0
                ? members.data.map((m) => ({ value: m.short_name ?? '', label: anzeigeName(m, '–') }))
                : [
                    { value: 'Vincent', label: 'Vincent' },
                    { value: 'Mike', label: 'Mike' },
                  ]
            }
          />
        </FormField>
        <ul className="border-line-strong rounded-md border" aria-label="Erkannte Monate">
          {kpi.months.map((m) => (
            <li key={m.tab} className="hairline flex min-h-12 items-center gap-4 px-4 py-2 last:border-b-0">
              <Punkt erkannt />
              <span className="text-ui text-ink min-w-0 flex-1">
                {m.tab}
                <span className="text-small text-ink-3 block">{m.title ?? m.person}</span>
              </span>
              <span className="text-ink-2 tnum font-mono text-[12.5px]">
                {m.month} · {m.sections.reduce((n, s) => n + s.metrics.length, 0)} Werte · {m.daily.length} Tage · Σ{' '}
                {fmtZahl(tagesSumme(m))}
              </span>
            </li>
          ))}
          {kpi.months.length === 0 ? (
            <li className="text-ui text-overdue px-4 py-3">Kein Tab „KPIs - MONAT JAHR“ gefunden.</li>
          ) : null}
        </ul>
        {kpi.uebersprungen.length > 0 ? (
          <p className="text-small text-ink-3">Übersprungen: {kpi.uebersprungen.join(' · ')}</p>
        ) : null}
      </div>
    )
  }

  if (state.preset === 'leitfaeden' && leitfaeden) {
    return (
      <div className="grid max-w-[880px] gap-5">
        <ul className="border-line-strong rounded-md border" aria-label="Erkannte Tabs">
          {leitfaeden.tabs.map((t) => (
            <li key={t.tab} className="hairline flex min-h-12 items-center gap-4 px-4 py-2 last:border-b-0">
              <Punkt erkannt={t.kopfErkannt} />
              <span className={cn('text-ui min-w-0 flex-1', t.kopfErkannt ? 'text-ink' : 'text-overdue')}>
                {t.tab}
                {!t.kopfErkannt ? (
                  <span className="text-small block">Kopfzeile „Leitfaden · Nachricht“ nicht gefunden</span>
                ) : null}
              </span>
              <Chip ton="muted">Phase {t.phase}</Chip>
              <span className="text-ink-2 tnum font-mono text-[12.5px]">{t.zeilen.length} Leitfäden</span>
            </li>
          ))}
        </ul>
        <p className="text-small text-ink-3">
          {fmtZahl(leitfaeden.rows.length)} Leitfäden
          {leitfaeden.ohneText > 0 ? ` · ${leitfaeden.ohneText} ohne Text (werden inaktiv)` : ''}
          {leitfaeden.uebersprungen.length > 0 ? ` · übersprungen: ${leitfaeden.uebersprungen.join(', ')}` : ''}
        </p>
      </div>
    )
  }

  return <p className="text-ui text-ink-2">Erst Preset und Datei wählen.</p>
}
