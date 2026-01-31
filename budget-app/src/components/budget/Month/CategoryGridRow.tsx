/**
 * CategoryGridRow - Desktop grid row for a single category balance.
 * Renders as grid items (display: contents) within CategoryGroupRows.
 */

import type { Category, CategoryMonthBalance } from '@types'
import {
  formatCurrency,
  formatBalanceCurrency,
  formatSignedCurrency,
  formatSignedCurrencyAlways,
  getCategoryBalanceColor,
  getAllocatedColor,
  getSpendColor,
} from '../../ui'
import { colors, tentativeValue } from '@styles/shared'

function getTransferColor(value: number): string {
  if (value === 0) return colors.zero
  return value > 0 ? colors.success : colors.error
}

export interface CategoryGridRowProps {
  category: Category
  balance: CategoryMonthBalance
  localAllocation: string
  previousMonthIncome: number
  isDraftMode: boolean
  onAllocationChange: (value: string) => void
  allTimeBalance: number
  isEvenRow: boolean
  gridTemplateColumns: string
}

export function CategoryGridRow({
  category,
  balance,
  localAllocation,
  previousMonthIncome,
  isDraftMode,
  onAllocationChange,
  allTimeBalance,
  isEvenRow,
  gridTemplateColumns,
}: CategoryGridRowProps) {
  const isPercentageBased = category.default_monthly_type === 'percentage' && category.default_monthly_amount !== undefined && category.default_monthly_amount > 0
  const calculatedAmount = isPercentageBased ? (category.default_monthly_amount! / 100) * previousMonthIncome : 0
  const displayValue = isPercentageBased ? calculatedAmount.toFixed(2) : localAllocation

  const storedBalance = category.balance ?? 0
  const hasDebt = storedBalance < 0
  const debtAmount = hasDebt ? Math.abs(storedBalance) : 0

  const allocationAmount = isPercentageBased ? calculatedAmount : (parseFloat(localAllocation) || 0)
  const debtReductionAmount = hasDebt ? Math.min(allocationAmount, debtAmount) : 0
  const toBalanceAmount = hasDebt ? Math.max(0, allocationAmount - debtAmount) : 0
  const showBreakdown = hasDebt && allocationAmount > 0 && toBalanceAmount > 0

  const rowBg = isEvenRow ? 'transparent' : 'var(--row-alt-bg)'

  const cellStyle: React.CSSProperties = {
    paddingTop: '0.6rem',
    paddingBottom: '0.6rem',
    paddingLeft: '0.5rem',
    paddingRight: '0.5rem',
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.9rem',
    minHeight: '2.4rem',
    boxSizing: 'border-box',
  }

  const netChange = balance.allocated + balance.spent + balance.transfers + balance.adjustments

  return (
    <div style={{
      gridColumn: '1 / -1',
      background: rowBg,
      display: 'grid',
      gridTemplateColumns: gridTemplateColumns,
    }}>
      <div style={{
        paddingTop: '0.6rem',
        paddingBottom: '0.6rem',
        paddingRight: '0.5rem',
        paddingLeft: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        fontSize: '0.9rem',
        fontWeight: 500,
        overflow: 'hidden',
        borderLeft: '2px solid var(--border-subtle)',
        minHeight: '2.4rem',
        boxSizing: 'border-box',
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {category.name}
        </span>
      </div>

      <div style={{ ...cellStyle, justifyContent: 'flex-end', color: getCategoryBalanceColor(balance.start_balance) }}>
        {formatBalanceCurrency(balance.start_balance)}
      </div>

      {isDraftMode ? (
        <div style={{ ...cellStyle, justifyContent: 'center', flexDirection: 'column', gap: '0.1rem' }}>
          {isPercentageBased ? (
            <span style={{ fontSize: '0.85rem' }}>
              <span style={{ color: colors.success }}>{category.default_monthly_amount}%</span>
              <span style={{ opacity: 0.5 }}> = </span>
              <span style={{ color: colors.success }}>{formatCurrency(calculatedAmount)}</span>
            </span>
          ) : (
            <>
              <input
                type="text"
                inputMode="decimal"
                value={displayValue ? `$${displayValue}` : ''}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^\d.]/g, '')
                  onAllocationChange(raw)
                }}
                placeholder="$0.00"
                style={{
                  width: '100px',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  border: '1px solid color-mix(in srgb, currentColor 20%, transparent)',
                  background: 'color-mix(in srgb, currentColor 5%, transparent)',
                  fontSize: '0.9rem',
                  lineHeight: 1,
                  color: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
              {hasDebt && allocationAmount > 0 && (
                <div style={{ fontSize: '0.6rem', whiteSpace: 'nowrap', textAlign: 'center', lineHeight: 1.3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ color: colors.debt }}>{formatCurrency(debtReductionAmount)} → debt</span>
                  {showBreakdown && (
                    <span style={{ color: colors.success }}>{formatCurrency(toBalanceAmount)} → bal</span>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        (() => {
          const hadDebtAtStart = balance.start_balance < 0
          const startDebtAmount = hadDebtAtStart ? Math.abs(balance.start_balance) : 0
          const finalizedDebtReduction = hadDebtAtStart ? Math.min(balance.allocated, startDebtAmount) : 0
          const finalizedToBalance = hadDebtAtStart ? Math.max(0, balance.allocated - startDebtAmount) : 0
          const showFinalizedBreakdown = hadDebtAtStart && balance.allocated > 0

          return (
            <div style={{ ...cellStyle, justifyContent: 'flex-end', flexDirection: 'column', alignItems: 'flex-end', gap: '0.1rem', color: getAllocatedColor(balance.allocated) }}>
              <span>+{formatCurrency(balance.allocated)}</span>
              {showFinalizedBreakdown && (
                <div style={{ fontSize: '0.6rem', whiteSpace: 'nowrap', textAlign: 'right', lineHeight: 1.3, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span style={{ color: colors.debt }}>{formatCurrency(finalizedDebtReduction)} → debt</span>
                  {finalizedToBalance > 0 && (
                    <span style={{ color: colors.success }}>{formatCurrency(finalizedToBalance)} → bal</span>
                  )}
                </div>
              )}
            </div>
          )
        })()
      )}

      <div style={{ ...cellStyle, justifyContent: 'flex-end', color: getSpendColor(balance.spent) }}>
        {formatSignedCurrency(balance.spent)}
      </div>
      <div style={{ ...cellStyle, justifyContent: 'flex-end', color: getTransferColor(balance.transfers) }}>
        {formatSignedCurrencyAlways(balance.transfers)}
      </div>
      <div style={{ ...cellStyle, justifyContent: 'flex-end', color: getTransferColor(balance.adjustments) }}>
        {formatSignedCurrencyAlways(balance.adjustments)}
      </div>
      <div style={{ ...cellStyle, justifyContent: 'flex-end', color: getCategoryBalanceColor(netChange), ...(isDraftMode && !isPercentageBased ? tentativeValue : {}) }}>
        {formatSignedCurrencyAlways(netChange)}
      </div>
      <div style={{ ...cellStyle, justifyContent: 'flex-end', fontWeight: 600, color: getCategoryBalanceColor(balance.end_balance), paddingRight: '1rem', borderRight: '2px solid var(--border-muted)', ...(isDraftMode && !isPercentageBased ? tentativeValue : {}) }}>
        {formatBalanceCurrency(balance.end_balance)}
      </div>
      <div style={{ ...cellStyle, justifyContent: 'flex-end', color: getCategoryBalanceColor(allTimeBalance), ...(isDraftMode && !isPercentageBased ? tentativeValue : {}) }}>
        {formatBalanceCurrency(allTimeBalance)}
      </div>
    </div>
  )
}
