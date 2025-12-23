/**
 * React Query Client Configuration
 *
 * Configures React Query with:
 * - Stale time of 5 minutes
 * - Cache time of 24 hours
 * - No automatic refetch on window focus (REQUIRED)
 * - Refetch on reconnect
 * - LocalStorage persistence via sync storage persister
 */

import { QueryClient } from '@tanstack/react-query'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'

// Query client configuration per spec
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,        // 5 minutes - data considered fresh
      gcTime: 24 * 60 * 60 * 1000,     // 24 hours - how long to keep unused data (was cacheTime in v4)
      refetchOnWindowFocus: false,      // REQUIRED: Do not refetch on tab focus
      refetchOnReconnect: true,         // Refetch when network reconnects
      retry: 1,                         // Only retry once on failure
      refetchOnMount: false,            // Don't refetch when component mounts if data is fresh
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
