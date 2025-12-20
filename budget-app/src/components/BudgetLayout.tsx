import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useBudget } from '../contexts/budget_context'

export default function BudgetLayout() {
  const { ensureBudgetLoaded, isInitialized, error } = useBudget()

  useEffect(() => {
    ensureBudgetLoaded()
  }, [])

  // Don't render children until budget is initialized
  if (!isInitialized) {
    return null
  }

  if (error) {
    return (
      <div style={{ maxWidth: '60rem', margin: '0 auto', padding: '2rem' }}>
        <p style={{ color: '#ef4444' }}>Error: {error}</p>
      </div>
    )
  }

  return <Outlet />
}

