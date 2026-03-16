import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { boot } from 'src/api/user'
import App from './App'
import type { BootResponse } from 'src/types/user'

import 'src/globals.css'

// Boot the application: fetch system state, then render.
boot()
  .then((res) => {
    renderApp(res.data)
  })
  .catch(() => {
    // If boot fails, render with defaults (uninitialized state).
    renderApp({
      initialized: false,
      authentication: 'unauthorized',
      registration_enabled: false,
      sso_enabled: false,
    })
  })

function renderApp(bootData: BootResponse) {
  const user = bootData.authentication === 'authorized' ? bootData.user ?? null : null
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App
        initialUser={user}
        initialized={bootData.initialized}
        registrationEnabled={bootData.registration_enabled}
        ssoEnabled={bootData.sso_enabled}
        ssoLoginUrl={bootData.sso_login_url || ''}
      />
    </StrictMode>,
  )
}
