/**
 * Category Grid Row Components
 *
 * Desktop grid row components for displaying category balances.
 * Used by MonthCategories for the main category listing.
 */

import type { Category, CategoryMonthBalance } from '@types'
import { formatBalanceCurrency, formatCurrency, formatSignedCurrency, formatSignedCurrencyAlways, getCategoryBalanceColor, getAllocatedColor, getSpendColor } from '../../ui'
import { colors, tentativeValue, groupTotalText, groupTotalRowBorder } from '@styles/shared'
import { MobileBalanceRow } from './CategoryBalanceRows'
import { CategoryGridRow } from './CategoryGridRow'
import { featureFlags } from '@constants'

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
  /** When false (viewing unfinalized month), all-time = last finalized end + this month's allocations only. */
  allocationsFinalized: boolean
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
  allocationsFinalized,
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

  // Group all-time: when viewing unfinalized month = last finalized end + this month's allocations only.
  const isViewingUnfinalizedMonth = !allocationsFinalized
  const groupAllTime = categories.reduce((sum, [catId, cat]) => {
    const storedBalance = cat.balance ?? 0
    let balance: number
    if (isViewingUnfinalizedMonth) {
      const thisMonthAllocation = isDraftMode ? getAllocationAmount(catId, cat) : (savedAllocations[catId] ?? 0)
      balance = storedBalance + thisMonthAllocation
    } else {
      balance = storedBalance
      if (isDraftMode) {
        const draftAllocation = getAllocationAmount(catId, cat)
        const savedAllocation = savedAllocations[catId] ?? 0
        balance += draftAllocation - savedAllocation
      }
    }
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
        let allTimeBalance: number
        if (isViewingUnfinalizedMonth) {
          const thisMonthAllocation = isDraftMode ? getAllocationAmount(catId, cat) : (bal.allocated ?? 0)
          allTimeBalance = storedBalance + thisMonthAllocation
        } else {
          allTimeBalance = storedBalance
          if (isDraftMode) {
            const draftAllocation = getAllocationAmount(catId, cat)
            const savedAllocation = savedAllocations[catId] ?? 0
            allTimeBalance += draftAllocation - savedAllocation
          }
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
