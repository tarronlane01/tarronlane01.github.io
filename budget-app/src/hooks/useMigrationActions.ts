import { useState } from 'react'
// Settings migrations need raw Firestore access to query ALL budgets system-wide
// and perform one-off data structure migrations. These are admin-only operations
// that run across all users' data, not suitable for React Query caching.
// eslint-disable-next-line no-restricted-imports
import { readDoc, writeDoc, queryCollection, deleteDocByPath, type FirestoreData } from '../data/firestore/operations'
import { queryClient } from '../data'
import type { FutureMonthInfo } from '../data/queries/useSettingsMigrationQuery'
import type { CategoriesMap, AccountsMap, AccountGroupsMap } from '../types/budget'
import type { BudgetMigrationResult } from '../components/budget/Admin'

interface UseMigrationActionsOptions {
  currentUser: unknown
  futureMonthsToDelete: FutureMonthInfo[]
  onRefetch: () => void
}

export function useMigrationActions({
  currentUser,
  futureMonthsToDelete,
  onRefetch,
}: UseMigrationActionsOptions) {
  const [isMigrating, setIsMigrating] = useState(false)
  const [migrationResults, setMigrationResults] = useState<BudgetMigrationResult[] | null>(null)
  const [isCleaningFutureMonths, setIsCleaningFutureMonths] = useState(false)
  const [futureMonthsCleanupResult, setFutureMonthsCleanupResult] = useState<{
    deleted: number
    errors: string[]
  } | null>(null)

  // Calculate category balances from finalized months
  async function calculateCategoryBalances(budgetId: string, categoryIds: string[]): Promise<Record<string, number>> {
    const balances: Record<string, number> = {}
    categoryIds.forEach(id => { balances[id] = 0 })

    try {
      const monthsResult = await queryCollection<{
        allocations_finalized?: boolean
        allocations?: Array<{ category_id: string; amount: number }>
      }>(
        'months',
        `settings migration: calculating category balances for budget ${budgetId}`,
        [{ field: 'budget_id', op: '==', value: budgetId }]
      )

      for (const docSnap of monthsResult.docs) {
        const data = docSnap.data
        if (data.allocations_finalized && data.allocations) {
          for (const alloc of data.allocations) {
            balances[alloc.category_id] = (balances[alloc.category_id] || 0) + alloc.amount
          }
        }
      }
    } catch (err) {
      console.error('Error calculating balances for budget:', budgetId, err)
    }

    return balances
  }

  async function migrateBudget(budgetId: string): Promise<BudgetMigrationResult> {
    try {
      const { exists: budgetExists, data } = await readDoc<FirestoreData>(
        'budgets',
        budgetId,
        `settings migration: reading budget to check if migration needed`
      )

      if (!budgetExists || !data) {
        return {
          budgetId,
          budgetName: 'Unknown',
          categoriesMigrated: 0,
          accountsMigrated: 0,
          accountGroupsMigrated: 0,
          balancesCalculated: false,
          error: 'Budget not found',
        }
      }
      const budgetName = data.name || 'Unnamed Budget'

      // Check if already migrated
      const categoriesNeedMigration = Array.isArray(data.categories)
      const accountsNeedMigration = Array.isArray(data.accounts)
      const accountGroupsNeedMigration = Array.isArray(data.account_groups)

      if (!categoriesNeedMigration && !accountsNeedMigration && !accountGroupsNeedMigration) {
        return {
          budgetId,
          budgetName,
          categoriesMigrated: 0,
          accountsMigrated: 0,
          accountGroupsMigrated: 0,
          balancesCalculated: false,
          error: 'Already migrated',
        }
      }

      // Prepare updated data
      let updatedCategories = data.categories
      let updatedAccounts = data.accounts
      let updatedAccountGroups = data.account_groups
      let categoriesMigrated = 0
      let accountsMigrated = 0
      let accountGroupsMigrated = 0
      let balancesCalculated = false

      // Migrate categories if needed
      if (categoriesNeedMigration) {
        const categoriesArray = data.categories as FirestoreData[]
        const categoriesMap: CategoriesMap = {}
        const categoryIds: string[] = []

        for (const cat of categoriesArray) {
          const catId = cat.id || `category_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          categoryIds.push(catId)

          categoriesMap[catId] = {
            name: cat.name,
            description: cat.description,
            category_group_id: cat.category_group_id ?? null,
            sort_order: cat.sort_order ?? 0,
            default_monthly_amount: cat.default_monthly_amount,
            default_monthly_type: cat.default_monthly_type,
            balance: 0,
          }
        }

        // Calculate balances from finalized months
        const balances = await calculateCategoryBalances(budgetId, categoryIds)

        // Apply balances to categories
        for (const catId of categoryIds) {
          if (categoriesMap[catId]) {
            categoriesMap[catId].balance = balances[catId] || 0
          }
        }

        // Clean undefined values before saving
        const cleanedCategories: CategoriesMap = {}
        Object.entries(categoriesMap).forEach(([catId, cat]) => {
          cleanedCategories[catId] = {
            name: cat.name,
            category_group_id: cat.category_group_id ?? null,
            sort_order: cat.sort_order,
            balance: cat.balance,
          }
          if (cat.description) cleanedCategories[catId].description = cat.description
          if (cat.default_monthly_amount !== undefined) cleanedCategories[catId].default_monthly_amount = cat.default_monthly_amount
          if (cat.default_monthly_type !== undefined) cleanedCategories[catId].default_monthly_type = cat.default_monthly_type
        })

        updatedCategories = cleanedCategories
        categoriesMigrated = categoriesArray.length
        balancesCalculated = true
      }

      // Migrate accounts if needed
      if (accountsNeedMigration) {
        const accountsArray = data.accounts as FirestoreData[]
        const accountsMap: AccountsMap = {}

        for (const acc of accountsArray) {
          const accId = acc.id || `account_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

          accountsMap[accId] = {
            nickname: acc.nickname,
            balance: acc.balance ?? 0,
            account_group_id: acc.account_group_id ?? null,
            sort_order: acc.sort_order ?? 0,
          }
          if (acc.is_income_account !== undefined) accountsMap[accId].is_income_account = acc.is_income_account
          if (acc.is_income_default !== undefined) accountsMap[accId].is_income_default = acc.is_income_default
          if (acc.is_outgo_account !== undefined) accountsMap[accId].is_outgo_account = acc.is_outgo_account
          if (acc.is_outgo_default !== undefined) accountsMap[accId].is_outgo_default = acc.is_outgo_default
          if (acc.on_budget !== undefined) accountsMap[accId].on_budget = acc.on_budget
          if (acc.is_active !== undefined) accountsMap[accId].is_active = acc.is_active
        }

        updatedAccounts = accountsMap
        accountsMigrated = accountsArray.length
      }

      // Migrate account groups if needed
      if (accountGroupsNeedMigration) {
        const groupsArray = data.account_groups as FirestoreData[]
        const groupsMap: AccountGroupsMap = {}

        for (const group of groupsArray) {
          const groupId = group.id || `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

          groupsMap[groupId] = {
            name: group.name,
            sort_order: group.sort_order ?? 0,
          }
          if (group.expected_balance !== undefined) groupsMap[groupId].expected_balance = group.expected_balance
          if (group.on_budget !== undefined) groupsMap[groupId].on_budget = group.on_budget
          if (group.is_active !== undefined) groupsMap[groupId].is_active = group.is_active
        }

        // Update account references if needed
        if (accountsNeedMigration && updatedAccounts) {
          const accountsMap = updatedAccounts as AccountsMap
          const oldGroupsArray = data.account_groups as FirestoreData[]

          const oldToNewGroupId: Record<string, string> = {}
          oldGroupsArray.forEach((oldGroup: FirestoreData, index: number) => {
            const oldId = oldGroup.id || String(index)
            const newId = Object.keys(groupsMap)[index]
            if (newId) {
              oldToNewGroupId[oldId] = newId
            }
          })

          Object.entries(accountsMap).forEach(([accId, acc]) => {
            if (acc.account_group_id && oldToNewGroupId[acc.account_group_id]) {
              accountsMap[accId].account_group_id = oldToNewGroupId[acc.account_group_id]
            }
          })
        }

        updatedAccountGroups = groupsMap
        accountGroupsMigrated = groupsArray.length
      }

      // Save updated budget document - remove category_balances from data
      const { category_balances: _catBalRemoved, ...restData } = data as FirestoreData
      void _catBalRemoved // Intentionally unused - destructuring to exclude from saved data
      await writeDoc(
        'budgets',
        budgetId,
        {
          ...restData,
          categories: updatedCategories,
          accounts: updatedAccounts,
          account_groups: updatedAccountGroups,
        },
        `settings migration: saving migrated budget data (categories: ${categoriesMigrated}, accounts: ${accountsMigrated}, groups: ${accountGroupsMigrated})`
      )

      return {
        budgetId,
        budgetName,
        categoriesMigrated,
        accountsMigrated,
        accountGroupsMigrated,
        balancesCalculated,
      }
    } catch (err) {
      return {
        budgetId,
        budgetName: 'Error',
        categoriesMigrated: 0,
        accountsMigrated: 0,
        accountGroupsMigrated: 0,
        balancesCalculated: false,
        error: err instanceof Error ? err.message : 'Migration failed',
      }
    }
  }

  // Run the migration across ALL budgets in the system
  async function runMigration() {
    if (!currentUser) return

    setIsMigrating(true)
    setMigrationResults(null)

    const results: BudgetMigrationResult[] = []

    try {
      // Query ALL budgets in the system (no filter)
      const budgetsResult = await queryCollection<{ name?: string }>(
        'budgets',
        'settings migration: listing all budgets in system to migrate'
      )

      if (budgetsResult.docs.length === 0) {
        setMigrationResults([{ budgetId: '', budgetName: 'No budgets found', categoriesMigrated: 0, accountsMigrated: 0, accountGroupsMigrated: 0, balancesCalculated: false, error: 'No budgets in system' }])
        setIsMigrating(false)
        return
      }

      // Process each budget
      for (const budgetDoc of budgetsResult.docs) {
        const result = await migrateBudget(budgetDoc.id)
        results.push(result)
      }

      setMigrationResults(results)
      // Invalidate all budget-related caches so other pages show updated data
      queryClient.invalidateQueries({ queryKey: ['budget'] })
      queryClient.invalidateQueries({ queryKey: ['month'] })
      // Refetch migration status to show updated state (needed because enabled: false)
      queryClient.invalidateQueries({ queryKey: ['settingsMigration'] })
      onRefetch()
    } catch (err) {
      setMigrationResults([{
        budgetId: '',
        budgetName: 'Migration Error',
        categoriesMigrated: 0,
        accountsMigrated: 0,
        accountGroupsMigrated: 0,
        balancesCalculated: false,
        error: err instanceof Error ? err.message : 'Migration failed',
      }])
    } finally {
      setIsMigrating(false)
    }
  }

  // Delete future months that are more than 2 months from now
  async function cleanupFutureMonths() {
    if (!currentUser) return
    if (futureMonthsToDelete.length === 0) return

    setIsCleaningFutureMonths(true)
    setFutureMonthsCleanupResult(null)

    let deleted = 0
    const errors: string[] = []

    for (const monthInfo of futureMonthsToDelete) {
      try {
        await deleteDocByPath(
          'months',
          monthInfo.docId,
          `settings cleanup: deleting future month ${monthInfo.year}-${monthInfo.month}`
        )
        deleted++
      } catch (err) {
        errors.push(`Failed to delete ${monthInfo.docId}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }

    setFutureMonthsCleanupResult({ deleted, errors })
    setIsCleaningFutureMonths(false)

    // Refresh status to show updated count
    queryClient.invalidateQueries({ queryKey: ['settingsMigration'] })
    queryClient.invalidateQueries({ queryKey: ['month'] })
    onRefetch()
  }

  return {
    isMigrating,
    migrationResults,
    isCleaningFutureMonths,
    futureMonthsCleanupResult,
    runMigration,
    cleanupFutureMonths,
  }
}

