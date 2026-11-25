// BAUPLAN § 3.1.4 – Module verlinken nur über PFADE (auch aus router.tsx re-exportiert).
// Neustart 25.11.2026: Es gibt nur noch Leads (Board), Leitfäden, E-Mail, Team, Einstellungen, Hilfe. Alte Adressen
// (/pipeline, /telefon, /kpis …) kennt nur noch der Router – er leitet sie um.
export const PFADE = {
  anmelden: '/anmelden',
  leads: '/leads',
  /** Lead-Blatt über dem Board (die Hülle öffnet es aus `?lead=` auf jeder Seite) */
  lead: (id: string) => `/leads?lead=${encodeURIComponent(id)}`,
  email: '/email',
  emailVerfassen: '/email/verfassen',
  // Mailing (01.11.2026): Kampagnen, Antworten (Unibox), Postfächer
  emailKampagnen: '/email/kampagnen',
  emailKampagne: (id: string) => `/email/kampagnen/${id}`,
  emailAntworten: '/email/antworten',
  emailPostfaecher: '/email/postfaecher',
  leitfaeden: '/leitfaeden',
  team: '/team',
  hilfe: (thema?: string) => (thema ? `/hilfe/${thema}` : '/hilfe'),
  // Runde 3: 'verbindungen' (LinkedIn-Brücke, Eingang – Wunsch verbindungen.md Nr. 2)
  einstellungen: (
    bereich: 'profil' | 'passcode' | 'ziele' | 'sequenzen' | 'sperrliste' | 'export' | 'verbindungen' = 'profil',
  ) => `/einstellungen/${bereich}`,
} as const
