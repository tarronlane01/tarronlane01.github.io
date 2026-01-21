/**
 * Helper functions for Trigger Recalculation module
 */

import type { FirestoreData, MonthMap, MonthDocument } from '@types'
import { readDocByPath } from '@firestore'
import { getMonthDocId, getYearMonthOrdinal, roundCurrency } from '@utils'
import { queryClient, queryKeys } from '../queryClient'
import type { BudgetData } from '../queries/budget'
import type { BudgetDocument, MonthWithId } from './triggerRecalculationTypes'
import { convertMonthBalancesFromStored } from '@data/firestore/converters/monthBalances'
import { calculatePreviousMonthIncome } from '@data/queries/month/calculatePreviousMonthIncome'

// === PARSING HELPERS ===

export function parseOrdinal(ordinal: string): { year: number; month: number } {
  return { year: parseInt(ordinal.slice(0, 4), 10), month: parseInt(ordinal.slice(4, 6), 10) }
}

export function parseMonthMap(monthMapData: FirestoreData = {}): MonthMap {
  const monthMap: MonthMap = {}
  // month_map is just a set of ordinals - values are empty objects
  Object.keys(monthMapData).forEach((ordinal) => {
    monthMap[ordinal] = {}
  })
  return monthMap
}

// Removed getMonthsNeedingRecalc - we don't track recalculation flags anymore
// All recalculation is done locally on-demand

export function getAllMonthOrdinals(monthMap: MonthMap): string[] {
  return Object.keys(monthMap).sort()
}

// === FETCH HELPERS ===

export async function fetchMonth(budgetId: string, ordinal: string): Promise<MonthWithId | null> {
  const { year, month } = parseOrdinal(ordinal)
  const monthDocId = getMonthDocId(budgetId, year, month)
  const { exists, data } = await readDocByPath<FirestoreData>('months', monthDocId, `[recalc] fetching month ${year}/${month}`)
  if (!exists || !data) return null
  
  // Parse month data (converts stored balances to calculated)
  // Calculate totals from arrays (not stored in Firestore - calculated on-the-fly)
  const income = data.income || []
  const expenses = data.expenses || []
  const totalIncome = income.reduce((sum: number, inc: { amount: number }) => sum + (inc.amount || 0), 0)
  const totalExpenses = expenses.reduce((sum: number, exp: { amount: number }) => sum + (exp.amount || 0), 0)
  
  // Calculate previous_month_income from previous month's income array (not stored in Firestore)
  // Falls back to stored value for backward compatibility during migration
  const previousMonthIncome = data.previous_month_income !== undefined
    ? data.previous_month_income as number // Use stored value if present (backward compatibility)
    : await calculatePreviousMonthIncome(budgetId, year, month)
  
  const monthDoc: MonthDocument = {
    budget_id: budgetId,
    year_month_ordinal: data.year_month_ordinal ?? getYearMonthOrdinal(year, month),
    year: data.year ?? year,
    month: data.month ?? month,
    income,
    total_income: totalIncome,
    previous_month_income: previousMonthIncome, // Calculated from previous month's income array
    expenses,
    total_expenses: totalExpenses,
    transfers: data.transfers || [],
    adjustments: data.adjustments || [],
    account_balances: data.account_balances || [],
    category_balances: data.category_balances || [],
    are_allocations_finalized: data.are_allocations_finalized ?? false,
    created_at: data.created_at,
    updated_at: data.updated_at,
  }
  const calculatedMonth = convertMonthBalancesFromStored(monthDoc)
  
  return {
    id: monthDocId,
    ...calculatedMonth,
  }
}

export async function fetchMonthsByOrdinals(
  budgetId: string,
  ordinals: string[],
  onFetchProgress?: (fetched: number, total: number) => void
): Promise<MonthWithId[]> {
  // Fetch all months in parallel for better performance
  onFetchProgress?.(0, ordinals.length)

  const results = await Promise.all(
    ordinals.map(ordinal => fetchMonth(budgetId, ordinal))
  )

  onFetchProgress?.(ordinals.length, ordinals.length)

  // Filter out nulls (months that don't exist) and maintain order
  return results.filter((month): month is MonthWithId => month !== null)
}

// === BUDGET UPDATE HELPERS ===

// Removed clearMonthMapFlags - we don't track recalculation flags anymore
// month_map is just a set of ordinals (empty objects)

export function calculateTotalAvailable(accounts: FirestoreData, categories: FirestoreData, accountGroups: FirestoreData): number {
  const onBudgetAccountTotal = Object.entries(accounts).reduce((sum, [, account]) => {
    const group = account.account_group_id ? accountGroups[account.account_group_id] : undefined
    const effectiveOnBudget = (group && group.on_budget !== null) ? group.on_budget : (account.on_budget !== false)
    const effectiveActive = (group && group.is_active !== null) ? group.is_active : (account.is_active !== false)
    return (effectiveOnBudget && effectiveActive) ? sum + (account.balance ?? 0) : sum
  }, 0)
  const totalPositiveCategoryBalances = Object.values(categories).reduce((sum, cat) => {
    const balance = (cat as { balance?: number }).balance ?? 0
    return sum + (balance > 0 ? balance : 0)
  }, 0)
  return roundCurrency(onBudgetAccountTotal - totalPositiveCategoryBalances)
}

/**
 * Update budget cache with calculated balances (don't save to Firestore).
 * Balances are calculated on-the-fly and only stored in cache.
 * Only saves month_map and is_needs_recalculation flag to Firestore.
 */
export async function updateBudgetBalances(budgetId: string, accountBalances: Record<string, number>, categoryBalances: Record<string, number>, monthMap: MonthMap): Promise<void> {
  const { exists, data } = await readDocByPath<BudgetDocument>('budgets', budgetId, '[recalc] reading budget for cache update')
  if (!exists || !data) return

  // Round all balances to 2 decimal places
  const updatedAccounts = { ...data.accounts }
  for (const [accountId, balance] of Object.entries(accountBalances)) {
    if (updatedAccounts[accountId]) updatedAccounts[accountId] = { ...updatedAccounts[accountId], balance: roundCurrency(balance) }
  }
  const updatedCategories = { ...data.categories }
  for (const [categoryId, balance] of Object.entries(categoryBalances)) {
    if (updatedCategories[categoryId]) updatedCategories[categoryId] = { ...updatedCategories[categoryId], balance: roundCurrency(balance) }
  }

  const totalAvailable = calculateTotalAvailable(updatedAccounts, updatedCategories, data.account_groups || {})

  // Only save month_map to Firestore (not balances or flags - those are calculated/managed locally)
  const { writeBudgetData } = await import('@data/mutations/budget/writeBudgetData')
  await writeBudgetData({
    budgetId,
    updates: {
      month_map: monthMap, // Just save the month_map as-is (no flags to clear)
    },
    description: '[recalc] updating month_map',
  })

  // Update cache with the new balances (not saved to Firestore - calculated on-the-fly)
  updateBudgetCacheWithBalances(budgetId, updatedAccounts, updatedCategories, totalAvailable, monthMap)
}

// Removed updateBudgetCache - we don't track recalculation flags anymore

/**
 * Update the budget cache with new account/category balances after recalculation.
 * This ensures the UI reflects the new balances without needing to re-fetch.
 */
export function updateBudgetCacheWithBalances(
  budgetId: string,
  updatedAccounts: FirestoreData,
  updatedCategories: FirestoreData,
  _totalAvailable: number,
  clearedMonthMap: MonthMap
): void {
  const cachedBudget = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
  if (cachedBudget) {
    // Build updated accounts map with new balances
    // Only update the balance field, preserve all other account properties from cache
    const newAccounts: Record<string, BudgetData['accounts'][string]> = {}
    for (const [id, acc] of Object.entries(cachedBudget.accounts)) {
      const updatedAcc = updatedAccounts[id] as FirestoreData | undefined
      if (updatedAcc && updatedAcc.balance !== undefined) {
        // Only update balance, preserve everything else from existing account structure
        newAccounts[id] = {
          ...acc,
          balance: roundCurrency(updatedAcc.balance as number),
        }
      } else {
        newAccounts[id] = acc
      }
    }

    // Build updated categories map with new balances
    // Only update the balance field, preserve all other category properties from cache
    const newCategories: Record<string, BudgetData['categories'][string]> = {}
    for (const [id, cat] of Object.entries(cachedBudget.categories)) {
      const updatedCat = updatedCategories[id] as FirestoreData | undefined
      if (updatedCat && updatedCat.balance !== undefined) {
        // Only update balance, preserve everything else from existing category structure
        newCategories[id] = {
          ...cat,
          balance: roundCurrency(updatedCat.balance as number),
        }
      } else {
        newCategories[id] = cat
      }
    }

    queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
      ...cachedBudget,
      accounts: newAccounts,
      categories: newCategories,
      accountGroups: cachedBudget.accountGroups, // Preserve account groups
      categoryGroups: cachedBudget.categoryGroups, // Preserve category groups
      monthMap: clearedMonthMap,
      budget: {
        ...cachedBudget.budget,
        accounts: newAccounts, // Use properly typed accounts, not FirestoreData
        categories: newCategories, // Use properly typed categories, not FirestoreData
        account_groups: cachedBudget.budget.account_groups,
        category_groups: cachedBudget.budget.category_groups,
        // Don't save total_available - it's calculated on-the-fly
        month_map: clearedMonthMap,
      },
    })
  }
}

// Removed clearBudgetRecalcFlag - we don't track recalculation flags anymore
// All recalculation is done locally on-demand

