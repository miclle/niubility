import { useState } from 'react'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'

import { AppContext } from 'src/context/app'
import { ThemeProvider } from 'src/context/theme'
import routes from './router'
import type { User, SiteConfig } from 'src/types/user'
import type { Category } from 'src/types/content'

const router = createBrowserRouter(routes)

// AppProps holds the boot-time state passed from main.tsx.
interface AppProps {
  initialUser: User | null
  initialized: boolean
  categories: Category[]
  registrationEnabled: boolean
  ssoEnabled: boolean
  ssoLoginUrl: string
  siteConfig: SiteConfig | null
}

// App is the root component wrapping providers and the router.
function App({ initialUser, initialized, categories, registrationEnabled, ssoEnabled, ssoLoginUrl, siteConfig }: AppProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(initialUser)
  const [currentSiteConfig, setCurrentSiteConfig] = useState<SiteConfig | null>(siteConfig)

  return (
    <ThemeProvider>
      <AppContext.Provider value={{
        initialized,
        currentUser,
        categories,
        registrationEnabled,
        ssoEnabled,
        ssoLoginUrl,
        siteConfig: currentSiteConfig,
        setCurrentUser,
        setSiteConfig: setCurrentSiteConfig,
      }}>
        <TooltipProvider>
          <RouterProvider router={router} />
        </TooltipProvider>
      </AppContext.Provider>
    </ThemeProvider>
  )
}

export default App
