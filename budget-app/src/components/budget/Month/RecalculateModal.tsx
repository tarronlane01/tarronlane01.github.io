import { useState } from 'react'
import { Modal, Button, formatCurrency } from '../../ui'
import { colors } from '@styles/shared'

export interface RecalcResults {
  status: 'confirming' | 'pending' | 'finding_months' | 'processing_months' | 'updating_budget' | 'done' | 'error'
  // Month discovery
  monthsFound?: number
  // Current processing
  currentMonthIndex?: number
  currentMonthLabel?: string
  // Summary stats
  totalIncomeRecalculated?: number
  totalExpensesRecalculated?: number
  monthsProcessed?: number
  // Error
  error?: string
}

export type RecalcMode = 'from_current' | 'all_months'

interface RecalculateModalProps {
  isOpen: boolean
  onClose: () => void
  onProceed: (mode: RecalcMode) => void
  results: RecalcResults | null
}

export function RecalculateModal({ isOpen, onClose, onProceed, results }: RecalculateModalProps) {
  const [selectedMode, setSelectedMode] = useState<RecalcMode>('from_current')
  const isConfirming = !results || results.status === 'confirming'
  const isProcessing = results && !['confirming', 'done', 'error'].includes(results.status)
  const canClose = isConfirming || results?.status === 'done' || results?.status === 'error'

  function handleClose() {
    if (canClose) {
      onClose()
      // Reset mode selection when closing
      setSelectedMode('from_current')
    }
  }

  function handleProceed() {
    onProceed(selectedMode)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Recalculate Balances"
      width="540px"
    >
      <div style={{ padding: '0.5rem 0' }}>
        {/* Confirmation Screen */}
        {isConfirming && (
          <>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', lineHeight: 1.5 }}>
              Choose what to recalculate:
            </p>

            {/* Mode Selection */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <ModeOption
                selected={selectedMode === 'from_current'}
                onClick={() => setSelectedMode('from_current')}
                title="From current month forward"
                description="Recalculate from this month onward. Use for quick fixes."
              />
              <ModeOption
                selected={selectedMode === 'all_months'}
                onClick={() => setSelectedMode('all_months')}
                title="All months from beginning"
                description="Recalculate entire history. Use after migrations or data repairs."
                recommended
              />
            </div>

            {/* Preview of steps */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <ProgressStep status="waiting" label="Find all months to process" />
              <ProgressStep status="waiting" label="Process months" />
              <ProgressStep status="waiting" label="Update budget totals" />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <Button variant="secondary" actionName="Cancel Recalculation" onClick={onClose}>
                Cancel
              </Button>
              <Button actionName="Proceed with Recalculation" onClick={handleProceed}>
                Proceed
              </Button>
            </div>
          </>
        )}

        {/* Processing Screen */}
        {!isConfirming && (
          <>
            <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.9rem', opacity: 0.7 }}>
              Recalculating category balances and account balances...
            </p>

            {/* Progress Steps */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Step 1: Find months */}
              <ProgressStep
                status={results?.status === 'pending' ? 'waiting' : 'complete'}
                label="Find all months to process"
                detail={results && results.status !== 'pending'
                  ? `Found ${results.monthsFound || 0} month${results.monthsFound !== 1 ? 's' : ''}`
                  : undefined
                }
              />

              {/* Step 2: Process months */}
              <ProgressStep
                status={getStepStatus(results?.status, ['pending', 'finding_months'], 'processing_months')}
                label="Process months"
                detail={results?.status === 'processing_months'
                  ? `Processing: ${results.currentMonthLabel} (${(results.currentMonthIndex || 0) + 1}/${results.monthsFound || 0})`
                  : results?.monthsProcessed !== undefined
                    ? `Processed ${results.monthsProcessed} month${results.monthsProcessed !== 1 ? 's' : ''}`
                    : undefined
                }
              />

              {/* Step 3: Update budget */}
              <ProgressStep
                status={results?.status === 'error'
                  ? 'error'
                  : getStepStatus(results?.status, ['pending', 'finding_months', 'processing_months'], 'updating_budget')
                }
                label="Update budget totals"
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
                textAlign: 'center',
              }}>
                <p style={{ margin: 0, fontWeight: 600, color: colors.success }}>
                  ✓ Recalculation complete!
                </p>
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', opacity: 0.8 }}>
                  {results.monthsProcessed} month{results.monthsProcessed !== 1 ? 's' : ''} processed<br />
                  Total Income: {formatCurrency(results.totalIncomeRecalculated || 0)}<br />
                  Total Expenses: {formatCurrency(results.totalExpensesRecalculated || 0)}
                </p>
              </div>
            )}

            {/* Close button when done/error */}
            {(results?.status === 'done' || results?.status === 'error') && (
              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                <Button actionName="Close Recalculation Modal" onClick={onClose}>
                  Done
                </Button>
              </div>
            )}

            {/* Processing indicator */}
            {isProcessing && (
              <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.85rem', opacity: 0.6 }}>
                Please wait, do not close this window...
              </p>
            )}
          </>
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

interface ModeOptionProps {
  selected: boolean
  onClick: () => void
  title: string
  description: string
  recommended?: boolean
}

function ModeOption({ selected, onClick, title, description, recommended }: ModeOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        background: selected
          ? 'color-mix(in srgb, #646cff 15%, transparent)'
          : 'color-mix(in srgb, currentColor 5%, transparent)',
        border: selected ? '2px solid #646cff' : '2px solid transparent',
        borderRadius: '8px',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        transition: 'all 0.15s ease',
      }}
    >
      <span style={{
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        border: selected ? '6px solid #646cff' : '2px solid rgba(128,128,128,0.5)',
        flexShrink: 0,
        marginTop: '2px',
        background: selected ? 'white' : 'transparent',
      }} />
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem' }}>
          {title}
          {recommended && (
            <span style={{
              marginLeft: '0.5rem',
              padding: '0.15rem 0.5rem',
              background: colors.success,
              color: 'white',
              borderRadius: '4px',
              fontSize: '0.7rem',
              fontWeight: 500,
              verticalAlign: 'middle',
            }}>
              RECOMMENDED
            </span>
          )}
        </p>
        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
          {description}
        </p>
      </div>
    </button>
  )
}

