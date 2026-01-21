/**
 * React Query cache utilities for calculated balances.
 * 
 * Stores calculated balances (with spent, transfers, adjustments, end_balance)
 * in React Query cache, keyed by month data. Invalidates when transactions change.
 */

import { queryClient, queryKeys } from '@data/queryClient'
import type { MonthQueryData } from '@data/queries/month'
import type { CategoryMonthBalance, CategoryMonthBalanceStored } from '@types'
import type { AccountMonthBalance, AccountMonthBalanceStored } from '@types'
import { calculateCategoryBalances } from '@utils/calculations/balances/calculateCategoryBalancesFromTransactions'
import { calculateAccountBalances } from '@utils/calculations/balances/calculateAccountBalancesFromTransactions'

/**
 * Generate a hash of transaction arrays for cache invalidation.
 * When transactions change, this hash changes, triggering recalculation.
 */
function getTransactionHash(
  expenses: unknown[],
  transfers: unknown[],
  adjustments: unknown[]
): string {
  // Simple hash based on array lengths and first/last item IDs if available
  // This is fast and sufficient for cache invalidation
  const expenseHash = expenses.length > 0 
    ? `${expenses.length}-${(expenses[0] as { id?: string })?.id || '0'}-${(expenses[expenses.length - 1] as { id?: string })?.id || '0'}`
    : '0'
  const transferHash = transfers.length > 0
    ? `${transfers.length}-${(transfers[0] as { id?: string })?.id || '0'}-${(transfers[transfers.length - 1] as { id?: string })?.id || '0'}`
    : '0'
  const adjustmentHash = adjustments.length > 0
    ? `${adjustments.length}-${(adjustments[0] as { id?: string })?.id || '0'}-${(adjustments[adjustments.length - 1] as { id?: string })?.id || '0'}`
    : '0'
  return `${expenseHash}|${transferHash}|${adjustmentHash}`
}

/**
 * Get calculated category balances for a month from cache or calculate them.
 * 
 * @param budgetId - Budget ID
 * @param year - Year
 * @param month - Month (1-12)
 * @returns Calculated category balances array
 */
export function getCalculatedCategoryBalances(
  budgetId: string,
  year: number,
  month: number
): CategoryMonthBalance[] {
  const monthKey = queryKeys.month(budgetId, year, month)
  const monthData = queryClient.getQueryData<MonthQueryData>(monthKey)
  
  if (!monthData?.month) {
    return []
  }

  const m = monthData.month
  const transactionHash = getTransactionHash(m.expenses || [], m.transfers || [], m.adjustments || [])
  const cacheKey = ['calculatedCategoryBalances', budgetId, year, month, transactionHash] as const

  // Check cache first
  const cached = queryClient.getQueryData<CategoryMonthBalance[]>(cacheKey)
  if (cached) {
    return cached
  }

  // Calculate from stored balances and transactions
  const storedBalances: CategoryMonthBalanceStored[] = (m.category_balances || []).map(cb => ({
    category_id: cb.category_id,
    start_balance: cb.start_balance,
    allocated: cb.allocated,
  }))

  const calculated = calculateCategoryBalances(
    storedBalances,
    m.expenses || [],
    m.transfers || [],
    m.adjustments || []
  )

  // Store in cache (never stale - invalidate manually)
  queryClient.setQueryData(cacheKey, calculated)

  return calculated
}

/**
 * Get calculated account balances for a month from cache or calculate them.
 * 
 * @param budgetId - Budget ID
 * @param year - Year
 * @param month - Month (1-12)
 * @returns Calculated account balances array
 */
export function getCalculatedAccountBalances(
  budgetId: string,
  year: number,
  month: number
): AccountMonthBalance[] {
  const monthKey = queryKeys.month(budgetId, year, month)
  const monthData = queryClient.getQueryData<MonthQueryData>(monthKey)
  
  if (!monthData?.month) {
    return []
  }

  const m = monthData.month
  const transactionHash = getTransactionHash(
    m.expenses || [],
    m.transfers || [],
    m.adjustments || []
  )
  const cacheKey = ['calculatedAccountBalances', budgetId, year, month, transactionHash] as const

  // Check cache first
  const cached = queryClient.getQueryData<AccountMonthBalance[]>(cacheKey)
  if (cached) {
    return cached
  }

  // Calculate from stored balances and transactions
  const storedBalances: AccountMonthBalanceStored[] = (m.account_balances || []).map(ab => ({
    account_id: ab.account_id,
    start_balance: ab.start_balance,
  }))

  const calculated = calculateAccountBalances(
    storedBalances,
    m.income || [],
    m.expenses || [],
    m.transfers || [],
    m.adjustments || []
  )

  // Store in cache (never stale - invalidate manually)
  queryClient.setQueryData(cacheKey, calculated)

  return calculated
}

/**
 * Invalidate calculated balances for a month.
 * Call this when transactions change.
 * 
 * @param budgetId - Budget ID
 * @param year - Year
 * @param month - Month (1-12)
 */
export function invalidateCalculatedBalances(
  budgetId: string,
  year: number,
  month: number
): void {
  queryClient.invalidateQueries({
    queryKey: ['calculatedCategoryBalances', budgetId, year, month],
  })
  queryClient.invalidateQueries({
    queryKey: ['calculatedAccountBalances', budgetId, year, month],
  })
}

/**
 * Set calculated balances in cache (for optimistic updates).
 * 
 * @param budgetId - Budget ID
 * @param year - Year
 * @param month - Month (1-12)
 * @param categoryBalances - Calculated category balances
 * @param accountBalances - Calculated account balances
 */
export function setCalculatedBalances(
  budgetId: string,
  year: number,
  month: number,
  categoryBalances: CategoryMonthBalance[],
  accountBalances: AccountMonthBalance[]
): void {
  const monthKey = queryKeys.month(budgetId, year, month)
  const monthData = queryClient.getQueryData<MonthQueryData>(monthKey)
  
  if (!monthData?.month) {
    return
  }

  const m = monthData.month
  const transactionHash = getTransactionHash(m.expenses || [], m.transfers || [], m.adjustments || [])
  
  queryClient.setQueryData(
    ['calculatedCategoryBalances', budgetId, year, month, transactionHash] as const,
    categoryBalances
  )
  queryClient.setQueryData(
    ['calculatedAccountBalances', budgetId, year, month, transactionHash] as const,
    accountBalances
  )
}
