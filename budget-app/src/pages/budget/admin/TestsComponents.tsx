/**
 * Test Components - UI components for security tests
 */

import { Button } from '../../../components/ui'
import { card, colors } from '@styles/shared'

export interface TestResult {
  name: string
  status: 'pending' | 'running' | 'passed' | 'failed'
  message: string
  expectedToFail: boolean
}

interface TestButtonProps {
  name: string
  description: string
  expectedBehavior: string
  result?: TestResult
  onRun: () => void
  disabled: boolean
  expectedToSucceed?: boolean
}

export function TestButton({ name, description, expectedBehavior, result, onRun, disabled, expectedToSucceed }: TestButtonProps) {
  const statusColor = result?.status === 'passed'
    ? colors.success
    : result?.status === 'failed'
      ? colors.danger
      : result?.status === 'running'
        ? colors.warning
        : 'inherit'

  return (
    <div style={{
      ...card,
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: 0, fontSize: '0.95rem' }}>{name}</h4>
          <p style={{ margin: '0.25rem 0 0', opacity: 0.7, fontSize: '0.85rem' }}>{description}</p>
          <p style={{
            margin: '0.25rem 0 0',
            fontSize: '0.8rem',
            color: expectedToSucceed ? colors.success : colors.warning,
          }}>
            Expected: {expectedBehavior}
          </p>
        </div>
        <Button
          onClick={onRun}
          disabled={disabled}
          variant="secondary"
          style={{ flexShrink: 0 }}
        >
          {result?.status === 'running' ? '⏳' : 'Run'}
        </Button>
      </div>

      {result && result.status !== 'pending' && (
        <div style={{
          padding: '0.5rem 0.75rem',
          borderRadius: '6px',
          background: `color-mix(in srgb, ${statusColor} 15%, transparent)`,
          border: `1px solid color-mix(in srgb, ${statusColor} 30%, transparent)`,
          fontSize: '0.85rem',
          color: statusColor,
        }}>
          {result.message}
        </div>
      )}
    </div>
  )
}

interface TestSummaryProps {
  totalCount: number
  passedCount: number
  failedCount: number
}

export function TestSummary({ totalCount, passedCount, failedCount }: TestSummaryProps) {
  return (
    <div style={{
      display: 'flex',
      gap: '1rem',
      padding: '0.75rem 1rem',
      borderRadius: '8px',
      background: 'color-mix(in srgb, currentColor 5%, transparent)',
      marginBottom: '1rem',
    }}>
      <span>Total: <strong>{totalCount}</strong></span>
      <span style={{ color: colors.success }}>Passed: <strong>{passedCount}</strong></span>
      <span style={{ color: colors.danger }}>Failed: <strong>{failedCount}</strong></span>
    </div>
  )
}

