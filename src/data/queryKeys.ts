// BAUPLAN § 3.1.6 (vollständig, wörtlich). Eigene Keys in Modulen nur als Verlängerung: [...qk.leads.all, 'meinModul', …]
import type { LeadFilter } from '@/types/domain'

export const qk = {
  members: ['members'] as const,
  settings: ['settings'] as const,
  templates: { all: ['templates'] as const, perf: ['templates', 'perf'] as const },
  sequences: ['sequences'] as const,
  leads: {
    all: ['leads'] as const,
    liste: (f: LeadFilter, seite: number) => ['leads', 'liste', f, seite] as const,
    detail: (id: string) => ['leads', 'detail', id] as const,
    suche: (q: string) => ['leads', 'suche', q] as const,
    dublette: (url?: string, phone?: string, email?: string) => ['leads', 'dublette', url, phone, email] as const,
    ohneBewegung: ['leads', 'ohne-bewegung'] as const,
    pipeline: ['leads', 'pipeline'] as const,
  },
  activities: (leadId: string) => ['activities', leadId] as const,
  activitiesZeitraum: (m: string, von: string, bis: string, types: readonly string[]) =>
    ['activities', 'zeitraum', m, von, bis, [...types].sort().join(',')] as const,
  queue: { all: ['queue'] as const, member: (m: string | null, tag: string) => ['queue', m, tag] as const },
  connections: {
    lead: (id: string) => ['connections', 'lead', id] as const,
    offen: (m: string) => ['connections', 'offen', m] as const,
  },
  enrollments: (leadId: string) => ['enrollments', leadId] as const,
  // Integration M1–M8 (FOUNDATION-WUNSCH M3/M8): Kanal-Listen und Zähler je Sequenz – Präfix ['enrollments'] bleibt.
  enrollmentsKanal: (kanal: string, m: string | null) => ['enrollments', 'kanal', kanal, m ?? 'alle'] as const,
  enrollmentsLaufend: ['enrollments', 'laufend'] as const,
  tasks: {
    lead: (id: string) => ['tasks', 'lead', id] as const,
    faellig: (m: string) => ['tasks', 'faellig', m] as const,
    /** Integration (FOUNDATION-WUNSCH M3): alle offenen Rückrufe (auch künftige) – Präfix ['tasks', 'faellig']. */
    rueckrufeOffen: (m: string | null) => ['tasks', 'faellig', m ?? 'alle', 'rueckrufe-offen'] as const,
  },
  meetings: {
    lead: (id: string) => ['meetings', 'lead', id] as const,
    member: (m: string) => ['meetings', 'member', m] as const,
  },
  calls: {
    lead: (id: string) => ['calls', 'lead', id] as const,
    session: (s: string) => ['calls', 'session', s] as const,
    heute: (m: string) => ['calls', 'heute', m] as const,
    zeitraum: (m: string, von: string, bis: string) => ['calls', 'zeitraum', m, von, bis] as const,
    /** Integration (FOUNDATION-WUNSCH M3): letzter Anruf je Lead der Anrufliste, `ids` sortiert und mit Komma verbunden. */
    letzte: (ids: string) => ['calls', 'letzte', ids] as const,
    /** Integration (FOUNDATION-WUNSCH M3/M5): Stammdaten `call_outcome_defs`. */
    outcomeDefs: ['calls', 'outcome-defs'] as const,
  },
  emails: {
    lead: (id: string) => ['emails', 'lead', id] as const,
    status: (m: string, s: string[]) => ['emails', 'status', m, s] as const,
    zeitraum: (m: string, von: string, bis: string) => ['emails', 'zeitraum', m, von, bis] as const,
  },
  counters: (m: string, von: string, bis: string) => ['counters', m, von, bis] as const,
  kpis: {
    all: ['kpis'] as const,
    funnel: (m: string, k: string) => ['kpis', 'funnel', m, k] as const,
    zeitraum: (m: string, von: string, bis: string) => ['kpis', 'zeitraum', m, von, bis] as const,
    antwortzeit: (m: string, von: string, bis: string) => ['kpis', 'antwortzeit', m, von, bis] as const,
  },
  views: (entity: string) => ['views', entity] as const,
  imports: { all: ['imports'] as const, detail: (id: string) => ['imports', id] as const },
  sperrliste: ['sperrliste'] as const,
  tags: ['tags'] as const,
  companies: ['companies'] as const,
  nav: ['nav'] as const,
  feedback: ['feedback'] as const,
} as const
