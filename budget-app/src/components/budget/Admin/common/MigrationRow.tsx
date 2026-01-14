/**
 * Migration Row Component
 *
 * Compact one-line representation of a migration.
 * Used within MigrationSection for consistent display.
 *
 * Features:
 * - Status indicator (unknown/clean/needs-action/running/complete)
 * - Check/Refresh button
 * - Action button (apply migration)
 * - Optional detail expansion
 */

import { useState, type ReactNode } from 'react'
import { Spinner } from '../MigrationComponents'
import { logUserAction } from '@utils/actionLogger'

export type MigrationRowStatus = 'unknown' | 'clean' | 'needs-action' | 'running' | 'complete' | 'error'

interface MigrationRowProps {
  /** Migration name/title */
  name: string
  /** Short description */
  description: string
  /** Current status */
  status: MigrationRowStatus
  /** Optional status text override */
  statusText?: string
  /** Handler for check/refresh */
  onCheck: () => void
  /** Whether checking is in progress */
  isChecking: boolean
  /** Handler for running migration */
  onRun?: () => void
  /** Whether migration is running */
  isRunning?: boolean
  /** Action button text */
  actionText?: string
  /** Whether action is disabled */
  disabled?: boolean
  /** Optional count of items needing action */
  itemCount?: number
  /** Optional expandable details */
  details?: ReactNode
  /** Whether this is a destructive action */
  isDestructive?: boolean
}

const statusConfig: Record<MigrationRowStatus, { color: string; icon: string; text: string }> = {
  unknown: { color: '#9ca3af', icon: '❓', text: 'Unknown' },
  clean: { color: '#22c55e', icon: '✓', text: 'Clean' },
  'needs-action': { color: '#f59e0b', icon: '⚠️', text: 'Needs Action' },
  running: { color: '#60a5fa', icon: '⏳', text: 'Running' },
  complete: { color: '#22c55e', icon: '✅', text: 'Complete' },
  error: { color: '#ef4444', icon: '❌', text: 'Error' },
}

export function MigrationRow({
  name,
  description,
  status,
  statusText,
  onCheck,
  isChecking,
  onRun,
  isRunning = false,
  actionText = 'Run',
  disabled = false,
  itemCount,
  details,
  isDestructive = false,
}: MigrationRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const config = statusConfig[status]
  const displayStatus = statusText || config.text
  const isDisabled = disabled || isRunning || isChecking

  const handleCheck = () => {
    logUserAction('CLICK', `Check ${name}`)
    onCheck()
  }

  const handleRun = () => {
    if (onRun) {
      logUserAction('CLICK', `Run ${name}`)
      onRun()
    }
  }

  const toggleExpand = () => {
    if (details) {
      setIsExpanded(!isExpanded)
    }
  }

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
          background: `color-mix(in srgb, ${config.color} 20%, transparent)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.85rem',
          flexShrink: 0,
        }}>
          {isRunning || isChecking ? <Spinner noMargin /> : config.icon}
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
            {name}
          </div>
          <div style={{
            fontSize: '0.8rem',
            opacity: 0.6,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {description}
          </div>
        </div>

        {/* Status Badge */}
        <div style={{
          color: config.color,
          fontSize: '0.8rem',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          flexShrink: 0,
        }}>
          {displayStatus}
          {itemCount !== undefined && itemCount > 0 && (
            <span style={{
              background: `color-mix(in srgb, ${config.color} 20%, transparent)`,
              padding: '0.15rem 0.4rem',
              borderRadius: '4px',
              fontSize: '0.75rem',
            }}>
              {itemCount}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
          {/* Check/Refresh Button */}
          <button
            onClick={handleCheck}
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
            title="Check status"
          >
            {isChecking ? <Spinner noMargin /> : '🔄'}
          </button>

          {/* Run Button (if applicable) */}
          {onRun && status === 'needs-action' && (
            <button
              onClick={handleRun}
              disabled={isDisabled}
              style={{
                background: isDestructive ? '#ef4444' : '#646cff',
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
              {isRunning ? <Spinner noMargin /> : actionText}
            </button>
          )}

          {/* Expand Button (if details available) */}
          {details && (
            <button
              onClick={toggleExpand}
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
              title={isExpanded ? 'Collapse details' : 'Expand details'}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )}
        </div>
      </div>

      {/* Expandable Details */}
      {isExpanded && details && (
        <div style={{
          borderTop: '1px solid color-mix(in srgb, currentColor 10%, transparent)',
          padding: '1rem',
          background: 'color-mix(in srgb, currentColor 2%, transparent)',
        }}>
          {details}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// UTILITY ROW VARIANT - For non-migration utility actions
// =============================================================================

interface UtilityRowProps {
  /** Row name/title */
  name: string
  /** Short description */
  description: string
  /** Handler for action */
  onAction: () => void
  /** Action button text */
  actionText: string
  /** Action button icon */
  actionIcon?: string
  /** Whether action is in progress */
  isRunning?: boolean
  /** Whether action is disabled */
  disabled?: boolean
  /** Optional progress indicator (0-100) */
  progress?: number
  /** Optional error message */
  error?: string
  /** Whether this is a destructive action */
  isDestructive?: boolean
}

export function UtilityRow({
  name,
  description,
  onAction,
  actionText,
  actionIcon,
  isRunning = false,
  disabled = false,
  progress,
  error,
  isDestructive = false,
}: UtilityRowProps) {
  const isDisabled = disabled || isRunning

  const handleAction = () => {
    logUserAction('CLICK', name)
    onAction()
  }

  return (
    <div style={{
      background: 'color-mix(in srgb, currentColor 3%, transparent)',
      borderRadius: '8px',
      margin: '0.25rem 0',
      padding: '0.75rem 1rem',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
      }}>
        {/* Name and Description */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 500,
            fontSize: '0.95rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {name}
          </div>
          <div style={{
            fontSize: '0.8rem',
            opacity: 0.6,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {description}
          </div>
          {error && (
            <div style={{ fontSize: '0.8rem', color: '#ef4444', marginTop: '0.25rem' }}>
              {error}
            </div>
          )}
        </div>

        {/* Progress (if applicable) */}
        {progress !== undefined && isRunning && (
          <div style={{ width: '100px', flexShrink: 0 }}>
            <div style={{
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '4px',
              height: '6px',
              overflow: 'hidden',
            }}>
              <div style={{
                background: isDestructive ? '#ef4444' : '#646cff',
                height: '100%',
                width: `${progress}%`,
                transition: 'width 0.3s',
              }} />
            </div>
            <div style={{ fontSize: '0.7rem', opacity: 0.6, textAlign: 'center', marginTop: '0.15rem' }}>
              {progress}%
            </div>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleAction}
          disabled={isDisabled}
          style={{
            background: isDestructive ? '#ef4444' : '#646cff',
            color: 'white',
            border: 'none',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            fontSize: '0.85rem',
            fontWeight: 500,
            opacity: isDisabled ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            flexShrink: 0,
          }}
        >
          {isRunning ? (
            <>
              <Spinner noMargin /> Running...
            </>
          ) : (
            <>
              {actionIcon && <span>{actionIcon}</span>}
              {actionText}
            </>
          )}
        </button>
      </div>
    </div>
  )
}

