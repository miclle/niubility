import { useState } from 'react'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'

import { AppContext } from 'src/context/app'
import routes from './router'
import type { User } from 'src/types/user'

const router = createBrowserRouter(routes)

// AppProps holds the boot-time state passed from main.tsx.
interface AppProps {
  initialUser: User | null
  initialized: boolean
  registrationEnabled: boolean
  ssoEnabled: boolean
  ssoLoginUrl: string
}

// App is the root component wrapping providers and the router.
function App({ initialUser, initialized, registrationEnabled, ssoEnabled, ssoLoginUrl }: AppProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(initialUser)

  return (
    <AppContext.Provider value={{
      initialized,
      currentUser,
      registrationEnabled,
      ssoEnabled,
      ssoLoginUrl,
      setCurrentUser,
    }}>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </AppContext.Provider>
  )
}

export default App
