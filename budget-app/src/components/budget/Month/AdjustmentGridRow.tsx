/**
 * AdjustmentGridRow - Grid row for displaying adjustments
 *
 * Renders directly as grid items using display: contents
 */

import type { AdjustmentTransaction } from '@types'
import { formatSignedCurrencyAlways, getBalanceColor } from '../../ui'
import { colors } from '@styles/shared'

interface AdjustmentGridRowProps {
  adjustment: AdjustmentTransaction
  categoryName: string
  accountName: string
  accountGroupName?: string
  onEdit: () => void
  onDelete: () => void
  isMobile?: boolean
  isEvenRow: boolean
}

export function AdjustmentGridRow({ adjustment, categoryName, accountName, accountGroupName, onEdit, onDelete, isMobile, isEvenRow }: AdjustmentGridRowProps) {
  const formattedDate = adjustment.date
    ? new Date(adjustment.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem',
          padding: '0.75rem 1rem',
          background: rowBg,
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
      >
        {/* Top row: Date, Cleared, Amount */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', opacity: 0.5, fontFamily: 'monospace' }}>
              {formattedDate}
            </span>
            {adjustment.cleared && (
              <span style={{ fontSize: '0.7rem', color: colors.success }} title="Cleared">
                ✓
              </span>
            )}
          </div>
          <span style={{ fontWeight: 600, color: getBalanceColor(adjustment.amount), fontFamily: 'monospace' }}>
            {formatSignedCurrencyAlways(adjustment.amount)}
          </span>
        </div>
        {/* Middle row: Description */}
        <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>
          {adjustment.description || 'Adjustment'}
        </div>
        {/* Bottom row: Category and Account */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{
            fontSize: '0.7rem',
            background: 'color-mix(in srgb, currentColor 15%, transparent)',
            padding: '0.1rem 0.4rem',
            borderRadius: '3px',
          }}>
            {categoryName}
          </span>
          <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>
            {accountDisplay}
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

      {/* Category */}
      <div style={{ ...cellStyle, justifyContent: 'center' }}>
        <span style={{
          fontSize: '0.8rem',
          background: 'color-mix(in srgb, currentColor 15%, transparent)',
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
      <div style={{ ...cellStyle, overflow: 'hidden' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem', opacity: 0.7 }}>
          {accountDisplay}
        </span>
      </div>

      {/* Amount */}
      <div style={{ ...cellStyle, justifyContent: 'flex-end', fontWeight: 600, color: getBalanceColor(adjustment.amount), fontFamily: 'monospace' }}>
        {formatSignedCurrencyAlways(adjustment.amount)}
      </div>

      {/* Description */}
      <div style={{ ...cellStyle, paddingLeft: '0.5rem', overflow: 'hidden' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem', opacity: 0.6 }}>
          {adjustment.description || '—'}
        </span>
      </div>

      {/* Cleared */}
      <div style={{
        ...cellStyle,
        justifyContent: 'center',
        color: adjustment.cleared ? colors.success : 'inherit',
        opacity: adjustment.cleared ? 1 : 0.3,
        fontSize: '1rem',
      }}>
        {adjustment.cleared ? '✓' : '○'}
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

