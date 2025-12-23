import { useState, useEffect, useRef } from 'react'
import { useBudget } from '../../../contexts/budget_context'
import { useBudgetData, useBudgetMonth } from '../../../hooks'
import { colors } from '../../../styles/shared'
import { MONTH_NAMES } from '@constants'

interface MonthNavigationProps {
  isLoading: boolean
  onPreviousMonth: () => void
  onNextMonth: () => void
  onRecalculateAll: () => void
  isRecomputing: boolean
}

export function MonthNavigation({
  isLoading,
  onPreviousMonth,
  onNextMonth,
  onRecalculateAll,
  isRecomputing,
}: MonthNavigationProps) {
  const { currentYear, currentMonthNumber, isAdmin, selectedBudgetId, currentUserId } = useBudget()
  const { budget: currentBudget } = useBudgetData(selectedBudgetId, currentUserId)
  const { month: currentMonth } = useBudgetMonth(selectedBudgetId, currentYear, currentMonthNumber)

  const [showMonthMenu, setShowMonthMenu] = useState(false)
  const monthMenuRef = useRef<HTMLDivElement>(null)

  // Close month menu when clicking outside
  useEffect(() => {
    if (!showMonthMenu) return
    function handleClickOutside(e: MouseEvent) {
      if (monthMenuRef.current && !monthMenuRef.current.contains(e.target as Node)) {
        setShowMonthMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMonthMenu])

  function handleDownloadJson() {
    if (!currentMonth || !currentBudget) return
    const monthData = {
      ...currentMonth,
      _meta: {
        downloaded_at: new Date().toISOString(),
        budget_id: currentBudget.id,
        budget_name: currentBudget.name,
      }
    }
    const blob = new Blob([JSON.stringify(monthData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `month_${currentYear}_${String(currentMonthNumber).padStart(2, '0')}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setShowMonthMenu(false)
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '1rem',
      marginBottom: '1.5rem',
      padding: '1rem',
      background: 'color-mix(in srgb, currentColor 5%, transparent)',
      borderRadius: '12px',
    }}>
      <button
        onClick={onPreviousMonth}
        disabled={isLoading}
        style={{
          background: 'color-mix(in srgb, currentColor 10%, transparent)',
          border: 'none',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          fontSize: '1.25rem',
          opacity: isLoading ? 0.5 : 1,
          transition: 'opacity 0.15s, background 0.15s',
        }}
        title="Previous month"
      >
        ←
      </button>

      <div ref={monthMenuRef} style={{ textAlign: 'center', minWidth: '180px', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: '0.25rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem' }}>
            {MONTH_NAMES[currentMonthNumber - 1]} {currentYear}
          </h2>
          <button
            onClick={() => setShowMonthMenu(!showMonthMenu)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.5rem',
              opacity: 0.4,
              padding: '0.15rem',
              borderRadius: '4px',
              transition: 'opacity 0.15s, transform 0.15s',
              transform: showMonthMenu ? 'rotate(180deg)' : 'rotate(0deg)',
              marginTop: '0.25rem',
            }}
            title="Month options"
          >
            ▼
          </button>
        </div>
        {isLoading && (
          <>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              marginTop: '0.35rem',
            }}>
              <span
                style={{
                  display: 'inline-block',
                  width: '14px',
                  height: '14px',
                  border: '2px solid color-mix(in srgb, currentColor 20%, transparent)',
                  borderTopColor: colors.primary,
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Loading...</span>
            </div>
          </>
        )}
        {/* Month options menu */}
        {showMonthMenu && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginTop: '0.5rem',
              background: 'var(--background, #242424)',
              border: '1px solid color-mix(in srgb, currentColor 20%, transparent)',
              borderRadius: '8px',
              padding: '0.25rem',
              zIndex: 10,
              minWidth: '160px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
          >
            <button
              onClick={() => {
                onRecalculateAll()
                setShowMonthMenu(false)
              }}
              disabled={isRecomputing || isLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                width: '100%',
                background: 'transparent',
                border: 'none',
                borderRadius: '6px',
                padding: '0.5rem 0.75rem',
                cursor: isRecomputing || isLoading ? 'not-allowed' : 'pointer',
                fontSize: '0.85rem',
                color: 'inherit',
                opacity: isRecomputing || isLoading ? 0.5 : 1,
                textAlign: 'left',
                transition: 'background 0.15s',
              }}
              title="Recalculate all totals and category balances for this month"
            >
              {isRecomputing ? '⏳' : '🔄'} Recalculate All
            </button>
            {/* Admin-only: Download month data */}
            {isAdmin && currentMonth && (
              <button
                onClick={handleDownloadJson}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.5rem 0.75rem',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  color: 'inherit',
                  textAlign: 'left',
                  transition: 'background 0.15s',
                }}
                title="Download month document as JSON (for debugging)"
              >
                📥 Download JSON
              </button>
            )}
          </div>
        )}
      </div>

      <button
        onClick={onNextMonth}
        disabled={isLoading}
        style={{
          background: 'color-mix(in srgb, currentColor 10%, transparent)',
          border: 'none',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          fontSize: '1.25rem',
          opacity: isLoading ? 0.5 : 1,
          transition: 'opacity 0.15s, background 0.15s',
        }}
        title="Next month"
      >
        →
      </button>
    </div>
  )
}

