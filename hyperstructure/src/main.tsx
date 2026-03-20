import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Hyperstructure } from './Hyperstructure'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Hyperstructure />
  </StrictMode>,
)
