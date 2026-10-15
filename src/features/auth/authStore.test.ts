// Runde 2 (feedback.md Nr. 4): Ein Fehler der Mitglieder-Abfrage (401, Netz, abgelaufenes Token) meldet NICHT ab –
// nur „angemeldet, aber kein Mitglied“ tut das (mit Toast „keinen Zugriff“).
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  antwort: { data: null as unknown, error: null as unknown },
  signOut: vi.fn(async () => ({ error: null })),
  refreshSession: vi.fn(async () => ({ data: { session: null as unknown } })),
  toastFehler: vi.fn(),
}))

const SESSION = { access_token: 'a', user: { id: 'u1' } }

vi.mock('@/data/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: SESSION } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: m.signOut,
      refreshSession: m.refreshSession,
    },
    removeAllChannels: vi.fn(),
  },
  members: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => m.antwort }) }) }),
}))
vi.mock('@/data/queryClient', () => ({ queryClient: { clear: vi.fn() } }))
vi.mock('@/components/toast', () => ({ toastFehler: m.toastFehler }))

import { useAuth } from './authStore'

const warte = () => new Promise((r) => setTimeout(r, 0))

describe('authStore.uebernehmen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.setState({ status: 'laden', session: null, member: null })
  })

  it('401 bei der Mitglieder-Abfrage: kein signOut, kein Toast, einmal auffrischen, dann lokal anonym', async () => {
    m.antwort = { data: null, error: { status: 401, code: 'PGRST301', message: 'JWT expired' } }
    const aus = useAuth.getState().init()
    await warte()
    await warte()
    expect(m.refreshSession).toHaveBeenCalledTimes(1)
    expect(m.signOut).not.toHaveBeenCalled()
    expect(m.toastFehler).not.toHaveBeenCalled()
    expect(useAuth.getState().status).toBe('anonym')
    aus()
  })

  it('kein Mitglied (ohne Fehler): abmelden und „keinen Zugriff“ zeigen', async () => {
    m.antwort = { data: null, error: null }
    const aus = useAuth.getState().init()
    await warte()
    await warte()
    expect(m.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(m.toastFehler).toHaveBeenCalledTimes(1)
    aus()
  })

  it('Mitglied: Status „mitglied“', async () => {
    m.antwort = { data: { user_id: 'u1', email: 'v@x.de', display_name: 'Vincent' }, error: null }
    const aus = useAuth.getState().init()
    await warte()
    await warte()
    expect(useAuth.getState().status).toBe('mitglied')
    expect(m.signOut).not.toHaveBeenCalled()
    aus()
  })
})
