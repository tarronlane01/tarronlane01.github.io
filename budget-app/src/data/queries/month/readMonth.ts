/**
 * Read Month
 *
 * Single source of truth for reading month documents.
 * All month reads should go through this file.
 *
 * Handles:
 * - Cache-first reads (React Query cache)
 * - Firestore fetches when not cached
 *
 * NOTE: Recalculation is NOT triggered by this module.
 * Recalculation is only triggered when viewing the Categories or Accounts tabs,
 * which show the MonthCategories or MonthAccounts components.
 *
 * See: components/budget/Month/MonthCategories.tsx
 * See: components/budget/Month/MonthAccounts.tsx
 */

import type { MonthDocument, FirestoreData } from '@types'
import { readDocByPath } from '@firestore'
import { getMonthDocId, getYearMonthOrdinal } from '@utils'
import { queryClient, queryKeys, STALE_TIME } from '@data/queryClient'

// ============================================================================
// TYPES
// ============================================================================

export interface MonthQueryData {
  month: MonthDocument
}

export interface ReadMonthOptions {
  /** Description for logging */
  description?: string
  /**
   * @deprecated No longer used - recalculation is handled by MonthCategories/MonthAccounts
   */
  triggerRecalc?: boolean
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse raw Firestore month data into typed MonthDocument
 */
function parseMonthData(data: FirestoreData, budgetId: string, year: number, month: number): MonthDocument {
  return {
    budget_id: budgetId,
    year_month_ordinal: data.year_month_ordinal ?? getYearMonthOrdinal(year, month),
    year: data.year ?? year,
    month: data.month ?? month,
    income: data.income || [],
    total_income: data.total_income ?? 0,
    previous_month_income: data.previous_month_income ?? 0,
    expenses: data.expenses || [],
    total_expenses: data.total_expenses ?? 0,
    transfers: data.transfers || [],
    adjustments: data.adjustments || [],
    account_balances: data.account_balances || [],
    category_balances: data.category_balances || [],
    are_allocations_finalized: data.are_allocations_finalized ?? false,
    created_at: data.created_at,
    updated_at: data.updated_at,
  }
}

// ============================================================================
// MAIN READ FUNCTION
// ============================================================================

/**
 * Read a month document.
 *
 * This is the main entry point for all month reads.
 * Uses React Query's fetchQuery (automatic cache check + fetch).
 *
 * @param budgetId - Budget ID
 * @param year - Year
 * @param month - Month (1-12)
 * @param options - Read options
 * @returns Month document or null if doesn't exist
 */
export async function readMonth(
  budgetId: string,
  year: number,
  month: number,
  options?: ReadMonthOptions
): Promise<MonthDocument | null> {
  const monthDocId = getMonthDocId(budgetId, year, month)

  // Use React Query's fetchQuery - automatically checks cache and fetches if needed
  // NOTE: fetchQuery does NOT inherit staleTime from queryClient defaults,
  // so we must explicitly pass it to avoid always refetching
  const result = await queryClient.fetchQuery<MonthQueryData | null>({
    queryKey: queryKeys.month(budgetId, year, month),
    queryFn: async () => {
      const { exists, data } = await readDocByPath<FirestoreData>(
        'months',
        monthDocId,
        options?.description ?? `reading month ${year}/${month}`
      )

      if (!exists || !data) {
        return null
      }

      const parsedMonth = parseMonthData(data, budgetId, year, month)
      return { month: parsedMonth }
    },
    staleTime: STALE_TIME,
  })

  return result?.month ?? null
}

