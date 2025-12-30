import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useBudget, type BudgetTab } from '../../contexts/budget_context'
import { useBudgetData, useBudgetMonth } from '../../hooks'
import { PageContainer, ErrorAlert, BudgetNavBar, ContentContainer } from '../../components/ui'
import { CreateFirstBudgetScreen, PendingInvitesScreen } from '../../components/budget/Onboarding'
import {
  BudgetTabs,
  MonthNavigation,
  IncomeSection,
  SpendSection,
  BalancesSection,
} from '../../components/budget/Month'

const VALID_TABS: BudgetTab[] = ['income', 'balances', 'spend']

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
    lastActiveTab,
    setCurrentYear,
    setCurrentMonthNumber,
    setLastActiveTab,
    goToPreviousMonth,
    goToNextMonth,
    hasPendingInvites,
    pendingInvites,
    needsFirstBudget,
  } = useBudget()

  // Hooks: data and mutations
  const {
    budget: currentBudget,
    createBudget,
    acceptInvite,
  } = useBudgetData(selectedBudgetId, currentUserId)

  const {
    month: currentMonth,
    isLoading: monthLoading,
    error: monthError,
  } = useBudgetMonth(selectedBudgetId, currentYear, currentMonthNumber)

  const [error, setError] = useState<string | null>(null)
  const urlInitializedRef = useRef(false)

  // Handle "month too far in future" error - auto-navigate to max allowed month
  useEffect(() => {
    if (!monthError) return

    const errorMsg = monthError.message || ''
    if (errorMsg.includes('months in the future') || errorMsg.includes('Refusing to create month')) {
      console.log('[Budget] Month too far in future, navigating to max allowed month')

      // Calculate max allowed month (3 months from now)
      const now = new Date()
      let maxYear = now.getFullYear()
      let maxMonth = now.getMonth() + 1 + 3 // 3 months ahead

      while (maxMonth > 12) {
        maxMonth -= 12
        maxYear += 1
      }

      // Navigate to max allowed month
      setCurrentYear(maxYear)
      setCurrentMonthNumber(maxMonth)
      setError(`Cannot navigate to ${currentYear}/${currentMonthNumber} - redirected to ${maxYear}/${maxMonth}`)
    }
  }, [monthError, currentYear, currentMonthNumber, setCurrentYear, setCurrentMonthNumber])

  // Initialize from URL params on mount, fallback to context's last active tab
  const [activeTab, setActiveTabLocal] = useState<BudgetTab>(() => {
    const { tab } = parsePathParams(params)
    return tab ?? lastActiveTab
  })

  // Wrap setActiveTab to also update context
  const setActiveTab = (tab: BudgetTab) => {
    setActiveTabLocal(tab)
    setLastActiveTab(tab)
  }

  // Initialize year/month from URL on first render
  useEffect(() => {
    if (urlInitializedRef.current) return
    const { year, month } = parsePathParams(params)
    if (year) setCurrentYear(year)
    if (month) setCurrentMonthNumber(month)
    urlInitializedRef.current = true
  }, [params, setCurrentYear, setCurrentMonthNumber])

  // Sync URL path when month/year/tab changes
  useEffect(() => {
    if (!urlInitializedRef.current) return
    const newPath = `/budget/${currentYear}/${currentMonthNumber}/${activeTab}`
    const currentPath = `/budget/${params.year}/${params.month}/${params.tab}`

    if (newPath !== currentPath) {
      navigate(newPath, { replace: true })
    }
  }, [currentYear, currentMonthNumber, activeTab, navigate, params])


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
        <BudgetNavBar title="Budget" showBackArrow hideMenu />
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
        <BudgetNavBar title="Budget" showBackArrow hideMenu />
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

  return (
    <PageContainer>
      <BudgetNavBar title={currentBudget?.name || 'Budget'} />

      <ContentContainer>
        {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

        <MonthNavigation
          isLoading={monthLoading}
          onPreviousMonth={handlePreviousMonth}
          onNextMonth={handleNextMonth}
        />

        <BudgetTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          allocationsFinalized={currentMonth?.are_allocations_finalized}
        />

        {activeTab === 'income' && <IncomeSection />}
        {activeTab === 'balances' && <BalancesSection />}
        {activeTab === 'spend' && <SpendSection />}
      </ContentContainer>
    </PageContainer>
  )
}

export default Budget
