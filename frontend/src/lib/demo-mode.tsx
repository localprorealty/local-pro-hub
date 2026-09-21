import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export const DEMO_MODE_STORAGE_KEY = 'localpro_demo_mode'

type DemoModeContextType = {
  isDemoMode: boolean
  toggleDemoMode: () => void
  setDemoMode: (enabled: boolean) => void
}

const DemoModeContext = createContext<DemoModeContextType | undefined>(undefined)

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      return localStorage.getItem(DEMO_MODE_STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(DEMO_MODE_STORAGE_KEY, String(isDemoMode))
    } catch {
      // Ignore
    }
  }, [isDemoMode])

  const toggleDemoMode = () => setIsDemoMode((prev) => !prev)
  const setDemoMode = (enabled: boolean) => setIsDemoMode(enabled)

  return (
    <DemoModeContext.Provider value={{ isDemoMode, toggleDemoMode, setDemoMode }}>
      {children}
    </DemoModeContext.Provider>
  )
}

export function useDemoMode() {
  const context = useContext(DemoModeContext)
  if (!context) {
    throw new Error('useDemoMode must be used within a DemoModeProvider')
  }
  return context
}
