/**
 * Utility Section
 *
 * Contains utility actions that aren't migrations but are useful for administration:
 * - Budget backup & restore (download/upload zip)
 * - Delete months
 * - Delete sample user budget
 * - Cache invalidation
 */

import { MigrationSection, BackupPrompt, useBackupPrompt } from '../common'
import { BudgetDownloadUploadRow } from './BudgetDownloadUploadRow'
import { UpdateSampleBudgetRow } from './UpdateSampleBudgetRow'
import { BudgetInspectorRow } from './BudgetInspectorRow'
import { DeleteMonthsRow } from './DeleteMonthsRow'
import { DeleteSampleUserRow } from './DeleteSampleUserRow'
import { CacheInvalidateRow } from './CacheInvalidateRow'

import type { DownloadBudgetProgress } from '@hooks/migrations/useDownloadBudget'
import type { UploadBudgetProgress, UploadBudgetStatus, UploadBudgetResult } from '@hooks/migrations/useUploadBudget'
import type { UpdateSampleBudgetProgress, UpdateSampleBudgetResult } from '@hooks/migrations/useUpdateSampleBudget'
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
import type { BudgetInspectorResult } from '@hooks/migrations/useBudgetInspector'

interface UtilitySectionProps {
  disabled: boolean
  onDownloadBackup: () => Promise<void>
  isDownloadingBackup: boolean

  // Budget Download/Upload
  budgetDownloadUpload: {
    isDownloading: boolean
    downloadProgress: DownloadBudgetProgress | null
    downloadError: string | null
    downloadBudget: () => Promise<void>
    isScanning: boolean
    isUploading: boolean
    uploadStatus: UploadBudgetStatus | null
    uploadProgress: UploadBudgetProgress | null
    uploadError: string | null
    uploadResult: UploadBudgetResult | null
    scanZipFile: (file: File) => Promise<void>
    uploadBudget: (file: File) => Promise<void>
  }

  // Update Sample Budget
  updateSampleBudget: {
    isUpdating: boolean
    progress: UpdateSampleBudgetProgress | null
    error: string | null
    result: UpdateSampleBudgetResult | null
    updateSampleBudget: () => Promise<void>
    reset: () => void
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

  // Budget Inspector
  budgetInspector: {
    isInspecting: boolean
    result: BudgetInspectorResult | null
    error: string | null
    inspectBudget: (budgetId: string) => Promise<BudgetInspectorResult | null>
    downloadResult: () => void
    clearResult: () => void
  }

  // Cache invalidation handler
  onClearCache: () => void
}

export function UtilitySection({
  disabled,
  onDownloadBackup,
  isDownloadingBackup,
  budgetDownloadUpload,
  updateSampleBudget,
  budgetInspector,
  deleteAllMonths,
  deleteSampleUserBudget,
  onClearCache,
}: UtilitySectionProps) {
  const isAnyRunning =
    budgetDownloadUpload.isDownloading ||
    budgetDownloadUpload.isUploading ||
    updateSampleBudget.isUpdating ||
    deleteAllMonths.isDeleting ||
    deleteSampleUserBudget.isDeleting

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

  const uploadBackup = useBackupPrompt({
    migrationName: 'Upload Budget',
    isDestructive: true,
    onDownloadBackup,
  })

  const updateSampleBudgetBackup = useBackupPrompt({
    migrationName: 'Update Sample Budget',
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
        {/* Budget Backup & Restore */}
        <BudgetDownloadUploadRow
          isDownloading={budgetDownloadUpload.isDownloading}
          downloadProgress={budgetDownloadUpload.downloadProgress}
          downloadError={budgetDownloadUpload.downloadError}
          onDownload={budgetDownloadUpload.downloadBudget}
          isScanning={budgetDownloadUpload.isScanning}
          isUploading={budgetDownloadUpload.isUploading}
          uploadStatus={budgetDownloadUpload.uploadStatus}
          uploadProgress={budgetDownloadUpload.uploadProgress}
          uploadError={budgetDownloadUpload.uploadError}
          uploadResult={budgetDownloadUpload.uploadResult}
          onScan={budgetDownloadUpload.scanZipFile}
          onUpload={async (file) => {
            uploadBackup.promptBeforeAction(() => {
              budgetDownloadUpload.uploadBudget(file).catch(err => console.error('Upload failed:', err))
            })
          }}
          disabled={disabled}
        />

        {/* Update Sample Budget */}
        <UpdateSampleBudgetRow
          isUpdating={updateSampleBudget.isUpdating}
          progress={updateSampleBudget.progress}
          error={updateSampleBudget.error}
          result={updateSampleBudget.result}
          onUpdate={async () => {
            updateSampleBudgetBackup.promptBeforeAction(() => {
              updateSampleBudget.updateSampleBudget().catch(err => console.error('Update sample budget failed:', err))
            })
          }}
          onReset={updateSampleBudget.reset}
          disabled={disabled}
        />

        {/* Budget Inspector */}
        <BudgetInspectorRow
          isInspecting={budgetInspector.isInspecting}
          result={budgetInspector.result}
          error={budgetInspector.error}
          onInspect={budgetInspector.inspectBudget}
          onDownload={budgetInspector.downloadResult}
          onClear={budgetInspector.clearResult}
          disabled={disabled}
        />

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
      <BackupPrompt {...uploadBackup.promptProps} isDownloading={isDownloadingBackup} />
      <BackupPrompt {...updateSampleBudgetBackup.promptProps} isDownloading={isDownloadingBackup} />
    </>
  )
}

