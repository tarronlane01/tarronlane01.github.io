/**
 * Sample Budget Upload Row
 *
 * Component for uploading/restoring the shared sample budget from a zip file.
 * Only available to admin users.
 */

import { useRef, useState } from 'react'
import type { UploadSampleBudgetProgress, UploadSampleBudgetStatus, UploadSampleBudgetResult } from '@hooks/migrations/useUploadSampleBudget'
import { Spinner } from '../MigrationComponents'
import { logUserAction } from '@utils/actionLogger'

interface SampleBudgetUploadRowProps {
  isScanning: boolean
  isUploading: boolean
  uploadStatus: UploadSampleBudgetStatus | null
  uploadProgress: UploadSampleBudgetProgress | null
  uploadError: string | null
  uploadResult: UploadSampleBudgetResult | null
  onScan: (file: File) => Promise<void>
  onUpload: (file: File) => Promise<void>
  disabled: boolean
}

export function SampleBudgetUploadRow({
  isScanning,
  isUploading,
  uploadStatus,
  uploadProgress,
  uploadError,
  uploadResult,
  onScan,
  onUpload,
  disabled,
}: SampleBudgetUploadRowProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    logUserAction('CLICK', 'Select Sample Budget Zip File')
    setSelectedFile(file)
    await onScan(file)
  }

  const hasUploadData = uploadStatus !== null
  const needsUpload = hasUploadData && uploadStatus.isValid && uploadStatus.monthsFound > 0
  const isDisabled = disabled || isScanning || isUploading

  // Determine status
  const statusColor = uploadResult?.success
    ? 'var(--color-success)'
    : needsUpload
      ? 'var(--color-warning)'
      : hasUploadData && !uploadStatus.isValid
        ? 'var(--color-error)'
        : hasUploadData
          ? 'var(--color-success)'
          : 'var(--text-muted)'

  const statusIcon = uploadResult?.success
    ? '✅'
    : isUploading || isScanning
      ? '⏳'
      : needsUpload
        ? '⚠️'
        : hasUploadData && !uploadStatus.isValid
          ? '❌'
          : hasUploadData
            ? '✓'
            : '❓'

  const statusText = uploadResult?.success
    ? 'Uploaded'
    : isUploading
      ? 'Uploading'
      : isScanning
        ? 'Scanning'
        : needsUpload
          ? `${uploadStatus.monthsFound} months, ${uploadStatus.categoriesFound} categories ready`
          : hasUploadData && !uploadStatus.isValid
            ? 'Invalid format'
            : hasUploadData
              ? 'Nothing to upload'
              : 'Select file'

  const currentProgress = uploadProgress?.percentComplete
  const currentError = uploadError

  return (
    <div style={{
      background: 'color-mix(in srgb, var(--color-primary) 5%, transparent)',
      borderRadius: '8px',
      margin: '0.25rem 0',
      overflow: 'hidden',
      border: '1px solid color-mix(in srgb, var(--color-primary) 20%, transparent)',
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
          {(isUploading || isScanning) ? <Spinner noMargin /> : statusIcon}
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
            🎯 Sample Budget Upload
          </div>
          <div style={{
            fontSize: '0.8rem',
            opacity: 0.6,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            Upload sample budget data (overwrites shared sample budget for all admins)
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
            title="Select sample budget zip file"
          >
            {isScanning ? <Spinner noMargin /> : '📁'}
          </button>

          {needsUpload && selectedFile && (
            <button
              onClick={async () => {
                logUserAction('CLICK', 'Upload Sample Budget')
                await onUpload(selectedFile)
              }}
              disabled={isDisabled}
              style={{
                background: 'var(--color-primary)',
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
      {isUploading && currentProgress !== undefined && (
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
              background: 'var(--color-primary)',
              transition: 'width 0.3s ease',
            }} />
          </div>
          <div style={{
            fontSize: '0.75rem',
            opacity: 0.6,
            marginTop: '0.25rem',
            textAlign: 'center',
          }}>
            {uploadProgress?.phase}: {currentProgress}%
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
            <div style={{ marginBottom: '0.75rem', color: 'var(--color-error)' }}>
              ❌ Error: {currentError}
            </div>
          )}

          {uploadResult && (
            <div style={{ marginBottom: uploadStatus ? '0.75rem' : 0, color: uploadResult.success ? 'var(--color-success)' : 'var(--color-error)' }}>
              {uploadResult.success ? (
                <>
                  ✅ Restored {uploadResult.monthsRestored} month(s) to sample budget
                </>
              ) : (
                <>❌ Upload failed: {uploadResult.errors.join(', ')}</>
              )}
            </div>
          )}

          {uploadStatus && (
            <>
              <div style={{ marginBottom: '0.25rem' }}>
                <strong>Found in zip:</strong> {uploadStatus.monthsFound} month(s), {uploadStatus.categoriesFound} categories, {uploadStatus.accountsFound} accounts
              </div>
              {!uploadStatus.isValid && uploadStatus.validationErrors.length > 0 && (
                <div style={{ color: 'var(--color-error)' }}>
                  <strong>Validation errors:</strong> {uploadStatus.validationErrors.join(', ')}
                </div>
              )}
            </>
          )}

          <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', opacity: 0.7 }}>
            <strong>Expected format:</strong> Flat zip with budget.json, accounts.json, categories.json, category_groups.json, payees.json, and months/ folder containing month_YYYY_MM/ subfolders.
          </div>
        </div>
      )}
    </div>
  )
}
