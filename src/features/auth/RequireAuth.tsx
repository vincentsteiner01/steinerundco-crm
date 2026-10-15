import { Navigate, Outlet, useLocation } from 'react-router'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuth } from './authStore'

/** Shell-Platzhalter während `laden` – kein Flackern zur Anmeldeseite. */
export function ShellSkeleton() {
  return (
    <div className="grid min-h-dvh grid-cols-[232px_1fr] max-lg:grid-cols-1" aria-busy>
      <aside className="border-line bg-canvas hidden border-r px-3 pt-[22px] lg:block">
        <Skeleton zeilen={6} />
      </aside>
      <main className="px-gutter pt-7">
        <Skeleton zeilen={4} />
      </main>
    </div>
  )
}

/** BAUPLAN § 3.1.7 / § 1.5 Nr. 31: anonym → `/anmelden?von=<pathname+search>` (kein state.von). */
export function RequireAuth() {
  const status = useAuth((s) => s.status)
  const location = useLocation()
  if (status === 'laden') return <ShellSkeleton />
  if (status === 'anonym') {
    const von = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/anmelden?von=${von}`} replace />
  }
  return <Outlet />
}
