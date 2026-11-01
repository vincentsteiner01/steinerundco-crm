// Mailing (Migrationen 21/22, 01.11.2026): Domains, Postfächer, Kampagnen, Empfänger, Antworten, Platzierungstests.
// Die Regeln (Erlaubnis-Gate, Hochlauf, Limits) erzwingt die Datenbank bzw. der Mail-Motor; diese Hooks lesen und rufen auf.
// Nur von den Mailing-Seiten importiert (nicht über data/index.ts) – das Start-Bundle bleibt unberührt.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Database, Json } from '@/types/database'
import { pruefe } from './_helfer'
import { mutationFehler } from './errors'
import { qk } from './queryKeys'
import { supabase } from './supabase'

type Tabellen = Database['crm']['Tables']
type Ansichten = Database['crm']['Views']
export type MailDomain = Tabellen['mail_domains']['Row']
export type Postfach = Ansichten['v_mail_postfaecher']['Row']
export type KampagneZahlen = Ansichten['v_mail_kampagnen']['Row']
export type Kampagne = Tabellen['mail_kampagnen']['Row']
export type Schritt = Tabellen['mail_schritte']['Row'] & { mail_varianten: Tabellen['mail_varianten']['Row'][] }
export type VarianteZahlen = Ansichten['v_mail_varianten']['Row']
export type PlatzierungsTest = Ansichten['v_mail_tests']['Row']
export type AnbieterZahlen = Ansichten['v_mail_anbieter']['Row']
export type Empfaenger = Tabellen['mail_empfaenger']['Row'] & {
  leads: { first_name: string | null; last_name: string | null; company_name: string | null } | null
}
export type Eingang = Pick<
  Tabellen['emails']['Row'],
  | 'id'
  | 'lead_id'
  | 'subject'
  | 'body_text'
  | 'from_address'
  | 'to_address'
  | 'sent_at'
  | 'hinweis'
  | 'label'
  | 'gelesen_at'
  | 'erledigt_at'
  | 'kampagne_id'
  | 'postfach_id'
  | 'in_reply_to'
> & {
  leads: { first_name: string | null; last_name: string | null; company_name: string | null; stage: string } | null
}
export type VerlaufMail = Pick<
  Tabellen['emails']['Row'],
  'id' | 'direction' | 'subject' | 'body_text' | 'sent_at' | 'status' | 'from_address' | 'to_address' | 'created_at'
>
export type MailLead = Pick<
  Tabellen['leads']['Row'],
  | 'id'
  | 'first_name'
  | 'last_name'
  | 'company_name'
  | 'email'
  | 'email_consent_basis'
  | 'email_consent_at'
  | 'stage'
  | 'city'
>

const KEY = ['mailing'] as const

function useInvalidieren() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: KEY })
    void qc.invalidateQueries({ queryKey: qk.leads.all })
  }
}

// ---------------------------------------------------------------- Lesen
export function usePostfaecher() {
  return useQuery({
    queryKey: [...KEY, 'postfaecher'],
    refetchInterval: 60_000,
    queryFn: async (): Promise<Postfach[]> =>
      pruefe(await supabase.from('v_mail_postfaecher').select('*').order('rolle').order('adresse')),
  })
}

export function useDomains() {
  return useQuery({
    queryKey: [...KEY, 'domains'],
    queryFn: async (): Promise<MailDomain[]> => pruefe(await supabase.from('mail_domains').select('*').order('domain')),
  })
}

export function useKampagnen() {
  return useQuery({
    queryKey: [...KEY, 'kampagnen'],
    refetchInterval: 60_000,
    queryFn: async (): Promise<KampagneZahlen[]> =>
      pruefe(await supabase.from('v_mail_kampagnen').select('*').order('created_at', { ascending: false })),
  })
}

export function useKampagne(id: string | null | undefined) {
  return useQuery({
    queryKey: [...KEY, 'kampagne', id],
    enabled: !!id,
    queryFn: async () => {
      const [k, s, p] = await Promise.all([
        supabase
          .from('v_mail_kampagnen')
          .select('*')
          .eq('id', id as string)
          .limit(1),
        supabase
          .from('mail_schritte')
          .select('*, mail_varianten(*)')
          .eq('kampagne_id', id as string)
          .order('position'),
        supabase
          .from('mail_kampagne_postfaecher')
          .select('postfach_id')
          .eq('kampagne_id', id as string),
      ])
      const kampagne = (pruefe(k) as KampagneZahlen[])[0] ?? null
      const schritte = (pruefe(s) as Schritt[]).map((x) => ({
        ...x,
        mail_varianten: [...x.mail_varianten].sort((a, b) => a.kennung.localeCompare(b.kennung)),
      }))
      const postfaecher = (pruefe(p) as { postfach_id: string }[]).map((x) => x.postfach_id)
      return { kampagne, schritte, postfaecher }
    },
  })
}

export function useVariantenZahlen(kampagneId: string | null | undefined) {
  return useQuery({
    queryKey: [...KEY, 'varianten', kampagneId],
    enabled: !!kampagneId,
    queryFn: async (): Promise<VarianteZahlen[]> =>
      pruefe(
        await supabase
          .from('v_mail_varianten')
          .select('*')
          .eq('kampagne_id', kampagneId as string),
      ),
  })
}

export function useEmpfaenger(kampagneId: string | null | undefined) {
  return useQuery({
    queryKey: [...KEY, 'empfaenger', kampagneId],
    enabled: !!kampagneId,
    queryFn: async (): Promise<Empfaenger[]> =>
      pruefe(
        await supabase
          .from('mail_empfaenger')
          .select('*, leads(first_name, last_name, company_name)')
          .eq('kampagne_id', kampagneId as string)
          .order('nr')
          .range(0, 1999),
      ) as Empfaenger[],
  })
}

/** Leads mit E-Mail-Adresse (Auswahl für Kampagnen) – die Erlaubnis-Grundlage steht dabei. */
export function useMailLeads() {
  return useQuery({
    queryKey: [...KEY, 'leads'],
    staleTime: 60_000,
    queryFn: async (): Promise<MailLead[]> =>
      pruefe(
        await supabase
          .from('leads')
          .select('id, first_name, last_name, company_name, email, email_consent_basis, email_consent_at, stage, city')
          .is('deleted_at', null)
          .not('email', 'is', null)
          .order('updated_at', { ascending: false })
          .range(0, 1999),
      ),
  })
}

export function useAntworten() {
  return useQuery({
    queryKey: [...KEY, 'antworten'],
    refetchInterval: 60_000,
    queryFn: async (): Promise<Eingang[]> =>
      pruefe(
        await supabase
          .from('emails')
          .select(
            'id, lead_id, subject, body_text, from_address, to_address, sent_at, hinweis, label, gelesen_at, erledigt_at, kampagne_id, postfach_id, in_reply_to, leads(first_name, last_name, company_name, stage)',
          )
          .eq('direction', 'in')
          .not('postfach_id', 'is', null)
          .order('sent_at', { ascending: false })
          .range(0, 299),
      ) as Eingang[],
  })
}

/** Verlauf eines Leads über die Mail-Postfächer (eigene Mails + Antworten), älteste zuerst. */
export function useMailVerlauf(leadId: string | null | undefined) {
  return useQuery({
    queryKey: [...KEY, 'verlauf', leadId],
    enabled: !!leadId,
    queryFn: async (): Promise<VerlaufMail[]> =>
      pruefe(
        await supabase
          .from('emails')
          .select('id, direction, subject, body_text, sent_at, status, from_address, to_address, created_at')
          .eq('lead_id', leadId as string)
          .not('postfach_id', 'is', null)
          .order('created_at')
          .range(0, 49),
      ),
  })
}

export function usePlatzierungsTests() {
  return useQuery({
    queryKey: [...KEY, 'tests'],
    refetchInterval: (q) => (q.state.data?.some((t) => (t.offen ?? 0) > 0) ? 20_000 : false),
    queryFn: async (): Promise<PlatzierungsTest[]> =>
      pruefe(await supabase.from('v_mail_tests').select('*').order('gestartet_at', { ascending: false }).range(0, 9)),
  })
}

export function useAnbieterZahlen() {
  return useQuery({
    queryKey: [...KEY, 'anbieter'],
    queryFn: async (): Promise<AnbieterZahlen[]> => pruefe(await supabase.from('v_mail_anbieter').select('*')),
  })
}

export function useSperrdomains() {
  return useQuery({
    queryKey: [...KEY, 'sperrdomains'],
    queryFn: async () => pruefe(await supabase.from('mail_sperrdomains').select('*').order('domain')),
  })
}

// ---------------------------------------------------------------- Schreiben
export type PostfachEingabe = {
  id?: string
  adresse?: string
  absender_name?: string
  member_id?: string | null
  anbieter?: string
  rolle?: 'versand' | 'saat'
  smtp_host?: string | null
  smtp_port?: number | null
  smtp_sicherheit?: 'ssl' | 'starttls' | null
  imap_host?: string
  benutzer?: string
  signatur?: string | null
  tageslimit?: number
  hochlauf?: boolean
}

export function usePostfachSpeichern() {
  const inval = useInvalidieren()
  return useMutation({
    mutationFn: async (p: { daten: PostfachEingabe; passwort?: string | null }) =>
      pruefe(
        await supabase.rpc('mail_postfach_speichern', {
          p: p.daten as unknown as Json,
          p_passwort: p.passwort || undefined,
        }),
      ) as unknown as { id: string },
    onSettled: inval,
  })
}

export type TestErgebnis = {
  ok: boolean
  fehler?: string | null
  imap?: { ok: boolean; spam: string | null; gesendet: string | null }
  smtp?: { ok: boolean } | null
}

/** „Verbindung testen“ – Edge Function mail-motor/test meldet sich mit dem Passwort aus dem Vault an. */
export function usePostfachTesten() {
  const inval = useInvalidieren()
  return useMutation({
    mutationFn: async (postfachId: string): Promise<TestErgebnis> => {
      const { data, error } = await supabase.functions.invoke('mail-motor/test', { body: { postfach_id: postfachId } })
      if (error) throw error
      return data as TestErgebnis
    },
    onError: mutationFehler,
    onSettled: inval,
  })
}

export function useTestmail() {
  return useMutation({
    mutationFn: async (p: { postfachId: string; an: string }): Promise<{ ok: boolean; fehler?: string }> => {
      const { data, error } = await supabase.functions.invoke('mail-motor/testmail', {
        body: { postfach_id: p.postfachId, an: p.an },
      })
      if (error) throw error
      return data as { ok: boolean; fehler?: string }
    },
    onError: mutationFehler,
  })
}

export function usePostfachAendern() {
  const inval = useInvalidieren()
  return useMutation({
    mutationFn: async (p: {
      id: string
      werte: Partial<
        Pick<
          Tabellen['mail_postfaecher']['Update'],
          'status' | 'tageslimit' | 'hochlauf' | 'signatur' | 'absender_name' | 'member_id' | 'mindestabstand_min'
        >
      >
    }) => {
      pruefe(await supabase.from('mail_postfaecher').update(p.werte).eq('id', p.id).select('id'))
    },
    onError: mutationFehler,
    onSettled: inval,
  })
}

export function usePostfachLoeschen() {
  const inval = useInvalidieren()
  return useMutation({
    mutationFn: async (id: string) => {
      pruefe(await supabase.from('mail_postfaecher').delete().eq('id', id).select('id'))
    },
    onError: mutationFehler,
    onSettled: inval,
  })
}

export function useDomainSpeichern() {
  const inval = useInvalidieren()
  return useMutation({
    mutationFn: async (
      d: Pick<
        Tabellen['mail_domains']['Insert'],
        'domain' | 'anbieter' | 'registriert_am' | 'zweck' | 'dns' | 'dns_geprueft_at' | 'website' | 'notiz'
      >,
    ) => pruefe(await supabase.from('mail_domains').upsert(d, { onConflict: 'domain' }).select('*')),
    onError: mutationFehler,
    onSettled: inval,
  })
}

export function useDomainLoeschen() {
  const inval = useInvalidieren()
  return useMutation({
    mutationFn: async (id: string) => {
      pruefe(await supabase.from('mail_domains').delete().eq('id', id).select('id'))
    },
    onError: mutationFehler,
    onSettled: inval,
  })
}

export type KampagneEingabe = {
  id?: string
  name: string
  zeitplan?: { tage: number[]; von: string; bis: string }
  tageslimit?: number
  neue_pro_tag?: number
  stopp_firma?: boolean
  abmelde_satz?: boolean
  abmelde_kopf?: boolean
  datenschutz_satz?: boolean
  bounce_schutz?: boolean
  notiz?: string | null
  postfaecher?: string[]
  schritte?: {
    wartetage: number
    im_thread: boolean
    varianten: { kennung: string; betreff: string; text: string; aktiv: boolean }[]
  }[]
}

export function useKampagneSpeichern() {
  const inval = useInvalidieren()
  return useMutation({
    mutationFn: async (k: KampagneEingabe): Promise<string> =>
      pruefe(await supabase.rpc('mail_kampagne_speichern', { p: k as unknown as Json })) as unknown as string,
    onError: mutationFehler,
    onSettled: inval,
  })
}

export function useKampagneStatus() {
  const inval = useInvalidieren()
  return useMutation({
    mutationFn: async (p: { id: string; status: 'aktiv' | 'pausiert' | 'beendet' }) =>
      pruefe(await supabase.rpc('mail_kampagne_status', { p_kampagne: p.id, p_status: p.status })),
    onError: mutationFehler,
    onSettled: inval,
  })
}

export function useKampagneLoeschen() {
  const inval = useInvalidieren()
  return useMutation({
    mutationFn: async (id: string) => {
      pruefe(await supabase.from('mail_kampagnen').delete().eq('id', id).select('id'))
    },
    onError: mutationFehler,
    onSettled: inval,
  })
}

export function useEmpfaengerHinzufuegen() {
  const inval = useInvalidieren()
  return useMutation({
    mutationFn: async (p: { kampagne: string; leads: string[] }) =>
      pruefe(
        await supabase.rpc('mail_empfaenger_hinzufuegen', { p_kampagne: p.kampagne, p_leads: p.leads }),
      ) as unknown as {
        neu: number
        ohne_adresse: number
        gesperrt: number
      },
    onError: mutationFehler,
    onSettled: inval,
  })
}

export function useEmpfaengerEntfernen() {
  const inval = useInvalidieren()
  return useMutation({
    mutationFn: async (id: string) => {
      pruefe(await supabase.from('mail_empfaenger').delete().eq('id', id).select('id'))
    },
    onError: mutationFehler,
    onSettled: inval,
  })
}

export function useKampagnePruefen(kampagneId: string | null | undefined) {
  return useQuery({
    queryKey: [...KEY, 'pruefen', kampagneId],
    enabled: !!kampagneId,
    queryFn: async (): Promise<{ empfaenger_id: string; grund: string }[]> =>
      pruefe(await supabase.rpc('mail_kampagne_pruefen', { p_kampagne: kampagneId as string })),
  })
}

export function useAntwortSenden() {
  const inval = useInvalidieren()
  return useMutation({
    mutationFn: async (p: { eingang: string; text: string }) =>
      pruefe(await supabase.rpc('mail_antworten', { p_eingang: p.eingang, p_text: p.text })),
    onError: mutationFehler,
    onSettled: inval,
  })
}

export function useEingangMarkieren() {
  const inval = useInvalidieren()
  return useMutation({
    mutationFn: async (p: {
      id: string
      werte: Partial<Pick<Tabellen['emails']['Update'], 'gelesen_at' | 'erledigt_at' | 'label'>>
    }) => {
      pruefe(await supabase.from('emails').update(p.werte).eq('id', p.id).select('id'))
    },
    onError: mutationFehler,
    onSettled: inval,
  })
}

export function usePlatzierungStarten() {
  const inval = useInvalidieren()
  return useMutation({
    mutationFn: async (p: { postfach: string; betreff: string; text: string }) =>
      pruefe(
        await supabase.rpc('mail_platzierung_starten', {
          p_postfach: p.postfach,
          p_betreff: p.betreff,
          p_text: p.text,
        }),
      ),
    onError: mutationFehler,
    onSettled: inval,
  })
}

export function useSperrdomainSetzen() {
  const inval = useInvalidieren()
  return useMutation({
    mutationFn: async (p: { domain: string; grund?: string; weg?: boolean }) => {
      if (p.weg) pruefe(await supabase.from('mail_sperrdomains').delete().eq('domain', p.domain).select('domain'))
      else
        pruefe(
          await supabase
            .from('mail_sperrdomains')
            .upsert({ domain: p.domain, grund: p.grund ?? null })
            .select('domain'),
        )
    },
    onError: mutationFehler,
    onSettled: inval,
  })
}

/** Abmelden per Link (Seite /abmelden, ohne Anmeldung). */
export async function abmelden(token: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('mail_abmelden', { p_token: token })
  if (error) throw error
  return data === true
}
