/**
 * ExpenseGridRow - Grid row for displaying expenses
 *
 * Renders directly as grid items using display: contents
 */

import type { ExpenseTransaction } from '@types'
import { formatSignedCurrencyAlways, getBalanceColor } from '../../ui'
import { colors } from '../../../styles/shared'

interface ExpenseGridRowProps {
  expense: ExpenseTransaction
  categoryName: string
  accountName: string
  accountGroupName?: string
  onEdit: () => void
  onDelete: () => void
  isMobile?: boolean
  isEvenRow: boolean
}

export function ExpenseGridRow({ expense, categoryName, accountName, accountGroupName, onEdit, onDelete, isMobile, isEvenRow }: ExpenseGridRowProps) {
  const formattedDate = expense.date
    ? new Date(expense.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '—'

  const accountDisplay = accountGroupName ? `${accountGroupName} / ${accountName}` : accountName
  const rowBg = isEvenRow ? 'color-mix(in srgb, currentColor 3%, transparent)' : 'color-mix(in srgb, currentColor 6%, transparent)'

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
          <span style={{ fontWeight: 600, color: getBalanceColor(expense.amount), fontFamily: 'monospace' }}>
            {formatSignedCurrencyAlways(expense.amount)}
          </span>
        </div>
      </div>
    )
  }

  // Desktop: Grid row using display: contents
  const cellStyle: React.CSSProperties = {
    padding: '0.6rem 0.25rem',
    background: rowBg,
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.9rem',
  }

  return (
    <div style={{ display: 'contents' }}>
      {/* Date */}
      <div style={{ ...cellStyle, fontSize: '0.85rem', opacity: 0.6, fontFamily: 'monospace' }}>
        {formattedDate}
      </div>

      {/* Payee */}
      <div style={{ ...cellStyle, fontWeight: 500, overflow: 'hidden' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {expense.payee || '—'}
        </span>
      </div>

      {/* Category */}
      <div style={{ ...cellStyle, justifyContent: 'center' }}>
        <span style={{
          fontSize: '0.8rem',
          background: `color-mix(in srgb, ${colors.primary} 15%, transparent)`,
          color: colors.primaryLight,
          padding: '0.2rem 0.5rem',
          borderRadius: '4px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {categoryName}
        </span>
      </div>

      {/* Account */}
      <div style={{ ...cellStyle, opacity: 0.7, overflow: 'hidden' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
          {accountDisplay}
        </span>
      </div>

      {/* Amount */}
      <div style={{ ...cellStyle, justifyContent: 'flex-end', fontWeight: 600, color: getBalanceColor(expense.amount), fontFamily: 'monospace' }}>
        {formatSignedCurrencyAlways(expense.amount)}
      </div>

      {/* Description */}
      <div style={{ ...cellStyle, paddingLeft: '0.5rem', opacity: 0.6, overflow: 'hidden' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
          {expense.description || '—'}
        </span>
      </div>

      {/* Cleared */}
      <div style={{
        ...cellStyle,
        justifyContent: 'center',
        color: expense.cleared ? colors.success : 'inherit',
        opacity: expense.cleared ? 1 : 0.3,
        fontSize: '1rem',
      }}>
        {expense.cleared ? '✓' : '○'}
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

