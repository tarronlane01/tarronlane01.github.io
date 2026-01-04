/**
 * DebtBorder Component
 *
 * Wraps content in an orange border with a "Debt" or custom label in the border.
 * Used for displaying negative category balances and debt reduction allocations.
 *
 * Note: This component adds minimal padding to preserve content alignment with
 * non-bordered rows. The border is purely decorative.
 */

import type { CSSProperties, ReactNode } from 'react'
import { colors } from '@styles/shared'

interface DebtBorderProps {
  children: ReactNode
  /** Label to show in the border (defaults to "Debt") */
  label?: string
  /** Additional styles for the container */
  style?: CSSProperties
}

export function DebtBorder({ children, label, style }: DebtBorderProps) {
  return (
    <div
      style={{
        position: 'relative',
        // Use box-shadow instead of border to avoid affecting layout/alignment
        boxShadow: `inset 0 0 0 2px ${colors.debtBorder}`,
        borderRadius: '8px',
        // No background shading - just border to indicate debt
        ...style,
      }}
    >
      {/* Label in the border - only shown if provided */}
      {label && (
        <span
          style={{
            position: 'absolute',
            top: '-0.6em',
            left: '0.75rem',
            background: 'var(--background, #1a1a1a)',
            padding: '0 0.4rem',
            fontSize: '0.7rem',
            fontWeight: 600,
            color: colors.debt,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          {label}
        </span>
      )}
      {children}
    </div>
  )
}

