/**
 * React Query Provider Component
 *
 * Wraps the app with PersistQueryClientProvider for automatic
 * cache persistence to localStorage.
 *
 * Cache expiration: Persisted cache expires after 5 minutes (maxAge).
 * This ensures data is never more than 5 minutes stale across devices/sessions.
 *
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
        maxAge: 5 * 60 * 1000, // 5 minutes - persisted cache expires after this
        buster: 'v2', // Increment this to invalidate all persisted caches
      }}
    >
      {children}
    </PersistQueryClientProvider>
  )
}
