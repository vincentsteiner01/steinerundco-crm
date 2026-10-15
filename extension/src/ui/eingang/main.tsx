import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../stil.css'
import { Eingang } from './Eingang'

createRoot(document.getElementById('wurzel') as HTMLElement).render(
  <StrictMode>
    <Eingang />
  </StrictMode>,
)
