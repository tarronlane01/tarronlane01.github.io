/**
 * Diagnostic Download Row
 *
 * Compact row for downloading diagnostic JSON.
 */

import type { DownloadProgress } from '@hooks/migrations/useDiagnosticDownload'
import { UtilityRow } from '../common'

interface DiagnosticDownloadRowProps {
  isDownloading: boolean
  progress: DownloadProgress | null
  error: string | null
  onDownload: () => Promise<void>
  disabled: boolean
}

export function DiagnosticDownloadRow({
  isDownloading,
  progress,
  error,
  onDownload,
  disabled,
}: DiagnosticDownloadRowProps) {
  return (
    <UtilityRow
      name="📊 Diagnostic Download"
      description="Download all budget/month data as JSON for troubleshooting"
      onAction={onDownload}
      actionText="Download"
      actionIcon="⬇️"
      isRunning={isDownloading}
      disabled={disabled}
      progress={progress?.percentComplete}
      error={error ?? undefined}
    />
  )
}

