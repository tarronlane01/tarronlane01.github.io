/**
 * Stats row displayed in the balances section sticky header.
 * Shows different stats for category vs account view.
 */

import { formatCurrency, getBalanceColor, getSpendColor } from '../../../ui'
import { colors } from '../../../../styles/shared'

interface CategoryBalanceTotals {
  start: number
  allocated: number
  spent: number
  end: number
}

interface AccountBalanceTotals {
  start: number
  income: number
  expenses: number
  netChange: number
  end: number
}

interface CategoryStatsRowProps {
  isDraftMode: boolean
  isEditingAppliedAllocations: boolean
  availableNow: number
  currentMonthIncome: number
  balanceTotals: CategoryBalanceTotals
  draftChangeAmount: number
  availableAfterApply: number
  /** Debt-adjusted draft total (only counts allocations beyond debt reduction) */
  currentDraftTotal?: number
}

export function CategoryStatsRow({
  isDraftMode,
  isEditingAppliedAllocations,
  availableNow,
  currentMonthIncome,
  balanceTotals,
  draftChangeAmount,
  availableAfterApply,
  currentDraftTotal,
}: CategoryStatsRowProps) {
  // In draft mode, use debt-adjusted total if provided, otherwise fall back to raw total
  const displayDraftAmount = isDraftMode && currentDraftTotal !== undefined
    ? currentDraftTotal
    : balanceTotals.allocated
  return (
    <>
      {/* Title */}
      <span style={{
        fontWeight: 600,
        color: isDraftMode || isEditingAppliedAllocations ? colors.primary : 'inherit',
        marginRight: '0.25rem',
      }}>
        {isDraftMode || isEditingAppliedAllocations ? 'Allocations Worksheet:' : 'Month Summary:'}
      </span>

      <span>
        <span style={{ opacity: 0.6 }}>{isDraftMode ? 'Avail: ' : 'Inc: '}</span>
        {isDraftMode
          ? <span style={{ color: getBalanceColor(availableNow), fontWeight: 600 }}>{formatCurrency(availableNow)}</span>
          : <span style={{ color: colors.success, fontWeight: 600 }}>+{formatCurrency(currentMonthIncome)}</span>
        }
      </span>

      <span>
        {isDraftMode && <span style={{ opacity: 0.6 }}>− </span>}
        <span style={{ opacity: 0.6 }}>{isDraftMode ? 'Draft: ' : 'Alloc: '}</span>
        <span style={{ color: isDraftMode ? colors.primary : colors.success, fontWeight: 600 }}>
          {isDraftMode ? '' : '+'}{formatCurrency(isDraftMode ? displayDraftAmount : balanceTotals.allocated)}
        </span>
        {isEditingAppliedAllocations && draftChangeAmount !== 0 && (
          <span style={{ fontSize: '0.85em', color: draftChangeAmount > 0 ? colors.warning : colors.success, marginLeft: '0.25rem' }}>
            ({draftChangeAmount > 0 ? '+' : '−'}{formatCurrency(Math.abs(draftChangeAmount))})
          </span>
        )}
      </span>

      {!isDraftMode && (
        <span>
          <span style={{ opacity: 0.6 }}>Spent: </span>
          <span style={{ color: getSpendColor(balanceTotals.spent), fontWeight: 600 }}>-{formatCurrency(balanceTotals.spent)}</span>
        </span>
      )}

      <span>
        {isDraftMode && <span style={{ opacity: 0.6 }}>= </span>}
        <span style={{ opacity: 0.6 }}>{isDraftMode ? 'Remaining: ' : 'Net: '}</span>
        {isDraftMode
          ? <span style={{ color: getBalanceColor(availableAfterApply), fontWeight: 600 }}>{formatCurrency(availableAfterApply)}</span>
          : <span style={{ color: getBalanceColor(balanceTotals.allocated - balanceTotals.spent), fontWeight: 600 }}>{formatCurrency(balanceTotals.allocated - balanceTotals.spent)}</span>
        }
      </span>
    </>
  )
}

interface AccountStatsRowProps {
  totals: AccountBalanceTotals
}

export function AccountStatsRow({ totals }: AccountStatsRowProps) {
  return (
    <>
      <span>
        <span style={{ opacity: 0.6 }}>Start: </span>
        <span style={{ color: getBalanceColor(totals.start), fontWeight: 600 }}>{formatCurrency(totals.start)}</span>
      </span>
      <span>
        <span style={{ opacity: 0.6 }}>Inc: </span>
        <span style={{ color: colors.success, fontWeight: 600 }}>+{formatCurrency(totals.income)}</span>
      </span>
      <span>
        <span style={{ opacity: 0.6 }}>Exp: </span>
        <span style={{ color: getSpendColor(totals.expenses), fontWeight: 600 }}>-{formatCurrency(totals.expenses)}</span>
      </span>
      <span>
        <span style={{ opacity: 0.6 }}>End: </span>
        <span style={{ color: getBalanceColor(totals.end), fontWeight: 600 }}>{formatCurrency(totals.end)}</span>
      </span>
    </>
  )
}

