import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useBudget, type BudgetTab } from '../../contexts/budget_context'
import { useBudgetData, useBudgetMonth, useMonthNavigationError } from '../../hooks'
import { ErrorAlert, ContentContainer } from '../../components/ui'
import { CreateFirstBudgetScreen, PendingInvitesScreen } from '../../components/budget/Onboarding'
import {
  BudgetTabs,
  MonthNavigation,
  MonthIncome,
  MonthSpend,
  MonthCategories,
  MonthAccounts,
} from '../../components/budget/Month'

const VALID_TABS: BudgetTab[] = ['income', 'categories', 'accounts', 'spend']

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

  const {
    currentUserId,
    selectedBudgetId,
    currentYear,
    currentMonthNumber,
    lastActiveTab,
    setCurrentYear,
    setCurrentMonthNumber,
    setLastActiveTab,
    setPageTitle,
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

  const urlInitializedRef = useRef(false)

  // Handle month navigation errors and URL error params
  const { error, setError } = useMonthNavigationError({
    monthError,
    currentYear,
    currentMonthNumber,
    lastActiveTab,
  })

  const [activeTab, setActiveTabLocal] = useState<BudgetTab>(() => {
    const { tab } = parsePathParams(params)
    return tab ?? lastActiveTab
  })

  const setActiveTab = (tab: BudgetTab) => {
    setActiveTabLocal(tab)
    setLastActiveTab(tab)
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
    const newPath = `/budget/${currentYear}/${currentMonthNumber}/${activeTab}`
    const currentPath = `/budget/${params.year}/${params.month}/${params.tab}`
    if (newPath !== currentPath) {
      navigate(newPath, { replace: true })
    }
  }, [currentYear, currentMonthNumber, activeTab, navigate, params])

  // Set page title for layout header (useLayoutEffect runs synchronously before paint)
  useLayoutEffect(() => {
    setPageTitle(currentBudget?.name || 'Budget')
  }, [currentBudget?.name, setPageTitle])

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
      <PendingInvitesScreen
        invites={pendingInvites}
        onAccept={handleAcceptInvite}
        onCreateNew={handleCreateNewBudget}
      />
    )
  }

  if (!currentBudget && needsFirstBudget) {
    return <CreateFirstBudgetScreen onCreateNew={handleCreateNewBudget} />
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

      {activeTab === 'income' && <MonthIncome key={`${currentYear}-${currentMonthNumber}`} />}
      {activeTab === 'categories' && <MonthCategories key={`${currentYear}-${currentMonthNumber}`} />}
      {activeTab === 'accounts' && <MonthAccounts key={`${currentYear}-${currentMonthNumber}`} />}
      {activeTab === 'spend' && <MonthSpend key={`${currentYear}-${currentMonthNumber}`} />}
    </ContentContainer>
  )
}

export default Budget
