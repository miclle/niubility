import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { boot } from 'src/api/user'
import App from './App'

import 'src/globals.css'

// Boot the application: fetch current user, then render.
boot()
  .then((res) => {
    const user = res.data.authentication === 'authorized' ? res.data.user ?? null : null
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App initialUser={user} />
      </StrictMode>,
    )
  })
  .catch(() => {
    // If boot fails (e.g. network error), render without user.
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App initialUser={null} />
      </StrictMode>,
    )
  })
