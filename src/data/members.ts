// BAUPLAN § 3.1.6 members.ts: useMembers() (View crm.members), useMe(), useAndere().
// Integration (FOUNDATION-WUNSCH M8): Schreibpfad `member_profiles` (useProfilSpeichern) + Lesen/Mergen von `preferences`.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/authStore'
import type { Database, Json } from '@/types/database'
import type { Member } from '@/types/domain'
import { pruefe } from './_helfer'
import { mutationFehler } from './errors'
import { qk } from './queryKeys'
import { supabase } from './supabase'

export type MemberProfileUpsert = Database['crm']['Tables']['member_profiles']['Insert']
export type MemberProfileRow = Database['crm']['Tables']['member_profiles']['Row']

export async function ladeMembers(): Promise<Member[]> {
  return pruefe(await supabase.from('members').select('*').order('display_name'))
}

export function useMembers() {
  return useQuery({ queryKey: qk.members, queryFn: ladeMembers, staleTime: 5 * 60_000 })
}

/** Die angemeldete Person als Member (View-Zeile); `undefined`, solange die Liste lädt. */
export function useMe(): Member | undefined {
  const me = useAuth((s) => s.member?.user_id ?? null)
  const { data } = useMembers()
  return data?.find((m) => m.id === me)
}

/** Die andere Person (Team von zwei). */
export function useAndere(): Member | undefined {
  const me = useAuth((s) => s.member?.user_id ?? null)
  const { data } = useMembers()
  return data?.find((m) => m.id !== me)
}

/** Nur die ID der angemeldeten Person (ohne Netz). */
export function useMeId(): string | null {
  return useAuth((s) => s.member?.user_id ?? null)
}

/** `member_profiles.preferences` – gelesen mit Standardwerten (alles an). */
export type Preferences = {
  kanaele: { linkedin: boolean; telefon: boolean; email: boolean }
  realtime_toasts: boolean
}

const istObjekt = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const bool = (v: unknown, standard: boolean): boolean => (typeof v === 'boolean' ? v : standard)

export function liesPreferences(json: Json | null | undefined): Preferences {
  const o = istObjekt(json) ? json : {}
  const k = istObjekt(o['kanaele']) ? o['kanaele'] : {}
  return {
    kanaele: {
      linkedin: bool(k['linkedin'], true),
      telefon: bool(k['telefon'], true),
      email: bool(k['email'], true),
    },
    realtime_toasts: bool(o['realtime_toasts'], true),
  }
}

/** Bisherige `preferences` (unbekannte Keys bleiben) + neue Werte. */
export function mergePreferences(alt: Json | null | undefined, neu: Preferences): Json {
  const o = istObjekt(alt) ? alt : {}
  return { ...o, kanaele: { ...neu.kanaele }, realtime_toasts: neu.realtime_toasts } as Json
}

/** Profilwerte aus der View-Zeile (`crm.members`) als Upsert-Vorlage. */
export function profilAusMember(m: Member): MemberProfileUpsert {
  return {
    member_id: m.id as string,
    short_name: m.short_name,
    linkedin_plan: m.linkedin_plan ?? 'basic',
    weekly_budget: m.weekly_budget ?? 0,
    daily_target: m.daily_target ?? 0,
    caller_number_e164: m.caller_number_e164,
    signature: m.signature,
    calendly_url: m.calendly_url,
    email_address: m.email_address,
    linkedin_url: m.linkedin_url,
    preferences: m.preferences ?? {},
  }
}

/** Upsert der eigenen `member_profiles`-Zeile (Profil, Ziele, Preferences); invalidiert `qk.members`. */
export function useProfilSpeichern() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: MemberProfileUpsert): Promise<MemberProfileRow> =>
      pruefe(
        await supabase
          .from('member_profiles')
          .upsert({ ...p, updated_at: new Date().toISOString() }, { onConflict: 'member_id' })
          .select('*')
          .single(),
      ),
    onError: mutationFehler,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.members })
    },
  })
}
