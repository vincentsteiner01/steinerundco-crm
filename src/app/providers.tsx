// BAUPLAN § 3.1.5 – QueryClientProvider, TooltipProvider (400 ms), Toaster (sonner, bottom-right, eigene Klassen), Online-Status, Auth-Init.
import { QueryClientProvider } from '@tanstack/react-query'
import { useEffect, type ReactNode } from 'react'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { queryClient } from '@/data/queryClient'
import { useRealtimeSync } from '@/data/realtime'
import { useAuth } from '@/features/auth/authStore'
import { useUiStore } from './uiStore'

/** Ein Realtime-Kanal `crm:sync` je Sitzung (E17, § 3.1.6) – nur als Mitglied aktiv, Status → uiStore.realtime. */
function RealtimeSync() {
  useRealtimeSync()
  return null
}

function OnlineSync() {
  const setOnline = useUiStore((s) => s.setOnline)
  useEffect(() => {
    const an = () => setOnline(true)
    const aus = () => setOnline(false)
    window.addEventListener('online', an)
    window.addEventListener('offline', aus)
    return () => {
      window.removeEventListener('online', an)
      window.removeEventListener('offline', aus)
    }
  }, [setOnline])
  return null
}

function AuthInit() {
  const init = useAuth((s) => s.init)
  useEffect(() => init(), [init])
  return null
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={400} skipDelayDuration={200}>
        <AuthInit />
        <OnlineSync />
        <RealtimeSync />
        {children}
        <Toaster
          position="bottom-right"
          offset={24}
          mobileOffset={16}
          gap={8}
          visibleToasts={2}
          expand
          toastOptions={{ unstyled: true, classNames: { toast: 'toast-root' } }}
        />
      </TooltipProvider>
    </QueryClientProvider>
  )
}
