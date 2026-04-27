import { createContext, useContext } from 'react'
import type { User, SiteConfig } from 'src/types/user'
import type { Category } from 'src/types/content'

// AppContextValue holds the global application state.
export interface AppContextValue {
  initialized: boolean
  currentUser: User | null
  categories: Category[]
  registrationEnabled: boolean
  ssoEnabled: boolean
  ssoLoginUrl: string
  siteConfig: SiteConfig | null
  setCurrentUser: (user: User | null) => void
  setSiteConfig: (siteConfig: SiteConfig | null) => void
}

// AppContext provides access to the global application state.
export const AppContext = createContext<AppContextValue>({
  initialized: false,
  currentUser: null,
  categories: [],
  registrationEnabled: false,
  ssoEnabled: false,
  ssoLoginUrl: '',
  siteConfig: null,
  setCurrentUser: () => {},
  setSiteConfig: () => {},
})

// useAppContext returns the current AppContext value.
export function useAppContext() {
  return useContext(AppContext)
}
