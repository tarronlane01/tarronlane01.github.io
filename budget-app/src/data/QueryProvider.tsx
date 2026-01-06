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

import { type ReactNode, useEffect, useState } from 'react'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient, localStoragePersister } from './queryClient'

interface QueryProviderProps {
  children: ReactNode
}

/**
 * Check if we should skip hydration (cache bust mode).
 * This happens when user clicks the cache invalidate button.
 */
function shouldSkipHydration(): boolean {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  return params.get('cacheBust') === '1'
}

/**
 * Remove the cacheBust param from URL without triggering a reload.
 */
function cleanupCacheBustParam() {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (url.searchParams.has('cacheBust')) {
    url.searchParams.delete('cacheBust')
    window.history.replaceState({}, '', url.toString())
  }
}

export function QueryProvider({ children }: QueryProviderProps) {
  const [skipHydration] = useState(() => shouldSkipHydration())

  // Clean up the URL param after mount
  useEffect(() => {
    if (skipHydration) {
      cleanupCacheBustParam()
    }
  }, [skipHydration])

  // If in cache bust mode, use regular QueryClientProvider (no persistence/hydration)
  if (skipHydration) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: localStoragePersister,
        maxAge: 5 * 60 * 1000, // 5 minutes - persisted cache expires after this
        buster: 'v3', // Increment this to invalidate all persisted caches (v3: added transfers/adjustments)
      }}
    >
      {children}
    </PersistQueryClientProvider>
  )
}
