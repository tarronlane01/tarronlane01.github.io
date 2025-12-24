/**
 * Settings Migration Query Hook
 *
 * Checks if any data migrations are needed across ALL budgets in the system.
 * This is an admin-only query that checks data structures.
 *
 * NOTE: The actual migration operations remain as direct Firestore calls
 * in SettingsMigration.tsx because:
 * 1. Migrations are one-time operations, not regular data access
 * 2. They modify data structures in ways that don't fit the normal CRUD pattern
 * 3. They need transaction-like behavior for data integrity
 */

import { useQuery } from '@tanstack/react-query'
import { queryCollection } from '../firestore/operations'

export interface FutureMonthInfo {
  docId: string
  budgetId: string
  year: number
  month: number
}

interface MigrationStatus {
  categoriesArrayMigrationNeeded: boolean
  accountsArrayMigrationNeeded: boolean
  budgetsToMigrateCategories: number
  budgetsToMigrateAccounts: number
  budgetsNeedingCategoryBalance: number
  totalBudgetsChecked: number
  // Future month cleanup
  futureMonthsToDelete: FutureMonthInfo[]
  futureMonthsCount: number
}

/**
 * Get the cutoff date for future months (2 months from now)
 * Returns { year, month } representing the last month to KEEP
 */
function getFutureMonthCutoff(): { year: number; month: number } {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1 // 1-12

  // Add 2 months to get the cutoff (anything beyond this will be deleted)
  let cutoffMonth = currentMonth + 2
  let cutoffYear = currentYear

  if (cutoffMonth > 12) {
    cutoffMonth -= 12
    cutoffYear += 1
  }

  return { year: cutoffYear, month: cutoffMonth }
}

/**
 * Check if a month is beyond the cutoff (should be deleted)
 */
function isMonthBeyondCutoff(
  year: number,
  month: number,
  cutoff: { year: number; month: number }
): boolean {
  if (year > cutoff.year) return true
  if (year === cutoff.year && month > cutoff.month) return true
  return false
}

/**
 * Check migration status for ALL budgets in the system
 */
async function checkMigrationStatus(): Promise<MigrationStatus> {
  // Query ALL budgets in the system (no filter)
  const budgetsResult = await queryCollection<{
    categories?: unknown
    accounts?: unknown
  }>(
    'budgets',
    'settings checking migration status for all budgets'
  )

  let budgetsToMigrateCategories = 0
  let budgetsToMigrateAccounts = 0
  let budgetsNeedingCategoryBalance = 0

  // Check each budget for array formats
  for (const budgetDoc of budgetsResult.docs) {
    const budgetData = budgetDoc.data

    // Check if categories is an array (old format)
    if (Array.isArray(budgetData.categories)) {
      budgetsToMigrateCategories++
    }

    // Check if accounts is an array (old format)
    if (Array.isArray(budgetData.accounts)) {
      budgetsToMigrateAccounts++
    }

    // Check if categories need balance calculation
    if (budgetData.categories && typeof budgetData.categories === 'object' && !Array.isArray(budgetData.categories)) {
      const categories = budgetData.categories as Record<string, unknown>
      const needsBalance = Object.values(categories).some(cat => (cat as Record<string, unknown>).balance === undefined)
      if (needsBalance) {
        budgetsNeedingCategoryBalance++
      }
    }
  }

  // Check for future months beyond 2 months from now
  const cutoff = getFutureMonthCutoff()
  const monthsResult = await queryCollection<{
    budget_id: string
    year: number
    month: number
  }>(
    'months',
    'settings checking for future months to clean up'
  )

  const futureMonthsToDelete: FutureMonthInfo[] = []
  for (const monthDoc of monthsResult.docs) {
    const { budget_id, year, month } = monthDoc.data
    if (isMonthBeyondCutoff(year, month, cutoff)) {
      futureMonthsToDelete.push({
        docId: monthDoc.id,
        budgetId: budget_id,
        year,
        month,
      })
    }
  }

  // Sort by date for display
  futureMonthsToDelete.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year
    return a.month - b.month
  })

  return {
    categoriesArrayMigrationNeeded: budgetsToMigrateCategories > 0,
    accountsArrayMigrationNeeded: budgetsToMigrateAccounts > 0,
    budgetsToMigrateCategories,
    budgetsToMigrateAccounts,
    budgetsNeedingCategoryBalance,
    totalBudgetsChecked: budgetsResult.docs.length,
    futureMonthsToDelete,
    futureMonthsCount: futureMonthsToDelete.length,
  }
}

/**
 * Query hook for settings migration status
 *
 * Checks ALL budgets in the system (admin feature).
 * NEVER auto-fetches - user must manually click Refresh to fetch/update status.
 * Cached data persists and is shown when returning to the page.
 *
 */
export function useSettingsMigrationQuery() {
  return useQuery({
    queryKey: ['settingsMigration', 'all'] as const,
    queryFn: async (): Promise<MigrationStatus> => {
      return checkMigrationStatus()
    },
    enabled: false,           // NEVER auto-fetch - only fetch via manual refetch()
    staleTime: 5 * 60 * 1000, // 5 minutes - after this, data is considered stale (for UI indicator)
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

