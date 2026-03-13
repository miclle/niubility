import { createContext, useContext } from 'react'
import type { User } from 'src/types/user'

// AppContextValue holds the global application state.
export interface AppContextValue {
  currentUser: User | null
  setCurrentUser: (user: User | null) => void
}

// AppContext provides access to the global application state.
export const AppContext = createContext<AppContextValue>({
  currentUser: null,
  setCurrentUser: () => {},
})

// useAppContext returns the current AppContext value.
export function useAppContext() {
  return useContext(AppContext)
}
