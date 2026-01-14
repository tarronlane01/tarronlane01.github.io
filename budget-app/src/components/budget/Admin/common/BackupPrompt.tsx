/**
 * Backup Prompt Component
 *
 * This component MUST be used before any migration that modifies data.
 * It enforces that users are prompted to backup their data before proceeding.
 *
 * Architecture:
 * - Renders as a modal when triggered
 * - Provides options to download backup or confirm backup is already done
 * - Cannot be dismissed without making a choice
 * - Prevents accidental data loss by making backup prompts mandatory
 */

import { useState, useCallback } from 'react'
import { Modal, Button } from '../../../ui'
import { Spinner } from '../MigrationComponents'

export type BackupChoice = 'downloaded' | 'already-have' | 'cancelled'

export interface BackupPromptProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (choice: BackupChoice) => void
  migrationName: string
  isDestructive?: boolean
  /** Optional function to trigger diagnostic download */
  onDownloadBackup?: () => Promise<void>
  isDownloading?: boolean
}

export function BackupPrompt({
  isOpen,
  onClose,
  onConfirm,
  migrationName,
  isDestructive = false,
  onDownloadBackup,
  isDownloading = false,
}: BackupPromptProps) {
  const [justDownloaded, setJustDownloaded] = useState(false)

  const handleDownloadBackup = useCallback(async () => {
    if (onDownloadBackup) {
      await onDownloadBackup()
      setJustDownloaded(true)
    }
  }, [onDownloadBackup])

  const handleConfirmWithBackup = useCallback(() => {
    onConfirm(justDownloaded ? 'downloaded' : 'already-have')
  }, [justDownloaded, onConfirm])

  const handleCancel = useCallback(() => {
    onConfirm('cancelled')
    onClose()
  }, [onConfirm, onClose])

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title="💾 Backup Recommended"
    >
      <div style={{
        background: isDestructive
          ? 'color-mix(in srgb, #ef4444 15%, transparent)'
          : 'color-mix(in srgb, #f59e0b 15%, transparent)',
        border: `1px solid ${isDestructive
          ? 'color-mix(in srgb, #ef4444 40%, transparent)'
          : 'color-mix(in srgb, #f59e0b 40%, transparent)'}`,
        borderRadius: '8px',
        padding: '1rem',
        marginBottom: '1rem',
      }}>
        <p style={{
          margin: 0,
          color: isDestructive ? '#fca5a5' : '#fcd34d',
          fontWeight: 500,
          fontSize: '0.95rem',
        }}>
          {isDestructive
            ? '⚠️ This migration modifies your data. A backup is strongly recommended!'
            : '💡 Before running migrations, we recommend having a recent backup.'}
        </p>
      </div>

      <p style={{ margin: '0 0 0.75rem', opacity: 0.9 }}>
        You are about to run: <strong>{migrationName}</strong>
      </p>

      <p style={{ margin: '0 0 1rem', opacity: 0.8, fontSize: '0.9rem' }}>
        Please ensure you have a recent backup of your data. You can download
        a diagnostic backup that includes all your budget and month data.
      </p>

      {onDownloadBackup && (
        <div style={{
          background: 'color-mix(in srgb, currentColor 5%, transparent)',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1rem',
        }}>
          <Button
            variant="secondary"
            onClick={handleDownloadBackup}
            disabled={isDownloading}
            actionName="Download Backup Before Migration"
            style={{ width: '100%' }}
          >
            {isDownloading ? (
              <>
                <Spinner noMargin /> Downloading Backup...
              </>
            ) : justDownloaded ? (
              '✅ Backup Downloaded'
            ) : (
              '⬇️ Download Backup Now'
            )}
          </Button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
        <Button
          variant="secondary"
          actionName="Cancel Migration"
          onClick={handleCancel}
        >
          Cancel
        </Button>
        <Button
          variant={isDestructive ? 'danger' : 'primary'}
          actionName={`Proceed with ${migrationName}`}
          onClick={handleConfirmWithBackup}
          disabled={isDownloading}
        >
          {justDownloaded
            ? '✅ Proceed with Migration'
            : '📋 I Have a Backup - Proceed'}
        </Button>
      </div>
    </Modal>
  )
}
