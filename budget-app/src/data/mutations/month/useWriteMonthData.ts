/**
 * Month Write Operations
 *
 * Provides both:
 * - React hook (useWriteMonthData) for use in components with optimistic updates
 * - Utility function (writeMonthData) for use in non-React contexts
 *
 * Both share a core write function to avoid duplication.
 *
 * All month writes ensure future months are in the month_map. The cache-aware
 * logic in ensureMonthsInMap prevents redundant Firestore writes.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { MonthDocument } from '@types'
import { writeDocByPath } from '@firestore'
import { getMonthDocId } from '@utils'
import { queryClient, queryKeys } from '@data/queryClient'
import { ensureMonthsInMap } from '@data/recalculation'
import type { MonthQueryData } from '@data/queries/month'
import { convertMonthBalancesToStored } from '@data/firestore/converters/monthBalances'

// ============================================================================
// TYPES
// ============================================================================

/**
 * Parameters for writing month data (used by both hook and function)
 */
export interface WriteMonthParams {
  budgetId: string
  month: MonthDocument
  /** Optional description for logging */
  description?: string
  /** If false, skip updating the month_map (default: true) */
  updateMonthMap?: boolean
}

// ============================================================================
// CORE WRITE FUNCTION (shared by both hook and utility)
// ============================================================================

/**
 * Core function that writes month data to Firestore.
 * Converts calculated balances to stored format before writing.
 * Does NOT update cache or mark future months - callers handle that.
 */
async function writeMonthToFirestore(
  budgetId: string,
  month: MonthDocument,
  description: string
): Promise<void> {
  const monthDocId = getMonthDocId(budgetId, month.year, month.month)
  
  // Convert calculated balances to stored format before writing
  const storedMonth = convertMonthBalancesToStored(month)
  
  await writeDocByPath(
    'months',
    monthDocId,
    storedMonth,
    `writeMonthData: ${description}`
  )
}


// ============================================================================
// UTILITY FUNCTION (for non-React contexts)
// ============================================================================

/**
 * Write month data to Firestore for non-React contexts (e.g., recalculation).
 *
 * Updates cache after write and optionally updates the month_map.
 *
 * @param params - Write parameters including budgetId, month, description, and cascade flag
 */
export async function writeMonthData(params: WriteMonthParams): Promise<void> {
  const { budgetId, month, description, updateMonthMap = true } = params

  // Write to Firestore
  await writeMonthToFirestore(budgetId, month, description || `${month.year}/${month.month}`)

  // Update cache (after write for consistency)
  queryClient.setQueryData<MonthQueryData>(
    queryKeys.month(budgetId, month.year, month.month),
    { month }
  )

  // Ensure future months are in the month_map (unless disabled)
  // Note: ensureMonthsInMap internally updates the budget cache via updateCacheWithMonthMap
  if (updateMonthMap) {
    await ensureMonthsInMap(budgetId, month.year, month.month)
  }
}

// ============================================================================
// HOOK (for React components with optimistic updates)
// ============================================================================

/**
 * Hook for writing month data to Firestore with optimistic updates.
 *
 * - onMutate: Optimistically updates cache before write
 * - mutationFn: Writes to Firestore
 * - onSuccess: Updates the month_map if enabled
 * - onError: Rolls back optimistic update
 */
export function useWriteMonthData() {
  const queryClient = useQueryClient()

  const writeData = useMutation({
    mutationFn: async ({ budgetId, month, description, updateMonthMap = true }: WriteMonthParams) => {
      await writeMonthToFirestore(
        budgetId,
        month,
        description || `${month.year}/${month.month}`
      )
      return { budgetId, year: month.year, month: month.month, updateMonthMap }
    },

    onMutate: async ({ budgetId, month }: WriteMonthParams) => {
      const monthKey = queryKeys.month(budgetId, month.year, month.month)
      await queryClient.cancelQueries({ queryKey: monthKey })
      const oldMonthQueryData = queryClient.getQueryData<MonthQueryData>(monthKey)
      queryClient.setQueryData<MonthQueryData>(monthKey, { month })
      return { oldMonthQueryData, monthKey }
    },

    onSuccess: async ({ budgetId, year, month, updateMonthMap }) => {
      if (!updateMonthMap) return
      // ensureMonthsInMap internally updates the budget cache via updateCacheWithMonthMap
      await ensureMonthsInMap(budgetId, year, month)
    },

    onError: (_err, _variables, context) => {
      if (context?.oldMonthQueryData) {
        queryClient.setQueryData(
          context.monthKey,
          context.oldMonthQueryData
        )
      }
    },
  })

  return {
    writeData,
  }
}
