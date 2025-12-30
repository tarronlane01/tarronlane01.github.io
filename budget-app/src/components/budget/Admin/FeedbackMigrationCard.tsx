import type { FeedbackMigrationResult, FeedbackMigrationStatus } from '../../../hooks/migrations/useFeedbackMigration'
import { MigrationCard, StatusBox, ActionButton, type MigrationCardStatus } from './MigrationComponents'

interface FeedbackMigrationCardProps {
  hasData: boolean
  status: FeedbackMigrationStatus | null
  isMigrating: boolean
  onMigrate: () => void
  onRefresh: () => void
  isRefreshing: boolean
  disabled: boolean
  migrationResult: FeedbackMigrationResult | null
}

export function FeedbackMigrationCard({
  hasData,
  status,
  isMigrating,
  onMigrate,
  onRefresh,
  isRefreshing,
  disabled,
  migrationResult,
}: FeedbackMigrationCardProps) {
  // Determine if there are issues based on the status (from scan)
  const hasIssues = status && (
    status.sanitizedDocuments.length > 0 ||
    status.corruptedDocuments.length > 0
  )

  // Determine if migration was just run and fixed things
  const wasFixed = migrationResult && (
    migrationResult.deletedDocuments > 0 ||
    migrationResult.fixedDocuments > 0
  )

  const getStatus = (): MigrationCardStatus => {
    if (!hasData) return 'unknown'
    if (wasFixed) return 'complete'
    if (!hasIssues) return 'clean'
    return 'needs-action'
  }

  return (
    <MigrationCard
      title="📝 Consolidate Feedback Documents"
      description="Fixes corrupted feedback data and merges documents with sanitized IDs into proper email format."
      status={getStatus()}
      onRefresh={onRefresh}
      isRefreshing={isRefreshing}
      isBusy={isMigrating}
    >
      {isMigrating ? (
        <StatusBox type="running">
          Migrating feedback documents...
        </StatusBox>
      ) : !hasData ? (
        <StatusBox type="unknown">
          ❓ Status unknown — click Refresh to scan for issues
        </StatusBox>
      ) : wasFixed ? (
        <StatusBox type="success">
          <div>
            ✅ Migration complete:
            <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.25rem', fontSize: '0.9rem' }}>
              {migrationResult.fixedDocuments > 0 && (
                <li>Fixed {migrationResult.fixedDocuments} corrupted document(s)</li>
              )}
              {migrationResult.deletedDocuments > 0 && (
                <li>Merged & deleted {migrationResult.deletedDocuments} sanitized document(s)</li>
              )}
              {migrationResult.mergedItems > 0 && (
                <li>Merged {migrationResult.mergedItems} feedback item(s)</li>
              )}
            </ul>
            {migrationResult.errors.length > 0 && (
              <>
                <div style={{ marginTop: '0.5rem' }}>⚠️ Errors:</div>
                <ul style={{ margin: '0.25rem 0 0 0', paddingLeft: '1.25rem', fontSize: '0.9rem' }}>
                  {migrationResult.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </StatusBox>
      ) : !hasIssues ? (
        <StatusBox type="clean">
          ✅ No issues found. All feedback documents are healthy.
          <span style={{ display: 'block', fontSize: '0.85rem', opacity: 0.7, marginTop: '0.25rem' }}>
            Found {status?.documentsFound ?? 0} document(s) total.
          </span>
        </StatusBox>
      ) : (
        <>
          <StatusBox type="warning">
            <div>
              {status?.corruptedDocuments && status.corruptedDocuments.length > 0 && (
                <>
                  <div style={{ marginBottom: '0.5rem' }}>
                    🔧 Found {status.corruptedDocuments.length} corrupted document(s):
                  </div>
                  <ul style={{ margin: '0 0 0.75rem 0', paddingLeft: '1.25rem', fontSize: '0.9rem' }}>
                    {status.corruptedDocuments.map((docId) => (
                      <li key={docId}>{docId} <span style={{ opacity: 0.6 }}>(broken arrayUnion)</span></li>
                    ))}
                  </ul>
                </>
              )}
              {status?.sanitizedDocuments && status.sanitizedDocuments.length > 0 && (
                <>
                  <div style={{ marginBottom: '0.5rem' }}>
                    📧 Found {status.sanitizedDocuments.length} sanitized document(s) to merge:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.9rem' }}>
                    {status.sanitizedDocuments.map((docId) => (
                      <li key={docId}>{docId}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </StatusBox>
          <ActionButton
            onClick={onMigrate}
            disabled={disabled}
            isBusy={isMigrating}
            busyText="Migrating..."
            actionName="Run Feedback Migration"
          >
            Run Migration
          </ActionButton>
        </>
      )}
    </MigrationCard>
  )
}
