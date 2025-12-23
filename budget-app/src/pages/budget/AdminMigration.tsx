import { useState } from 'react'
import { readDoc, writeDoc, queryCollection } from '../../utils/firestoreHelpers'
import useFirebaseAuth from '../../hooks/useFirebaseAuth'
import { useAdminMigrationQuery, queryClient } from '../../data'
import type { CategoriesMap, AccountsMap, AccountGroupsMap } from '../../types/budget'
import {
  MigrationStatusCard,
  MigrationResults,
  Spinner,
  type BudgetMigrationResult,
} from '../../components/budget/Admin'

function AdminMigration() {
  const firebase_auth_hook = useFirebaseAuth()

  const current_user = firebase_auth_hook.get_current_firebase_user()

  // Use React Query for migration status - does NOT auto-refetch
  const migrationQuery = useAdminMigrationQuery()

  const [isMigrating, setIsMigrating] = useState(false)
  const [migrationResults, setMigrationResults] = useState<BudgetMigrationResult[] | null>(null)

  // Derive status from query
  const hasData = migrationQuery.data !== undefined
  const isStale = migrationQuery.isStale
  const migrationStatus = migrationQuery.data ?? {
    categoriesArrayMigrationNeeded: false,
    accountsArrayMigrationNeeded: false,
    budgetsToMigrateCategories: 0,
    budgetsToMigrateAccounts: 0,
    budgetsNeedingCategoryBalance: 0,
    totalBudgetsChecked: 0,
  }
  const isLoading = migrationQuery.isLoading
  const isRefreshing = migrationQuery.isFetching && !migrationQuery.isLoading
  const lastUpdated = migrationQuery.dataUpdatedAt
    ? new Date(migrationQuery.dataUpdatedAt).toLocaleString()
    : null

  // Calculate category balances from finalized months
  async function calculateCategoryBalances(budgetId: string, categoryIds: string[]): Promise<Record<string, number>> {
    const balances: Record<string, number> = {}
    categoryIds.forEach(id => { balances[id] = 0 })

    try {
      const monthsResult = await queryCollection<{
        allocations_finalized?: boolean
        allocations?: Array<{ category_id: string; amount: number }>
      }>('months', [
        { field: 'budget_id', op: '==', value: budgetId }
      ])

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

  // Run the migration across ALL budgets in the system
  async function runMigration() {
    if (!current_user) return

    setIsMigrating(true)
    setMigrationResults(null)

    const results: BudgetMigrationResult[] = []

    try {
      // Query ALL budgets in the system (no filter)
      const budgetsResult = await queryCollection<{ name?: string }>('budgets', [])

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
      queryClient.invalidateQueries({ queryKey: ['adminMigration'] })
      migrationQuery.refetch()
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

  async function migrateBudget(budgetId: string): Promise<BudgetMigrationResult> {
    try {
      const { exists: budgetExists, data } = await readDoc<Record<string, any>>('budgets', budgetId)

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
        const categoriesArray = data.categories as any[]
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
        const accountsArray = data.accounts as any[]
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
        const groupsArray = data.account_groups as any[]
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
          const oldGroupsArray = data.account_groups as any[]

          const oldToNewGroupId: Record<string, string> = {}
          oldGroupsArray.forEach((oldGroup: any, index: number) => {
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
      const { category_balances: _catBalRemoved, ...restData } = data as any
      void _catBalRemoved // Intentionally unused - destructuring to exclude from saved data
      await writeDoc('budgets', budgetId, {
        ...restData,
        categories: updatedCategories,
        accounts: updatedAccounts,
        account_groups: updatedAccountGroups,
      })

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

  const needsMigration = migrationStatus.categoriesArrayMigrationNeeded || migrationStatus.accountsArrayMigrationNeeded
  const totalBudgetsToMigrate = Math.max(migrationStatus.budgetsToMigrateCategories, migrationStatus.budgetsToMigrateAccounts)

  // Refresh migration status - invalidate cache first to ensure fresh Firebase read
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['adminMigration'] })
    migrationQuery.refetch()
  }

  if (isLoading) {
    return (
      <div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <h2 style={{ marginTop: 0 }}>Data Migrations</h2>
        <p style={{ opacity: 0.7 }}>Checking migration status...</p>
      </div>
    )
  }

  return (
    <div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>Data Migrations</h2>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing || isMigrating}
          style={{
            background: '#646cff',
            color: 'white',
            border: 'none',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            cursor: isRefreshing || isMigrating ? 'not-allowed' : 'pointer',
            fontWeight: 500,
            opacity: isRefreshing || isMigrating ? 0.7 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            minWidth: '130px',
            minHeight: '36px',
          }}
        >
          <span style={{ width: '18px', height: '18px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
            {isRefreshing ? <Spinner noMargin /> : '🔄'}
          </span>
          Refresh All
        </button>
      </div>
      <p style={{ opacity: 0.7, marginBottom: '1.5rem' }}>
        Run migrations to update your budget data structure. Status is cached and won't auto-refresh.
        <span style={{ display: 'block', fontSize: '0.85rem', marginTop: '0.25rem' }}>
          {!hasData ? (
            <span style={{ color: '#a5b4fc' }}>Status: Unknown (click Refresh to check)</span>
          ) : isStale ? (
            <span style={{ color: '#fbbf24' }}>⚠️ Status may be stale — Last checked: {lastUpdated}</span>
          ) : (
            <span>Last checked: {lastUpdated}</span>
          )}
        </span>
      </p>

      <MigrationStatusCard
        title="Migrate Data to Map Structure"
        description="Converts categories, accounts, and account groups from array format to map structure. This improves performance and enables direct lookup by ID."
        isComplete={hasData ? !needsMigration : false}
        isMigrating={isMigrating}
        needsMigration={hasData ? needsMigration : false}
        totalBudgetsToMigrate={totalBudgetsToMigrate}
        budgetsToMigrateCategories={migrationStatus.budgetsToMigrateCategories}
        budgetsToMigrateAccounts={migrationStatus.budgetsToMigrateAccounts}
        onRunMigration={runMigration}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        disabled={!current_user}
        isUnknown={!hasData}
      >
        {migrationResults && <MigrationResults results={migrationResults} />}
      </MigrationStatusCard>

      {/* Info about migration scope */}
      <div style={{
        background: 'color-mix(in srgb, currentColor 3%, transparent)',
        padding: '1rem',
        borderRadius: '8px',
        fontSize: '0.85rem',
      }}>
        <p style={{ margin: 0, opacity: 0.7 }}>
          <strong>Note:</strong> This migration will process <strong>all {hasData ? migrationStatus.totalBudgetsChecked : '?'} budgets</strong> in the system,
          not just the ones you own or are invited to.
        </p>
      </div>
    </div>
  )
}

export default AdminMigration
