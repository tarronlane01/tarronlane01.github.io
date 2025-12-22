import { useState, useEffect, useRef } from 'react'
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, query, where } from 'firebase/firestore'
import app from '../../firebase'
import useFirebaseAuth from '../../hooks/useFirebaseAuth'
import { useBudget, type CategoriesMap, type AccountsMap, type AccountGroupsMap } from '../../contexts/budget_context'

interface MigrationStatus {
  categoriesArrayMigrationNeeded: boolean
  accountsArrayMigrationNeeded: boolean
  budgetsToMigrateCategories: number
  budgetsToMigrateAccounts: number
  loading: boolean
}

interface BudgetMigrationResult {
  budgetId: string
  budgetName: string
  categoriesMigrated: number
  accountsMigrated: number
  accountGroupsMigrated: number
  balancesCalculated: boolean
  error?: string
}

// Simple CSS spinner component
function Spinner() {
  return (
    <span style={{
      display: 'inline-block',
      width: '14px',
      height: '14px',
      border: '2px solid rgba(255, 255, 255, 0.3)',
      borderTopColor: 'white',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
      marginRight: '0.5rem',
      verticalAlign: 'middle',
    }} />
  )
}

function AdminMigration() {
  const firebase_auth_hook = useFirebaseAuth()
  const { currentBudget } = useBudget()
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
        try {
          const budgetDocRef = doc(db, 'budgets', budgetId)
          const budgetDoc = await getDoc(budgetDocRef)

          if (!budgetDoc.exists()) {
            results.push({
              budgetId,
              budgetName: 'Unknown',
              categoriesMigrated: 0,
              accountsMigrated: 0,
              accountGroupsMigrated: 0,
              balancesCalculated: false,
              error: 'Budget not found',
            })
            continue
          }

          const data = budgetDoc.data()
          const budgetName = data.name || 'Unnamed Budget'

          // Check if already migrated
          const categoriesNeedMigration = Array.isArray(data.categories)
          const accountsNeedMigration = Array.isArray(data.accounts)
          const accountGroupsNeedMigration = Array.isArray(data.account_groups)

          if (!categoriesNeedMigration && !accountsNeedMigration && !accountGroupsNeedMigration) {
            results.push({
              budgetId,
              budgetName,
              categoriesMigrated: 0,
              accountsMigrated: 0,
              accountGroupsMigrated: 0,
              balancesCalculated: false,
              error: 'Already migrated',
            })
            continue
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
                balance: 0, // Will be calculated next
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

            // Update account references to use the new group IDs if they changed
            // (In case old accounts referenced groups by array index or inconsistent IDs)
            if (accountsNeedMigration && updatedAccounts) {
              const accountsMap = updatedAccounts as AccountsMap
              const oldGroupsArray = data.account_groups as any[]

              // Build a mapping from old group IDs to new group IDs
              const oldToNewGroupId: Record<string, string> = {}
              oldGroupsArray.forEach((oldGroup: any, index: number) => {
                const oldId = oldGroup.id || String(index)
                const newId = Object.keys(groupsMap)[index]
                if (newId) {
                  oldToNewGroupId[oldId] = newId
                }
              })

              // Update account group references if needed
              Object.entries(accountsMap).forEach(([accId, acc]) => {
                if (acc.account_group_id && oldToNewGroupId[acc.account_group_id]) {
                  accountsMap[accId].account_group_id = oldToNewGroupId[acc.account_group_id]
                }
              })
            }

            updatedAccountGroups = groupsMap
            accountGroupsMigrated = groupsArray.length
          }

          // Save updated budget document
          // Remove the old category_balances field if it exists
          const { category_balances: _removed, ...restData } = data as any
          await setDoc(budgetDocRef, {
            ...restData,
            categories: updatedCategories,
            accounts: updatedAccounts,
            account_groups: updatedAccountGroups,
          })

          results.push({
            budgetId,
            budgetName,
            categoriesMigrated,
            accountsMigrated,
            accountGroupsMigrated,
            balancesCalculated,
          })
        } catch (err) {
          results.push({
            budgetId,
            budgetName: 'Error',
            categoriesMigrated: 0,
            accountsMigrated: 0,
            accountGroupsMigrated: 0,
            balancesCalculated: false,
            error: err instanceof Error ? err.message : 'Migration failed',
          })
        }
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

      {/* Migration: Arrays to Maps */}
      <div style={{
        background: 'color-mix(in srgb, currentColor 5%, transparent)',
        padding: '1.5rem',
        borderRadius: '8px',
        marginBottom: '1.5rem',
      }}>
        <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{
            background: !needsMigration ? 'rgba(34, 197, 94, 0.2)' : 'rgba(100, 108, 255, 0.2)',
            color: !needsMigration ? '#4ade80' : '#a5b4fc',
            padding: '0.15rem 0.5rem',
            borderRadius: '4px',
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}>
            {!needsMigration ? 'Complete' : 'Required'}
          </span>
          Migrate Data to Map Structure
        </h3>
        <p style={{ opacity: 0.7, marginBottom: '1rem' }}>
          Converts categories, accounts, and account groups from array format to map structure.
          This improves performance and enables direct lookup by ID.
        </p>

        {isMigrating ? (
          <div style={{
            background: 'rgba(100, 108, 255, 0.1)',
            border: '1px solid rgba(100, 108, 255, 0.3)',
            color: '#a5b4fc',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
          }}>
            <Spinner /> Running migration across all budgets...
          </div>
        ) : !needsMigration ? (
          <div style={{
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            color: '#4ade80',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
          }}>
            ✅ All budgets are using the new map structure
          </div>
        ) : (
          <>
            <div style={{
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#fbbf24',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              marginBottom: '1rem',
            }}>
              <div style={{ marginBottom: '0.5rem' }}>⚠️ Found {totalBudgetsToMigrate} budget(s) needing migration:</div>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.9rem' }}>
                {migrationStatus.budgetsToMigrateCategories > 0 && (
                  <li>{migrationStatus.budgetsToMigrateCategories} with categories to migrate</li>
                )}
                {migrationStatus.budgetsToMigrateAccounts > 0 && (
                  <li>{migrationStatus.budgetsToMigrateAccounts} with accounts to migrate</li>
                )}
              </ul>
            </div>

            <button
              onClick={runMigration}
              disabled={!current_user}
              style={{
                background: '#646cff',
                color: 'white',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                cursor: !current_user ? 'not-allowed' : 'pointer',
                fontWeight: 500,
                opacity: !current_user ? 0.7 : 1,
              }}
            >
              Migrate All Budgets
            </button>
          </>
        )}

        {/* Migration Results */}
        {migrationResults && (
          <div style={{ marginTop: '1rem' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>Migration Results:</h4>
            <div style={{
              maxHeight: '300px',
              overflowY: 'auto',
              background: 'color-mix(in srgb, currentColor 3%, transparent)',
              borderRadius: '8px',
              padding: '0.75rem',
            }}>
              {migrationResults.map((result, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '0.5rem',
                    marginBottom: idx < migrationResults.length - 1 ? '0.5rem' : 0,
                    borderRadius: '4px',
                    background: result.error && result.error !== 'Already migrated'
                      ? 'rgba(220, 38, 38, 0.1)'
                      : result.error === 'Already migrated'
                        ? 'rgba(100, 100, 100, 0.1)'
                        : 'rgba(34, 197, 94, 0.1)',
                    border: result.error && result.error !== 'Already migrated'
                      ? '1px solid rgba(220, 38, 38, 0.3)'
                      : result.error === 'Already migrated'
                        ? '1px solid rgba(100, 100, 100, 0.3)'
                        : '1px solid rgba(34, 197, 94, 0.3)',
                  }}
                >
                  <div style={{ fontWeight: 500 }}>
                    {result.error && result.error !== 'Already migrated' ? '❌' : result.error === 'Already migrated' ? '⏭️' : '✅'} {result.budgetName}
                  </div>
                  {result.error && result.error !== 'Already migrated' ? (
                    <div style={{ fontSize: '0.85rem', opacity: 0.8, color: '#f87171' }}>
                      Error: {result.error}
                    </div>
                  ) : result.error === 'Already migrated' ? (
                    <div style={{ fontSize: '0.85rem', opacity: 0.6 }}>
                      Already using map structure
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                      {result.categoriesMigrated > 0 && `Migrated ${result.categoriesMigrated} categories`}
                      {result.categoriesMigrated > 0 && (result.accountsMigrated > 0 || result.accountGroupsMigrated > 0) && ', '}
                      {result.accountsMigrated > 0 && `${result.accountsMigrated} accounts`}
                      {result.accountsMigrated > 0 && result.accountGroupsMigrated > 0 && ', '}
                      {result.accountGroupsMigrated > 0 && `${result.accountGroupsMigrated} account groups`}
                      {result.balancesCalculated && ' with calculated balances'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

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
