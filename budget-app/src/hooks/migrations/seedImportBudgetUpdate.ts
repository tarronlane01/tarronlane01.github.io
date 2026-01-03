/**
 * Seed Import Budget Update
 *
 * Functions for updating budget balances after seed import.
 * Extracted from seedImportLogic for better organization.
 */

import { readDocByPath, writeDocByPath } from '../../data/firestore'
import type { FirestoreData, MonthDocument, MonthMap } from '../../data/firestore/types'
import { queryClient, queryKeys } from '../../data/queryClient'
import type { PreviousMonthSnapshot } from '../../data/recalculation/recalculateMonth'
import type { BudgetData } from '../../data/queries/budget'

import type { ParsedSeedRow } from './seedImportTypes'

// =============================================================================
// TYPES
// =============================================================================

/** Month info for batch processing */
export interface MonthInfo {
  key: string
  year: number
  month: number
  ordinal: string
  name: string
  rows: ParsedSeedRow[]
}

/** Budget document structure for updates */
interface BudgetDocument {
  name: string
  user_ids: string[]
  accepted_user_ids: string[]
  owner_id: string
  owner_email: string | null
  accounts: FirestoreData
  account_groups: FirestoreData
  categories: FirestoreData
  category_groups: FirestoreData[]
  total_available?: number
  is_needs_recalculation?: boolean
  month_map?: FirestoreData
  created_at?: string
  updated_at?: string
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Calculate total_available from accounts and categories.
 * This is the "Ready to Assign" amount.
 */
function calculateTotalAvailable(
  accounts: FirestoreData,
  categories: FirestoreData,
  accountGroups: FirestoreData
): number {
  // Sum of on-budget, active account balances
  const onBudgetAccountTotal = Object.entries(accounts).reduce((sum, [, account]) => {
    const group = account.account_group_id ? accountGroups[account.account_group_id] : undefined
    const effectiveOnBudget = group?.on_budget !== undefined ? group.on_budget : (account.on_budget !== false)
    const effectiveActive = group?.is_active !== undefined ? group.is_active : (account.is_active !== false)
    return (effectiveOnBudget && effectiveActive) ? sum + (account.balance ?? 0) : sum
  }, 0)

  // Sum of positive category balances
  const totalPositiveCategoryBalances = Object.values(categories).reduce((sum, cat) => {
    const balance = (cat as { balance?: number }).balance ?? 0
    return sum + (balance > 0 ? balance : 0)
  }, 0)

  return onBudgetAccountTotal - totalPositiveCategoryBalances
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Update the budget with final balances from the import.
 * Sets all months as NOT needing recalculation since we already recalculated them.
 */
export async function updateBudgetWithFinalBalances(
  budgetId: string,
  finalSnapshot: PreviousMonthSnapshot,
  processedMonths: Array<{ info: MonthInfo; data: MonthDocument }>
): Promise<void> {
  // Read current budget
  const { exists, data: budgetData } = await readDocByPath<BudgetDocument>(
    'budgets',
    budgetId,
    '[seed import] reading budget for final update'
  )

  if (!exists || !budgetData) {
    throw new Error(`Budget ${budgetId} not found`)
  }

  // Update account balances from final snapshot
  const updatedAccounts = { ...budgetData.accounts }
  for (const [accountId, balance] of Object.entries(finalSnapshot.accountEndBalances)) {
    if (updatedAccounts[accountId]) {
      updatedAccounts[accountId] = { ...updatedAccounts[accountId], balance }
    }
  }

  // Update category balances from final snapshot
  const updatedCategories = { ...budgetData.categories }
  for (const [categoryId, balance] of Object.entries(finalSnapshot.categoryEndBalances)) {
    if (updatedCategories[categoryId]) {
      updatedCategories[categoryId] = { ...updatedCategories[categoryId], balance }
    }
  }

  // Build month_map with all processed months marked as NOT needing recalculation
  const existingMonthMap: MonthMap = (budgetData.month_map as MonthMap) || {}
  const updatedMonthMap: MonthMap = { ...existingMonthMap }

  for (const { info } of processedMonths) {
    updatedMonthMap[info.ordinal] = { needs_recalculation: false }
  }

  // Calculate total_available
  const totalAvailable = calculateTotalAvailable(
    updatedAccounts,
    updatedCategories,
    budgetData.account_groups || {}
  )

  // Write updated budget
  await writeDocByPath(
    'budgets',
    budgetId,
    {
      ...budgetData,
      accounts: updatedAccounts,
      categories: updatedCategories,
      total_available: totalAvailable,
      is_needs_recalculation: false,
      month_map: updatedMonthMap,
      updated_at: new Date().toISOString(),
    },
    '[seed import] saving final balances'
  )

  // Update cache with the new balances
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
      monthMap: updatedMonthMap,
      budget: {
        ...cachedBudget.budget,
        accounts: updatedAccounts,
        categories: updatedCategories,
        total_available: totalAvailable,
        is_needs_recalculation: false,
        month_map: updatedMonthMap,
      },
    })
  }
}

