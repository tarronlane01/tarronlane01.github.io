/**
 * One-Time Migrations Section
 *
 * Contains migrations that should typically only be run once.
 * Each displays as a compact row with check/apply buttons.
 */

import { MigrationSection } from '../common'
import { DatabaseCleanupRow } from './DatabaseCleanupRow'
import { HiddenFieldRow } from './HiddenFieldRow'
import { FeedbackConsolidationRow } from './FeedbackConsolidationRow'
import { BackupPrompt, useBackupPrompt } from '../common'

// Import hooks
import type {
  DatabaseCleanupStatus,
  DatabaseCleanupResult,
} from '@hooks/migrations/useDatabaseCleanup'
import type {
  HiddenFieldMigrationStatus,
  HiddenFieldMigrationResult,
} from '@hooks/migrations/useHiddenFieldMigration'
import type {
  FeedbackMigrationStatus,
  FeedbackMigrationResult,
} from '@hooks/migrations/useFeedbackMigration'

interface OnetimeSectionProps {
  disabled: boolean
  onDownloadBackup: () => Promise<void>
  isDownloadingBackup: boolean

  // Database Cleanup
  databaseCleanup: {
    status: DatabaseCleanupStatus | null
    hasData: boolean
    hasIssues: boolean
    totalIssues: number
    isScanning: boolean
    isRunning: boolean
    result: DatabaseCleanupResult | null
    scanStatus: () => void
    runCleanup: () => void
  }

  // Hidden Field Migration
  hiddenField: {
    status: HiddenFieldMigrationStatus | null
    hasData: boolean
    needsMigration: boolean
    totalItemsToFix: number
    isScanning: boolean
    isRunning: boolean
    result: HiddenFieldMigrationResult | null
    scanStatus: () => void
    runMigration: () => void
  }

  // Feedback Migration
  feedback: {
    status: FeedbackMigrationStatus | null
    hasData: boolean
    hasIssues: boolean
    totalIssues: number
    isScanning: boolean
    isMigrating: boolean
    result: FeedbackMigrationResult | null
    scanStatus: () => void
    migrateFeedbackDocuments: () => void
  }
}

export function OnetimeSection({
  disabled,
  onDownloadBackup,
  isDownloadingBackup,
  databaseCleanup,
  hiddenField,
  feedback,
}: OnetimeSectionProps) {
  const isAnyRunning =
    databaseCleanup.isRunning ||
    hiddenField.isRunning ||
    feedback.isMigrating

  // Backup prompts for each migration
  const dbCleanupBackup = useBackupPrompt({
    migrationName: 'Database Cleanup',
    isDestructive: true,
    onDownloadBackup,
  })

  const hiddenFieldBackup = useBackupPrompt({
    migrationName: 'Hidden Field Migration',
    isDestructive: true,
    onDownloadBackup,
  })

  const feedbackBackup = useBackupPrompt({
    migrationName: 'Feedback Consolidation',
    isDestructive: true,
    onDownloadBackup,
  })

  return (
    <>
      <MigrationSection
        title="One-Time Migrations"
        icon="🎯"
        description="Migrations that typically only need to be run once. Check status first, then apply if needed."
        type="onetime"
        isAnyRunning={isAnyRunning}
      >
        <DatabaseCleanupRow
          status={databaseCleanup.status}
          hasData={databaseCleanup.hasData}
          hasIssues={databaseCleanup.hasIssues}
          totalIssues={databaseCleanup.totalIssues}
          isChecking={databaseCleanup.isScanning}
          isRunning={databaseCleanup.isRunning}
          result={databaseCleanup.result}
          onCheck={databaseCleanup.scanStatus}
          onRun={() => dbCleanupBackup.promptBeforeAction(databaseCleanup.runCleanup)}
          disabled={disabled}
        />

        <HiddenFieldRow
          status={hiddenField.status}
          hasData={hiddenField.hasData}
          needsMigration={hiddenField.needsMigration}
          totalItemsToFix={hiddenField.totalItemsToFix}
          isChecking={hiddenField.isScanning}
          isRunning={hiddenField.isRunning}
          result={hiddenField.result}
          onCheck={hiddenField.scanStatus}
          onRun={() => hiddenFieldBackup.promptBeforeAction(hiddenField.runMigration)}
          disabled={disabled}
        />

        <FeedbackConsolidationRow
          status={feedback.status}
          hasData={feedback.hasData}
          hasIssues={feedback.hasIssues}
          totalIssues={feedback.totalIssues}
          isChecking={feedback.isScanning}
          isRunning={feedback.isMigrating}
          result={feedback.result}
          onCheck={feedback.scanStatus}
          onRun={() => feedbackBackup.promptBeforeAction(feedback.migrateFeedbackDocuments)}
          disabled={disabled}
        />
      </MigrationSection>

      {/* Backup Prompts */}
      <BackupPrompt {...dbCleanupBackup.promptProps} isDownloading={isDownloadingBackup} />
      <BackupPrompt {...hiddenFieldBackup.promptProps} isDownloading={isDownloadingBackup} />
      <BackupPrompt {...feedbackBackup.promptProps} isDownloading={isDownloadingBackup} />
    </>
  )
}

