import type { Category } from '../../../types/budget'
import { formatCurrency } from '../../ui'
import { colors } from '../../../styles/shared'

interface AllocationRowProps {
  category: Category
  value: string
  onChange: (value: string) => void
  previousMonthIncome: number
  disabled?: boolean
}

export function AllocationRow({ category, value, onChange, previousMonthIncome, disabled }: AllocationRowProps) {
  const isPercentageBased = category.default_monthly_type === 'percentage' && category.default_monthly_amount !== undefined && category.default_monthly_amount > 0

  // For percentage-based categories, calculate the amount
  const calculatedAmount = isPercentageBased
    ? (category.default_monthly_amount! / 100) * previousMonthIncome
    : 0

  // Display value - for percentage-based, show calculated; otherwise show manual entry
  const displayValue = isPercentageBased
    ? calculatedAmount.toFixed(2)
    : value

  // Calculate the suggested amount display (only for fixed-amount categories)
  let suggestedDisplay: string | null = null
  if (!isPercentageBased && category.default_monthly_amount !== undefined && category.default_monthly_amount > 0) {
    suggestedDisplay = formatCurrency(category.default_monthly_amount)
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        padding: '0.6rem 0.75rem',
        background: isPercentageBased
          ? 'color-mix(in srgb, currentColor 3%, transparent)'
          : 'color-mix(in srgb, currentColor 5%, transparent)',
        borderRadius: '8px',
        maxWidth: '100%',
        boxSizing: 'border-box',
        opacity: isPercentageBased ? 0.8 : 1,
      }}
    >
      <div style={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden' }}>
        <span style={{ fontWeight: 500, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{category.name}</span>
        {isPercentageBased ? (
          <span style={{
            fontSize: '0.7rem',
            opacity: 0.6,
            display: 'block',
            marginTop: '0.15rem',
            color: colors.primary,
          }}>
            {category.default_monthly_amount}% of prev month income
          </span>
        ) : suggestedDisplay && (
          <span style={{
            fontSize: '0.7rem',
            opacity: 0.5,
            display: 'block',
            marginTop: '0.15rem',
          }}>
            Suggested: {suggestedDisplay}
          </span>
        )}
      </div>
      <div style={{ flexShrink: 0, width: '110px' }}>
        {isPercentageBased ? (
          // Read-only display for percentage-based
          <div
            style={{
              width: '100%',
              padding: '0.5rem 0.6rem',
              borderRadius: '6px',
              border: '1px dashed color-mix(in srgb, currentColor 15%, transparent)',
              background: 'color-mix(in srgb, currentColor 3%, transparent)',
              fontSize: '0.9rem',
              color: 'inherit',
              boxSizing: 'border-box',
              textAlign: 'right',
              opacity: 0.9,
            }}
            title="Auto-calculated from previous month's income"
          >
            {formatCurrency(calculatedAmount)}
          </div>
        ) : (
          // Editable input for manual categories
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
        )}
      </div>
    </div>
  )
}

