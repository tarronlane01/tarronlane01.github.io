import { useState, useEffect, useLayoutEffect, type FormEvent } from 'react'
import { useApp, useBudget } from '@contexts'
import { useBudgetData } from '@hooks'
import { BudgetCard } from '../../components/budget/Admin'
import { logUserAction } from '@utils'
import { ErrorAlertBox, SuccessAlertBox } from './MyBudgetsAlerts'
import { ManualInviteSection, UserIdInfo } from './MyBudgetsManualInvite'

function MyBudgets() {
  const { addLoadingHold, removeLoadingHold } = useApp()
  const { selectedBudgetId, currentUserId, accessibleBudgets, loadAccessibleBudgets, switchToBudget, checkBudgetInvite, isInitialized, setPageTitle } = useBudget()

  useLayoutEffect(() => { setPageTitle('My Budgets') }, [setPageTitle])

  useEffect(() => {
    if (isInitialized) loadAccessibleBudgets()
  }, [isInitialized, loadAccessibleBudgets])

  const { budget: currentBudget, renameBudget, acceptInvite, isLoading: loading } = useBudgetData(selectedBudgetId, currentUserId)

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

  async function handleSwitchBudget(budgetId: string) {
    if (budgetId === currentBudget?.id) return
    logUserAction('CLICK', 'Switch Budget', { details: budgetId })
    setIsSwitching(budgetId)
    setError(null)
    setSuccess(null)
    try {
      await switchToBudget(budgetId)
      setSuccess('Switched to budget successfully!')
      await loadAccessibleBudgets()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch budget')
    } finally {
      setIsSwitching(null)
    }
  }

  async function handleAcceptInvite(budgetId: string) {
    logUserAction('CLICK', 'Accept Budget Invite', { details: budgetId })
    setIsAccepting(budgetId)
    setError(null)
    setSuccess(null)
    try {
      await acceptInvite(budgetId)
      setSuccess('Invitation accepted! You now have access to this budget.')
      await loadAccessibleBudgets()
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
    if (!manualInvite) return
    logUserAction('CLICK', 'Accept Manual Invite', { details: manualInvite.budgetName })
    setIsAccepting(manualInvite.budgetId)
    setError(null)
    try {
      await acceptInvite(manualInvite.budgetId)
      setSuccess(`Successfully joined "${manualInvite.budgetName}"!`)
      setManualInvite(null)
      setBudgetIdInput('')
      await loadAccessibleBudgets()
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
    if (!editName.trim() || !editingBudgetId) return
    logUserAction('SUBMIT', 'Rename Budget', { value: editName.trim() })
    setIsRenaming(true)
    setError(null)
    setSuccess(null)
    try {
      await renameBudget(editName.trim())
      setSuccess('Budget renamed successfully!')
      setEditingBudgetId(null)
      await loadAccessibleBudgets()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename budget')
    } finally {
      setIsRenaming(false)
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

  return (
    <div>
      <h1>My Budgets</h1>
      <p style={{ opacity: 0.7, marginBottom: '1.5rem' }}>
        Switch between budgets, accept invitations, or join a budget by ID.
      </p>

      {error && <ErrorAlertBox message={error} onDismiss={() => setError(null)} />}
      {success && <SuccessAlertBox message={success} onDismiss={() => setSuccess(null)} />}

      {/* Pending Invitations */}
      {pendingBudgetsList.length > 0 && (
        <div style={{ background: 'color-mix(in srgb, #f59e0b 10%, transparent)', border: '1px solid color-mix(in srgb, #f59e0b 30%, transparent)', padding: '1.25rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
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

      {/* All Budgets */}
      <div style={{ background: 'color-mix(in srgb, currentColor 5%, transparent)', padding: '1.25rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>📋</span> Your Budgets ({acceptedBudgets.length})
        </h3>
        {acceptedBudgets.length === 0 ? (
          <p style={{ opacity: 0.6, margin: 0 }}>You don't have access to any budgets yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {acceptedBudgets.map((budget) => (
              <BudgetCard key={budget.id} budget={budget} isCurrent={budget.id === currentBudget?.id}
                isAccepting={false} isSwitching={isSwitching === budget.id} isEditing={editingBudgetId === budget.id}
                editName={editingBudgetId === budget.id ? editName : ''} isRenaming={isRenaming}
                onAccept={() => {}} onSwitch={() => handleSwitchBudget(budget.id)} onStartEdit={() => startEditing(budget.id, budget.name)}
                onCancelEdit={() => { setEditingBudgetId(null); setEditName('') }} onEditNameChange={setEditName} onSaveEdit={handleRename} />
            ))}
          </div>
        )}
      </div>

      <ManualInviteSection budgetIdInput={budgetIdInput} setBudgetIdInput={setBudgetIdInput} isCheckingManual={isCheckingManual}
        manualInvite={manualInvite} isAccepting={isAccepting} onCheckInvite={handleCheckManualInvite}
        onAcceptInvite={handleAcceptManualInvite} onCancel={() => { setManualInvite(null); setBudgetIdInput('') }} />

      {currentUserId && <UserIdInfo currentUserId={currentUserId} />}
    </div>
  )
}

export default MyBudgets
