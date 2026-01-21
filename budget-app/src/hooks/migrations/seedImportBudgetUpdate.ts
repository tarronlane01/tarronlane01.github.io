/**
 * Seed Import Budget Update
 *
 * Functions for updating budget balances after seed import.
 * Extracted from seedImportLogic for better organization.
 */

// eslint-disable-next-line no-restricted-imports -- Migration utility needs direct Firestore access
import { readDocByPath, writeDocByPath } from '@firestore'
import type { FirestoreData, MonthDocument, MonthMap } from '@types'
import { queryClient, queryKeys } from '@data/queryClient'
import type { PreviousMonthSnapshot } from '@data/recalculation/recalculateMonth'
import type { BudgetData } from '@data/queries/budget'

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

// Removed calculateTotalAvailable function - total_available is calculated on-the-fly in useBudgetData

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

  // Build month_map with all processed months (just empty objects, no flags)
  const existingMonthMap: MonthMap = (budgetData.month_map as MonthMap) || {}
  const updatedMonthMap: MonthMap = { ...existingMonthMap }

  for (const { info } of processedMonths) {
    updatedMonthMap[info.ordinal] = {} // Just track presence, no flags
  }

  // Strip balance fields from accounts and categories before saving
  // Balances are calculated on-the-fly, not stored in Firestore
  const accountsWithoutBalances = Object.fromEntries(
    Object.entries(updatedAccounts).map(([id, acc]) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Destructuring to remove balance field
      const { balance: _balance, ...accWithoutBalance } = acc as { balance?: number; [key: string]: unknown }
      return [id, accWithoutBalance]
    })
  )
  const categoriesWithoutBalances = Object.fromEntries(
    Object.entries(updatedCategories).map(([id, cat]) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Destructuring to remove balance field
      const { balance: _balance, ...catWithoutBalance } = cat as { balance?: number; [key: string]: unknown }
      return [id, catWithoutBalance]
    })
  )

  // Write updated budget (without balances - they're calculated on-the-fly)
  await writeDocByPath(
    'budgets',
    budgetId,
    {
      ...budgetData,
      accounts: accountsWithoutBalances,
      categories: categoriesWithoutBalances,
      // Don't save total_available or is_needs_recalculation - they're calculated/managed locally
      month_map: updatedMonthMap,
      updated_at: new Date().toISOString(),
    },
    '[seed import] saving final budget (without balances)'
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
      monthMap: updatedMonthMap,
      budget: {
        ...cachedBudget.budget,
        accounts: updatedAccounts,
        categories: updatedCategories,
        // Don't save total_available or is_needs_recalculation - they're calculated/managed locally
        month_map: updatedMonthMap,
      },
    })
  }
}

