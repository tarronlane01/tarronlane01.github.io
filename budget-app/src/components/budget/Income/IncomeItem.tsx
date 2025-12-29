import { useState, useEffect } from 'react'
import type { IncomeTransaction } from '@types'
import { formatCurrency } from '../../ui'
import { colors } from '../../../styles/shared'
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
  if (isWide) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '5rem 1fr 8rem 6rem 1fr 4rem',
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
            {income.payee || '—'}
          </span>
        </div>

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
          color: colors.success,
          fontFamily: 'monospace',
          textAlign: 'right',
        }}>
          +{formatCurrency(income.amount)}
        </span>

        {/* Description */}
        <span style={{
          fontSize: '0.8rem',
          opacity: 0.6,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {income.description || '—'}
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

  // Medium desktop: Compact row
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '5rem 1fr 7rem 6rem 4rem',
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
          {income.payee || '—'}
        </span>
        {income.description && (
          <span style={{ fontSize: '0.75rem', opacity: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {income.description}
          </span>
        )}
      </div>

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
        color: colors.success,
        fontFamily: 'monospace',
        textAlign: 'right',
        fontSize: '0.9rem',
      }}>
        +{formatCurrency(income.amount)}
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

// Table header component for income list
export function IncomeTableHeader() {
  const isWide = useIsWide()

  if (isWide) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '5rem 1fr 8rem 6rem 1fr 4rem',
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
        <span>Account</span>
        <span style={{ textAlign: 'right' }}>Amount</span>
        <span>Description</span>
        <span></span>
      </div>
    )
  }

  // Medium desktop header
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '5rem 1fr 7rem 6rem 4rem',
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
      <span>Account</span>
      <span style={{ textAlign: 'right' }}>Amount</span>
      <span></span>
    </div>
  )
}
