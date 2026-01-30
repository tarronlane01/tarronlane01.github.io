/**
 * Category Grid Row Components
 *
 * Desktop grid row components for displaying category balances.
 * Used by MonthCategories for the main category listing.
 */

import type { Category, CategoryMonthBalance } from '@types'
import { formatCurrency, formatBalanceCurrency, formatSignedCurrency, formatSignedCurrencyAlways, getCategoryBalanceColor, getAllocatedColor, getSpendColor } from '../../ui'
import { colors, tentativeValue, groupTotalText, groupTotalRowBorder } from '@styles/shared'
import { MobileBalanceRow } from './CategoryBalanceRows'
import { featureFlags } from '@constants'

// Helper color function for transfers/adjustments - positive=green, negative=red, zero=grey
function getTransferColor(value: number): string {
  if (value === 0) return colors.zero
  return value > 0 ? colors.success : colors.error
}

// =============================================================================
// CATEGORY GROUP ROWS - renders as grid items using display: contents
// =============================================================================

export interface CategoryGroupRowsProps {
  name: string
  categories: [string, Category][]
  groupTotals: { start: number; allocated: number; spent: number; transfers: number; adjustments: number; end: number }
  getCategoryBalance: (catId: string) => CategoryMonthBalance | undefined
  localAllocations: Record<string, string>
  savedAllocations: Record<string, number>
  previousMonthIncome: number
  isDraftMode: boolean
  onAllocationChange: (categoryId: string, value: string) => void
  isMobile: boolean
  isUngrouped?: boolean
  isFirstGroup?: boolean // Remove top margin for first group to eliminate gap after Grand Totals
  getAllocationAmount: (catId: string, cat: Category) => number
  gridTemplateColumns: string // Grid columns from parent
}

export function CategoryGroupRows({
  name,
  categories,
  groupTotals,
  getCategoryBalance,
  localAllocations,
  savedAllocations,
  previousMonthIncome,
  isDraftMode,
  onAllocationChange,
  isMobile,
  isUngrouped,
  isFirstGroup = false, // Remove top margin for first group to eliminate gap after Grand Totals
  getAllocationAmount,
  gridTemplateColumns, // Passed to CategoryGridRow
}: CategoryGroupRowsProps) {
  // Group header cell style - matches accounts page
  const groupHeaderCellStyle: React.CSSProperties = {
    paddingTop: '0.6rem',
    paddingBottom: '0.6rem',
    paddingLeft: '0.5rem',
    paddingRight: '0.5rem',
    marginTop: isFirstGroup ? 0 : '1.25rem', // Remove top margin for first group to eliminate gap after Grand Totals
    borderTop: '1px solid var(--border-medium)',
    borderBottom: groupTotalRowBorder,
    background: 'var(--row-alt-bg)',
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.9rem',
    fontWeight: 600,
  }

  // Net change = allocated + spent + transfers + adjustments (spent is negative for money out)
  const groupNetChange = groupTotals.allocated + groupTotals.spent + groupTotals.transfers + groupTotals.adjustments

  // Calculate group all-time total (sum of positive category balances only)
  // This matches the settings page "Allocated" calculation: sum of all positive category.balance values
  const groupAllTime = categories.reduce((sum, [catId, cat]) => {
    const storedBalance = cat.balance ?? 0
    let balance = storedBalance
    if (isDraftMode) {
      const draftAllocation = getAllocationAmount(catId, cat)
      const savedAllocation = savedAllocations[catId] ?? 0
      const allocationChange = draftAllocation - savedAllocation
      balance = storedBalance + allocationChange
    }
    // Only sum positive balances to match settings page "Allocated" calculation
    return sum + Math.max(0, balance)
  }, 0)

  return (
    <div style={{ display: 'contents' }}>
      {/* Desktop: Group header row with totals in each column */}
      {!isMobile && (
        <>
          <div style={{ ...groupHeaderCellStyle, paddingLeft: '0.5rem', opacity: isUngrouped ? 0.7 : 1 }}>
            <span>{name}</span>
            <span style={{ marginLeft: '0.5rem', opacity: 0.5, fontWeight: 400 }}>({categories.length})</span>
          </div>
          <div style={{ ...groupHeaderCellStyle, justifyContent: 'flex-end', color: getCategoryBalanceColor(groupTotals.start) }}>
            {featureFlags.showGroupTotals && <span style={groupTotalText}>{formatBalanceCurrency(groupTotals.start)}</span>}
          </div>
          <div style={{ ...groupHeaderCellStyle, justifyContent: isDraftMode ? 'center' : 'flex-end', color: getAllocatedColor(groupTotals.allocated) }}>
            {featureFlags.showGroupTotals && <span style={{ ...groupTotalText, ...(isDraftMode ? tentativeValue : {}) }}>+{formatCurrency(groupTotals.allocated)}</span>}
          </div>
          <div style={{ ...groupHeaderCellStyle, justifyContent: 'flex-end', color: getSpendColor(groupTotals.spent) }}>
            {featureFlags.showGroupTotals && <span style={groupTotalText}>{formatSignedCurrency(groupTotals.spent)}</span>}
          </div>
          <div style={{ ...groupHeaderCellStyle, justifyContent: 'flex-end', color: getTransferColor(groupTotals.transfers) }}>
            {featureFlags.showGroupTotals && <span style={groupTotalText}>{formatSignedCurrencyAlways(groupTotals.transfers)}</span>}
          </div>
          <div style={{ ...groupHeaderCellStyle, justifyContent: 'flex-end', color: getTransferColor(groupTotals.adjustments) }}>
            {featureFlags.showGroupTotals && <span style={groupTotalText}>{formatSignedCurrencyAlways(groupTotals.adjustments)}</span>}
          </div>
          <div style={{ ...groupHeaderCellStyle, justifyContent: 'flex-end', color: getCategoryBalanceColor(groupNetChange) }}>
            {featureFlags.showGroupTotals && <span style={{ ...groupTotalText, ...(isDraftMode ? tentativeValue : {}) }}>{formatSignedCurrencyAlways(groupNetChange)}</span>}
          </div>
          <div style={{
            ...groupHeaderCellStyle,
            justifyContent: 'flex-end',
            color: getCategoryBalanceColor(groupTotals.end),
            paddingRight: '1rem',
            borderRight: '2px solid var(--border-muted)',
          }}>
            {featureFlags.showGroupTotals && <span style={{ ...groupTotalText, ...(isDraftMode ? tentativeValue : {}) }}>{formatBalanceCurrency(groupTotals.end)}</span>}
          </div>
          <div style={{ ...groupHeaderCellStyle, justifyContent: 'flex-end', color: getCategoryBalanceColor(groupAllTime) }}>
            {featureFlags.showGroupTotals && <span style={{ ...groupTotalText, ...(isDraftMode ? tentativeValue : {}) }}>{formatBalanceCurrency(groupAllTime)}</span>}
          </div>
        </>
      )}

      {/* Mobile finalized mode: Simplified group header */}
      {!isDraftMode && isMobile && (
        <div style={{
          gridColumn: '1 / -1',
          paddingTop: '0.6rem',
          paddingBottom: '0.6rem',
          paddingLeft: '0.5rem',
          paddingRight: '0.5rem',
          marginTop: isFirstGroup ? 0 : '1.25rem', // Remove top margin for first group to eliminate gap after Grand Totals
          borderTop: '1px solid var(--border-medium)',
          borderBottom: groupTotalRowBorder,
          background: 'var(--row-alt-bg)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontWeight: 600, opacity: isUngrouped ? 0.7 : 1 }}>
            {name}
            <span style={{ marginLeft: '0.5rem', opacity: 0.5, fontWeight: 400 }}>({categories.length})</span>
          </span>
          {featureFlags.showGroupTotals && (
            <span style={{ ...groupTotalText, color: getCategoryBalanceColor(groupTotals.end) }}>
              {formatBalanceCurrency(groupTotals.end)}
            </span>
          )}
        </div>
      )}

      {/* Category rows */}
      {categories.map(([catId, cat], index) => {
        const bal = getCategoryBalance(catId)
        if (!bal) return null

        const storedBalance = cat.balance ?? 0
        let allTimeBalance = storedBalance
        if (isDraftMode) {
          const draftAllocation = getAllocationAmount(catId, cat)
          const savedAllocation = savedAllocations[catId] ?? 0
          const allocationChange = draftAllocation - savedAllocation
          allTimeBalance = storedBalance + allocationChange
        }

        if (isMobile) {
          return (
            <div key={catId} style={{ gridColumn: '1 / -1' }}>
              <MobileBalanceRow
                category={cat}
                balance={bal}
                localAllocation={localAllocations[catId] || ''}
                previousMonthIncome={previousMonthIncome}
                isDraftMode={isDraftMode}
                onAllocationChange={(val: string) => onAllocationChange(catId, val)}
                projectedAllTime={allTimeBalance}
              />
            </div>
          )
        }

        return (
          <CategoryGridRow
            key={catId}
            category={cat}
            balance={bal}
            localAllocation={localAllocations[catId] || ''}
            previousMonthIncome={previousMonthIncome}
            isDraftMode={isDraftMode}
            onAllocationChange={(val) => onAllocationChange(catId, val)}
            allTimeBalance={allTimeBalance}
            isEvenRow={index % 2 === 0}
            gridTemplateColumns={gridTemplateColumns}
          />
        )
      })}
    </div>
  )
}

// =============================================================================
// CATEGORY GRID ROW - renders directly as grid items (display: contents)
// =============================================================================

interface CategoryGridRowProps {
  category: Category
  balance: CategoryMonthBalance
  localAllocation: string
  previousMonthIncome: number
  isDraftMode: boolean
  onAllocationChange: (value: string) => void
  allTimeBalance: number
  isEvenRow: boolean
  gridTemplateColumns: string // Grid columns from parent
}

function CategoryGridRow({
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

  // Keep normal row striping - don't shade based on debt
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

  // Net change = allocated + spent + transfers + adjustments (spent is negative for money out)
  const netChange = balance.allocated + balance.spent + balance.transfers + balance.adjustments

  return (
    <div style={{
      gridColumn: '1 / -1',
      background: rowBg,
      display: 'grid',
      gridTemplateColumns: gridTemplateColumns,
    }}>
      {/* Category name */}
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

      {/* Start balance */}
      <div style={{ ...cellStyle, justifyContent: 'flex-end', color: getCategoryBalanceColor(balance.start_balance) }}>
        {formatBalanceCurrency(balance.start_balance)}
      </div>

      {/* Allocated - input in draft mode, display in finalized mode */}
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

      {/* Spent */}
      <div style={{ ...cellStyle, justifyContent: 'flex-end', color: getSpendColor(balance.spent) }}>
        {formatSignedCurrency(balance.spent)}
      </div>

      {/* Transfers */}
      <div style={{ ...cellStyle, justifyContent: 'flex-end', color: getTransferColor(balance.transfers) }}>
        {formatSignedCurrencyAlways(balance.transfers)}
      </div>

      {/* Adjustments */}
      <div style={{ ...cellStyle, justifyContent: 'flex-end', color: getTransferColor(balance.adjustments) }}>
        {formatSignedCurrencyAlways(balance.adjustments)}
      </div>

      {/* Net Change */}
      <div style={{ ...cellStyle, justifyContent: 'flex-end', color: getCategoryBalanceColor(netChange), ...(isDraftMode && !isPercentageBased ? tentativeValue : {}) }}>
        {formatSignedCurrencyAlways(netChange)}
      </div>

      {/* End Balance (with border) */}
      <div style={{ ...cellStyle, justifyContent: 'flex-end', fontWeight: 600, color: getCategoryBalanceColor(balance.end_balance), paddingRight: '1rem', borderRight: '2px solid var(--border-muted)', ...(isDraftMode && !isPercentageBased ? tentativeValue : {}) }}>
        {formatBalanceCurrency(balance.end_balance)}
      </div>

      {/* All-Time Balance */}
      <div style={{ ...cellStyle, justifyContent: 'flex-end', color: getCategoryBalanceColor(allTimeBalance), ...(isDraftMode && !isPercentageBased ? tentativeValue : {}) }}>
        {formatBalanceCurrency(allTimeBalance)}
      </div>
    </div>
  )
}

