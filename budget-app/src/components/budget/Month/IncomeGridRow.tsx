/**
 * IncomeGridRow - Grid row for displaying income
 *
 * Renders directly as grid items using display: contents
 */

import type { IncomeTransaction } from '@types'
import { formatCurrency } from '../../ui'
import { colors } from '@styles/shared'

interface IncomeGridRowProps {
  income: IncomeTransaction
  accountName: string
  accountGroupName?: string
  onEdit: () => void
  onDelete: () => void
  isMobile?: boolean
  isEvenRow: boolean
}

export function IncomeGridRow({ income, accountName, accountGroupName, onEdit, onDelete, isMobile, isEvenRow }: IncomeGridRowProps) {
  const formattedDate = income.date
    ? new Date(income.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '—'

  const accountDisplay = accountGroupName ? `${accountGroupName} / ${accountName}` : accountName
  const rowBg = isEvenRow ? 'transparent' : 'rgba(255,255,255,0.04)'

  // Mobile: Card-like view (tappable)
  if (isMobile) {
    return (
      <div
        onClick={onEdit}
        style={{
          gridColumn: '1 / -1',
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: '0.5rem',
          padding: '0.75rem 1rem',
          background: rowBg,
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

  // Desktop: Grid row using display: contents
  const cellStyle: React.CSSProperties = {
    padding: '0.6rem 0.5rem',
    background: rowBg,
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.9rem',
  }

  return (
    <div style={{ display: 'contents' }}>
      {/* Date */}
      <div style={{ ...cellStyle, fontSize: '0.85rem', fontFamily: 'monospace' }}>
        <span style={{ opacity: 0.6 }}>{formattedDate}</span>
      </div>

      {/* Payee */}
      <div style={{ ...cellStyle, fontWeight: 500, overflow: 'hidden' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {income.payee || '—'}
        </span>
      </div>

      {/* Account */}
      <div style={{ ...cellStyle, overflow: 'hidden' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem', opacity: 0.7 }}>
          {accountDisplay}
        </span>
      </div>

      {/* Amount */}
      <div style={{ ...cellStyle, justifyContent: 'flex-end', fontWeight: 600, color: colors.success, fontFamily: 'monospace' }}>
        +{formatCurrency(income.amount)}
      </div>

      {/* Description */}
      <div style={{ ...cellStyle, paddingLeft: '0.5rem', overflow: 'hidden' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem', opacity: 0.6 }}>
          {income.description || '—'}
        </span>
      </div>

      {/* Actions */}
      <div style={{ ...cellStyle, justifyContent: 'flex-end', gap: '0.25rem' }}>
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

