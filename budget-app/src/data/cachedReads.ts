/**
 * Cached Read Functions
 *
 * Provides React Query-backed read functions that can be called from anywhere
 * (not just React components). All reads go through queryClient.fetchQuery
 * to leverage caching and persistence.
 *
 * Use these instead of direct Firestore calls for reads.
 */

import { queryClient, queryKeys } from './queryClient'
import { readDoc, type FirestoreData } from './firestore/operations'

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
      const { exists, data } = await readDoc<FirestoreData>(
        'budgets',
        budgetId,
        'fetching raw budget document (React Query cache miss)'
      )
      return exists ? data : null
    },
    staleTime: 5 * 60 * 1000,
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
      const { exists, data } = await readDoc<{
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

import type { CategoryMonthBalance, MonthDocument } from '../types/budget'
import { getMonthDocId } from './firestore/operations'

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
  category_balances_stale?: boolean
  allocations_finalized?: boolean
  allocations?: Array<{ category_id: string; amount: number }>
  expenses?: Array<{ category_id: string; amount: number }>
}

/**
 * Fetch a single month document for balance calculations
 * Uses React Query cache via the existing month query
 */
async function fetchMonthForBalances(
  budgetId: string,
  year: number,
  month: number
): Promise<MonthBalanceData | null> {
  const monthDocId = getMonthDocId(budgetId, year, month)

  // Try to get from cache first
  const cached = queryClient.getQueryData<{ month: MonthDocument }>(queryKeys.month(budgetId, year, month))
  if (cached?.month) {
    return {
      year: cached.month.year,
      month: cached.month.month,
      category_balances: cached.month.category_balances,
      category_balances_stale: cached.month.category_balances_stale,
      allocations_finalized: cached.month.allocations_finalized,
      allocations: cached.month.allocations,
      expenses: cached.month.expenses,
    }
  }

  // Fetch from Firestore
  const { exists, data } = await readDoc<MonthBalanceData>(
    'months',
    monthDocId,
    `fetching month for balance calculation (not in cache, walking ${year}/${month})`
  )
  return exists ? data : null
}

/**
 * Get previous month's year and month
 */
function getPreviousMonth(year: number, month: number): { year: number; month: number } {
  if (month === 1) {
    return { year: year - 1, month: 12 }
  }
  return { year, month: month - 1 }
}

/**
 * Get next month's year and month
 */
function getNextMonth(year: number, month: number): { year: number; month: number } {
  if (month === 12) {
    return { year: year + 1, month: 1 }
  }
  return { year, month: month + 1 }
}

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
  const currentMonthData = await fetchMonthForBalances(budgetId, currentYear, currentMonth)

  if (currentMonthData?.category_balances && !currentMonthData.category_balances_stale) {
    // Use cached balances directly
    for (const bal of currentMonthData.category_balances) {
      if (categoryIds.includes(bal.category_id)) {
        balances[bal.category_id] = bal.end_balance
      }
    }
    return balances
  }

  // Step 2: Walk backwards to find a valid starting point
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
    } else if (prevMonthData.category_balances && !prevMonthData.category_balances_stale) {
      // Found a valid month - use its end_balance as our starting point
      foundValidStart = true
      for (const bal of prevMonthData.category_balances) {
        if (categoryIds.includes(bal.category_id)) {
          startingBalances[bal.category_id] = bal.end_balance
        }
      }
    } else {
      // This month is stale too - add to list and keep walking
      monthsToCompute.push(prevMonthData)
    }
  }

  // Step 3: Compute forward from starting point
  // Reverse the list so we process oldest first
  monthsToCompute.reverse()

  // Start with the balances from our valid starting point
  Object.assign(balances, startingBalances)

  for (const monthData of monthsToCompute) {
    // Add allocations if finalized
    if (monthData.allocations_finalized && monthData.allocations) {
      for (const alloc of monthData.allocations) {
        if (categoryIds.includes(alloc.category_id)) {
          balances[alloc.category_id] = (balances[alloc.category_id] || 0) + alloc.amount
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

    // Add allocations if finalized
    if (nextMonthData.allocations_finalized && nextMonthData.allocations) {
      for (const alloc of nextMonthData.allocations) {
        if (categoryIds.includes(alloc.category_id)) {
          balances[alloc.category_id] = (balances[alloc.category_id] || 0) + alloc.amount
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
 * Uses the budget-level snapshot for "total" if available and not stale.
 * Otherwise falls back to walk-forward calculation.
 *
 * @param budgetId - Budget to calculate for
 * @param categoryIds - Categories to include
 * @param currentYear - Current year
 * @param currentMonth - Current month (1-12)
 * @param budgetSnapshot - Budget-level snapshot (if available)
 * @returns { current, total } balances
 */
export async function calculateCategoryBalances(
  budgetId: string,
  categoryIds: string[],
  currentYear: number,
  currentMonth: number,
  budgetSnapshot?: {
    is_stale: boolean
    computed_for_year: number
    computed_for_month: number
    balances: Record<string, { current: number; total: number }>
  } | null
): Promise<CategoryBalanceResult> {
  // Calculate current balances (walk backwards if needed)
  const current = await calculateCurrentBalances(budgetId, categoryIds, currentYear, currentMonth)

  // For total: try to use budget snapshot first
  let total: Record<string, number>

  const snapshotValid = budgetSnapshot &&
    !budgetSnapshot.is_stale &&
    budgetSnapshot.computed_for_year === currentYear &&
    budgetSnapshot.computed_for_month === currentMonth

  if (snapshotValid) {
    // Use snapshot for total balances
    total = {}
    categoryIds.forEach(id => {
      total[id] = budgetSnapshot.balances[id]?.total ?? current[id] ?? 0
    })
  } else {
    // Walk forward to calculate total
    total = await calculateTotalBalances(budgetId, categoryIds, current, currentYear, currentMonth)
  }

  return { current, total }
}

