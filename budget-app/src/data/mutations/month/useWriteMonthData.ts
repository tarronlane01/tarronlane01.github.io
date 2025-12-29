/**
 * Month Write Operations
 *
 * Provides both:
 * - React hook (useWriteMonthData) for use in components with optimistic updates
 * - Utility function (writeMonthData) for use in non-React contexts
 *
 * Both share a core write function to avoid duplication.
 *
 * All month writes mark future months as needing recalculation. The cache-aware
 * logic in markFutureMonthsNeedRecalculation prevents redundant Firestore writes.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { MonthDocument } from '@types'
import { writeDocByPath } from '@firestore'
import { getMonthDocId } from '@utils'
import { queryClient, queryKeys } from '@data/queryClient'
import {
  markFutureMonthsNeedRecalculation,
  markBudgetNeedsRecalculation,
} from '@data/recalculation'
import type { MonthQueryData } from '@data/queries/month'

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
  /** If false, skip marking future months as needing recalculation (default: true) */
  cascadeRecalculation?: boolean
}

// ============================================================================
// CORE WRITE FUNCTION (shared by both hook and utility)
// ============================================================================

/**
 * Core function that writes month data to Firestore.
 * Does NOT update cache or mark future months - callers handle that.
 */
async function writeMonthToFirestore(
  budgetId: string,
  month: MonthDocument,
  description: string
): Promise<void> {
  const monthDocId = getMonthDocId(budgetId, month.year, month.month)
  await writeDocByPath(
    'months',
    monthDocId,
    month,
    `writeMonthData: ${description}`
  )
}

/**
 * Mark future months and budget as needing recalculation.
 */
async function cascadeRecalculationMarking(
  budgetId: string,
  year: number,
  month: number
): Promise<void> {
  await Promise.all([
    markFutureMonthsNeedRecalculation(budgetId, year, month),
    markBudgetNeedsRecalculation(budgetId),
  ])
}

// ============================================================================
// UTILITY FUNCTION (for non-React contexts)
// ============================================================================

/**
 * Write month data to Firestore for non-React contexts (e.g., recalculation).
 *
 * Updates cache after write and optionally marks future months as needing recalculation.
 *
 * @param params - Write parameters including budgetId, month, description, and cascade flag
 */
export async function writeMonthData(params: WriteMonthParams): Promise<void> {
  const { budgetId, month, description, cascadeRecalculation = true } = params

  // Write to Firestore
  await writeMonthToFirestore(budgetId, month, description || `${month.year}/${month.month}`)

  // Update cache (after write for consistency)
  queryClient.setQueryData<MonthQueryData>(
    queryKeys.month(budgetId, month.year, month.month),
    { month }
  )

  // Mark future months and budget as needing recalculation (unless disabled)
  if (cascadeRecalculation) {
    await cascadeRecalculationMarking(budgetId, month.year, month.month)
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
 * - onSuccess: Marks future months as needing recalculation
 * - onError: Rolls back optimistic update
 */
export function useWriteMonthData() {
  const queryClient = useQueryClient()

  const writeData = useMutation({
    mutationFn: async ({ budgetId, month, description, cascadeRecalculation = true }: WriteMonthParams) => {
      await writeMonthToFirestore(
        budgetId,
        month,
        description || `${month.year}/${month.month}`
      )
      return { budgetId, year: month.year, month: month.month, cascadeRecalculation }
    },

    onMutate: async ({ budgetId, month }: WriteMonthParams) => {
      const monthKey = queryKeys.month(budgetId, month.year, month.month)
      await queryClient.cancelQueries({ queryKey: monthKey })
      const oldMonthQueryData = queryClient.getQueryData<MonthQueryData>(monthKey)
      queryClient.setQueryData<MonthQueryData>(monthKey, { month })
      return { oldMonthQueryData, monthKey }
    },

    onSuccess: async ({ budgetId, year, month, cascadeRecalculation }) => {
      if (!cascadeRecalculation) return
      await cascadeRecalculationMarking(budgetId, year, month)
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
