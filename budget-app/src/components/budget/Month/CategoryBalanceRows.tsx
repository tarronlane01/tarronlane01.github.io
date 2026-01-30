/**
 * Category Balance Row Components
 *
 * Mobile and Desktop row components for displaying individual category balances.
 */

import type { Category, CategoryMonthBalance } from '@types'
import { formatCurrency, formatBalanceCurrency, formatSignedCurrency, formatSignedCurrencyAlways, getCategoryBalanceColor, getAllocatedColor, getSpendColor } from '../../ui'
import { colors, tentativeValue } from '@styles/shared'

// Helper color function for transfers/adjustments - positive=green, negative=red, zero=grey
function getTransferColor(value: number): string {
  if (value === 0) return colors.zero
  return value > 0 ? colors.success : colors.error
}

// Shared styles for full-height field containers with centered content
const fieldContainer = {
  alignSelf: 'stretch' as const,
  display: 'flex',
  alignItems: 'center',
}

// =============================================================================
// MOBILE BALANCE ROW
// =============================================================================

interface BalanceRowProps {
  category: Category
  balance: CategoryMonthBalance
  localAllocation: string
  previousMonthIncome: number
  isDraftMode: boolean
  onAllocationChange: (value: string) => void
  /** Projected all-time balance (stored balance + this month's change) */
  projectedAllTime: number
}

export function MobileBalanceRow({ category, balance, localAllocation, previousMonthIncome, isDraftMode, onAllocationChange, projectedAllTime }: BalanceRowProps) {
  const isPercentageBased = category.default_monthly_type === 'percentage' && category.default_monthly_amount !== undefined && category.default_monthly_amount > 0
  const calculatedAmount = isPercentageBased ? (category.default_monthly_amount! / 100) * previousMonthIncome : 0
  const displayValue = isPercentageBased ? calculatedAmount.toFixed(2) : localAllocation

  // Show inline input in draft mode for non-percentage categories
  const showInlineInput = isDraftMode && !isPercentageBased

  // All-time balance: in draft mode show projected, otherwise show stored
  const allTimeBalance = isDraftMode ? projectedAllTime : (category.balance ?? 0)

  // Check if this category has debt (negative stored balance)
  const storedBalance = category.balance ?? 0
  const hasDebt = storedBalance < 0
  const debtAmount = hasDebt ? Math.abs(storedBalance) : 0

  // Calculate how much of the allocation goes to debt reduction vs actual balance
  const allocationAmount = isPercentageBased ? calculatedAmount : (parseFloat(localAllocation) || 0)
  const debtReductionAmount = hasDebt ? Math.min(allocationAmount, debtAmount) : 0
  const toBalanceAmount = hasDebt ? Math.max(0, allocationAmount - debtAmount) : 0
  const showBreakdown = hasDebt && allocationAmount > 0 && toBalanceAmount > 0

  return (
    <div style={{
      background: 'color-mix(in srgb, currentColor 5%, transparent)',
      borderRadius: '8px',
      padding: '0.75rem',
    }}>
      {/* Category name row */}
      <div style={{ marginBottom: '0.5rem' }}>
        <span style={{ fontWeight: 500 }}>
          {category.name}
        </span>
      </div>

      {/* Values in one row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr',
        gap: '0.25rem',
        fontSize: '0.75rem',
      }}>
        <div>
          <span style={{ opacity: 0.6, display: 'block' }}>Start</span>
          <span style={{ color: getCategoryBalanceColor(balance.start_balance) }}>{formatBalanceCurrency(balance.start_balance)}</span>
        </div>
        <div>
          <span style={{ opacity: 0.6, display: 'block' }}>Alloc</span>
          {showInlineInput ? (
            <>
              <input
                type="text"
                inputMode="decimal"
                value={displayValue ? `$${displayValue}` : ''}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^\d.]/g, '')
                  onAllocationChange(raw)
                }}
                placeholder="$0"
                style={{
                  width: '100%',
                  maxWidth: '80px',
                  padding: '0.25rem 0.35rem',
                  borderRadius: '4px',
                  border: '1px solid color-mix(in srgb, currentColor 20%, transparent)',
                  background: 'color-mix(in srgb, currentColor 8%, transparent)',
                  fontSize: '0.8rem',
                  color: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
              {/* Show debt reduction breakdown below input on mobile */}
              {hasDebt && allocationAmount > 0 && (
                <div style={{ fontSize: '0.65rem', marginTop: '0.15rem', lineHeight: 1.3 }}>
                  <span style={{ color: colors.debt, display: 'block' }}>
                    {formatCurrency(debtReductionAmount)} → debt
                  </span>
                  {showBreakdown && (
                    <span style={{ color: colors.success, display: 'block' }}>
                      {formatCurrency(toBalanceAmount)} → balance
                    </span>
                  )}
                </div>
              )}
            </>
          ) : (
            <span style={{ color: getAllocatedColor(balance.allocated) }}>
              {formatSignedCurrencyAlways(balance.allocated)}
            </span>
          )}
        </div>
        <div>
          <span style={{ opacity: 0.6, display: 'block' }}>Spent</span>
          <span style={{ color: getSpendColor(balance.spent) }}>
            {formatSignedCurrency(balance.spent)}
          </span>
        </div>
        <div>
          <span style={{ opacity: 0.6, display: 'block' }}>End</span>
          <span style={{ color: getCategoryBalanceColor(balance.end_balance), ...(isDraftMode && !isPercentageBased ? tentativeValue : {}) }}>
            {formatBalanceCurrency(balance.end_balance)}
          </span>
        </div>
        <div>
          <span style={{ opacity: 0.6, display: 'block' }}>{isDraftMode ? 'Proj. All-Time' : 'All-Time'}</span>
          <span style={{ color: getCategoryBalanceColor(allTimeBalance), ...(isDraftMode && !isPercentageBased ? tentativeValue : {}) }}>
            {formatBalanceCurrency(allTimeBalance)}
          </span>
        </div>
      </div>

      {/* Show transfers and adjustments if non-zero */}
      {(balance.transfers !== 0 || balance.adjustments !== 0) && (
        <div style={{
          marginTop: '0.5rem',
          paddingTop: '0.5rem',
          borderTop: '1px solid color-mix(in srgb, currentColor 10%, transparent)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem 1rem',
          fontSize: '0.7rem',
          opacity: 0.7,
        }}>
          {balance.transfers !== 0 && (
            <span style={{ color: getTransferColor(balance.transfers) }}>
              {formatSignedCurrencyAlways(balance.transfers)} transfers
            </span>
          )}
          {balance.adjustments !== 0 && (
            <span style={{ color: getTransferColor(balance.adjustments) }}>
              {formatSignedCurrencyAlways(balance.adjustments)} adjust
            </span>
          )}
        </div>
      )}

      {/* Percentage equation - only in draft mode for percentage-based categories */}
      {isDraftMode && isPercentageBased && (
        <div style={{ marginTop: '0.5rem' }}>
          <span style={{ fontSize: '0.8rem' }}>
            <span style={{ opacity: 0.6 }}>{formatCurrency(previousMonthIncome)} × </span>
            <span style={{ color: colors.success }}>{category.default_monthly_amount}%</span>
            <span style={{ opacity: 0.6 }}> = </span>
            <span style={{ color: colors.success }}>{formatCurrency(calculatedAmount)}</span>
          </span>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// DESKTOP BALANCE ROW
// =============================================================================

interface DesktopBalanceRowProps {
  category: Category
  balance: CategoryMonthBalance
  localAllocation: string
  previousMonthIncome: number
  isDraftMode: boolean
  onAllocationChange: (value: string) => void
  allTimeBalance: number
  isEvenRow: boolean
}

export function DesktopBalanceRow({ category, balance, localAllocation, previousMonthIncome, isDraftMode, onAllocationChange, allTimeBalance, isEvenRow }: DesktopBalanceRowProps) {
  const isPercentageBased = category.default_monthly_type === 'percentage' && category.default_monthly_amount !== undefined && category.default_monthly_amount > 0
  const calculatedAmount = isPercentageBased ? (category.default_monthly_amount! / 100) * previousMonthIncome : 0
  const displayValue = isPercentageBased ? calculatedAmount.toFixed(2) : localAllocation

  // Check if this category has debt (negative stored balance)
  const storedBalance = category.balance ?? 0
  const hasDebt = storedBalance < 0
  const debtAmount = hasDebt ? Math.abs(storedBalance) : 0

  // Calculate how much of the allocation goes to debt reduction vs actual balance
  const allocationAmount = isPercentageBased ? calculatedAmount : (parseFloat(localAllocation) || 0)
  const debtReductionAmount = hasDebt ? Math.min(allocationAmount, debtAmount) : 0
  const toBalanceAmount = hasDebt ? Math.max(0, allocationAmount - debtAmount) : 0
  const showBreakdown = hasDebt && allocationAmount > 0 && toBalanceAmount > 0

  return (
    <div style={{
      display: 'flex',
      alignItems: 'stretch',
      padding: '0.6rem 0.75rem',
      background: isEvenRow ? 'transparent' : 'var(--row-alt-bg)',
    }}>
      {/* Category name */}
      <div style={{ ...fieldContainer, flex: 2, minWidth: 0, overflow: 'hidden' }}>
        <span style={{ fontWeight: 500, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {category.name}
        </span>
      </div>

      {/* Start balance */}
      <div style={{ ...fieldContainer, flex: 1, justifyContent: 'flex-end', fontSize: '0.9rem', color: getCategoryBalanceColor(balance.start_balance) }}>
        {formatBalanceCurrency(balance.start_balance)}
      </div>

      {/* Allocated - input in draft mode, display in finalized mode */}
      {isDraftMode ? (
        <div style={{ ...fieldContainer, width: '200px', justifyContent: 'center', flexDirection: 'column', gap: '0.15rem' }}>
          {isPercentageBased ? (
            <span style={{ fontSize: '0.8rem' }}>
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
                  width: '90px',
                  padding: '0.3rem 0.5rem',
                  borderRadius: '4px',
                  border: '1px solid color-mix(in srgb, currentColor 20%, transparent)',
                  background: 'color-mix(in srgb, currentColor 5%, transparent)',
                  fontSize: '0.9rem',
                  color: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
              {/* Show debt reduction breakdown below input */}
              {hasDebt && allocationAmount > 0 && (
                <div style={{ fontSize: '0.65rem', whiteSpace: 'nowrap', textAlign: 'center', lineHeight: 1.3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ color: colors.debt }}>
                    {formatCurrency(debtReductionAmount)} → debt
                  </span>
                  {showBreakdown && (
                    <span style={{ color: colors.success }}>
                      {formatCurrency(toBalanceAmount)} → bal
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div style={{
          ...fieldContainer,
          flex: 1,
          justifyContent: 'flex-end',
          fontSize: '0.9rem',
          color: getAllocatedColor(balance.allocated),
        }}>
          {formatSignedCurrencyAlways(balance.allocated)}
        </div>
      )}

      {/* Spent */}
      <div style={{
        ...fieldContainer,
        flex: 1,
        justifyContent: 'flex-end',
        fontSize: '0.9rem',
        color: getSpendColor(balance.spent),
      }}>
        {formatSignedCurrency(balance.spent)}
      </div>

      {/* End - with border-right that extends full height */}
      <div style={{
        ...fieldContainer,
        flex: 1,
        justifyContent: 'flex-end',
        fontSize: '0.9rem',
        fontWeight: 600,
        color: getCategoryBalanceColor(balance.end_balance),
        paddingRight: '1rem',
        marginTop: '-0.6rem',
        marginBottom: '-0.6rem',
        paddingTop: '0.6rem',
        paddingBottom: '0.6rem',
        borderRight: '2px solid var(--border-muted)',
      }}>
        {formatBalanceCurrency(balance.end_balance)}
      </div>

      {/* All-Time */}
      <div style={{
        ...fieldContainer,
        width: '120px',
        justifyContent: 'flex-end',
        fontSize: '0.9rem',
        color: getCategoryBalanceColor(allTimeBalance),
        ...(isDraftMode && !isPercentageBased ? tentativeValue : {}),
      }}>
        {formatBalanceCurrency(allTimeBalance)}
      </div>
    </div>
  )
}

