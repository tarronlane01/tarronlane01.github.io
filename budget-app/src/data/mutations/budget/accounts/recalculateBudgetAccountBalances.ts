/**
 * Recalculate Budget Account Balances from Cache
 *
 * Recalculates account balances in the budget by summing all transactions
 * from all months in the cache. This ensures accuracy even if some
 * local recalculations failed.
 *
 * This function:
 * 1. Gets all months from cache (or at least the ones that exist)
 * 2. Sums income, expenses, transfers, and adjustments for each account
 * 3. Updates the budget cache with new account balances
 * 4. Recalculates total_available
 */

import { queryKeys, queryClient } from '@data/queryClient'
import type { BudgetData } from '@data/queries/budget'
import type { MonthQueryData } from '@data/queries/month'
import { roundCurrency } from '@utils'
import { isNoAccount } from '@data/constants'

/**
 * Recalculate account balances from all months in cache.
 * Returns a map of accountId -> balance.
 *
 * Algorithm:
 * 1. Find the earliest month for each account (to get initial balance)
 * 2. Start from that initial balance
 * 3. Sum all transactions from all months
 */
function calculateAccountBalancesFromCache(
  budgetId: string,
  accounts: Record<string, { balance: number }>
): Record<string, number> {
  const accountBalances: Record<string, number> = {}

  // Initialize all accounts to 0 (we'll set initial balance from first month)
  Object.keys(accounts).forEach(accId => {
    accountBalances[accId] = 0
  })

  // Get all months from cache by iterating through month_map
  const budgetData = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
  if (!budgetData) {
    return accountBalances
  }

  const monthMap = budgetData.budget.month_map || {}
  const sortedOrdinals = Object.keys(monthMap).sort()

  // First pass: Find initial balances from the earliest month for each account
  for (const ordinal of sortedOrdinals) {
    const year = parseInt(ordinal.substring(0, 4), 10)
    const month = parseInt(ordinal.substring(4, 6), 10)
    const monthKey = queryKeys.month(budgetId, year, month)
    const monthQueryData = queryClient.getQueryData<MonthQueryData>(monthKey)

    if (!monthQueryData?.month) {
      continue // Month not in cache, skip it
    }

    const monthDoc = monthQueryData.month

    // Set initial balance from this month's start_balance if not set yet
    for (const ab of monthDoc.account_balances || []) {
      if (ab.account_id && !isNoAccount(ab.account_id) && accountBalances[ab.account_id] === 0) {
        accountBalances[ab.account_id] = ab.start_balance ?? 0
      }
    }
  }

  // Second pass: Sum all transactions from all months
  for (const ordinal of sortedOrdinals) {
    const year = parseInt(ordinal.substring(0, 4), 10)
    const month = parseInt(ordinal.substring(4, 6), 10)
    const monthKey = queryKeys.month(budgetId, year, month)
    const monthQueryData = queryClient.getQueryData<MonthQueryData>(monthKey)

    if (!monthQueryData?.month) {
      continue // Month not in cache, skip it
    }

    const monthDoc = monthQueryData.month

    // Sum income
    for (const inc of monthDoc.income || []) {
      if (inc.account_id && !isNoAccount(inc.account_id) && accountBalances[inc.account_id] !== undefined) {
        accountBalances[inc.account_id] += inc.amount
      }
    }

    // Sum expenses (note: expenses follow CSV convention - negative = money out)
    for (const exp of monthDoc.expenses || []) {
      if (exp.account_id && !isNoAccount(exp.account_id) && accountBalances[exp.account_id] !== undefined) {
        accountBalances[exp.account_id] += exp.amount // Already includes sign
      }
    }

    // Sum transfers (transfers TO account add, transfers FROM account subtract)
    for (const transfer of monthDoc.transfers || []) {
      if (transfer.to_account_id && !isNoAccount(transfer.to_account_id) && accountBalances[transfer.to_account_id] !== undefined) {
        accountBalances[transfer.to_account_id] += transfer.amount
      }
      if (transfer.from_account_id && !isNoAccount(transfer.from_account_id) && accountBalances[transfer.from_account_id] !== undefined) {
        accountBalances[transfer.from_account_id] -= transfer.amount
      }
    }

    // Sum adjustments
    for (const adj of monthDoc.adjustments || []) {
      if (adj.account_id && !isNoAccount(adj.account_id) && accountBalances[adj.account_id] !== undefined) {
        accountBalances[adj.account_id] += adj.amount
      }
    }
  }

  // Round all final balances
  for (const accId of Object.keys(accountBalances)) {
    accountBalances[accId] = roundCurrency(accountBalances[accId])
  }

  return accountBalances
}

/**
 * Recalculate budget account balances from all months in cache and update the cache.
 * This should be called before saving the budget to ensure accuracy.
 */
export function recalculateBudgetAccountBalancesFromCache(budgetId: string): void {
  const cachedBudget = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
  if (!cachedBudget) {
    console.warn('[recalculateBudgetAccountBalancesFromCache] Budget not in cache')
    return
  }

  // Calculate new account balances from all months in cache
  const newAccountBalances = calculateAccountBalancesFromCache(budgetId, cachedBudget.accounts)

  // Update accounts in cache
  const updatedAccounts: Record<string, BudgetData['accounts'][string]> = {}
  for (const [accountId, account] of Object.entries(cachedBudget.accounts)) {
    updatedAccounts[accountId] = {
      ...account,
      balance: newAccountBalances[accountId] ?? account.balance,
    }
  }

  // Update budget cache (don't save total_available to Firestore - it's calculated on-the-fly)
  queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
    ...cachedBudget,
    accounts: updatedAccounts,
    budget: {
      ...cachedBudget.budget,
      accounts: updatedAccounts,
      // Don't save total_available - it's calculated on-the-fly
    },
  })
}

