import type { IncomeTransaction } from '../../../types/budget'
import { formatCurrency } from '../../ui'
import { colors } from '../../../styles/shared'

interface IncomeItemProps {
  income: IncomeTransaction
  accountName: string
  accountGroupName?: string
  onEdit: () => void
  onDelete: () => void
  isMobile?: boolean
}

export function IncomeItem({ income, accountName, accountGroupName, onEdit, onDelete, isMobile }: IncomeItemProps) {
  return (
    <div
      onClick={isMobile ? onEdit : undefined}
      style={{
        background: 'color-mix(in srgb, currentColor 8%, transparent)',
        padding: isMobile ? '0.875rem 1rem' : '1rem 1.25rem',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'stretch' : 'center',
        gap: isMobile ? '0.5rem' : '1rem',
        cursor: isMobile ? 'pointer' : 'default',
        transition: isMobile ? 'background 0.15s' : 'none',
      }}
    >
      <div style={{ flex: 1 }}>
        {/* Top row: Date + Amount */}
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '0.75rem',
          marginBottom: income.payee ? '0.25rem' : 0,
        }}>
          {income.date && (
            <span style={{
              fontSize: '0.8rem',
              opacity: 0.6,
              fontFamily: 'monospace',
            }}>
              {new Date(income.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
          <span style={{
            fontSize: '1.15rem',
            fontWeight: 600,
            color: colors.success,
          }}>
            +{formatCurrency(income.amount)}
          </span>
        </div>
        {/* Payee */}
        {income.payee && (
          <div style={{
            fontSize: '0.95rem',
            fontWeight: 500,
            marginBottom: '0.25rem',
          }}>
            {income.payee}
          </div>
        )}
        {/* Account destination */}
        <div style={{
          fontSize: '0.85rem',
          opacity: 0.7,
          background: 'color-mix(in srgb, currentColor 10%, transparent)',
          padding: '0.15rem 0.5rem',
          borderRadius: '4px',
          display: 'inline-block',
        }}>
          → {accountName}{accountGroupName ? ` / ${accountGroupName}` : ''}
        </div>
        {income.description && (
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', opacity: 0.7 }}>
            {income.description}
          </p>
        )}
      </div>
      {/* Only show edit/delete buttons on desktop */}
      {!isMobile && (
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          justifyContent: 'center',
        }}>
          <button
            onClick={onEdit}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              opacity: 0.6,
              fontSize: '0.9rem',
              padding: '0.25rem',
            }}
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
              opacity: 0.6,
              fontSize: '0.9rem',
              padding: '0.25rem',
            }}
            title="Delete"
          >
            🗑️
          </button>
        </div>
      )}
    </div>
  )
}

