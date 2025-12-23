import { useEffect, useState, useRef } from 'react'
import { Outlet } from 'react-router-dom'
import { useBudget } from '../contexts/budget_context'
import { useBudgetData } from '../hooks'
import { colors } from '../styles/shared'

export default function BudgetLayout() {
  // Context: identifiers and UI state
  const {
    selectedBudgetId,
    currentUserId,
    isInitialized,
    clearCache,
  } = useBudget()

  // Hook: budget data and refresh
  const {
    isLoading: loading,
    error,
    refreshBudget,
  } = useBudgetData(selectedBudgetId, currentUserId)

  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showCacheInfo, setShowCacheInfo] = useState(false)
  const cacheMenuRef = useRef<HTMLDivElement>(null)

  // Close cache menu when clicking outside
  useEffect(() => {
    if (!showCacheInfo) return
    function handleClickOutside(e: MouseEvent) {
      if (cacheMenuRef.current && !cacheMenuRef.current.contains(e.target as Node)) {
        setShowCacheInfo(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showCacheInfo])

  async function handleForceRefresh() {
    setIsRefreshing(true)
    try {
      await refreshBudget()
    } finally {
      setIsRefreshing(false)
    }
  }

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
    <>
      {/* Cache Status Bar - positioned to the left of the feedback button */}
      <div
        ref={cacheMenuRef}
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '5.5rem', // Leave room for 3rem feedback button + 1.5rem right margin + 0.5rem gap
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '0.5rem',
        }}
      >
        {/* Expanded info panel */}
        {showCacheInfo && (
          <div
            style={{
              background: 'rgba(30, 30, 35, 0.95)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '1rem',
              minWidth: '220px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div style={{ marginBottom: '0.75rem' }}>
              <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Data Source
              </p>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', fontWeight: 500 }}>
                <span style={{ color: colors.success }}>☁️ React Query Cache</span>
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={handleForceRefresh}
                disabled={isRefreshing || loading}
                style={{
                  flex: 1,
                  background: colors.primary,
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  cursor: isRefreshing || loading ? 'not-allowed' : 'pointer',
                  opacity: isRefreshing || loading ? 0.6 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                {isRefreshing ? '⏳ Syncing...' : '🔄 Sync Now'}
              </button>
              <button
                onClick={() => {
                  clearCache()
                  setShowCacheInfo(false)
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: 'inherit',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                title="Clear all cached data"
              >
                🗑️
              </button>
            </div>
            <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.7rem', opacity: 0.5, lineHeight: 1.4 }}>
              Data is cached via React Query. Click "Sync Now" to fetch fresh data.
            </p>
          </div>
        )}

        {/* Compact toggle button */}
        <button
          onClick={() => setShowCacheInfo(!showCacheInfo)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: 'rgba(30, 30, 35, 0.9)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '20px',
            padding: '0.4rem 0.75rem',
            fontSize: '0.75rem',
            color: 'inherit',
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
            transition: 'all 0.15s',
          }}
          title="Data loaded via React Query"
        >
          <span>☁️</span>
          <span style={{ opacity: 0.8 }}>Cache</span>
          <span style={{ opacity: 0.5, fontSize: '0.65rem' }}>
            {showCacheInfo ? '▼' : '▲'}
          </span>
        </button>
      </div>

      {/* Wrap Outlet with bottom padding so fixed buttons don't block content */}
      <div style={{ paddingBottom: '5rem' }}>
        <Outlet />
      </div>
    </>
  )
}
