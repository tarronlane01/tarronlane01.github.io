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
import { convertMonthBalancesFromStored } from '@data/firestore/converters/monthBalances'
import { calculatePreviousMonthIncome } from './calculatePreviousMonthIncome'

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
 * Parse raw Firestore month data into typed MonthDocument.
 * Converts stored balances to calculated balances on-the-fly.
 * Calculates total_income, total_expenses, and previous_month_income from arrays (not stored in Firestore).
 */
import type { QueryClient } from '@tanstack/react-query'

async function parseMonthData(
  data: FirestoreData,
  budgetId: string,
  year: number,
  month: number,
  queryClient?: QueryClient
): Promise<MonthDocument> {
  const income = data.income || []
  const expenses = data.expenses || []
  
  // Calculate totals from arrays (not stored in Firestore - calculated on-the-fly)
  const totalIncome = income.reduce((sum: number, inc: { amount: number }) => sum + (inc.amount || 0), 0)
  const totalExpenses = expenses.reduce((sum: number, exp: { amount: number }) => sum + (exp.amount || 0), 0)
  
  // Calculate previous_month_income from previous month's income array (not stored in Firestore)
  // Falls back to stored value for backward compatibility during migration
  const previousMonthIncome = data.previous_month_income !== undefined
    ? data.previous_month_income as number // Use stored value if present (backward compatibility)
    : await calculatePreviousMonthIncome(budgetId, year, month, queryClient)
  
  // Parse basic month data
  const monthDoc: MonthDocument = {
    budget_id: budgetId,
    year_month_ordinal: data.year_month_ordinal ?? getYearMonthOrdinal(year, month),
    year: data.year ?? year,
    month: data.month ?? month,
    income,
    total_income: totalIncome, // Calculated from income array
    previous_month_income: previousMonthIncome, // Calculated from previous month's income array
    expenses,
    total_expenses: totalExpenses, // Calculated from expenses array
    transfers: data.transfers || [],
    adjustments: data.adjustments || [],
    account_balances: data.account_balances || [],
    category_balances: data.category_balances || [],
    are_allocations_finalized: data.are_allocations_finalized ?? false,
    created_at: data.created_at,
    updated_at: data.updated_at,
  }

  // Convert stored balances to calculated balances
  return convertMonthBalancesFromStored(monthDoc)
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

      const parsedMonth = await parseMonthData(data, budgetId, year, month, queryClient)
      return { month: parsedMonth }
    },
    staleTime: STALE_TIME,
  })

  return result?.month ?? null
}

