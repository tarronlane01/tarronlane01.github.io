/**
 * React Query Provider Component
 *
 * Wraps the app with PersistQueryClientProvider for automatic
 * cache persistence to localStorage.
 * Must be placed inside any auth provider but outside budget context.
 */

import { type ReactNode } from 'react'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { queryClient, localStoragePersister } from './queryClient'

interface QueryProviderProps {
  children: ReactNode
}

export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: localStoragePersister,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours - must match gcTime
        buster: 'v1', // Increment this to invalidate all persisted caches
      }}
    >
      {children}
    </PersistQueryClientProvider>
  )
}
