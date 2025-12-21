import { createContext, useContext, useState, useRef, type ReactNode } from 'react'
import { getFirestore, collection, query, where, getDocs, doc, setDoc, getDoc } from 'firebase/firestore'
import app from '../firebase'
import useFirebaseAuth from '../hooks/useFirebaseAuth'

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
  user_ids: string[]
  owner_id: string
  owner_email: string | null
}

interface BudgetContextType {
  currentBudget: Budget | null
  loading: boolean
  error: string | null
  isOwner: boolean
  currentUserId: string | null
  isInitialized: boolean

  // Budget data
  accounts: FinancialAccount[]
  accountGroups: AccountGroup[]
  categories: Category[]
  categoryGroups: CategoryGroup[]

  // Methods
  ensureBudgetLoaded: () => Promise<void>
  refreshBudget: () => Promise<void>
  updateBudgetUsers: (userIds: string[]) => Promise<void>

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
  currentUserId: null,
  isInitialized: false,
  accounts: [],
  accountGroups: [],
  categories: [],
  categoryGroups: [],
  ensureBudgetLoaded: async () => {},
  refreshBudget: async () => {},
  updateBudgetUsers: async () => {},
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

  const db = getFirestore(app)
  const current_user = firebase_auth_hook.get_current_firebase_user()

  async function loadOrCreateBudget() {
    if (!current_user) {
      setCurrentBudget(null)
      setAccounts([])
      setAccountGroups([])
      setCategories([])
      setCategoryGroups([])
      setLoading(false)
      setIsInitialized(false)
      loadedForUserRef.current = null
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Find budgets the user has access to
      const budgetsRef = collection(db, 'budgets')
      const q = query(budgetsRef, where('user_ids', 'array-contains', current_user.uid))
      const querySnapshot = await getDocs(q)

      if (querySnapshot.empty) {
        // Create a default budget for the user
        const newBudgetId = `budget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const newBudget: Budget = {
          id: newBudgetId,
          name: 'My Budget',
          user_ids: [current_user.uid],
          owner_id: current_user.uid,
          owner_email: current_user.email || null,
        }

        await setDoc(doc(db, 'budgets', newBudgetId), {
          name: newBudget.name,
          user_ids: newBudget.user_ids,
          owner_id: newBudget.owner_id,
          owner_email: newBudget.owner_email,
          accounts: [],
          account_groups: [],
          categories: [],
          category_groups: [],
          created_at: new Date().toISOString(),
        })

        setCurrentBudget(newBudget)
        setAccounts([])
        setAccountGroups([])
        setCategories([])
        setCategoryGroups([])
      } else {
        // Use the first budget found (could add selector later)
        const budgetDoc = querySnapshot.docs[0]
        const data = budgetDoc.data()

        setCurrentBudget({
          id: budgetDoc.id,
          name: data.name,
          user_ids: data.user_ids,
          owner_id: data.owner_id || data.user_ids[0],
          owner_email: data.owner_email || null,
        })

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

      loadedForUserRef.current = current_user.uid
      setIsInitialized(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load budget')
    } finally {
      setLoading(false)
    }
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

  async function updateBudgetUsers(userIds: string[]) {
    if (!currentBudget || !current_user) return

    try {
      const budgetDocRef = doc(db, 'budgets', currentBudget.id)
      const budgetDoc = await getDoc(budgetDocRef)

      if (budgetDoc.exists()) {
        const data = budgetDoc.data()
        await setDoc(budgetDocRef, {
          ...data,
          user_ids: userIds,
        })

        setCurrentBudget({
          ...currentBudget,
          user_ids: userIds,
        })
      }
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to update users')
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

  const isOwner = !!(currentBudget && current_user && currentBudget.owner_id === current_user.uid)

  return (
    <BudgetContext.Provider value={{
      currentBudget,
      loading,
      error,
      isOwner,
      currentUserId: current_user?.uid || null,
      isInitialized,
      accounts,
      accountGroups,
      categories,
      categoryGroups,
      ensureBudgetLoaded,
      refreshBudget: loadOrCreateBudget,
      updateBudgetUsers,
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
