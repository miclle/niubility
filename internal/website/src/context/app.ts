import { createContext, useContext } from 'react'
import type { User } from 'src/types/user'

// AppContextValue holds the global application state.
export interface AppContextValue {
  initialized: boolean
  currentUser: User | null
  registrationEnabled: boolean
  ssoEnabled: boolean
  ssoLoginUrl: string
  setCurrentUser: (user: User | null) => void
}

// AppContext provides access to the global application state.
export const AppContext = createContext<AppContextValue>({
  initialized: false,
  currentUser: null,
  registrationEnabled: false,
  ssoEnabled: false,
  ssoLoginUrl: '',
  setCurrentUser: () => {},
})

// useAppContext returns the current AppContext value.
export function useAppContext() {
  return useContext(AppContext)
}
