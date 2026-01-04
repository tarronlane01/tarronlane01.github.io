import { useState, useEffect } from 'react'
import type { IncomeTransaction } from '@types'
import { formatCurrency } from '../../ui'
import { colors } from '@styles/shared'
import { BREAKPOINTS } from '@constants'

interface IncomeItemProps {
  income: IncomeTransaction
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

// Table row view for income items
export function IncomeItem({ income, accountName, accountGroupName, onEdit, onDelete, isMobile }: IncomeItemProps) {
  const isWide = useIsWide()

  const formattedDate = income.date
    ? new Date(income.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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
              {income.payee || '—'}
            </span>
          </div>
          <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>
            → {accountDisplay}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, color: colors.success, fontFamily: 'monospace' }}>
            +{formatCurrency(income.amount)}
          </span>
        </div>
      </div>
    )
  }

  // Wide desktop: Full table row with all columns
  // Use fixed column widths so rows align (each row is a separate grid)
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
          {income.payee || '—'}
        </div>

        {/* Account */}
        <div style={{
          flex: 2,
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
          width: '7rem',
          fontWeight: 600,
          color: colors.success,
          fontFamily: 'monospace',
          textAlign: 'right',
        }}>
          +{formatCurrency(income.amount)}
        </div>

        {/* Description */}
        <div style={{
          flex: 1.5,
          minWidth: 0,
          paddingLeft: '1rem',
          fontSize: '0.8rem',
          opacity: 0.6,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {income.description || '—'}
        </div>

        {/* Actions */}
        <div style={{ width: '3rem', display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
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

  // Medium desktop: Compact row
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
          {income.payee || '—'}
        </span>
        {income.description && (
          <span style={{ fontSize: '0.75rem', opacity: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {income.description}
          </span>
        )}
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
        color: colors.success,
        fontFamily: 'monospace',
        textAlign: 'right',
        fontSize: '0.9rem',
      }}>
        +{formatCurrency(income.amount)}
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

// Table header component for income list
export function IncomeTableHeader() {
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
        <div style={{ flex: 2, minWidth: 0 }}>Account</div>
        <div style={{ width: '7rem', textAlign: 'right' }}>Amount</div>
        <div style={{ flex: 1.5, minWidth: 0, paddingLeft: '1rem' }}>Description</div>
        <div style={{ width: '3rem' }}></div>
      </div>
    )
  }

  // Medium desktop header
  return (
    <div style={headerStyle}>
      <div style={{ width: '5rem' }}>Date</div>
      <div style={{ flex: 1, minWidth: 0 }}>Payee</div>
      <div style={{ width: '7rem' }}>Account</div>
      <div style={{ width: '6rem', textAlign: 'right' }}>Amount</div>
      <div style={{ width: '4rem' }}></div>
    </div>
  )
}
