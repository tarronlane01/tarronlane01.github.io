/**
 * MonthCategories - Category balances and allocations view
 *
 * Displays category balances for the current month with allocation editing.
 * Uses CSS Grid with sticky subgrid header for column alignment.
 */

import { useMemo, useState, useEffect, useLayoutEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useBudget } from '@contexts'
import { useBudgetData, useAllocationsPage, useMonthData } from '@hooks'
import { useIsMobile } from '@hooks'
import type { CategoryMonthBalance } from '@types'
import { bannerQueue, formatCurrency } from '../../ui'
import { UNGROUPED_CATEGORY_GROUP_ID } from '@constants'
import { buildMonthCategoriesMarkdown, downloadMarkdownFile } from '@utils/monthCategoriesMarkdown'
import { DeleteAllocationsModal } from '../Allocations'
import { CategoryStatsRow, BalancesActionButtons } from './MonthBalances'
import { CategoryGroupRows } from './CategoryGridRows'
import { calculateCategoriesByGroup, calculateLiveCategoryBalances, calculateBalanceTotals } from '@calculations'
import { GrandTotalsRow, MobileGrandTotals } from './MonthCategoriesHeader'
import { columnHeaderStyle } from './MonthCategoriesStyles'

interface MonthCategoriesProps {
  /** Register the download handler so the month dropdown can trigger it. */
  registerDownloadCategories?: (fn: (() => void) | null) => void
}

export function MonthCategories({ registerDownloadCategories }: MonthCategoriesProps = {}) {
  const { selectedBudgetId, currentYear, currentMonthNumber } = useBudget()
  const { categories, categoryGroups } = useBudgetData()
  const { month: currentMonth } = useMonthData(selectedBudgetId, currentYear, currentMonthNumber)
  const isMobile = useIsMobile()


  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const {
    localAllocations, isEditingAppliedAllocations, availableNow,
    onBudgetTotal,
    currentDraftTotal, draftChangeAmount, availableAfterApply, previousMonthIncome,
    currentMonthIncome, allocationsFinalized, getAllocationAmount, handleAllocationChange,
    resetAllocationsToSaved, handleSaveAllocations, handleFinalizeAllocations,
    handleEditAllocations, setIsEditingAppliedAllocations,
  } = useAllocationsPage()

  // Organize categories by group
  const sortedCategoryGroups = [...categoryGroups].sort((a, b) => a.sort_order - b.sort_order)
  const categoriesByGroup = useMemo(() => calculateCategoriesByGroup(categories), [categories])

  // Determine if we're in draft mode (not finalized, or editing applied allocations)
  const isDraftMode = !allocationsFinalized || isEditingAppliedAllocations

  // Calculate live category balances that update as allocations change
  const liveCategoryBalances = useMemo(
    () => calculateLiveCategoryBalances(currentMonth, categories, isDraftMode, allocationsFinalized, getAllocationAmount),
    [currentMonth, categories, isDraftMode, allocationsFinalized, getAllocationAmount]
  )

  // When viewing an unfinalized month: start = last finalized end, end = last finalized end + this month's net change.
  // Same "what if just this month were finalized" as the all-time column; applied to start/end for whole column and totals.
  const displayBalances = useMemo(() => {
    if (allocationsFinalized) return liveCategoryBalances
    const adjusted: Record<string, CategoryMonthBalance> = {}
    for (const [catId, cat] of Object.entries(categories)) {
      const bal = liveCategoryBalances[catId]
      if (!bal) continue
      const base = cat.balance ?? 0
      const netChange = bal.allocated + bal.spent + bal.transfers + bal.adjustments
      adjusted[catId] = { ...bal, start_balance: base, end_balance: base + netChange }
    }
    return adjusted
  }, [liveCategoryBalances, categories, allocationsFinalized])

  const getCategoryBalance = (catId: string): CategoryMonthBalance | undefined => displayBalances[catId] ?? liveCategoryBalances[catId]

  // Grand totals must sum only visible (displayed) categories so e.g. Grand Total Start = sum of displayed Start column
  const balanceTotals = useMemo(() => {
    const visibleBalances: Record<string, CategoryMonthBalance> = {}
    for (const [catId, cat] of Object.entries(categories)) {
      if (cat.is_hidden) continue
      const bal = displayBalances[catId] ?? liveCategoryBalances[catId]
      if (bal) visibleBalances[catId] = bal
    }
    return calculateBalanceTotals(visibleBalances)
  }, [displayBalances, liveCategoryBalances, categories])

  // Build map of saved allocations from currentMonth
  const savedAllocations = useMemo(() => {
    const map: Record<string, number> = {}
    if (currentMonth?.category_balances) {
      for (const cb of currentMonth.category_balances) map[cb.category_id] = cb.allocated
    }
    return map
  }, [currentMonth])

  // Grand all-time: sum of category balances for visible categories only.
  // When viewing an unfinalized month: show "what if just this month were finalized" = last finalized end + this month's net change.
  // Net change includes allocations, spent, transfers, and adjustments.
  // When viewing a finalized month: use stored balance (and in draft mode add allocationChange for editing-applied).
  // Avail is always from finalized data only (useBudgetData / calculateTotalAvailable); this does NOT affect Avail.
  const grandAllTime = useMemo(() => {
    const isViewingUnfinalizedMonth = !allocationsFinalized
    return Object.entries(categories).reduce((sum, [catId, cat]) => {
      if (cat.is_hidden) return sum
      const storedBalance = cat.balance ?? 0
      let balance: number
      if (isViewingUnfinalizedMonth) {
        // Proposed ALL-TIME = stored balance + this month's net change
        // Net change = allocated + spent + transfers + adjustments
        const thisMonthAllocation = isDraftMode ? getAllocationAmount(catId, cat) : (savedAllocations[catId] ?? 0)
        const bal = liveCategoryBalances[catId]
        const spent = bal?.spent ?? 0
        const transfers = bal?.transfers ?? 0
        const adjustments = bal?.adjustments ?? 0
        balance = storedBalance + thisMonthAllocation + spent + transfers + adjustments
      } else {
        balance = storedBalance
        if (isDraftMode) {
          const draftAllocation = getAllocationAmount(catId, cat)
          const savedAllocation = savedAllocations[catId] ?? 0
          balance += draftAllocation - savedAllocation
        }
      }
      return sum + balance
    }, 0)
  }, [categories, isDraftMode, allocationsFinalized, getAllocationAmount, savedAllocations, liveCategoryBalances])

  // Settings "Allocated" for visible categories only (same scope as grandAllTime / displayed rows)
  const settingsPageAllocated = useMemo(() =>
    Object.values(categories).reduce(
      (sum, cat) => (cat.is_hidden ? sum : sum + (cat.balance ?? 0)),
      0
    ),
    [categories]
  )

  // Check if month view ALL-TIME matches settings Allocated (same visible categories, no draft)
  // Use 0.02 tolerance: small differences are typically rounding, not sync/recalc issues
  useEffect(() => {
    if (!selectedBudgetId || isDraftMode) return // Skip check in draft mode or when no budget

    const diff = Math.abs(grandAllTime - settingsPageAllocated)
    const mismatch = diff > 0.02
    if (mismatch) {
      console.error('[MonthCategories] Month View vs Settings Mismatch:', {
        grandAllTime,
        settingsPageAllocated,
        difference: diff,
      })
      bannerQueue.add({
        type: 'error',
        message: `Balance display mismatch: Month view "ALL-TIME" (${formatCurrency(grandAllTime)}) ≠ Settings "Allocated" (${formatCurrency(settingsPageAllocated)}). Difference: ${formatCurrency(diff)}.`,
        autoDismissMs: 10000,
      })
    }
  }, [grandAllTime, settingsPageAllocated, isDraftMode, selectedBudgetId])

  const actionButtonHandlers = {
    onSave: handleSaveAllocations,
    onApply: handleFinalizeAllocations,
    onEdit: handleEditAllocations,
    onCancel: resetAllocationsToSaved,
    onDelete: () => setShowDeleteConfirm(true),
  }

  const handleDownloadMarkdownRef = useRef<() => void>(() => {})

  useLayoutEffect(() => {
    handleDownloadMarkdownRef.current = () => {
      const md = buildMonthCategoriesMarkdown({
        year: currentYear,
        monthNumber: currentMonthNumber,
        categoryGroups: sortedCategoryGroups,
        categoriesByGroup,
        categories,
        liveCategoryBalances,
        getAllocationAmount,
        savedAllocations,
        previousMonthIncome,
        isDraftMode,
        balanceTotals,
        grandAllTime,
      })
      const pad = (n: number) => String(n).padStart(2, '0')
      const filename = `categories-${currentYear}-${pad(currentMonthNumber)}.md`
      downloadMarkdownFile(md, filename)
    }
    return () => {
      handleDownloadMarkdownRef.current = () => {}
    }
  }, [
    currentYear,
    currentMonthNumber,
    sortedCategoryGroups,
    categoriesByGroup,
    categories,
    liveCategoryBalances,
    getAllocationAmount,
    savedAllocations,
    previousMonthIncome,
    isDraftMode,
    balanceTotals,
    grandAllTime,
  ])

  useEffect(() => {
    if (!registerDownloadCategories) return
    registerDownloadCategories(() => handleDownloadMarkdownRef.current())
    return () => registerDownloadCategories(null)
  }, [registerDownloadCategories])

  return (
    <>
      {/* CSS Grid container */}
      <div style={{
        display: 'grid',
        // Category, Start, Allocated, Spent, Transfers, Adjustments, Net Change, End, All-Time
        gridTemplateColumns: isMobile ? '1fr' : isDraftMode ? '2fr 1fr 200px 1fr 1fr 1fr 1fr 1fr 120px' : '2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 120px',
      }}>
        {/* Sticky wrapper using subgrid */}
        <div style={{ gridColumn: '1 / -1', position: 'sticky', top: 0, zIndex: 49, backgroundColor: 'var(--sticky-header-bg)', display: isMobile ? 'block' : 'grid', gridTemplateColumns: isMobile ? undefined : 'subgrid' }}>
          {/* Draft mode: Stats + Buttons row */}
          {isDraftMode && (
            <div style={{
              gridColumn: '1 / -1',
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              flexWrap: 'wrap',
              alignItems: isMobile ? 'stretch' : 'center',
              gap: isMobile ? '0.5rem' : '0.5rem 1rem',
              fontSize: '0.85rem',
              paddingTop: '0.5rem',
              paddingBottom: isMobile ? '0.5rem' : '0.25rem',
            }}>
              {/* Equation row */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', flex: isMobile ? undefined : 1, alignItems: 'center' }}>
                <CategoryStatsRow isDraftMode={isDraftMode} isEditingAppliedAllocations={isEditingAppliedAllocations}
                  onBudgetTotal={onBudgetTotal} availableNow={availableNow}
                  currentMonthIncome={currentMonthIncome} balanceTotals={balanceTotals}
                  draftChangeAmount={draftChangeAmount} availableAfterApply={availableAfterApply} currentDraftTotal={currentDraftTotal} />
              </div>
              {/* Buttons row */}
              <BalancesActionButtons isDraftMode={isDraftMode} isEditingAppliedAllocations={isEditingAppliedAllocations}
                allocationsFinalized={allocationsFinalized} {...actionButtonHandlers} />
            </div>
          )}

          {/* Column headers row - desktop only */}
          {!isMobile && (
            <>
              <div style={columnHeaderStyle}>Category</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'right' }}>Start</div>
              <div style={{ ...columnHeaderStyle, textAlign: isDraftMode ? 'center' : 'right' }}>Allocated</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'right' }}>Spent</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'right' }}>Transfers</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'right' }}>Adjust</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'right' }}>Net Change</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'right', paddingRight: '1rem', borderRight: '2px solid var(--border-muted)' }}>End</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'right' }}>All-Time</div>
            </>
          )}

          {/* Grand totals row - desktop */}
          {!isMobile && (
            <GrandTotalsRow isDraftMode={isDraftMode} allocationsFinalized={allocationsFinalized}
              balanceTotals={balanceTotals} grandAllTime={grandAllTime} {...actionButtonHandlers} />
          )}

          {/* Mobile: Stats row for finalized mode */}
          {!isDraftMode && isMobile && (
            <MobileGrandTotals allocationsFinalized={allocationsFinalized} availableNow={availableNow}
              currentMonthIncome={currentMonthIncome} balanceTotals={balanceTotals} draftChangeAmount={draftChangeAmount}
              availableAfterApply={availableAfterApply} currentDraftTotal={currentDraftTotal} {...actionButtonHandlers} />
          )}
        </div>

        {/* Category Balances */}
        {Object.keys(categories).length === 0 && (
          <p style={{ gridColumn: '1 / -1', opacity: 0.6, textAlign: 'center', padding: '2rem' }}>
            No categories yet. <Link to="/budget/settings/categories" style={{ opacity: 1 }}>Create categories →</Link>
          </p>
        )}

        {sortedCategoryGroups.map((group, groupIndex) => {
          const groupCats = categoriesByGroup[group.id] || []
          if (groupCats.length === 0) return null

          const groupTotals = groupCats.reduce((acc, [catId]) => {
            const bal = getCategoryBalance(catId)
            if (!bal) return acc
            return { start: acc.start + bal.start_balance, allocated: acc.allocated + bal.allocated, spent: acc.spent + bal.spent, transfers: acc.transfers + bal.transfers, adjustments: acc.adjustments + bal.adjustments, end: acc.end + bal.end_balance }
          }, { start: 0, allocated: 0, spent: 0, transfers: 0, adjustments: 0, end: 0 })

          return (
            <CategoryGroupRows key={group.id} name={group.name} categories={groupCats} groupTotals={groupTotals}
              getCategoryBalance={getCategoryBalance} localAllocations={localAllocations} savedAllocations={savedAllocations}
              previousMonthIncome={previousMonthIncome} isDraftMode={isDraftMode} allocationsFinalized={allocationsFinalized}
              onAllocationChange={handleAllocationChange} isMobile={isMobile} isFirstGroup={groupIndex === 0} getAllocationAmount={getAllocationAmount}
              gridTemplateColumns={isDraftMode ? '2fr 1fr 200px 1fr 1fr 1fr 1fr 1fr 120px' : '2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 120px'} />
          )
        })}

        {/* Ungrouped categories */}
        {categoriesByGroup[UNGROUPED_CATEGORY_GROUP_ID]?.length > 0 && (() => {
          const ungroupedCats = categoriesByGroup[UNGROUPED_CATEGORY_GROUP_ID]
          const ungroupedTotals = ungroupedCats.reduce((acc, [catId]) => {
            const bal = getCategoryBalance(catId)
            if (!bal) return acc
            return { start: acc.start + bal.start_balance, allocated: acc.allocated + bal.allocated, spent: acc.spent + bal.spent, transfers: acc.transfers + bal.transfers, adjustments: acc.adjustments + bal.adjustments, end: acc.end + bal.end_balance }
          }, { start: 0, allocated: 0, spent: 0, transfers: 0, adjustments: 0, end: 0 })

          // Ungrouped categories are first only if there are no groups before them
          const isFirstGroup = sortedCategoryGroups.length === 0

          return (
            <CategoryGroupRows key={UNGROUPED_CATEGORY_GROUP_ID} name="Uncategorized" categories={ungroupedCats} groupTotals={ungroupedTotals}
              getCategoryBalance={getCategoryBalance} localAllocations={localAllocations} savedAllocations={savedAllocations}
              previousMonthIncome={previousMonthIncome} isDraftMode={isDraftMode} allocationsFinalized={allocationsFinalized}
              onAllocationChange={handleAllocationChange} isMobile={isMobile} isUngrouped isFirstGroup={isFirstGroup} getAllocationAmount={getAllocationAmount}
              gridTemplateColumns={isDraftMode ? '2fr 1fr 200px 1fr 1fr 1fr 1fr 1fr 120px' : '2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 120px'} />
          )
        })()}

        <div style={{ gridColumn: '1 / -1', height: '2rem' }} />
      </div>

      <DeleteAllocationsModal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)}
        onDeleted={() => setIsEditingAppliedAllocations(false)} />
    </>
  )
}
