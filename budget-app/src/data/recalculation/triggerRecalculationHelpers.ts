/**
 * Helper functions for Trigger Recalculation module
 */

import type { FirestoreData, MonthMap } from '@types'
import { readDocByPath, writeDocByPath } from '@firestore'
import { getMonthDocId, getYearMonthOrdinal, roundCurrency } from '@utils'
import { queryClient, queryKeys } from '../queryClient'
import type { BudgetData } from '../queries/budget'
import type { BudgetDocument, MonthWithId } from './triggerRecalculationTypes'

// === PARSING HELPERS ===

export function parseOrdinal(ordinal: string): { year: number; month: number } {
  return { year: parseInt(ordinal.slice(0, 4), 10), month: parseInt(ordinal.slice(4, 6), 10) }
}

export function parseMonthMap(monthMapData: FirestoreData = {}): MonthMap {
  const monthMap: MonthMap = {}
  Object.entries(monthMapData).forEach(([ordinal, info]) => {
    monthMap[ordinal] = { needs_recalculation: (info as { needs_recalculation?: boolean })?.needs_recalculation ?? false }
  })
  return monthMap
}

export function getMonthsNeedingRecalc(monthMap: MonthMap): string[] {
  return Object.entries(monthMap).filter(([, info]) => info.needs_recalculation).map(([ordinal]) => ordinal).sort()
}

export function getAllMonthOrdinals(monthMap: MonthMap): string[] {
  return Object.keys(monthMap).sort()
}

// === FETCH HELPERS ===

export async function fetchMonth(budgetId: string, ordinal: string): Promise<MonthWithId | null> {
  const { year, month } = parseOrdinal(ordinal)
  const monthDocId = getMonthDocId(budgetId, year, month)
  const { exists, data } = await readDocByPath<FirestoreData>('months', monthDocId, `[recalc] fetching month ${year}/${month}`)
  if (!exists || !data) return null
  return {
    id: monthDocId,
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

export function clearMonthMapFlags(monthMap: MonthMap): MonthMap {
  const cleared: MonthMap = {}
  for (const ordinal of Object.keys(monthMap)) cleared[ordinal] = { needs_recalculation: false }
  return cleared
}

export function calculateTotalAvailable(accounts: FirestoreData, categories: FirestoreData, accountGroups: FirestoreData): number {
  const onBudgetAccountTotal = Object.entries(accounts).reduce((sum, [, account]) => {
    const group = account.account_group_id ? accountGroups[account.account_group_id] : undefined
    const effectiveOnBudget = group?.on_budget !== undefined ? group.on_budget : (account.on_budget !== false)
    const effectiveActive = group?.is_active !== undefined ? group.is_active : (account.is_active !== false)
    return (effectiveOnBudget && effectiveActive) ? sum + (account.balance ?? 0) : sum
  }, 0)
  const totalPositiveCategoryBalances = Object.values(categories).reduce((sum, cat) => {
    const balance = (cat as { balance?: number }).balance ?? 0
    return sum + (balance > 0 ? balance : 0)
  }, 0)
  return roundCurrency(onBudgetAccountTotal - totalPositiveCategoryBalances)
}

export async function updateBudgetBalances(budgetId: string, accountBalances: Record<string, number>, categoryBalances: Record<string, number>, monthMap: MonthMap): Promise<void> {
  const { exists, data } = await readDocByPath<BudgetDocument>('budgets', budgetId, '[recalc] reading budget for balance update')
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

  const clearedMonthMap = clearMonthMapFlags(monthMap)
  const totalAvailable = calculateTotalAvailable(updatedAccounts, updatedCategories, data.account_groups || {})

  await writeDocByPath('budgets', budgetId, {
    ...data,
    accounts: updatedAccounts,
    categories: updatedCategories,
    total_available: totalAvailable,
    is_needs_recalculation: false,
    month_map: clearedMonthMap,
    updated_at: new Date().toISOString(),
  }, '[recalc] saving balances and clearing flags')

  // Update cache with the new balances (not just flags)
  updateBudgetCacheWithBalances(budgetId, updatedAccounts, updatedCategories, totalAvailable, clearedMonthMap)
}

export function updateBudgetCache(budgetId: string, clearedMonthMap: MonthMap): void {
  const cachedBudget = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
  if (cachedBudget) {
    queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
      ...cachedBudget,
      isNeedsRecalculation: false,
      monthMap: clearedMonthMap,
      budget: { ...cachedBudget.budget, is_needs_recalculation: false, month_map: clearedMonthMap },
    })
  }
}

/**
 * Update the budget cache with new account/category balances after recalculation.
 * This ensures the UI reflects the new balances without needing to re-fetch.
 */
export function updateBudgetCacheWithBalances(
  budgetId: string,
  updatedAccounts: FirestoreData,
  updatedCategories: FirestoreData,
  totalAvailable: number,
  clearedMonthMap: MonthMap
): void {
  const cachedBudget = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
  if (cachedBudget) {
    // Build updated accounts map with new balances
    const newAccounts: Record<string, BudgetData['accounts'][string]> = {}
    for (const [id, acc] of Object.entries(cachedBudget.accounts)) {
      const updatedAcc = updatedAccounts[id]
      newAccounts[id] = updatedAcc ? { ...acc, balance: updatedAcc.balance ?? acc.balance } : acc
    }

    // Build updated categories map with new balances
    const newCategories: Record<string, BudgetData['categories'][string]> = {}
    for (const [id, cat] of Object.entries(cachedBudget.categories)) {
      const updatedCat = updatedCategories[id]
      newCategories[id] = updatedCat ? { ...cat, balance: updatedCat.balance ?? cat.balance } : cat
    }

    queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
      ...cachedBudget,
      accounts: newAccounts,
      categories: newCategories,
      isNeedsRecalculation: false,
      monthMap: clearedMonthMap,
      budget: {
        ...cachedBudget.budget,
        accounts: updatedAccounts,
        categories: updatedCategories,
        total_available: totalAvailable,
        is_needs_recalculation: false,
        month_map: clearedMonthMap,
      },
    })
  }
}

export async function clearBudgetRecalcFlag(budgetId: string, monthMap: MonthMap): Promise<void> {
  const { exists, data } = await readDocByPath<BudgetDocument>('budgets', budgetId, '[recalc] reading budget to clear flags')
  if (!exists || !data) return

  const clearedMonthMap = clearMonthMapFlags(monthMap)
  await writeDocByPath('budgets', budgetId, {
    ...data,
    total_available: calculateTotalAvailable(data.accounts || {}, data.categories || {}, data.account_groups || {}),
    is_needs_recalculation: false,
    month_map: clearedMonthMap,
    updated_at: new Date().toISOString(),
  }, '[recalc] clearing flags')
  updateBudgetCache(budgetId, clearedMonthMap)
}

