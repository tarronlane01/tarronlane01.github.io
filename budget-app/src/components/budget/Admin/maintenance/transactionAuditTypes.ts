/**
 * Transaction Type Audit Types
 */

import type { ReactNode } from 'react'

export type SubCheckStatus = 'unknown' | 'clean' | 'needs-action' | 'running' | 'complete' | 'error'

export interface SubCheck {
  id: string
  name: string
  status: SubCheckStatus
  issueCount: number
  description: string
  canFix: boolean
  onCheck: () => void
  onFix?: () => void
  isChecking: boolean
  isRunning: boolean
  details?: ReactNode
}

export const statusConfig: Record<SubCheckStatus, { color: string; icon: string }> = {
  unknown: { color: 'var(--text-muted)', icon: '❓' },
  clean: { color: 'var(--color-success)', icon: '✓' },
  'needs-action': { color: 'var(--color-warning)', icon: '⚠️' },
  running: { color: 'var(--color-migration-blue-light)', icon: '⏳' },
  complete: { color: 'var(--color-success)', icon: '✅' },
  error: { color: 'var(--color-error)', icon: '❌' },
}

