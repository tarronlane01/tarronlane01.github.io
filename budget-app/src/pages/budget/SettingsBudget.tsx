import { useEffect } from 'react'
import { useApp } from '../../contexts/app_context'
import { useBudget } from '../../contexts/budget_context'
import { useBudgetData } from '../../hooks'

function SettingsBudget() {
  const { addLoadingHold, removeLoadingHold } = useApp()
  const { selectedBudgetId, currentUserId, isAdmin } = useBudget()

  const {
    budget: currentBudget,
    accounts,
    accountGroups,
    categories,
    categoryGroups,
    isOwner,
    isLoading: loading,
  } = useBudgetData(selectedBudgetId, currentUserId)

  // Add loading hold while loading
  useEffect(() => {
    if (loading) {
      addLoadingHold('settings-budget', 'Loading budget info...')
    } else {
      removeLoadingHold('settings-budget')
    }
    return () => removeLoadingHold('settings-budget')
  }, [loading, addLoadingHold, removeLoadingHold])

  if (loading) return null

  if (!currentBudget) {
    return <p style={{ opacity: 0.7 }}>No budget selected.</p>
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Budget Summary</h2>
      <p style={{ opacity: 0.7, marginBottom: '1.5rem' }}>
        Information about the currently selected budget.
      </p>

      <div style={{
        background: 'color-mix(in srgb, currentColor 5%, transparent)',
        padding: '1.25rem',
        borderRadius: '8px',
        marginBottom: '1.5rem',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          fontSize: '0.95rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📋</span>
            <span style={{ opacity: 0.7, minWidth: '80px' }}>Name:</span>
            <strong>{currentBudget.name}</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🆔</span>
            <span style={{ opacity: 0.7, minWidth: '80px' }}>ID:</span>
            <code style={{
              background: 'color-mix(in srgb, currentColor 10%, transparent)',
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              fontSize: '0.85rem',
            }}>
              {currentBudget.id}
            </code>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>👤</span>
            <span style={{ opacity: 0.7, minWidth: '80px' }}>Owner:</span>
            <strong>{currentBudget.owner_email || currentBudget.owner_id}</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>👥</span>
            <span style={{ opacity: 0.7, minWidth: '80px' }}>Users:</span>
            <span>
              {currentBudget.user_ids.length} user{currentBudget.user_ids.length !== 1 ? 's' : ''}
              <span style={{ opacity: 0.7 }}> • {isOwner ? 'You are the owner' : 'Shared with you'}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Admin-only: Download budget document */}
      {isAdmin && (
        <div style={{
          background: 'color-mix(in srgb, currentColor 5%, transparent)',
          padding: '1.25rem',
          borderRadius: '8px',
        }}>
          <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem' }}>Admin Tools</h3>
          <button
            onClick={() => {
              const budgetData = {
                ...currentBudget,
                accounts,
                account_groups: accountGroups,
                categories,
                category_groups: categoryGroups,
                _meta: {
                  downloaded_at: new Date().toISOString(),
                }
              }
              const blob = new Blob([JSON.stringify(budgetData, null, 2)], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `budget_${currentBudget.id}.json`
              document.body.appendChild(a)
              a.click()
              document.body.removeChild(a)
              URL.revokeObjectURL(url)
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'color-mix(in srgb, currentColor 10%, transparent)',
              border: '1px solid color-mix(in srgb, currentColor 20%, transparent)',
              borderRadius: '6px',
              padding: '0.5rem 0.75rem',
              cursor: 'pointer',
              fontSize: '0.85rem',
              color: 'inherit',
              transition: 'background 0.15s',
            }}
            title="Download budget document as JSON (for debugging)"
          >
            📥 Download Budget JSON
          </button>
        </div>
      )}
    </div>
  )
}

export default SettingsBudget

