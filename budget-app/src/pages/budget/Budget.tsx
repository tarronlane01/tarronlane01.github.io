import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../../contexts/app_context'
import { useBudget, type BudgetTab } from '../../contexts/budget_context'
import { useBudgetData, useBudgetMonth } from '../../hooks'
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

/**
 * Get the current month (today's date)
 */
function getCurrentMonth(): { year: number; month: number } {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

function Budget() {
  const params = useParams<{ year?: string; month?: string; tab?: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const { addLoadingHold, removeLoadingHold } = useApp()

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
    isLoading: isBudgetLoading,
    createBudget,
    acceptInvite,
  } = useBudgetData(selectedBudgetId, currentUserId)

  // Budget data is loaded when not loading (monthMap might be empty if no months exist)
  const isBudgetDataLoaded = !isBudgetLoading

  // Track if we're in the middle of a redirect due to month creation error
  const [isRedirecting, setIsRedirecting] = useState(false)

  // Add loading hold while waiting for budget data to be available
  useEffect(() => {
    if (!isBudgetDataLoaded) {
      addLoadingHold('budget-data', 'Loading budget data...')
    }
    return () => removeLoadingHold('budget-data')
  }, [isBudgetDataLoaded, addLoadingHold, removeLoadingHold])

  const urlInitializedRef = useRef(false)

  // Handle URL error params
  const urlError = searchParams.get('error')
  const [error, setError] = useState<string | null>(urlError)

  // Clear error param from URL after reading it
  useEffect(() => {
    if (urlError) {
      searchParams.delete('error')
      setSearchParams(searchParams, { replace: true })
    }
  }, [urlError, searchParams, setSearchParams])

  const [activeTab, setActiveTabLocal] = useState<BudgetTab>(() => {
    const { tab } = parsePathParams(params)
    return tab ?? lastActiveTab
  })

  const setActiveTab = (tab: BudgetTab) => {
    setActiveTabLocal(tab)
    setLastActiveTab(tab)
  }

  // Initialize from URL params
  useEffect(() => {
    if (urlInitializedRef.current) return
    const { year, month } = parsePathParams(params)
    if (year) setCurrentYear(year)
    if (month) setCurrentMonthNumber(month)
    urlInitializedRef.current = true
  }, [params, setCurrentYear, setCurrentMonthNumber])

  // Sync URL with current state
  useEffect(() => {
    if (!urlInitializedRef.current) return
    const newPath = `/budget/${currentYear}/${currentMonthNumber}/${activeTab}`
    const currentPath = `/budget/${params.year}/${params.month}/${params.tab}`
    if (newPath !== currentPath) {
      navigate(newPath, { replace: true })
    }
  }, [currentYear, currentMonthNumber, activeTab, navigate, params])

  // Load month data only after budget data is loaded - let it try to load/create, handle errors
  const {
    month: currentMonth,
    error: monthError,
    isLoading: isMonthLoading,
  } = useBudgetMonth(
    isBudgetDataLoaded ? selectedBudgetId : null,
    currentYear,
    currentMonthNumber
  )

  // Handle month loading errors - redirect to current month if can't create
  // Use queueMicrotask to avoid synchronous setState in effect (ESLint react-hooks/set-state-in-effect)
  useEffect(() => {
    if (!monthError || isRedirecting) return

    const errorMsg = monthError.message || ''

    // Check if this is a "can't create month too far in past" error
    if (errorMsg.includes('months in the past') || errorMsg.includes('Refusing to create month')) {
      console.log(`[Budget] Month creation failed: ${errorMsg}`)

      // Defer state updates to avoid synchronous setState in effect
      queueMicrotask(() => {
        // Add loading hold during redirect
        addLoadingHold('month-redirect', 'Redirecting to current month...')
        setIsRedirecting(true)

        // Redirect to current month
        const { year: nowYear, month: nowMonth } = getCurrentMonth()
        console.log(`[Budget] Redirecting from ${currentYear}/${currentMonthNumber} to current month: ${nowYear}/${nowMonth}`)

        setError(`Cannot create month ${currentYear}/${currentMonthNumber} - it's too far in the past. Redirected to current month.`)
        setCurrentYear(nowYear)
        setCurrentMonthNumber(nowMonth)
      })
    }
  }, [monthError, isRedirecting, currentYear, currentMonthNumber, setCurrentYear, setCurrentMonthNumber, addLoadingHold])

  // Clear redirect state and loading hold once we've successfully loaded a month after redirect
  // Use queueMicrotask to avoid synchronous setState in effect
  useEffect(() => {
    if (isRedirecting && currentMonth && !isMonthLoading) {
      queueMicrotask(() => {
        setIsRedirecting(false)
        removeLoadingHold('month-redirect')
      })
    }
  }, [isRedirecting, currentMonth, isMonthLoading, removeLoadingHold])

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

  // Don't render content while budget data is loading or redirecting (loading overlay shows via loading hold)
  if (!isBudgetDataLoaded || isRedirecting) {
    return null
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
