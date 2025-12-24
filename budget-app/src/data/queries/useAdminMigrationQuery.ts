/**
 * Admin Migration Query Hook
 *
 * Checks if any data migrations are needed across ALL budgets in the system.
 * This is an admin-only query that checks data structures.
 *
 * NOTE: The actual migration operations remain as direct Firestore calls
 * in AdminMigration.tsx because:
 * 1. Migrations are one-time operations, not regular data access
 * 2. They modify data structures in ways that don't fit the normal CRUD pattern
 * 3. They need transaction-like behavior for data integrity
 */

import { useQuery } from '@tanstack/react-query'
import { queryCollection } from '../firestore/operations'

interface MigrationStatus {
  categoriesArrayMigrationNeeded: boolean
  accountsArrayMigrationNeeded: boolean
  budgetsToMigrateCategories: number
  budgetsToMigrateAccounts: number
  budgetsNeedingCategoryBalance: number
  totalBudgetsChecked: number
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
    'admin checking migration status for all budgets'
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

  return {
    categoriesArrayMigrationNeeded: budgetsToMigrateCategories > 0,
    accountsArrayMigrationNeeded: budgetsToMigrateAccounts > 0,
    budgetsToMigrateCategories,
    budgetsToMigrateAccounts,
    budgetsNeedingCategoryBalance,
    totalBudgetsChecked: budgetsResult.docs.length,
  }
}

/**
 * Query hook for admin migration status
 *
 * Checks ALL budgets in the system (admin feature).
 * NEVER auto-fetches - user must manually click Refresh to fetch/update status.
 * Cached data persists and is shown when returning to the page.
 *
 */
export function useAdminMigrationQuery() {
  return useQuery({
    queryKey: ['adminMigration', 'all'] as const,
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

