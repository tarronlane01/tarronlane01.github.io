/**
 * React Query Client Configuration
 *
 * Configures React Query with:
 * - Stale time of 5 minutes (data considered fresh)
 * - GC time of 30 minutes (how long to keep unused data)
 * - No automatic refetch on window focus (avoids unnecessary reads)
 * - Refetch on mount when data is stale (ensures max 5 min staleness)
 * - Refetch on reconnect
 * - LocalStorage persistence via async storage persister (max 5 min age)
 */

import { QueryClient } from '@tanstack/react-query'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'

// Cache timing constants
export const STALE_TIME = 5 * 60 * 1000        // 5 minutes - data considered fresh
export const GC_TIME = 30 * 60 * 1000          // 30 minutes - how long to keep unused data

// Query client configuration per spec
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_TIME,
      gcTime: GC_TIME,
      refetchOnWindowFocus: false,      // Don't refetch on tab focus (avoid unnecessary reads)
      refetchOnReconnect: true,         // Refetch when network reconnects
      retry: 1,                         // Only retry once on failure
      refetchOnMount: true,             // Refetch when component mounts if data is stale
    },
    mutations: {
      retry: 1,
    },
  },
})

// Debug logging for query errors (reads are now logged via Firebase wrappers)
queryClient.getQueryCache().subscribe(event => {
  const query = event?.query
  if (!query) return

  if (event.type === 'updated') {
    const { state } = query
    // Log any query errors
    if (state.status === 'error' && state.error) {
      console.error('[RQ] Query FAILED:', query.queryKey, state.error)
    }
  }
})

// LocalStorage persister for React Query cache (async wrapper)
export const localStoragePersister = createAsyncStoragePersister({
  storage: typeof window !== 'undefined' ? {
    getItem: (key: string) => Promise.resolve(localStorage.getItem(key)),
    setItem: (key: string, value: string) => Promise.resolve(localStorage.setItem(key, value)),
    removeItem: (key: string) => Promise.resolve(localStorage.removeItem(key)),
  } : undefined,
  key: 'BUDGET_APP_QUERY_CACHE',
})

// Query key factory - ensures consistent query keys
// Pattern: ['domain', 'entity', 'identifier']
export const queryKeys = {
  // User queries
  user: (userId: string) => ['user', userId] as const,

  // Budget-level document (global scope)
  // Contains: accounts, accountGroups, categories, categoryGroups, ownership
  budget: (budgetId: string) => ['budget', budgetId] as const,

  // Month-level document (time scope)
  // Contains: income, expenses, allocations, category_balances
  month: (budgetId: string, year: number, month: number) =>
    ['month', budgetId, year, month] as const,

  // Payees document (per budget)
  payees: (budgetId: string) => ['payees', budgetId] as const,

  // User's accessible budgets list
  accessibleBudgets: (userId: string) => ['accessibleBudgets', userId] as const,

  // Feedback collection (admin only)
  feedback: () => ['feedback'] as const,
}
