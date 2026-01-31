/**
 * Stats row displayed in the balances section sticky header.
 * Shows different stats for category vs account view.
 */

import { formatStatsCurrency, formatSignedCurrencyAlways, getBalanceColor, getSpendColor, getAllocatedColor } from '../../../ui'
import { colors, tentativeValue } from '@styles/shared'

interface CategoryBalanceTotals {
  start: number
  allocated: number
  spent: number
  transfers: number
  adjustments: number
  end: number
}

interface AccountBalanceTotals {
  start: number
  income: number
  expenses: number
  transfers: number
  adjustments: number
  netChange: number
  end: number
}

interface CategoryStatsRowProps {
  isDraftMode: boolean
  isEditingAppliedAllocations: boolean
  /** On-budget account total (same shared logic as Avail / Settings) */
  onBudgetTotal?: number
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
  onBudgetTotal,
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
  // Allocated so that On-Budget − Allocated = Avail (pool for worksheet); Avail = what's not yet committed to this month
  const allocatedForEquation = onBudgetTotal !== undefined ? onBudgetTotal - availableNow : undefined

  if (isDraftMode || isEditingAppliedAllocations) {
    // Single equation: On-Budget − Allocated = Avail − Draft = Remaining (shared logic with Settings)
    return (
      <>
        <span style={{ fontWeight: 600, marginRight: '0.25rem' }}>Allocations Worksheet:</span>
        {onBudgetTotal !== undefined && allocatedForEquation !== undefined && currentDraftTotal !== undefined ? (
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.5rem', alignItems: 'center' }}>
            <span style={{ opacity: 0.6 }}>On-Budget: </span>
            <span style={{ color: getBalanceColor(onBudgetTotal), fontWeight: 600 }}>{formatStatsCurrency(onBudgetTotal)}</span>
            <span style={{ opacity: 0.6 }}>− Allocated: </span>
            <span style={{ fontWeight: 600 }}>{formatStatsCurrency(allocatedForEquation)}</span>
            <span style={{ opacity: 0.6 }}>= Avail: </span>
            <span style={{ color: getBalanceColor(availableNow), fontWeight: 600 }}>{formatStatsCurrency(availableNow)}</span>
            <span style={{ opacity: 0.6 }}>− Draft: </span>
            <span style={{ color: getAllocatedColor(displayDraftAmount), fontWeight: 600, ...tentativeValue }}>{formatStatsCurrency(displayDraftAmount)}</span>
            <span style={{ opacity: 0.6 }}>= Remaining: </span>
            <span style={{ color: getBalanceColor(availableAfterApply), fontWeight: 600, ...tentativeValue }}>{formatStatsCurrency(availableAfterApply)}</span>
            {isEditingAppliedAllocations && draftChangeAmount !== 0 && (
              <span style={{ fontSize: '0.85em', color: draftChangeAmount > 0 ? colors.warning : colors.success }}>
                ({formatSignedCurrencyAlways(draftChangeAmount)})
              </span>
            )}
          </span>
        ) : (
          <>
            <span style={{ opacity: 0.6 }}>Avail: </span>
            <span style={{ color: getBalanceColor(availableNow), fontWeight: 600 }}>{formatStatsCurrency(availableNow)}</span>
            <span style={{ opacity: 0.6 }}>− Draft: </span>
            <span style={{ color: getAllocatedColor(displayDraftAmount), fontWeight: 600, ...tentativeValue }}>{formatStatsCurrency(displayDraftAmount)}</span>
            <span style={{ opacity: 0.6 }}>= Remaining: </span>
            <span style={{ color: getBalanceColor(availableAfterApply), fontWeight: 600, ...tentativeValue }}>{formatStatsCurrency(availableAfterApply)}</span>
          </>
        )}
      </>
    )
  }

  // Finalized: Month Summary
  return (
    <>
      <span style={{ fontWeight: 600, marginRight: '0.25rem' }}>Month Summary:</span>
      <span style={{ opacity: 0.6 }}>Inc: </span>
      <span style={{ color: colors.success, fontWeight: 600 }}>{formatStatsCurrency(currentMonthIncome)}</span>
      <span style={{ opacity: 0.6 }}>Alloc: </span>
      <span style={{ color: getAllocatedColor(balanceTotals.allocated), fontWeight: 600 }}>{formatStatsCurrency(balanceTotals.allocated)}</span>
      <span style={{ opacity: 0.6 }}>Spent: </span>
      <span style={{ color: getSpendColor(balanceTotals.spent), fontWeight: 600 }}>{formatStatsCurrency(balanceTotals.spent)}</span>
      <span style={{ opacity: 0.6 }}>Net: </span>
      <span style={{ color: getBalanceColor(balanceTotals.allocated + balanceTotals.spent), fontWeight: 600 }}>{formatStatsCurrency(balanceTotals.allocated + balanceTotals.spent)}</span>
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
        <span style={{ color: getBalanceColor(totals.start), fontWeight: 600 }}>{formatStatsCurrency(totals.start)}</span>
      </span>
      <span>
        <span style={{ opacity: 0.6 }}>Inc: </span>
        <span style={{ color: colors.success, fontWeight: 600 }}>{formatStatsCurrency(totals.income)}</span>
      </span>
      <span>
        <span style={{ opacity: 0.6 }}>Exp: </span>
        <span style={{ color: getSpendColor(totals.expenses), fontWeight: 600 }}>{formatStatsCurrency(totals.expenses)}</span>
      </span>
      <span>
        <span style={{ opacity: 0.6 }}>End: </span>
        <span style={{ color: getBalanceColor(totals.end), fontWeight: 600 }}>{formatStatsCurrency(totals.end)}</span>
      </span>
    </>
  )
}

