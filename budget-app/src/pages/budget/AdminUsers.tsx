import { useState, type FormEvent } from 'react'
import { useBudget } from '../../contexts/budget_context'

function AdminUsers() {
  const { currentBudget, currentUserId, updateBudgetUsers, refreshBudget } = useBudget()
  const [newUserId, setNewUserId] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  if (!currentBudget) {
    return <p>No budget found.</p>
  }

  async function handleAddUser(e: FormEvent) {
    e.preventDefault()
    if (!newUserId.trim() || !currentBudget) return

    setIsAdding(true)
    setError(null)
    setSuccess(null)

    try {
      // Check if user already exists
      if (currentBudget.user_ids.includes(newUserId.trim())) {
        throw new Error('This user already has access to this budget')
      }

      const updatedUserIds = [...currentBudget.user_ids, newUserId.trim()]
      await updateBudgetUsers(updatedUserIds)
      await refreshBudget()

      setNewUserId('')
      setSuccess('User added successfully!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add user')
    } finally {
      setIsAdding(false)
    }
  }

  async function handleRemoveUser(userIdToRemove: string) {
    if (!currentBudget) return

    if (userIdToRemove === currentBudget.owner_id) {
      setError('Cannot remove the budget owner')
      return
    }

    if (userIdToRemove === currentUserId) {
      setError('Cannot remove yourself from the budget')
      return
    }

    if (!confirm(`Are you sure you want to remove this user from the budget?`)) return

    setError(null)
    setSuccess(null)

    try {
      const updatedUserIds = currentBudget.user_ids.filter(id => id !== userIdToRemove)
      await updateBudgetUsers(updatedUserIds)
      await refreshBudget()

      setSuccess('User removed successfully!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove user')
    }
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Budget Users</h2>
      <p style={{ opacity: 0.7, marginBottom: '1.5rem' }}>
        Manage who has access to this budget. Add users by their Firebase User ID.
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

      {/* Current Users List */}
      <div style={{
        background: 'color-mix(in srgb, currentColor 5%, transparent)',
        padding: '1.25rem',
        borderRadius: '8px',
        marginBottom: '1.5rem',
      }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>
          Current Users ({currentBudget.user_ids.length})
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {currentBudget.user_ids.map((userId) => {
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
                    onClick={() => handleRemoveUser(userId)}
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
                    Remove
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Add User Form */}
      <div style={{
        background: 'color-mix(in srgb, currentColor 5%, transparent)',
        padding: '1.25rem',
        borderRadius: '8px',
      }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>Add User</h3>

        <form onSubmit={handleAddUser} style={{ display: 'flex', gap: '0.75rem' }}>
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
            disabled={isAdding || !newUserId.trim()}
            style={{
              background: '#646cff',
              color: 'white',
              border: 'none',
              padding: '0.6rem 1.25rem',
              borderRadius: '6px',
              cursor: isAdding || !newUserId.trim() ? 'not-allowed' : 'pointer',
              fontWeight: 500,
              opacity: isAdding || !newUserId.trim() ? 0.7 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {isAdding ? 'Adding...' : 'Add User'}
          </button>
        </form>

        <p style={{ margin: '1rem 0 0 0', fontSize: '0.85rem', opacity: 0.6 }}>
          💡 To get a user's Firebase ID, they need to log in and you can find it in the Firebase Console
          under Authentication → Users, or they can share it from their account page.
        </p>
      </div>
    </div>
  )
}

export default AdminUsers

