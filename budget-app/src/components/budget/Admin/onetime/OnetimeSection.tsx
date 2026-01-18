/**
 * One-Time Migrations Section
 *
 * Contains migrations that should typically only be run once.
 * Each displays as a compact row with check/apply buttons.
 */

import { MigrationSection } from '../common'
import { EnsureUngroupedGroupsRow } from './EnsureUngroupedGroupsRow'
import { BackupPrompt, useBackupPrompt } from '../common'

// Import hooks
import type {
  EnsureUngroupedGroupsStatus,
  EnsureUngroupedGroupsResult,
} from '@hooks/migrations/useEnsureUngroupedGroups'

interface OnetimeSectionProps {
  disabled: boolean
  onDownloadBackup: () => Promise<void>
  isDownloadingBackup: boolean

  // Ensure Ungrouped Groups Migration
  ensureUngroupedGroups: {
    status: EnsureUngroupedGroupsStatus | null
    hasData: boolean
    needsMigration: boolean
    totalBudgetsToUpdate: number
    isScanning: boolean
    isRunning: boolean
    result: EnsureUngroupedGroupsResult | null
    scanStatus: () => void
    runMigration: () => void
  }
}

export function OnetimeSection({
  disabled,
  onDownloadBackup,
  isDownloadingBackup,
  ensureUngroupedGroups,
}: OnetimeSectionProps) {
  const isAnyRunning = ensureUngroupedGroups.isRunning

  // Backup prompt for migration
  const ensureUngroupedGroupsBackup = useBackupPrompt({
    migrationName: 'Ensure Ungrouped Groups',
    isDestructive: false,
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
        <EnsureUngroupedGroupsRow
          status={ensureUngroupedGroups.status}
          hasData={ensureUngroupedGroups.hasData}
          needsMigration={ensureUngroupedGroups.needsMigration}
          totalBudgetsToUpdate={ensureUngroupedGroups.totalBudgetsToUpdate}
          isChecking={ensureUngroupedGroups.isScanning}
          isRunning={ensureUngroupedGroups.isRunning}
          result={ensureUngroupedGroups.result}
          onCheck={ensureUngroupedGroups.scanStatus}
          onRun={() => ensureUngroupedGroupsBackup.promptBeforeAction(ensureUngroupedGroups.runMigration)}
          disabled={disabled}
        />
      </MigrationSection>

      {/* Backup Prompt */}
      <BackupPrompt {...ensureUngroupedGroupsBackup.promptProps} isDownloading={isDownloadingBackup} />
    </>
  )
}

