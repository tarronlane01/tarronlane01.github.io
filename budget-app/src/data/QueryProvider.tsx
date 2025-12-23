/**
 * React Query Provider Component
 *
 * Wraps the app with QueryClientProvider and sets up persistence.
 * Must be placed inside any auth provider but outside budget context.
 */

import { type ReactNode, useEffect, useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient, setupQueryPersistence } from './queryClient'

interface QueryProviderProps {
  children: ReactNode
}

export function QueryProvider({ children }: QueryProviderProps) {
  const [isRestored, setIsRestored] = useState(false)

  useEffect(() => {
    // Set up localStorage persistence for React Query cache
    setupQueryPersistence()

    // Mark as restored after a brief delay to allow rehydration
    // This prevents flash of loading state when cache is available
    const timeout = setTimeout(() => {
      setIsRestored(true)
    }, 50)

    return () => clearTimeout(timeout)
  }, [])

  // Show nothing until cache is restored to prevent flash
  // In practice, this is nearly instant with localStorage
  if (!isRestored) {
    return null
  }

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

