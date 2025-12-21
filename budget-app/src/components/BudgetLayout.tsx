import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useBudget } from '../contexts/budget_context'

export default function BudgetLayout() {
  const { ensureBudgetLoaded, isInitialized, loading, error } = useBudget()

  useEffect(() => {
    ensureBudgetLoaded()
  }, [])

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
        <p style={{ color: '#ef4444' }}>Error: {error}</p>
      </div>
    )
  }

  return <Outlet />
}
