/**
 * Budget Download/Upload Row
 *
 * Combined component for downloading and uploading budget data in zip format.
 */

import { useRef, useState } from 'react'
import type { DownloadBudgetProgress } from '@hooks/migrations/useDownloadBudget'
import type { UploadBudgetProgress, UploadBudgetStatus, UploadBudgetResult } from '@hooks/migrations/useUploadBudget'
import { Spinner } from '../MigrationComponents'
import { logUserAction } from '@utils/actionLogger'

interface BudgetDownloadUploadRowProps {
  // Download props
  isDownloading: boolean
  downloadProgress: DownloadBudgetProgress | null
  downloadError: string | null
  onDownload: () => Promise<void>

  // Upload props
  isScanning: boolean
  isUploading: boolean
  uploadStatus: UploadBudgetStatus | null
  uploadProgress: UploadBudgetProgress | null
  uploadError: string | null
  uploadResult: UploadBudgetResult | null
  onScan: (file: File) => Promise<void>
  onUpload: (file: File) => Promise<void>

  disabled: boolean
}

export function BudgetDownloadUploadRow({
  isDownloading,
  downloadProgress,
  downloadError,
  onDownload,
  isScanning,
  isUploading,
  uploadStatus,
  uploadProgress,
  uploadError,
  uploadResult,
  onScan,
  onUpload,
  disabled,
}: BudgetDownloadUploadRowProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    logUserAction('CLICK', 'Select Budget Zip File')
    setSelectedFile(file)
    await onScan(file)
  }

  const hasUploadData = uploadStatus !== null
  const needsUpload = hasUploadData && (uploadStatus.budgetsFound > 0 || uploadStatus.monthsFound > 0)
  const isDisabled = disabled || isDownloading || isScanning || isUploading

  // Determine status
  const statusColor = uploadResult?.success
    ? '#22c55e'
    : needsUpload
      ? '#f59e0b'
      : hasUploadData
        ? '#22c55e'
        : '#9ca3af'

  const statusIcon = uploadResult?.success
    ? '✅'
    : isUploading || isScanning || isDownloading
      ? '⏳'
      : needsUpload
        ? '⚠️'
        : hasUploadData
          ? '✓'
          : '❓'

  const statusText = uploadResult?.success
    ? 'Uploaded'
    : isUploading
      ? 'Uploading'
      : isScanning
        ? 'Scanning'
        : isDownloading
          ? 'Downloading'
          : needsUpload
            ? `${uploadStatus.budgetsFound} budget(s), ${uploadStatus.monthsFound} month(s) ready`
            : hasUploadData
              ? 'Nothing to upload'
              : 'Select file'

  // Use download progress if downloading, otherwise upload progress
  const currentProgress = isDownloading
    ? downloadProgress?.percentComplete
    : uploadProgress?.percentComplete

  const currentError = downloadError || uploadError

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
          {(isUploading || isScanning || isDownloading) ? <Spinner noMargin /> : statusIcon}
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
            📦 Budget Backup & Restore
          </div>
          <div style={{
            fontSize: '0.8rem',
            opacity: 0.6,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            Download selected budget as zip or restore from zip file
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
          <button
            onClick={() => { logUserAction('CLICK', 'Download Budget'); onDownload() }}
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
            title="Download all budgets as zip"
          >
            {isDownloading ? <Spinner noMargin /> : '⬇️'}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
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
            title="Select zip file to restore"
          >
            {isScanning ? <Spinner noMargin /> : '📁'}
          </button>

          {needsUpload && selectedFile && (
            <button
              onClick={async () => {
                logUserAction('CLICK', 'Upload Budget')
                await onUpload(selectedFile)
              }}
              disabled={isDisabled}
              style={{
                background: '#646cff',
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
              {isUploading ? <Spinner noMargin /> : 'Upload'}
            </button>
          )}

          {(hasUploadData || uploadResult || currentError) && (
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

      {/* Progress Bar */}
      {(isDownloading || isUploading) && currentProgress !== undefined && (
        <div style={{
          padding: '0 1rem 0.5rem 1rem',
        }}>
          <div style={{
            width: '100%',
            height: '4px',
            background: 'color-mix(in srgb, currentColor 10%, transparent)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${currentProgress}%`,
              height: '100%',
              background: '#646cff',
              transition: 'width 0.3s ease',
            }} />
          </div>
          <div style={{
            fontSize: '0.75rem',
            opacity: 0.6,
            marginTop: '0.25rem',
            textAlign: 'center',
          }}>
            {isDownloading ? downloadProgress?.phase : uploadProgress?.phase}: {currentProgress}%
          </div>
        </div>
      )}

      {/* Expandable Details */}
      {isExpanded && (hasUploadData || uploadResult || currentError) && (
        <div style={{
          borderTop: '1px solid color-mix(in srgb, currentColor 10%, transparent)',
          padding: '1rem',
          background: 'color-mix(in srgb, currentColor 2%, transparent)',
          fontSize: '0.85rem',
        }}>
          {currentError && (
            <div style={{ marginBottom: '0.75rem', color: '#ef4444' }}>
              ❌ Error: {currentError}
            </div>
          )}

          {uploadResult && (
            <div style={{ marginBottom: uploadStatus ? '0.75rem' : 0, color: uploadResult.success ? '#22c55e' : '#ef4444' }}>
              {uploadResult.success ? (
                <>
                  ✅ Restored {uploadResult.budgetsRestored} budget(s), {uploadResult.monthsRestored} month(s), {uploadResult.payeesRestored} payee doc(s)
                </>
              ) : (
                <>❌ Upload failed: {uploadResult.errors.join(', ')}</>
              )}
            </div>
          )}

          {uploadStatus && (
            <>
              <div style={{ marginBottom: '0.25rem' }}>
                <strong>Found in zip:</strong> {uploadStatus.budgetsFound} budget(s), {uploadStatus.monthsFound} month(s), {uploadStatus.payeesFound} payee doc(s)
              </div>
              {uploadStatus.budgetsToRestore.length > 0 && (
                <div>
                  <strong>Budgets to restore:</strong> {uploadStatus.budgetsToRestore.join(', ')}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

