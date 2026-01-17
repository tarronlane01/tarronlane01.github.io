/**
 * Budget Query Hook
 *
 * React Query hook for fetching budget-level documents.
 * Uses fetchBudget for the actual Firestore read.
 *
 * The budget document contains global/cross-month data:
 * - Account definitions and groups (with balances)
 * - Category definitions and groups (with balances)
 * - Display ordering
 * - Ownership/access metadata
 *
 * This document is read once per session and cached aggressively.
 */

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@data/queryClient'
import { fetchBudget, type BudgetData } from './fetchBudget'

export type { BudgetData }

/**
 * Query hook for budget-level document
 *
 * Returns the complete budget data including accounts, categories, etc.
 * Data is cached in-memory only and will be refetched on reload.
 *
 * @param budgetId - The budget ID to fetch
 * @param options - Additional query options
 */
export function useBudgetQuery(
  budgetId: string | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: budgetId ? queryKeys.budget(budgetId) : ['budget', 'none'],
    queryFn: () => fetchBudget(budgetId!),
    enabled: !!budgetId && (options?.enabled !== false),
  })
}

