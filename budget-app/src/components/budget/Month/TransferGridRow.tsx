/**
 * TransferGridRow - Grid row for displaying transfers
 *
 * Renders directly as grid items using display: contents
 */

import type { TransferTransaction } from '@types'
import { formatCurrency } from '../../ui'
import { colors } from '@styles/shared'

interface TransferGridRowProps {
  transfer: TransferTransaction
  fromCategoryName: string
  toCategoryName: string
  fromAccountName: string
  toAccountName: string
  fromAccountGroupName?: string
  toAccountGroupName?: string
  isFromCategoryNo?: boolean
  isToCategoryNo?: boolean
  isFromAccountNo?: boolean
  isToAccountNo?: boolean
  onEdit: () => void
  onDelete: () => void
  isMobile?: boolean
  isEvenRow: boolean
}

export function TransferGridRow({
  transfer,
  fromCategoryName,
  toCategoryName,
  fromAccountName,
  toAccountName,
  fromAccountGroupName,
  toAccountGroupName,
  isFromCategoryNo,
  isToCategoryNo,
  isFromAccountNo,
  isToAccountNo,
  onEdit,
  onDelete,
  isMobile,
  isEvenRow,
}: TransferGridRowProps) {
  const formattedDate = transfer.date
    ? new Date(transfer.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '—'

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
          gap: '0.5rem',
          padding: '0.75rem 1rem',
          background: rowBg,
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', opacity: 0.5, fontFamily: 'monospace', minWidth: '3rem' }}>
              {formattedDate}
            </span>
            <span style={{ fontWeight: 600, opacity: 0.8, fontFamily: 'monospace' }}>
              {formatCurrency(transfer.amount)}
            </span>
            {transfer.cleared && (
              <span style={{ fontSize: '0.7rem', color: colors.success }} title="Cleared">
                ✓
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={isFromCategoryNo ? {
              fontSize: '0.7rem',
              opacity: 0.4,
            } : {
              fontSize: '0.7rem',
              background: 'color-mix(in srgb, currentColor 15%, transparent)',
              padding: '0.1rem 0.4rem',
              borderRadius: '3px',
              display: 'inline-block',
              width: 'fit-content',
            }}>
              {fromCategoryName}
            </span>
            {isFromAccountNo ? (
              <span style={{ fontSize: '0.75rem', opacity: 0.4 }}>
                {fromAccountName}
              </span>
            ) : (
              <div style={{
                fontSize: '0.7rem',
                background: 'color-mix(in srgb, currentColor 15%, transparent)',
                padding: '0.1rem 0.4rem',
                borderRadius: '3px',
                display: 'inline-flex',
                flexDirection: 'column',
                gap: '0.1rem',
                width: 'fit-content',
              }}>
                {fromAccountGroupName && (
                  <span style={{ fontSize: '0.65rem', opacity: 0.6 }}>{fromAccountGroupName}</span>
                )}
                <span>{fromAccountName}</span>
              </div>
            )}
          </div>
          <span style={{ opacity: 0.5 }}>→</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={isToCategoryNo ? {
              fontSize: '0.7rem',
              opacity: 0.4,
            } : {
              fontSize: '0.7rem',
              background: 'color-mix(in srgb, currentColor 15%, transparent)',
              padding: '0.1rem 0.4rem',
              borderRadius: '3px',
              display: 'inline-block',
              width: 'fit-content',
            }}>
              {toCategoryName}
            </span>
            {isToAccountNo ? (
              <span style={{ fontSize: '0.75rem', opacity: 0.4 }}>
                {toAccountName}
              </span>
            ) : (
              <div style={{
                fontSize: '0.7rem',
                background: 'color-mix(in srgb, currentColor 15%, transparent)',
                padding: '0.1rem 0.4rem',
                borderRadius: '3px',
                display: 'inline-flex',
                flexDirection: 'column',
                gap: '0.1rem',
                width: 'fit-content',
              }}>
                {toAccountGroupName && (
                  <span style={{ fontSize: '0.65rem', opacity: 0.6 }}>{toAccountGroupName}</span>
                )}
                <span>{toAccountName}</span>
              </div>
            )}
          </div>
        </div>
        {transfer.description && (
          <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>
            {transfer.description}
          </div>
        )}
      </div>
    )
  }

  // Desktop: Grid row using wrapper div for consistent striping
  const cellStyle: React.CSSProperties = {
    padding: '0.6rem 0.5rem',
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.9rem',
  }

  return (
    <div style={{
      gridColumn: '1 / -1',
      background: rowBg,
      display: 'grid',
      gridTemplateColumns: '5rem 1.5fr 7rem 1fr 6rem 1fr 3rem 4rem', // Match parent grid columns
    }}>
      {/* Date */}
      <div style={{ ...cellStyle, fontSize: '0.85rem', fontFamily: 'monospace' }}>
        <span style={{ opacity: 0.6 }}>{formattedDate}</span>
      </div>

      {/* Amount */}
      <div style={{ ...cellStyle, justifyContent: 'flex-end', fontWeight: 600, opacity: 0.8, fontFamily: 'monospace' }}>
        {formatCurrency(transfer.amount)}
      </div>

      {/* From Category */}
      <div style={{ ...cellStyle, justifyContent: 'center' }}>
        <span style={isFromCategoryNo ? {
          fontSize: '0.8rem',
          opacity: 0.4,
        } : {
          fontSize: '0.8rem',
          background: 'color-mix(in srgb, currentColor 15%, transparent)',
          padding: '0.2rem 0.5rem',
          borderRadius: '4px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {fromCategoryName}
        </span>
      </div>

      {/* From Account */}
      <div style={{ ...cellStyle, overflow: 'hidden' }}>
        {isFromAccountNo ? (
          <span style={{ opacity: 0.4, fontSize: '0.85rem' }}>
            {fromAccountName}
          </span>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.1rem',
            background: 'color-mix(in srgb, currentColor 15%, transparent)',
            padding: '0.2rem 0.5rem',
            borderRadius: '4px',
            overflow: 'hidden',
          }}>
            {fromAccountGroupName && (
              <span style={{ fontSize: '0.7rem', opacity: 0.6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {fromAccountGroupName}
              </span>
            )}
            <span style={{ fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {fromAccountName}
            </span>
          </div>
        )}
      </div>

      {/* Arrow */}
      <div style={{ ...cellStyle, justifyContent: 'center', fontSize: '1rem' }}>
        <span style={{ opacity: 0.5 }}>→</span>
      </div>

      {/* To Category */}
      <div style={{ ...cellStyle, justifyContent: 'center' }}>
        <span style={isToCategoryNo ? {
          fontSize: '0.8rem',
          opacity: 0.4,
        } : {
          fontSize: '0.8rem',
          background: 'color-mix(in srgb, currentColor 15%, transparent)',
          padding: '0.2rem 0.5rem',
          borderRadius: '4px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {toCategoryName}
        </span>
      </div>

      {/* To Account */}
      <div style={{ ...cellStyle, overflow: 'hidden' }}>
        {isToAccountNo ? (
          <span style={{ opacity: 0.4, fontSize: '0.85rem' }}>
            {toAccountName}
          </span>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.1rem',
            background: 'color-mix(in srgb, currentColor 15%, transparent)',
            padding: '0.2rem 0.5rem',
            borderRadius: '4px',
            overflow: 'hidden',
          }}>
            {toAccountGroupName && (
              <span style={{ fontSize: '0.7rem', opacity: 0.6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {toAccountGroupName}
              </span>
            )}
            <span style={{ fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {toAccountName}
            </span>
          </div>
        )}
      </div>

      {/* Description */}
      <div style={{ ...cellStyle, paddingLeft: '0.5rem', overflow: 'hidden' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem', opacity: 0.6 }}>
          {transfer.description || '—'}
        </span>
      </div>

      {/* Cleared */}
      <div style={{
        ...cellStyle,
        justifyContent: 'center',
        color: transfer.cleared ? colors.success : 'inherit',
        opacity: transfer.cleared ? 1 : 0.3,
        fontSize: '1rem',
      }}>
        {transfer.cleared ? '✓' : '○'}
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

