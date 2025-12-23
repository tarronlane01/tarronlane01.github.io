import { useState, useEffect, useRef } from 'react'
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, query, where } from 'firebase/firestore'
import app from '../../firebase'
import useFirebaseAuth from '../../hooks/useFirebaseAuth'
import { useBudget } from '../../contexts/budget_context'
import { useBudgetData } from '../../hooks'
import type { CategoriesMap, AccountsMap, AccountGroupsMap } from '../../types/budget'
import {
  MigrationStatusCard,
  MigrationResults,
  type MigrationStatus,
  type BudgetMigrationResult,
} from '../../components/budget/Admin'

function AdminMigration() {
  const firebase_auth_hook = useFirebaseAuth()

  // Context: identifiers only
  const { selectedBudgetId, currentUserId } = useBudget()

  // Hook: budget data
  const { budget: currentBudget } = useBudgetData(selectedBudgetId, currentUserId)

  const hasCheckedRef = useRef(false)

  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus>({
    categoriesArrayMigrationNeeded: false,
    accountsArrayMigrationNeeded: false,
    budgetsToMigrateCategories: 0,
    budgetsToMigrateAccounts: 0,
    loading: true,
  })

  const [isMigrating, setIsMigrating] = useState(false)
  const [migrationResults, setMigrationResults] = useState<BudgetMigrationResult[] | null>(null)

  const db = getFirestore(app)
  const current_user = firebase_auth_hook.get_current_firebase_user()

  // Check if migration is needed on mount
  useEffect(() => {
    async function checkMigrationStatus() {
      if (!current_user || hasCheckedRef.current) {
        setMigrationStatus(prev => ({ ...prev, loading: false }))
        return
      }

      hasCheckedRef.current = true

      try {
        // Get user document to find their budgets
        const userDocRef = doc(db, 'users', current_user.uid)
        const userDoc = await getDoc(userDocRef)

        if (!userDoc.exists()) {
          setMigrationStatus({
            categoriesArrayMigrationNeeded: false,
            accountsArrayMigrationNeeded: false,
            budgetsToMigrateCategories: 0,
            budgetsToMigrateAccounts: 0,
            loading: false,
          })
          return
        }

        const userData = userDoc.data()
        const budgetIds = userData.budget_ids || []

        let budgetsNeedingCategoriesMigration = 0
        let budgetsNeedingAccountsMigration = 0

        // Check each budget for array formats
        for (const budgetId of budgetIds) {
          const budgetDocRef = doc(db, 'budgets', budgetId)
          const budgetDoc = await getDoc(budgetDocRef)

          if (budgetDoc.exists()) {
            const data = budgetDoc.data()
            // Check if categories is an array (old format)
            if (Array.isArray(data.categories)) {
              budgetsNeedingCategoriesMigration++
            }
            // Check if accounts is an array (old format)
            if (Array.isArray(data.accounts)) {
              budgetsNeedingAccountsMigration++
            }
          }
        }

        setMigrationStatus({
          categoriesArrayMigrationNeeded: budgetsNeedingCategoriesMigration > 0,
          accountsArrayMigrationNeeded: budgetsNeedingAccountsMigration > 0,
          budgetsToMigrateCategories: budgetsNeedingCategoriesMigration,
          budgetsToMigrateAccounts: budgetsNeedingAccountsMigration,
          loading: false,
        })
      } catch (err) {
        console.error('Error checking migration status:', err)
        setMigrationStatus({
          categoriesArrayMigrationNeeded: false,
          accountsArrayMigrationNeeded: false,
          budgetsToMigrateCategories: 0,
          budgetsToMigrateAccounts: 0,
          loading: false,
        })
      }
    }

    checkMigrationStatus()
  }, [current_user, db])

  // Calculate category balances from finalized months
  async function calculateCategoryBalances(budgetId: string, categoryIds: string[]): Promise<Record<string, number>> {
    const balances: Record<string, number> = {}
    categoryIds.forEach(id => { balances[id] = 0 })

    try {
      const monthsQuery = query(
        collection(db, 'months'),
        where('budget_id', '==', budgetId)
      )
      const monthsSnapshot = await getDocs(monthsQuery)

      monthsSnapshot.forEach(docSnap => {
        const data = docSnap.data()
        if (data.allocations_finalized && data.allocations) {
          for (const alloc of data.allocations) {
            balances[alloc.category_id] = (balances[alloc.category_id] || 0) + alloc.amount
          }
        }
      })
    } catch (err) {
      console.error('Error calculating balances for budget:', budgetId, err)
    }

    return balances
  }

  // Run the migration across all budgets
  async function runMigration() {
    if (!current_user) return

    setIsMigrating(true)
    setMigrationResults(null)

    const results: BudgetMigrationResult[] = []

    try {
      // Get user document to find their budgets
      const userDocRef = doc(db, 'users', current_user.uid)
      const userDoc = await getDoc(userDocRef)

      if (!userDoc.exists()) {
        setMigrationResults([{ budgetId: '', budgetName: 'No user document found', categoriesMigrated: 0, accountsMigrated: 0, accountGroupsMigrated: 0, balancesCalculated: false, error: 'User document not found' }])
        setIsMigrating(false)
        return
      }

      const userData = userDoc.data()
      const budgetIds = userData.budget_ids || []

      // Process each budget
      for (const budgetId of budgetIds) {
        const result = await migrateBudget(budgetId)
        results.push(result)
      }

      setMigrationResults(results)
      setMigrationStatus({
        categoriesArrayMigrationNeeded: false,
        accountsArrayMigrationNeeded: false,
        budgetsToMigrateCategories: 0,
        budgetsToMigrateAccounts: 0,
        loading: false,
      })
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
      const budgetDocRef = doc(db, 'budgets', budgetId)
      const budgetDoc = await getDoc(budgetDocRef)

      if (!budgetDoc.exists()) {
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

      const data = budgetDoc.data()
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
      await setDoc(budgetDocRef, {
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

  if (migrationStatus.loading) {
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
      <h2 style={{ marginTop: 0 }}>Data Migrations</h2>
      <p style={{ opacity: 0.7, marginBottom: '1.5rem' }}>
        Run migrations to update your budget data structure.
      </p>

      <MigrationStatusCard
        title="Migrate Data to Map Structure"
        description="Converts categories, accounts, and account groups from array format to map structure. This improves performance and enables direct lookup by ID."
        isComplete={!needsMigration}
        isMigrating={isMigrating}
        needsMigration={needsMigration}
        totalBudgetsToMigrate={totalBudgetsToMigrate}
        budgetsToMigrateCategories={migrationStatus.budgetsToMigrateCategories}
        budgetsToMigrateAccounts={migrationStatus.budgetsToMigrateAccounts}
        onRunMigration={runMigration}
        disabled={!current_user}
      >
        {migrationResults && <MigrationResults results={migrationResults} />}
      </MigrationStatusCard>

      {/* Info about current budget */}
      {currentBudget && (
        <div style={{
          background: 'color-mix(in srgb, currentColor 3%, transparent)',
          padding: '1rem',
          borderRadius: '8px',
          fontSize: '0.85rem',
        }}>
          <p style={{ margin: 0, opacity: 0.7 }}>
            <strong>Note:</strong> This migration will process all budgets you have access to,
            not just "{currentBudget.name}". After migration, reload the page to see updated data.
          </p>
        </div>
      )}
    </div>
  )
}

export default AdminMigration
