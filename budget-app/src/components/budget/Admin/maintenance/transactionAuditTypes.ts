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
  unknown: { color: '#9ca3af', icon: '❓' },
  clean: { color: '#22c55e', icon: '✓' },
  'needs-action': { color: '#f59e0b', icon: '⚠️' },
  running: { color: '#60a5fa', icon: '⏳' },
  complete: { color: '#22c55e', icon: '✅' },
  error: { color: '#ef4444', icon: '❌' },
}

