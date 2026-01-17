/**
 * React Query Provider Component
 *
 * Wraps the app with QueryClientProvider.
 * All data is fetched from Firestore on reload - no local persistence.
 *
 * Must be placed inside any auth provider but outside budget context.
 */

import { type ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './queryClient'

interface QueryProviderProps {
  children: ReactNode
}

export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
