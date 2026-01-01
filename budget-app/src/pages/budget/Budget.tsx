import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useBudget, type BudgetTab, type BalancesView } from '../../contexts/budget_context'
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
const VALID_VIEWS: BalancesView[] = ['categories', 'accounts']

function parsePathParams(params: { year?: string; month?: string; tab?: string; view?: string }) {
  const year = params.year ? parseInt(params.year, 10) : null
  const month = params.month ? parseInt(params.month, 10) : null
  const tab = params.tab && VALID_TABS.includes(params.tab as BudgetTab) ? params.tab as BudgetTab : null
  const view = params.view && VALID_VIEWS.includes(params.view as BalancesView) ? params.view as BalancesView : null

  return {
    year: year && !isNaN(year) && year >= 2000 && year <= 2100 ? year : null,
    month: month && !isNaN(month) && month >= 1 && month <= 12 ? month : null,
    tab,
    view,
  }
}

function Budget() {
  const params = useParams<{ year?: string; month?: string; tab?: string; view?: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const {
    currentUserId,
    selectedBudgetId,
    currentYear,
    currentMonthNumber,
    lastActiveTab,
    lastBalancesView,
    setCurrentYear,
    setCurrentMonthNumber,
    setLastActiveTab,
    setLastBalancesView,
    goToPreviousMonth,
    goToNextMonth,
    hasPendingInvites,
    pendingInvites,
    needsFirstBudget,
  } = useBudget()

  const {
    budget: currentBudget,
    createBudget,
    acceptInvite,
  } = useBudgetData(selectedBudgetId, currentUserId)

  const {
    month: currentMonth,
    error: monthError,
  } = useBudgetMonth(selectedBudgetId, currentYear, currentMonthNumber)

  // Check for error message in URL params (from redirect)
  const urlError = searchParams.get('error')
  const [error, setError] = useState<string | null>(urlError)
  const urlInitializedRef = useRef(false)

  // Clear error param from URL after reading it
  useEffect(() => {
    if (urlError) {
      searchParams.delete('error')
      setSearchParams(searchParams, { replace: true })
    }
  }, [urlError, searchParams, setSearchParams])

  // Handle month errors by redirecting to valid month
  useEffect(() => {
    if (!monthError) return
    const errorMsg = monthError.message || ''

    // Handle months too far in the future
    if (errorMsg.includes('months in the future') || errorMsg.includes('Refusing to create month')) {
      const now = new Date()
      let maxYear = now.getFullYear()
      let maxMonth = now.getMonth() + 1 + 3
      while (maxMonth > 12) {
        maxMonth -= 12
        maxYear += 1
      }
      const errorMessage = `Cannot navigate to ${currentYear}/${currentMonthNumber} - redirected to ${maxYear}/${maxMonth}`
      navigate(`/budget/${maxYear}/${maxMonth}/${lastActiveTab}?error=${encodeURIComponent(errorMessage)}`, { replace: true })
      return
    }

    // Handle months too far in the past
    if (errorMsg.includes('months in the past')) {
      const now = new Date()
      let minYear = now.getFullYear()
      let minMonth = now.getMonth() + 1 - 3
      while (minMonth < 1) {
        minMonth += 12
        minYear -= 1
      }
      const errorMessage = `Cannot create month ${currentYear}/${currentMonthNumber} - redirected to ${minYear}/${minMonth}`
      navigate(`/budget/${minYear}/${minMonth}/${lastActiveTab}?error=${encodeURIComponent(errorMessage)}`, { replace: true })
    }
  }, [monthError, currentYear, currentMonthNumber, lastActiveTab, navigate])

  const [activeTab, setActiveTabLocal] = useState<BudgetTab>(() => {
    const { tab } = parsePathParams(params)
    return tab ?? lastActiveTab
  })

  // View state for balances tab (categories vs accounts)
  const [balancesView, setBalancesViewLocal] = useState<BalancesView>(() => {
    const { view } = parsePathParams(params)
    return view ?? lastBalancesView
  })

  const setActiveTab = (tab: BudgetTab) => {
    setActiveTabLocal(tab)
    setLastActiveTab(tab)
  }

  const setBalancesView = (view: BalancesView) => {
    setBalancesViewLocal(view)
    setLastBalancesView(view)
  }

  useEffect(() => {
    if (urlInitializedRef.current) return
    const { year, month } = parsePathParams(params)
    if (year) setCurrentYear(year)
    if (month) setCurrentMonthNumber(month)
    urlInitializedRef.current = true
  }, [params, setCurrentYear, setCurrentMonthNumber])

  useEffect(() => {
    if (!urlInitializedRef.current) return
    // Include view segment only for balances tab
    const viewSegment = activeTab === 'balances' ? `/${balancesView}` : ''
    const newPath = `/budget/${currentYear}/${currentMonthNumber}/${activeTab}${viewSegment}`
    const currentPath = `/budget/${params.year}/${params.month}/${params.tab}${params.view ? `/${params.view}` : ''}`
    if (newPath !== currentPath) {
      navigate(newPath, { replace: true })
    }
  }, [currentYear, currentMonthNumber, activeTab, balancesView, navigate, params])

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

  if (!currentBudget && needsFirstBudget) {
    return (
      <PageContainer>
        <BudgetNavBar title="Budget" showBackArrow hideMenu />
        <CreateFirstBudgetScreen onCreateNew={handleCreateNewBudget} />
      </PageContainer>
    )
  }

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
          onPreviousMonth={handlePreviousMonth}
          onNextMonth={handleNextMonth}
        />

        <BudgetTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          allocationsFinalized={currentMonth?.are_allocations_finalized}
        />

        {activeTab === 'income' && <IncomeSection key={`${currentYear}-${currentMonthNumber}`} />}
        {activeTab === 'balances' && (
          <BalancesSection
            key={`${currentYear}-${currentMonthNumber}`}
            currentView={balancesView}
            onViewChange={setBalancesView}
          />
        )}
        {activeTab === 'spend' && <SpendSection key={`${currentYear}-${currentMonthNumber}`} />}
      </ContentContainer>
    </PageContainer>
  )
}

export default Budget
