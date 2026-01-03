/**
 * MonthCategories - Category balances and allocations view
 *
 * Displays category balances for the current month with allocation editing.
 * Uses CSS Grid with sticky subgrid header for column alignment.
 */

import { useMemo, useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useBudget } from '../../../contexts/budget_context'
import { useBudgetData, useAllocationsPage, useBudgetMonth } from '../../../hooks'
import { useIsMobile } from '../../../hooks/useIsMobile'
import type { CategoryMonthBalance } from '@types'
import { ErrorAlert, formatCurrency, formatBalanceCurrency, formatSignedCurrency, formatSignedCurrencyAlways, getCategoryBalanceColor, getAllocatedColor, getSpendColor } from '../../ui'
import { colors } from '../../../styles/shared'
import { DeleteAllocationsModal } from '../Allocations'
import { CategoryStatsRow, BalancesActionButtons } from './MonthBalances'
import { CategoryGroupRows } from './CategoryGridRows'
import { triggerRecalculation, type RecalculationProgress } from '../../../data/recalculation'
import { queryClient, queryKeys } from '../../../data/queryClient'
import { getYearMonthOrdinal } from '@utils'
import { LoadingOverlay, ProgressBar, StatItem, PercentLabel } from '../../app/LoadingOverlay'
import {
  calculateCategoriesByGroup,
  calculateLiveCategoryBalances,
  calculateBalanceTotals,
} from '@calculations'

// Column header style for the grid
const columnHeaderStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  opacity: 0.6,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  paddingTop: '0.5rem',
  paddingBottom: '0.5rem',
  borderBottom: '2px solid rgba(255,255,255,0.2)',
}

export function MonthCategories() {
  const { selectedBudgetId, currentUserId, currentYear, currentMonthNumber } = useBudget()
  const { categories, categoryGroups, monthMap } = useBudgetData(selectedBudgetId, currentUserId)
  const { month: currentMonth } = useBudgetMonth(selectedBudgetId, currentYear, currentMonthNumber)
  const isMobile = useIsMobile()

  // Check if current month needs recalculation from budget's month_map
  const currentMonthOrdinal = getYearMonthOrdinal(currentYear, currentMonthNumber)
  const monthNeedsRecalc = monthMap[currentMonthOrdinal]?.needs_recalculation === true

  // Track recalculation in progress and progress state
  const recalcInProgressRef = useRef(false)
  const [recalcProgress, setRecalcProgress] = useState<RecalculationProgress | null>(null)

  // Trigger recalculation when viewing and month needs it
  useEffect(() => {
    if (!selectedBudgetId || !currentMonth) return
    if (!monthNeedsRecalc || recalcInProgressRef.current) return

    recalcInProgressRef.current = true
    const triggeringMonthOrdinal = `${currentYear}${String(currentMonthNumber).padStart(2, '0')}`

    // Start recalculation - onProgress callback will set initial state
    triggerRecalculation(selectedBudgetId, {
      triggeringMonthOrdinal,
      onProgress: (progress) => setRecalcProgress(progress),
    })
      .then(() => {
        // Refresh month data after recalculation
        queryClient.invalidateQueries({ queryKey: queryKeys.month(selectedBudgetId, currentYear, currentMonthNumber) })
      })
      .catch((err) => {
        console.error('[MonthCategories] Recalculation failed:', err)
      })
      .finally(() => {
        recalcInProgressRef.current = false
        setRecalcProgress(null)
      })
  }, [selectedBudgetId, monthNeedsRecalc, currentMonth, currentYear, currentMonthNumber])

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const {
    localAllocations,
    isEditingAppliedAllocations,
    error,
    availableNow,
    currentDraftTotal,
    draftChangeAmount,
    availableAfterApply,
    previousMonthIncome,
    currentMonthIncome,
    allocationsFinalized,
    getAllocationAmount,
    handleAllocationChange,
    resetAllocationsToSaved,
    handleSaveAllocations,
    handleFinalizeAllocations,
    setIsEditingAppliedAllocations,
    setError,
  } = useAllocationsPage()

  // Organize categories by group
  const sortedCategoryGroups = [...categoryGroups].sort((a, b) => a.sort_order - b.sort_order)
  const categoriesByGroup = useMemo(
    () => calculateCategoriesByGroup(categories),
    [categories]
  )

  // Determine if we're in draft mode (not finalized, or editing applied allocations)
  const isDraftMode = !allocationsFinalized || isEditingAppliedAllocations

  // Calculate live category balances that update as allocations change
  const liveCategoryBalances = useMemo(
    () => calculateLiveCategoryBalances(currentMonth, categories, isDraftMode, allocationsFinalized, getAllocationAmount),
    [currentMonth, categories, isDraftMode, allocationsFinalized, getAllocationAmount]
  )

  // Get balance for a category
  const getCategoryBalance = (catId: string): CategoryMonthBalance | undefined => {
    return liveCategoryBalances[catId]
  }

  // Calculate balance totals
  const balanceTotals = useMemo(
    () => calculateBalanceTotals(liveCategoryBalances),
    [liveCategoryBalances]
  )

  // Build map of saved allocations from currentMonth for calculating all-time changes
  const savedAllocations = useMemo(() => {
    const map: Record<string, number> = {}
    if (currentMonth?.category_balances) {
      for (const cb of currentMonth.category_balances) {
        map[cb.category_id] = cb.allocated
      }
    }
    return map
  }, [currentMonth])

  // Calculate grand all-time balance
  // In draft mode: cat.balance + (draft_allocation - saved_allocation)
  //   This shows the stored all-time adjusted by the change in allocations
  // In finalized mode: just sum cat.balance values
  const grandAllTime = useMemo(() => {
    return Object.entries(categories).reduce((sum, [catId, cat]) => {
      const storedBalance = cat.balance ?? 0
      if (isDraftMode) {
        const draftAllocation = getAllocationAmount(catId, cat)
        const savedAllocation = savedAllocations[catId] ?? 0
        const allocationChange = draftAllocation - savedAllocation
        return sum + storedBalance + allocationChange
      }
      return sum + storedBalance
    }, 0)
  }, [categories, isDraftMode, getAllocationAmount, savedAllocations])

  // Get phase label for progress overlay
  const getRecalcPhaseLabel = () => {
    if (!recalcProgress) return ''
    switch (recalcProgress.phase) {
      case 'reading-budget': return 'Reading budget data...'
      case 'fetching-months': return 'Fetching months...'
      case 'recalculating':
        return recalcProgress.currentMonth ? `Recalculating ${recalcProgress.currentMonth}...` : 'Recalculating...'
      case 'saving': return 'Saving results...'
      case 'complete': return 'Recalculation complete!'
      default: return 'Recalculating balances...'
    }
  }

  return (
    <>
      {/* Recalculation Progress Overlay */}
      {recalcProgress && (
        <LoadingOverlay message={getRecalcPhaseLabel()} spinnerColor="#22c55e">
          <ProgressBar
            percent={recalcProgress.percentComplete}
            gradient="linear-gradient(90deg, #22c55e, #10b981)"
          />
          <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {(recalcProgress.totalMonthsToFetch ?? 0) > 0 && (
              <StatItem
                value={`${recalcProgress.monthsFetched || 0}/${recalcProgress.totalMonthsToFetch}`}
                label="Months Loaded"
                color={recalcProgress.phase === 'fetching-months' ? '#22c55e' : '#6b7280'}
              />
            )}
            {(recalcProgress.totalMonths ?? 0) > 0 && (
              <StatItem
                value={`${recalcProgress.monthsProcessed}/${recalcProgress.totalMonths}`}
                label="Months Recalculated"
                color={recalcProgress.phase === 'recalculating' ? '#22c55e' : '#6b7280'}
              />
            )}
          </div>
          <PercentLabel percent={recalcProgress.percentComplete} />
        </LoadingOverlay>
      )}

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {/* CSS Grid container - header and content share the same grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile
          ? '1fr' // Mobile: single column, content handles its own layout
          : isDraftMode
            ? '2fr 1fr 200px 1fr 1fr 1fr 120px' // Draft: Name, Start, Allocated, Spent, Net Change, End, All-Time
            : '2fr 1fr 1fr 1fr 1fr 1fr 120px',  // Finalized: Name, Start, Allocated, Spent, Net Change, End, All-Time
      }}>
        {/* Sticky wrapper using subgrid */}
        <div style={{
          gridColumn: '1 / -1',
          position: 'sticky',
          top: 0,
          zIndex: 49,
          backgroundColor: '#242424',
          display: isMobile ? 'block' : 'grid',
          gridTemplateColumns: isMobile ? undefined : 'subgrid',
        }}>
          {/* Draft mode: Stats + Buttons row */}
          {isDraftMode && (
            <div style={{
              gridColumn: '1 / -1',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '0.5rem 1rem',
              fontSize: '0.85rem',
              paddingTop: '0.5rem',
              paddingBottom: !isMobile ? '0.25rem' : '0.5rem',
            }}>
              {/* Title + Stats */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', flex: 1, alignItems: 'center' }}>
                <CategoryStatsRow
                  isDraftMode={isDraftMode}
                  isEditingAppliedAllocations={isEditingAppliedAllocations}
                  availableNow={availableNow}
                  currentMonthIncome={currentMonthIncome}
                  balanceTotals={balanceTotals}
                  draftChangeAmount={draftChangeAmount}
                  availableAfterApply={availableAfterApply}
                  currentDraftTotal={currentDraftTotal}
                />
              </div>

              {/* Buttons */}
              <BalancesActionButtons
                isDraftMode={isDraftMode}
                isEditingAppliedAllocations={isEditingAppliedAllocations}
                allocationsFinalized={allocationsFinalized}
                onSave={handleSaveAllocations}
                onApply={handleFinalizeAllocations}
                onEdit={() => setIsEditingAppliedAllocations(true)}
                onCancel={resetAllocationsToSaved}
                onDelete={() => setShowDeleteConfirm(true)}
              />
            </div>
          )}

          {/* Column headers row - uses grid columns */}
          {!isMobile && (
            <>
              <div style={columnHeaderStyle}>Category</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'right' }}>Start</div>
              <div style={{ ...columnHeaderStyle, textAlign: isDraftMode ? 'center' : 'right' }}>Allocated</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'right' }}>Spent</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'right' }}>Net Change</div>
              <div style={{
                ...columnHeaderStyle,
                textAlign: 'right',
                paddingRight: '1rem',
                borderRight: '2px solid rgba(128, 128, 128, 0.4)',
              }}>End</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'right' }}>All-Time</div>
            </>
          )}

          {/* Grand totals row (like accounts page) - shown in both draft and finalized modes */}
          {!isMobile && (() => {
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
                      onSave={handleSaveAllocations}
                      onApply={handleFinalizeAllocations}
                      onEdit={() => setIsEditingAppliedAllocations(true)}
                      onCancel={resetAllocationsToSaved}
                      onDelete={() => setShowDeleteConfirm(true)}
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
                <div style={{ ...grandTotalsCellStyle, justifyContent: 'flex-end', color: getCategoryBalanceColor(netChange) }}>
                  {formatSignedCurrencyAlways(netChange)}
                </div>
                <div style={{
                  ...grandTotalsCellStyle,
                  justifyContent: 'flex-end',
                  color: getCategoryBalanceColor(balanceTotals.end),
                  paddingRight: '1rem',
                  borderRight: '2px solid rgba(128, 128, 128, 0.4)',
                }}>
                  {formatBalanceCurrency(balanceTotals.end)}
                </div>
                <div style={{ ...grandTotalsCellStyle, justifyContent: 'flex-end', color: grandAllTime < 0 ? colors.debt : colors.primary }}>
                  {formatBalanceCurrency(grandAllTime)}
                </div>
              </>
            )
          })()}

          {/* Mobile: Stats row for finalized mode */}
          {!isDraftMode && isMobile && (
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
                onSave={handleSaveAllocations}
                onApply={handleFinalizeAllocations}
                onEdit={() => setIsEditingAppliedAllocations(true)}
                onCancel={resetAllocationsToSaved}
                onDelete={() => setShowDeleteConfirm(true)}
              />
            </div>
          )}
        </div>

        {/* Category Balances - rendered directly in grid */}
        {Object.keys(categories).length === 0 && (
          <p style={{ gridColumn: '1 / -1', opacity: 0.6, textAlign: 'center', padding: '2rem' }}>
            No categories yet.{' '}
            <Link to="/budget/settings/categories" style={{ color: colors.primaryLight }}>
              Create categories →
            </Link>
          </p>
        )}

        {sortedCategoryGroups.map(group => {
          const groupCats = categoriesByGroup[group.id] || []
          if (groupCats.length === 0) return null

          const groupTotals = groupCats.reduce((acc, [catId]) => {
            const bal = getCategoryBalance(catId)
            if (!bal) return acc
            return {
              start: acc.start + bal.start_balance,
              allocated: acc.allocated + bal.allocated,
              spent: acc.spent + bal.spent,
              end: acc.end + bal.end_balance,
            }
          }, { start: 0, allocated: 0, spent: 0, end: 0 })

          return (
            <CategoryGroupRows
              key={group.id}
              name={group.name}
              categories={groupCats}
              groupTotals={groupTotals}
              getCategoryBalance={getCategoryBalance}
              localAllocations={localAllocations}
              savedAllocations={savedAllocations}
              previousMonthIncome={previousMonthIncome}
              isDraftMode={isDraftMode}
              onAllocationChange={handleAllocationChange}
              isMobile={isMobile}
              getAllocationAmount={getAllocationAmount}
            />
          )
        })}

        {/* Ungrouped categories */}
        {categoriesByGroup['ungrouped']?.length > 0 && (() => {
          const ungroupedCats = categoriesByGroup['ungrouped']
          const ungroupedTotals = ungroupedCats.reduce((acc, [catId]) => {
            const bal = getCategoryBalance(catId)
            if (!bal) return acc
            return {
              start: acc.start + bal.start_balance,
              allocated: acc.allocated + bal.allocated,
              spent: acc.spent + bal.spent,
              end: acc.end + bal.end_balance,
            }
          }, { start: 0, allocated: 0, spent: 0, end: 0 })

          return (
            <CategoryGroupRows
              key="ungrouped"
              name="Uncategorized"
              categories={ungroupedCats}
              groupTotals={ungroupedTotals}
              getCategoryBalance={getCategoryBalance}
              localAllocations={localAllocations}
              savedAllocations={savedAllocations}
              previousMonthIncome={previousMonthIncome}
              isDraftMode={isDraftMode}
              onAllocationChange={handleAllocationChange}
              isMobile={isMobile}
              isUngrouped
              getAllocationAmount={getAllocationAmount}
            />
          )
        })()}

        {/* Bottom padding */}
        <div style={{ gridColumn: '1 / -1', height: '2rem' }} />
      </div>

      {/* Delete Allocations Confirmation Modal */}
      <DeleteAllocationsModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onDeleted={() => setIsEditingAppliedAllocations(false)}
      />
    </>
  )
}
