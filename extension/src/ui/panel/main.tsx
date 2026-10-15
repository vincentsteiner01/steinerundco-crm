import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../stil.css'
import { Panel } from './Panel'

createRoot(document.getElementById('wurzel') as HTMLElement).render(
  <StrictMode>
    <Panel />
  </StrictMode>,
)
