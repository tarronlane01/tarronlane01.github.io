/**
 * Utility Section
 *
 * Contains utility actions that aren't migrations but are useful for administration:
 * - Download diagnostics
 * - Delete months
 * - Delete sample user budget
 * - Cache invalidation
 * - Restore from diagnostic
 * - Seed import
 */

import { MigrationSection, BackupPrompt, useBackupPrompt } from '../common'
import { DiagnosticDownloadRow } from './DiagnosticDownloadRow'
import { DeleteMonthsRow } from './DeleteMonthsRow'
import { DeleteSampleUserRow } from './DeleteSampleUserRow'
import { CacheInvalidateRow } from './CacheInvalidateRow'
import { RestoreFromDiagnosticRow } from './RestoreFromDiagnosticRow'
import { SeedImportRow } from './SeedImportRow'

import type { DownloadProgress } from '@hooks/migrations/useDiagnosticDownload'
import type {
  DeleteAllMonthsStatus,
  DeleteAllMonthsResult,
  DeleteProgress,
} from '@hooks/migrations/useDeleteAllMonths'
import type {
  DeleteSampleUserBudgetStatus,
  DeleteSampleUserBudgetResult,
  DeleteSampleProgress,
} from '@hooks/migrations/useDeleteSampleUserBudget'
import type { RestoreStatus, RestoreResult } from '@hooks/migrations/useRestoreFromDiagnostic'

interface UtilitySectionProps {
  disabled: boolean
  onDownloadBackup: () => Promise<void>
  isDownloadingBackup: boolean

  // Diagnostic Download
  diagnosticDownload: {
    isDownloading: boolean
    progress: DownloadProgress | null
    error: string | null
    downloadDiagnostics: () => Promise<void>
  }

  // Delete All Months
  deleteAllMonths: {
    status: DeleteAllMonthsStatus | null
    hasData: boolean
    monthsCount: number
    budgetCount: number
    isScanning: boolean
    isDeleting: boolean
    deleteResult: DeleteAllMonthsResult | null
    deleteProgress: DeleteProgress | null
    scanStatus: () => void
    deleteAllMonths: () => void
  }

  // Delete Sample User Budget
  deleteSampleUserBudget: {
    status: DeleteSampleUserBudgetStatus | null
    hasData: boolean
    totalBudgets: number
    totalMonths: number
    isScanning: boolean
    isDeleting: boolean
    deleteResult: DeleteSampleUserBudgetResult | null
    deleteProgress: DeleteSampleProgress | null
    scanStatus: () => void
    deleteSampleUserBudget: () => void
  }

  // Restore from Diagnostic
  restoreFromDiagnostic: {
    status: RestoreStatus | null
    result: RestoreResult | null
    isScanning: boolean
    isRunning: boolean
    scan: (json: string) => Promise<void>
    run: () => Promise<void>
  }

  // Cache invalidation handler
  onClearCache: () => void
}

export function UtilitySection({
  disabled,
  onDownloadBackup,
  isDownloadingBackup,
  diagnosticDownload,
  deleteAllMonths,
  deleteSampleUserBudget,
  restoreFromDiagnostic,
  onClearCache,
}: UtilitySectionProps) {
  const isAnyRunning =
    diagnosticDownload.isDownloading ||
    deleteAllMonths.isDeleting ||
    deleteSampleUserBudget.isDeleting ||
    restoreFromDiagnostic.isRunning

  // Backup prompts for destructive actions
  const deleteMonthsBackup = useBackupPrompt({
    migrationName: 'Delete All Months',
    isDestructive: true,
    onDownloadBackup,
  })

  const deleteSampleBackup = useBackupPrompt({
    migrationName: 'Delete Sample User Budget',
    isDestructive: true,
    onDownloadBackup,
  })

  const restoreBackup = useBackupPrompt({
    migrationName: 'Restore from Diagnostic',
    isDestructive: true,
    onDownloadBackup,
  })

  return (
    <>
      <MigrationSection
        title="Utilities"
        icon="🛠️"
        description="Administrative utilities for data management, downloads, and cache control."
        type="utility"
        isAnyRunning={isAnyRunning}
      >
        {/* Download Section */}
        <DiagnosticDownloadRow
          isDownloading={diagnosticDownload.isDownloading}
          progress={diagnosticDownload.progress}
          error={diagnosticDownload.error}
          onDownload={diagnosticDownload.downloadDiagnostics}
          disabled={disabled}
        />

        {/* Restore from Diagnostic */}
        <RestoreFromDiagnosticRow
          status={restoreFromDiagnostic.status}
          result={restoreFromDiagnostic.result}
          isScanning={restoreFromDiagnostic.isScanning}
          isRunning={restoreFromDiagnostic.isRunning}
          onScan={restoreFromDiagnostic.scan}
          onRun={() => restoreBackup.promptBeforeAction(restoreFromDiagnostic.run)}
          disabled={disabled}
        />

        {/* Seed Import */}
        <SeedImportRow disabled={disabled} />

        {/* Destructive Operations */}
        <div style={{
          marginTop: '0.75rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid color-mix(in srgb, currentColor 10%, transparent)',
        }}>
          <div style={{
            fontSize: '0.75rem',
            opacity: 0.5,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '0.5rem',
            paddingLeft: '0.5rem',
          }}>
            Destructive Actions
          </div>

          <DeleteMonthsRow
            status={deleteAllMonths.status}
            hasData={deleteAllMonths.hasData}
            monthsCount={deleteAllMonths.monthsCount}
            budgetCount={deleteAllMonths.budgetCount}
            isChecking={deleteAllMonths.isScanning}
            isDeleting={deleteAllMonths.isDeleting}
            deleteResult={deleteAllMonths.deleteResult}
            deleteProgress={deleteAllMonths.deleteProgress}
            onCheck={deleteAllMonths.scanStatus}
            onDelete={() => deleteMonthsBackup.promptBeforeAction(deleteAllMonths.deleteAllMonths)}
            disabled={disabled}
          />

          <DeleteSampleUserRow
            status={deleteSampleUserBudget.status}
            hasData={deleteSampleUserBudget.hasData}
            totalBudgets={deleteSampleUserBudget.totalBudgets}
            totalMonths={deleteSampleUserBudget.totalMonths}
            isChecking={deleteSampleUserBudget.isScanning}
            isDeleting={deleteSampleUserBudget.isDeleting}
            deleteResult={deleteSampleUserBudget.deleteResult}
            deleteProgress={deleteSampleUserBudget.deleteProgress}
            onCheck={deleteSampleUserBudget.scanStatus}
            onDelete={() => deleteSampleBackup.promptBeforeAction(deleteSampleUserBudget.deleteSampleUserBudget)}
            disabled={disabled}
          />

          <CacheInvalidateRow
            onClearCache={onClearCache}
            disabled={disabled}
          />
        </div>
      </MigrationSection>

      {/* Backup Prompts */}
      <BackupPrompt {...deleteMonthsBackup.promptProps} isDownloading={isDownloadingBackup} />
      <BackupPrompt {...deleteSampleBackup.promptProps} isDownloading={isDownloadingBackup} />
      <BackupPrompt {...restoreBackup.promptProps} isDownloading={isDownloadingBackup} />
    </>
  )
}

