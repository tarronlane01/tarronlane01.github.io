import { useState } from 'react'
import { colors } from '@styles/shared'

interface CreateFirstBudgetScreenProps {
  onCreateNew: (name?: string) => Promise<void>
}

export function CreateFirstBudgetScreen({ onCreateNew }: CreateFirstBudgetScreenProps) {
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

