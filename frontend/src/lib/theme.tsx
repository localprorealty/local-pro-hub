import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import { fetchUserProfile, updateUserThemePreference } from '@/lib/users'

export type Theme = 'light' | 'dark'

type ThemeContextType = {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

export const THEME_STORAGE_KEY = 'localpro_theme'

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark'
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY)
      if (stored === 'light' || stored === 'dark') return stored
    } catch {
      // Ignore
    }
    return 'dark'
  })

  // Apply theme to DOM and localStorage immediately
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'light') {
      root.classList.add('light')
      root.classList.remove('dark')
      root.style.colorScheme = 'light'
    } else {
      root.classList.add('dark')
      root.classList.remove('light')
      root.style.colorScheme = 'dark'
    }

    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // Ignore
    }
  }, [theme])

  // DB Sync: On mount / session resolution, reconcile with DB preference (DB wins across devices)
  useEffect(() => {
    let isMounted = true

    const reconcileWithDb = async () => {
      try {
        const {
          data: { session },
        } = await getSupabaseClient().auth.getSession()
        const userId = session?.user?.id
        if (!userId) return

        const profile = await fetchUserProfile(userId)
        if (!isMounted || !profile?.theme_preference) return

        const dbTheme = profile.theme_preference
        if (dbTheme === 'dark' || dbTheme === 'light') {
          // If DB preference differs from current localStorage/state, DB wins!
          setThemeState((current) => {
            if (current !== dbTheme) {
              try {
                localStorage.setItem(THEME_STORAGE_KEY, dbTheme)
              } catch {
                // Ignore
              }
              return dbTheme
            }
            return current
          })
        }
      } catch (err) {
        console.warn('Theme DB reconciliation notice:', err)
      }
    }

    void reconcileWithDb()

    // Also listen for auth state changes (login / signin on new device)
    const {
      data: { subscription },
    } = getSupabaseClient().auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        void reconcileWithDb()
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const setTheme = (nextTheme: Theme) => {
    setThemeState(nextTheme)
    void updateUserThemePreference(nextTheme)
  }

  const toggleTheme = () => {
    setThemeState((prev) => {
      const nextTheme: Theme = prev === 'light' ? 'dark' : 'light'
      void updateUserThemePreference(nextTheme)
      return nextTheme
    })
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
