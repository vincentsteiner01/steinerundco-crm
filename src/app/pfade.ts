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
  hilfe: (thema?: string) => (thema ? `/hilfe/${thema}` : '/hilfe'),
  // 25.11.2026: fünf Bereiche. Ziele, Sequenzen und Verbindungen sind entfallen – die Seite leitet die alten Adressen aufs Profil
  einstellungen: (bereich: 'profil' | 'passcode' | 'sperrliste' | 'feiertage' | 'export' = 'profil') =>
    `/einstellungen/${bereich}`,
} as const
