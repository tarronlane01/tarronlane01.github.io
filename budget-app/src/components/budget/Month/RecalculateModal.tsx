import { useBudget } from '../../../contexts/budget_context'
import { Modal, Button, formatCurrency } from '../../ui'
import { colors } from '../../../styles/shared'
import { MONTH_NAMES } from '@constants'

export interface RecalcResults {
  status: 'pending' | 'income_counting' | 'income_calculating' | 'income_saving' | 'expenses_counting' | 'balances_calculating' | 'balances_saving' | 'done' | 'error'
  incomeCount?: number
  expenseCount?: number
  oldIncomeTotal?: number
  newIncomeTotal?: number
  oldExpenseTotal?: number
  newExpenseTotal?: number
  error?: string
}

interface RecalculateModalProps {
  isOpen: boolean
  onClose: () => void
  results: RecalcResults | null
}

export function RecalculateModal({ isOpen, onClose, results }: RecalculateModalProps) {
  const { currentYear, currentMonthNumber } = useBudget()

  const canClose = results?.status === 'done' || results?.status === 'error'

  function handleClose() {
    if (canClose) {
      onClose()
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Recalculate Monthly Data"
    >
      <div style={{ padding: '0.5rem 0' }}>
        <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.9rem', opacity: 0.7 }}>
          Recalculating all totals and balances for {MONTH_NAMES[currentMonthNumber - 1]} {currentYear}
        </p>

        {/* Progress Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Step 1: Count income */}
          <ProgressStep
            status={results?.status === 'pending' ? 'waiting' : 'complete'}
            label="Count income transactions"
            detail={results && results.status !== 'pending'
              ? `Found ${results.incomeCount} transaction${results.incomeCount !== 1 ? 's' : ''}`
              : undefined
            }
          />

          {/* Step 2: Calculate income total */}
          <ProgressStep
            status={getStepStatus(results?.status, ['income_counting'], 'income_calculating')}
            label="Calculate income total"
            detail={results?.newIncomeTotal !== undefined
              ? formatCurrency(results.newIncomeTotal)
              : undefined
            }
          />

          {/* Step 3: Save income totals */}
          <ProgressStep
            status={getStepStatus(results?.status, ['pending', 'income_counting', 'income_calculating'], 'income_saving')}
            label="Save income totals"
          />

          {/* Step 4: Count expenses */}
          <ProgressStep
            status={getStepStatus(results?.status, ['pending', 'income_counting', 'income_calculating', 'income_saving'], 'expenses_counting')}
            label="Count expense transactions"
            detail={results?.expenseCount !== undefined && !['pending', 'income_counting', 'income_calculating', 'income_saving'].includes(results.status)
              ? `Found ${results.expenseCount} expense${results.expenseCount !== 1 ? 's' : ''} (${formatCurrency(results.newExpenseTotal || 0)})`
              : undefined
            }
          />

          {/* Step 5: Calculate category balances */}
          <ProgressStep
            status={getStepStatus(results?.status, ['pending', 'income_counting', 'income_calculating', 'income_saving', 'expenses_counting'], 'balances_calculating')}
            label="Calculate category balances"
          />

          {/* Step 6: Save balances */}
          <ProgressStep
            status={results?.status === 'error'
              ? 'error'
              : getStepStatus(results?.status, ['pending', 'income_counting', 'income_calculating', 'income_saving', 'expenses_counting', 'balances_calculating'], 'balances_saving')
            }
            label="Save category balances"
            detail={results?.status === 'error' ? results.error : undefined}
            isError={results?.status === 'error'}
          />
        </div>

        {/* Result summary */}
        {results?.status === 'done' && (
          <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            background: `color-mix(in srgb, ${colors.success} 10%, transparent)`,
            border: `1px solid ${colors.success}`,
            borderRadius: '8px',
          }}>
            <p style={{ margin: 0, fontWeight: 600, color: colors.success }}>
              ✓ Recalculation complete!
            </p>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', opacity: 0.8 }}>
              Income: {formatCurrency(results.newIncomeTotal || 0)} •
              Expenses: {formatCurrency(results.newExpenseTotal || 0)} •
              Category balances updated
            </p>
          </div>
        )}

        {/* Close button */}
        {canClose && (
          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={onClose}>
              Done
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}

// Helper to determine step status
function getStepStatus(
  currentStatus: string | undefined,
  pendingStatuses: string[],
  activeStatus: string
): 'waiting' | 'active' | 'complete' {
  if (!currentStatus || pendingStatuses.includes(currentStatus)) {
    return currentStatus === activeStatus ? 'active' : 'waiting'
  }
  if (currentStatus === activeStatus) return 'active'
  return 'complete'
}

interface ProgressStepProps {
  status: 'waiting' | 'active' | 'complete' | 'error'
  label: string
  detail?: string
  isError?: boolean
}

function ProgressStep({ status, label, detail, isError }: ProgressStepProps) {
  const icon = status === 'waiting' ? '⬜' :
    status === 'active' ? '⏳' :
    status === 'error' ? '❌' : '✅'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <span style={{ fontSize: '1.1rem', width: '1.5rem', textAlign: 'center' }}>
        {icon}
      </span>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontWeight: 500 }}>{label}</p>
        {detail && (
          <p style={{
            margin: '0.25rem 0 0 0',
            fontSize: '0.85rem',
            opacity: isError ? 1 : 0.6,
            color: isError ? colors.error : 'inherit',
          }}>
            {detail}
          </p>
        )}
      </div>
    </div>
  )
}

