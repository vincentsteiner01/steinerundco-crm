// architektur § 3.3 (Auth-Store und Mitglieder-Prüfung) – BAUPLAN § 3.1.7
import type { Session } from '@supabase/supabase-js'
import { create } from 'zustand'
import { queryClient } from '@/data/queryClient'
import { members, supabase } from '@/data/supabase'
import { toastFehler } from '@/components/toast'
import { TOAST } from '@/texte/de'

export type AuthMember = { user_id: string; email: string; display_name: string }
export type AuthStatus = 'laden' | 'anonym' | 'mitglied'

export type AuthState = {
  status: AuthStatus
  session: Session | null
  member: AuthMember | null
  init: () => () => void
  abmelden: (ueberall?: boolean) => Promise<void>
}

export const useAuth = create<AuthState>((set) => ({
  status: 'laden',
  session: null,
  member: null,
  init() {
    void supabase.auth.getSession().then(({ data }) => uebernehmen(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        set({ status: 'anonym', session: null, member: null })
        queryClient.clear()
        void supabase.removeAllChannels()
        return
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') void uebernehmen(session)
    })
    return () => sub.subscription.unsubscribe()
  },
  async abmelden(ueberall = false) {
    await supabase.auth.signOut({ scope: ueberall ? 'global' : 'local' })
    set({ status: 'anonym', session: null, member: null })
    queryClient.clear()
    void supabase.removeAllChannels()
  },
}))

async function uebernehmen(session: Session | null, nachRefresh = false): Promise<void> {
  if (!session) {
    useAuth.setState({ status: 'anonym', session: null, member: null })
    return
  }
  const aktuell = useAuth.getState()
  if (aktuell.status === 'mitglied' && aktuell.member?.user_id === session.user.id) {
    useAuth.setState({ session })
    return
  }
  // Session da, Mitgliedschaft noch offen: `laden` statt `anonym`, sonst springt RequireAuth nach dem Login kurz zurück nach /anmelden
  useAuth.setState({ status: 'laden', session })
  const { data: member, error } = await members()
    .select('user_id,email,display_name')
    .eq('user_id', session.user.id)
    .maybeSingle()
  if (error) {
    // 401/Netz/abgelaufenes Token sind KEIN „kein Mitglied“: nicht abmelden – signOut beendet die Sitzung serverseitig, auch in
    // anderen Tabs mit derselben Sitzung (Runde 2, feedback.md Nr. 4). Einmal auffrischen und erneut prüfen, sonst nur lokal anonym.
    if (!nachRefresh) {
      const { data } = await supabase.auth.refreshSession().catch(() => ({ data: { session: null } }))
      if (data.session) return uebernehmen(data.session, true)
    }
    useAuth.setState({ status: 'anonym', session: null, member: null })
    return
  }
  if (!member) {
    // angemeldet, aber nicht in public.members → raus
    await supabase.auth.signOut({ scope: 'local' })
    useAuth.setState({ status: 'anonym', session: null, member: null })
    toastFehler(TOAST.keinZugriff)
    return
  }
  useAuth.setState({ status: 'mitglied', session, member: member as AuthMember })
}
