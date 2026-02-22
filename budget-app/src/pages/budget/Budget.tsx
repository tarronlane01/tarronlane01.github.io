import { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useApp, useBudget, type BudgetTab } from '@contexts'
import { useBudgetData, useMonthData, useMonthPrefetch, useStaleDataRefresh, useEnsureBalancesFresh } from '@hooks'
import { MonthNavigationError } from '@utils'
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
    lastBalancesTab,
    lastTransactionsTab,
    setCurrentYear,
    setCurrentMonthNumber,
    setLastActiveTab,
    setPageTitle,
    goToPreviousMonth,
    goToNextMonth,
    hasPendingInvites,
    needsFirstBudget,
    initialDataLoadComplete,
    initialBalanceCalculationComplete,
  } = useBudget()

  const {
    budget: currentBudget,
    isLoading: isBudgetLoading,
  } = useBudgetData()

  // Budget data is loaded when we have budget in hand (not just !isBudgetLoading, which can be true
  // before the cache is populated on initial load, causing "Budget not in cache" and no recalc).
  const isBudgetDataLoaded = !isBudgetLoading && !!currentBudget

  // Single recalc runs AFTER initial balance calculation completes (so months are already in cache).
  // This handles re-recalc when navigating back to budget page after settings changes.
  useEnsureBalancesFresh(isBudgetDataLoaded && !!selectedBudgetId && initialBalanceCalculationComplete, { alwaysRecalculate: true })

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
  const downloadCategoriesRef = useRef<(() => void) | null>(null)

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

  // Derive current tab from URL (same pattern as Admin/Settings)
  const currentTab: BudgetTab = useMemo(() => {
    const { tab } = parsePathParams(params)
    return tab ?? lastActiveTab
  }, [params, lastActiveTab])

  const setActiveTab = (tab: BudgetTab) => {
    navigate(`/budget/${currentYear}/${currentMonthNumber}/${tab}`)
    setLastActiveTab(tab)
  }

  // Save current tab to context when it changes (same pattern as Admin/Settings)
  useEffect(() => {
    const { tab } = parsePathParams(params)
    if (tab != null) setLastActiveTab(currentTab)
  }, [currentTab, params, setLastActiveTab])

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
    const newPath = `/budget/${currentYear}/${currentMonthNumber}/${currentTab}`
    const currentPath = `/budget/${params.year}/${params.month}/${params.tab}`
    if (newPath !== currentPath) {
      navigate(newPath, { replace: true })
    }
  }, [currentYear, currentMonthNumber, currentTab, navigate, params])

  // Load month data only after budget data AND initial data load are complete
  // This ensures the cache is populated before useMonthData tries to access it
  const {
    month: currentMonth,
    error: monthError,
    isLoading: isMonthLoading,
  } = useMonthData(
    isBudgetDataLoaded && initialDataLoadComplete ? selectedBudgetId : null,
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

    // Handle MonthNavigationError - redirect to valid month in budget
    // This is the structured way to handle month creation/navigation failures
    // Use static type guard instead of instanceof (works across module boundaries)
    if (MonthNavigationError.is(monthError) && monthError.shouldRedirectToValidMonth) {
      queueMicrotask(() => {
        const monthMap = currentBudget?.month_map
        if (!monthMap || Object.keys(monthMap).length === 0) {
          setError(`Cannot load month ${currentYear}/${currentMonthNumber} - budget has no months.`)
          return
        }

        // Find latest month in month_map
        const ordinals = Object.keys(monthMap).sort()
        const latestOrdinal = ordinals[ordinals.length - 1]
        const targetYear = parseInt(latestOrdinal.slice(0, 4), 10)
        const targetMonth = parseInt(latestOrdinal.slice(4, 6), 10)

        addLoadingHold('month-redirect', 'Redirecting to available month...')
        setIsRedirecting(true)

        setError(`Month ${currentYear}/${currentMonthNumber} is outside budget range. Redirected to ${targetYear}/${targetMonth}.`)
        setCurrentYear(targetYear)
        setCurrentMonthNumber(targetMonth)
      })
      return
    }

    // Fallback: Check error message patterns for month navigation errors
    // This handles cases where the type guard fails (e.g., error wrapped by React Query)
    const isMonthOutOfRange = 
      errorMsg.includes('cannot be created') ||
      errorMsg.includes('months in the past') ||
      errorMsg.includes('months in the future') ||
      errorMsg.includes('does not exist in budget') ||
      errorMsg.includes('not immediately after') ||
      errorMsg.includes('not immediately before') ||
      errorMsg.includes('walk forward one month') ||
      errorMsg.includes('walk back one month')

    if (isMonthOutOfRange) {
      queueMicrotask(() => {
        const monthMap = currentBudget?.month_map
        if (!monthMap || Object.keys(monthMap).length === 0) {
          setError(`Cannot load month ${currentYear}/${currentMonthNumber} - budget has no months.`)
          return
        }

        // Find latest month in month_map
        const ordinals = Object.keys(monthMap).sort()
        const latestOrdinal = ordinals[ordinals.length - 1]
        const targetYear = parseInt(latestOrdinal.slice(0, 4), 10)
        const targetMonth = parseInt(latestOrdinal.slice(4, 6), 10)

        addLoadingHold('month-redirect', 'Redirecting to available month...')
        setIsRedirecting(true)

        setError(`Month ${currentYear}/${currentMonthNumber} is outside budget range. Redirected to ${targetYear}/${targetMonth}.`)
        setCurrentYear(targetYear)
        setCurrentMonthNumber(targetMonth)
      })
    }
  }, [monthError, isRedirecting, currentYear, currentMonthNumber, currentBudget, setCurrentYear, setCurrentMonthNumber, addLoadingHold, setSelectedBudgetId, navigate])

  // Clear redirect state and loading hold once we've successfully loaded a month after redirect
  // OR if there's an error after redirect (to avoid getting stuck)
  // Use queueMicrotask to avoid synchronous setState in effect
  useEffect(() => {
    if (isRedirecting && !isMonthLoading) {
      // Clear redirect state when month loads OR when there's an error after redirect
      if (currentMonth || monthError) {
        queueMicrotask(() => {
          setIsRedirecting(false)
          removeLoadingHold('month-redirect')
        })
      }
    }
  }, [isRedirecting, currentMonth, monthError, isMonthLoading, removeLoadingHold])

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
  // Only run after initial data load is complete to avoid race conditions
  useMonthPrefetch(
    initialDataLoadComplete ? selectedBudgetId : null,
    currentYear,
    currentMonthNumber
  )

  // Detect stale cache and trigger fresh load + fetch viewing month context if outside window
  // Only run after initial data load is complete to avoid interfering with first load
  useStaleDataRefresh({
    budgetId: selectedBudgetId,
    viewingYear: currentYear,
    viewingMonth: currentMonthNumber,
    initialDataLoadComplete,
    enabled: !!selectedBudgetId && initialDataLoadComplete,
  })

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
        onDownloadCategories={currentTab === 'categories' ? () => downloadCategoriesRef.current?.() : undefined}
      />

      <BudgetTabs
        activeTab={currentTab}
        setActiveTab={setActiveTab}
        lastBalancesTab={lastBalancesTab}
        lastTransactionsTab={lastTransactionsTab}
        allocationsFinalized={currentMonth?.are_allocations_finalized}
      />

      {currentTab === 'income' && <MonthIncome key={`${currentYear}-${currentMonthNumber}`} />}
      {currentTab === 'categories' && (
        <MonthCategories
          key={`${currentYear}-${currentMonthNumber}`}
          registerDownloadCategories={(fn) => { downloadCategoriesRef.current = fn }}
        />
      )}
      {currentTab === 'accounts' && <MonthAccounts key={`${currentYear}-${currentMonthNumber}`} />}
      {currentTab === 'spend' && <MonthSpend key={`${currentYear}-${currentMonthNumber}`} />}
      {currentTab === 'transfers' && <MonthTransfers key={`${currentYear}-${currentMonthNumber}`} />}
      {currentTab === 'adjustments' && <MonthAdjustments key={`${currentYear}-${currentMonthNumber}`} />}
    </>
  )
}

export default Budget
