/**
 * Admin Migration Query Hook
 *
 * Checks if any data migrations are needed for the current user's budgets.
 * This is an admin-only query that checks data structures.
 *
 * NOTE: The actual migration operations remain as direct Firestore calls
 * in AdminMigration.tsx because:
 * 1. Migrations are one-time operations, not regular data access
 * 2. They modify data structures in ways that don't fit the normal CRUD pattern
 * 3. They need transaction-like behavior for data integrity
 */

import { useQuery } from '@tanstack/react-query'
import { getFirestore, doc, getDoc } from 'firebase/firestore'
import app from '../../firebase'

interface MigrationStatus {
  categoriesArrayMigrationNeeded: boolean
  accountsArrayMigrationNeeded: boolean
  budgetsToMigrateCategories: number
  budgetsToMigrateAccounts: number
  budgetsNeedingCategoryBalance: number
}

/**
 * Check migration status for a user's budgets
 */
async function checkMigrationStatus(userId: string): Promise<MigrationStatus> {
  const db = getFirestore(app)

  // Get user document to find their budgets
  const userDocRef = doc(db, 'users', userId)
  const userDoc = await getDoc(userDocRef)

  if (!userDoc.exists()) {
    return {
      categoriesArrayMigrationNeeded: false,
      accountsArrayMigrationNeeded: false,
      budgetsToMigrateCategories: 0,
      budgetsToMigrateAccounts: 0,
      budgetsNeedingCategoryBalance: 0,
    }
  }

  const userData = userDoc.data()
  const budgetIds: string[] = userData.budget_ids || []

  if (budgetIds.length === 0) {
    return {
      categoriesArrayMigrationNeeded: false,
      accountsArrayMigrationNeeded: false,
      budgetsToMigrateCategories: 0,
      budgetsToMigrateAccounts: 0,
      budgetsNeedingCategoryBalance: 0,
    }
  }

  let budgetsToMigrateCategories = 0
  let budgetsToMigrateAccounts = 0
  let budgetsNeedingCategoryBalance = 0

  // Check each budget for array formats
  for (const budgetId of budgetIds) {
    const budgetDocRef = doc(db, 'budgets', budgetId)
    const budgetDoc = await getDoc(budgetDocRef)

    if (budgetDoc.exists()) {
      const data = budgetDoc.data()

      // Check if categories is an array (old format)
      if (Array.isArray(data.categories)) {
        budgetsToMigrateCategories++
      }

      // Check if accounts is an array (old format)
      if (Array.isArray(data.accounts)) {
        budgetsToMigrateAccounts++
      }

      // Check if categories need balance calculation
      if (data.categories && typeof data.categories === 'object' && !Array.isArray(data.categories)) {
        const categories = data.categories as Record<string, any>
        const needsBalance = Object.values(categories).some(cat => cat.balance === undefined)
        if (needsBalance) {
          budgetsNeedingCategoryBalance++
        }
      }
    }
  }

  return {
    categoriesArrayMigrationNeeded: budgetsToMigrateCategories > 0,
    accountsArrayMigrationNeeded: budgetsToMigrateAccounts > 0,
    budgetsToMigrateCategories,
    budgetsToMigrateAccounts,
    budgetsNeedingCategoryBalance,
  }
}

/**
 * Query hook for admin migration status
 *
 * @param userId - The current user's ID
 * @param options - Additional query options including enabled flag
 */
export function useAdminMigrationQuery(
  userId: string | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: userId ? ['adminMigration', userId] as const : ['adminMigration', 'none'],
    queryFn: async (): Promise<MigrationStatus> => {
      if (!userId) {
        return {
          categoriesArrayMigrationNeeded: false,
          accountsArrayMigrationNeeded: false,
          budgetsToMigrateCategories: 0,
          budgetsToMigrateAccounts: 0,
          budgetsNeedingCategoryBalance: 0,
        }
      }
      return checkMigrationStatus(userId)
    },
    enabled: !!userId && (options?.enabled !== false),
    staleTime: 5 * 60 * 1000, // 5 minutes - migration status doesn't change often
  })
}

