/**
 * useMonthData Hook
 *
 * Provides month-level data (read-only).
 * Uses useMonthQuery internally and manages loading overlay.
 *
 * For mutations (add/update/delete transactions), import mutation hooks directly:
 *   import { useAddExpense, useUpdateExpense, useDeleteExpense } from '@data/mutations/month'
 *
 * Usage:
 *   const { month, income, expenses, transfers, adjustments, isLoading } = useMonthData(budgetId, year, month)
 */

import { useEffect, useMemo } from 'react'
import { useApp } from '@contexts'
import { useMonthQuery } from '@data'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys, STALE_TIME } from '@data/queryClient'
import type { MonthQueryData } from '@data/queries/month'
import type {
  MonthDocument,
  IncomeTransaction,
  ExpenseTransaction,
  TransferTransaction,
  AdjustmentTransaction,
  CategoryMonthBalance,
  AccountMonthBalance,
} from '@types'

interface UseMonthDataReturn {
  // Query state
  isLoading: boolean
  isFetching: boolean
  error: Error | null

  // Month document data
  month: MonthDocument | null
  income: IncomeTransaction[]
  expenses: ExpenseTransaction[]
  transfers: TransferTransaction[]
  adjustments: AdjustmentTransaction[]
  categoryBalances: CategoryMonthBalance[]
  accountBalances: AccountMonthBalance[]

  // Derived values
  totalIncome: number
  totalExpenses: number
  areAllocationsFinalized: boolean
  previousMonthIncome: number
}

export function useMonthData(
  budgetId: string | null,
  year: number,
  month: number
): UseMonthDataReturn {
  const { addLoadingHold, removeLoadingHold } = useApp()
  const queryClient = useQueryClient()

  // Query
  const monthQuery = useMonthQuery(budgetId, year, month, { enabled: !!budgetId })

  // Show loading overlay if month is not in cache, is stale, or is being refetched
  // This ensures we always show loading when fetching stale or missing data
  // NOTE: We depend on monthQuery.data so this effect re-runs when cache is populated externally
  useEffect(() => {
    const monthKey = budgetId ? queryKeys.month(budgetId, year, month) : null

    if (!monthKey) {
      removeLoadingHold('month-query')
      return
    }

    // Use monthQuery.data directly instead of checking cache separately
    // This ensures we react to React Query's state updates
    const hasData = !!monthQuery.data

    // Check if data is stale (older than STALE_TIME)
    const queryState = queryClient.getQueryState<MonthQueryData>(monthKey)
    const isStale = queryState?.dataUpdatedAt
      ? Date.now() - queryState.dataUpdatedAt > STALE_TIME
      : false

    // Show loading overlay if:
    // 1. Month data is not available (missing from query)
    // 2. Month is stale and being refetched (isFetching)
    // 3. Query is loading (initial fetch)
    const shouldShowLoading = !hasData || (isStale && monthQuery.isFetching) || monthQuery.isLoading

    if (shouldShowLoading) {
      addLoadingHold('month-query', 'Loading month data...')
    } else {
      removeLoadingHold('month-query')
    }
    return () => removeLoadingHold('month-query')
  }, [monthQuery.isLoading, monthQuery.isFetching, monthQuery.data, budgetId, year, month, queryClient, addLoadingHold, removeLoadingHold])

  // Extract data with stable references
  const monthData = monthQuery.data?.month || null

  const income = useMemo(() => monthData?.income || [], [monthData?.income])
  const expenses = useMemo(() => monthData?.expenses || [], [monthData?.expenses])
  const transfers = useMemo(() => monthData?.transfers || [], [monthData?.transfers])
  const adjustments = useMemo(() => monthData?.adjustments || [], [monthData?.adjustments])
  const categoryBalances = useMemo(() => monthData?.category_balances || [], [monthData?.category_balances])
  const accountBalances = useMemo(() => monthData?.account_balances || [], [monthData?.account_balances])

  // Derived values
  const totalIncome = monthData?.total_income || 0
  const totalExpenses = monthData?.total_expenses || 0
  const areAllocationsFinalized = monthData?.are_allocations_finalized || false
  const previousMonthIncome = monthData?.previous_month_income ?? 0

  return {
    // Query state
    isLoading: monthQuery.isLoading,
    isFetching: monthQuery.isFetching,
    error: monthQuery.error,

    // Data
    month: monthData,
    income,
    expenses,
    transfers,
    adjustments,
    categoryBalances,
    accountBalances,

    // Derived
    totalIncome,
    totalExpenses,
    areAllocationsFinalized,
    previousMonthIncome,
  }
}

