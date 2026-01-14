/**
 * Feedback Consolidation Row
 *
 * Compact row for feedback document migration and cleanup.
 */

import type { FeedbackMigrationStatus, FeedbackMigrationResult } from '@hooks/migrations/useFeedbackMigration'
import { MigrationRow, type MigrationRowStatus } from '../common'

interface FeedbackConsolidationRowProps {
  status: FeedbackMigrationStatus | null
  hasData: boolean
  hasIssues: boolean
  totalIssues: number
  isChecking: boolean
  isRunning: boolean
  result: FeedbackMigrationResult | null
  onCheck: () => void
  onRun: () => void
  disabled: boolean
}

export function FeedbackConsolidationRow({
  status,
  hasData,
  hasIssues,
  totalIssues,
  isChecking,
  isRunning,
  result,
  onCheck,
  onRun,
  disabled,
}: FeedbackConsolidationRowProps) {
  const getStatus = (): MigrationRowStatus => {
    if (isRunning) return 'running'
    if (!hasData) return 'unknown'
    if (result && result.errors.length === 0) return 'complete'
    if (result && result.errors.length > 0) return 'error'
    if (!hasIssues) return 'clean'
    return 'needs-action'
  }

  const getStatusText = (): string | undefined => {
    if (result && result.errors.length === 0) {
      const totalFixed = result.fixedDocuments + result.deletedDocuments
      return totalFixed > 0 ? `Fixed ${totalFixed}` : 'Complete'
    }
    return undefined
  }

  const renderDetails = () => {
    if (result) {
      return (
        <div style={{ fontSize: '0.85rem' }}>
          <div style={{ marginBottom: '0.5rem', fontWeight: 500 }}>
            {result.errors.length > 0 ? '⚠️ Completed with errors' : '✅ Migration complete'}
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
            {result.fixedDocuments > 0 && <li>{result.fixedDocuments} corrupted document(s) fixed</li>}
            {result.deletedDocuments > 0 && <li>{result.deletedDocuments} sanitized document(s) merged & deleted</li>}
            {result.mergedItems > 0 && <li>{result.mergedItems} feedback item(s) merged</li>}
            {result.fixedDocuments === 0 && result.deletedDocuments === 0 && <li>No changes needed</li>}
          </ul>
          {result.errors.length > 0 && (
            <div style={{ marginTop: '0.5rem', color: '#ef4444' }}>
              <div>Errors ({result.errors.length}):</div>
              <ul style={{ margin: '0.25rem 0 0 0', paddingLeft: '1.25rem' }}>
                {result.errors.slice(0, 3).map((err, i) => <li key={i}>{err}</li>)}
                {result.errors.length > 3 && <li>...and {result.errors.length - 3} more</li>}
              </ul>
            </div>
          )}
        </div>
      )
    }

    if (!hasData) {
      return <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>Click check to scan feedback documents.</div>
    }

    if (!hasIssues) {
      return (
        <div style={{ fontSize: '0.85rem' }}>
          ✅ All {status!.documentsFound} feedback document(s) are healthy.
        </div>
      )
    }

    return (
      <div style={{ fontSize: '0.85rem' }}>
        <div style={{ marginBottom: '0.5rem', color: '#fbbf24' }}>Issues found:</div>
        <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
          {status!.corruptedDocuments.length > 0 && (
            <li>
              {status!.corruptedDocuments.length} corrupted document(s):
              <ul style={{ margin: '0.25rem 0 0 0', paddingLeft: '1rem', opacity: 0.8 }}>
                {status!.corruptedDocuments.slice(0, 3).map((docId) => (
                  <li key={docId}>{docId} (broken arrayUnion)</li>
                ))}
                {status!.corruptedDocuments.length > 3 && (
                  <li>...and {status!.corruptedDocuments.length - 3} more</li>
                )}
              </ul>
            </li>
          )}
          {status!.sanitizedDocuments.length > 0 && (
            <li>
              {status!.sanitizedDocuments.length} sanitized document(s) to merge:
              <ul style={{ margin: '0.25rem 0 0 0', paddingLeft: '1rem', opacity: 0.8 }}>
                {status!.sanitizedDocuments.slice(0, 3).map((docId) => (
                  <li key={docId}>{docId}</li>
                ))}
                {status!.sanitizedDocuments.length > 3 && (
                  <li>...and {status!.sanitizedDocuments.length - 3} more</li>
                )}
              </ul>
            </li>
          )}
        </ul>
        <div style={{ marginTop: '0.5rem', opacity: 0.6 }}>
          Found {status!.documentsFound} total document(s).
        </div>
      </div>
    )
  }

  return (
    <MigrationRow
      name="Feedback Consolidation"
      description="Fixes corrupted feedback data and merges sanitized document IDs"
      status={getStatus()}
      statusText={getStatusText()}
      onCheck={onCheck}
      isChecking={isChecking}
      onRun={onRun}
      isRunning={isRunning}
      actionText={`Fix ${totalIssues}`}
      disabled={disabled}
      itemCount={hasIssues ? totalIssues : undefined}
      details={renderDetails()}
      isDestructive
    />
  )
}

