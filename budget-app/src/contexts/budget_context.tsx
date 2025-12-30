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
import useFirebaseAuth from '../hooks/useFirebaseAuth'
import {
  useUserQuery,
  useAccessibleBudgetsQuery,
  fetchBudgetInviteStatus,
} from '../data'

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
}

// ============================================================================
// CONTEXT TYPE - Minimal: identifiers and UI state only
// ============================================================================

// Valid tabs for each section
export type BudgetTab = 'income' | 'balances' | 'spend'
export type SettingsTab = 'accounts' | 'categories' | 'users'
export type AdminTab = 'budget' | 'feedback' | 'migration' | 'tests'
export type BalancesView = 'categories' | 'accounts'

interface BudgetContextType {
  // Current user
  currentUserId: string | null

  // Selection state (identifiers)
  selectedBudgetId: string | null
  currentYear: number
  currentMonthNumber: number
  lastActiveTab: BudgetTab
  lastSettingsTab: SettingsTab
  lastAdminTab: AdminTab
  lastBalancesView: BalancesView

  // Selection setters
  setSelectedBudgetId: (id: string | null) => void
  setCurrentYear: (year: number) => void
  setCurrentMonthNumber: (month: number) => void
  setLastActiveTab: (tab: BudgetTab) => void
  setLastSettingsTab: (tab: SettingsTab) => void
  setLastAdminTab: (tab: AdminTab) => void
  setLastBalancesView: (view: BalancesView) => void

  // UI/initialization state
  isInitialized: boolean
  needsFirstBudget: boolean

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
  loadAccessibleBudgets: () => Promise<void>
  switchToBudget: (budgetId: string) => void
  checkBudgetInvite: (budgetId: string) => Promise<BudgetInvite | null>

  // Cache utilities
  clearCache: () => void
}

// ============================================================================
// DEFAULT CONTEXT VALUE
// ============================================================================

const defaultContextValue: BudgetContextType = {
  currentUserId: null,
  selectedBudgetId: null,
  currentYear: new Date().getFullYear(),
  currentMonthNumber: new Date().getMonth() + 1,
  lastActiveTab: 'balances',
  lastSettingsTab: 'categories',
  lastAdminTab: 'budget',
  lastBalancesView: 'categories',
  setSelectedBudgetId: () => {},
  setCurrentYear: () => {},
  setCurrentMonthNumber: () => {},
  setLastActiveTab: () => {},
  setLastSettingsTab: () => {},
  setLastAdminTab: () => {},
  setLastBalancesView: () => {},
  isInitialized: false,
  needsFirstBudget: false,
  goToPreviousMonth: () => {},
  goToNextMonth: () => {},
  pendingInvites: [],
  hasPendingInvites: false,
  accessibleBudgets: [],
  isAdmin: false,
  isTest: false,
  loadAccessibleBudgets: async () => {},
  switchToBudget: () => {},
  checkBudgetInvite: async () => null,
  clearCache: () => {},
}

const BudgetContext = createContext<BudgetContextType>(defaultContextValue)

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

export function BudgetProvider({ children }: { children: ReactNode }) {
  const firebase_auth_hook = useFirebaseAuth()
  const current_user = firebase_auth_hook.get_current_firebase_user()

  // Selection state - what the user has selected
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null)
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonthNumber, setCurrentMonthNumber] = useState(new Date().getMonth() + 1)
  const [lastActiveTab, setLastActiveTab] = useState<BudgetTab>('balances')
  const [lastSettingsTab, setLastSettingsTab] = useState<SettingsTab>('categories')
  const [lastAdminTab, setLastAdminTab] = useState<AdminTab>('budget')
  const [lastBalancesView, setLastBalancesView] = useState<BalancesView>('categories')

  // UI state
  const [isInitialized, setIsInitialized] = useState(false)
  const [needsFirstBudget, setNeedsFirstBudget] = useState(false)

  // User query - for admin flags and budget access
  const userQuery = useUserQuery(current_user?.uid || null, current_user?.email || null)

  // Accessible budgets query - LAZY: only runs for new users (no budget_ids)
  // For existing users, this query is triggered manually when visiting MyBudgets page
  const userHasNoBudgets = userQuery.data && userQuery.data.budget_ids.length === 0
  const accessibleBudgetsQuery = useAccessibleBudgetsQuery(
    current_user?.uid || null,
    userQuery.data || null,
    { enabled: !!current_user?.uid && !!userQuery.data && userHasNoBudgets }
  )

  // Derive user flags
  const isAdmin = userQuery.data?.permission_flags?.is_admin === true
  const isTest = userQuery.data?.permission_flags?.is_test === true

  // Derive onboarding state
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
      // User has budgets - select the first one, no need to wait for accessibleBudgetsQuery
      setSelectedBudgetId(userData.budget_ids[0]) // eslint-disable-line react-hooks/set-state-in-effect
      setNeedsFirstBudget(false)
      setIsInitialized(true)
    } else {
      // User has no budgets - wait for accessibleBudgetsQuery to check for pending invites
      if (accessibleBudgetsQuery.isLoading) return

      const budgetsData = accessibleBudgetsQuery.data
      if (budgetsData?.pendingInvites && budgetsData.pendingInvites.length > 0) {
        // Has pending invites but no budgets
        setNeedsFirstBudget(false)
      } else {
        // New user, needs to create first budget
        setNeedsFirstBudget(true)
      }
      setIsInitialized(true)
    }
  }, [current_user, isInitialized, userQuery.data, userQuery.isLoading, userQuery.isError, accessibleBudgetsQuery.data, accessibleBudgetsQuery.isLoading])

  // ==========================================================================
  // MONTH NAVIGATION - Just changes identifiers
  // Note: Don't nest setState calls inside updater functions - React Strict Mode
  // can run updaters twice, causing double increments.
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

  const loadAccessibleBudgets = useCallback(async () => {
    await accessibleBudgetsQuery.refetch()
  }, [accessibleBudgetsQuery])

  const switchToBudget = useCallback((budgetId: string) => {
    setSelectedBudgetId(budgetId)
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

  // ==========================================================================
  // CACHE UTILITIES
  // ==========================================================================

  // Clear localStorage cache - should be followed by page reload
  // Note: Don't call queryClient.clear() first - the async persister may write back
  // to localStorage after we clear it. Just clear localStorage and reload.
  const clearCache = useCallback(() => {
    localStorage.removeItem('BUDGET_APP_QUERY_CACHE')
  }, [])

  // ==========================================================================
  // CONTEXT VALUE
  // ==========================================================================

  const contextValue: BudgetContextType = {
    currentUserId: current_user?.uid || null,
    selectedBudgetId,
    currentYear,
    currentMonthNumber,
    lastActiveTab,
    lastSettingsTab,
    lastAdminTab,
    lastBalancesView,
    setSelectedBudgetId,
    setCurrentYear,
    setCurrentMonthNumber,
    setLastActiveTab,
    setLastSettingsTab,
    setLastAdminTab,
    setLastBalancesView,
    isInitialized,
    needsFirstBudget,
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

// =============================================================================
// HOOK
// =============================================================================

// eslint-disable-next-line react-refresh/only-export-components
export function useBudget() {
  const context = useContext(BudgetContext)
  if (!context) {
    throw new Error('useBudget must be used within a BudgetProvider')
  }
  return context
}

export default BudgetContext
