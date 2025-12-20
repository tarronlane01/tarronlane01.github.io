import { useState, useEffect, useRef } from 'react'
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore'
import app from '../../firebase'
import useFirebaseAuth from '../../hooks/useFirebaseAuth'
import { useBudget } from '../../contexts/budget_context'

interface MigrationStatus {
  ownerIdInFirestore: string | null
  ownerEmailInFirestore: string | null
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
    loading: true,
  })

  const [isMigratingOwnerId, setIsMigratingOwnerId] = useState(false)
  const [ownerIdMigrationResult, setOwnerIdMigrationResult] = useState<string | null>(null)

  const [isMigratingOwnerEmail, setIsMigratingOwnerEmail] = useState(false)
  const [ownerEmailMigrationResult, setOwnerEmailMigrationResult] = useState<string | null>(null)

  const db = getFirestore(app)
  const current_user = firebase_auth_hook.get_current_firebase_user()

  // Check actual Firestore document on mount (only once)
  useEffect(() => {
    async function checkFirestoreFields() {
      if (!currentBudget || hasCheckedRef.current) {
        if (!currentBudget) {
          setMigrationStatus({ ownerIdInFirestore: null, ownerEmailInFirestore: null, loading: false })
        }
        return
      }

      hasCheckedRef.current = true

      try {
        const budgetDocRef = doc(db, 'budgets', currentBudget.id)
        const budgetDoc = await getDoc(budgetDocRef)

        if (budgetDoc.exists()) {
          const data = budgetDoc.data()
          setMigrationStatus({
            ownerIdInFirestore: data.owner_id || null,
            ownerEmailInFirestore: data.owner_email || null,
            loading: false,
          })
        } else {
          setMigrationStatus({ ownerIdInFirestore: null, ownerEmailInFirestore: null, loading: false })
        }
      } catch {
        setMigrationStatus({ ownerIdInFirestore: null, ownerEmailInFirestore: null, loading: false })
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

  const hasOwnerId = !!migrationStatus.ownerIdInFirestore
  const hasOwnerEmail = !!migrationStatus.ownerEmailInFirestore

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
    </div>
  )
}

export default AdminMigration
