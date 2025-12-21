import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useBudget, type BudgetInvite } from '../../contexts/budget_context'
import { PageContainer } from '../../components/ui'
import { navBar, colors } from '../../styles/shared'

function Budget() {
  const { currentBudget, isOwner, hasPendingInvites, pendingInvites, needsFirstBudget, acceptBudgetInvite, createNewBudget } = useBudget()

  // If no current budget but there are pending invites, show invite selection
  if (!currentBudget && hasPendingInvites) {
    return (
      <PageContainer>
        <nav style={navBar}>
          <Link to="/">← Back to Home</Link>
        </nav>
        <PendingInvitesScreen
          invites={pendingInvites}
          onAccept={acceptBudgetInvite}
          onCreateNew={createNewBudget}
        />
      </PageContainer>
    )
  }

  // If user needs to create their first budget (no invites, no existing budgets)
  if (!currentBudget && needsFirstBudget) {
    return (
      <PageContainer>
        <nav style={navBar}>
          <Link to="/">← Back to Home</Link>
        </nav>
        <CreateFirstBudgetScreen onCreateNew={createNewBudget} />
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <nav style={navBar}>
        <Link to="/">← Back to Home</Link>
        <Link
          to="/budget/admin"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '2.5rem',
            height: '2.5rem',
            borderRadius: '8px',
            background: 'color-mix(in srgb, currentColor 8%, transparent)',
            textDecoration: 'none',
            fontSize: '1.25rem',
            transition: 'background 0.15s',
          }}
          title={isOwner ? 'Admin Settings' : 'Budget Settings'}
        >
          ⚙️
        </Link>
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
        <h1 style={{ margin: 0 }}>Budget</h1>
        {currentBudget && (
          <span style={{
            background: `color-mix(in srgb, ${colors.primary} 15%, transparent)`,
            color: colors.primaryLight,
            padding: '0.25rem 0.75rem',
            borderRadius: '6px',
            fontSize: '0.85rem',
            fontWeight: 500,
          }}>
            {currentBudget.name}
          </span>
        )}
      </div>

      {currentBudget && (
        <p style={{ opacity: 0.6, fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          {currentBudget.user_ids.length} user{currentBudget.user_ids.length !== 1 ? 's' : ''} •
          {isOwner ? ' You are the owner' : ' Shared with you'}
        </p>
      )}

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem',
        borderRadius: '12px',
        background: 'color-mix(in srgb, currentColor 5%, transparent)',
        border: '1px dashed color-mix(in srgb, currentColor 20%, transparent)',
      }}>
        <p style={{ margin: 0, opacity: 0.6, fontSize: '1.1rem' }}>
          Content coming soon
        </p>
      </div>
    </PageContainer>
  )
}

interface CreateFirstBudgetScreenProps {
  onCreateNew: (name?: string) => Promise<void>
}

function CreateFirstBudgetScreen({ onCreateNew }: CreateFirstBudgetScreenProps) {
  const [budgetName, setBudgetName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setIsCreating(true)
    setError(null)

    try {
      await onCreateNew(budgetName.trim() || undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create budget')
      setIsCreating(false)
    }
  }

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '0.5rem' }}>Welcome!</h1>
      <p style={{ opacity: 0.7, marginBottom: '2rem' }}>
        You don't have any budgets yet. Create your first budget to get started.
      </p>

      {error && (
        <div style={{
          background: 'rgba(220, 38, 38, 0.1)',
          border: '1px solid rgba(220, 38, 38, 0.3)',
          color: '#f87171',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
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

      <div style={{
        background: 'color-mix(in srgb, #646cff 8%, transparent)',
        border: '1px solid color-mix(in srgb, #646cff 25%, transparent)',
        padding: '2rem',
        borderRadius: '12px',
      }}>
        <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>✨</span> Create Your Budget
        </h2>

        <form onSubmit={handleCreate}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', opacity: 0.8 }}>
              Budget Name
            </label>
            <input
              type="text"
              value={budgetName}
              onChange={(e) => setBudgetName(e.target.value)}
              placeholder="My Budget"
              autoFocus
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: '1px solid color-mix(in srgb, currentColor 25%, transparent)',
                background: 'color-mix(in srgb, currentColor 5%, transparent)',
                fontSize: '1rem',
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
              width: '100%',
              background: colors.primary,
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              cursor: isCreating ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              opacity: isCreating ? 0.7 : 1,
              fontSize: '1rem',
            }}
          >
            {isCreating ? 'Creating...' : 'Create Budget'}
          </button>
        </form>
      </div>

      <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.85rem', opacity: 0.6 }}>
        If someone has invited you to their budget, you can accept the invitation from the budget settings page after creating your account.
      </p>
    </div>
  )
}

interface PendingInvitesScreenProps {
  invites: BudgetInvite[]
  onAccept: (budgetId: string) => Promise<void>
  onCreateNew: (name?: string) => Promise<void>
}

function PendingInvitesScreen({ invites, onAccept, onCreateNew }: PendingInvitesScreenProps) {
  const [isAccepting, setIsAccepting] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [budgetName, setBudgetName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAccept(budgetId: string) {
    setIsAccepting(budgetId)
    setError(null)

    try {
      await onAccept(budgetId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation')
      setIsAccepting(null)
    }
  }

  async function handleCreateNew(e: React.FormEvent) {
    e.preventDefault()
    setIsCreating(true)
    setError(null)

    try {
      await onCreateNew(budgetName.trim() || undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create new budget')
      setIsCreating(false)
    }
  }

  return (
    <div>
      <h1 style={{ marginBottom: '0.5rem' }}>Welcome!</h1>
      <p style={{ opacity: 0.7, marginBottom: '2rem' }}>
        You've been invited to join {invites.length === 1 ? 'a budget' : 'some budgets'}. Choose one to get started!
      </p>

      {error && (
        <div style={{
          background: 'rgba(220, 38, 38, 0.1)',
          border: '1px solid rgba(220, 38, 38, 0.3)',
          color: '#f87171',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
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

      {/* Pending Invitations */}
      <div style={{
        background: 'color-mix(in srgb, #f59e0b 8%, transparent)',
        border: '1px solid color-mix(in srgb, #f59e0b 25%, transparent)',
        padding: '1.5rem',
        borderRadius: '12px',
        marginBottom: '1.5rem',
      }}>
        <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>📨</span> Budget Invitations
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {invites.map((invite) => (
            <div
              key={invite.budgetId}
              style={{
                background: 'color-mix(in srgb, currentColor 8%, transparent)',
                padding: '1rem 1.25rem',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ flex: 1, minWidth: '200px' }}>
                <p style={{ margin: '0 0 0.25rem 0', fontWeight: 600, fontSize: '1.05rem' }}>
                  {invite.budgetName}
                </p>
                {invite.ownerEmail && (
                  <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.6 }}>
                    From: {invite.ownerEmail}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleAccept(invite.budgetId)}
                disabled={isAccepting !== null || isCreating}
                style={{
                  background: '#22c55e',
                  color: 'white',
                  border: 'none',
                  padding: '0.6rem 1.5rem',
                  borderRadius: '8px',
                  cursor: isAccepting !== null || isCreating ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                  opacity: isAccepting !== null || isCreating ? 0.7 : 1,
                  fontSize: '0.9rem',
                }}
              >
                {isAccepting === invite.budgetId ? 'Joining...' : 'Accept & Join'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Create New Budget Option */}
      <div style={{
        background: 'color-mix(in srgb, currentColor 5%, transparent)',
        border: '1px dashed color-mix(in srgb, currentColor 20%, transparent)',
        padding: '1.5rem',
        borderRadius: '12px',
      }}>
        {!showCreateForm ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: '0 0 1rem 0', opacity: 0.7 }}>
              Or start fresh with your own budget
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              disabled={isAccepting !== null}
              style={{
                background: colors.primary,
                color: 'white',
                border: 'none',
                padding: '0.6rem 1.5rem',
                borderRadius: '8px',
                cursor: isAccepting !== null ? 'not-allowed' : 'pointer',
                fontWeight: 500,
                opacity: isAccepting !== null ? 0.7 : 1,
                fontSize: '0.9rem',
              }}
            >
              Create New Budget
            </button>
          </div>
        ) : (
          <form onSubmit={handleCreateNew}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>Create Your Budget</h3>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', opacity: 0.8 }}>
                Budget Name
              </label>
              <input
                type="text"
                value={budgetName}
                onChange={(e) => setBudgetName(e.target.value)}
                placeholder="My Budget"
                autoFocus
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
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="submit"
                disabled={isCreating || isAccepting !== null}
                style={{
                  background: colors.primary,
                  color: 'white',
                  border: 'none',
                  padding: '0.6rem 1.25rem',
                  borderRadius: '6px',
                  cursor: isCreating || isAccepting !== null ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                  opacity: isCreating || isAccepting !== null ? 0.7 : 1,
                  fontSize: '0.9rem',
                }}
              >
                {isCreating ? 'Creating...' : 'Create Budget'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false)
                  setBudgetName('')
                }}
                disabled={isCreating}
                style={{
                  background: 'transparent',
                  color: 'inherit',
                  border: '1px solid color-mix(in srgb, currentColor 30%, transparent)',
                  padding: '0.6rem 1.25rem',
                  borderRadius: '6px',
                  cursor: isCreating ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                  opacity: isCreating ? 0.7 : 0.8,
                  fontSize: '0.9rem',
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default Budget
