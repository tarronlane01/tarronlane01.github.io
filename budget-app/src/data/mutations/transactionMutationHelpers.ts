/**
 * Transaction Mutation Helpers
 * 
 * Shared utilities for expense and income mutations to reduce code duplication.
 */

import type { QueryClient } from '@tanstack/react-query'
import { queryKeys } from '../queryClient'
import type { MonthQueryData } from '../queries/useMonthQuery'
import { markNextMonthSnapshotStaleInCache } from '../queries/useMonthQuery'
import type { BudgetData } from '../queries/useBudgetQuery'
import type { AccountsMap } from '../../types/budget'
import {
  markCategoryBalancesSnapshotStaleInCache,
  markMonthCategoryBalancesStaleInCache,
  markFutureMonthsCategoryBalancesStaleInCache,
  markCategoryBalancesSnapshotStaleInFirestore,
  markMonthCategoryBalancesStaleInFirestore,
  markFutureMonthsCategoryBalancesStaleInFirestore,
} from './monthMutationHelpers'
import {
  markAccountBalancesSnapshotStaleInCache,
  markMonthAccountBalancesStaleInCache,
  markFutureMonthsAccountBalancesStaleInCache,
  markAccountBalancesSnapshotStaleInFirestore,
  markMonthAccountBalancesStaleInFirestore,
  markFutureMonthsAccountBalancesStaleInFirestore,
} from './accountBalanceStaleHelpers'

/**
 * Cancel active queries for month and budget
 */
export async function cancelTransactionQueries(
  queryClient: QueryClient,
  budgetId: string,
  year: number,
  month: number
): Promise<{ monthKey: readonly (string | number)[]; budgetKey: readonly string[] }> {
  const monthKey = queryKeys.month(budgetId, year, month)
  const budgetKey = queryKeys.budget(budgetId)
  await queryClient.cancelQueries({ queryKey: monthKey })
  await queryClient.cancelQueries({ queryKey: budgetKey })
  return { monthKey, budgetKey }
}

/**
 * Get previous cache data for rollback
 */
export function getPreviousData(
  queryClient: QueryClient,
  monthKey: readonly (string | number)[],
  budgetKey: readonly string[]
): { previousMonth: MonthQueryData | undefined; previousBudget: BudgetData | undefined } {
  return {
    previousMonth: queryClient.getQueryData<MonthQueryData>(monthKey),
    previousBudget: queryClient.getQueryData<BudgetData>(budgetKey),
  }
}

/**
 * Mark all balance-related caches as stale (for onMutate)
 */
export function markAllBalancesStaleInCache(
  budgetId: string,
  year: number,
  month: number,
  options: { includeCategoryBalances?: boolean } = {}
): void {
  const { includeCategoryBalances = true } = options
  
  markNextMonthSnapshotStaleInCache(budgetId, year, month)
  markAccountBalancesSnapshotStaleInCache(budgetId)
  markMonthAccountBalancesStaleInCache(budgetId, year, month)
  markFutureMonthsAccountBalancesStaleInCache(budgetId, year, month)
  
  if (includeCategoryBalances) {
    markCategoryBalancesSnapshotStaleInCache(budgetId)
    markMonthCategoryBalancesStaleInCache(budgetId, year, month)
    markFutureMonthsCategoryBalancesStaleInCache(budgetId, year, month)
  }
}

/**
 * Mark all balance-related Firestore documents as stale (for mutationFn)
 */
export async function markAllBalancesStaleInFirestore(
  budgetId: string,
  year: number,
  month: number,
  options: { includeCategoryBalances?: boolean } = {}
): Promise<void> {
  const { includeCategoryBalances = true } = options
  
  await markAccountBalancesSnapshotStaleInFirestore(budgetId)
  await markMonthAccountBalancesStaleInFirestore(budgetId, year, month)
  await markFutureMonthsAccountBalancesStaleInFirestore(budgetId, year, month)
  
  if (includeCategoryBalances) {
    await markCategoryBalancesSnapshotStaleInFirestore(budgetId)
    await markMonthCategoryBalancesStaleInFirestore(budgetId, year, month)
    await markFutureMonthsCategoryBalancesStaleInFirestore(budgetId, year, month)
  }
}

/**
 * Optimistically update account balance in cache
 */
export function updateAccountBalanceInCache(
  queryClient: QueryClient,
  budgetKey: readonly string[],
  previousBudget: BudgetData | undefined,
  accountId: string,
  balanceChange: number
): void {
  if (previousBudget && previousBudget.accounts[accountId]) {
    queryClient.setQueryData<BudgetData>(budgetKey, {
      ...previousBudget,
      accounts: {
        ...previousBudget.accounts,
        [accountId]: {
          ...previousBudget.accounts[accountId],
          balance: previousBudget.accounts[accountId].balance + balanceChange,
        },
      },
    })
  }
}

/**
 * Handle account change - update both old and new account balances
 */
export function handleAccountChangeInCache(
  queryClient: QueryClient,
  budgetKey: readonly string[],
  previousBudget: BudgetData | undefined,
  oldAccountId: string,
  newAccountId: string,
  oldAmount: number,
  newAmount: number,
  isIncome: boolean
): void {
  if (!previousBudget) return
  
  const updatedAccounts = { ...previousBudget.accounts }
  const sign = isIncome ? 1 : -1
  
  if (newAccountId !== oldAccountId) {
    // Different accounts - reverse old, apply new
    if (updatedAccounts[oldAccountId]) {
      updatedAccounts[oldAccountId] = {
        ...updatedAccounts[oldAccountId],
        balance: updatedAccounts[oldAccountId].balance - (oldAmount * sign),
      }
    }
    if (updatedAccounts[newAccountId]) {
      updatedAccounts[newAccountId] = {
        ...updatedAccounts[newAccountId],
        balance: updatedAccounts[newAccountId].balance + (newAmount * sign),
      }
    }
  } else if (newAmount !== oldAmount && updatedAccounts[newAccountId]) {
    // Same account, different amount - adjust difference
    updatedAccounts[newAccountId] = {
      ...updatedAccounts[newAccountId],
      balance: updatedAccounts[newAccountId].balance + ((newAmount - oldAmount) * sign),
    }
  }
  
  queryClient.setQueryData<BudgetData>(budgetKey, {
    ...previousBudget,
    accounts: updatedAccounts,
  })
}

/**
 * Update accounts cache with server response
 */
export function updateAccountsFromServer(
  queryClient: QueryClient,
  budgetId: string,
  updatedAccounts: AccountsMap | null
): void {
  if (!updatedAccounts) return
  
  const budgetKey = queryKeys.budget(budgetId)
  const currentBudget = queryClient.getQueryData<BudgetData>(budgetKey)
  if (currentBudget) {
    queryClient.setQueryData<BudgetData>(budgetKey, {
      ...currentBudget,
      accounts: updatedAccounts,
    })
  }
}

/**
 * Rollback cache on error
 */
export function rollbackOnError(
  queryClient: QueryClient,
  budgetId: string,
  year: number,
  month: number,
  context: { previousMonth?: MonthQueryData; previousBudget?: BudgetData } | undefined
): void {
  if (context?.previousMonth) {
    queryClient.setQueryData(queryKeys.month(budgetId, year, month), context.previousMonth)
  }
  if (context?.previousBudget) {
    queryClient.setQueryData(queryKeys.budget(budgetId), context.previousBudget)
  }
}

