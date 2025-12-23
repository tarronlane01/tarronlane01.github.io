import { Outlet } from 'react-router-dom'
import { useBudget } from '../contexts/budget_context'
import { useBudgetData } from '../hooks'

export default function BudgetLayout() {
  // Context: identifiers and UI state
  const {
    selectedBudgetId,
    currentUserId,
    isInitialized,
  } = useBudget()

  // Hook: budget data and refresh
  const {
    isLoading: loading,
    error,
  } = useBudgetData(selectedBudgetId, currentUserId)

  // Don't render children until budget is initialized
  if (!isInitialized) {
    return (
      <div style={{ maxWidth: '60rem', margin: '0 auto', padding: '2rem' }}>
        <p>Loading budget...</p>
        {loading && <p style={{ opacity: 0.6 }}>Fetching data from server...</p>}
      </div>
    )
  }

  if (error) {
    console.error('[BudgetLayout] Error:', error)
    return (
      <div style={{ maxWidth: '60rem', margin: '0 auto', padding: '2rem' }}>
        <p style={{ color: '#ef4444' }}>Error: {error.message}</p>
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: '5rem' }}>
      <Outlet />
    </div>
  )
}
