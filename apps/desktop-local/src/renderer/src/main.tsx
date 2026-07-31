import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App, setAppMode } from '@wapbolt/ui-shared'

// §7 docs/local-app-design.md — mode local: no login, no realtime, sync UI aktif.
setAppMode({ mode: 'local', realtime: false, auth: 'none', sync: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
