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
}

export interface FinancialAccount {
  id: string
  nickname: string
  balance: number
  account_group_id: string | null
  sort_order: number
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
})

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
    }))
    loadedAccounts.sort((a, b) => a.sort_order - b.sort_order)
    setAccounts(loadedAccounts)

    // Load account groups
    const loadedAccountGroups: AccountGroup[] = (data.account_groups || []).map((group: any) => ({
      id: group.id,
      name: group.name,
      sort_order: group.sort_order ?? 0,
      expected_balance: group.expected_balance ?? 'positive',
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
    }}>
      {children}
    </BudgetContext.Provider>
  )
}

export function useBudget() {
  return useContext(BudgetContext)
}

export default BudgetContext
