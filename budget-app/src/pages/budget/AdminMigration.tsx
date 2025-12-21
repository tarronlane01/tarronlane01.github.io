import { useState, useEffect, useRef } from 'react'
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore'
import app from '../../firebase'
import useFirebaseAuth from '../../hooks/useFirebaseAuth'
import { useBudget, type AccountGroup, type FinancialAccount } from '../../contexts/budget_context'

interface MigrationStatus {
  ownerIdInFirestore: string | null
  ownerEmailInFirestore: string | null
  accountTypeMigrationNeeded: boolean
  accountsWithOldType: number
  loading: boolean
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
    ownerIdInFirestore: null,
    ownerEmailInFirestore: null,
    accountTypeMigrationNeeded: false,
    accountsWithOldType: 0,
    loading: true,
  })

  const [isMigratingOwnerId, setIsMigratingOwnerId] = useState(false)
  const [ownerIdMigrationResult, setOwnerIdMigrationResult] = useState<string | null>(null)

  const [isMigratingOwnerEmail, setIsMigratingOwnerEmail] = useState(false)
  const [ownerEmailMigrationResult, setOwnerEmailMigrationResult] = useState<string | null>(null)

  const [isMigratingAccountTypes, setIsMigratingAccountTypes] = useState(false)
  const [accountTypeMigrationResult, setAccountTypeMigrationResult] = useState<string | null>(null)

  const db = getFirestore(app)
  const current_user = firebase_auth_hook.get_current_firebase_user()

  // Check actual Firestore document on mount (only once)
  useEffect(() => {
    async function checkFirestoreFields() {
      if (!currentBudget || hasCheckedRef.current) {
        if (!currentBudget) {
          setMigrationStatus({
            ownerIdInFirestore: null,
            ownerEmailInFirestore: null,
            accountTypeMigrationNeeded: false,
            accountsWithOldType: 0,
            loading: false,
          })
        }
        return
      }

      hasCheckedRef.current = true

      try {
        const budgetDocRef = doc(db, 'budgets', currentBudget.id)
        const budgetDoc = await getDoc(budgetDocRef)

        if (budgetDoc.exists()) {
          const data = budgetDoc.data()

          // Check if any accounts have the old account_type field
          const accounts = data.accounts || []
          const accountsWithOldType = accounts.filter((a: any) => a.account_type !== undefined)

          setMigrationStatus({
            ownerIdInFirestore: data.owner_id || null,
            ownerEmailInFirestore: data.owner_email || null,
            accountTypeMigrationNeeded: accountsWithOldType.length > 0,
            accountsWithOldType: accountsWithOldType.length,
            loading: false,
          })
        } else {
          setMigrationStatus({
            ownerIdInFirestore: null,
            ownerEmailInFirestore: null,
            accountTypeMigrationNeeded: false,
            accountsWithOldType: 0,
            loading: false,
          })
        }
      } catch {
        setMigrationStatus({
          ownerIdInFirestore: null,
          ownerEmailInFirestore: null,
          accountTypeMigrationNeeded: false,
          accountsWithOldType: 0,
          loading: false,
        })
      }
    }

    checkFirestoreFields()
  }, [currentBudget, db])

  async function migrateOwnerId() {
    if (!currentBudget || !current_user) return

    setIsMigratingOwnerId(true)
    setOwnerIdMigrationResult(null)

    try {
      const budgetDocRef = doc(db, 'budgets', currentBudget.id)
      const budgetDoc = await getDoc(budgetDocRef)

      if (!budgetDoc.exists()) {
        throw new Error('Budget document not found')
      }

      const data = budgetDoc.data()

      // Check if owner_id already exists in Firestore
      if (data.owner_id) {
        setOwnerIdMigrationResult(`Owner ID already set: ${data.owner_id}`)
        setMigrationStatus(prev => ({ ...prev, ownerIdInFirestore: data.owner_id }))
        setIsMigratingOwnerId(false)
        return
      }

      // Set owner_id to the first user in user_ids (original creator)
      const ownerId = data.user_ids?.[0] || current_user.uid

      await setDoc(budgetDocRef, {
        ...data,
        owner_id: ownerId,
      })

      // Update local status immediately (no page reload)
      setMigrationStatus(prev => ({ ...prev, ownerIdInFirestore: ownerId }))
      setOwnerIdMigrationResult(`Successfully added owner ID: ${ownerId}`)
    } catch (err) {
      setOwnerIdMigrationResult(`Error: ${err instanceof Error ? err.message : 'Migration failed'}`)
    } finally {
      setIsMigratingOwnerId(false)
    }
  }

  async function migrateOwnerEmail() {
    if (!currentBudget || !current_user) return

    setIsMigratingOwnerEmail(true)
    setOwnerEmailMigrationResult(null)

    try {
      const budgetDocRef = doc(db, 'budgets', currentBudget.id)
      const budgetDoc = await getDoc(budgetDocRef)

      if (!budgetDoc.exists()) {
        throw new Error('Budget document not found')
      }

      const data = budgetDoc.data()

      // Check if owner_email already exists in Firestore
      if (data.owner_email) {
        setOwnerEmailMigrationResult(`Owner email already set: ${data.owner_email}`)
        setMigrationStatus(prev => ({ ...prev, ownerEmailInFirestore: data.owner_email }))
        setIsMigratingOwnerEmail(false)
        return
      }

      // Only the owner can run this migration (check actual Firestore owner_id)
      if (data.owner_id !== current_user.uid) {
        throw new Error('Only the budget owner can run this migration')
      }

      // Set owner_email from current user's email
      await setDoc(budgetDocRef, {
        ...data,
        owner_email: current_user.email || null,
      })

      // Update local status immediately (no page reload)
      setMigrationStatus(prev => ({ ...prev, ownerEmailInFirestore: current_user.email || null }))
      setOwnerEmailMigrationResult(`Successfully added owner email: ${current_user.email}`)
    } catch (err) {
      setOwnerEmailMigrationResult(`Error: ${err instanceof Error ? err.message : 'Migration failed'}`)
    } finally {
      setIsMigratingOwnerEmail(false)
    }
  }

  // Migration 3: Migrate account_type to account_group_id
  async function migrateAccountTypes() {
    if (!currentBudget || !current_user) return

    setIsMigratingAccountTypes(true)
    setAccountTypeMigrationResult(null)

    try {
      const budgetDocRef = doc(db, 'budgets', currentBudget.id)
      const budgetDoc = await getDoc(budgetDocRef)

      if (!budgetDoc.exists()) {
        throw new Error('Budget document not found')
      }

      const data = budgetDoc.data()
      const accounts = data.accounts || []
      const existingGroups: AccountGroup[] = data.account_groups || []

      // Check if any accounts have the old account_type field
      const accountsWithOldType = accounts.filter((a: any) => a.account_type !== undefined)

      if (accountsWithOldType.length === 0) {
        setAccountTypeMigrationResult('No accounts need migration - already using new format')
        setMigrationStatus(prev => ({ ...prev, accountTypeMigrationNeeded: false, accountsWithOldType: 0 }))
        setIsMigratingAccountTypes(false)
        return
      }

      // Map old account types to display names and expected balance
      const accountTypeConfig: Record<string, { name: string; expected_balance: 'positive' | 'negative' }> = {
        checking: { name: 'Checking', expected_balance: 'positive' },
        savings: { name: 'Savings', expected_balance: 'positive' },
        credit_card: { name: 'Credit Card', expected_balance: 'negative' },
      }

      // Find unique account types that need groups created
      const uniqueOldTypes = [...new Set(accountsWithOldType.map((a: any) => a.account_type))] as string[]

      // Create a mapping from old type to new group ID
      const typeToGroupId: Record<string, string> = {}
      const newGroups: AccountGroup[] = [...existingGroups]
      let nextSortOrder = existingGroups.length > 0
        ? Math.max(...existingGroups.map(g => g.sort_order)) + 1
        : 0

      for (const oldType of uniqueOldTypes) {
        // Check if a group with this name already exists
        const config = accountTypeConfig[oldType] || { name: oldType, expected_balance: 'positive' as const }
        const existingGroup = newGroups.find(g => g.name.toLowerCase() === config.name.toLowerCase())

        if (existingGroup) {
          typeToGroupId[oldType] = existingGroup.id
        } else {
          // Create a new group
          const newGroup: AccountGroup = {
            id: `account_group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: config.name,
            sort_order: nextSortOrder++,
            expected_balance: config.expected_balance,
          }
          newGroups.push(newGroup)
          typeToGroupId[oldType] = newGroup.id
        }
      }

      // Update accounts: add account_group_id and remove account_type
      const migratedAccounts: FinancialAccount[] = accounts.map((account: any) => {
        if (account.account_type !== undefined) {
          const { account_type, ...rest } = account
          return {
            ...rest,
            account_group_id: typeToGroupId[account_type] || null,
          }
        }
        return account
      })

      // Save to Firestore
      await setDoc(budgetDocRef, {
        ...data,
        accounts: migratedAccounts,
        account_groups: newGroups,
      })

      // Update local status
      setMigrationStatus(prev => ({
        ...prev,
        accountTypeMigrationNeeded: false,
        accountsWithOldType: 0,
      }))

      const groupsCreated = newGroups.length - existingGroups.length
      setAccountTypeMigrationResult(
        `Successfully migrated ${accountsWithOldType.length} account(s). ` +
        `Created ${groupsCreated} new account type(s): ${uniqueOldTypes.map(t => accountTypeConfig[t]?.name || t).join(', ')}`
      )
    } catch (err) {
      setAccountTypeMigrationResult(`Error: ${err instanceof Error ? err.message : 'Migration failed'}`)
    } finally {
      setIsMigratingAccountTypes(false)
    }
  }

  const hasOwnerId = !!migrationStatus.ownerIdInFirestore
  const hasOwnerEmail = !!migrationStatus.ownerEmailInFirestore
  const needsAccountTypeMigration = migrationStatus.accountTypeMigrationNeeded

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
        Run migrations to update your budget data structure with new fields.
      </p>

      {/* Migration 1: Add Owner ID */}
      <div style={{
        background: 'color-mix(in srgb, currentColor 5%, transparent)',
        padding: '1.5rem',
        borderRadius: '8px',
        marginBottom: '1.5rem',
      }}>
        <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{
            background: hasOwnerId ? 'rgba(34, 197, 94, 0.2)' : 'rgba(100, 108, 255, 0.2)',
            color: hasOwnerId ? '#4ade80' : '#a5b4fc',
            padding: '0.15rem 0.5rem',
            borderRadius: '4px',
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}>
            {hasOwnerId ? 'Complete' : 'Step 1'}
          </span>
          Add Owner ID to Budget
        </h3>
        <p style={{ opacity: 0.7, marginBottom: '1rem' }}>
          Sets the budget owner to the first user in the user list (the original creator).
        </p>

        {isMigratingOwnerId ? (
          <div style={{
            background: 'rgba(100, 108, 255, 0.1)',
            border: '1px solid rgba(100, 108, 255, 0.3)',
            color: '#a5b4fc',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
          }}>
            <Spinner /> Running migration...
          </div>
        ) : hasOwnerId ? (
          <div style={{
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            color: '#4ade80',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
          }}>
            ✅ Owner ID already set: <strong>{migrationStatus.ownerIdInFirestore}</strong>
          </div>
        ) : (
          <>
            <button
              onClick={migrateOwnerId}
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
              Add Owner ID
            </button>

            {ownerIdMigrationResult && (
              <div style={{
                marginTop: '1rem',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                background: ownerIdMigrationResult.startsWith('Error')
                  ? 'rgba(220, 38, 38, 0.1)'
                  : 'rgba(34, 197, 94, 0.1)',
                border: ownerIdMigrationResult.startsWith('Error')
                  ? '1px solid rgba(220, 38, 38, 0.3)'
                  : '1px solid rgba(34, 197, 94, 0.3)',
                color: ownerIdMigrationResult.startsWith('Error')
                  ? '#f87171'
                  : '#4ade80',
              }}>
                {ownerIdMigrationResult}
              </div>
            )}
          </>
        )}
      </div>

      {/* Migration 2: Add Owner Email */}
      <div style={{
        background: 'color-mix(in srgb, currentColor 5%, transparent)',
        padding: '1.5rem',
        borderRadius: '8px',
        opacity: hasOwnerId ? 1 : 0.5,
      }}>
        <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{
            background: hasOwnerEmail ? 'rgba(34, 197, 94, 0.2)' : 'rgba(100, 108, 255, 0.2)',
            color: hasOwnerEmail ? '#4ade80' : '#a5b4fc',
            padding: '0.15rem 0.5rem',
            borderRadius: '4px',
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}>
            {hasOwnerEmail ? 'Complete' : 'Step 2'}
          </span>
          Add Owner Email to Budget
        </h3>
        <p style={{ opacity: 0.7, marginBottom: '1rem' }}>
          Stores the budget owner's email for display purposes.
          {current_user?.email && <> Your email: <strong>{current_user.email}</strong></>}
        </p>

        {!hasOwnerId && (
          <div style={{
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            color: '#fbbf24',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
          }}>
            ⚠️ Complete Step 1 first (Add Owner ID)
          </div>
        )}

        {hasOwnerId && isMigratingOwnerEmail && (
          <div style={{
            background: 'rgba(100, 108, 255, 0.1)',
            border: '1px solid rgba(100, 108, 255, 0.3)',
            color: '#a5b4fc',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
          }}>
            <Spinner /> Running migration...
          </div>
        )}

        {hasOwnerId && !isMigratingOwnerEmail && hasOwnerEmail && (
          <div style={{
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            color: '#4ade80',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
          }}>
            ✅ Owner email already set: <strong>{migrationStatus.ownerEmailInFirestore}</strong>
          </div>
        )}

        {hasOwnerId && !isMigratingOwnerEmail && !hasOwnerEmail && (
          <>
            <button
              onClick={migrateOwnerEmail}
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
              Add Owner Email
            </button>

            {ownerEmailMigrationResult && (
              <div style={{
                marginTop: '1rem',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                background: ownerEmailMigrationResult.startsWith('Error')
                  ? 'rgba(220, 38, 38, 0.1)'
                  : 'rgba(34, 197, 94, 0.1)',
                border: ownerEmailMigrationResult.startsWith('Error')
                  ? '1px solid rgba(220, 38, 38, 0.3)'
                  : '1px solid rgba(34, 197, 94, 0.3)',
                color: ownerEmailMigrationResult.startsWith('Error')
                  ? '#f87171'
                  : '#4ade80',
              }}>
                {ownerEmailMigrationResult}
              </div>
            )}
          </>
        )}
      </div>

      {/* Migration 3: Migrate Account Types to Account Groups */}
      <div style={{
        background: 'color-mix(in srgb, currentColor 5%, transparent)',
        padding: '1.5rem',
        borderRadius: '8px',
        marginTop: '1.5rem',
      }}>
        <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{
            background: !needsAccountTypeMigration ? 'rgba(34, 197, 94, 0.2)' : 'rgba(100, 108, 255, 0.2)',
            color: !needsAccountTypeMigration ? '#4ade80' : '#a5b4fc',
            padding: '0.15rem 0.5rem',
            borderRadius: '4px',
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}>
            {!needsAccountTypeMigration ? 'Complete' : 'Step 3'}
          </span>
          Migrate Account Types to Groups
        </h3>
        <p style={{ opacity: 0.7, marginBottom: '1rem' }}>
          Converts the old fixed account types (Checking, Savings, Credit Card) to customizable account groups.
          This creates account groups for each existing type and updates your accounts to reference them.
        </p>

        {isMigratingAccountTypes ? (
          <div style={{
            background: 'rgba(100, 108, 255, 0.1)',
            border: '1px solid rgba(100, 108, 255, 0.3)',
            color: '#a5b4fc',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
          }}>
            <Spinner /> Running migration...
          </div>
        ) : !needsAccountTypeMigration ? (
          <div style={{
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            color: '#4ade80',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
          }}>
            ✅ All accounts are using the new group format
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
              ⚠️ Found {migrationStatus.accountsWithOldType} account(s) using the old format
            </div>

            <button
              onClick={migrateAccountTypes}
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
              Migrate Account Types
            </button>

            {accountTypeMigrationResult && (
              <div style={{
                marginTop: '1rem',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                background: accountTypeMigrationResult.startsWith('Error')
                  ? 'rgba(220, 38, 38, 0.1)'
                  : 'rgba(34, 197, 94, 0.1)',
                border: accountTypeMigrationResult.startsWith('Error')
                  ? '1px solid rgba(220, 38, 38, 0.3)'
                  : '1px solid rgba(34, 197, 94, 0.3)',
                color: accountTypeMigrationResult.startsWith('Error')
                  ? '#f87171'
                  : '#4ade80',
              }}>
                {accountTypeMigrationResult}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default AdminMigration
