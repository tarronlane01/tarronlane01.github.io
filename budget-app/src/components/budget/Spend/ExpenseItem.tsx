import { useState, useEffect } from 'react'
import type { ExpenseTransaction } from '@types'
import { formatCurrency, getSpendColor } from '../../ui'
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
          <span style={{ fontWeight: 600, color: getSpendColor(expense.amount), fontFamily: 'monospace' }}>
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
          display: 'flex',
          alignItems: 'center',
          padding: '0.6rem 0',
          borderBottom: '1px solid color-mix(in srgb, currentColor 8%, transparent)',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'color-mix(in srgb, currentColor 5%, transparent)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        {/* Date */}
        <div style={{ width: '5rem', fontSize: '0.85rem', opacity: 0.6, fontFamily: 'monospace' }}>
          {formattedDate}
        </div>

        {/* Payee */}
        <div style={{
          flex: 1.5,
          minWidth: 0,
          fontWeight: 500,
          fontSize: '0.9rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {expense.payee || '—'}
        </div>

        {/* Category */}
        <div style={{
          width: '7rem',
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
        </div>

        {/* Account */}
        <div style={{
          flex: 1,
          minWidth: 0,
          fontSize: '0.85rem',
          opacity: 0.7,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {accountDisplay}
        </div>

        {/* Amount */}
        <div style={{
          width: '6rem',
          fontWeight: 600,
          color: getSpendColor(expense.amount),
          fontFamily: 'monospace',
          textAlign: 'right',
        }}>
          -{formatCurrency(expense.amount)}
        </div>

        {/* Description */}
        <div style={{
          flex: 1,
          minWidth: 0,
          paddingLeft: '1rem',
          fontSize: '0.8rem',
          opacity: 0.6,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {expense.description || '—'}
        </div>

        {/* Cleared */}
        <div style={{
          width: '3rem',
          textAlign: 'center',
          color: expense.cleared ? colors.success : 'inherit',
          opacity: expense.cleared ? 1 : 0.3,
          fontSize: '1rem',
        }}>
          {expense.cleared ? '✓' : '○'}
        </div>

        {/* Actions */}
        <div style={{ width: '4rem', display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
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
        display: 'flex',
        alignItems: 'center',
        padding: '0.6rem 0',
        borderBottom: '1px solid color-mix(in srgb, currentColor 8%, transparent)',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'color-mix(in srgb, currentColor 5%, transparent)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      {/* Date */}
      <div style={{ width: '5rem', fontSize: '0.85rem', opacity: 0.6, fontFamily: 'monospace' }}>
        {formattedDate}
      </div>

      {/* Payee + Description */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
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
      <div style={{
        width: '7rem',
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
      </div>

      {/* Account */}
      <div style={{
        width: '7rem',
        fontSize: '0.8rem',
        opacity: 0.7,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {accountName}
      </div>

      {/* Amount */}
      <div style={{
        width: '6rem',
        fontWeight: 600,
        color: getSpendColor(expense.amount),
        fontFamily: 'monospace',
        textAlign: 'right',
        fontSize: '0.9rem',
      }}>
        -{formatCurrency(expense.amount)}
      </div>

      {/* Cleared */}
      <div style={{
        width: '3rem',
        textAlign: 'center',
        color: expense.cleared ? colors.success : 'inherit',
        opacity: expense.cleared ? 1 : 0.3,
        fontSize: '0.9rem',
      }}>
        {expense.cleared ? '✓' : '○'}
      </div>

      {/* Actions */}
      <div style={{ width: '4rem', display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
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

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    fontSize: '0.75rem',
    fontWeight: 600,
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  }

  if (isWide) {
    return (
      <div style={headerStyle}>
        <div style={{ width: '5rem' }}>Date</div>
        <div style={{ flex: 1.5, minWidth: 0 }}>Payee</div>
        <div style={{ width: '7rem', textAlign: 'center' }}>Category</div>
        <div style={{ flex: 1, minWidth: 0 }}>Account</div>
        <div style={{ width: '6rem', textAlign: 'right' }}>Amount</div>
        <div style={{ flex: 1, minWidth: 0, paddingLeft: '1rem' }}>Description</div>
        <div style={{ width: '3rem', textAlign: 'center' }}>Clr</div>
        <div style={{ width: '4rem' }}></div>
      </div>
    )
  }

  // Medium desktop header
  return (
    <div style={headerStyle}>
      <div style={{ width: '5rem' }}>Date</div>
      <div style={{ flex: 1, minWidth: 0 }}>Payee</div>
      <div style={{ width: '7rem', textAlign: 'center' }}>Category</div>
      <div style={{ width: '7rem' }}>Account</div>
      <div style={{ width: '6rem', textAlign: 'right' }}>Amount</div>
      <div style={{ width: '3rem', textAlign: 'center' }}>Clr</div>
      <div style={{ width: '4rem' }}></div>
    </div>
  )
}
