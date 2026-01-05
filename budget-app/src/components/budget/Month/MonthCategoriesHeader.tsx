/**
 * MonthCategoriesHeader - Sticky header content for MonthCategories grid
 */

import { formatCurrency, formatBalanceCurrency, formatSignedCurrency, formatSignedCurrencyAlways, getCategoryBalanceColor, getAllocatedColor, getSpendColor } from '../../ui'
import { tentativeValue } from '@styles/shared'
import { CategoryStatsRow, BalancesActionButtons } from './MonthBalances'

interface GrandTotalsRowProps {
  isDraftMode: boolean
  allocationsFinalized: boolean
  balanceTotals: { start: number; allocated: number; spent: number; end: number }
  grandAllTime: number
  onSave: () => void
  onApply: () => void
  onEdit: () => void
  onCancel: () => void
  onDelete: () => void
}

export function GrandTotalsRow({
  isDraftMode,
  allocationsFinalized,
  balanceTotals,
  grandAllTime,
  onSave,
  onApply,
  onEdit,
  onCancel,
  onDelete,
}: GrandTotalsRowProps) {
  const grandTotalsCellStyle: React.CSSProperties = {
    paddingTop: '0.6rem',
    paddingBottom: '0.6rem',
    paddingLeft: '0.5rem',
    paddingRight: '0.5rem',
    borderTop: '2px solid rgba(255,255,255,0.3)',
    borderBottom: '2px solid rgba(255,255,255,0.3)',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.9rem',
  }
  // Net change = allocated + spent (spent is negative for money out)
  const netChange = balanceTotals.allocated + balanceTotals.spent

  return (
    <>
      <div style={{ ...grandTotalsCellStyle, gap: '0.75rem' }}>
        Grand Totals
        {/* Edit button inline - only show in finalized mode */}
        {!isDraftMode && (
          <BalancesActionButtons
            isDraftMode={false}
            isEditingAppliedAllocations={false}
            allocationsFinalized={allocationsFinalized}
            onSave={onSave}
            onApply={onApply}
            onEdit={onEdit}
            onCancel={onCancel}
            onDelete={onDelete}
          />
        )}
      </div>
      <div style={{ ...grandTotalsCellStyle, justifyContent: 'flex-end', color: getCategoryBalanceColor(balanceTotals.start) }}>
        {formatBalanceCurrency(balanceTotals.start)}
      </div>
      <div style={{ ...grandTotalsCellStyle, justifyContent: isDraftMode ? 'center' : 'flex-end', color: getAllocatedColor(balanceTotals.allocated) }}>
        +{formatCurrency(balanceTotals.allocated)}
      </div>
      <div style={{ ...grandTotalsCellStyle, justifyContent: 'flex-end', color: getSpendColor(balanceTotals.spent) }}>
        {formatSignedCurrency(balanceTotals.spent)}
      </div>
      <div style={{ ...grandTotalsCellStyle, justifyContent: 'flex-end', color: getCategoryBalanceColor(netChange), ...(isDraftMode ? tentativeValue : {}) }}>
        {formatSignedCurrencyAlways(netChange)}
      </div>
      <div style={{
        ...grandTotalsCellStyle,
        justifyContent: 'flex-end',
        color: getCategoryBalanceColor(balanceTotals.end),
        paddingRight: '1rem',
        borderRight: '2px solid rgba(128, 128, 128, 0.4)',
        ...(isDraftMode ? tentativeValue : {}),
      }}>
        {formatBalanceCurrency(balanceTotals.end)}
      </div>
      <div style={{ ...grandTotalsCellStyle, justifyContent: 'flex-end', color: getCategoryBalanceColor(grandAllTime), ...(isDraftMode ? tentativeValue : {}) }}>
        {formatBalanceCurrency(grandAllTime)}
      </div>
    </>
  )
}

interface MobileGrandTotalsProps {
  allocationsFinalized: boolean
  availableNow: number
  currentMonthIncome: number
  balanceTotals: { start: number; allocated: number; spent: number; end: number }
  draftChangeAmount: number
  availableAfterApply: number
  currentDraftTotal: number
  onSave: () => void
  onApply: () => void
  onEdit: () => void
  onCancel: () => void
  onDelete: () => void
}

export function MobileGrandTotals({
  allocationsFinalized,
  availableNow,
  currentMonthIncome,
  balanceTotals,
  draftChangeAmount,
  availableAfterApply,
  currentDraftTotal,
  onSave,
  onApply,
  onEdit,
  onCancel,
  onDelete,
}: MobileGrandTotalsProps) {
  return (
    <div style={{
      gridColumn: '1 / -1',
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: '0.5rem 1rem',
      fontSize: '0.85rem',
      paddingTop: '0.5rem',
      paddingBottom: '0.5rem',
      borderTop: '2px solid rgba(255,255,255,0.3)',
      borderBottom: '2px solid rgba(255,255,255,0.3)',
    }}>
      <span style={{ fontWeight: 600 }}>Grand Totals:</span>
      <CategoryStatsRow
        isDraftMode={false}
        isEditingAppliedAllocations={false}
        availableNow={availableNow}
        currentMonthIncome={currentMonthIncome}
        balanceTotals={balanceTotals}
        draftChangeAmount={draftChangeAmount}
        availableAfterApply={availableAfterApply}
        currentDraftTotal={currentDraftTotal}
      />
      <BalancesActionButtons
        isDraftMode={false}
        isEditingAppliedAllocations={false}
        allocationsFinalized={allocationsFinalized}
        onSave={onSave}
        onApply={onApply}
        onEdit={onEdit}
        onCancel={onCancel}
        onDelete={onDelete}
      />
    </div>
  )
}

