import { createContext, useContext, useState, useRef, type ReactNode } from 'react'
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'
import app from '../firebase'
import useFirebaseAuth from '../hooks/useFirebaseAuth'

// Permission flags that can only be set via Firebase Console
export interface PermissionFlags {
  is_admin?: boolean
  is_test?: boolean
}

// User document type for storing budget access
export interface UserDocument {
  uid: string
  email: string | null
  budget_ids: string[]
  permission_flags?: PermissionFlags
  created_at?: string
  updated_at?: string
}

// Data types
export type ExpectedBalanceType = 'positive' | 'negative' | 'any'

export interface AccountGroup {
  id: string
  name: string
  sort_order: number
  expected_balance?: ExpectedBalanceType // 'positive' = warn if negative, 'negative' = warn if positive (e.g. credit cards), 'any' = no warnings
  on_budget?: boolean // If set, overrides account-level setting for all accounts in this group
  is_active?: boolean // If set, overrides account-level setting for all accounts in this group
}

export interface FinancialAccount {
  id: string
  nickname: string
  balance: number
  account_group_id: string | null
  sort_order: number
  is_income_account?: boolean
  is_income_default?: boolean
  is_outgo_account?: boolean // Can this account be used for spending/expenses?
  is_outgo_default?: boolean // Is this the default account for new expenses?
  on_budget?: boolean // true = on budget (default), false = off budget (tracking only)
  is_active?: boolean // true = active (default), false = hidden/archived
}

export interface Category {
  id: string
  name: string
  category_group_id: string | null
  sort_order: number
}

export interface CategoryGroup {
  id: string
  name: string
  sort_order: number
}

// Income transaction for a month
export interface IncomeTransaction {
  id: string
  amount: number
  account_id: string
  date: string // YYYY-MM-DD format
  payee?: string
  description?: string
  created_at: string
}

// Payees document structure (one per budget)
export interface PayeesDocument {
  budget_id: string
  payees: string[] // List of unique payee names
  updated_at: string
}

// Month document structure
export interface MonthDocument {
  budget_id: string
  year: number
  month: number // 1-12
  income: IncomeTransaction[]
  total_income: number // Sum of all income amounts for this month
  // Account balances at start and end of this month (account_id -> balance)
  account_balances_start?: Record<string, number>
  account_balances_end?: Record<string, number>
  created_at: string
  updated_at: string
}

interface Budget {
  id: string
  name: string
  user_ids: string[] // Users who have been invited (includes accepted)
  accepted_user_ids: string[] // Users who have accepted the invite
  owner_id: string
  owner_email: string | null
}

// Invite status for displaying in UI
export interface BudgetInvite {
  budgetId: string
  budgetName: string
  ownerEmail: string | null
}

// Summary of a budget for listing
export interface BudgetSummary {
  id: string
  name: string
  ownerEmail: string | null
  isOwner: boolean
  isPending: boolean // true if user hasn't accepted yet
}

interface BudgetContextType {
  currentBudget: Budget | null
  loading: boolean
  error: string | null
  isOwner: boolean
  isAdmin: boolean
  isTest: boolean
  currentUserId: string | null
  isInitialized: boolean

  // Budget data
  accounts: FinancialAccount[]
  accountGroups: AccountGroup[]
  categories: Category[]
  categoryGroups: CategoryGroup[]

  // Budget users - from budget's user_ids (invited) and accepted_user_ids
  budgetUserIds: string[] // All invited users
  acceptedUserIds: string[] // Users who have accepted

  // Pending invites detected on login
  pendingInvites: BudgetInvite[]
  hasPendingInvites: boolean

  // New user without any budgets
  needsFirstBudget: boolean

  // All accessible budgets (for budget switching)
  accessibleBudgets: BudgetSummary[]

  // Month data
  currentMonth: MonthDocument | null
  currentYear: number
  currentMonthNumber: number
  monthLoading: boolean

  // Payees
  payees: string[]

  // Methods
  ensureBudgetLoaded: () => Promise<void>
  refreshBudget: () => Promise<void>

  // Invite flow (owner actions)
  inviteUserToBudget: (userId: string) => Promise<void>
  revokeUserFromBudget: (userId: string) => Promise<void>

  // Accept flow (invited user actions)
  checkBudgetInvite: (budgetId: string) => Promise<BudgetInvite | null>
  acceptBudgetInvite: (budgetId: string) => Promise<void>

  // Budget switching
  loadAccessibleBudgets: () => Promise<void>
  switchToBudget: (budgetId: string) => Promise<void>
  createNewBudget: (name?: string) => Promise<void>

  // Budget management (owner only)
  renameBudget: (newName: string) => Promise<void>

  // Data update methods
  setAccounts: (accounts: FinancialAccount[]) => void
  setAccountGroups: (accountGroups: AccountGroup[]) => void
  setCategories: (categories: Category[]) => void
  setCategoryGroups: (categoryGroups: CategoryGroup[]) => void
  saveBudgetData: () => Promise<void>

  // Month methods
  loadMonth: (year: number, month: number) => Promise<void>
  goToPreviousMonth: () => Promise<void>
  goToNextMonth: () => Promise<void>
  addIncome: (amount: number, accountId: string, date: string, payee?: string, description?: string) => Promise<void>
  updateIncome: (incomeId: string, amount: number, accountId: string, date: string, payee?: string, description?: string) => Promise<void>
  deleteIncome: (incomeId: string) => Promise<void>
  recomputeMonthTotals: () => Promise<void>
  recomputeAllBalances: () => Promise<void>

  // Reconciliation
  checkBalanceMismatch: () => Promise<Record<string, { stored: number; calculated: number }> | null>
  reconcileBalances: () => Promise<void>
  balanceMismatch: Record<string, { stored: number; calculated: number }> | null

  // Payees methods
  loadPayees: () => Promise<void>
}

const BudgetContext = createContext<BudgetContextType>({
  currentBudget: null,
  loading: false,
  error: null,
  isOwner: false,
  isAdmin: false,
  isTest: false,
  currentUserId: null,
  isInitialized: false,
  accounts: [],
  accountGroups: [],
  categories: [],
  categoryGroups: [],
  budgetUserIds: [],
  acceptedUserIds: [],
  pendingInvites: [],
  hasPendingInvites: false,
  needsFirstBudget: false,
  accessibleBudgets: [],
  currentMonth: null,
  currentYear: new Date().getFullYear(),
  currentMonthNumber: new Date().getMonth() + 1,
  monthLoading: false,
  payees: [],
  ensureBudgetLoaded: async () => {},
  refreshBudget: async () => {},
  inviteUserToBudget: async () => {},
  revokeUserFromBudget: async () => {},
  checkBudgetInvite: async () => null,
  acceptBudgetInvite: async () => {},
  loadAccessibleBudgets: async () => {},
  switchToBudget: async () => {},
  createNewBudget: async () => {},
  renameBudget: async () => {},
  setAccounts: () => {},
  setAccountGroups: () => {},
  setCategories: () => {},
  setCategoryGroups: () => {},
  saveBudgetData: async () => {},
  loadMonth: async () => {},
  goToPreviousMonth: async () => {},
  goToNextMonth: async () => {},
  addIncome: async () => {},
  updateIncome: async () => {},
  deleteIncome: async () => {},
  recomputeMonthTotals: async () => {},
  recomputeAllBalances: async () => {},
  checkBalanceMismatch: async () => null,
  reconcileBalances: async () => {},
  balanceMismatch: null,
  loadPayees: async () => {},
})

// Helper function to clean accounts for Firestore (removes undefined values)
function cleanAccountsForFirestore(accounts: FinancialAccount[]): Record<string, any>[] {
  return accounts.map(acc => {
    const cleaned: Record<string, any> = {
      id: acc.id,
      nickname: acc.nickname,
      balance: acc.balance,
      account_group_id: acc.account_group_id ?? null,
      sort_order: acc.sort_order,
    }
    // Only include optional fields if they have a value
    if (acc.is_income_account !== undefined) cleaned.is_income_account = acc.is_income_account
    if (acc.is_income_default !== undefined) cleaned.is_income_default = acc.is_income_default
    if (acc.is_outgo_account !== undefined) cleaned.is_outgo_account = acc.is_outgo_account
    if (acc.is_outgo_default !== undefined) cleaned.is_outgo_default = acc.is_outgo_default
    if (acc.on_budget !== undefined) cleaned.on_budget = acc.on_budget
    if (acc.is_active !== undefined) cleaned.is_active = acc.is_active
    return cleaned
  })
}

export function BudgetProvider({ children }: { children: ReactNode }) {
  const firebase_auth_hook = useFirebaseAuth()
  const [currentBudget, setCurrentBudget] = useState<Budget | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const loadedForUserRef = useRef<string | null>(null)

  // Budget data state
  const [accounts, setAccounts] = useState<FinancialAccount[]>([])
  const [accountGroups, setAccountGroups] = useState<AccountGroup[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([])

  // Budget users - from budget document
  const [budgetUserIds, setBudgetUserIds] = useState<string[]>([]) // All invited
  const [acceptedUserIds, setAcceptedUserIds] = useState<string[]>([]) // Accepted only

  // Pending invites and accessible budgets
  const [pendingInvites, setPendingInvites] = useState<BudgetInvite[]>([])
  const [accessibleBudgets, setAccessibleBudgets] = useState<BudgetSummary[]>([])
  const [needsFirstBudget, setNeedsFirstBudget] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isTest, setIsTest] = useState(false)

  // Month state
  const [currentMonth, setCurrentMonth] = useState<MonthDocument | null>(null)
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonthNumber, setCurrentMonthNumber] = useState(new Date().getMonth() + 1)
  const [monthLoading, setMonthLoading] = useState(false)

  // Payees state
  const [payees, setPayees] = useState<string[]>([])

  // Balance reconciliation state
  const [balanceMismatch, setBalanceMismatch] = useState<Record<string, { stored: number; calculated: number }> | null>(null)

  const db = getFirestore(app)
  const current_user = firebase_auth_hook.get_current_firebase_user()

  // Helper to get or create user document (only for current user)
  async function getOrCreateCurrentUserDoc(): Promise<UserDocument> {
    if (!current_user) {
      throw new Error('Not authenticated')
    }

    const userDocRef = doc(db, 'users', current_user.uid)

    try {
      const userDoc = await getDoc(userDocRef)

      if (userDoc.exists()) {
        return userDoc.data() as UserDocument
      }

      // Create new user document
      const newUserDoc: UserDocument = {
        uid: current_user.uid,
        email: current_user.email || null,
        budget_ids: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      await setDoc(userDocRef, newUserDoc)
      return newUserDoc
    } catch (err) {
      console.error('[BudgetContext] Error getting/creating user doc:', err)
      throw err
    }
  }

  async function loadOrCreateBudget() {
    if (!current_user) {
      setCurrentBudget(null)
      setAccounts([])
      setAccountGroups([])
      setCategories([])
      setCategoryGroups([])
      setBudgetUserIds([])
      setAcceptedUserIds([])
      setPendingInvites([])
      setAccessibleBudgets([])
      setNeedsFirstBudget(false)
      setLoading(false)
      setIsInitialized(false)
      loadedForUserRef.current = null
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Try the new approach first (user document), fall back to old approach if it fails
      let userDoc: UserDocument | null = null
      let useFallback = false

      try {
        userDoc = await getOrCreateCurrentUserDoc()
        // Set permission flags from user document
        const flags = userDoc?.permission_flags
        setIsAdmin(flags?.is_admin === true)
        setIsTest(flags?.is_test === true)
      } catch (userDocError) {
        console.warn('[BudgetContext] Failed to get user doc, falling back to old approach:', userDocError)
        useFallback = true
        setIsAdmin(false)
        setIsTest(false)
      }

      // Check for pending invites (budgets where user is invited but hasn't accepted)
      const foundPendingInvites: BudgetInvite[] = []
      try {
        const budgetsRef = collection(db, 'budgets')
        const invitedQuery = query(budgetsRef, where('user_ids', 'array-contains', current_user.uid))
        const invitedSnapshot = await getDocs(invitedQuery)

        for (const budgetDoc of invitedSnapshot.docs) {
          const data = budgetDoc.data()
          // Check if user is in user_ids but not in accepted_user_ids AND not in user's budget_ids
          const isInvited = data.user_ids?.includes(current_user.uid)
          const hasAccepted = data.accepted_user_ids?.includes(current_user.uid)
          const isInUserBudgets = userDoc?.budget_ids?.includes(budgetDoc.id)

          if (isInvited && !hasAccepted && !isInUserBudgets) {
            foundPendingInvites.push({
              budgetId: budgetDoc.id,
              budgetName: data.name || 'Unnamed Budget',
              ownerEmail: data.owner_email || null,
            })
          }
        }
      } catch (err) {
        console.warn('[BudgetContext] Could not check for pending invites:', err)
      }

      setPendingInvites(foundPendingInvites)

      if (useFallback || (userDoc && userDoc.budget_ids.length === 0)) {
        // FALLBACK: Use old approach - query budgets by user_ids array
        const budgetsRef = collection(db, 'budgets')
        const q = query(budgetsRef, where('user_ids', 'array-contains', current_user.uid))
        const querySnapshot = await getDocs(q)

        // Check for budgets user has actually accepted (is in accepted_user_ids)
        const acceptedBudgets = querySnapshot.docs.filter(doc => {
          const data = doc.data()
          return data.accepted_user_ids?.includes(current_user.uid)
        })

        if (acceptedBudgets.length > 0) {
          // Load the first accepted budget
          const budgetDoc = acceptedBudgets[0]
          const data = budgetDoc.data()
          await loadBudgetData(budgetDoc.id, data)
        } else if (foundPendingInvites.length > 0) {
          // User has pending invites but no accepted budgets - don't create new budget
          // Let them choose to accept an invite or create new
          setCurrentBudget(null)
          setAccounts([])
          setAccountGroups([])
          setCategories([])
          setCategoryGroups([])
          setBudgetUserIds([])
          setAcceptedUserIds([])
          setNeedsFirstBudget(false)
        } else {
          // No pending invites and no accepted budgets - need to create first budget
          // Don't auto-create, let user confirm and name their budget
          setCurrentBudget(null)
          setAccounts([])
          setAccountGroups([])
          setCategories([])
          setCategoryGroups([])
          setBudgetUserIds([])
          setAcceptedUserIds([])
          setNeedsFirstBudget(true)
        }
      } else if (userDoc && userDoc.budget_ids.length > 0) {
        // NEW APPROACH: Load budget from user's budget_ids
        const budgetId = userDoc.budget_ids[0]
        const budgetDocRef = doc(db, 'budgets', budgetId)
        const budgetDoc = await getDoc(budgetDocRef)

        if (!budgetDoc.exists()) {
          throw new Error(`Budget ${budgetId} not found`)
        }

        await loadBudgetData(budgetDoc.id, budgetDoc.data())
      }

      loadedForUserRef.current = current_user.uid
      setIsInitialized(true)
    } catch (err) {
      console.error('[BudgetContext] Error loading budget:', err)
      setError(err instanceof Error ? err.message : 'Failed to load budget')
    } finally {
      setLoading(false)
    }
  }

  // Helper to load budget data and set state
  async function loadBudgetData(budgetId: string, data: any) {
    setCurrentBudget({
      id: budgetId,
      name: data.name,
      user_ids: data.user_ids || [],
      accepted_user_ids: data.accepted_user_ids || [],
      owner_id: data.owner_id || data.user_ids?.[0] || current_user!.uid,
      owner_email: data.owner_email || null,
    })

    setBudgetUserIds(data.user_ids || [])
    setAcceptedUserIds(data.accepted_user_ids || [])

    // Load accounts
    const loadedAccounts: FinancialAccount[] = (data.accounts || []).map((account: any) => ({
      id: account.id,
      nickname: account.nickname,
      balance: account.balance,
      account_group_id: account.account_group_id ?? null,
      sort_order: account.sort_order ?? 0,
      is_income_account: account.is_income_account,
      is_income_default: account.is_income_default,
      is_outgo_account: account.is_outgo_account,
      is_outgo_default: account.is_outgo_default,
      on_budget: account.on_budget,
      is_active: account.is_active,
    }))
    loadedAccounts.sort((a, b) => a.sort_order - b.sort_order)
    setAccounts(loadedAccounts)

    // Load account groups
    const loadedAccountGroups: AccountGroup[] = (data.account_groups || []).map((group: any) => ({
      id: group.id,
      name: group.name,
      sort_order: group.sort_order ?? 0,
      expected_balance: group.expected_balance ?? 'positive',
      on_budget: group.on_budget,
      is_active: group.is_active,
    }))
    loadedAccountGroups.sort((a, b) => a.sort_order - b.sort_order)
    setAccountGroups(loadedAccountGroups)

    // Load categories
    const loadedCategories: Category[] = (data.categories || []).map((category: any) => ({
      id: category.id,
      name: category.name,
      category_group_id: category.category_group_id ?? null,
      sort_order: category.sort_order ?? 0,
    }))
    loadedCategories.sort((a, b) => a.sort_order - b.sort_order)
    setCategories(loadedCategories)

    // Load category groups
    const loadedGroups: CategoryGroup[] = (data.category_groups || []).map((group: any) => ({
      id: group.id,
      name: group.name,
      sort_order: group.sort_order ?? 0,
    }))
    loadedGroups.sort((a, b) => a.sort_order - b.sort_order)
    setCategoryGroups(loadedGroups)
  }

  // Only loads the budget if it hasn't been loaded yet for this user
  async function ensureBudgetLoaded() {
    if (!current_user) return

    // Skip if already loaded for this user
    if (isInitialized && loadedForUserRef.current === current_user.uid) {
      return
    }

    await loadOrCreateBudget()
  }

  // OWNER ACTION: Invite a user to the budget (adds to user_ids only)
  async function inviteUserToBudget(userId: string) {
    if (!currentBudget || !current_user) return

    try {
      const budgetDocRef = doc(db, 'budgets', currentBudget.id)
      const budgetDoc = await getDoc(budgetDocRef)

      if (budgetDoc.exists()) {
        const data = budgetDoc.data()

        // Check if already invited
        if (data.user_ids?.includes(userId)) {
          throw new Error('User is already invited to this budget')
        }

        const updatedUserIds = [...(data.user_ids || []), userId]

        await setDoc(budgetDocRef, {
          ...data,
          user_ids: updatedUserIds,
        })

        setCurrentBudget({
          ...currentBudget,
          user_ids: updatedUserIds,
        })
        setBudgetUserIds(updatedUserIds)
      }
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to invite user')
    }
  }

  // OWNER ACTION: Revoke a user's access (removes from both user_ids and accepted_user_ids)
  async function revokeUserFromBudget(userId: string) {
    if (!currentBudget || !current_user) return

    try {
      const budgetDocRef = doc(db, 'budgets', currentBudget.id)
      const budgetDoc = await getDoc(budgetDocRef)

      if (budgetDoc.exists()) {
        const data = budgetDoc.data()
        const updatedUserIds = (data.user_ids || []).filter((id: string) => id !== userId)
        const updatedAcceptedUserIds = (data.accepted_user_ids || []).filter((id: string) => id !== userId)

        await setDoc(budgetDocRef, {
          ...data,
          user_ids: updatedUserIds,
          accepted_user_ids: updatedAcceptedUserIds,
        })

        setCurrentBudget({
          ...currentBudget,
          user_ids: updatedUserIds,
          accepted_user_ids: updatedAcceptedUserIds,
        })
        setBudgetUserIds(updatedUserIds)
        setAcceptedUserIds(updatedAcceptedUserIds)
      }
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to revoke user access')
    }
  }

  // USER ACTION: Check if they have a pending invite for a budget
  async function checkBudgetInvite(budgetId: string): Promise<BudgetInvite | null> {
    if (!current_user) return null

    try {
      const budgetDocRef = doc(db, 'budgets', budgetId)
      const budgetDoc = await getDoc(budgetDocRef)

      if (!budgetDoc.exists()) {
        return null
      }

      const data = budgetDoc.data()

      // Check if user is invited (in user_ids)
      if (!data.user_ids?.includes(current_user.uid)) {
        return null
      }

      // Check if already accepted
      const userDoc = await getOrCreateCurrentUserDoc()
      if (userDoc.budget_ids.includes(budgetId)) {
        return null // Already accepted
      }

      return {
        budgetId: budgetDoc.id,
        budgetName: data.name,
        ownerEmail: data.owner_email || null,
      }
    } catch {
      return null
    }
  }

  // USER ACTION: Accept a budget invite (adds budget to their budget_ids)
  async function acceptBudgetInvite(budgetId: string) {
    if (!current_user) return

    try {
      // First verify the user is invited
      const budgetDocRef = doc(db, 'budgets', budgetId)
      const budgetDoc = await getDoc(budgetDocRef)

      if (!budgetDoc.exists()) {
        throw new Error('Budget not found')
      }

      const budgetData = budgetDoc.data()

      if (!budgetData.user_ids?.includes(current_user.uid)) {
        throw new Error('You have not been invited to this budget')
      }

      // Get current user's document
      const userDoc = await getOrCreateCurrentUserDoc()

      if (userDoc.budget_ids.includes(budgetId)) {
        throw new Error('You have already accepted this invite')
      }

      // Add budget to user's budget_ids (this is what grants access per security rules)
      await setDoc(doc(db, 'users', current_user.uid), {
        ...userDoc,
        budget_ids: [...userDoc.budget_ids, budgetId],
        updated_at: new Date().toISOString(),
      })

      // Also add to budget's accepted_user_ids so owner can see who accepted
      const updatedAcceptedUserIds = [...(budgetData.accepted_user_ids || []), current_user.uid]
      await setDoc(budgetDocRef, {
        ...budgetData,
        accepted_user_ids: updatedAcceptedUserIds,
      })

      // Refresh to load the new budget
      loadedForUserRef.current = null
      await loadOrCreateBudget()
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to accept invite')
    }
  }

  // Save current budget data to Firebase
  async function saveBudgetData() {
    if (!currentBudget) return

    try {
      const budgetDocRef = doc(db, 'budgets', currentBudget.id)
      const budgetDoc = await getDoc(budgetDocRef)

      if (budgetDoc.exists()) {
        const data = budgetDoc.data()
        await setDoc(budgetDocRef, {
          ...data,
          accounts,
          account_groups: accountGroups,
          categories,
          category_groups: categoryGroups,
        })
      }
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to save budget data')
    }
  }

  // Load all budgets the user has access to (for budget switching UI)
  async function loadAccessibleBudgets() {
    if (!current_user) {
      setAccessibleBudgets([])
      return
    }

    try {
      const budgets: BudgetSummary[] = []

      // Get user document to find accepted budgets
      let userDoc: UserDocument | null = null
      try {
        userDoc = await getOrCreateCurrentUserDoc()
      } catch (e) {
        console.warn('[BudgetContext] Could not get user doc for accessible budgets')
      }

      // Query all budgets where user is in user_ids (invited or accepted)
      const budgetsRef = collection(db, 'budgets')
      const q = query(budgetsRef, where('user_ids', 'array-contains', current_user.uid))
      const querySnapshot = await getDocs(q)

      for (const budgetDoc of querySnapshot.docs) {
        const data = budgetDoc.data()
        const hasAccepted = data.accepted_user_ids?.includes(current_user.uid) || userDoc?.budget_ids?.includes(budgetDoc.id)
        const isUserOwner = data.owner_id === current_user.uid

        budgets.push({
          id: budgetDoc.id,
          name: data.name || 'Unnamed Budget',
          ownerEmail: data.owner_email || null,
          isOwner: isUserOwner,
          isPending: !hasAccepted,
        })
      }

      // Sort: owned budgets first, then accepted, then pending
      budgets.sort((a, b) => {
        if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1
        if (a.isPending !== b.isPending) return a.isPending ? 1 : -1
        return a.name.localeCompare(b.name)
      })

      setAccessibleBudgets(budgets)
    } catch (err) {
      console.error('[BudgetContext] Error loading accessible budgets:', err)
    }
  }

  // Switch to a different budget
  async function switchToBudget(budgetId: string) {
    if (!current_user) return

    setLoading(true)
    setError(null)

    try {
      const budgetDocRef = doc(db, 'budgets', budgetId)
      const budgetDoc = await getDoc(budgetDocRef)

      if (!budgetDoc.exists()) {
        throw new Error('Budget not found')
      }

      const data = budgetDoc.data()

      // Verify user has access (either in accepted_user_ids or budget's user_ids with acceptance)
      const hasAccess = data.accepted_user_ids?.includes(current_user.uid) || data.owner_id === current_user.uid

      if (!hasAccess) {
        throw new Error('You do not have access to this budget. Please accept the invite first.')
      }

      // Update user's document to use this budget as primary
      try {
        const userDocRef = doc(db, 'users', current_user.uid)
        const userDocSnap = await getDoc(userDocRef)

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data() as UserDocument
          // Move this budget to the front of the list
          const updatedBudgetIds = [budgetId, ...userData.budget_ids.filter(id => id !== budgetId)]
          await setDoc(userDocRef, {
            ...userData,
            budget_ids: updatedBudgetIds,
            updated_at: new Date().toISOString(),
          })
        }
      } catch (e) {
        console.warn('[BudgetContext] Could not update user doc primary budget:', e)
      }

      // Load the new budget
      await loadBudgetData(budgetId, data)
      loadedForUserRef.current = current_user.uid
    } catch (err) {
      console.error('[BudgetContext] Error switching budget:', err)
      setError(err instanceof Error ? err.message : 'Failed to switch budget')
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Create a new budget explicitly (with optional custom name)
  async function createNewBudget(name?: string) {
    if (!current_user) return

    const budgetName = name?.trim() || 'My Budget'

    setLoading(true)
    setError(null)

    try {
      const newBudgetId = `budget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const newBudget: Budget = {
        id: newBudgetId,
        name: budgetName,
        user_ids: [current_user.uid],
        accepted_user_ids: [current_user.uid],
        owner_id: current_user.uid,
        owner_email: current_user.email || null,
      }

      await setDoc(doc(db, 'budgets', newBudgetId), {
        name: newBudget.name,
        user_ids: newBudget.user_ids,
        accepted_user_ids: newBudget.accepted_user_ids,
        owner_id: newBudget.owner_id,
        owner_email: newBudget.owner_email,
        accounts: [],
        account_groups: [],
        categories: [],
        category_groups: [],
        created_at: new Date().toISOString(),
      })

      // Update user document with the new budget
      try {
        const userDocRef = doc(db, 'users', current_user.uid)
        const userDocSnap = await getDoc(userDocRef)

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data() as UserDocument
          await setDoc(userDocRef, {
            ...userData,
            budget_ids: [newBudgetId, ...userData.budget_ids],
            updated_at: new Date().toISOString(),
          })
        } else {
          await setDoc(userDocRef, {
            uid: current_user.uid,
            email: current_user.email || null,
            budget_ids: [newBudgetId],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        }
      } catch (e) {
        console.warn('[BudgetContext] Could not update user doc:', e)
      }

      setCurrentBudget(newBudget)
      setAccounts([])
      setAccountGroups([])
      setCategories([])
      setCategoryGroups([])
      setBudgetUserIds([current_user.uid])
      setAcceptedUserIds([current_user.uid])
      setPendingInvites([]) // Clear pending invites since user chose to create new
      setNeedsFirstBudget(false) // Clear the flag since budget is now created
      loadedForUserRef.current = current_user.uid
    } catch (err) {
      console.error('[BudgetContext] Error creating new budget:', err)
      setError(err instanceof Error ? err.message : 'Failed to create new budget')
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Rename the current budget (owner only)
  async function renameBudget(newName: string) {
    if (!current_user || !currentBudget) return

    // Only owner can rename
    if (currentBudget.owner_id !== current_user.uid) {
      throw new Error('Only the budget owner can rename the budget')
    }

    const trimmedName = newName.trim()
    if (!trimmedName) {
      throw new Error('Budget name cannot be empty')
    }

    try {
      const budgetDocRef = doc(db, 'budgets', currentBudget.id)
      const budgetDoc = await getDoc(budgetDocRef)

      if (!budgetDoc.exists()) {
        throw new Error('Budget not found')
      }

      const data = budgetDoc.data()
      await setDoc(budgetDocRef, {
        ...data,
        name: trimmedName,
      })

      // Update local state
      setCurrentBudget({
        ...currentBudget,
        name: trimmedName,
      })
    } catch (err) {
      console.error('[BudgetContext] Error renaming budget:', err)
      throw new Error(err instanceof Error ? err.message : 'Failed to rename budget')
    }
  }

  // Generate month document ID
  function getMonthDocId(budgetId: string, year: number, month: number): string {
    const monthStr = month.toString().padStart(2, '0')
    return `${budgetId}_${year}_${monthStr}`
  }

  // Load or create a month document
  async function loadMonth(year: number, month: number) {
    if (!currentBudget || !current_user) return

    setMonthLoading(true)
    setCurrentYear(year)
    setCurrentMonthNumber(month)

    try {
      // Use the shared getOrCreateMonthDoc to prevent race conditions
      const monthData = await getOrCreateMonthDoc(currentBudget.id, year, month)
      setCurrentMonth(monthData)
    } catch (err) {
      console.error('[BudgetContext] Error loading month:', err)
      throw new Error(err instanceof Error ? err.message : 'Failed to load month')
    } finally {
      setMonthLoading(false)
    }
  }

  // Navigate to previous month
  async function goToPreviousMonth() {
    let newYear = currentYear
    let newMonth = currentMonthNumber - 1
    if (newMonth < 1) {
      newMonth = 12
      newYear -= 1
    }
    await loadMonth(newYear, newMonth)
  }

  // Navigate to next month
  async function goToNextMonth() {
    let newYear = currentYear
    let newMonth = currentMonthNumber + 1
    if (newMonth > 12) {
      newMonth = 1
      newYear += 1
    }
    await loadMonth(newYear, newMonth)
  }

  // Helper to save a new payee to the payees document
  async function savePayeeIfNew(payee: string) {
    if (!currentBudget || !payee.trim()) return

    const trimmedPayee = payee.trim()
    if (payees.includes(trimmedPayee)) return

    try {
      const payeesDocRef = doc(db, 'payees', currentBudget.id)
      const updatedPayees = [...payees, trimmedPayee].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))

      await setDoc(payeesDocRef, {
        budget_id: currentBudget.id,
        payees: updatedPayees,
        updated_at: new Date().toISOString(),
      })

      setPayees(updatedPayees)
    } catch (err) {
      console.warn('[BudgetContext] Error saving payee:', err)
      // Don't throw - this is a non-critical operation
    }
  }

  // Load payees for the current budget
  async function loadPayees() {
    if (!currentBudget) {
      setPayees([])
      return
    }

    try {
      const payeesDocRef = doc(db, 'payees', currentBudget.id)
      const payeesDoc = await getDoc(payeesDocRef)

      if (payeesDoc.exists()) {
        const data = payeesDoc.data() as PayeesDocument
        setPayees(data.payees || [])
      } else {
        setPayees([])
      }
    } catch (err) {
      console.warn('[BudgetContext] Error loading payees:', err)
      setPayees([])
    }
  }

  // Helper to clean income array for Firestore
  function cleanIncomeForFirestore(incomeList: IncomeTransaction[]): Record<string, any>[] {
    return incomeList.map(inc => {
      const cleaned: Record<string, any> = {
        id: inc.id,
        amount: inc.amount,
        account_id: inc.account_id,
        date: inc.date,
        created_at: inc.created_at,
      }
      if (inc.payee) cleaned.payee = inc.payee
      if (inc.description) cleaned.description = inc.description
      return cleaned
    })
  }

  // Track in-progress month creations to prevent race conditions (useRef to persist across renders)
  const monthCreationInProgress = useRef(new Map<string, Promise<MonthDocument>>())

  // Helper to get or create a month document
  async function getOrCreateMonthDoc(budgetId: string, year: number, month: number): Promise<MonthDocument> {
    const monthDocId = getMonthDocId(budgetId, year, month)

    // Check if there's already a creation in progress for this month
    const existingPromise = monthCreationInProgress.current.get(monthDocId)
    if (existingPromise) {
      return existingPromise
    }

    const createPromise = (async () => {
      const monthDocRef = doc(db, 'months', monthDocId)
      const monthDoc = await getDoc(monthDocRef)

      if (monthDoc.exists()) {
        const data = monthDoc.data()
        const income = data.income || []
        return {
          budget_id: data.budget_id,
          year: data.year,
          month: data.month,
          income,
          total_income: data.total_income ?? income.reduce((sum: number, inc: any) => sum + (inc.amount || 0), 0),
          created_at: data.created_at,
          updated_at: data.updated_at || data.created_at,
        }
      } else {
        // Create new month document
        const now = new Date().toISOString()
        const newMonth: MonthDocument = {
          budget_id: budgetId,
          year,
          month,
          income: [],
          total_income: 0,
          created_at: now,
          updated_at: now,
        }
        await setDoc(monthDocRef, newMonth)
        return newMonth
      }
    })()

    // Track this creation
    monthCreationInProgress.current.set(monthDocId, createPromise)

    try {
      return await createPromise
    } finally {
      // Clean up after completion
      monthCreationInProgress.current.delete(monthDocId)
    }
  }

  // Add income transaction
  async function addIncome(amount: number, accountId: string, date: string, payee?: string, description?: string) {
    if (!currentBudget || !current_user) {
      throw new Error('No budget loaded')
    }

    try {
      // Parse the date string directly to avoid timezone issues
      // Date format is YYYY-MM-DD
      const [incomeYear, incomeMonth] = date.split('-').map(Number)

      // Build income object
      const newIncome: IncomeTransaction = {
        id: `income_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        amount,
        account_id: accountId,
        date,
        created_at: new Date().toISOString(),
      }
      if (payee?.trim()) newIncome.payee = payee.trim()
      if (description) newIncome.description = description

      // Get the target month document (may be different from currently viewed month)
      const targetMonth = await getOrCreateMonthDoc(currentBudget.id, incomeYear, incomeMonth)
      const monthDocId = getMonthDocId(currentBudget.id, incomeYear, incomeMonth)
      const monthDocRef = doc(db, 'months', monthDocId)

      const updatedIncome = [...targetMonth.income, newIncome]
      const newTotalIncome = updatedIncome.reduce((sum, inc) => sum + inc.amount, 0)

      // Save to the target month
      const cleanedMonth: Record<string, any> = {
        budget_id: targetMonth.budget_id,
        year: targetMonth.year,
        month: targetMonth.month,
        income: cleanIncomeForFirestore(updatedIncome),
        total_income: newTotalIncome,
        updated_at: new Date().toISOString(),
      }
      if (targetMonth.created_at) cleanedMonth.created_at = targetMonth.created_at

      await setDoc(monthDocRef, cleanedMonth)

      // Update local month state only if it's the currently viewed month
      if (currentMonth && incomeYear === currentYear && incomeMonth === currentMonthNumber) {
        setCurrentMonth({
          ...currentMonth,
          income: updatedIncome,
          total_income: newTotalIncome,
        })
      }

      // Save payee if new
      if (payee?.trim()) {
        await savePayeeIfNew(payee)
      }

      // Update account balance - read fresh from Firestore to avoid stale state
      const budgetDocRef = doc(db, 'budgets', currentBudget.id)
      const budgetDoc = await getDoc(budgetDocRef)

      if (budgetDoc.exists()) {
        const budgetData = budgetDoc.data()
        const currentAccounts: FinancialAccount[] = budgetData.accounts || []

        const targetAccount = currentAccounts.find(a => a.id === accountId)

        if (targetAccount) {
          const updatedAccounts = currentAccounts.map(acc =>
            acc.id === accountId
              ? { ...acc, balance: acc.balance + amount }
              : acc
          )

          const cleanedAccounts = cleanAccountsForFirestore(updatedAccounts)

          await setDoc(budgetDocRef, { ...budgetData, accounts: cleanedAccounts })

          // Update local state
          setAccounts(updatedAccounts)
        } else {
          console.warn('[BudgetContext] addIncome - target account not found:', accountId)
        }
      } else {
        console.error('[BudgetContext] addIncome - budget document not found')
      }
    } catch (err) {
      console.error('[BudgetContext] Error adding income:', err)
      throw new Error(err instanceof Error ? err.message : 'Failed to add income')
    }
  }

  // Update income transaction
  async function updateIncome(incomeId: string, amount: number, accountId: string, date: string, payee?: string, description?: string) {
    if (!currentBudget || !current_user || !currentMonth) {
      throw new Error('No budget or month loaded')
    }

    try {
      const oldIncome = currentMonth.income.find(i => i.id === incomeId)
      if (!oldIncome) {
        throw new Error('Income transaction not found')
      }

      // Parse the date string directly to avoid timezone issues
      // Date format is YYYY-MM-DD
      const [newYear, newMonth] = date.split('-').map(Number)

      // Check if the income is moving to a different month
      const isMovingToNewMonth = newYear !== currentYear || newMonth !== currentMonthNumber

      // Build the updated income object
      const updatedIncome: IncomeTransaction = {
        id: oldIncome.id,
        amount,
        account_id: accountId,
        date,
        created_at: oldIncome.created_at,
      }
      if (payee?.trim()) updatedIncome.payee = payee.trim()
      if (description) updatedIncome.description = description

      if (isMovingToNewMonth) {
        // Remove from current month
        const currentMonthDocId = getMonthDocId(currentBudget.id, currentYear, currentMonthNumber)
        const currentMonthDocRef = doc(db, 'months', currentMonthDocId)
        const updatedCurrentMonthIncome = currentMonth.income.filter(inc => inc.id !== incomeId)
        const currentMonthTotalIncome = updatedCurrentMonthIncome.reduce((sum, inc) => sum + inc.amount, 0)

        const cleanedCurrentMonth: Record<string, any> = {
          budget_id: currentMonth.budget_id,
          year: currentMonth.year,
          month: currentMonth.month,
          income: cleanIncomeForFirestore(updatedCurrentMonthIncome),
          total_income: currentMonthTotalIncome,
          updated_at: new Date().toISOString(),
        }
        if (currentMonth.created_at) cleanedCurrentMonth.created_at = currentMonth.created_at
        await setDoc(currentMonthDocRef, cleanedCurrentMonth)

        // Update local state for current month
        setCurrentMonth({
          ...currentMonth,
          income: updatedCurrentMonthIncome,
          total_income: currentMonthTotalIncome,
        })

        // Add to new month
        const targetMonth = await getOrCreateMonthDoc(currentBudget.id, newYear, newMonth)
        const newMonthDocId = getMonthDocId(currentBudget.id, newYear, newMonth)
        const newMonthDocRef = doc(db, 'months', newMonthDocId)
        const updatedNewMonthIncome = [...targetMonth.income, updatedIncome]
        const newMonthTotalIncome = updatedNewMonthIncome.reduce((sum, inc) => sum + inc.amount, 0)

        const cleanedNewMonth: Record<string, any> = {
          budget_id: targetMonth.budget_id,
          year: targetMonth.year,
          month: targetMonth.month,
          income: cleanIncomeForFirestore(updatedNewMonthIncome),
          total_income: newMonthTotalIncome,
          updated_at: new Date().toISOString(),
        }
        if (targetMonth.created_at) cleanedNewMonth.created_at = targetMonth.created_at
        await setDoc(newMonthDocRef, cleanedNewMonth)
      } else {
        // Same month - just update in place
        const monthDocId = getMonthDocId(currentBudget.id, currentYear, currentMonthNumber)
        const monthDocRef = doc(db, 'months', monthDocId)

        const updatedIncomeList = currentMonth.income.map(inc =>
          inc.id === incomeId ? updatedIncome : inc
        )
        const newTotalIncome = updatedIncomeList.reduce((sum, inc) => sum + inc.amount, 0)

        const cleanedMonth: Record<string, any> = {
          budget_id: currentMonth.budget_id,
          year: currentMonth.year,
          month: currentMonth.month,
          income: cleanIncomeForFirestore(updatedIncomeList),
          total_income: newTotalIncome,
          updated_at: new Date().toISOString(),
        }
        if (currentMonth.created_at) cleanedMonth.created_at = currentMonth.created_at
        await setDoc(monthDocRef, cleanedMonth)

        // Update local month state
        setCurrentMonth({
          ...currentMonth,
          income: updatedIncomeList,
          total_income: newTotalIncome,
        })
      }

      // Save payee if new
      if (payee?.trim()) {
        await savePayeeIfNew(payee)
      }

      // Only update account balances if amount or account changed
      const amountChanged = amount !== oldIncome.amount
      const accountChanged = oldIncome.account_id !== accountId

      if (amountChanged || accountChanged) {
        // Update account balances - read fresh from Firestore to avoid stale state
        const budgetDocRef = doc(db, 'budgets', currentBudget.id)
        const budgetDoc = await getDoc(budgetDocRef)

        if (budgetDoc.exists()) {
          const budgetData = budgetDoc.data()
          let currentAccounts: FinancialAccount[] = budgetData.accounts || []

          // If account changed, adjust both old and new accounts
          if (accountChanged) {
            // Remove from old account
            currentAccounts = currentAccounts.map(acc =>
              acc.id === oldIncome.account_id
                ? { ...acc, balance: acc.balance - oldIncome.amount }
                : acc
            )
            // Add to new account
            currentAccounts = currentAccounts.map(acc =>
              acc.id === accountId
                ? { ...acc, balance: acc.balance + amount }
                : acc
            )
          } else if (amountChanged) {
            // Same account, just adjust the difference
            const amountDiff = amount - oldIncome.amount
            currentAccounts = currentAccounts.map(acc =>
              acc.id === accountId
                ? { ...acc, balance: acc.balance + amountDiff }
                : acc
            )
          }

          const cleanedAccounts = cleanAccountsForFirestore(currentAccounts)
          await setDoc(budgetDocRef, { ...budgetData, accounts: cleanedAccounts })

          // Update local state
          setAccounts(currentAccounts)
        }
      } else {
      }
    } catch (err) {
      console.error('[BudgetContext] Error updating income:', err)
      throw new Error(err instanceof Error ? err.message : 'Failed to update income')
    }
  }

  // Delete income transaction
  async function deleteIncome(incomeId: string) {
    if (!currentBudget || !current_user || !currentMonth) {
      throw new Error('No budget or month loaded')
    }

    try {
      const incomeToDelete = currentMonth.income.find(i => i.id === incomeId)
      if (!incomeToDelete) {
        throw new Error('Income transaction not found')
      }

      const monthDocId = getMonthDocId(currentBudget.id, currentYear, currentMonthNumber)
      const monthDocRef = doc(db, 'months', monthDocId)

      const updatedIncomeList = currentMonth.income.filter(inc => inc.id !== incomeId)
      const newTotalIncome = updatedIncomeList.reduce((sum, inc) => sum + inc.amount, 0)

      // Clean the month data before saving (remove undefined values)
      const cleanedMonth: Record<string, any> = {
        budget_id: currentMonth.budget_id,
        year: currentMonth.year,
        month: currentMonth.month,
        income: cleanIncomeForFirestore(updatedIncomeList),
        total_income: newTotalIncome,
        updated_at: new Date().toISOString(),
      }
      if (currentMonth.created_at) cleanedMonth.created_at = currentMonth.created_at

      await setDoc(monthDocRef, cleanedMonth)

      // Update local month state
      setCurrentMonth({
        ...currentMonth,
        income: updatedIncomeList,
        total_income: newTotalIncome,
      })

      // Update account balance - read fresh from Firestore to avoid stale state
      const budgetDocRef = doc(db, 'budgets', currentBudget.id)
      const budgetDoc = await getDoc(budgetDocRef)

      if (budgetDoc.exists()) {
        const budgetData = budgetDoc.data()
        const currentAccounts: FinancialAccount[] = budgetData.accounts || []

        const updatedAccounts = currentAccounts.map(acc =>
          acc.id === incomeToDelete.account_id
            ? { ...acc, balance: acc.balance - incomeToDelete.amount }
            : acc
        )

        const cleanedAccounts = cleanAccountsForFirestore(updatedAccounts)
        await setDoc(budgetDocRef, { ...budgetData, accounts: cleanedAccounts })

        // Update local state
        setAccounts(updatedAccounts)
      }
    } catch (err) {
      console.error('[BudgetContext] Error deleting income:', err)
      throw new Error(err instanceof Error ? err.message : 'Failed to delete income')
    }
  }

  // Recompute totals for current month only - recalculates total_income on month doc
  async function recomputeMonthTotals() {
    if (!currentBudget || !current_user || !currentMonth) {
      throw new Error('No budget or month loaded')
    }

    try {

      // Recalculate total_income for this month
      const newTotalIncome = currentMonth.income.reduce((sum, inc) => sum + inc.amount, 0)

      // Save updated month document
      const monthDocId = getMonthDocId(currentBudget.id, currentYear, currentMonthNumber)
      const monthDocRef = doc(db, 'months', monthDocId)

      const cleanedMonth: Record<string, any> = {
        budget_id: currentMonth.budget_id,
        year: currentMonth.year,
        month: currentMonth.month,
        income: cleanIncomeForFirestore(currentMonth.income),
        total_income: newTotalIncome,
        updated_at: new Date().toISOString(),
      }
      if (currentMonth.created_at) cleanedMonth.created_at = currentMonth.created_at
      if (currentMonth.account_balances_start) cleanedMonth.account_balances_start = currentMonth.account_balances_start
      if (currentMonth.account_balances_end) cleanedMonth.account_balances_end = currentMonth.account_balances_end

      await setDoc(monthDocRef, cleanedMonth)

      // Update local month state
      setCurrentMonth({
        ...currentMonth,
        total_income: newTotalIncome,
      })

    } catch (err) {
      console.error('[BudgetContext] Error recomputing month totals:', err)
      throw new Error(err instanceof Error ? err.message : 'Failed to recompute month totals')
    }
  }

  // Recompute all account balances from all months in history
  async function recomputeAllBalances() {
    if (!currentBudget || !current_user) {
      throw new Error('No budget loaded')
    }

    try {

      // 1. Get all month documents for this budget
      const monthsQuery = query(
        collection(db, 'months'),
        where('budget_id', '==', currentBudget.id)
      )
      const monthsSnapshot = await getDocs(monthsQuery)

      const allMonths: MonthDocument[] = []
      monthsSnapshot.forEach(doc => {
        const data = doc.data()
        allMonths.push({
          budget_id: data.budget_id,
          year: data.year,
          month: data.month,
          income: data.income || [],
          total_income: data.total_income || 0,
          account_balances_start: data.account_balances_start,
          account_balances_end: data.account_balances_end,
          created_at: data.created_at,
          updated_at: data.updated_at,
        })
      })


      // 2. Sort months chronologically
      allMonths.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year
        return a.month - b.month
      })

      // 3. Get all account IDs from budget
      const budgetDocRef = doc(db, 'budgets', currentBudget.id)
      const budgetDoc = await getDoc(budgetDocRef)
      if (!budgetDoc.exists()) {
        throw new Error('Budget document not found')
      }
      const budgetData = budgetDoc.data()
      const currentAccounts: FinancialAccount[] = budgetData.accounts || []
      const accountIds = currentAccounts.map(a => a.id)

      // 4. Calculate balances month by month
      let runningBalances: Record<string, number> = {}
      // Initialize all accounts to 0
      accountIds.forEach(id => { runningBalances[id] = 0 })

      for (const monthData of allMonths) {
        // Start balances = previous month's end balances (or 0 for first month)
        const startBalances = { ...runningBalances }

        // Recalculate total_income
        const totalIncome = monthData.income.reduce((sum, inc) => sum + inc.amount, 0)

        // Calculate income by account for this month
        const incomeByAccount: Record<string, number> = {}
        for (const inc of monthData.income) {
          incomeByAccount[inc.account_id] = (incomeByAccount[inc.account_id] || 0) + inc.amount
        }

        // End balances = start + income for each account
        const endBalances: Record<string, number> = {}
        accountIds.forEach(id => {
          endBalances[id] = startBalances[id] + (incomeByAccount[id] || 0)
        })

        // Update running balances for next month
        runningBalances = { ...endBalances }

        // Save updated month document
        const monthDocId = getMonthDocId(currentBudget.id, monthData.year, monthData.month)
        const monthDocRef = doc(db, 'months', monthDocId)

        const cleanedMonth: Record<string, any> = {
          budget_id: monthData.budget_id,
          year: monthData.year,
          month: monthData.month,
          income: cleanIncomeForFirestore(monthData.income),
          total_income: totalIncome,
          account_balances_start: startBalances,
          account_balances_end: endBalances,
          updated_at: new Date().toISOString(),
        }
        if (monthData.created_at) cleanedMonth.created_at = monthData.created_at

        await setDoc(monthDocRef, cleanedMonth)

        // Update current month state if this is the one being viewed
        if (monthData.year === currentYear && monthData.month === currentMonthNumber) {
          setCurrentMonth({
            ...monthData,
            total_income: totalIncome,
            account_balances_start: startBalances,
            account_balances_end: endBalances,
          })
        }
      }

      // 5. Update account balances on budget doc to match latest month's end balances
      const updatedAccounts = currentAccounts.map(acc => ({
        ...acc,
        balance: runningBalances[acc.id] || 0,
      }))


      const cleanedAccounts = cleanAccountsForFirestore(updatedAccounts)
      await setDoc(budgetDocRef, { ...budgetData, accounts: cleanedAccounts })

      // Update local state
      setAccounts(updatedAccounts)


      // Clear any mismatch since we just reconciled
      setBalanceMismatch(null)
    } catch (err) {
      console.error('[BudgetContext] Error recomputing all balances:', err)
      throw new Error(err instanceof Error ? err.message : 'Failed to recompute all balances')
    }
  }

  // Check if stored account balances match calculated balances from month history
  async function checkBalanceMismatch(): Promise<Record<string, { stored: number; calculated: number }> | null> {
    if (!currentBudget || !current_user) {
      return null
    }

    try {

      // 1. Get all month documents for this budget
      const monthsQuery = query(
        collection(db, 'months'),
        where('budget_id', '==', currentBudget.id)
      )
      const monthsSnapshot = await getDocs(monthsQuery)

      // 2. Calculate balances from all income transactions
      const calculatedBalances: Record<string, number> = {}

      // Initialize all current accounts to 0
      accounts.forEach(acc => { calculatedBalances[acc.id] = 0 })

      monthsSnapshot.forEach(doc => {
        const data = doc.data()
        const income = data.income || []
        for (const inc of income) {
          calculatedBalances[inc.account_id] = (calculatedBalances[inc.account_id] || 0) + inc.amount
        }
      })


      // 3. Compare with stored balances
      const mismatches: Record<string, { stored: number; calculated: number }> = {}

      for (const acc of accounts) {
        const stored = acc.balance
        const calculated = calculatedBalances[acc.id] || 0
        // Use a small epsilon for floating point comparison
        if (Math.abs(stored - calculated) > 0.001) {
          mismatches[acc.id] = { stored, calculated }
        }
      }

      const hasMismatches = Object.keys(mismatches).length > 0

      setBalanceMismatch(hasMismatches ? mismatches : null)
      return hasMismatches ? mismatches : null
    } catch (err) {
      console.error('[BudgetContext] Error checking balance mismatch:', err)
      return null
    }
  }

  // Reconcile balances - recalculate all balances from month history
  async function reconcileBalances(): Promise<void> {
    await recomputeAllBalances()
  }

  const isOwner = !!(currentBudget && current_user && currentBudget.owner_id === current_user.uid)
  const hasPendingInvites = pendingInvites.length > 0

  return (
    <BudgetContext.Provider value={{
      currentBudget,
      loading,
      error,
      isOwner,
      isAdmin,
      isTest,
      currentUserId: current_user?.uid || null,
      isInitialized,
      accounts,
      accountGroups,
      categories,
      categoryGroups,
      budgetUserIds,
      acceptedUserIds,
      pendingInvites,
      hasPendingInvites,
      needsFirstBudget,
      accessibleBudgets,
      currentMonth,
      currentYear,
      currentMonthNumber,
      monthLoading,
      payees,
      ensureBudgetLoaded,
      refreshBudget: loadOrCreateBudget,
      inviteUserToBudget,
      revokeUserFromBudget,
      checkBudgetInvite,
      acceptBudgetInvite,
      loadAccessibleBudgets,
      switchToBudget,
      createNewBudget,
      renameBudget,
      setAccounts,
      setAccountGroups,
      setCategories,
      setCategoryGroups,
      saveBudgetData,
      loadMonth,
      goToPreviousMonth,
      goToNextMonth,
      addIncome,
      updateIncome,
      deleteIncome,
      recomputeMonthTotals,
      recomputeAllBalances,
      checkBalanceMismatch,
      reconcileBalances,
      balanceMismatch,
      loadPayees,
    }}>
      {children}
    </BudgetContext.Provider>
  )
}

export function useBudget() {
  return useContext(BudgetContext)
}

export default BudgetContext
