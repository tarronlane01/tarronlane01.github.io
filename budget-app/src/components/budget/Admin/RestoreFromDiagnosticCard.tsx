/**
 * Restore from Diagnostic Card
 *
 * UI component for the restore from diagnostic migration.
 */

import { useRef } from 'react'
import { Button } from '../../ui'
import { Spinner } from './index'
import type { RestoreStatus, RestoreResult } from '../../../hooks/migrations/useRestoreFromDiagnostic'

interface RestoreFromDiagnosticCardProps {
  status: RestoreStatus | null
  result: RestoreResult | null
  isScanning: boolean
  isRunning: boolean
  onScan: (json: string) => Promise<void>
  onRun: () => Promise<void>
  disabled: boolean
}

export function RestoreFromDiagnosticCard({
  status,
  result,
  isScanning,
  isRunning,
  onScan,
  onRun,
  disabled,
}: RestoreFromDiagnosticCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const text = await file.text()
    await onScan(text)
    // Reset the input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div style={{
      background: 'color-mix(in srgb, currentColor 5%, transparent)',
      borderRadius: '8px',
      padding: '1rem',
      marginBottom: '1rem',
      border: `1px solid color-mix(in srgb, ${status?.monthsToRestore ? '#ffc107' : '#6c757d'} 30%, transparent)`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', color: status?.monthsToRestore ? '#ffc107' : '#6c757d' }}>
            🔄 Restore from Diagnostic
          </h3>
          <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.7 }}>
            Restore lost transfers and adjustments from a diagnostic JSON file.
            Use this to recover data that was accidentally deleted.
          </p>
          {status && (
            <div style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>
              <p style={{ margin: 0 }}>
                <strong>Diagnostic from:</strong> {new Date(status.diagnosticTimestamp).toLocaleString()}
              </p>
              <p style={{ margin: '0.25rem 0 0 0' }}>
                <strong>Months to restore:</strong> {status.monthsToRestore}
                {status.monthsToRestore > 0 && (
                  <span style={{ opacity: 0.7 }}>
                    {' '}({status.transfersToRestore} transfers, {status.adjustmentsToRestore} adjustments)
                  </span>
                )}
              </p>
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
            </div>
          )}
          {result && (
            <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: result.success ? '#28a745' : '#dc3545' }}>
              {result.success ? (
                <p style={{ margin: 0 }}>
                  ✅ Restored {result.monthsUpdated} month(s): {result.transfersRestored} transfers, {result.adjustmentsRestored} adjustments
                </p>
              ) : (
                <p style={{ margin: 0 }}>❌ Restore failed: {result.errors.join(', ')}</p>
              )}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flexShrink: 0 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <Button
            variant="secondary"
            actionName="Select Diagnostic File"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isScanning || isRunning}
          >
            {isScanning ? (
              <><Spinner noMargin /> Scanning...</>
            ) : (
              '📁 Select File'
            )}
          </Button>
          {status && status.monthsToRestore > 0 && (
            <Button
              variant="primary"
              actionName="Run Restore from Diagnostic"
              onClick={onRun}
              disabled={disabled || isRunning}
            >
              {isRunning ? (
                <><Spinner noMargin /> Restoring...</>
              ) : (
                '🔄 Restore Data'
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}


