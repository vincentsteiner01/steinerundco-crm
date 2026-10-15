import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../stil.css'
import { Optionen } from './Optionen'

createRoot(document.getElementById('wurzel') as HTMLElement).render(
  <StrictMode>
    <Optionen />
  </StrictMode>,
)
