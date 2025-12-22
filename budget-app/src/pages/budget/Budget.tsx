import { useState, useEffect, useRef, useMemo, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useBudget, type BudgetInvite, type IncomeTransaction, type FinancialAccount, type AccountGroupsMap, type CategoryAllocation, type Category } from '../../contexts/budget_context'
import {
  PageContainer,
  Button,
  ErrorAlert,
  FormWrapper,
  FormField,
  TextInput,
  SelectInput,
  FormButtonGroup,
  CurrencyInput,
  PayeeAutocomplete,
  formatCurrency,
  getBalanceColor,
  StatCard,
  Modal,
} from '../../components/ui'
import { navBar, colors, listContainer, sectionHeader } from '../../styles/shared'
import { useIsMobile } from '../../hooks/useIsMobile'

type BudgetTab = 'income' | 'allocations'

// Month name helper
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

function Budget() {
  const {
    currentBudget,
    isOwner,
    hasPendingInvites,
    pendingInvites,
    needsFirstBudget,
    acceptBudgetInvite,
    createNewBudget,
    accounts,
    accountGroups,
    categories,
    categoryGroups,
    currentMonth,
    currentYear,
    currentMonthNumber,
    monthLoading,
    loadMonth,
    goToPreviousMonth,
    goToNextMonth,
    addIncome,
    updateIncome,
    deleteIncome,
    recomputeMonthTotals,
    payees,
    loadPayees,
    saveAllocations,
    finalizeAllocations,
    getOnBudgetTotal,
    previousMonthIncome,
  } = useBudget()

  const isMobile = useIsMobile()
  const [error, setError] = useState<string | null>(null)
  const [showAddIncome, setShowAddIncome] = useState(false)
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null)
  const [isRecomputing, setIsRecomputing] = useState(false)
  const [showMonthMenu, setShowMonthMenu] = useState(false)
  const [showRecomputeModal, setShowRecomputeModal] = useState(false)
  const [recomputeResults, setRecomputeResults] = useState<{
    status: 'pending' | 'counting' | 'calculating' | 'saving' | 'done' | 'error'
    incomeCount?: number
    oldTotal?: number
    newTotal?: number
    error?: string
  } | null>(null)
  const monthMenuRef = useRef<HTMLDivElement>(null)

  // Close month menu when clicking outside
  useEffect(() => {
    if (!showMonthMenu) return
    function handleClickOutside(e: MouseEvent) {
      if (monthMenuRef.current && !monthMenuRef.current.contains(e.target as Node)) {
        setShowMonthMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMonthMenu])
  const [activeTab, setActiveTab] = useState<BudgetTab>(() => {
    const saved = localStorage.getItem('budget_active_tab')
    return (saved === 'income' || saved === 'allocations') ? saved : 'income'
  })

  // Persist active tab to localStorage
  useEffect(() => {
    localStorage.setItem('budget_active_tab', activeTab)
  }, [activeTab])

  // Allocations state - track local edits before saving
  const [localAllocations, setLocalAllocations] = useState<Record<string, string>>({})
  const [isSavingAllocations, setIsSavingAllocations] = useState(false)
  const [isFinalizingAllocations, setIsFinalizingAllocations] = useState(false)
  const [isEditingAppliedAllocations, setIsEditingAppliedAllocations] = useState(false)

  // Total finalized allocations - computed from balance on each category
  const totalFinalizedAllocations = useMemo(() => {
    return Object.values(categories).reduce((sum, cat) => sum + cat.balance, 0)
  }, [categories])

  // Load current month when budget is loaded
  useEffect(() => {
    if (currentBudget && !currentMonth && !monthLoading) {
      loadMonth(currentYear, currentMonthNumber).catch(err => {
        setError(err instanceof Error ? err.message : 'Failed to load month')
      })
    }
  }, [currentBudget, currentMonth, monthLoading, currentYear, currentMonthNumber, loadMonth])

  // Load payees when budget is loaded
  useEffect(() => {
    if (currentBudget) {
      loadPayees().catch(err => {
        console.warn('Failed to load payees:', err)
      })
    }
  }, [currentBudget, loadPayees])

  // Initialize local allocations when month changes (only for non-percentage categories)
  useEffect(() => {
    if (!currentMonth) return

    const allocMap: Record<string, string> = {}
    // Pre-populate with saved allocations or default amounts
    // Percentage-based categories are calculated separately and not stored in localAllocations
    Object.entries(categories).forEach(([catId, cat]) => {
      // Skip percentage-based categories - they're auto-calculated
      if (cat.default_monthly_type === 'percentage') {
        return
      }

      const existingAlloc = currentMonth.allocations?.find(a => a.category_id === catId)
      if (existingAlloc) {
        allocMap[catId] = existingAlloc.amount.toString()
      } else if (cat.default_monthly_amount !== undefined && cat.default_monthly_amount > 0) {
        allocMap[catId] = cat.default_monthly_amount.toString()
      } else {
        allocMap[catId] = ''
      }
    })
    setLocalAllocations(allocMap)
  }, [currentMonth?.year, currentMonth?.month, categories])

  // Helper to get effective is_active value considering group overrides
  function getEffectiveActive(account: FinancialAccount): boolean {
    const group = account.account_group_id ? accountGroups[account.account_group_id] : undefined
    if (group?.is_active !== undefined) return group.is_active
    return account.is_active !== false
  }

  // Helper to get effective on_budget value considering group overrides
  function getEffectiveOnBudget(account: FinancialAccount): boolean {
    const group = account.account_group_id ? accountGroups[account.account_group_id] : undefined
    if (group?.on_budget !== undefined) return group.on_budget
    return account.on_budget !== false
  }

  // Account entry type for working with accounts map
  type AccountEntry = [string, FinancialAccount]

  // Filter accounts for income dropdown:
  // 1. Must be active and on-budget (considering group-level overrides)
  // 2. If income accounts are marked, use those; otherwise fall back to all eligible accounts
  const activeOnBudgetAccounts = Object.entries(accounts).filter(([_, a]) => getEffectiveActive(a) && getEffectiveOnBudget(a)) as AccountEntry[]
  const markedIncomeAccounts = activeOnBudgetAccounts.filter(([_, a]) => a.is_income_account)
  const incomeAccounts = markedIncomeAccounts.length > 0 ? markedIncomeAccounts : activeOnBudgetAccounts
  const defaultIncomeAccountEntry = activeOnBudgetAccounts.find(([_, a]) => a.is_income_default)
  const defaultIncomeAccountId = defaultIncomeAccountEntry ? defaultIncomeAccountEntry[0] : undefined

  // If no current budget but there are pending invites, show invite selection
  if (!currentBudget && hasPendingInvites) {
    return (
      <PageContainer>
        <nav style={navBar}>
          <Link to="/">← Back to Home</Link>
        </nav>
        <PendingInvitesScreen
          invites={pendingInvites}
          onAccept={acceptBudgetInvite}
          onCreateNew={createNewBudget}
        />
      </PageContainer>
    )
  }

  // If user needs to create their first budget (no invites, no existing budgets)
  if (!currentBudget && needsFirstBudget) {
    return (
      <PageContainer>
        <nav style={navBar}>
          <Link to="/">← Back to Home</Link>
        </nav>
        <CreateFirstBudgetScreen onCreateNew={createNewBudget} />
      </PageContainer>
    )
  }

  // Handle month navigation
  async function handlePreviousMonth() {
    setError(null)
    setIsEditingAppliedAllocations(false)
    try {
      await goToPreviousMonth()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to navigate')
    }
  }

  async function handleNextMonth() {
    setError(null)
    setIsEditingAppliedAllocations(false)
    try {
      await goToNextMonth()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to navigate')
    }
  }

  // Handle income operations
  function handleAddIncome(amount: number, accountId: string, date: string, payee?: string, description?: string) {
    setError(null)
    // Close form immediately (optimistic)
    setShowAddIncome(false)
    // Save in background
    addIncome(amount, accountId, date, payee, description).catch(err => {
      setError(err instanceof Error ? err.message : 'Failed to add income')
    })
  }

  function handleUpdateIncome(incomeId: string, amount: number, accountId: string, date: string, payee?: string, description?: string) {
    setError(null)
    // Close form immediately (optimistic)
    setEditingIncomeId(null)
    // Save in background
    updateIncome(incomeId, amount, accountId, date, payee, description).catch(err => {
      setError(err instanceof Error ? err.message : 'Failed to update income')
    })
  }

  async function handleRecompute() {
    setError(null)
    setIsRecomputing(true)
    setShowRecomputeModal(true)
    setRecomputeResults({ status: 'pending' })

    try {
      // Step 1: Count income transactions
      await new Promise(resolve => setTimeout(resolve, 300)) // Brief delay for UX
      const incomeCount = currentMonth?.income.length || 0
      const oldTotal = currentMonth?.total_income || 0
      setRecomputeResults({ status: 'counting', incomeCount, oldTotal })

      // Step 2: Calculate new total
      await new Promise(resolve => setTimeout(resolve, 300))
      const newTotal = currentMonth?.income.reduce((sum, inc) => sum + inc.amount, 0) || 0
      setRecomputeResults({ status: 'calculating', incomeCount, oldTotal, newTotal })

      // Step 3: Save to database
      await new Promise(resolve => setTimeout(resolve, 200))
      setRecomputeResults({ status: 'saving', incomeCount, oldTotal, newTotal })

      await recomputeMonthTotals()

      // Done!
      setRecomputeResults({ status: 'done', incomeCount, oldTotal, newTotal })
    } catch (err) {
      setRecomputeResults({
        status: 'error',
        error: err instanceof Error ? err.message : 'Failed to recompute totals'
      })
    } finally {
      setIsRecomputing(false)
    }
  }

  function handleDeleteIncome(incomeId: string) {
    if (!confirm('Are you sure you want to delete this income entry?')) return
    setError(null)
    // Delete in background (UI updates happen in context)
    deleteIncome(incomeId).catch(err => {
      setError(err instanceof Error ? err.message : 'Failed to delete income')
    })
  }

  // Calculate total income for the month
  const totalMonthlyIncome = currentMonth?.income.reduce((sum, inc) => sum + inc.amount, 0) || 0

  // Helper to get allocation amount for a category (handles percentage-based)
  function getAllocationAmount(catId: string, cat: Category): number {
    if (cat.default_monthly_type === 'percentage' && cat.default_monthly_amount !== undefined) {
      return (cat.default_monthly_amount / 100) * previousMonthIncome
    }
    const val = localAllocations[catId]
    const num = parseFloat(val || '0')
    return isNaN(num) ? 0 : num
  }

  // Calculate allocation totals (includes both manual and percentage-based)
  // Using useMemo to ensure proper recalculation when localAllocations changes
  const currentDraftTotal = useMemo(() => {
    return Object.entries(categories).reduce((sum, [catId, cat]) => {
      if (cat.default_monthly_type === 'percentage' && cat.default_monthly_amount !== undefined) {
        return sum + (cat.default_monthly_amount / 100) * previousMonthIncome
      }
      const val = localAllocations[catId]
      const num = parseFloat(val || '0')
      return sum + (isNaN(num) ? 0 : num)
    }, 0)
  }, [categories, localAllocations, previousMonthIncome])

  const onBudgetTotal = getOnBudgetTotal()

  // Calculate current month's already-finalized allocation total
  const currentMonthFinalizedTotal = currentMonth?.allocations_finalized
    ? (currentMonth.allocations || []).reduce((sum, a) => sum + a.amount, 0)
    : 0

  // Available Now = on-budget total minus all finalized allocations
  const availableNow = onBudgetTotal - totalFinalizedAllocations

  // Available After Apply = what it would be if we apply current draft
  // If already finalized, we need to account for the difference between draft and what's currently finalized
  const availableAfterApply = useMemo(() => {
    return availableNow - currentDraftTotal + currentMonthFinalizedTotal
  }, [availableNow, currentDraftTotal, currentMonthFinalizedTotal])

  // Category entry type for working with categories map
  type CategoryEntry = [string, Category]

  // Organize categories by group for allocations display
  const sortedCategoryGroups = [...categoryGroups].sort((a, b) => a.sort_order - b.sort_order)
  const categoriesByGroup = Object.entries(categories).reduce((acc, [catId, cat]) => {
    const groupId = cat.category_group_id || 'ungrouped'
    if (!acc[groupId]) acc[groupId] = []
    acc[groupId].push([catId, cat] as CategoryEntry)
    return acc
  }, {} as Record<string, CategoryEntry[]>)

  // Sort categories within each group
  Object.keys(categoriesByGroup).forEach(groupId => {
    categoriesByGroup[groupId].sort((a, b) => a[1].sort_order - b[1].sort_order)
  })

  // Handle allocation changes
  function handleAllocationChange(categoryId: string, value: string) {
    setLocalAllocations(prev => ({
      ...prev,
      [categoryId]: value,
    }))
  }

  // Reset allocations back to what's saved/applied (for Cancel button)
  function resetAllocationsToSaved() {
    if (!currentMonth) return
    const allocMap: Record<string, string> = {}
    Object.entries(categories).forEach(([catId, cat]) => {
      if (cat.default_monthly_type === 'percentage') return
      const existingAlloc = currentMonth.allocations?.find(a => a.category_id === catId)
      if (existingAlloc) {
        allocMap[catId] = existingAlloc.amount.toString()
      } else if (cat.default_monthly_amount !== undefined && cat.default_monthly_amount > 0) {
        allocMap[catId] = cat.default_monthly_amount.toString()
      } else {
        allocMap[catId] = ''
      }
    })
    setLocalAllocations(allocMap)
    setIsEditingAppliedAllocations(false)
  }

  // Build allocations array including percentage-based categories
  function buildAllocationsArray(): CategoryAllocation[] {
    const allocations: CategoryAllocation[] = []
    Object.entries(categories).forEach(([catId, cat]) => {
      const amount = getAllocationAmount(catId, cat)
      if (amount > 0) {
        allocations.push({ category_id: catId, amount })
      }
    })
    return allocations
  }

  // Save allocations to database
  async function handleSaveAllocations() {
    setError(null)
    setIsSavingAllocations(true)
    try {
      await saveAllocations(buildAllocationsArray())
      setIsEditingAppliedAllocations(false)
      // Context automatically updates category_balances on budget doc when saving finalized allocations
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save allocations')
    } finally {
      setIsSavingAllocations(false)
    }
  }

  // Finalize allocations
  async function handleFinalizeAllocations() {
    setError(null)
    setIsFinalizingAllocations(true)
    try {
      // First save any pending changes (including percentage-based)
      await saveAllocations(buildAllocationsArray())
      // Then finalize - context automatically updates category_balances on budget doc
      await finalizeAllocations()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to finalize allocations')
    } finally {
      setIsFinalizingAllocations(false)
    }
  }

  return (
    <PageContainer>
      <nav style={navBar}>
        <Link to="/">← Back to Home</Link>
        <Link
          to="/budget/admin"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '2.5rem',
            height: '2.5rem',
            borderRadius: '8px',
            background: 'color-mix(in srgb, currentColor 8%, transparent)',
            textDecoration: 'none',
            fontSize: '1.25rem',
            transition: 'background 0.15s',
          }}
          title={isOwner ? 'Admin Settings' : 'Budget Settings'}
        >
          ⚙️
        </Link>
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
        <h1 style={{ margin: 0 }}>Budget</h1>
        {currentBudget && (
          <span style={{
            background: `color-mix(in srgb, ${colors.primary} 15%, transparent)`,
            color: colors.primaryLight,
            padding: '0.25rem 0.75rem',
            borderRadius: '6px',
            fontSize: '0.85rem',
            fontWeight: 500,
          }}>
            {currentBudget.name}
          </span>
        )}
      </div>

      {currentBudget && (
        <p style={{ opacity: 0.6, fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          {currentBudget.user_ids.length} user{currentBudget.user_ids.length !== 1 ? 's' : ''} •
          {isOwner ? ' You are the owner' : ' Shared with you'}
        </p>
      )}

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {/* Month Navigation */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        marginBottom: '1.5rem',
        padding: '1rem',
        background: 'color-mix(in srgb, currentColor 5%, transparent)',
        borderRadius: '12px',
      }}>
        <button
          onClick={handlePreviousMonth}
          disabled={monthLoading}
          style={{
            background: 'color-mix(in srgb, currentColor 10%, transparent)',
            border: 'none',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            cursor: monthLoading ? 'not-allowed' : 'pointer',
            fontSize: '1.25rem',
            opacity: monthLoading ? 0.5 : 1,
            transition: 'opacity 0.15s, background 0.15s',
          }}
          title="Previous month"
        >
          ←
        </button>

        <div ref={monthMenuRef} style={{ textAlign: 'center', minWidth: '180px', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: '0.25rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.5rem' }}>
              {MONTH_NAMES[currentMonthNumber - 1]} {currentYear}
            </h2>
            <button
              onClick={() => setShowMonthMenu(!showMonthMenu)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.5rem',
                opacity: 0.4,
                padding: '0.15rem',
                borderRadius: '4px',
                transition: 'opacity 0.15s, transform 0.15s',
                transform: showMonthMenu ? 'rotate(180deg)' : 'rotate(0deg)',
                marginTop: '0.25rem',
              }}
              title="Month options"
            >
              ▼
            </button>
          </div>
          {monthLoading && (
            <>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                marginTop: '0.35rem',
              }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: '14px',
                    height: '14px',
                    border: '2px solid color-mix(in srgb, currentColor 20%, transparent)',
                    borderTopColor: colors.primary,
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
                <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Loading...</span>
              </div>
            </>
          )}
          {/* Month options menu */}
          {showMonthMenu && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                marginTop: '0.5rem',
                background: 'var(--background, #242424)',
                border: '1px solid color-mix(in srgb, currentColor 20%, transparent)',
                borderRadius: '8px',
                padding: '0.25rem',
                zIndex: 10,
                minWidth: '140px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}
            >
              <button
                onClick={() => {
                  handleRecompute()
                  setShowMonthMenu(false)
                }}
                disabled={isRecomputing || monthLoading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.5rem 0.75rem',
                  cursor: isRecomputing || monthLoading ? 'not-allowed' : 'pointer',
                  fontSize: '0.85rem',
                  color: 'inherit',
                  opacity: isRecomputing || monthLoading ? 0.5 : 1,
                  textAlign: 'left',
                  transition: 'background 0.15s',
                }}
                title="Recompute totals from income transactions"
              >
                {isRecomputing ? '⏳' : '🔄'} Recompute
              </button>
            </div>
          )}
        </div>

        <button
          onClick={handleNextMonth}
          disabled={monthLoading}
          style={{
            background: 'color-mix(in srgb, currentColor 10%, transparent)',
            border: 'none',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            cursor: monthLoading ? 'not-allowed' : 'pointer',
            fontSize: '1.25rem',
            opacity: monthLoading ? 0.5 : 1,
            transition: 'opacity 0.15s, background 0.15s',
          }}
          title="Next month"
        >
          →
        </button>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '1.5rem',
      }}>
        <button
          onClick={() => setActiveTab('income')}
          style={{
            flex: 1,
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            border: activeTab === 'income' ? `2px solid ${colors.primary}` : '2px solid transparent',
            background: activeTab === 'income' ? `color-mix(in srgb, ${colors.primary} 15%, transparent)` : 'color-mix(in srgb, currentColor 8%, transparent)',
            cursor: 'pointer',
            fontWeight: activeTab === 'income' ? 600 : 400,
            fontSize: '0.95rem',
            color: 'inherit',
            transition: 'all 0.15s',
          }}
        >
          💰 Income
        </button>
        <button
          onClick={() => setActiveTab('allocations')}
          style={{
            flex: 1,
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            border: activeTab === 'allocations' ? `2px solid ${colors.primary}` : '2px solid transparent',
            background: activeTab === 'allocations' ? `color-mix(in srgb, ${colors.primary} 15%, transparent)` : 'color-mix(in srgb, currentColor 8%, transparent)',
            cursor: 'pointer',
            fontWeight: activeTab === 'allocations' ? 600 : 400,
            fontSize: '0.95rem',
            color: 'inherit',
            transition: 'all 0.15s',
          }}
        >
          📊 Allocations
          {currentMonth?.allocations_finalized && (
            <span style={{
              marginLeft: '0.5rem',
              fontSize: '0.7rem',
              background: colors.success,
              color: 'white',
              padding: '0.15rem 0.4rem',
              borderRadius: '4px',
            }}>
              Applied
            </span>
          )}
        </button>
      </div>

      {/* Income Section */}
      {activeTab === 'income' && (
      <div style={{
        background: 'color-mix(in srgb, currentColor 5%, transparent)',
        borderRadius: '12px',
        padding: '1.5rem',
        marginBottom: '1.5rem',
        opacity: monthLoading ? 0.5 : 1,
        transition: 'opacity 0.15s ease-out',
        pointerEvents: monthLoading ? 'none' : 'auto',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'stretch' : 'center',
          gap: isMobile ? '0.75rem' : '1rem',
          marginBottom: '1rem',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid color-mix(in srgb, currentColor 15%, transparent)',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Total</h3>
            <p style={{
              margin: '0.25rem 0 0 0',
              fontSize: '1.25rem',
              fontWeight: 600,
              color: getBalanceColor(totalMonthlyIncome),
            }}>
              {formatCurrency(totalMonthlyIncome)}
            </p>
          </div>
          {!showAddIncome && (
            <Button onClick={() => setShowAddIncome(true)} disabled={incomeAccounts.length === 0}>
              + Add Income
            </Button>
          )}
        </div>

        {incomeAccounts.length === 0 && (
          <p style={{ opacity: 0.6, fontSize: '0.9rem', marginBottom: '1rem' }}>
            {Object.keys(accounts).length === 0
              ? 'You need to create at least one account before adding income.'
              : 'No accounts are set up for income deposits. Edit an account and enable "Show in income deposit list".'
            }{' '}
            <Link to="/budget/accounts" style={{ color: colors.primaryLight }}>
              Manage accounts →
            </Link>
          </p>
        )}

        {/* Add Income Form */}
        {showAddIncome && (
          <div style={{ marginBottom: '1rem' }}>
            <IncomeForm
              accounts={incomeAccounts}
              accountGroups={accountGroups}
              payees={payees}
              defaultAccountId={defaultIncomeAccountId}
              defaultDate={`${currentYear}-${String(currentMonthNumber).padStart(2, '0')}-01`}
              onSubmit={(amount, accountId, date, payee, description) => handleAddIncome(amount, accountId, date, payee, description)}
              onCancel={() => setShowAddIncome(false)}
              submitLabel="Add Income"
              isMobile={isMobile}
            />
          </div>
        )}

        {/* Income List - sorted by date */}
        <div style={listContainer}>
          {currentMonth?.income
            .slice() // Create a copy to avoid mutating state
            .sort((a, b) => {
              // Sort by date ascending (earliest first)
              const dateA = a.date || ''
              const dateB = b.date || ''
              return dateA.localeCompare(dateB)
            })
            .map(income => (
            editingIncomeId === income.id ? (
              <IncomeForm
                key={income.id}
                accounts={incomeAccounts}
                accountGroups={accountGroups}
                payees={payees}
                initialData={income}
                onSubmit={(amount, accountId, date, payee, description) => handleUpdateIncome(income.id, amount, accountId, date, payee, description)}
                onCancel={() => setEditingIncomeId(null)}
                onDelete={() => handleDeleteIncome(income.id)}
                submitLabel="Save"
                isMobile={isMobile}
              />
            ) : (
              <IncomeItem
                key={income.id}
                income={income}
                accountName={accounts[income.account_id]?.nickname || 'Unknown Account'}
                accountGroupName={accounts[income.account_id]?.account_group_id ? accountGroups[accounts[income.account_id]!.account_group_id!]?.name : undefined}
                onEdit={() => setEditingIncomeId(income.id)}
                onDelete={() => handleDeleteIncome(income.id)}
                isMobile={isMobile}
              />
            )
          ))}

          {(!currentMonth?.income || currentMonth.income.length === 0) && !showAddIncome && (
            <p style={{ opacity: 0.5, fontSize: '0.9rem', textAlign: 'center', padding: '1rem' }}>
              No income recorded for this month
            </p>
          )}
        </div>
      </div>
      )}

      {/* Allocations Section */}
      {activeTab === 'allocations' && (
        <div style={{
          opacity: monthLoading ? 0.5 : 1,
          transition: 'opacity 0.15s ease-out',
          pointerEvents: monthLoading ? 'none' : 'auto',
        }}>
          {/* Allocation Summary Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}>
            <StatCard>
              <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>On-Budget Total</p>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.3rem', fontWeight: 600, color: getBalanceColor(onBudgetTotal) }}>
                {formatCurrency(onBudgetTotal)}
              </p>
            </StatCard>
            <StatCard>
              <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>Available Now</p>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.3rem', fontWeight: 600, color: getBalanceColor(availableNow) }}>
                {formatCurrency(availableNow)}
              </p>
              <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.7rem', opacity: 0.5 }}>
                (applied allocations only)
              </p>
            </StatCard>
            <StatCard>
              <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>This Month's Draft</p>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.3rem', fontWeight: 600, color: colors.primary }}>
                {formatCurrency(currentDraftTotal)}
              </p>
            </StatCard>
            <StatCard>
              <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>After Apply</p>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.3rem', fontWeight: 600, color: getBalanceColor(availableAfterApply) }}>
                {formatCurrency(availableAfterApply)}
              </p>
              <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.7rem', opacity: 0.5 }}>
                (if you apply draft)
              </p>
            </StatCard>
          </div>

          {/* Previous month income info for percentage calculations */}
          {Object.values(categories).some(c => c.default_monthly_type === 'percentage') && (
            <div style={{
              background: 'color-mix(in srgb, currentColor 5%, transparent)',
              borderRadius: '8px',
              padding: '0.6rem 1rem',
              marginBottom: '1rem',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              <span style={{ opacity: 0.6 }}>📊</span>
              <span style={{ opacity: 0.7 }}>
                Percentage allocations based on prev month income: <strong style={{ color: colors.primary }}>{formatCurrency(previousMonthIncome)}</strong>
              </span>
            </div>
          )}

          {/* Finalization Status */}
          <div style={{
            background: currentMonth?.allocations_finalized
              ? isEditingAppliedAllocations
                ? `color-mix(in srgb, ${colors.primary} 12%, transparent)`
                : `color-mix(in srgb, ${colors.success} 12%, transparent)`
              : `color-mix(in srgb, ${colors.warning} 12%, transparent)`,
            border: `1px solid ${currentMonth?.allocations_finalized ? (isEditingAppliedAllocations ? colors.primary : colors.success) : colors.warning}`,
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            marginBottom: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}>
            <div>
              <p style={{ margin: 0, fontWeight: 600, color: currentMonth?.allocations_finalized ? (isEditingAppliedAllocations ? colors.primary : colors.success) : colors.warning }}>
                {currentMonth?.allocations_finalized
                  ? isEditingAppliedAllocations
                    ? '✏️ Editing Applied Allocations'
                    : '✓ Allocations Applied'
                  : '⏳ Allocations Not Applied'}
              </p>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', opacity: 0.8 }}>
                {currentMonth?.allocations_finalized
                  ? isEditingAppliedAllocations
                    ? 'Make changes and save, or cancel to revert.'
                    : 'Click Edit to make changes to allocations.'
                  : 'Save and apply to update category balances.'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {currentMonth?.allocations_finalized ? (
                isEditingAppliedAllocations ? (
                  <>
                    <Button
                      onClick={resetAllocationsToSaved}
                      disabled={isSavingAllocations || monthLoading}
                      variant="secondary"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveAllocations}
                      disabled={isSavingAllocations || monthLoading}
                    >
                      {isSavingAllocations ? '⏳ Saving...' : '💾 Save Changes'}
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => setIsEditingAppliedAllocations(true)}
                    disabled={monthLoading}
                    variant="secondary"
                  >
                    ✏️ Edit Allocations
                  </Button>
                )
              ) : (
                <>
                  <Button
                    onClick={handleSaveAllocations}
                    disabled={isSavingAllocations || monthLoading}
                    variant="secondary"
                  >
                    {isSavingAllocations ? '⏳ Saving...' : '💾 Save Draft'}
                  </Button>
                  <Button
                    onClick={handleFinalizeAllocations}
                    disabled={isFinalizingAllocations || monthLoading}
                  >
                    {isFinalizingAllocations ? '⏳ Applying...' : '✓ Save & Apply'}
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Categories for Allocation */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {Object.keys(categories).length === 0 && (
              <p style={{ opacity: 0.6, textAlign: 'center', padding: '2rem' }}>
                No categories yet.{' '}
                <Link to="/budget/admin/categories" style={{ color: colors.primaryLight }}>
                  Create categories →
                </Link>
              </p>
            )}

            {sortedCategoryGroups.map(group => {
              const groupCats = categoriesByGroup[group.id] || []
              if (groupCats.length === 0) return null

              const groupTotal = groupCats.reduce((sum, [catId, cat]) => {
                return sum + getAllocationAmount(catId, cat)
              }, 0)

              return (
                <div
                  key={group.id}
                  style={{
                    background: 'color-mix(in srgb, currentColor 5%, transparent)',
                    borderRadius: '12px',
                    padding: '1rem',
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.75rem',
                    paddingBottom: '0.5rem',
                    borderBottom: '1px solid color-mix(in srgb, currentColor 15%, transparent)',
                  }}>
                    <h3 style={{ ...sectionHeader, margin: 0 }}>
                      {group.name}
                      <span style={{ marginLeft: '0.5rem', opacity: 0.5, fontWeight: 400, fontSize: '0.9rem' }}>
                        ({groupCats.length})
                      </span>
                    </h3>
                    <span style={{ fontWeight: 600, color: colors.primary }}>
                      {formatCurrency(groupTotal)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {groupCats.map(([catId, cat]) => (
                      <AllocationRow
                        key={catId}
                        catId={catId}
                        category={cat}
                        value={localAllocations[catId] || ''}
                        onChange={(val) => handleAllocationChange(catId, val)}
                        previousMonthIncome={previousMonthIncome}
                        disabled={currentMonth?.allocations_finalized && !isEditingAppliedAllocations}
                      />
                    ))}
                  </div>
                </div>
              )
            })}

            {/* Ungrouped categories */}
            {(() => {
              const ungroupedCats = categoriesByGroup['ungrouped'] || []
              if (ungroupedCats.length === 0) return null

              const ungroupedTotal = ungroupedCats.reduce((sum, [catId, cat]) => {
                return sum + getAllocationAmount(catId, cat)
              }, 0)

              return (
                <div
                  style={{
                    background: 'color-mix(in srgb, currentColor 5%, transparent)',
                    borderRadius: '12px',
                    padding: '1rem',
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.75rem',
                    paddingBottom: '0.5rem',
                    borderBottom: '1px solid color-mix(in srgb, currentColor 15%, transparent)',
                  }}>
                    <h3 style={{ ...sectionHeader, margin: 0, opacity: 0.7 }}>
                      Uncategorized
                      <span style={{ marginLeft: '0.5rem', opacity: 0.5, fontWeight: 400, fontSize: '0.9rem' }}>
                        ({ungroupedCats.length})
                      </span>
                    </h3>
                    <span style={{ fontWeight: 600, color: colors.primary }}>
                      {formatCurrency(ungroupedTotal)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {ungroupedCats.map(([catId, cat]) => (
                      <AllocationRow
                        key={catId}
                        catId={catId}
                        category={cat}
                        value={localAllocations[catId] || ''}
                        onChange={(val) => handleAllocationChange(catId, val)}
                        previousMonthIncome={previousMonthIncome}
                        disabled={currentMonth?.allocations_finalized && !isEditingAppliedAllocations}
                      />
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* Recompute Modal */}
      <Modal
        isOpen={showRecomputeModal}
        onClose={() => {
          if (recomputeResults?.status === 'done' || recomputeResults?.status === 'error') {
            setShowRecomputeModal(false)
            setRecomputeResults(null)
          }
        }}
        title="Recompute Monthly Totals"
      >
        <div style={{ padding: '0.5rem 0' }}>
          <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.9rem', opacity: 0.7 }}>
            Recalculating income totals for {MONTH_NAMES[currentMonthNumber - 1]} {currentYear}
          </p>

          {/* Progress Steps */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Step 1: Count transactions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{
                fontSize: '1.1rem',
                width: '1.5rem',
                textAlign: 'center',
              }}>
                {recomputeResults?.status === 'pending' ? '⏳' : '✅'}
              </span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 500 }}>Count income transactions</p>
                {recomputeResults && recomputeResults.status !== 'pending' && (
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', opacity: 0.6 }}>
                    Found {recomputeResults.incomeCount} transaction{recomputeResults.incomeCount !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>

            {/* Step 2: Calculate total */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{
                fontSize: '1.1rem',
                width: '1.5rem',
                textAlign: 'center',
              }}>
                {!recomputeResults || recomputeResults.status === 'pending' || recomputeResults.status === 'counting'
                  ? (recomputeResults?.status === 'counting' ? '⏳' : '⬜')
                  : '✅'}
              </span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 500 }}>Calculate new total</p>
                {recomputeResults && recomputeResults.newTotal !== undefined && (
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', opacity: 0.6 }}>
                    {formatCurrency(recomputeResults.oldTotal || 0)} → {formatCurrency(recomputeResults.newTotal)}
                    {recomputeResults.oldTotal !== recomputeResults.newTotal && (
                      <span style={{
                        marginLeft: '0.5rem',
                        color: recomputeResults.newTotal > (recomputeResults.oldTotal || 0) ? colors.success : colors.warning,
                      }}>
                        ({recomputeResults.newTotal > (recomputeResults.oldTotal || 0) ? '+' : ''}
                        {formatCurrency(recomputeResults.newTotal - (recomputeResults.oldTotal || 0))})
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>

            {/* Step 3: Save to database */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{
                fontSize: '1.1rem',
                width: '1.5rem',
                textAlign: 'center',
              }}>
                {!recomputeResults || ['pending', 'counting', 'calculating'].includes(recomputeResults.status)
                  ? '⬜'
                  : recomputeResults.status === 'saving'
                    ? '⏳'
                    : recomputeResults.status === 'error' ? '❌' : '✅'}
              </span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 500 }}>Save to database</p>
                {recomputeResults?.status === 'done' && (
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', opacity: 0.6 }}>
                    Month document updated
                  </p>
                )}
                {recomputeResults?.status === 'error' && (
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: colors.error }}>
                    {recomputeResults.error}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Result summary */}
          {recomputeResults?.status === 'done' && (
            <div style={{
              marginTop: '1.5rem',
              padding: '1rem',
              background: `color-mix(in srgb, ${colors.success} 10%, transparent)`,
              border: `1px solid ${colors.success}`,
              borderRadius: '8px',
            }}>
              <p style={{ margin: 0, fontWeight: 600, color: colors.success }}>
                ✓ Recompute complete!
              </p>
              {recomputeResults.oldTotal !== recomputeResults.newTotal ? (
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', opacity: 0.8 }}>
                  Total income updated from {formatCurrency(recomputeResults.oldTotal || 0)} to {formatCurrency(recomputeResults.newTotal || 0)}
                </p>
              ) : (
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', opacity: 0.8 }}>
                  Total income confirmed: {formatCurrency(recomputeResults.newTotal || 0)} (no changes needed)
                </p>
              )}
            </div>
          )}

          {/* Close button */}
          {(recomputeResults?.status === 'done' || recomputeResults?.status === 'error') && (
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <Button onClick={() => {
                setShowRecomputeModal(false)
                setRecomputeResults(null)
              }}>
                Done
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </PageContainer>
  )
}

// Allocation Row Component
interface AllocationRowProps {
  catId: string
  category: Category
  value: string
  onChange: (value: string) => void
  previousMonthIncome: number
  disabled?: boolean
}

function AllocationRow({ catId: _catId, category, value, onChange, previousMonthIncome, disabled }: AllocationRowProps) {
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

// Income Form Component
type IncomeAccountEntry = [string, FinancialAccount]

interface IncomeFormProps {
  accounts: IncomeAccountEntry[]
  accountGroups: AccountGroupsMap
  payees: string[]
  initialData?: IncomeTransaction
  defaultAccountId?: string
  defaultDate?: string // YYYY-MM-DD format
  onSubmit: (amount: number, accountId: string, date: string, payee?: string, description?: string) => void
  onCancel: () => void
  onDelete?: () => void // Optional delete handler (shown when editing)
  submitLabel: string
  isMobile?: boolean
}

function IncomeForm({ accounts, accountGroups, payees, initialData, defaultAccountId, defaultDate, onSubmit, onCancel, onDelete, submitLabel, isMobile }: IncomeFormProps) {
  // Default to today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0]
  const [amount, setAmount] = useState(initialData?.amount?.toString() || '')
  const [accountId, setAccountId] = useState(initialData?.account_id || defaultAccountId || (accounts[0] ? accounts[0][0] : ''))
  const [date, setDate] = useState(initialData?.date || defaultDate || today)
  const [payee, setPayee] = useState(initialData?.payee || '')
  const [description, setDescription] = useState(initialData?.description || '')

  // Group accounts by their account group for the dropdown
  const accountsByGroup: Record<string, IncomeAccountEntry[]> = {}
  const ungroupedAccounts: IncomeAccountEntry[] = []

  accounts.forEach(([accId, account]) => {
    if (account.account_group_id) {
      if (!accountsByGroup[account.account_group_id]) {
        accountsByGroup[account.account_group_id] = []
      }
      accountsByGroup[account.account_group_id].push([accId, account])
    } else {
      ungroupedAccounts.push([accId, account])
    }
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) return
    if (!accountId) return
    if (!date) return
    onSubmit(parsedAmount, accountId, date, payee.trim() || undefined, description.trim() || undefined)
  }

  const gridStyle = isMobile
    ? { display: 'flex', flexDirection: 'column' as const, gap: '1rem' }
    : { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }

  return (
    <FormWrapper onSubmit={handleSubmit}>
      <div style={gridStyle}>
        <FormField label="Amount" htmlFor="income-amount">
          <CurrencyInput
            id="income-amount"
            value={amount}
            onChange={setAmount}
            placeholder="$0.00"
            required
            autoFocus
          />
        </FormField>
        <FormField label="Date" htmlFor="income-date">
          <TextInput
            id="income-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </FormField>
      </div>
      <div style={gridStyle}>
        <FormField label="Deposit To" htmlFor="income-account">
          <SelectInput
            id="income-account"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            required
          >
            {/* Render grouped accounts with optgroups */}
            {Object.entries(accountGroups).map(([groupId, group]) => {
              const groupAccounts = accountsByGroup[groupId]
              if (!groupAccounts || groupAccounts.length === 0) return null
              return (
                <optgroup key={groupId} label={group.name}>
                  {groupAccounts.map(([accId, account]) => (
                    <option key={accId} value={accId}>
                      {account.nickname}
                    </option>
                  ))}
                </optgroup>
              )
            })}
            {/* Ungrouped accounts */}
            {ungroupedAccounts.length > 0 && (
              <optgroup label="Other">
                {ungroupedAccounts.map(([accId, account]) => (
                  <option key={accId} value={accId}>
                    {account.nickname}
                  </option>
                ))}
              </optgroup>
            )}
          </SelectInput>
        </FormField>
        <FormField label="Payee" htmlFor="income-payee">
          <PayeeAutocomplete
            id="income-payee"
            value={payee}
            onChange={setPayee}
            payees={payees}
            placeholder="e.g., Employer, Client name"
          />
        </FormField>
      </div>
      <FormField label="Description (optional)" htmlFor="income-description">
        <TextInput
          id="income-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g., January paycheck, Project bonus"
        />
      </FormField>
      <FormButtonGroup>
        <Button type="submit">{submitLabel}</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        {onDelete && (
          <Button
            type="button"
            variant="danger"
            onClick={onDelete}
            style={{ marginLeft: 'auto' }}
          >
            🗑️ Delete
          </Button>
        )}
      </FormButtonGroup>
    </FormWrapper>
  )
}

// Income Item Component
interface IncomeItemProps {
  income: IncomeTransaction
  accountName: string
  accountGroupName?: string
  onEdit: () => void
  onDelete: () => void
  isMobile?: boolean
}

function IncomeItem({ income, accountName, accountGroupName, onEdit, onDelete, isMobile }: IncomeItemProps) {
  return (
    <div
      onClick={isMobile ? onEdit : undefined}
      style={{
        background: 'color-mix(in srgb, currentColor 8%, transparent)',
        padding: isMobile ? '0.875rem 1rem' : '1rem 1.25rem',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'stretch' : 'center',
        gap: isMobile ? '0.5rem' : '1rem',
        cursor: isMobile ? 'pointer' : 'default',
        transition: isMobile ? 'background 0.15s' : 'none',
      }}
    >
      <div style={{ flex: 1 }}>
        {/* Top row: Date + Amount */}
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '0.75rem',
          marginBottom: income.payee ? '0.25rem' : 0,
        }}>
          {income.date && (
            <span style={{
              fontSize: '0.8rem',
              opacity: 0.6,
              fontFamily: 'monospace',
            }}>
              {new Date(income.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
          <span style={{
            fontSize: '1.15rem',
            fontWeight: 600,
            color: colors.success,
          }}>
            +{formatCurrency(income.amount)}
          </span>
        </div>
        {/* Payee */}
        {income.payee && (
          <div style={{
            fontSize: '0.95rem',
            fontWeight: 500,
            marginBottom: '0.25rem',
          }}>
            {income.payee}
          </div>
        )}
        {/* Account destination */}
        <div style={{
          fontSize: '0.85rem',
          opacity: 0.7,
          background: 'color-mix(in srgb, currentColor 10%, transparent)',
          padding: '0.15rem 0.5rem',
          borderRadius: '4px',
          display: 'inline-block',
        }}>
          → {accountName}{accountGroupName ? ` / ${accountGroupName}` : ''}
        </div>
        {income.description && (
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', opacity: 0.7 }}>
            {income.description}
          </p>
        )}
      </div>
      {/* Only show edit/delete buttons on desktop */}
      {!isMobile && (
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          justifyContent: 'center',
        }}>
          <button
            onClick={onEdit}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              opacity: 0.6,
              fontSize: '0.9rem',
              padding: '0.25rem',
            }}
            title="Edit"
          >
            ✏️
          </button>
          <button
            onClick={onDelete}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              opacity: 0.6,
              fontSize: '0.9rem',
              padding: '0.25rem',
            }}
            title="Delete"
          >
            🗑️
          </button>
        </div>
      )}
    </div>
  )
}

interface CreateFirstBudgetScreenProps {
  onCreateNew: (name?: string) => Promise<void>
}

function CreateFirstBudgetScreen({ onCreateNew }: CreateFirstBudgetScreenProps) {
  const [budgetName, setBudgetName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setIsCreating(true)
    setError(null)

    try {
      await onCreateNew(budgetName.trim() || undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create budget')
      setIsCreating(false)
    }
  }

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '0.5rem' }}>Welcome!</h1>
      <p style={{ opacity: 0.7, marginBottom: '2rem' }}>
        You don't have any budgets yet. Create your first budget to get started.
      </p>

      {error && (
        <div style={{
          background: 'rgba(220, 38, 38, 0.1)',
          border: '1px solid rgba(220, 38, 38, 0.3)',
          color: '#f87171',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#f87171',
              cursor: 'pointer',
              fontSize: '1.2rem',
              padding: '0 0.25rem',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      )}

      <div style={{
        background: 'color-mix(in srgb, #646cff 8%, transparent)',
        border: '1px solid color-mix(in srgb, #646cff 25%, transparent)',
        padding: '2rem',
        borderRadius: '12px',
      }}>
        <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>✨</span> Create Your Budget
        </h2>

        <form onSubmit={handleCreate}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', opacity: 0.8 }}>
              Budget Name
            </label>
            <input
              type="text"
              value={budgetName}
              onChange={(e) => setBudgetName(e.target.value)}
              placeholder="My Budget"
              autoFocus
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: '1px solid color-mix(in srgb, currentColor 25%, transparent)',
                background: 'color-mix(in srgb, currentColor 5%, transparent)',
                fontSize: '1rem',
                color: 'inherit',
                boxSizing: 'border-box',
              }}
            />
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', opacity: 0.5 }}>
              You can always rename this later
            </p>
          </div>

          <button
            type="submit"
            disabled={isCreating}
            style={{
              width: '100%',
              background: colors.primary,
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              cursor: isCreating ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              opacity: isCreating ? 0.7 : 1,
              fontSize: '1rem',
            }}
          >
            {isCreating ? 'Creating...' : 'Create Budget'}
          </button>
        </form>
      </div>

      <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.85rem', opacity: 0.6 }}>
        If someone has invited you to their budget, you can accept the invitation from the budget settings page after creating your account.
      </p>
    </div>
  )
}

interface PendingInvitesScreenProps {
  invites: BudgetInvite[]
  onAccept: (budgetId: string) => Promise<void>
  onCreateNew: (name?: string) => Promise<void>
}

function PendingInvitesScreen({ invites, onAccept, onCreateNew }: PendingInvitesScreenProps) {
  const [isAccepting, setIsAccepting] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [budgetName, setBudgetName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAccept(budgetId: string) {
    setIsAccepting(budgetId)
    setError(null)

    try {
      await onAccept(budgetId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation')
      setIsAccepting(null)
    }
  }

  async function handleCreateNew(e: React.FormEvent) {
    e.preventDefault()
    setIsCreating(true)
    setError(null)

    try {
      await onCreateNew(budgetName.trim() || undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create new budget')
      setIsCreating(false)
    }
  }

  return (
    <div>
      <h1 style={{ marginBottom: '0.5rem' }}>Welcome!</h1>
      <p style={{ opacity: 0.7, marginBottom: '2rem' }}>
        You've been invited to join {invites.length === 1 ? 'a budget' : 'some budgets'}. Choose one to get started!
      </p>

      {error && (
        <div style={{
          background: 'rgba(220, 38, 38, 0.1)',
          border: '1px solid rgba(220, 38, 38, 0.3)',
          color: '#f87171',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#f87171',
              cursor: 'pointer',
              fontSize: '1.2rem',
              padding: '0 0.25rem',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Pending Invitations */}
      <div style={{
        background: 'color-mix(in srgb, #f59e0b 8%, transparent)',
        border: '1px solid color-mix(in srgb, #f59e0b 25%, transparent)',
        padding: '1.5rem',
        borderRadius: '12px',
        marginBottom: '1.5rem',
      }}>
        <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>📨</span> Budget Invitations
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {invites.map((invite) => (
            <div
              key={invite.budgetId}
              style={{
                background: 'color-mix(in srgb, currentColor 8%, transparent)',
                padding: '1rem 1.25rem',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ flex: 1, minWidth: '200px' }}>
                <p style={{ margin: '0 0 0.25rem 0', fontWeight: 600, fontSize: '1.05rem' }}>
                  {invite.budgetName}
                </p>
                {invite.ownerEmail && (
                  <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.6 }}>
                    From: {invite.ownerEmail}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleAccept(invite.budgetId)}
                disabled={isAccepting !== null || isCreating}
                style={{
                  background: '#22c55e',
                  color: 'white',
                  border: 'none',
                  padding: '0.6rem 1.5rem',
                  borderRadius: '8px',
                  cursor: isAccepting !== null || isCreating ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                  opacity: isAccepting !== null || isCreating ? 0.7 : 1,
                  fontSize: '0.9rem',
                }}
              >
                {isAccepting === invite.budgetId ? 'Joining...' : 'Accept & Join'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Create New Budget Option */}
      <div style={{
        background: 'color-mix(in srgb, currentColor 5%, transparent)',
        border: '1px dashed color-mix(in srgb, currentColor 20%, transparent)',
        padding: '1.5rem',
        borderRadius: '12px',
      }}>
        {!showCreateForm ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: '0 0 1rem 0', opacity: 0.7 }}>
              Or start fresh with your own budget
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              disabled={isAccepting !== null}
              style={{
                background: colors.primary,
                color: 'white',
                border: 'none',
                padding: '0.6rem 1.5rem',
                borderRadius: '8px',
                cursor: isAccepting !== null ? 'not-allowed' : 'pointer',
                fontWeight: 500,
                opacity: isAccepting !== null ? 0.7 : 1,
                fontSize: '0.9rem',
              }}
            >
              Create New Budget
            </button>
          </div>
        ) : (
          <form onSubmit={handleCreateNew}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>Create Your Budget</h3>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', opacity: 0.8 }}>
                Budget Name
              </label>
              <input
                type="text"
                value={budgetName}
                onChange={(e) => setBudgetName(e.target.value)}
                placeholder="My Budget"
                autoFocus
                style={{
                  width: '100%',
                  padding: '0.6rem 0.8rem',
                  borderRadius: '6px',
                  border: '1px solid color-mix(in srgb, currentColor 25%, transparent)',
                  background: 'color-mix(in srgb, currentColor 5%, transparent)',
                  fontSize: '0.95rem',
                  color: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="submit"
                disabled={isCreating || isAccepting !== null}
                style={{
                  background: colors.primary,
                  color: 'white',
                  border: 'none',
                  padding: '0.6rem 1.25rem',
                  borderRadius: '6px',
                  cursor: isCreating || isAccepting !== null ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                  opacity: isCreating || isAccepting !== null ? 0.7 : 1,
                  fontSize: '0.9rem',
                }}
              >
                {isCreating ? 'Creating...' : 'Create Budget'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false)
                  setBudgetName('')
                }}
                disabled={isCreating}
                style={{
                  background: 'transparent',
                  color: 'inherit',
                  border: '1px solid color-mix(in srgb, currentColor 30%, transparent)',
                  padding: '0.6rem 1.25rem',
                  borderRadius: '6px',
                  cursor: isCreating ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                  opacity: isCreating ? 0.7 : 0.8,
                  fontSize: '0.9rem',
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default Budget
