/**
 * Cached Read Functions
 *
 * Provides React Query-backed read functions that can be called from anywhere
 * (not just React components). All reads go through queryClient.fetchQuery
 * to leverage caching and persistence.
 *
 * Use these instead of direct Firestore calls for reads.
 */

import { queryClient, queryKeys, STALE_TIME } from './queryClient'
import { readDocByPath } from '@firestore'
import type { FirestoreData } from '@types'
import { readMonth } from './queries/month'
import { getPreviousMonth, getNextMonth } from '@utils'

/**
 * Fetch a budget document - uses React Query cache
 *
 * Note: Prefer useBudgetQuery hook in React components.
 * Use this only when you need to fetch outside of React context.
 *
 * @param budgetId - The budget to fetch
 * @returns Raw budget document data or null if not found
 */
export async function fetchBudgetDocument(budgetId: string): Promise<FirestoreData | null> {
  return queryClient.fetchQuery({
    queryKey: [...queryKeys.budget(budgetId), 'raw'] as const,
    queryFn: async () => {
      const { exists, data } = await readDocByPath<FirestoreData>(
        'budgets',
        budgetId,
        'fetching raw budget document (React Query cache miss)'
      )
      return exists ? data : null
    },
    staleTime: STALE_TIME,
  })
}

/**
 * Check if a user has a pending invite for a budget
 * Uses React Query cache
 */
export async function fetchBudgetInviteStatus(
  budgetId: string,
  userId: string
): Promise<{ isInvited: boolean; hasAccepted: boolean; budgetName: string; ownerEmail: string | null } | null> {
  return queryClient.fetchQuery({
    queryKey: ['budgetInvite', budgetId, userId] as const,
    queryFn: async () => {
      const { exists, data } = await readDocByPath<{
        user_ids?: string[]
        accepted_user_ids?: string[]
        name?: string
        owner_email?: string
      }>(
        'budgets',
        budgetId,
        'checking if user has pending invite for budget'
      )

      if (!exists || !data) return null

      return {
        isInvited: data.user_ids?.includes(userId) ?? false,
        hasAccepted: data.accepted_user_ids?.includes(userId) ?? false,
        budgetName: data.name || 'Unnamed Budget',
        ownerEmail: data.owner_email || null,
      }
    },
    staleTime: 60 * 1000, // 1 minute - invites don't change often
  })
}

// ============================================================================
// CATEGORY BALANCE CALCULATION (optimized walk-back/walk-forward)
// ============================================================================

import type { CategoryMonthBalance } from '@types'

/** Result of category balance calculation */
export interface CategoryBalanceResult {
  /** Balance available as of current month (allocations - expenses through current month) */
  current: Record<string, number>
  /** Total balance including future months (all finalized allocations - all expenses) */
  total: Record<string, number>
}

/** Month data needed for balance calculations */
interface MonthBalanceData {
  year: number
  month: number
  category_balances?: CategoryMonthBalance[]
  are_allocations_finalized?: boolean
  expenses?: Array<{ category_id: string; amount: number }>
}

/**
 * Fetch a single month document for balance calculations
 * Uses readMonth which handles caching and stale resolution.
 *
 * Note: Uses resolveStale: true (default) so stale snapshots are resolved on read.
 * This ensures balance calculations use accurate data.
 */
async function fetchMonthForBalances(
  budgetId: string,
  year: number,
  month: number
): Promise<MonthBalanceData | null> {
  // Use readMonth which handles caching and resolves stale snapshots
  const monthDoc = await readMonth(budgetId, year, month, {
    description: `fetching month for balance calculation (walking ${year}/${month})`,
  })

  if (!monthDoc) {
    return null
  }

  // Return just the data needed for balance calculations
  return {
    year: monthDoc.year,
    month: monthDoc.month,
    category_balances: monthDoc.category_balances,
    are_allocations_finalized: monthDoc.are_allocations_finalized,
    expenses: monthDoc.expenses,
  }
}

/**
 * Get next month's year and month
 */
// getNextMonth is imported from constants/date

/**
 * Calculate "current" category balances by walking backwards to find a valid starting point.
 *
 * Algorithm:
 * 1. Check if current month has valid (non-stale) category_balances
 * 2. If yes, use end_balance values directly
 * 3. If no, walk backwards until we find a valid month or reach the beginning
 * 4. Compute forward from that starting point
 *
 * @param budgetId - Budget to calculate for
 * @param categoryIds - Categories to include in result
 * @param currentYear - Current year
 * @param currentMonth - Current month (1-12)
 * @returns Record of category_id -> end_balance as of current month
 */
export async function calculateCurrentBalances(
  budgetId: string,
  categoryIds: string[],
  currentYear: number,
  currentMonth: number
): Promise<Record<string, number>> {
  // Initialize balances
  const balances: Record<string, number> = {}
  categoryIds.forEach(id => { balances[id] = 0 })

  // Step 1: Check current month
  // Note: Recalculation status is now tracked in the budget's month_map.
  // This function assumes months are up to date. Recalculation is triggered
  // separately when viewing the Categories tab (see MonthCategories.tsx).
  const currentMonthData = await fetchMonthForBalances(budgetId, currentYear, currentMonth)

  if (currentMonthData?.category_balances) {
    // Use cached balances directly
    for (const bal of currentMonthData.category_balances) {
      if (categoryIds.includes(bal.category_id)) {
        balances[bal.category_id] = bal.end_balance
      }
    }
    return balances
  }

  // No category balances found for current month, walk backwards to find a valid starting point
  const startingBalances: Record<string, number> = {}
  categoryIds.forEach(id => { startingBalances[id] = 0 })

  // Track months we need to compute (in reverse order)
  const monthsToCompute: MonthBalanceData[] = []
  if (currentMonthData) {
    monthsToCompute.push(currentMonthData)
  }

  let walkYear = currentYear
  let walkMonth = currentMonth
  let foundValidStart = false
  const maxWalkBack = 120 // Don't walk back more than 10 years

  for (let i = 0; i < maxWalkBack && !foundValidStart; i++) {
    const prev = getPreviousMonth(walkYear, walkMonth)
    walkYear = prev.year
    walkMonth = prev.month

    const prevMonthData = await fetchMonthForBalances(budgetId, walkYear, walkMonth)

    if (!prevMonthData) {
      // No more months - start from zero
      foundValidStart = true
    } else if (prevMonthData.category_balances) {
      // Found a month with balances - use its end_balance as our starting point
      foundValidStart = true
      for (const bal of prevMonthData.category_balances) {
        if (categoryIds.includes(bal.category_id)) {
          startingBalances[bal.category_id] = bal.end_balance
        }
      }
    } else {
      // This month has no balances yet - add to list and keep walking
      monthsToCompute.push(prevMonthData)
    }
  }

  // Step 3: Compute forward from starting point
  // Reverse the list so we process oldest first
  monthsToCompute.reverse()

  // Start with the balances from our valid starting point
  Object.assign(balances, startingBalances)

  for (const monthData of monthsToCompute) {
    // Add allocations if finalized (from category_balances)
    if (monthData.are_allocations_finalized && monthData.category_balances) {
      for (const cb of monthData.category_balances) {
        if (categoryIds.includes(cb.category_id)) {
          balances[cb.category_id] = (balances[cb.category_id] || 0) + cb.allocated
        }
      }
    }

    // Subtract expenses
    if (monthData.expenses) {
      for (const expense of monthData.expenses) {
        if (categoryIds.includes(expense.category_id)) {
          balances[expense.category_id] = (balances[expense.category_id] || 0) - expense.amount
        }
      }
    }
  }

  return balances
}

/**
 * Calculate "total" category balances including future months.
 *
 * Algorithm:
 * 1. Start with current month's end_balance (from calculateCurrentBalances)
 * 2. Walk forward through all future months
 * 3. Add finalized allocations, subtract expenses
 *
 * @param budgetId - Budget to calculate for
 * @param categoryIds - Categories to include
 * @param currentBalances - Result from calculateCurrentBalances
 * @param currentYear - Current year
 * @param currentMonth - Current month (1-12)
 * @returns Record of category_id -> total balance including future
 */
export async function calculateTotalBalances(
  budgetId: string,
  categoryIds: string[],
  currentBalances: Record<string, number>,
  currentYear: number,
  currentMonth: number
): Promise<Record<string, number>> {
  // Start with current balances
  const balances: Record<string, number> = { ...currentBalances }

  // Walk forward through future months
  let walkYear = currentYear
  let walkMonth = currentMonth
  const maxWalkForward = 24 // Look at most 2 years ahead

  for (let i = 0; i < maxWalkForward; i++) {
    const next = getNextMonth(walkYear, walkMonth)
    walkYear = next.year
    walkMonth = next.month

    const nextMonthData = await fetchMonthForBalances(budgetId, walkYear, walkMonth)

    if (!nextMonthData) {
      // No more future months
      break
    }

    // Add allocations if finalized (from category_balances)
    if (nextMonthData.are_allocations_finalized && nextMonthData.category_balances) {
      for (const cb of nextMonthData.category_balances) {
        if (categoryIds.includes(cb.category_id)) {
          balances[cb.category_id] = (balances[cb.category_id] || 0) + cb.allocated
        }
      }
    }

    // Subtract expenses
    if (nextMonthData.expenses) {
      for (const expense of nextMonthData.expenses) {
        if (categoryIds.includes(expense.category_id)) {
          balances[expense.category_id] = (balances[expense.category_id] || 0) - expense.amount
        }
      }
    }
  }

  return balances
}

/**
 * Calculate both current and total category balances efficiently.
 *
 * Uses walk-back/walk-forward approach to calculate accurate balances.
 *
 * @param budgetId - Budget to calculate for
 * @param categoryIds - Categories to include
 * @param currentYear - Current year
 * @param currentMonth - Current month (1-12)
 * @param _unused - Deprecated parameter, kept for backward compatibility
 * @returns { current, total } balances
 */
export async function calculateCategoryBalances(
  budgetId: string,
  categoryIds: string[],
  currentYear: number,
  currentMonth: number
): Promise<CategoryBalanceResult> {
  // Calculate current balances (walk backwards if needed)
  const current = await calculateCurrentBalances(budgetId, categoryIds, currentYear, currentMonth)

  // Walk forward to calculate total
  const total = await calculateTotalBalances(budgetId, categoryIds, current, currentYear, currentMonth)

  return { current, total }
}
