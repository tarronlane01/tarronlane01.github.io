/**
 * One-Time Migrations Section
 *
 * Contains migrations that should typically only be run once.
 * Each displays as a compact row with check/apply buttons.
 */

import { MigrationSection } from '../common'
import { RemoveTotalFieldsRow } from './RemoveTotalFieldsRow'
import { RemovePreviousMonthIncomeRow } from './RemovePreviousMonthIncomeRow'

import type { RemoveTotalFieldsMigrationStatus, RemoveTotalFieldsMigrationResult } from '@hooks/migrations/useRemoveTotalFieldsMigration'
import type { RemovePreviousMonthIncomeMigrationStatus, RemovePreviousMonthIncomeMigrationResult } from '@hooks/migrations/useRemovePreviousMonthIncomeMigration'

interface OnetimeSectionProps {
  disabled: boolean
  onDownloadBackup: () => Promise<void>
  isDownloadingBackup: boolean
  removeTotalFieldsMigration: {
    status: RemoveTotalFieldsMigrationStatus | null
    hasData: boolean
    needsMigration: boolean
    totalItemsToFix: number
    isScanning: boolean
    isRunning: boolean
    result: RemoveTotalFieldsMigrationResult | null
    scanStatus: () => void
    runMigration: () => void
  }
  removePreviousMonthIncomeMigration: {
    status: RemovePreviousMonthIncomeMigrationStatus | null
    hasData: boolean
    needsMigration: boolean
    totalItemsToFix: number
    isScanning: boolean
    isRunning: boolean
    result: RemovePreviousMonthIncomeMigrationResult | null
    scanStatus: () => void
    runMigration: () => void
  }
}

export function OnetimeSection({
  disabled,
  onDownloadBackup: _onDownloadBackup,
  isDownloadingBackup: _isDownloadingBackup,
  removeTotalFieldsMigration,
  removePreviousMonthIncomeMigration,
}: OnetimeSectionProps) {
  // Props onDownloadBackup and isDownloadingBackup are kept for API compatibility but not used
  void _onDownloadBackup
  void _isDownloadingBackup
  const isAnyRunning = removeTotalFieldsMigration.isRunning || removePreviousMonthIncomeMigration.isRunning

  return (
    <>
      <MigrationSection
        title="One-Time Migrations"
        icon="🎯"
        description="Migrations that typically only need to be run once. Check status first, then apply if needed."
        type="onetime"
        isAnyRunning={isAnyRunning}
      >
        {/* Remove Total Fields Migration */}
        <RemoveTotalFieldsRow
          status={removeTotalFieldsMigration.status}
          hasData={removeTotalFieldsMigration.hasData}
          needsMigration={removeTotalFieldsMigration.needsMigration}
          totalItemsToFix={removeTotalFieldsMigration.totalItemsToFix}
          isChecking={removeTotalFieldsMigration.isScanning}
          isRunning={removeTotalFieldsMigration.isRunning}
          result={removeTotalFieldsMigration.result}
          onCheck={removeTotalFieldsMigration.scanStatus}
          onRun={removeTotalFieldsMigration.runMigration}
          disabled={disabled}
        />

        {/* Remove Previous Month Income Migration */}
        <RemovePreviousMonthIncomeRow
          status={removePreviousMonthIncomeMigration.status}
          hasData={removePreviousMonthIncomeMigration.hasData}
          needsMigration={removePreviousMonthIncomeMigration.needsMigration}
          totalItemsToFix={removePreviousMonthIncomeMigration.totalItemsToFix}
          isChecking={removePreviousMonthIncomeMigration.isScanning}
          isRunning={removePreviousMonthIncomeMigration.isRunning}
          result={removePreviousMonthIncomeMigration.result}
          onCheck={removePreviousMonthIncomeMigration.scanStatus}
          onRun={removePreviousMonthIncomeMigration.runMigration}
          disabled={disabled}
        />
      </MigrationSection>
    </>
  )
}
