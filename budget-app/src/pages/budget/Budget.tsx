import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useBudget } from '../../contexts/budget_context'
import { useBudgetData, useBudgetMonth } from '../../hooks'
import { PageContainer, ErrorAlert } from '../../components/ui'
import { navBar, colors } from '../../styles/shared'
import { CreateFirstBudgetScreen, PendingInvitesScreen } from '../../components/budget/Onboarding'
import {
  BudgetTabs,
  type BudgetTab,
  MonthNavigation,
  IncomeSection,
  SpendSection,
  AllocationsSection,
  BalancesSection,
  RecalculateModal,
  type RecalcResults,
} from '../../components/budget/Month'

const VALID_TABS: BudgetTab[] = ['income', 'allocations', 'spend', 'balances']

function parsePathParams(params: { year?: string; month?: string; tab?: string }) {
  const year = params.year ? parseInt(params.year, 10) : null
  const month = params.month ? parseInt(params.month, 10) : null
  const tab = params.tab && VALID_TABS.includes(params.tab as BudgetTab) ? params.tab as BudgetTab : null

  return {
    year: year && !isNaN(year) && year >= 2000 && year <= 2100 ? year : null,
    month: month && !isNaN(month) && month >= 1 && month <= 12 ? month : null,
    tab,
  }
}

function Budget() {
  const params = useParams<{ year?: string; month?: string; tab?: string }>()
  const navigate = useNavigate()

  // Context: identifiers and UI state only
  const {
    currentUserId,
    selectedBudgetId,
    currentYear,
    currentMonthNumber,
    setCurrentYear,
    setCurrentMonthNumber,
    goToPreviousMonth,
    goToNextMonth,
    hasPendingInvites,
    pendingInvites,
    needsFirstBudget,
  } = useBudget()

  // Hooks: data and mutations
  const {
    budget: currentBudget,
    isOwner,
    createBudget,
    acceptInvite,
  } = useBudgetData(selectedBudgetId, currentUserId)

  const {
    month: currentMonth,
    isLoading: monthLoading,
  } = useBudgetMonth(selectedBudgetId, currentYear, currentMonthNumber)

  const [error, setError] = useState<string | null>(null)
  const [isRecomputing, setIsRecomputing] = useState(false)
  const [showRecalcModal, setShowRecalcModal] = useState(false)
  const [recalcResults, setRecalcResults] = useState<RecalcResults | null>(null)
  const [urlInitialized, setUrlInitialized] = useState(false)

  // Initialize from URL params on mount, default to 'balances'
  const [activeTab, setActiveTab] = useState<BudgetTab>(() => {
    const { tab } = parsePathParams(params)
    return tab ?? 'balances'
  })

  // Initialize year/month from URL on first render
  useEffect(() => {
    if (urlInitialized) return
    const { year, month } = parsePathParams(params)
    if (year) setCurrentYear(year)
    if (month) setCurrentMonthNumber(month)
    setUrlInitialized(true)
  }, [params, setCurrentYear, setCurrentMonthNumber, urlInitialized])

  // Sync URL path when month/year/tab changes
  useEffect(() => {
    if (!urlInitialized) return
    const newPath = `/budget/${currentYear}/${currentMonthNumber}/${activeTab}`
    const currentPath = `/budget/${params.year}/${params.month}/${params.tab}`

    if (newPath !== currentPath) {
      navigate(newPath, { replace: true })
    }
  }, [currentYear, currentMonthNumber, activeTab, urlInitialized, navigate, params])


  // Handlers for onboarding screens
  async function handleAcceptInvite(budgetId: string) {
    try {
      await acceptInvite(budgetId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invite')
    }
  }

  async function handleCreateNewBudget(name?: string) {
    try {
      await createBudget(name || 'My Budget')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create budget')
    }
  }

  // If no current budget but there are pending invites, show invite selection
  if (!currentBudget && hasPendingInvites) {
    return (
      <PageContainer>
        <nav style={navBar}>
          <Link to="/">← Back to Home</Link>
        </nav>
        <PendingInvitesScreen
          invites={pendingInvites}
          onAccept={handleAcceptInvite}
          onCreateNew={handleCreateNewBudget}
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
        <CreateFirstBudgetScreen onCreateNew={handleCreateNewBudget} />
      </PageContainer>
    )
  }

  // Handle month navigation
  function handlePreviousMonth() {
    setError(null)
    goToPreviousMonth()
  }

  function handleNextMonth() {
    setError(null)
    goToNextMonth()
  }

  // Handle recalculate all
  async function handleRecalculateAll() {
    setError(null)
    setIsRecomputing(true)
    setShowRecalcModal(true)
    setRecalcResults({ status: 'pending' })

    try {
      // Step 1: Count income transactions
      await new Promise(resolve => setTimeout(resolve, 200))
      const incomeCount = currentMonth?.income.length || 0
      const oldIncomeTotal = currentMonth?.total_income || 0
      setRecalcResults({ status: 'income_counting', incomeCount, oldIncomeTotal })

      // Step 2: Calculate new income total
      await new Promise(resolve => setTimeout(resolve, 200))
      const newIncomeTotal = currentMonth?.income.reduce((sum, inc) => sum + inc.amount, 0) || 0
      setRecalcResults({ status: 'income_calculating', incomeCount, oldIncomeTotal, newIncomeTotal })

      // Step 3: Save income totals
      await new Promise(resolve => setTimeout(resolve, 150))
      setRecalcResults({ status: 'income_saving', incomeCount, oldIncomeTotal, newIncomeTotal })

      // Step 4: Count expenses
      await new Promise(resolve => setTimeout(resolve, 200))
      const expenseCount = currentMonth?.expenses?.length || 0
      const oldExpenseTotal = currentMonth?.total_expenses || 0
      const newExpenseTotal = currentMonth?.expenses?.reduce((sum, exp) => sum + exp.amount, 0) || 0
      setRecalcResults({
        status: 'expenses_counting',
        incomeCount, oldIncomeTotal, newIncomeTotal,
        expenseCount, oldExpenseTotal, newExpenseTotal
      })

      // Step 5: Recalculate category balances
      await new Promise(resolve => setTimeout(resolve, 200))
      setRecalcResults({
        status: 'balances_calculating',
        incomeCount, oldIncomeTotal, newIncomeTotal,
        expenseCount, oldExpenseTotal, newExpenseTotal
      })

      // Step 6: Save category balances
      await new Promise(resolve => setTimeout(resolve, 150))
      setRecalcResults({
        status: 'balances_saving',
        incomeCount, oldIncomeTotal, newIncomeTotal,
        expenseCount, oldExpenseTotal, newExpenseTotal
      })

      // Done!
      setRecalcResults({
        status: 'done',
        incomeCount, oldIncomeTotal, newIncomeTotal,
        expenseCount, oldExpenseTotal, newExpenseTotal
      })
    } catch (err) {
      setRecalcResults({
        status: 'error',
        error: err instanceof Error ? err.message : 'Failed to recalculate'
      })
    } finally {
      setIsRecomputing(false)
    }
  }

  return (
    <PageContainer>
      <nav style={navBar}>
        <Link to="/">← Back to Home</Link>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link
            to="/budget/analytics"
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
            title="Analytics"
          >
            📊
          </Link>
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
        </div>
      </nav>

      <BudgetHeader budgetName={currentBudget?.name} userCount={currentBudget?.user_ids.length} isOwner={isOwner} />

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      <MonthNavigation
        isLoading={monthLoading}
        onPreviousMonth={handlePreviousMonth}
        onNextMonth={handleNextMonth}
        onRecalculateAll={handleRecalculateAll}
        isRecomputing={isRecomputing}
      />

      <BudgetTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        allocationsFinalized={currentMonth?.allocations_finalized}
      />

      {activeTab === 'income' && <IncomeSection />}
      {activeTab === 'allocations' && <AllocationsSection />}
      {activeTab === 'spend' && <SpendSection />}
      {activeTab === 'balances' && <BalancesSection />}

      <RecalculateModal
        isOpen={showRecalcModal}
        onClose={() => {
          setShowRecalcModal(false)
          setRecalcResults(null)
        }}
        results={recalcResults}
      />
    </PageContainer>
  )
}

interface BudgetHeaderProps {
  budgetName?: string
  userCount?: number
  isOwner: boolean
}

function BudgetHeader({ budgetName, userCount, isOwner }: BudgetHeaderProps) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
        <h1 style={{ margin: 0 }}>Budget</h1>
        {budgetName && (
          <span style={{
            background: `color-mix(in srgb, ${colors.primary} 15%, transparent)`,
            color: colors.primaryLight,
            padding: '0.25rem 0.75rem',
            borderRadius: '6px',
            fontSize: '0.85rem',
            fontWeight: 500,
          }}>
            {budgetName}
          </span>
        )}
      </div>

      {userCount !== undefined && (
        <p style={{ opacity: 0.6, fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          {userCount} user{userCount !== 1 ? 's' : ''} •
          {isOwner ? ' You are the owner' : ' Shared with you'}
        </p>
      )}
    </>
  )
}

export default Budget
