import { useState } from 'react'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'

import { AppContext } from 'src/context/app'
import routes from './router'
import type { User } from 'src/types/user'

const router = createBrowserRouter(routes)

// App is the root component wrapping providers and the router.
function App({ initialUser }: { initialUser: User | null }) {
  const [currentUser, setCurrentUser] = useState<User | null>(initialUser)

  return (
    <AppContext.Provider value={{ currentUser, setCurrentUser }}>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </AppContext.Provider>
  )
}

export default App
