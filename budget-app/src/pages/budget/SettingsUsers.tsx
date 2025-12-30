import { useState, type FormEvent } from 'react'
import { useBudget } from '../../contexts/budget_context'
import { useBudgetData } from '../../hooks'
import { logUserAction } from '@utils/actionLogger'

function SettingsUsers() {
  // Context: identifiers only
  const { selectedBudgetId, currentUserId } = useBudget()

  // Hook: budget data and mutations
  const {
    budget: currentBudget,
    budgetUserIds,
    acceptedUserIds,
    inviteUser,
    revokeUser,
  } = useBudgetData(selectedBudgetId, currentUserId)

  const [newUserId, setNewUserId] = useState('')
  const [isInviting, setIsInviting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  if (!currentBudget) {
    return <p>No budget found.</p>
  }

  async function handleInviteUser(e: FormEvent) {
    e.preventDefault()
    if (!newUserId.trim() || !currentBudget) return

    logUserAction('SUBMIT', 'Invite User Form')
    setIsInviting(true)
    setError(null)
    setSuccess(null)

    try {
      await inviteUser(newUserId.trim())
      setNewUserId('')
      setSuccess('Invite sent! The user can now accept the invitation from their account.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite user')
    } finally {
      setIsInviting(false)
    }
  }

  async function handleRevokeUser(userIdToRevoke: string) {
    if (!currentBudget) return

    if (userIdToRevoke === currentBudget.owner_id) {
      setError('Cannot revoke the budget owner')
      return
    }

    if (userIdToRevoke === currentUserId) {
      setError('Cannot revoke yourself from the budget')
      return
    }

    const hasAccepted = acceptedUserIds.includes(userIdToRevoke)
    const message = hasAccepted
      ? 'Are you sure you want to revoke this user\'s access? They will lose access to this budget.'
      : 'Are you sure you want to cancel this invitation?'

    logUserAction('CLICK', hasAccepted ? 'Revoke User Access' : 'Cancel User Invite', { details: `userId: ${userIdToRevoke}` })
    if (!confirm(message)) return

    setError(null)
    setSuccess(null)

    try {
      await revokeUser(userIdToRevoke)
      setSuccess(hasAccepted ? 'User access revoked.' : 'Invitation cancelled.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke user')
    }
  }

  // Separate users into accepted and pending
  const acceptedUsers = budgetUserIds.filter(id => acceptedUserIds.includes(id))
  const pendingUsers = budgetUserIds.filter(id => !acceptedUserIds.includes(id))

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Budget Users</h2>
      <p style={{ opacity: 0.7, marginBottom: '1.5rem' }}>
        Invite users to access this budget. They must accept the invitation before they can access it.
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

      {/* Active Users (Accepted) */}
      <div style={{
        background: 'color-mix(in srgb, currentColor 5%, transparent)',
        padding: '1.25rem',
        borderRadius: '8px',
        marginBottom: '1.5rem',
      }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>
          Active Users ({acceptedUsers.length})
        </h3>

        {acceptedUsers.length === 0 ? (
          <p style={{ opacity: 0.6, margin: 0 }}>No users have accepted invitations yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {acceptedUsers.map((userId) => {
              const isOwner = userId === currentBudget.owner_id
              const isCurrentUser = userId === currentUserId

              return (
                <div
                  key={userId}
                  style={{
                    background: 'color-mix(in srgb, currentColor 8%, transparent)',
                    padding: '0.75rem 1rem',
                    borderRadius: '6px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '1rem',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <code style={{
                        fontSize: '0.85rem',
                        background: 'color-mix(in srgb, currentColor 10%, transparent)',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        wordBreak: 'break-all',
                      }}>
                        {userId}
                      </code>
                      {isOwner && (
                        <span style={{
                          background: 'color-mix(in srgb, #646cff 20%, transparent)',
                          color: '#a5b4fc',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          textTransform: 'uppercase',
                          fontWeight: 600,
                        }}>
                          Owner
                        </span>
                      )}
                      {isCurrentUser && (
                        <span style={{
                          background: 'color-mix(in srgb, #22c55e 20%, transparent)',
                          color: '#4ade80',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          textTransform: 'uppercase',
                          fontWeight: 600,
                        }}>
                          You
                        </span>
                      )}
                    </div>
                  </div>

                  {!isOwner && !isCurrentUser && (
                    <button
                      onClick={() => handleRevokeUser(userId)}
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(220, 38, 38, 0.4)',
                        color: '#f87171',
                        padding: '0.4rem 0.75rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Revoke Access
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Pending Invitations */}
      {pendingUsers.length > 0 && (
        <div style={{
          background: 'color-mix(in srgb, currentColor 5%, transparent)',
          padding: '1.25rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
        }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>
            Pending Invitations ({pendingUsers.length})
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {pendingUsers.map((userId) => (
              <div
                key={userId}
                style={{
                  background: 'color-mix(in srgb, #f59e0b 10%, transparent)',
                  border: '1px solid color-mix(in srgb, #f59e0b 30%, transparent)',
                  padding: '0.75rem 1rem',
                  borderRadius: '6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '1rem',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <code style={{
                      fontSize: '0.85rem',
                      background: 'color-mix(in srgb, currentColor 10%, transparent)',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      wordBreak: 'break-all',
                    }}>
                      {userId}
                    </code>
                    <span style={{
                      background: 'color-mix(in srgb, #f59e0b 20%, transparent)',
                      color: '#fbbf24',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                    }}>
                      Pending
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleRevokeUser(userId)}
                  style={{
                    background: 'transparent',
                    border: '1px solid color-mix(in srgb, currentColor 30%, transparent)',
                    color: 'inherit',
                    padding: '0.4rem 0.75rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    whiteSpace: 'nowrap',
                    opacity: 0.8,
                  }}
                >
                  Cancel Invite
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite User Form */}
      <div style={{
        background: 'color-mix(in srgb, currentColor 5%, transparent)',
        padding: '1.25rem',
        borderRadius: '8px',
      }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>Invite User</h3>

        <form onSubmit={handleInviteUser} style={{ display: 'flex', gap: '0.75rem' }}>
          <input
            type="text"
            value={newUserId}
            onChange={(e) => setNewUserId(e.target.value)}
            placeholder="Enter Firebase User ID"
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
            disabled={isInviting || !newUserId.trim()}
            style={{
              background: '#646cff',
              color: 'white',
              border: 'none',
              padding: '0.6rem 1.25rem',
              borderRadius: '6px',
              cursor: isInviting || !newUserId.trim() ? 'not-allowed' : 'pointer',
              fontWeight: 500,
              opacity: isInviting || !newUserId.trim() ? 0.7 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {isInviting ? 'Inviting...' : 'Send Invite'}
          </button>
        </form>

        <p style={{ margin: '1rem 0 0 0', fontSize: '0.85rem', opacity: 0.6 }}>
          💡 The invited user will need to accept the invitation from their Account page using this budget's ID:
        </p>
        <code style={{
          display: 'block',
          marginTop: '0.5rem',
          padding: '0.5rem 0.75rem',
          background: 'color-mix(in srgb, currentColor 10%, transparent)',
          borderRadius: '6px',
          fontSize: '0.85rem',
          wordBreak: 'break-all',
        }}>
          {currentBudget.id}
        </code>
      </div>
    </div>
  )
}

export default SettingsUsers

