import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useApp, useBudget } from '@contexts'
import { useBudgetData } from '@hooks'
import { BudgetNavBar } from './ui'
import { pageContainer } from '@styles/shared'

export default function BudgetLayout() {
  const { addLoadingHold, removeLoadingHold } = useApp()
  const { selectedBudgetId, currentUserId, isInitialized, pageTitle } = useBudget()

  // Hook: budget data and refresh
  const { isLoading: loading, error } = useBudgetData(selectedBudgetId, currentUserId)

  // Add loading hold during initialization
  useEffect(() => {
    if (!isInitialized) {
      const message = loading ? 'Fetching data from server...' : 'Loading budget...'
      addLoadingHold('budget-init', message)
    } else {
      removeLoadingHold('budget-init')
    }
  }, [isInitialized, loading, addLoadingHold, removeLoadingHold])

  // Cleanup on unmount
  useEffect(() => {
    return () => removeLoadingHold('budget-init')
  }, [removeLoadingHold])

  if (error) {
    console.error('[BudgetLayout] Error:', error)
    return (
      <div style={pageContainer}>
        <p style={{ color: '#ef4444' }}>Error: {error.message}</p>
      </div>
    )
  }

  return (
    <div style={{ ...pageContainer, paddingBottom: '5rem' }}>
      <BudgetNavBar title={pageTitle} />
      {isInitialized && <Outlet />}
    </div>
  )
}

