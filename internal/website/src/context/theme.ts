import { createContext, useContext } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'niubility-theme'

interface ThemeContextValue {
  theme: ThemePreference
  resolvedTheme: ResolvedTheme
  setTheme: (theme: ThemePreference) => void
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => {},
})

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark'
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function readStoredTheme(): ThemePreference {
  if (typeof window === 'undefined') return 'system'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return isThemePreference(stored) ? stored : 'system'
}

export function applyThemeToDocument(theme: ThemePreference) {
  if (typeof document === 'undefined') return getSystemTheme()

  const resolvedTheme = theme === 'system' ? getSystemTheme() : theme
  const root = document.documentElement
  root.classList.toggle('dark', resolvedTheme === 'dark')
  root.style.colorScheme = resolvedTheme

  return resolvedTheme
}

export function readInitialTheme() {
  const theme = readStoredTheme()
  return {
    theme,
    resolvedTheme: applyThemeToDocument(theme),
  }
}

export function initializeTheme() {
  applyThemeToDocument(readStoredTheme())
}

export function useTheme() {
  return useContext(ThemeContext)
}
