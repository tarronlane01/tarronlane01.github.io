/**
 * Sub-Check Row Component
 *
 * Individual row for a sub-check within the Transaction Type Audit.
 */

import { Spinner } from '../MigrationComponents'
import { logUserAction } from '@utils/actionLogger'
import { statusConfig, type SubCheck } from './transactionAuditTypes'

interface SubCheckRowProps {
  check: SubCheck
  disabled: boolean
}

export function SubCheckRow({ check, disabled }: SubCheckRowProps) {
  const config = statusConfig[check.status]
  const isDisabled = disabled || check.isRunning || check.isChecking

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '0.5rem 0.75rem',
      gap: '0.75rem',
      borderRadius: '6px',
      background: 'color-mix(in srgb, currentColor 3%, transparent)',
      marginBottom: '0.25rem',
    }}>
      {/* Mini Status */}
      <div style={{
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        background: `color-mix(in srgb, ${config.color} 20%, transparent)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.7rem',
        flexShrink: 0,
      }}>
        {check.isRunning || check.isChecking ? <Spinner noMargin /> : config.icon}
      </div>

      {/* Name and Details */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>
          {check.name}
          {check.issueCount > 0 && (
            <span style={{
              marginLeft: '0.5rem',
              color: config.color,
              fontSize: '0.75rem',
            }}>
              ({check.issueCount})
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{check.description}</div>
        {check.details}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
        <button
          onClick={() => { logUserAction('CLICK', `Check ${check.name}`); check.onCheck() }}
          disabled={isDisabled}
          style={{
            background: 'color-mix(in srgb, currentColor 10%, transparent)',
            color: 'inherit',
            border: '1px solid color-mix(in srgb, currentColor 20%, transparent)',
            padding: '0.25rem 0.4rem',
            borderRadius: '4px',
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            fontSize: '0.7rem',
            opacity: isDisabled ? 0.5 : 1,
          }}
          title="Check"
        >
          {check.isChecking ? <Spinner noMargin /> : '🔄'}
        </button>

        {check.canFix && check.onFix && (
          <button
            onClick={() => { logUserAction('CLICK', `Fix ${check.name}`); check.onFix!() }}
            disabled={isDisabled}
            style={{
              background: '#646cff',
              color: 'white',
              border: 'none',
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              fontSize: '0.7rem',
              fontWeight: 500,
              opacity: isDisabled ? 0.6 : 1,
            }}
          >
            {check.isRunning ? <Spinner noMargin /> : 'Fix'}
          </button>
        )}
      </div>
    </div>
  )
}

