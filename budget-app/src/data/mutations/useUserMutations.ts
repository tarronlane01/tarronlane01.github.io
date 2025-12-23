/**
 * User Mutations Hook
 *
 * Provides mutation functions for user-related operations:
 * - Creating new budgets
 * - Accepting/checking budget invites
 * - Inviting/revoking users from budgets
 * - Switching active budget
 *
 * All mutations include optimistic updates and automatic cache invalidation.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore'
import app from '../../firebase'
import { queryKeys } from '../queryClient'
import type { UserDocument, BudgetInvite } from '../../types/budget'
import type { BudgetData } from '../queries/useBudgetQuery'

interface CreateBudgetParams {
  name: string
  userId: string
  userEmail: string | null
}

interface AcceptInviteParams {
  budgetId: string
  userId: string
}

interface InviteUserParams {
  budgetId: string
  userId: string
}

interface RevokeUserParams {
  budgetId: string
  userId: string
}

interface SwitchBudgetParams {
  budgetId: string
  userId: string
}

interface CheckInviteParams {
  budgetId: string
  userId: string
  userBudgetIds: string[]
}

/**
 * Hook providing mutation functions for user-related operations
 */
export function useUserMutations() {
  const queryClient = useQueryClient()
  const db = getFirestore(app)

  /**
   * Create a new budget
   */
  const createBudget = useMutation({
    mutationFn: async ({ name, userId, userEmail }: CreateBudgetParams) => {
      const budgetId = `budget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const now = new Date().toISOString()

      // Create budget document
      const budgetDocRef = doc(db, 'budgets', budgetId)
      const newBudget = {
        name: name.trim() || 'My Budget',
        user_ids: [userId],
        accepted_user_ids: [userId],
        owner_id: userId,
        owner_email: userEmail,
        accounts: {},
        account_groups: {},
        categories: {},
        category_groups: [],
        created_at: now,
        updated_at: now,
      }
      await setDoc(budgetDocRef, newBudget)

      // Update user document
      const userDocRef = doc(db, 'users', userId)
      const userDoc = await getDoc(userDocRef)

      if (userDoc.exists()) {
        const userData = userDoc.data() as UserDocument
        await setDoc(userDocRef, {
          ...userData,
          budget_ids: [budgetId, ...userData.budget_ids],
          updated_at: now,
        })
      } else {
        // Create new user document
        await setDoc(userDocRef, {
          uid: userId,
          email: userEmail,
          budget_ids: [budgetId],
          created_at: now,
          updated_at: now,
        })
      }

      return { budgetId, budget: { id: budgetId, ...newBudget } }
    },
    onSuccess: (_data, { userId }) => {
      // Invalidate user and accessible budgets queries
      queryClient.invalidateQueries({ queryKey: queryKeys.user(userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.accessibleBudgets(userId) })
    },
  })

  /**
   * Accept a budget invite
   */
  const acceptInvite = useMutation({
    mutationFn: async ({ budgetId, userId }: AcceptInviteParams) => {
      const now = new Date().toISOString()

      // Verify invitation exists
      const budgetDocRef = doc(db, 'budgets', budgetId)
      const budgetDoc = await getDoc(budgetDocRef)

      if (!budgetDoc.exists()) {
        throw new Error('Budget not found')
      }

      const budgetData = budgetDoc.data()
      if (!budgetData.user_ids?.includes(userId)) {
        throw new Error('You have not been invited to this budget')
      }

      // Update user document
      const userDocRef = doc(db, 'users', userId)
      const userDoc = await getDoc(userDocRef)
      const userData = userDoc.exists() ? userDoc.data() as UserDocument : null

      if (userData?.budget_ids?.includes(budgetId)) {
        throw new Error('You have already accepted this invite')
      }

      await setDoc(userDocRef, {
        ...(userData || { uid: userId, email: null }),
        budget_ids: [budgetId, ...(userData?.budget_ids || [])],
        updated_at: now,
      })

      // Update budget's accepted_user_ids
      await setDoc(budgetDocRef, {
        ...budgetData,
        accepted_user_ids: [...(budgetData.accepted_user_ids || []), userId],
      })

      return { budgetId }
    },
    onSuccess: (data, { userId }) => {
      // Invalidate user and accessible budgets queries
      queryClient.invalidateQueries({ queryKey: queryKeys.user(userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.accessibleBudgets(userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.budget(data.budgetId) })
    },
  })

  /**
   * Invite a user to a budget
   */
  const inviteUser = useMutation({
    mutationFn: async ({ budgetId, userId }: InviteUserParams) => {
      const budgetDocRef = doc(db, 'budgets', budgetId)
      const budgetDoc = await getDoc(budgetDocRef)

      if (!budgetDoc.exists()) {
        throw new Error('Budget not found')
      }

      const data = budgetDoc.data()
      if (data.user_ids?.includes(userId)) {
        throw new Error('User is already invited')
      }

      await setDoc(budgetDocRef, {
        ...data,
        user_ids: [...(data.user_ids || []), userId],
      })

      return { budgetId }
    },
    onMutate: async ({ budgetId, userId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.budget(budgetId) })
      const previousData = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))

      if (previousData) {
        queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
          ...previousData,
          budget: {
            ...previousData.budget,
            user_ids: [...previousData.budget.user_ids, userId],
          },
        })
      }

      return { previousData }
    },
    onError: (_err, { budgetId }, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.budget(budgetId), context.previousData)
      }
    },
    onSettled: (_data, _error, { budgetId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budget(budgetId) })
    },
  })

  /**
   * Revoke a user's access to a budget
   */
  const revokeUser = useMutation({
    mutationFn: async ({ budgetId, userId }: RevokeUserParams) => {
      const budgetDocRef = doc(db, 'budgets', budgetId)
      const budgetDoc = await getDoc(budgetDocRef)

      if (!budgetDoc.exists()) {
        throw new Error('Budget not found')
      }

      const data = budgetDoc.data()
      await setDoc(budgetDocRef, {
        ...data,
        user_ids: (data.user_ids || []).filter((id: string) => id !== userId),
        accepted_user_ids: (data.accepted_user_ids || []).filter((id: string) => id !== userId),
      })

      return { budgetId }
    },
    onMutate: async ({ budgetId, userId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.budget(budgetId) })
      const previousData = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))

      if (previousData) {
        queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
          ...previousData,
          budget: {
            ...previousData.budget,
            user_ids: previousData.budget.user_ids.filter(id => id !== userId),
            accepted_user_ids: previousData.budget.accepted_user_ids.filter(id => id !== userId),
          },
        })
      }

      return { previousData }
    },
    onError: (_err, { budgetId }, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.budget(budgetId), context.previousData)
      }
    },
    onSettled: (_data, _error, { budgetId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budget(budgetId) })
    },
  })

  /**
   * Switch active budget (moves to front of user's budget_ids list)
   */
  const switchBudget = useMutation({
    mutationFn: async ({ budgetId, userId }: SwitchBudgetParams) => {
      const userDocRef = doc(db, 'users', userId)
      const userDoc = await getDoc(userDocRef)

      if (!userDoc.exists()) {
        throw new Error('User document not found')
      }

      const userData = userDoc.data() as UserDocument
      const updatedBudgetIds = [budgetId, ...userData.budget_ids.filter(id => id !== budgetId)]

      await setDoc(userDocRef, {
        ...userData,
        budget_ids: updatedBudgetIds,
        updated_at: new Date().toISOString(),
      })

      return { budgetId }
    },
    onMutate: async ({ budgetId, userId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.user(userId) })
      const previousData = queryClient.getQueryData<UserDocument>(queryKeys.user(userId))

      if (previousData) {
        queryClient.setQueryData<UserDocument>(queryKeys.user(userId), {
          ...previousData,
          budget_ids: [budgetId, ...previousData.budget_ids.filter(id => id !== budgetId)],
        })
      }

      return { previousData }
    },
    onError: (_err, { userId }, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.user(userId), context.previousData)
      }
    },
    onSettled: (_data, _error, { userId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user(userId) })
    },
  })

  /**
   * Check if a budget invite exists (returns invite info or null)
   * This is a query disguised as a mutation for simplicity
   */
  const checkInvite = useMutation({
    mutationFn: async ({ budgetId, userId, userBudgetIds }: CheckInviteParams): Promise<BudgetInvite | null> => {
      const budgetDocRef = doc(db, 'budgets', budgetId)
      const budgetDoc = await getDoc(budgetDocRef)

      if (!budgetDoc.exists()) return null

      const data = budgetDoc.data()
      if (!data.user_ids?.includes(userId)) return null
      if (userBudgetIds.includes(budgetId)) return null

      return {
        budgetId: budgetDoc.id,
        budgetName: data.name,
        ownerEmail: data.owner_email || null,
      }
    },
  })

  return {
    createBudget,
    acceptInvite,
    inviteUser,
    revokeUser,
    switchBudget,
    checkInvite,
  }
}

