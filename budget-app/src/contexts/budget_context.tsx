/**
 * Budget Context (Minimal Version)
 *
 * This context manages ONLY selection state:
 * - Which budget is selected
 * - Which year/month is selected
 * - Initialization state
 *
 * ALL data fetching and mutations are done via React Query hooks
 * that components import and call directly.
 *
 * Architecture Pattern:
 * - Context = "What are we looking at?" (identifiers only)
 * - React Query = "What is the data?" (fetched directly by components)
 * - Mutations = "How do we change data?" (called directly by components)
 */

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import useFirebaseAuth from '@hooks/useFirebaseAuth'
import {
  useUserQuery,
  useAccessibleBudgetsQuery,
  fetchBudgetInviteStatus,
} from '@data'
import { queryClient, queryKeys } from '@data/queryClient'
import { useInitialDataLoad } from '@hooks/useInitialDataLoad'
import { useInitialBalanceCalculation } from '@hooks/useInitialBalanceCalculation'

// Import types from centralized types file
import type {
  PermissionFlags,
  UserDocument,
  ExpectedBalanceType,
  AccountGroup,
  AccountGroupsMap,
  FinancialAccount,
  AccountsMap,
  DefaultAmountType,
  Category,
  CategoriesMap,
  CategoryGroup,
  IncomeTransaction,
  ExpenseTransaction,
  PayeesDocument,
  CategoryMonthBalance,
  AccountMonthBalance,
  MonthDocument,
  Budget,
  BudgetInvite,
  BudgetSummary,
} from '@types'

// Re-export all types so existing imports continue to work
export type {
  PermissionFlags, UserDocument, ExpectedBalanceType, AccountGroup, AccountGroupsMap,
  FinancialAccount, AccountsMap, DefaultAmountType, Category, CategoriesMap, CategoryGroup,
  IncomeTransaction, ExpenseTransaction, PayeesDocument, CategoryMonthBalance, AccountMonthBalance,
  MonthDocument, Budget, BudgetInvite, BudgetSummary,
}

// ============================================================================
// CONTEXT TYPE - Minimal: identifiers and UI state only
// ============================================================================
// Valid tabs for each section
export type BudgetTab = 'income' | 'categories' | 'accounts' | 'spend' | 'transfers' | 'adjustments'
export type SettingsTab = 'general' | 'accounts' | 'categories' | 'users'
export type AdminTab = 'budget' | 'feedback' | 'migration' | 'tests'

interface BudgetContextType {
  // Current user
  currentUserId: string | null

  // Selection state (identifiers)
  selectedBudgetId: string | null
  currentYear: number
  currentMonthNumber: number
  lastActiveTab: BudgetTab
  lastBalancesTab: BudgetTab
  lastTransactionsTab: BudgetTab
  lastSettingsTab: SettingsTab
  lastAdminTab: AdminTab

  // Current viewing document (for immediate saves)
  currentViewingDocument: { type: 'month' | 'budget' | null; year?: number; month?: number }
  setCurrentViewingDocument: (doc: { type: 'month' | 'budget' | null; year?: number; month?: number }) => void

  // Selection setters
  setSelectedBudgetId: (id: string | null) => void
  setCurrentYear: (year: number) => void
  setCurrentMonthNumber: (month: number) => void
  setLastActiveTab: (tab: BudgetTab) => void
  setLastSettingsTab: (tab: SettingsTab) => void
  setLastAdminTab: (tab: AdminTab) => void

  // Page title for layout header
  pageTitle: string
  setPageTitle: (title: string) => void

  // UI/initialization state
  isInitialized: boolean
  needsFirstBudget: boolean
  initialDataLoadComplete: boolean
  /** True after month caches have been chained (start_balance from prev end_balance). Recalc should run after this so base month end_balance is correct. */
  initialBalanceCalculationComplete: boolean

  // Convenience navigation (just changes identifiers)
  goToPreviousMonth: () => void
  goToNextMonth: () => void

  // Onboarding data (from user query - needed for routing decisions)
  pendingInvites: BudgetInvite[]
  hasPendingInvites: boolean
  accessibleBudgets: BudgetSummary[]

  // User flags (from user query - needed for UI conditionals)
  isAdmin: boolean
  isTest: boolean

  // Budget management utilities
  loadAccessibleBudgets: (options?: { force?: boolean }) => Promise<void>
  switchToBudget: (budgetId: string) => void
  checkBudgetInvite: (budgetId: string) => Promise<BudgetInvite | null>

  // Cache utilities
  clearCache: () => void
}

// --- DEFAULT CONTEXT VALUE ---
const defaultContextValue: BudgetContextType = {
  currentUserId: null, selectedBudgetId: null, currentYear: new Date().getFullYear(), currentMonthNumber: new Date().getMonth() + 1,
  lastActiveTab: 'categories', lastBalancesTab: 'categories', lastTransactionsTab: 'income', lastSettingsTab: 'categories', lastAdminTab: 'budget',
  currentViewingDocument: { type: null }, setCurrentViewingDocument: () => {}, setSelectedBudgetId: () => {}, setCurrentYear: () => {}, setCurrentMonthNumber: () => {},
  setLastActiveTab: () => {}, setLastSettingsTab: () => {}, setLastAdminTab: () => {}, pageTitle: 'Budget', setPageTitle: () => {},
  isInitialized: false, needsFirstBudget: false, initialDataLoadComplete: false, initialBalanceCalculationComplete: false,
  goToPreviousMonth: () => {}, goToNextMonth: () => {}, pendingInvites: [], hasPendingInvites: false, accessibleBudgets: [],
  isAdmin: false, isTest: false, loadAccessibleBudgets: async () => {}, switchToBudget: () => {}, checkBudgetInvite: async () => null, clearCache: () => {},
}

const BudgetContext = createContext<BudgetContextType>(defaultContextValue)

// --- PROVIDER ---
export function BudgetProvider({ children }: { children: ReactNode }) {
  const firebase_auth_hook = useFirebaseAuth()
  const current_user = firebase_auth_hook.get_current_firebase_user()

  // Selection state - what the user has selected
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null)
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonthNumber, setCurrentMonthNumber] = useState(new Date().getMonth() + 1)
  const [lastActiveTab, setLastActiveTabState] = useState<BudgetTab>('categories')
  const [lastBalancesTab, setLastBalancesTab] = useState<BudgetTab>('categories')
  const [lastTransactionsTab, setLastTransactionsTab] = useState<BudgetTab>('income')
  const setLastActiveTab = useCallback((tab: BudgetTab) => {
    setLastActiveTabState(tab)
    if (tab === 'categories' || tab === 'accounts') setLastBalancesTab(tab)
    else setLastTransactionsTab(tab)
  }, [])
  const [lastSettingsTab, setLastSettingsTab] = useState<SettingsTab>('categories')
  const [lastAdminTab, setLastAdminTab] = useState<AdminTab>('budget')

  // Page title for layout header
  const [pageTitle, setPageTitleState] = useState('Budget')

  // Only update if title actually changed to prevent re-render loops
  const setPageTitle = useCallback((title: string) => {
    setPageTitleState(prev => prev === title ? prev : title)
  }, [])

  // Current viewing document (for immediate saves)
  const [currentViewingDocument, setCurrentViewingDocument] = useState<{
    type: 'month' | 'budget' | null
    year?: number
    month?: number
  }>({ type: null })

  // UI state
  const [isInitialized, setIsInitialized] = useState(false)
  const [needsFirstBudget, setNeedsFirstBudget] = useState(false)

  // User query - for admin flags and budget access
  const userQuery = useUserQuery(current_user?.uid || null, current_user?.email || null)

  // Accessible budgets query - LAZY: only runs for new users (no budget_ids). For existing users, triggered manually when visiting MyBudgets page
  const userHasNoBudgets = userQuery.data && userQuery.data.budget_ids.length === 0
  const accessibleBudgetsQuery = useAccessibleBudgetsQuery(
    current_user?.uid || null,
    userQuery.data || null,
    { enabled: !!current_user?.uid && !!userQuery.data && userHasNoBudgets }
  )

  // Initial data load - pre-populate cache with last 3 months, current, all future, budget, payees
  const initialDataLoad = useInitialDataLoad(selectedBudgetId, { enabled: !!selectedBudgetId && isInitialized })
  // Track if initial data load is complete (data loaded AND cache populated)
  const [initialDataLoadComplete, setInitialDataLoadComplete] = useState(false)
  // Track if initial balance calculation has run (month caches chained so end_balance is correct)
  const [initialBalanceCalculationComplete, setInitialBalanceCalculationComplete] = useState(false)

  // Populate cache with initial data when it loads (set staleTime to 5 minutes)
  useEffect(() => {
    if (!initialDataLoad.data) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInitialDataLoadComplete(false)
      return
    }

    const { budget, payees, months } = initialDataLoad.data
    const now = Date.now()
    // Set budget, payees, and months in cache with fresh timestamp
    queryClient.setQueryData(queryKeys.budget(selectedBudgetId!), budget, { updatedAt: now })
    queryClient.setQueryData(queryKeys.payees(selectedBudgetId!), payees, { updatedAt: now })
    for (const month of months) {
      queryClient.setQueryData(queryKeys.month(selectedBudgetId!, month.year, month.month), { month }, { updatedAt: now })
    }
    setInitialDataLoadComplete(true) // Mark initial data load as complete after cache is populated
  }, [initialDataLoad.data, selectedBudgetId]) // queryClient is stable, no need to include

  // Calculate and sync balances after initial data load (before removing loading overlay)
  useInitialBalanceCalculation({
    budgetId: selectedBudgetId,
    enabled: !!selectedBudgetId && isInitialized && initialDataLoadComplete,
    initialDataLoadComplete,
    months: initialDataLoad.data?.months || [],
    setInitialBalanceCalculationComplete,
  })

  // Reset initialDataLoadComplete and initialBalanceCalculationComplete when budget changes
  useEffect(() => {
    if (!selectedBudgetId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInitialDataLoadComplete(false)
      setInitialBalanceCalculationComplete(false)
    }
  }, [selectedBudgetId])
  // Derive user flags and onboarding state
  const isAdmin = userQuery.data?.permission_flags?.is_admin === true
  const isTest = userQuery.data?.permission_flags?.is_test === true
  const pendingInvites = accessibleBudgetsQuery.data?.pendingInvites || []
  const accessibleBudgets = accessibleBudgetsQuery.data?.budgets || []
  const hasPendingInvites = pendingInvites.length > 0
  // ==========================================================================
  // INITIALIZATION - Auto-select first budget
  // ==========================================================================
  useEffect(() => {
    if (!current_user) return
    if (isInitialized) return
    if (userQuery.isLoading) return

    const userData = userQuery.data

    // Still loading
    if (!userData && !userQuery.isError) return

    // Determine which budget to load (initialization pattern - setState is intentional)
    if (userData && userData.budget_ids.length > 0) {
      setSelectedBudgetId(userData.budget_ids[0]) // eslint-disable-line react-hooks/set-state-in-effect
      setNeedsFirstBudget(false)
      setIsInitialized(true)
    } else {
      if (accessibleBudgetsQuery.isLoading) return
      const budgetsData = accessibleBudgetsQuery.data
      setNeedsFirstBudget(!(budgetsData?.pendingInvites && budgetsData.pendingInvites.length > 0))
      setIsInitialized(true)
    }
  }, [current_user, isInitialized, userQuery.data, userQuery.isLoading, userQuery.isError, accessibleBudgetsQuery.data, accessibleBudgetsQuery.isLoading])

  // ==========================================================================
  // MONTH NAVIGATION - Just changes identifiers
  // Note: Don't nest setState calls inside updater functions - React Strict Mode can run updaters twice
  // ==========================================================================
  const goToPreviousMonth = useCallback(() => {
    if (currentMonthNumber === 1) {
      setCurrentYear(y => y - 1)
      setCurrentMonthNumber(12)
    } else {
      setCurrentMonthNumber(m => m - 1)
    }
  }, [currentMonthNumber])

  const goToNextMonth = useCallback(() => {
    if (currentMonthNumber === 12) {
      setCurrentYear(y => y + 1)
      setCurrentMonthNumber(1)
    } else {
      setCurrentMonthNumber(m => m + 1)
    }
  }, [currentMonthNumber])
  // ==========================================================================
  // BUDGET MANAGEMENT UTILITIES
  // ==========================================================================
  const loadAccessibleBudgets = useCallback(async (options?: { force?: boolean }) => {
    // If force=true (e.g., after mutations), always refetch. Otherwise, only refetch if we don't have data yet (prevents duplicate queries)
    if (options?.force || !accessibleBudgetsQuery.data) {
      await accessibleBudgetsQuery.refetch()
    }
  }, [accessibleBudgetsQuery])

  const switchToBudget = useCallback((budgetId: string) => {
    setSelectedBudgetId(budgetId)
    setNeedsFirstBudget(false) // If switching to a budget, we clearly don't need to create a first budget
  }, [])

  const checkBudgetInvite = useCallback(async (budgetId: string): Promise<BudgetInvite | null> => {
    if (!current_user) return null

    try {
      const status = await fetchBudgetInviteStatus(budgetId, current_user.uid)

      if (!status) return null

      // Check if user is invited but hasn't accepted
      if (status.isInvited && !status.hasAccepted) {
        return {
          budgetId,
          budgetName: status.budgetName,
          ownerEmail: status.ownerEmail,
        }
      }

      return null
    } catch (error) {
      console.error('[BudgetContext] Error checking budget invite:', error)
      return null
    }
  }, [current_user])

  const clearCache = useCallback(() => queryClient.clear(), [])
  const contextValue: BudgetContextType = {
    currentUserId: current_user?.uid || null,
    selectedBudgetId,
    currentYear,
    currentMonthNumber,
    lastActiveTab,
    lastBalancesTab,
    lastTransactionsTab,
    lastSettingsTab,
    lastAdminTab,
    currentViewingDocument,
    setCurrentViewingDocument,
    setSelectedBudgetId,
    setCurrentYear,
    setCurrentMonthNumber,
    setLastActiveTab,
    setLastSettingsTab,
    setLastAdminTab,
    pageTitle,
    setPageTitle,
    isInitialized,
    needsFirstBudget,
    initialDataLoadComplete,
    initialBalanceCalculationComplete,
    goToPreviousMonth,
    goToNextMonth,
    pendingInvites,
    hasPendingInvites,
    accessibleBudgets,
    isAdmin,
    isTest,
    loadAccessibleBudgets,
    switchToBudget,
    checkBudgetInvite,
    clearCache,
  }

  return (
    <BudgetContext.Provider value={contextValue}>
      {children}
    </BudgetContext.Provider>
  )
}
// eslint-disable-next-line react-refresh/only-export-components
export function useBudget() {
  const context = useContext(BudgetContext)
  if (!context) {
    throw new Error('useBudget must be used within a BudgetProvider')
  }
  return context
}
export { BudgetContext as default }
