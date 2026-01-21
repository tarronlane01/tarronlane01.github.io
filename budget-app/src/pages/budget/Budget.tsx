import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useApp, useBudget, type BudgetTab } from '@contexts'
import { useBudgetData, useMonthData, useMonthPrefetch } from '@hooks'
import { ErrorAlert } from '../../components/ui'
import {
  BudgetTabs,
  MonthNavigation,
  MonthIncome,
  MonthSpend,
  MonthTransfers,
  MonthAdjustments,
  MonthCategories,
  MonthAccounts,
} from '../../components/budget/Month'

const VALID_TABS: BudgetTab[] = ['income', 'categories', 'accounts', 'spend', 'transfers', 'adjustments']

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
    selectedBudgetId,
    setSelectedBudgetId,
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
    needsFirstBudget,
    initialDataLoadComplete,
  } = useBudget()

  const {
    budget: currentBudget,
    isLoading: isBudgetLoading,
  } = useBudgetData()

  // Budget data is loaded when not loading (monthMap might be empty if no months exist)
  const isBudgetDataLoaded = !isBudgetLoading

  // Track if we're in the middle of a redirect due to month creation error
  const [isRedirecting, setIsRedirecting] = useState(false)

  // Add loading hold while waiting for budget data and initial data load to be available
  useEffect(() => {
    if (!isBudgetDataLoaded || !initialDataLoadComplete) {
      addLoadingHold('budget-data', 'Loading budget data...')
    } else {
      removeLoadingHold('budget-data')
    }
    return () => removeLoadingHold('budget-data')
  }, [isBudgetDataLoaded, initialDataLoadComplete, addLoadingHold, removeLoadingHold])

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
  } = useMonthData(
    isBudgetDataLoaded ? selectedBudgetId : null,
    currentYear,
    currentMonthNumber
  )

  // Handle month loading errors - redirect based on error type
  // Use queueMicrotask to avoid synchronous setState in effect (ESLint react-hooks/set-state-in-effect)
  useEffect(() => {
    if (!monthError || isRedirecting) return

    const errorMsg = monthError.message || ''

    // Check if budget doesn't exist - redirect to My Budgets page
    if (errorMsg.includes('Budget') && errorMsg.includes('does not exist')) {
      queueMicrotask(() => {
        // Clear the selected budget since it doesn't exist
        setSelectedBudgetId(null)
        // Navigate to My Budgets page with context
        navigate('/budget/my-budgets?context=budget-not-found', { replace: true })
      })
      return
    }

    // Check if this is a "can't create month too far in past" error
    if (errorMsg.includes('months in the past') || errorMsg.includes('Refusing to create month')) {
      // Defer state updates to avoid synchronous setState in effect
      queueMicrotask(() => {
        // Add loading hold during redirect
        addLoadingHold('month-redirect', 'Redirecting to current month...')
        setIsRedirecting(true)

        // Redirect to current month
        const { year: nowYear, month: nowMonth } = getCurrentMonth()

        setError(`Cannot create month ${currentYear}/${currentMonthNumber} - it's too far in the past. Redirected to current month.`)
        setCurrentYear(nowYear)
        setCurrentMonthNumber(nowMonth)
      })
    }
  }, [monthError, isRedirecting, currentYear, currentMonthNumber, setCurrentYear, setCurrentMonthNumber, addLoadingHold, setSelectedBudgetId, navigate])

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

  // Track current viewing document for immediate saves
  const { setCurrentViewingDocument } = useBudget()
  useEffect(() => {
    if (currentBudget && currentYear && currentMonthNumber) {
      setCurrentViewingDocument({
        type: 'month',
        year: currentYear,
        month: currentMonthNumber,
      })
    }
    return () => {
      setCurrentViewingDocument({ type: null })
    }
  }, [currentBudget, currentYear, currentMonthNumber, setCurrentViewingDocument])

  // Redirect to My Budgets page if user has no budget selected
  // This handles: new users, users with pending invites, budget-not-found scenarios
  useEffect(() => {
    if (!isBudgetDataLoaded) return // Wait for data to load
    if (isRedirecting) return // Don't double-redirect

    // No current budget and no budget selected - go to My Budgets
    if (!currentBudget && !selectedBudgetId) {
      navigate('/budget/my-budgets', { replace: true })
      return
    }

    // Has pending invites but no budget - go to My Budgets
    if (!currentBudget && hasPendingInvites) {
      navigate('/budget/my-budgets', { replace: true })
      return
    }

    // Needs first budget - go to My Budgets
    if (needsFirstBudget) {
      navigate('/budget/my-budgets', { replace: true })
      return
    }
  }, [isBudgetDataLoaded, isRedirecting, currentBudget, selectedBudgetId, hasPendingInvites, needsFirstBudget, navigate])

  // Prefetch next month in navigation direction for smooth navigation
  useMonthPrefetch(selectedBudgetId, currentYear, currentMonthNumber)

  // Don't render content while budget data is loading, initial data load is incomplete, or redirecting
  // This ensures the cache is populated before any queries run
  if (!isBudgetDataLoaded || !initialDataLoadComplete || isRedirecting) {
    return null
  }

  // Don't render if no budget (redirect will happen via effect above)
  if (!currentBudget) {
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
    <>
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
      {activeTab === 'transfers' && <MonthTransfers key={`${currentYear}-${currentMonthNumber}`} />}
      {activeTab === 'adjustments' && <MonthAdjustments key={`${currentYear}-${currentMonthNumber}`} />}
    </>
  )
}

export default Budget
