import { useState, useEffect, useLayoutEffect, useRef, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApp, useBudget } from '@contexts'
import { useBudgetData } from '@hooks'
import { useRenameBudget } from '@data/mutations/budget'
import { useAcceptInvite, useCreateBudget } from '@data/mutations/user'
import useFirebaseAuth from '@hooks/useFirebaseAuth'
import { BudgetCard } from '../../components/budget/Admin'
import { logUserAction } from '@utils'
import { ErrorAlertBox, SuccessAlertBox } from './MyBudgetsAlerts'
import { ManualInviteSection, UserIdInfo } from './MyBudgetsManualInvite'
import { colors } from '@styles/shared'

function MyBudgets() {
  const { addLoadingHold, removeLoadingHold } = useApp()
  const { selectedBudgetId, currentUserId, accessibleBudgets, loadAccessibleBudgets, switchToBudget, checkBudgetInvite, isInitialized, setPageTitle, needsFirstBudget } = useBudget()
  const { requireUserEmail } = useFirebaseAuth()

  // Track if we've already loaded budgets this mount (avoid duplicate loads)
  const hasLoadedRef = useRef(false)

  // Check for context message in URL (e.g., budget-not-found)
  const [searchParams, setSearchParams] = useSearchParams()
  const contextMessage = searchParams.get('context')

  // Clear context param from URL after reading it
  useEffect(() => {
    if (contextMessage) {
      searchParams.delete('context')
      setSearchParams(searchParams, { replace: true })
    }
  }, [contextMessage, searchParams, setSearchParams])

  // Determine the welcome message based on context
  const isBudgetNotFound = contextMessage === 'budget-not-found'
  const isNewUser = needsFirstBudget && accessibleBudgets.length === 0

  useLayoutEffect(() => { setPageTitle('My Budgets') }, [setPageTitle])

  // Load accessible budgets once on mount
  // Note: For users with no budgets, this may already be loaded by context auto-query
  // React Query will dedupe if the same query is already in progress
  useEffect(() => {
    if (isInitialized && !hasLoadedRef.current) {
      hasLoadedRef.current = true
      loadAccessibleBudgets()
    }
  }, [isInitialized, loadAccessibleBudgets])

  const { budget: currentBudget, isLoading: loading } = useBudgetData()

  // Mutations - imported directly
  const { renameBudget } = useRenameBudget()
  const { acceptInvite } = useAcceptInvite()
  const { createBudget } = useCreateBudget()

  const [isSwitching, setIsSwitching] = useState<string | null>(null)
  const [isAccepting, setIsAccepting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)
  const [budgetIdInput, setBudgetIdInput] = useState('')
  const [isCheckingManual, setIsCheckingManual] = useState(false)
  const [manualInvite, setManualInvite] = useState<{ budgetId: string; budgetName: string; ownerEmail: string | null } | null>(null)

  // Create budget form state
  const [newBudgetName, setNewBudgetName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  async function handleSwitchBudget(budgetId: string) {
    if (budgetId === currentBudget?.id) return
    logUserAction('CLICK', 'Switch Budget', { details: budgetId })
    setIsSwitching(budgetId)
    setError(null)
    setSuccess(null)
    try {
      await switchToBudget(budgetId)
      setSuccess('Switched to budget successfully!')
      await loadAccessibleBudgets({ force: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch budget')
    } finally {
      setIsSwitching(null)
    }
  }

  async function handleAcceptInvite(budgetId: string) {
    if (!currentUserId) return
    logUserAction('CLICK', 'Accept Budget Invite', { details: budgetId })
    setIsAccepting(budgetId)
    setError(null)
    setSuccess(null)
    try {
      await acceptInvite.mutateAsync({ budgetId, userId: currentUserId })
      setSuccess('Invitation accepted! You now have access to this budget.')
      await loadAccessibleBudgets({ force: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation')
    } finally {
      setIsAccepting(null)
    }
  }

  async function handleCheckManualInvite(e: FormEvent) {
    e.preventDefault()
    if (!budgetIdInput.trim()) return
    logUserAction('SUBMIT', 'Check Manual Invite', { value: budgetIdInput })
    setIsCheckingManual(true)
    setError(null)
    setManualInvite(null)
    try {
      const invite = await checkBudgetInvite(budgetIdInput.trim())
      if (invite) {
        setManualInvite(invite)
      } else {
        setError('No pending invitation found for this budget ID. Make sure you\'ve been invited by the budget owner.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check invitation')
    } finally {
      setIsCheckingManual(false)
    }
  }

  async function handleAcceptManualInvite() {
    if (!manualInvite || !currentUserId) return
    logUserAction('CLICK', 'Accept Manual Invite', { details: manualInvite.budgetName })
    setIsAccepting(manualInvite.budgetId)
    setError(null)
    try {
      await acceptInvite.mutateAsync({ budgetId: manualInvite.budgetId, userId: currentUserId })
      setSuccess(`Successfully joined "${manualInvite.budgetName}"!`)
      setManualInvite(null)
      setBudgetIdInput('')
      await loadAccessibleBudgets({ force: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation')
    } finally {
      setIsAccepting(null)
    }
  }

  function startEditing(budgetId: string, name: string) {
    logUserAction('CLICK', 'Start Edit Budget Name', { details: name })
    setEditName(name)
    setEditingBudgetId(budgetId)
  }

  async function handleRename(e: FormEvent) {
    e.preventDefault()
    if (!editName.trim() || !editingBudgetId || !selectedBudgetId) return
    logUserAction('SUBMIT', 'Rename Budget', { value: editName.trim() })
    setIsRenaming(true)
    setError(null)
    setSuccess(null)
    try {
      await renameBudget.mutateAsync({ budgetId: selectedBudgetId, newName: editName.trim() })
      setSuccess('Budget renamed successfully!')
      setEditingBudgetId(null)
      await loadAccessibleBudgets({ force: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename budget')
    } finally {
      setIsRenaming(false)
    }
  }

  async function handleCreateBudget(e: FormEvent) {
    e.preventDefault()
    if (!currentUserId) return
    logUserAction('SUBMIT', 'Create Budget', { value: newBudgetName.trim() || 'My Budget' })
    setIsCreating(true)
    setError(null)
    setSuccess(null)
    try {
      const result = await createBudget.mutateAsync({ name: newBudgetName.trim() || 'My Budget', userId: currentUserId, userEmail: requireUserEmail() })
      // Switch to the newly created budget
      await switchToBudget(result.budgetId)
      setSuccess('Budget created successfully!')
      setNewBudgetName('')
      await loadAccessibleBudgets({ force: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create budget')
    } finally {
      setIsCreating(false)
    }
  }

  const acceptedBudgets = accessibleBudgets.filter(b => !b.isPending)
  const pendingBudgetsList = accessibleBudgets.filter(b => b.isPending)

  useEffect(() => {
    if (loading || !isInitialized) {
      addLoadingHold('my-budgets', 'Loading your budgets...')
    } else {
      removeLoadingHold('my-budgets')
    }
    return () => removeLoadingHold('my-budgets')
  }, [loading, isInitialized, addLoadingHold, removeLoadingHold])

  if (loading || !isInitialized) return null

  // Determine page title and description based on context
  let pageTitle = 'My Budgets'
  let pageDescription = 'Switch between budgets, accept invitations, or create a new budget.'

  if (isBudgetNotFound) {
    pageTitle = 'Budget Not Found'
    pageDescription = 'Your selected budget could not be found. It may have been deleted. Select another budget or create a new one.'
  } else if (isNewUser) {
    pageTitle = 'Welcome!'
    pageDescription = "Get started by creating your first budget or accepting an invitation."
  }

  return (
    <div>
      <h1>{pageTitle}</h1>
      <p style={{ opacity: 0.7, marginBottom: '1.5rem' }}>
        {pageDescription}
      </p>

      {error && <ErrorAlertBox message={error} onDismiss={() => setError(null)} />}
      {success && <SuccessAlertBox message={success} onDismiss={() => setSuccess(null)} />}

      {/* Pending Invitations */}
      {pendingBudgetsList.length > 0 && (
        <div style={{ background: 'color-mix(in srgb, var(--color-warning) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)', padding: '1.25rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📨</span> Pending Invitations ({pendingBudgetsList.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {pendingBudgetsList.map((budget) => (
              <BudgetCard key={budget.id} budget={budget} isCurrent={false} isAccepting={isAccepting === budget.id} isSwitching={false}
                isEditing={false} editName="" isRenaming={false} onAccept={() => handleAcceptInvite(budget.id)} onSwitch={() => {}}
                onStartEdit={() => {}} onCancelEdit={() => {}} onEditNameChange={() => {}} onSaveEdit={() => {}} />
            ))}
          </div>
        </div>
      )}

      {/* Your Budgets - only show if user has budgets */}
      {acceptedBudgets.length > 0 && (
        <div style={{ background: 'color-mix(in srgb, currentColor 5%, transparent)', padding: '1.25rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📋</span> Your Budgets ({acceptedBudgets.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {acceptedBudgets.map((budget) => (
              <BudgetCard key={budget.id} budget={budget} isCurrent={budget.id === selectedBudgetId}
                isAccepting={false} isSwitching={isSwitching === budget.id} isEditing={editingBudgetId === budget.id}
                editName={editingBudgetId === budget.id ? editName : ''} isRenaming={isRenaming}
                onAccept={() => {}} onSwitch={() => handleSwitchBudget(budget.id)} onStartEdit={() => startEditing(budget.id, budget.name)}
                onCancelEdit={() => { setEditingBudgetId(null); setEditName('') }} onEditNameChange={setEditName} onSaveEdit={handleRename} />
            ))}
          </div>
        </div>
      )}

      {/* Create New Budget */}
      <div style={{
        background: 'color-mix(in srgb, var(--color-primary) 8%, transparent)',
        border: '1px solid color-mix(in srgb, var(--color-primary) 25%, transparent)',
        padding: '1.5rem',
        borderRadius: '8px',
        marginBottom: '1.5rem',
      }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>✨</span> Create New Budget
        </h3>
        <form onSubmit={handleCreateBudget}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', opacity: 0.8 }}>
              Budget Name
            </label>
            <input
              type="text"
              value={newBudgetName}
              onChange={(e) => setNewBudgetName(e.target.value)}
              placeholder="My Budget"
              style={{
                width: '100%',
                padding: '0.6rem 0.8rem',
                borderRadius: '6px',
                border: '1px solid color-mix(in srgb, currentColor 25%, transparent)',
                background: 'color-mix(in srgb, currentColor 5%, transparent)',
                fontSize: '0.95rem',
                color: 'inherit',
                boxSizing: 'border-box',
              }}
            />
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', opacity: 0.5 }}>
              You can always rename this later
            </p>
          </div>
          <button
            type="submit"
            disabled={isCreating}
            style={{
              background: colors.primary,
              color: 'white',
              border: 'none',
              padding: '0.6rem 1.5rem',
              borderRadius: '6px',
              cursor: isCreating ? 'not-allowed' : 'pointer',
              fontWeight: 500,
              opacity: isCreating ? 0.7 : 1,
              fontSize: '0.9rem',
            }}
          >
            {isCreating ? 'Creating...' : 'Create Budget'}
          </button>
        </form>
      </div>

      <ManualInviteSection budgetIdInput={budgetIdInput} setBudgetIdInput={setBudgetIdInput} isCheckingManual={isCheckingManual}
        manualInvite={manualInvite} isAccepting={isAccepting} onCheckInvite={handleCheckManualInvite}
        onAcceptInvite={handleAcceptManualInvite} onCancel={() => { setManualInvite(null); setBudgetIdInput('') }} />

      {currentUserId && <UserIdInfo currentUserId={currentUserId} />}
    </div>
  )
}

export default MyBudgets
