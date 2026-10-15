import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { registerSW } from 'virtual:pwa-register'
import { sonnerToast } from '@/components/toast'
import { TOAST } from '@/texte/de'
import { Providers } from './app/providers'
import { router } from './app/router'
import './styles/index.css'

// Service Worker: Registrierung hier statt Inline-Script (CSP, architektur § 7.1)
const updateSW = registerSW({
  onNeedRefresh: () => {
    sonnerToast(TOAST.neueVersion, {
      action: { label: TOAST.neueVersionLaden, onClick: () => void updateSW(true) },
      duration: Infinity,
    })
  },
  onRegisterError: (e) => console.error('SW', e),
})

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
)
