import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../stil.css'
import { Popup } from './Popup'

createRoot(document.getElementById('wurzel') as HTMLElement).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
)
