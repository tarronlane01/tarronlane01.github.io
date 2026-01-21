/**
 * Initial Data Load Hook
 *
 * Loads and caches initial data on app load:
 * - Last 3 months, current month, and all future months
 * - Budget document
 * - Payees document
 *
 * Uses efficient Firebase queries to minimize reads.
 */

import { useQuery } from '@tanstack/react-query'
import { fetchBudget } from '@data/queries/budget/fetchBudget'
import { fetchPayees } from '@data/queries/payees/fetchPayees'
// eslint-disable-next-line no-restricted-imports
import { queryCollection } from '@firestore'
import { getYearMonthOrdinal } from '@utils'
import type { MonthDocument, FirestoreData } from '@types'
import { convertMonthBalancesFromStored } from '@data/firestore/converters/monthBalances'

// ============================================================================
// TYPES
// ============================================================================

interface InitialDataLoadResult {
  budget: Awaited<ReturnType<typeof fetchBudget>>
  payees: string[]
  months: MonthDocument[]
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse raw Firestore month data into typed MonthDocument.
 */
function parseMonthData(data: FirestoreData, budgetId: string, year: number, month: number): MonthDocument {
  const monthDoc: MonthDocument = {
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

  // Convert stored balances to calculated balances
  return convertMonthBalancesFromStored(monthDoc)
}

/**
 * Fetch months for initial load: last 3 months, current month, and all future months.
 * Uses a single query to get all months from 3 months ago forward.
 */
async function fetchInitialMonths(budgetId: string): Promise<MonthDocument[]> {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  // Calculate 3 months ago
  let threeMonthsAgoYear = currentYear
  let threeMonthsAgoMonth = currentMonth - 3
  while (threeMonthsAgoMonth <= 0) {
    threeMonthsAgoMonth += 12
    threeMonthsAgoYear -= 1
  }

  const threeMonthsAgoOrdinal = getYearMonthOrdinal(threeMonthsAgoYear, threeMonthsAgoMonth)

  // Query all months from 3 months ago forward
  const monthsResult = await queryCollection<FirestoreData>(
    'months',
    'useInitialDataLoad: loading initial months',
    [
      { field: 'budget_id', op: '==', value: budgetId },
      { field: 'year_month_ordinal', op: '>=', value: threeMonthsAgoOrdinal },
    ]
  )

  // Parse and sort months chronologically
  const months: MonthDocument[] = monthsResult.docs
    .map(doc => {
      const data = doc.data
      const year = data.year as number
      const month = data.month as number
      return parseMonthData(data, budgetId, year, month)
    })
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year
      return a.month - b.month
    })

  return months
}

/**
 * Fetch all initial data in parallel.
 */
async function fetchInitialData(budgetId: string): Promise<InitialDataLoadResult> {
  const [budget, payees, months] = await Promise.all([
    fetchBudget(budgetId),
    fetchPayees(budgetId),
    fetchInitialMonths(budgetId),
  ])

  return {
    budget,
    payees,
    months,
  }
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook for loading initial data on app start.
 * Loads budget, payees, and months (last 3, current, all future) in parallel.
 *
 * @param budgetId - The budget ID to load data for
 * @param options - Additional query options
 */
export function useInitialDataLoad(
  budgetId: string | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: budgetId ? ['initialDataLoad', budgetId] : ['initialDataLoad', 'none'],
    queryFn: () => fetchInitialData(budgetId!),
    enabled: !!budgetId && (options?.enabled !== false),
    staleTime: Infinity, // Initial load data is considered fresh until explicitly invalidated
  })
}

