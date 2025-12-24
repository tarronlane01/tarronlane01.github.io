import { useState, type FormEvent } from 'react'
import { useBudget } from '../../contexts/budget_context'
import { useBudgetData } from '../../hooks'
import { PageContainer, BudgetNavBar } from '../../components/ui'
import { BudgetCard } from '../../components/budget/Admin'

function MyBudgets() {
  const {
    selectedBudgetId,
    currentUserId,
    accessibleBudgets,
    loadAccessibleBudgets,
    switchToBudget,
    checkBudgetInvite,
    isInitialized,
  } = useBudget()

  const {
    budget: currentBudget,
    renameBudget,
    acceptInvite,
    isLoading: loading,
  } = useBudgetData(selectedBudgetId, currentUserId)

  const [isSwitching, setIsSwitching] = useState<string | null>(null)
  const [isAccepting, setIsAccepting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Rename budget
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)

  // Manual invite acceptance
  const [budgetIdInput, setBudgetIdInput] = useState('')
  const [isCheckingManual, setIsCheckingManual] = useState(false)
  const [manualInvite, setManualInvite] = useState<{ budgetId: string; budgetName: string; ownerEmail: string | null } | null>(null)

  async function handleSwitchBudget(budgetId: string) {
    if (budgetId === currentBudget?.id) return

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
    setEditName(name)
    setEditingBudgetId(budgetId)
  }

  function cancelEditing() {
    setEditingBudgetId(null)
    setEditName('')
  }

  async function handleRename(e: FormEvent) {
    e.preventDefault()
    if (!editName.trim() || !editingBudgetId) return

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

  if (loading || !isInitialized) {
    return (
      <PageContainer>
        <p>Loading your budgets...</p>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <BudgetNavBar title="My Budgets" />

      <h1>My Budgets</h1>
      <p style={{ opacity: 0.7, marginBottom: '1.5rem' }}>
        Switch between budgets, accept invitations, or join a budget by ID.
      </p>

      {error && (
        <div style={{
          background: 'rgba(220, 38, 38, 0.1)',
          border: '1px solid rgba(220, 38, 38, 0.3)',
          color: '#f87171',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          marginBottom: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#f87171',
              cursor: 'pointer',
              fontSize: '1.2rem',
              padding: '0 0.25rem',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      )}

      {success && (
        <div style={{
          background: 'rgba(34, 197, 94, 0.1)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          color: '#4ade80',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          marginBottom: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>{success}</span>
          <button
            onClick={() => setSuccess(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#4ade80',
              cursor: 'pointer',
              fontSize: '1.2rem',
              padding: '0 0.25rem',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Pending Invitations */}
      {pendingBudgetsList.length > 0 && (
        <div style={{
          background: 'color-mix(in srgb, #f59e0b 10%, transparent)',
          border: '1px solid color-mix(in srgb, #f59e0b 30%, transparent)',
          padding: '1.25rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
        }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📨</span> Pending Invitations ({pendingBudgetsList.length})
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {pendingBudgetsList.map((budget) => (
              <BudgetCard
                key={budget.id}
                budget={budget}
                isCurrent={false}
                isAccepting={isAccepting === budget.id}
                isSwitching={false}
                isEditing={false}
                editName=""
                isRenaming={false}
                onAccept={() => handleAcceptInvite(budget.id)}
                onSwitch={() => {}}
                onStartEdit={() => {}}
                onCancelEdit={() => {}}
                onEditNameChange={() => {}}
                onSaveEdit={() => {}}
              />
            ))}
          </div>
        </div>
      )}

      {/* All Budgets */}
      <div style={{
        background: 'color-mix(in srgb, currentColor 5%, transparent)',
        padding: '1.25rem',
        borderRadius: '8px',
        marginBottom: '1.5rem',
      }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>📋</span> Your Budgets ({acceptedBudgets.length})
        </h3>

        {acceptedBudgets.length === 0 ? (
          <p style={{ opacity: 0.6, margin: 0 }}>You don't have access to any budgets yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {acceptedBudgets.map((budget) => {
              const isCurrent = budget.id === currentBudget?.id
              const isEditingThis = editingBudgetId === budget.id

              return (
                <BudgetCard
                  key={budget.id}
                  budget={budget}
                  isCurrent={isCurrent}
                  isAccepting={false}
                  isSwitching={isSwitching === budget.id}
                  isEditing={isEditingThis}
                  editName={isEditingThis ? editName : ''}
                  isRenaming={isRenaming}
                  onAccept={() => {}}
                  onSwitch={() => handleSwitchBudget(budget.id)}
                  onStartEdit={() => startEditing(budget.id, budget.name)}
                  onCancelEdit={cancelEditing}
                  onEditNameChange={setEditName}
                  onSaveEdit={handleRename}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Manual Invite Acceptance */}
      <div style={{
        background: 'color-mix(in srgb, currentColor 5%, transparent)',
        padding: '1.25rem',
        borderRadius: '8px',
      }}>
        <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>🔗</span> Join Budget by ID
        </h3>
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', opacity: 0.7 }}>
          If someone shared a budget ID with you, enter it below to accept the invitation:
        </p>

        {!manualInvite ? (
          <form onSubmit={handleCheckManualInvite} style={{ display: 'flex', gap: '0.75rem' }}>
            <input
              type="text"
              value={budgetIdInput}
              onChange={(e) => setBudgetIdInput(e.target.value)}
              placeholder="Enter Budget ID"
              style={{
                flex: 1,
                padding: '0.6rem 0.8rem',
                borderRadius: '6px',
                border: '1px solid color-mix(in srgb, currentColor 20%, transparent)',
                background: 'color-mix(in srgb, currentColor 5%, transparent)',
                fontSize: '0.95rem',
                color: 'inherit',
              }}
            />
            <button
              type="submit"
              disabled={isCheckingManual || !budgetIdInput.trim()}
              style={{
                background: '#646cff',
                color: 'white',
                border: 'none',
                padding: '0.6rem 1.25rem',
                borderRadius: '6px',
                cursor: isCheckingManual || !budgetIdInput.trim() ? 'not-allowed' : 'pointer',
                fontWeight: 500,
                opacity: isCheckingManual || !budgetIdInput.trim() ? 0.7 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {isCheckingManual ? 'Checking...' : 'Check Invite'}
            </button>
          </form>
        ) : (
          <div style={{
            background: 'color-mix(in srgb, #22c55e 10%, transparent)',
            border: '1px solid color-mix(in srgb, #22c55e 30%, transparent)',
            padding: '1rem',
            borderRadius: '8px',
          }}>
            <p style={{ margin: '0 0 0.75rem 0', fontWeight: 500 }}>
              🎉 You've been invited to join:
            </p>
            <div style={{
              background: 'color-mix(in srgb, currentColor 8%, transparent)',
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              marginBottom: '1rem',
            }}>
              <p style={{ margin: '0 0 0.25rem 0', fontWeight: 600, fontSize: '1.1rem' }}>
                {manualInvite.budgetName}
              </p>
              {manualInvite.ownerEmail && (
                <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.7 }}>
                  Owner: {manualInvite.ownerEmail}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={handleAcceptManualInvite}
                disabled={isAccepting === manualInvite.budgetId}
                style={{
                  background: '#22c55e',
                  color: 'white',
                  border: 'none',
                  padding: '0.6rem 1.25rem',
                  borderRadius: '6px',
                  cursor: isAccepting === manualInvite.budgetId ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                  opacity: isAccepting === manualInvite.budgetId ? 0.7 : 1,
                }}
              >
                {isAccepting === manualInvite.budgetId ? 'Accepting...' : 'Accept Invitation'}
              </button>
              <button
                onClick={() => {
                  setManualInvite(null)
                  setBudgetIdInput('')
                }}
                disabled={isAccepting === manualInvite.budgetId}
                style={{
                  background: 'transparent',
                  color: 'inherit',
                  border: '1px solid color-mix(in srgb, currentColor 30%, transparent)',
                  padding: '0.6rem 1.25rem',
                  borderRadius: '6px',
                  cursor: isAccepting === manualInvite.budgetId ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                  opacity: isAccepting === manualInvite.budgetId ? 0.7 : 0.8,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User ID Info */}
      {currentUserId && (
        <div style={{
          marginTop: '1.5rem',
          padding: '1rem',
          background: 'color-mix(in srgb, currentColor 3%, transparent)',
          borderRadius: '6px',
          fontSize: '0.85rem',
          opacity: 0.7,
        }}>
          <p style={{ margin: '0 0 0.5rem 0' }}>
            💡 Share your User ID with budget owners so they can invite you:
          </p>
          <code style={{
            display: 'block',
            padding: '0.5rem 0.75rem',
            background: 'color-mix(in srgb, currentColor 8%, transparent)',
            borderRadius: '4px',
            fontSize: '0.8rem',
            wordBreak: 'break-all',
          }}>
            {currentUserId}
          </code>
        </div>
      )}
    </PageContainer>
  )
}

export default MyBudgets

