/**
 * Month Query Hook
 *
 * React Query hook for fetching month-level documents.
 *
 * IMPORTANT: This hook reads directly from Firestore instead of using readMonth
 * to avoid a deadlock. readMonth uses queryClient.fetchQuery with the same
 * query key, which would cause React Query to wait for itself (deadlock).
 *
 * When a month doesn't exist, it creates a new one using createMonth
 * (which is in mutations since it's a write operation).
 */

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@data/queryClient'
import type { MonthDocument, FirestoreData } from '@types'
import type { MonthQueryData } from './readMonth'
import { createMonth } from '@data/mutations/month/createMonth'
import { readDocByPath } from '@firestore'
import { getMonthDocId, getYearMonthOrdinal } from '@utils'
import { triggerRecalculation } from '@data/recalculation/triggerRecalculation'

/**
 * Parse raw Firestore month data into typed MonthDocument.
 * Duplicated from readMonth.ts to avoid importing the function that uses fetchQuery.
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
    account_balances: data.account_balances || [],
    category_balances: data.category_balances || [],
    are_allocations_finalized: data.are_allocations_finalized ?? false,
    is_needs_recalculation: data.is_needs_recalculation ?? false,
    created_at: data.created_at,
    updated_at: data.updated_at,
  }
}

/**
 * Read month directly from Firestore.
 *
 * This bypasses queryClient.fetchQuery to avoid deadlocking with useQuery.
 * The useQuery hook itself handles caching - we don't need another cache layer.
 */
async function readMonthDirect(
  budgetId: string,
  year: number,
  month: number
): Promise<MonthDocument | null> {
  const monthDocId = getMonthDocId(budgetId, year, month)

  const { exists, data } = await readDocByPath<FirestoreData>(
    'months',
    monthDocId,
    `loading month ${year}/${month}`
  )

  if (!exists || !data) {
    return null
  }

  return parseMonthData(data, budgetId, year, month)
}

/**
 * Fetch month document - reads directly from Firestore, creates new if needed.
 * Handles recalculation if the month is marked as needing it.
 */
async function fetchMonth(
  budgetId: string,
  year: number,
  month: number
): Promise<MonthDocument> {
  // Read directly from Firestore (no fetchQuery to avoid deadlock)
  const existingMonth = await readMonthDirect(budgetId, year, month)

  if (existingMonth) {
    // If month needs recalculation, trigger it and re-read
    if (existingMonth.is_needs_recalculation) {
      const monthOrdinal = getYearMonthOrdinal(year, month)
      console.log(`[useMonthQuery] Month ${monthOrdinal} needs recalculation, triggering...`)

      await triggerRecalculation(budgetId, { targetMonthOrdinal: monthOrdinal })

      // Re-read after recalculation
      const recalculated = await readMonthDirect(budgetId, year, month)
      return recalculated || existingMonth
    }
    return existingMonth
  }

  // Create new month document with start balances from previous month
  return createMonth(budgetId, year, month)
}

/**
 * Query hook for month-level document
 *
 * Returns the complete month data including income, expenses, allocations,
 * and the previous month snapshot for cross-month calculations.
 *
 * @param budgetId - The budget ID
 * @param year - The year
 * @param month - The month (1-12)
 * @param options - Additional query options
 */
export function useMonthQuery(
  budgetId: string | null,
  year: number,
  month: number,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: budgetId ? queryKeys.month(budgetId, year, month) : ['month', 'none'],
    queryFn: async (): Promise<MonthQueryData> => {
      const monthData = await fetchMonth(budgetId!, year, month)
      return { month: monthData }
    },
    enabled: !!budgetId && (options?.enabled !== false),
  })
}

