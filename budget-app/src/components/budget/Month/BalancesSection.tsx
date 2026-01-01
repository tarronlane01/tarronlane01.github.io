import { useMemo, useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../../../contexts/app_context'
import { useBudget, type Category, type BalancesView } from '../../../contexts/budget_context'
import { useBudgetData, useAllocationsPage, useBudgetMonth } from '../../../hooks'
import { useIsMobile } from '../../../hooks/useIsMobile'
import type { CategoryMonthBalance, AccountMonthBalance } from '@types'
import { ErrorAlert } from '../../ui'
import { colors } from '../../../styles/shared'
import { AccountBalancesView } from './AccountBalances'
import { BalanceGroupBlock } from './CategoryBalances'
import { DeleteAllocationsModal } from '../Allocations'
import {
  CategoryStatsRow,
  AccountStatsRow,
  BalancesActionButtons,
  CategoryColumnHeaders,
  AccountColumnHeaders,
} from './MonthBalances'
import { triggerRecalculation } from '../../../data/recalculation/triggerRecalculation'
import { queryClient, queryKeys } from '../../../data/queryClient'
import { getYearMonthOrdinal } from '@utils'

interface BalancesSectionProps {
  currentView: BalancesView
  onViewChange: (view: BalancesView) => void
}

export function BalancesSection({ currentView, onViewChange }: BalancesSectionProps) {
  const { addLoadingHold, removeLoadingHold } = useApp()
  const { selectedBudgetId, currentUserId, currentYear, currentMonthNumber } = useBudget()
  const { categories, categoryGroups, accounts, accountGroups, monthMap } = useBudgetData(selectedBudgetId, currentUserId)
  const { month: currentMonth } = useBudgetMonth(selectedBudgetId, currentYear, currentMonthNumber)
  const isMobile = useIsMobile()

  // Check if current month needs recalculation from budget's month_map
  const currentMonthOrdinal = getYearMonthOrdinal(currentYear, currentMonthNumber)
  const monthNeedsRecalc = monthMap[currentMonthOrdinal]?.needs_recalculation === true

  // Track recalculation in progress (prevents re-triggering during async operation)
  const recalcInProgressRef = useRef(false)

  // Trigger recalculation when viewing Balances tab and month needs it
  useEffect(() => {
    if (!selectedBudgetId || !currentMonth) return
    if (!monthNeedsRecalc || recalcInProgressRef.current) return

    recalcInProgressRef.current = true
    addLoadingHold('balances-recalc', 'Recalculating balances...')

    const triggeringMonthOrdinal = `${currentYear}${String(currentMonthNumber).padStart(2, '0')}`
    console.log(`[BalancesSection] Month needs recalculation, triggering from ${triggeringMonthOrdinal}...`)

    triggerRecalculation(selectedBudgetId, { triggeringMonthOrdinal })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.month(selectedBudgetId, currentYear, currentMonthNumber) })
        queryClient.invalidateQueries({ queryKey: queryKeys.budget(selectedBudgetId) })
      })
      .catch((err) => {
        console.error('[BalancesSection] Recalculation failed:', err)
      })
      .finally(() => {
        recalcInProgressRef.current = false
        removeLoadingHold('balances-recalc')
      })
  }, [selectedBudgetId, monthNeedsRecalc, currentMonth, currentYear, currentMonthNumber, addLoadingHold, removeLoadingHold])

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const {
    localAllocations,
    isEditingAppliedAllocations,
    error,
    availableNow,
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

  // Category entry type
  type CategoryEntry = [string, Category]

  // Organize categories by group
  const sortedCategoryGroups = [...categoryGroups].sort((a, b) => a.sort_order - b.sort_order)
  const categoriesByGroup = useMemo(() => {
    const result = Object.entries(categories).reduce((acc, [catId, cat]) => {
      const groupId = cat.category_group_id || 'ungrouped'
      if (!acc[groupId]) acc[groupId] = []
      acc[groupId].push([catId, cat] as CategoryEntry)
      return acc
    }, {} as Record<string, CategoryEntry[]>)

    Object.keys(result).forEach(groupId => {
      result[groupId].sort((a, b) => a[1].sort_order - b[1].sort_order)
    })

    return result
  }, [categories])


  // Determine if we're in draft mode (not finalized, or editing applied allocations)
  const isDraftMode = !allocationsFinalized || isEditingAppliedAllocations

  // Calculate live category balances that update as allocations change
  const liveCategoryBalances = useMemo(() => {
    // Build a map of existing category balances for quick lookup
    const existingBalances: Record<string, CategoryMonthBalance> = {}
    if (currentMonth?.category_balances) {
      currentMonth.category_balances.forEach(cb => {
        existingBalances[cb.category_id] = cb
      })
    }

    const balances: Record<string, CategoryMonthBalance> = {}
    Object.entries(categories).forEach(([catId, cat]) => {
      const existing = existingBalances[catId]
      const startBalance = existing?.start_balance ?? 0
      const spent = existing?.spent ?? 0

      // Use live draft allocation when in draft mode, otherwise use finalized
      let allocated = 0
      if (isDraftMode) {
        allocated = getAllocationAmount(catId, cat)
      } else if (allocationsFinalized && existing) {
        allocated = existing.allocated
      }

      balances[catId] = {
        category_id: catId,
        start_balance: startBalance,
        allocated,
        spent,
        end_balance: startBalance + allocated - spent,
      }
    })

    return balances
  }, [currentMonth, categories, isDraftMode, allocationsFinalized, getAllocationAmount])

  // Get balance for a category
  const getCategoryBalance = (catId: string): CategoryMonthBalance | undefined => {
    return liveCategoryBalances[catId]
  }

  // Calculate account balances for this month
  const accountBalances = useMemo(() => {
    // Build a map of existing account balances for quick lookup
    const existingBalances: Record<string, AccountMonthBalance> = {}
    if (currentMonth?.account_balances) {
      currentMonth.account_balances.forEach(ab => {
        existingBalances[ab.account_id] = ab
      })
    }

    const balances: Record<string, AccountMonthBalance> = {}
    Object.entries(accounts).forEach(([accountId, account]) => {
      const existing = existingBalances[accountId]
      // Start balance from existing or account's current balance if first month
      const startBalance = existing?.start_balance ?? account.balance

      // Calculate income deposited to this account this month
      let income = 0
      if (currentMonth?.income) {
        income = currentMonth.income
          .filter(i => i.account_id === accountId)
          .reduce((sum, i) => sum + i.amount, 0)
      }

      // Calculate expenses from this account this month
      let expenses = 0
      if (currentMonth?.expenses) {
        expenses = currentMonth.expenses
          .filter(e => e.account_id === accountId)
          .reduce((sum, e) => sum + e.amount, 0)
      }

      const netChange = income - expenses

      balances[accountId] = {
        account_id: accountId,
        start_balance: startBalance,
        income,
        expenses,
        net_change: netChange,
        end_balance: startBalance + netChange,
      }
    })

    return balances
  }, [currentMonth, accounts])

  // Calculate account balance totals
  const accountBalanceTotals = useMemo(() => {
    return Object.values(accountBalances).reduce((acc, bal) => ({
      start: acc.start + bal.start_balance,
      income: acc.income + bal.income,
      expenses: acc.expenses + bal.expenses,
      netChange: acc.netChange + bal.net_change,
      end: acc.end + bal.end_balance,
    }), { start: 0, income: 0, expenses: 0, netChange: 0, end: 0 })
  }, [accountBalances])

  // Calculate balance totals
  const balanceTotals = useMemo(() => {
    return Object.values(liveCategoryBalances).reduce((acc, bal) => ({
      start: acc.start + bal.start_balance,
      allocated: acc.allocated + bal.allocated,
      spent: acc.spent + bal.spent,
      end: acc.end + bal.end_balance,
    }), { start: 0, allocated: 0, spent: 0, end: 0 })
  }, [liveCategoryBalances])

  return (
    <>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {/* Sticky header: stats + buttons + column headers */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backgroundColor: '#242424',
        marginLeft: 'calc(-1 * var(--page-padding, 2rem))',
        marginRight: 'calc(-1 * var(--page-padding, 2rem))',
        paddingLeft: 'var(--page-padding, 2rem)',
        paddingRight: 'var(--page-padding, 2rem)',
        paddingTop: '0.5rem',
        paddingBottom: '0.5rem',
        borderBottom: '1px solid rgba(255,255,255,0.15)',
      }}>
        {/* Stats + Buttons row */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.5rem 1rem',
          fontSize: '0.85rem',
        }}>
          {/* Title + Stats */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', flex: 1, alignItems: 'center' }}>
            {currentView === 'categories' ? (
              <CategoryStatsRow
                isDraftMode={isDraftMode}
                isEditingAppliedAllocations={isEditingAppliedAllocations}
                availableNow={availableNow}
                currentMonthIncome={currentMonthIncome}
                balanceTotals={balanceTotals}
                draftChangeAmount={draftChangeAmount}
                availableAfterApply={availableAfterApply}
              />
            ) : (
              <AccountStatsRow totals={accountBalanceTotals} />
            )}
          </div>

          {/* Buttons */}
          <BalancesActionButtons
            currentView={currentView}
            onViewChange={onViewChange}
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

        {/* Column headers for desktop */}
        {!isMobile && currentView === 'categories' && <CategoryColumnHeaders isDraftMode={isDraftMode} />}
        {!isMobile && currentView === 'accounts' && <AccountColumnHeaders />}
      </div>

      {/* Account Balances View */}
      {currentView === 'accounts' && (
        <AccountBalancesView
          accounts={accounts}
          accountGroups={accountGroups}
          accountBalances={accountBalances}
          isMobile={isMobile}
        />
      )}

      {/* Category Balances View */}
      {currentView === 'categories' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '2rem' }}>
        {Object.keys(categories).length === 0 && (
          <p style={{ opacity: 0.6, textAlign: 'center', padding: '2rem' }}>
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
            <BalanceGroupBlock
              key={group.id}
              name={group.name}
              categories={groupCats}
              groupEndBalance={groupTotals.end}
              groupAllocated={groupTotals.allocated}
              getCategoryBalance={getCategoryBalance}
              localAllocations={localAllocations}
              previousMonthIncome={previousMonthIncome}
              isDraftMode={isDraftMode}
              onAllocationChange={handleAllocationChange}
              isMobile={isMobile}
              hideHeader={!isMobile}
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
            <BalanceGroupBlock
              key="ungrouped"
              name="Uncategorized"
              categories={ungroupedCats}
              groupEndBalance={ungroupedTotals.end}
              groupAllocated={ungroupedTotals.allocated}
              getCategoryBalance={getCategoryBalance}
              localAllocations={localAllocations}
              previousMonthIncome={previousMonthIncome}
              isDraftMode={isDraftMode}
              onAllocationChange={handleAllocationChange}
              isMobile={isMobile}
              isUngrouped
              hideHeader={!isMobile}
            />
          )
        })()}
        </div>
      )}

      {/* Delete Allocations Confirmation Modal */}
      <DeleteAllocationsModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onDeleted={() => setIsEditingAppliedAllocations(false)}
      />
    </>
  )
}
