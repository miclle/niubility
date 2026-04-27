import { useEffect, useMemo, useState } from 'react'

import {
  ThemeContext,
  readInitialTheme,
  applyThemeToDocument,
  type ThemePreference,
  type ResolvedTheme,
} from 'src/context/theme'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const initialTheme = readInitialTheme()
  const [theme, setThemeState] = useState<ThemePreference>(initialTheme.theme)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(initialTheme.resolvedTheme)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const syncTheme = () => {
      setResolvedTheme(applyThemeToDocument(theme))
    }

    syncTheme()
    window.localStorage.setItem('niubility-theme', theme)
    media.addEventListener('change', syncTheme)

    return () => {
      media.removeEventListener('change', syncTheme)
    }
  }, [theme])

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme: setThemeState,
    }),
    [theme, resolvedTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
