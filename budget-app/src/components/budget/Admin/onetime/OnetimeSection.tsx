/**
 * One-Time Migrations Section
 *
 * Contains migrations that should typically only be run once.
 * Each displays as a compact row with check/apply buttons.
 */

import { MigrationSection } from '../common'
import { RemoveTotalFieldsRow } from './RemoveTotalFieldsRow'
import { RemovePreviousMonthIncomeRow } from './RemovePreviousMonthIncomeRow'
import { PercentageIncomeMonthsBackRow } from './PercentageIncomeMonthsBackRow'
import { RemoveLegacyBalanceFieldsRow } from './RemoveLegacyBalanceFieldsRow'

import type { RemoveTotalFieldsMigrationStatus, RemoveTotalFieldsMigrationResult } from '@hooks/migrations/useRemoveTotalFieldsMigration'
import type { RemovePreviousMonthIncomeMigrationStatus, RemovePreviousMonthIncomeMigrationResult } from '@hooks/migrations/useRemovePreviousMonthIncomeMigration'
import type { PercentageIncomeMonthsBackMigrationStatus, PercentageIncomeMonthsBackMigrationResult } from '@hooks/migrations/usePercentageIncomeMonthsBackMigration'
import type { RemoveLegacyBalanceFieldsMigrationStatus, RemoveLegacyBalanceFieldsMigrationResult } from '@hooks/migrations/useRemoveLegacyBalanceFieldsMigration'

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
  percentageIncomeMonthsBackMigration: {
    status: PercentageIncomeMonthsBackMigrationStatus | null
    hasData: boolean
    needsMigration: boolean
    totalItemsToFix: number
    isScanning: boolean
    isRunning: boolean
    result: PercentageIncomeMonthsBackMigrationResult | null
    scanStatus: () => void
    runMigration: () => void
  }
  removeLegacyBalanceFieldsMigration: {
    status: RemoveLegacyBalanceFieldsMigrationStatus | null
    hasData: boolean
    needsMigration: boolean
    totalItemsToFix: number
    isScanning: boolean
    isRunning: boolean
    result: RemoveLegacyBalanceFieldsMigrationResult | null
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
  percentageIncomeMonthsBackMigration,
  removeLegacyBalanceFieldsMigration,
}: OnetimeSectionProps) {
  // Props onDownloadBackup and isDownloadingBackup are kept for API compatibility but not used
  void _onDownloadBackup
  void _isDownloadingBackup
  const isAnyRunning = removeTotalFieldsMigration.isRunning || removePreviousMonthIncomeMigration.isRunning || percentageIncomeMonthsBackMigration.isRunning || removeLegacyBalanceFieldsMigration.isRunning

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

        {/* Percentage Income Months Back Migration */}
        <PercentageIncomeMonthsBackRow
          status={percentageIncomeMonthsBackMigration.status}
          hasData={!!percentageIncomeMonthsBackMigration.status}
          needsMigration={percentageIncomeMonthsBackMigration.needsMigration}
          totalItemsToFix={percentageIncomeMonthsBackMigration.totalItemsToFix}
          isChecking={percentageIncomeMonthsBackMigration.isScanning}
          isRunning={percentageIncomeMonthsBackMigration.isRunning}
          result={percentageIncomeMonthsBackMigration.result}
          onCheck={percentageIncomeMonthsBackMigration.scanStatus}
          onRun={percentageIncomeMonthsBackMigration.runMigration}
          disabled={disabled}
        />

        {/* Remove Legacy Balance Fields Migration */}
        <RemoveLegacyBalanceFieldsRow
          status={removeLegacyBalanceFieldsMigration.status}
          hasData={removeLegacyBalanceFieldsMigration.hasData}
          needsMigration={removeLegacyBalanceFieldsMigration.needsMigration}
          totalItemsToFix={removeLegacyBalanceFieldsMigration.totalItemsToFix}
          isChecking={removeLegacyBalanceFieldsMigration.isScanning}
          isRunning={removeLegacyBalanceFieldsMigration.isRunning}
          result={removeLegacyBalanceFieldsMigration.result}
          onCheck={removeLegacyBalanceFieldsMigration.scanStatus}
          onRun={removeLegacyBalanceFieldsMigration.runMigration}
          disabled={disabled}
        />
      </MigrationSection>
    </>
  )
}
