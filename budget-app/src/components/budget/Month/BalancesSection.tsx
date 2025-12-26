import { useMemo, useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useBudget, type Category, type BalancesView } from '../../../contexts/budget_context'
import { useBudgetData, useAllocationsPage, useBudgetMonth } from '../../../hooks'
import { useIsMobile } from '../../../hooks/useIsMobile'
import type { CategoryMonthBalance, AccountMonthBalance } from '../../../types/budget'
import {
  Button,
  formatCurrency,
  getBalanceColor,
  ErrorAlert,
  SectionTotalHeader,
  LoadingOverlay,
  FourStatGrid,
  Modal,
} from '../../ui'
import { colors } from '../../../styles/shared'
import { AccountBalancesView } from './AccountBalances'
import { AllocationStatus, BalanceGroupBlock, DraftEquation } from './CategoryBalances'

const VALID_VIEWS: BalancesView[] = ['categories', 'accounts']

export function BalancesSection() {
  const { selectedBudgetId, currentUserId, currentYear, currentMonthNumber, lastBalancesView, setLastBalancesView } = useBudget()
  const { categories, categoryGroups, accounts, accountGroups } = useBudgetData(selectedBudgetId, currentUserId)
  const { month: currentMonth, isLoading: monthLoading } = useBudgetMonth(selectedBudgetId, currentYear, currentMonthNumber)
  const isMobile = useIsMobile()
  const [searchParams, setSearchParams] = useSearchParams()

  // Get initial view: URL takes precedence, then context's last view
  const getInitialView = (): BalancesView => {
    const urlView = searchParams.get('view')
    if (urlView && VALID_VIEWS.includes(urlView as BalancesView)) {
      return urlView as BalancesView
    }
    return lastBalancesView
  }

  const [currentView, setCurrentViewLocal] = useState<BalancesView>(getInitialView)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Wrap setCurrentView to also update context and URL
  const setCurrentView = (view: BalancesView) => {
    setCurrentViewLocal(view)
    setLastBalancesView(view)
    setSearchParams({ view }, { replace: true })
  }

  // On mount: sync context to local state if URL didn't have a view
  // This handles the case where user navigates away and back - context remembers the view
  useEffect(() => {
    const urlView = searchParams.get('view')
    if (!urlView || !VALID_VIEWS.includes(urlView as BalancesView)) {
      // No valid URL view, use context's lastBalancesView
      // Using flushSync would be overkill here - just update URL without re-render
      setSearchParams({ view: lastBalancesView }, { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const {
    localAllocations,
    isSavingAllocations,
    isFinalizingAllocations,
    isDeletingAllocations,
    isEditingAppliedAllocations,
    error,
    availableNow,
    currentDraftTotal,
    draftChangeAmount,
    availableAfterApply,
    previousMonthIncome,
    allocationsFinalized,
    getAllocationAmount,
    handleAllocationChange,
    resetAllocationsToSaved,
    handleSaveAllocations,
    handleFinalizeAllocations,
    handleDeleteAllocations,
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

  // Show full-page overlay when saving or deleting allocations
  const showLoadingOverlay = isFinalizingAllocations || isDeletingAllocations

  // Determine if we're in draft mode (not finalized, or editing applied allocations)
  const isDraftMode = !allocationsFinalized || isEditingAppliedAllocations

  // Calculate live category balances that update as allocations change
  const liveCategoryBalances = useMemo(() => {
    const prevBalances = currentMonth?.previous_month_snapshot?.category_balances_end ?? {}

    const balances: Record<string, CategoryMonthBalance> = {}
    Object.entries(categories).forEach(([catId, cat]) => {
      const startBalance = prevBalances[catId] ?? 0

      // Use live draft allocation when in draft mode, otherwise use finalized
      let allocated = 0
      if (isDraftMode) {
        allocated = getAllocationAmount(catId, cat)
      } else if (allocationsFinalized && currentMonth?.allocations) {
        const alloc = currentMonth.allocations.find(a => a.category_id === catId)
        if (alloc) allocated = alloc.amount
      }

      let spent = 0
      if (currentMonth?.expenses) {
        spent = currentMonth.expenses
          .filter(e => e.category_id === catId)
          .reduce((sum, e) => sum + e.amount, 0)
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
    const prevAccountBalances = currentMonth?.previous_month_snapshot?.account_balances_end ?? {}

    const balances: Record<string, AccountMonthBalance> = {}
    Object.entries(accounts).forEach(([accountId, account]) => {
      // Start balance from previous month's end, or account's current balance if first month
      const startBalance = prevAccountBalances[accountId] ?? account.balance

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
    <div style={{
      opacity: monthLoading ? 0.5 : 1,
      transition: 'opacity 0.15s ease-out',
      pointerEvents: monthLoading ? 'none' : 'auto',
    }}>
      <LoadingOverlay
        isVisible={showLoadingOverlay}
        message={isDeletingAllocations ? 'Deleting allocations...' : 'Saving allocations...'}
      />

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {/* Balance Summary Grid - shows different content based on view */}
      <FourStatGrid
        items={currentView === 'categories' ? [
          {
            label: 'Start of Month',
            value: <span style={{ color: getBalanceColor(balanceTotals.start) }}>{formatCurrency(balanceTotals.start)}</span>,
          },
          {
            label: isDraftMode ? 'Draft Allocations' : 'Allocated',
            value: <span style={{ color: isDraftMode ? colors.primary : colors.success }}>+{formatCurrency(balanceTotals.allocated)}</span>,
          },
          {
            label: 'Spent',
            value: <span style={{ color: colors.error }}>-{formatCurrency(balanceTotals.spent)}</span>,
          },
          {
            label: 'End of Month',
            value: <span style={{ color: getBalanceColor(balanceTotals.end) }}>{formatCurrency(balanceTotals.end)}</span>,
          },
        ] : [
          {
            label: 'Start of Month',
            value: <span style={{ color: getBalanceColor(accountBalanceTotals.start) }}>{formatCurrency(accountBalanceTotals.start)}</span>,
          },
          {
            label: 'Income',
            value: <span style={{ color: colors.success }}>+{formatCurrency(accountBalanceTotals.income)}</span>,
          },
          {
            label: 'Expenses',
            value: <span style={{ color: colors.error }}>-{formatCurrency(accountBalanceTotals.expenses)}</span>,
          },
          {
            label: 'End of Month',
            value: <span style={{ color: getBalanceColor(accountBalanceTotals.end) }}>{formatCurrency(accountBalanceTotals.end)}</span>,
          },
        ]}
      />

      {/* Action Button Bar */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
      }}>
        {/* View Toggle Button - always on the left */}
        <Button
          onClick={() => setCurrentView(currentView === 'categories' ? 'accounts' : 'categories')}
          variant="secondary"
          style={{ fontSize: '0.85rem' }}
        >
          {currentView === 'categories' ? '🏦 Switch to Account Balances' : '📊 Switch to Category Balances'}
        </Button>

        {/* Edit Allocations Button - only show for category view when not in draft mode and allocations are finalized */}
        {currentView === 'categories' && !isDraftMode && allocationsFinalized && (
          <Button
            onClick={() => setIsEditingAppliedAllocations(true)}
            variant="secondary"
            style={{ fontSize: '0.85rem' }}
          >
            ✏️ Edit Allocations
          </Button>
        )}
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
        <>
          {/* Allocation Header - only show when in draft mode (editing or new) */}
          {isDraftMode && (
        <SectionTotalHeader
          label={isEditingAppliedAllocations ? "Editing Allocations" : "Draft Allocations"}
          value={null}
          compact
          action={
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <Button
                onClick={isEditingAppliedAllocations ? handleFinalizeAllocations : handleSaveAllocations}
                disabled={isSavingAllocations || isFinalizingAllocations || monthLoading}
                variant="secondary"
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
              >
                {isSavingAllocations || isFinalizingAllocations ? '⏳...' : isEditingAppliedAllocations ? '✓ Apply' : '💾 Save'}
              </Button>
              {allocationsFinalized && isEditingAppliedAllocations && (
                <>
                  <button
                    onClick={resetAllocationsToSaved}
                    disabled={isFinalizingAllocations || isDeletingAllocations || monthLoading}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: isFinalizingAllocations || isDeletingAllocations || monthLoading ? 'not-allowed' : 'pointer',
                      padding: '0.25rem',
                      opacity: isFinalizingAllocations || isDeletingAllocations || monthLoading ? 0.5 : 0.7,
                      fontSize: '1rem',
                      lineHeight: 1,
                    }}
                    title="Cancel Editing"
                  >
                    ✕
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={isDeletingAllocations || monthLoading}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: isDeletingAllocations || monthLoading ? 'not-allowed' : 'pointer',
                      padding: '0.25rem',
                      opacity: isDeletingAllocations || monthLoading ? 0.5 : 0.7,
                      fontSize: '1rem',
                      lineHeight: 1,
                      color: colors.error,
                    }}
                    title="Delete Allocations"
                  >
                    🗑️
                  </button>
                </>
              )}
            </div>
          }
        />
      )}

      {/* Draft Equation Section - Show available calculation when in draft mode */}
      {isDraftMode && (
        <DraftEquation
          availableNow={availableNow}
          currentDraftTotal={currentDraftTotal}
          draftChangeAmount={draftChangeAmount}
          availableAfterApply={availableAfterApply}
          allocationsFinalized={allocationsFinalized}
        />
      )}

      {/* Finalization Status - Only show when allocations not yet applied (not when editing applied) */}
      {isDraftMode && !isEditingAppliedAllocations && (
        <AllocationStatus
          isFinalizingAllocations={isFinalizingAllocations}
          monthLoading={monthLoading}
          onFinalize={handleFinalizeAllocations}
        />
      )}

      {/* Category Balances by Group */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
            />
          )
        })()}
      </div>
        </>
      )}

      {/* Delete Allocations Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Allocations"
      >
        <p style={{ margin: '0 0 1.5rem 0' }}>
          Are you sure you want to delete all allocations for this month? This will remove all allocated amounts and reset the month to unfinalized.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              setShowDeleteConfirm(false)
              handleDeleteAllocations()
            }}
          >
            Delete Allocations
          </Button>
        </div>
      </Modal>
    </div>
  )
}
