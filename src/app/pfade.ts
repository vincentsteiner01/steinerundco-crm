// BAUPLAN § 3.1.4 – Module verlinken nur über PFADE (auch aus router.tsx re-exportiert).
export const PFADE = {
  anmelden: '/anmelden',
  heute: '/heute',
  leads: '/leads',
  leadNeu: '/leads/neu',
  papierkorb: '/leads/papierkorb',
  lead: (id: string) => `/leads/${id}`,
  pipeline: '/pipeline',
  telefon: '/telefon',
  anruf: (leadId: string) => `/telefon/anruf/${leadId}`,
  email: '/email',
  emailVerfassen: '/email/verfassen',
  kpis: '/kpis',
  leitfaeden: '/leitfaeden',
  leitfaden: (id: string) => `/leitfaeden/${id}`,
  /** Neuer Leitfaden (Kennung `neu` auf `/leitfaeden/:id`, M6) – optional mit Kanal-Vorbelegung */
  leitfadenNeu: (kanal?: string) => (kanal ? `/leitfaeden/neu?kanal=${encodeURIComponent(kanal)}` : '/leitfaeden/neu'),
  import: '/import',
  schnellimport: (zurueck?: string) =>
    zurueck ? `/import/schnell?zurueck=${encodeURIComponent(zurueck)}` : '/import/schnell',
  importErgebnis: (batchId: string) => `/import/${batchId}`,
  team: '/team',
  hilfe: (thema?: string) => (thema ? `/hilfe/${thema}` : '/hilfe'),
  feedback: '/feedback',
  einstellungen: (bereich: 'profil' | 'passcode' | 'ziele' | 'sequenzen' | 'sperrliste' | 'export' = 'profil') =>
    `/einstellungen/${bereich}`,
} as const
