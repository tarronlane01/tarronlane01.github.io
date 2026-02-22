/**
 * Update Sample Budget Row
 * 
 * Component for programmatically updating the shared sample budget.
 * One-click to regenerate sample budget with current dates.
 * Only available to admin users.
 */

import { useState } from 'react'
import type { UpdateSampleBudgetProgress, UpdateSampleBudgetResult } from '@hooks/migrations/useUpdateSampleBudget'
import { Spinner } from '../MigrationComponents'
import { logUserAction } from '@utils/actionLogger'

interface UpdateSampleBudgetRowProps {
  isUpdating: boolean
  progress: UpdateSampleBudgetProgress | null
  error: string | null
  result: UpdateSampleBudgetResult | null
  onUpdate: () => Promise<void>
  onReset: () => void
  disabled: boolean
}

export function UpdateSampleBudgetRow({
  isUpdating,
  progress,
  error,
  result,
  onUpdate,
  onReset,
  disabled,
}: UpdateSampleBudgetRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const isDisabled = disabled || isUpdating
  const hasResult = result !== null
  const hasError = error !== null

  const statusColor = result?.success
    ? 'var(--color-success)'
    : hasError
      ? 'var(--color-error)'
      : isUpdating
        ? 'var(--color-primary)'
        : 'var(--text-muted)'

  const statusIcon = result?.success
    ? '✅'
    : isUpdating
      ? '⏳'
      : hasError
        ? '❌'
        : '🔄'

  const statusText = result?.success
    ? `Updated (${result.monthsCreated} months)`
    : isUpdating
      ? progress?.message || 'Updating...'
      : hasError
        ? 'Error'
        : 'Ready'

  const currentProgress = progress?.percentComplete

  return (
    <div style={{
      background: 'color-mix(in srgb, var(--color-primary) 5%, transparent)',
      borderRadius: '8px',
      margin: '0.25rem 0',
      overflow: 'hidden',
      border: '1px solid color-mix(in srgb, var(--color-primary) 20%, transparent)',
    }}>
      {/* Main Row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0.75rem 1rem',
        gap: '1rem',
      }}>
        {/* Status Indicator */}
        <div style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          background: `color-mix(in srgb, ${statusColor} 20%, transparent)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.85rem',
          flexShrink: 0,
        }}>
          {isUpdating ? <Spinner noMargin /> : statusIcon}
        </div>

        {/* Name and Description */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 500,
            fontSize: '0.95rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            🎯 Update Sample Budget
          </div>
          <div style={{
            fontSize: '0.8rem',
            opacity: 0.6,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            Regenerate sample budget with current dates (6 months of data ending this month)
          </div>
        </div>

        {/* Status Badge */}
        <div style={{
          color: statusColor,
          fontSize: '0.8rem',
          fontWeight: 500,
          flexShrink: 0,
          maxWidth: '200px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {statusText}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
          {!result?.success && (
            <button
              onClick={async () => {
                logUserAction('CLICK', 'Update Sample Budget')
                await onUpdate()
              }}
              disabled={isDisabled}
              style={{
                background: 'var(--color-primary)',
                color: 'white',
                border: 'none',
                padding: '0.35rem 0.75rem',
                borderRadius: '4px',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                fontSize: '0.8rem',
                fontWeight: 500,
                opacity: isDisabled ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              {isUpdating ? <Spinner noMargin /> : 'Update'}
            </button>
          )}

          {result?.success && (
            <button
              onClick={() => {
                logUserAction('CLICK', 'Reset Update Sample Budget')
                onReset()
              }}
              style={{
                background: 'color-mix(in srgb, currentColor 10%, transparent)',
                color: 'inherit',
                border: '1px solid color-mix(in srgb, currentColor 20%, transparent)',
                padding: '0.35rem 0.6rem',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.8rem',
              }}
              title="Reset to update again"
            >
              Reset
            </button>
          )}

          {(hasResult || hasError) && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              style={{
                background: 'transparent',
                color: 'inherit',
                border: 'none',
                padding: '0.35rem',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                opacity: 0.6,
              }}
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {isUpdating && currentProgress !== undefined && (
        <div style={{
          padding: '0 1rem 0.5rem 1rem',
        }}>
          <div style={{
            width: '100%',
            height: '4px',
            background: 'color-mix(in srgb, currentColor 10%, transparent)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${currentProgress}%`,
              height: '100%',
              background: 'var(--color-primary)',
              transition: 'width 0.3s ease',
            }} />
          </div>
          <div style={{
            fontSize: '0.75rem',
            opacity: 0.6,
            marginTop: '0.25rem',
            textAlign: 'center',
          }}>
            {progress?.phase}: {currentProgress}%
          </div>
        </div>
      )}

      {/* Expandable Details */}
      {isExpanded && (hasResult || hasError) && (
        <div style={{
          borderTop: '1px solid color-mix(in srgb, currentColor 10%, transparent)',
          padding: '1rem',
          background: 'color-mix(in srgb, currentColor 2%, transparent)',
          fontSize: '0.85rem',
        }}>
          {hasError && (
            <div style={{ marginBottom: '0.75rem', color: 'var(--color-error)' }}>
              ❌ Error: {error}
            </div>
          )}

          {result && (
            <div style={{ color: result.success ? 'var(--color-success)' : 'var(--color-error)' }}>
              {result.success ? (
                <>
                  ✅ Created {result.monthsCreated} month(s): {result.dateRange}
                </>
              ) : (
                <>❌ Update failed: {result.errors.join(', ')}</>
              )}
            </div>
          )}

          <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', opacity: 0.7 }}>
            <strong>What this does:</strong> Generates sample budget data with transactions
            for the past 5 months plus the current month. All dates are shifted to be
            relative to today's date.
          </div>
        </div>
      )}
    </div>
  )
}
