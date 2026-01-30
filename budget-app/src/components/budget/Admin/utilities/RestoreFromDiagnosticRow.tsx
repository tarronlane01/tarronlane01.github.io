/**
 * Restore from Diagnostic Row
 *
 * Row component for restoring data from a diagnostic JSON file.
 */

import { useRef, useState } from 'react'
import type { RestoreStatus, RestoreResult } from '@hooks/migrations/useRestoreFromDiagnostic'
import { Spinner } from '../MigrationComponents'
import { logUserAction } from '@utils/actionLogger'

interface RestoreFromDiagnosticRowProps {
  status: RestoreStatus | null
  result: RestoreResult | null
  isScanning: boolean
  isRunning: boolean
  onScan: (json: string) => Promise<void>
  onRun: () => void
  disabled: boolean
}

export function RestoreFromDiagnosticRow({
  status,
  result,
  isScanning,
  isRunning,
  onScan,
  onRun,
  disabled,
}: RestoreFromDiagnosticRowProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isExpanded, setIsExpanded] = useState(false)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    logUserAction('CLICK', 'Select Diagnostic File for Restore')
    const text = await file.text()
    await onScan(text)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const hasData = status !== null
  const needsAction = status?.monthsToRestore && status.monthsToRestore > 0
  const isDisabled = disabled || isScanning || isRunning

  // Determine status color
  const statusColor = result?.success
    ? 'var(--color-success)'
    : needsAction
      ? 'var(--color-warning)'
      : hasData
        ? 'var(--color-success)'
        : 'var(--text-muted)'

  const statusIcon = result?.success
    ? '✅'
    : isRunning || isScanning
      ? '⏳'
      : needsAction
        ? '⚠️'
        : hasData
          ? '✓'
          : '❓'

  const statusText = result?.success
    ? 'Restored'
    : isRunning
      ? 'Restoring'
      : isScanning
        ? 'Scanning'
        : needsAction
          ? `${status.monthsToRestore} to restore`
          : hasData
            ? 'Nothing to restore'
            : 'Select file'

  return (
    <div style={{
      background: 'color-mix(in srgb, currentColor 3%, transparent)',
      borderRadius: '8px',
      margin: '0.25rem 0',
      overflow: 'hidden',
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
          {isRunning || isScanning ? <Spinner noMargin /> : statusIcon}
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
            🔄 Restore from Diagnostic
          </div>
          <div style={{
            fontSize: '0.8rem',
            opacity: 0.6,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            Restore lost transfers/adjustments from a diagnostic JSON
          </div>
        </div>

        {/* Status Badge */}
        <div style={{
          color: statusColor,
          fontSize: '0.8rem',
          fontWeight: 500,
          flexShrink: 0,
        }}>
          {statusText}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isDisabled}
            style={{
              background: 'color-mix(in srgb, currentColor 10%, transparent)',
              color: 'inherit',
              border: '1px solid color-mix(in srgb, currentColor 20%, transparent)',
              padding: '0.35rem 0.6rem',
              borderRadius: '4px',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              fontSize: '0.8rem',
              opacity: isDisabled ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
            title="Select diagnostic file"
          >
            {isScanning ? <Spinner noMargin /> : '📁'}
          </button>

          {needsAction && (
            <button
              onClick={() => { logUserAction('CLICK', 'Run Restore from Diagnostic'); onRun() }}
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
              {isRunning ? <Spinner noMargin /> : 'Restore'}
            </button>
          )}

          {(hasData || result) && (
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

      {/* Expandable Details */}
      {isExpanded && (hasData || result) && (
        <div style={{
          borderTop: '1px solid color-mix(in srgb, currentColor 10%, transparent)',
          padding: '1rem',
          background: 'color-mix(in srgb, currentColor 2%, transparent)',
          fontSize: '0.85rem',
        }}>
          {result && (
            <div style={{ marginBottom: status ? '0.75rem' : 0, color: result.success ? 'var(--color-success)' : 'var(--color-error)' }}>
              {result.success ? (
                <>
                  ✅ Restored {result.monthsUpdated} month(s): {result.transfersRestored} transfers, {result.adjustmentsRestored} adjustments
                </>
              ) : (
                <>❌ Restore failed: {result.errors.join(', ')}</>
              )}
            </div>
          )}

          {status && (
            <>
              <div style={{ marginBottom: '0.25rem' }}>
                <strong>Diagnostic from:</strong> {new Date(status.diagnosticTimestamp).toLocaleString()}
              </div>
              <div>
                <strong>Months to restore:</strong> {status.monthsToRestore}
                {status.monthsToRestore > 0 && (
                  <span style={{ opacity: 0.7 }}>
                    {' '}({status.transfersToRestore} transfers, {status.adjustmentsToRestore} adjustments)
                  </span>
                )}
              </div>
              {status.monthDetails.length > 0 && (
                <details style={{ marginTop: '0.5rem' }}>
                  <summary style={{ cursor: 'pointer', opacity: 0.8 }}>Show affected months</summary>
                  <ul style={{ margin: '0.5rem 0 0 1rem', padding: 0, listStyle: 'disc' }}>
                    {status.monthDetails.map((m, i) => (
                      <li key={i} style={{ marginBottom: '0.25rem' }}>
                        {m.year}-{String(m.month).padStart(2, '0')}: {m.currentTransfers}→{m.diagnosticTransfers} transfers, {m.currentAdjustments}→{m.diagnosticAdjustments} adjustments
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

