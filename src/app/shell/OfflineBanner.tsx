import { useEffect, useRef } from 'react'
import { useUiStore } from '@/app/uiStore'
import { toast } from '@/components/toast'
import { ALLGEMEIN, TOAST } from '@/texte/de'

/** DESIGN-SYSTEM § 5.22: 36 px, surface-raised, Haarlinie unten, Text ui, links 6-px-Punkt Amber. v1: nur Anzeige (§ 1.5 Nr. 11). */
export function OfflineBanner() {
  const online = useUiStore((s) => s.online)
  const warOffline = useRef(false)
  useEffect(() => {
    if (!online) warOffline.current = true
    else if (warOffline.current) {
      warOffline.current = false
      toast(TOAST.wiederOnline(0))
    }
  }, [online])
  if (online) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className="border-line bg-surface-raised px-gutter text-ui sticky top-0 z-30 flex h-9 items-center gap-2.5 border-b"
    >
      <i aria-hidden className="bg-overdue h-1.5 w-1.5 flex-none rounded-full" />
      <span>{ALLGEMEIN.offlineBanner}</span>
    </div>
  )
}
