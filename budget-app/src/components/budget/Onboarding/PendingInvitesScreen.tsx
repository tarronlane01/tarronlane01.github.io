import { useState } from 'react'
import type { BudgetInvite } from '../../../types/budget'
import { colors } from '../../../styles/shared'

interface PendingInvitesScreenProps {
  invites: BudgetInvite[]
  onAccept: (budgetId: string) => Promise<void>
  onCreateNew: (name?: string) => Promise<void>
}

export function PendingInvitesScreen({ invites, onAccept, onCreateNew }: PendingInvitesScreenProps) {
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

