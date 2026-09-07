import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App, setAppMode } from '@wapbolt/ui-shared'

// §7/§8 docs/local-app-design.md — mode local: login sekali (sesi persisten),
// no realtime, sync UI aktif.
setAppMode({ mode: 'local', realtime: false, auth: 'required', sync: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
