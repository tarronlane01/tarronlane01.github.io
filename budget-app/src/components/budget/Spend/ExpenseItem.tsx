import { useState, useEffect } from 'react'
import type { ExpenseTransaction } from '../../../types/budget'
import { formatCurrency } from '../../ui'
import { colors } from '../../../styles/shared'
import { BREAKPOINTS } from '@constants'

interface ExpenseItemProps {
  expense: ExpenseTransaction
  categoryName: string
  accountName: string
  accountGroupName?: string
  onEdit: () => void
  onDelete: () => void
  isMobile?: boolean
}

// Hook to detect wide screen
function useIsWide() {
  const [isWide, setIsWide] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.innerWidth >= BREAKPOINTS.wide
  })

  useEffect(() => {
    function handleResize() {
      setIsWide(window.innerWidth >= BREAKPOINTS.wide)
    }
    window.addEventListener('resize', handleResize)
    handleResize()
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return isWide
}

// Table row view for expense items
export function ExpenseItem({ expense, categoryName, accountName, accountGroupName, onEdit, onDelete, isMobile }: ExpenseItemProps) {
  const isWide = useIsWide()

  const formattedDate = expense.date
    ? new Date(expense.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '—'

  const accountDisplay = accountGroupName ? `${accountGroupName} / ${accountName}` : accountName

  // Mobile: Card-like view (tappable)
  if (isMobile) {
    return (
      <div
        onClick={onEdit}
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: '0.5rem',
          padding: '0.75rem 1rem',
          borderBottom: '1px solid color-mix(in srgb, currentColor 10%, transparent)',
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', opacity: 0.5, fontFamily: 'monospace', minWidth: '3rem' }}>
              {formattedDate}
            </span>
            <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>
              {expense.payee || '—'}
            </span>
            {expense.cleared && (
              <span style={{ fontSize: '0.7rem', color: colors.success }} title="Cleared">
                ✓
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '0.7rem',
              background: `color-mix(in srgb, ${colors.primary} 20%, transparent)`,
              color: colors.primaryLight,
              padding: '0.1rem 0.4rem',
              borderRadius: '3px',
            }}>
              {categoryName}
            </span>
            <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>
              ← {accountDisplay}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, color: colors.error, fontFamily: 'monospace' }}>
            -{formatCurrency(expense.amount)}
          </span>
        </div>
      </div>
    )
  }

  // Wide desktop: Full table row with all columns
  if (isWide) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '5rem 1fr 8rem 8rem 6rem 1fr 3rem 4rem',
          gap: '0.75rem',
          padding: '0.625rem 1rem',
          alignItems: 'center',
          borderBottom: '1px solid color-mix(in srgb, currentColor 8%, transparent)',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'color-mix(in srgb, currentColor 5%, transparent)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        {/* Date */}
        <span style={{ fontSize: '0.85rem', opacity: 0.6, fontFamily: 'monospace' }}>
          {formattedDate}
        </span>

        {/* Payee */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span style={{ fontWeight: 500, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {expense.payee || '—'}
          </span>
        </div>

        {/* Category */}
        <span style={{
          fontSize: '0.8rem',
          background: `color-mix(in srgb, ${colors.primary} 15%, transparent)`,
          color: colors.primaryLight,
          padding: '0.2rem 0.5rem',
          borderRadius: '4px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textAlign: 'center',
        }}>
          {categoryName}
        </span>

        {/* Account */}
        <span style={{
          fontSize: '0.85rem',
          opacity: 0.7,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {accountDisplay}
        </span>

        {/* Amount */}
        <span style={{
          fontWeight: 600,
          color: colors.error,
          fontFamily: 'monospace',
          textAlign: 'right',
        }}>
          -{formatCurrency(expense.amount)}
        </span>

        {/* Description */}
        <span style={{
          fontSize: '0.8rem',
          opacity: 0.6,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {expense.description || '—'}
        </span>

        {/* Cleared */}
        <span style={{
          textAlign: 'center',
          color: expense.cleared ? colors.success : 'inherit',
          opacity: expense.cleared ? 1 : 0.3,
          fontSize: '1rem',
        }}>
          {expense.cleared ? '✓' : '○'}
        </span>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
          <button
            onClick={onEdit}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              opacity: 0.5,
              fontSize: '0.85rem',
              padding: '0.25rem',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.5'}
            title="Edit"
          >
            ✏️
          </button>
          <button
            onClick={onDelete}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              opacity: 0.5,
              fontSize: '0.85rem',
              padding: '0.25rem',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.5'}
            title="Delete"
          >
            🗑️
          </button>
        </div>
      </div>
    )
  }

  // Medium desktop: Compact row (no description column)
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '5rem 1fr 7rem 7rem 6rem 3rem 4rem',
        gap: '0.5rem',
        padding: '0.625rem 1rem',
        alignItems: 'center',
        borderBottom: '1px solid color-mix(in srgb, currentColor 8%, transparent)',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'color-mix(in srgb, currentColor 5%, transparent)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      {/* Date */}
      <span style={{ fontSize: '0.85rem', opacity: 0.6, fontFamily: 'monospace' }}>
        {formattedDate}
      </span>

      {/* Payee + Description */}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span style={{ fontWeight: 500, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {expense.payee || '—'}
        </span>
        {expense.description && (
          <span style={{ fontSize: '0.75rem', opacity: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {expense.description}
          </span>
        )}
      </div>

      {/* Category */}
      <span style={{
        fontSize: '0.75rem',
        background: `color-mix(in srgb, ${colors.primary} 15%, transparent)`,
        color: colors.primaryLight,
        padding: '0.15rem 0.4rem',
        borderRadius: '4px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        textAlign: 'center',
      }}>
        {categoryName}
      </span>

      {/* Account */}
      <span style={{
        fontSize: '0.8rem',
        opacity: 0.7,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {accountName}
      </span>

      {/* Amount */}
      <span style={{
        fontWeight: 600,
        color: colors.error,
        fontFamily: 'monospace',
        textAlign: 'right',
        fontSize: '0.9rem',
      }}>
        -{formatCurrency(expense.amount)}
      </span>

      {/* Cleared */}
      <span style={{
        textAlign: 'center',
        color: expense.cleared ? colors.success : 'inherit',
        opacity: expense.cleared ? 1 : 0.3,
        fontSize: '0.9rem',
      }}>
        {expense.cleared ? '✓' : '○'}
      </span>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
        <button
          onClick={onEdit}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            opacity: 0.5,
            fontSize: '0.85rem',
            padding: '0.25rem',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.5'}
          title="Edit"
        >
          ✏️
        </button>
        <button
          onClick={onDelete}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            opacity: 0.5,
            fontSize: '0.85rem',
            padding: '0.25rem',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.5'}
          title="Delete"
        >
          🗑️
        </button>
      </div>
    </div>
  )
}

// Table header component for expense list
export function ExpenseTableHeader() {
  const isWide = useIsWide()

  if (isWide) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '5rem 1fr 8rem 8rem 6rem 1fr 3rem 4rem',
          gap: '0.75rem',
          padding: '0.5rem 1rem',
          borderBottom: '1px solid color-mix(in srgb, currentColor 15%, transparent)',
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          opacity: 0.5,
          fontWeight: 600,
        }}
      >
        <span>Date</span>
        <span>Payee</span>
        <span style={{ textAlign: 'center' }}>Category</span>
        <span>Account</span>
        <span style={{ textAlign: 'right' }}>Amount</span>
        <span>Description</span>
        <span style={{ textAlign: 'center' }}>Clr</span>
        <span></span>
      </div>
    )
  }

  // Medium desktop header
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '5rem 1fr 7rem 7rem 6rem 3rem 4rem',
        gap: '0.5rem',
        padding: '0.5rem 1rem',
        borderBottom: '1px solid color-mix(in srgb, currentColor 15%, transparent)',
        fontSize: '0.75rem',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        opacity: 0.5,
        fontWeight: 600,
      }}
    >
      <span>Date</span>
      <span>Payee</span>
      <span style={{ textAlign: 'center' }}>Category</span>
      <span>Account</span>
      <span style={{ textAlign: 'right' }}>Amount</span>
      <span style={{ textAlign: 'center' }}>Clr</span>
      <span></span>
    </div>
  )
}
