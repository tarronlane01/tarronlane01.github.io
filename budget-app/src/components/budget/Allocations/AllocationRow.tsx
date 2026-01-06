import type { Category } from '@types'
import { formatCurrency, DebtBorder } from '../../ui'
import { colors } from '@styles/shared'

interface AllocationRowProps {
  category: Category
  value: string
  onChange: (value: string) => void
  previousMonthIncome: number
  disabled?: boolean
  readOnly?: boolean
  index?: number
  /** The category's all-time balance (used for debt detection) */
  allTimeBalance?: number
}

export function AllocationRow({ category, value, onChange, previousMonthIncome, disabled, readOnly, index = 0, allTimeBalance }: AllocationRowProps) {
  const isPercentageBased = category.default_monthly_type === 'percentage' && category.default_monthly_amount !== undefined && category.default_monthly_amount > 0

  // For percentage-based categories, calculate the amount
  const calculatedAmount = isPercentageBased
    ? (category.default_monthly_amount! / 100) * previousMonthIncome
    : 0

  // Display value - for percentage-based, show calculated; otherwise show manual entry
  const displayValue = isPercentageBased
    ? calculatedAmount.toFixed(2)
    : value

  // The actual amount to display
  const amount = isPercentageBased ? calculatedAmount : (parseFloat(value) || 0)

  // Calculate the suggested amount display (only for fixed-amount categories)
  let suggestedDisplay: string | null = null
  if (!isPercentageBased && category.default_monthly_amount !== undefined && category.default_monthly_amount > 0) {
    suggestedDisplay = formatCurrency(category.default_monthly_amount)
  }

  // Check if this category has debt (negative all-time balance)
  const categoryBalance = allTimeBalance ?? (category.balance ?? 0)
  const hasDebt = categoryBalance < 0
  const debtAmount = hasDebt ? Math.abs(categoryBalance) : 0

  // Calculate how much of the allocation goes to debt vs actual balance
  const debtReductionAmount = hasDebt ? Math.min(amount, debtAmount) : 0
  const actualBalanceAmount = hasDebt ? Math.max(0, amount - debtAmount) : amount
  const showBreakdown = hasDebt && amount > 0 && actualBalanceAmount > 0

  // Condensed read-only view when finalized OR for percentage-based categories (always show equation style)
  if (readOnly || isPercentageBased) {
    const isEven = index % 2 === 0
    const content = (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          padding: '0.5rem 0.5rem',
          maxWidth: '100%',
          boxSizing: 'border-box',
          background: isEven ? 'transparent' : 'color-mix(in srgb, currentColor 3%, transparent)',
          borderBottom: hasDebt ? 'none' : '1px solid color-mix(in srgb, currentColor 8%, transparent)',
        }}
      >
        <span style={{
          flex: '1 1 auto',
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: '0.9rem',
          opacity: 0.9,
        }}>
          {category.name}
        </span>
        <span style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
        }}>
          {isPercentageBased && (
            <span style={{
              fontSize: '0.75rem',
              opacity: 0.5,
              fontWeight: 400,
            }}>
              {formatCurrency(previousMonthIncome)} × {category.default_monthly_amount}% =
            </span>
          )}
          <span style={{
            fontWeight: 500,
            color: colors.success,
            fontSize: '0.9rem',
          }}>
            {formatCurrency(amount)}
          </span>
        </span>
      </div>
    )

    if (hasDebt) {
      return <DebtBorder style={{ marginBottom: '0.5rem' }}>{content}</DebtBorder>
    }
    return content
  }

  const content = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        padding: '0.6rem 0.75rem',
        background: 'color-mix(in srgb, currentColor 5%, transparent)',
        borderRadius: '8px',
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden' }}>
        <span style={{ fontWeight: 500, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{category.name}</span>
        {suggestedDisplay && (
          <span style={{
            fontSize: '0.7rem',
            opacity: 0.5,
            display: 'block',
            marginTop: '0.15rem',
          }}>
            Suggested: {suggestedDisplay}
          </span>
        )}
        {hasDebt && (
          <span style={{
            fontSize: '0.7rem',
            color: colors.debt,
            display: 'block',
            marginTop: '0.15rem',
          }}>
            Debt: {formatCurrency(debtAmount)}
          </span>
        )}
      </div>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{ width: '110px' }}>
          <input
            type="text"
            inputMode="decimal"
            value={displayValue ? `$${displayValue}` : ''}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^\d.]/g, '')
              onChange(raw)
            }}
            placeholder="$0.00"
            disabled={disabled}
            style={{
              width: '100%',
              padding: '0.5rem 0.6rem',
              borderRadius: '6px',
              border: '1px solid color-mix(in srgb, currentColor 20%, transparent)',
              background: 'color-mix(in srgb, currentColor 5%, transparent)',
              fontSize: '0.9rem',
              color: 'inherit',
              boxSizing: 'border-box',
              opacity: disabled ? 0.6 : 1,
              cursor: disabled ? 'not-allowed' : 'text',
            }}
          />
        </div>
        {/* Breakdown showing debt reduction vs actual balance */}
        {showBreakdown && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            fontSize: '0.7rem',
            lineHeight: 1.3,
          }}>
            <span style={{ color: colors.debt }}>
              {formatCurrency(debtReductionAmount)} → debt
            </span>
            <span style={{ color: colors.success }}>
              {formatCurrency(actualBalanceAmount)} → balance
            </span>
          </div>
        )}
        {/* Show debt reduction amount when full allocation goes to debt */}
        {hasDebt && amount > 0 && !showBreakdown && (
          <span style={{
            fontSize: '0.7rem',
            color: colors.debt,
          }}>
            {formatCurrency(debtReductionAmount)} → debt
          </span>
        )}
      </div>
    </div>
  )

  if (hasDebt) {
    return <DebtBorder>{content}</DebtBorder>
  }

  return content
}

