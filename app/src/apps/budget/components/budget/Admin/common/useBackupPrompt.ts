/**
 * Backup Prompt Hook
 *
 * Hook to manage backup prompt state for migrations.
 *
 * Usage:
 * ```tsx
 * const backupPrompt = useBackupPrompt({
 *   migrationName: 'Hidden Field Migration',
 *   isDestructive: true,
 *   onDownloadBackup: diagnosticDownload.downloadDiagnostics,
 * })
 *
 * // Instead of directly running migration:
 * // OLD: onRunMigration()
 * // NEW: backupPrompt.promptBeforeAction(onRunMigration)
 *
 * // Render the prompt:
 * <BackupPrompt {...backupPrompt.promptProps} />
 * ```
 */

import { useState, useCallback } from 'react'
import type { BackupChoice, BackupPromptProps } from './BackupPrompt'

interface UseBackupPromptOptions {
  migrationName: string
  isDestructive?: boolean
  onDownloadBackup?: () => Promise<void>
}

export function useBackupPrompt({
  migrationName,
  isDestructive = false,
  onDownloadBackup,
}: UseBackupPromptOptions) {
  const [isOpen, setIsOpen] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)

  const promptBeforeAction = useCallback((action: () => void) => {
    setPendingAction(() => action)
    setIsOpen(true)
  }, [])

  const handleConfirm = useCallback((choice: BackupChoice) => {
    if (choice !== 'cancelled' && pendingAction) {
      pendingAction()
    }
    setPendingAction(null)
    setIsOpen(false)
  }, [pendingAction])

  const handleClose = useCallback(() => {
    setPendingAction(null)
    setIsOpen(false)
  }, [])

  const handleDownloadBackup = useCallback(async () => {
    if (onDownloadBackup) {
      setIsDownloading(true)
      try {
        await onDownloadBackup()
      } finally {
        setIsDownloading(false)
      }
    }
  }, [onDownloadBackup])

  return {
    promptBeforeAction,
    promptProps: {
      isOpen,
      onClose: handleClose,
      onConfirm: handleConfirm,
      migrationName,
      isDestructive,
      onDownloadBackup: onDownloadBackup ? handleDownloadBackup : undefined,
      isDownloading,
    } as BackupPromptProps,
  }
}

