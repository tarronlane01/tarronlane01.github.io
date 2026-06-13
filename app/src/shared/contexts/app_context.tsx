/**
 * App Context
 *
 * Provides app-wide state that needs to be available everywhere,
 * including before authentication and budget initialization.
 *
 * Currently handles:
 * - Global loading overlay state (loading holds)
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

// ============================================================================
// CONTEXT TYPE
// ============================================================================

interface AppContextType {
  // Global loading state (multiple components can hold loading state)
  isLoading: boolean
  loadingMessage: string
  addLoadingHold: (key: string, message: string) => void
  removeLoadingHold: (key: string) => void
}

// ============================================================================
// DEFAULT CONTEXT VALUE
// ============================================================================

const defaultContextValue: AppContextType = {
  isLoading: false,
  loadingMessage: 'Loading...',
  addLoadingHold: () => {},
  removeLoadingHold: () => {},
}

const AppContext = createContext<AppContextType>(defaultContextValue)

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

export function AppProvider({ children }: { children: ReactNode }) {
  // Global loading state - Map allows multiple components to hold loading state
  const [loadingHolds, setLoadingHolds] = useState<Map<string, string>>(new Map())

  const addLoadingHold = useCallback((key: string, message: string) => {
    setLoadingHolds(prev => new Map(prev).set(key, message))
  }, [])

  const removeLoadingHold = useCallback((key: string) => {
    setLoadingHolds(prev => {
      const next = new Map(prev)
      next.delete(key)
      return next
    })
  }, [])

  // Derive loading state from holds
  const isLoading = loadingHolds.size > 0
  const loadingMessage = loadingHolds.size > 0
    ? Array.from(loadingHolds.values()).pop() || 'Loading...'
    : 'Loading...'

  const contextValue: AppContextType = {
    isLoading,
    loadingMessage,
    addLoadingHold,
    removeLoadingHold,
  }

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  )
}

// ============================================================================
// HOOK
// ============================================================================

// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
}

export default AppContext

