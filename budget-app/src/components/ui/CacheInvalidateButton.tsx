import { useState, useEffect } from 'react'
import { useBudget } from '@contexts'
import { logUserAction } from '@utils'

const CONFIRMATION_TIMEOUT_MS = 1500

/**
 * Clear ALL React Query caches (in-memory and localStorage) and reload page.
 * This ensures the app fetches fresh data from Firestore for everything.
 */
function clearAllCachesAndReload() {
  // Clear localStorage persistence FIRST (before any async operations)
  try {
    localStorage.removeItem('BUDGET_APP_QUERY_CACHE')
  } catch (err) {
    console.warn('Failed to clear localStorage cache:', err)
  }

  // Reload immediately - in-memory cache is cleared on reload anyway
  window.location.reload()
}

export function CacheInvalidateButton() {
  const [showConfirmation, setShowConfirmation] = useState(false)
  const { isAdmin } = useBudget()

  // Auto-hide confirmation after timeout (though reload happens immediately)
  useEffect(() => {
    if (showConfirmation) {
      const timer = setTimeout(() => setShowConfirmation(false), CONFIRMATION_TIMEOUT_MS)
      return () => clearTimeout(timer)
    }
  }, [showConfirmation])

  // Only show for admin users
  if (!isAdmin) return null

  function handleClick() {
    logUserAction('CLICK', 'Cache Invalidate Button')
    setShowConfirmation(true)
    // Small delay so user sees feedback before reload
    setTimeout(() => {
      clearAllCachesAndReload()
    }, 200)
  }

  return (
    <>
      {/* Confirmation toast */}
      {showConfirmation && (
        <div
          style={{
            position: 'fixed',
            bottom: '5rem',
            right: '5.5rem',
            background: 'rgba(100, 108, 255, 0.95)',
            color: 'white',
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            fontSize: '0.9rem',
            fontWeight: 500,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            zIndex: 1001,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            animation: 'fadeInUp 0.2s ease-out',
          }}
        >
          <span>🔄</span>
          <span>Clearing cache & reloading...</span>
        </div>
      )}

      <button
        onClick={handleClick}
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '5.25rem', // 1.5rem + 3rem (feedback button) + 0.75rem gap
          width: '3rem',
          height: '3rem',
          borderRadius: '50%',
          background: '#4a4a4a',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.5rem',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          transition: 'transform 0.15s, box-shadow 0.15s',
          zIndex: 1000,
        }}
        title="Clear Cache & Reload"
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)'
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.4)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)'
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)'
        }}
      >
        ↻
      </button>
    </>
  )
}

