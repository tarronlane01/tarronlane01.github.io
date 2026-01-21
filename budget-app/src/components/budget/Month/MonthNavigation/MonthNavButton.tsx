/**
 * Month Navigation Button
 *
 * Reusable arrow button for navigating between months.
 * Shows a tooltip when disabled explaining why navigation is blocked.
 */

import { useState } from 'react'
import { colors } from '@styles/shared'
import { logUserAction } from '@utils'

export type NavDirection = 'prev' | 'next'

interface MonthNavButtonProps {
  direction: NavDirection
  isDisabled: boolean
  isLoading: boolean
  disabledReason?: string // Optional - only shown when disabled
  onNavigate: () => void
}

export function MonthNavButton({
  direction,
  isDisabled,
  isLoading,
  disabledReason,
  onNavigate,
}: MonthNavButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  const isBlocked = isLoading || isDisabled
  const arrow = direction === 'prev' ? '←' : '→'
  const actionName = direction === 'prev' ? 'Previous Month' : 'Next Month'
  const defaultTitle = direction === 'prev' ? 'Previous month' : 'Next month'

  const handleClick = () => {
    if (isLoading) return
    if (isDisabled) {
      setShowTooltip(true)
      setTimeout(() => setShowTooltip(false), 2000)
    } else {
      logUserAction('NAVIGATE', actionName)
      onNavigate()
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={handleClick}
        onMouseEnter={() => isDisabled && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        style={{
          background: 'color-mix(in srgb, currentColor 10%, transparent)',
          border: 'none',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          cursor: isBlocked ? 'not-allowed' : 'pointer',
          fontSize: '1.25rem',
          opacity: isBlocked ? 0.5 : 1,
          transition: 'opacity 0.15s, background 0.15s',
        }}
        title={!isDisabled ? defaultTitle : undefined}
      >
        {arrow}
      </button>
      {showTooltip && isDisabled && disabledReason && (
        <div style={{
          position: 'absolute',
          top: '100%',
          // Align left for prev button, right for next button to prevent off-screen
          ...(direction === 'prev' ? { left: 0 } : { right: 0 }),
          marginTop: '0.5rem',
          padding: '0.5rem 0.75rem',
          background: colors.warning,
          color: '#000',
          borderRadius: '6px',
          fontSize: '0.75rem',
          fontWeight: 500,
          width: 'max-content',
          maxWidth: 'min(300px, 50vw)',
          textAlign: 'center',
          zIndex: 20,
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}>
          {disabledReason}
        </div>
      )}
    </div>
  )
}

