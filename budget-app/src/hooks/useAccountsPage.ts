import { useState, useCallback, useMemo } from 'react'
import { useBudget } from '@contexts'
import { useUpdateAccounts, useUpdateAccountGroups, useDeleteAccount, useDeleteAccountGroup } from '@data/mutations/budget'
import { useBudgetData } from './useBudgetData'
import type { FinancialAccount, AccountsMap, AccountGroup, AccountGroupsMap } from '@types'
import type { AccountFormData, GroupWithId } from '../components/budget/Accounts/AccountForm'
import type { GroupFormData } from '../components/budget/Accounts/GroupForm'
import { useAccountReorder } from './useAccountReorder'
import { UNGROUPED_ACCOUNT_GROUP_ID } from '@constants'

// Re-export types for convenience
export type { AccountFormData, GroupFormData, GroupWithId }

export interface AccountWithId extends FinancialAccount {
  id: string
}

/** Assign sequential sort_order (0, 1, 2, ...) to visible accounts, then offset hidden accounts after them. */
function reindexAccounts(orderedVisible: AccountWithId[], allAccounts: AccountsMap): AccountsMap {
  const newAccounts: AccountsMap = {}
  const visibleIds = new Set(orderedVisible.map(a => a.id))
  orderedVisible.forEach((acc, idx) => {
    newAccounts[acc.id] = { ...allAccounts[acc.id], sort_order: idx }
  })
  let hiddenIdx = orderedVisible.length
  Object.entries(allAccounts).forEach(([id, acc]) => {
    if (!visibleIds.has(id)) {
      newAccounts[id] = { ...acc, sort_order: hiddenIdx++ }
    }
  })
  return newAccounts
}

export function useAccountsPage() {
  const { selectedBudgetId } = useBudget()

  const {
    budget: currentBudget,
    accounts,
    accountGroups,
    setAccountsOptimistic,
    setAccountGroupsOptimistic,
  } = useBudgetData()

  // Mutations - imported directly
  const { updateAccounts } = useUpdateAccounts()
  const { updateAccountGroups } = useUpdateAccountGroups()
  const { deleteAccount } = useDeleteAccount()
  const { deleteAccountGroup } = useDeleteAccountGroup()

  const [error, setError] = useState<string | null>(null)

  // Helper functions to wrap mutations with budgetId check
  const saveAccounts = useCallback(async (newAccounts: AccountsMap) => {
    if (!selectedBudgetId) throw new Error('No budget selected')
    await updateAccounts.mutateAsync({ budgetId: selectedBudgetId, accounts: newAccounts })
  }, [selectedBudgetId, updateAccounts])

  const saveAccountGroups = useCallback(async (newGroups: AccountGroupsMap) => {
    if (!selectedBudgetId) throw new Error('No budget selected')
    await updateAccountGroups.mutateAsync({ budgetId: selectedBudgetId, accountGroups: newGroups })
  }, [selectedBudgetId, updateAccountGroups])

  // Organize accounts by group (excluding deleted)
  const accountsByGroup = useMemo(() => {
    return Object.entries(accounts)
      .filter(([, account]) => !account.is_deleted)
      .reduce((acc, [accId, account]) => {
        const groupId = account.account_group_id || UNGROUPED_ACCOUNT_GROUP_ID
        if (!acc[groupId]) acc[groupId] = []
        acc[groupId].push({ ...account, id: accId })
        return acc
      }, {} as Record<string, AccountWithId[]>)
  }, [accounts])

  // Flat sorted list of all non-deleted accounts (global sort_order, group.sort_order tiebreaker)
  const sortedFlatAccounts: AccountWithId[] = useMemo(() => {
    return Object.entries(accounts)
      .filter(([, account]) => !account.is_deleted)
      .map(([accId, account]) => ({ ...account, id: accId }))
      .sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
        const gA = accountGroups[a.account_group_id]?.sort_order ?? 0
        const gB = accountGroups[b.account_group_id]?.sort_order ?? 0
        return gA - gB
      })
  }, [accounts, accountGroups])

  // Sort groups by sort_order
  const sortedGroups: GroupWithId[] = useMemo(() => {
    return Object.entries(accountGroups)
      .sort(([, a], [, b]) => a.sort_order - b.sort_order)
      .map(([gId, group]) => ({ ...group, id: gId }))
  }, [accountGroups])

  // Account handlers
  const handleCreateAccount = useCallback((formData: AccountFormData, forGroupId: string | null) => {
    if (!currentBudget) return

    const effectiveGroupId = forGroupId || UNGROUPED_ACCOUNT_GROUP_ID
    const newAccountId = `account_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newAccount: FinancialAccount = {
      nickname: formData.nickname, description: '', balance: 0,
      account_group_id: effectiveGroupId,
      sort_order: 0, // placeholder — reindexAccounts will assign the real value
      is_income_account: formData.is_income_account ?? false,
      is_income_default: formData.is_income_default ?? false,
      is_outgo_account: formData.is_outgo_account ?? false,
      is_outgo_default: formData.is_outgo_default ?? false,
      on_budget: formData.on_budget !== false,
    }

    // Insert new account after the last account of its group in the flat sorted list
    const newAccountWithId: AccountWithId = { ...newAccount, id: newAccountId }
    const ordered = [...sortedFlatAccounts]
    const lastInGroupIdx = ordered.map(a => a.account_group_id).lastIndexOf(effectiveGroupId)
    if (lastInGroupIdx >= 0) {
      ordered.splice(lastInGroupIdx + 1, 0, newAccountWithId)
    } else {
      // Group has no visible accounts yet — insert after the preceding group's last account
      const groupOrder = sortedGroups.map(g => g.id)
      const groupIdx = groupOrder.indexOf(effectiveGroupId)
      let insertIdx = ordered.length // default: end
      for (let gi = groupIdx - 1; gi >= 0; gi--) {
        const lastOfPrev = ordered.map(a => a.account_group_id).lastIndexOf(groupOrder[gi])
        if (lastOfPrev >= 0) { insertIdx = lastOfPrev + 1; break }
      }
      if (groupIdx === 0) insertIdx = 0
      ordered.splice(insertIdx, 0, newAccountWithId)
    }

    const allWithNew: AccountsMap = { ...accounts }
    if (formData.is_income_default) {
      Object.keys(allWithNew).forEach(accId => { allWithNew[accId] = { ...allWithNew[accId], is_income_default: false } })
    }
    if (formData.is_outgo_default) {
      Object.keys(allWithNew).forEach(accId => { allWithNew[accId] = { ...allWithNew[accId], is_outgo_default: false } })
    }
    allWithNew[newAccountId] = newAccount

    const newAccounts = reindexAccounts(ordered, allWithNew)
    setAccountsOptimistic(newAccounts)
    saveAccounts(newAccounts).catch(err => setError(err instanceof Error ? err.message : 'Failed to create account.'))
  }, [currentBudget, accounts, sortedFlatAccounts, sortedGroups, setAccountsOptimistic, saveAccounts])

  const handleUpdateAccount = useCallback((accountId: string, formData: AccountFormData) => {
    if (!currentBudget) return
    const account = accounts[accountId]
    if (!account) return

    const oldGroupId = account.account_group_id || UNGROUPED_ACCOUNT_GROUP_ID
    const newGroupId = formData.account_group_id || UNGROUPED_ACCOUNT_GROUP_ID
    const changingGroup = oldGroupId !== newGroupId

    // Build the updated account fields (sort_order is a placeholder — reindex will fix it)
    const updatedFields: Partial<FinancialAccount> = {
      nickname: formData.nickname, account_group_id: newGroupId,
      is_income_account: formData.is_income_account ?? false, is_income_default: formData.is_income_default ?? false,
      is_outgo_account: formData.is_outgo_account ?? false, is_outgo_default: formData.is_outgo_default ?? false,
      on_budget: formData.on_budget !== false,
    }

    // If changing groups, move the account to the end of its new group in the flat list
    let ordered = [...sortedFlatAccounts]
    if (changingGroup) {
      ordered = ordered.filter(a => a.id !== accountId)
      const movedAccount: AccountWithId = { ...account, ...updatedFields, id: accountId } as AccountWithId
      const lastInNewGroup = ordered.map(a => a.account_group_id).lastIndexOf(newGroupId)
      if (lastInNewGroup >= 0) {
        ordered.splice(lastInNewGroup + 1, 0, movedAccount)
      } else {
        const groupOrder = sortedGroups.map(g => g.id)
        const groupIdx = groupOrder.indexOf(newGroupId)
        let insertIdx = ordered.length
        for (let gi = groupIdx - 1; gi >= 0; gi--) {
          const lastOfPrev = ordered.map(a => a.account_group_id).lastIndexOf(groupOrder[gi])
          if (lastOfPrev >= 0) { insertIdx = lastOfPrev + 1; break }
        }
        if (groupIdx === 0) insertIdx = 0
        ordered.splice(insertIdx, 0, movedAccount)
      }
    }

    // Build base accounts map with updated fields and default clearing
    const baseAccounts: AccountsMap = {}
    Object.entries(accounts).forEach(([accId, acc]) => {
      if (accId === accountId) {
        baseAccounts[accId] = { ...acc, ...updatedFields }
      } else {
        baseAccounts[accId] = { ...acc }
        if (formData.is_income_default && !account.is_income_default) baseAccounts[accId].is_income_default = false
        if (formData.is_outgo_default && !account.is_outgo_default) baseAccounts[accId].is_outgo_default = false
      }
    })

    const newAccounts = reindexAccounts(ordered, baseAccounts)
    setAccountsOptimistic(newAccounts)
    saveAccounts(newAccounts).catch(err => setError(err instanceof Error ? err.message : 'Failed to save account.'))
  }, [currentBudget, accounts, sortedFlatAccounts, sortedGroups, setAccountsOptimistic, saveAccounts])

  const handleDeleteAccount = useCallback((accountId: string) => {
    if (!confirm('Are you sure you want to delete this account?')) return
    if (!currentBudget || !selectedBudgetId) return
    deleteAccount.mutateAsync({ budgetId: selectedBudgetId, accountId }).catch(err =>
      setError(err instanceof Error ? err.message : 'Failed to delete account.')
    )
  }, [currentBudget, selectedBudgetId, deleteAccount])

  const handleSwapAccounts = useCallback(async (idA: string, idB: string) => {
    const indexA = sortedFlatAccounts.findIndex(a => a.id === idA)
    const indexB = sortedFlatAccounts.findIndex(a => a.id === idB)
    if (indexA < 0 || indexB < 0) return
    const ordered = [...sortedFlatAccounts]
    ;[ordered[indexA], ordered[indexB]] = [ordered[indexB], ordered[indexA]]
    const newAccounts = reindexAccounts(ordered, accounts)
    setAccountsOptimistic(newAccounts)
    if (!currentBudget) return
    try { await saveAccounts(newAccounts) }
    catch (err) { setAccountsOptimistic(accounts); setError(err instanceof Error ? err.message : 'Failed to move account') }
  }, [currentBudget, accounts, sortedFlatAccounts, setAccountsOptimistic, saveAccounts])

  const handleMoveAccount = useCallback(async (accountId: string, direction: 'up' | 'down') => {
    const currentIndex = sortedFlatAccounts.findIndex(a => a.id === accountId)
    if (currentIndex < 0) return
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= sortedFlatAccounts.length) return

    // Splice + re-index (same pattern as handleMoveGroup)
    const ordered = [...sortedFlatAccounts]
    const [moved] = ordered.splice(currentIndex, 1)
    ordered.splice(targetIndex, 0, moved)

    const newAccounts = reindexAccounts(ordered, accounts)
    setAccountsOptimistic(newAccounts)
    if (!currentBudget) return
    try { await saveAccounts(newAccounts) }
    catch (err) { setAccountsOptimistic(accounts); setError(err instanceof Error ? err.message : 'Failed to move account') }
  }, [currentBudget, accounts, sortedFlatAccounts, setAccountsOptimistic, saveAccounts])

  // Group handlers
  const handleCreateGroup = useCallback((formData: GroupFormData) => {
    if (!currentBudget) return
    const sortOrders = Object.values(accountGroups).map(g => g.sort_order)
    const maxSortOrder = sortOrders.length > 0 ? Math.max(...sortOrders) : -1
    const newGroupId = `account_group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newGroup: AccountGroup = { name: formData.name, sort_order: maxSortOrder + 1, expected_balance: formData.expected_balance, on_budget: formData.on_budget ?? null, badge_color: formData.badge_color ?? 'grey' }
    const newGroups: AccountGroupsMap = { ...accountGroups, [newGroupId]: newGroup }
    setAccountGroupsOptimistic(newGroups)
    saveAccountGroups(newGroups).catch(err => setError(err instanceof Error ? err.message : 'Failed to create account type.'))
  }, [currentBudget, accountGroups, setAccountGroupsOptimistic, saveAccountGroups])

  const handleUpdateGroup = useCallback((groupId: string, formData: GroupFormData) => {
    if (!currentBudget) return
    const newGroups: AccountGroupsMap = { ...accountGroups, [groupId]: { ...accountGroups[groupId], name: formData.name, expected_balance: formData.expected_balance, on_budget: formData.on_budget ?? null, badge_color: formData.badge_color ?? accountGroups[groupId]?.badge_color ?? 'grey' } }
    setAccountGroupsOptimistic(newGroups)
    saveAccountGroups(newGroups).catch(err => setError(err instanceof Error ? err.message : 'Failed to update account type.'))
  }, [currentBudget, accountGroups, setAccountGroupsOptimistic, saveAccountGroups])

  const handleDeleteGroup = useCallback((groupId: string) => {
    if (groupId === UNGROUPED_ACCOUNT_GROUP_ID) {
      alert('Cannot delete the default Ungrouped account type.')
      return
    }
    if (!confirm('Are you sure you want to delete this account type? Accounts in this type will move to Ungrouped.')) return
    if (!currentBudget || !selectedBudgetId) return
    const accountIdsToUngroup = Object.entries(accounts)
      .filter(([, account]) => (account.account_group_id || UNGROUPED_ACCOUNT_GROUP_ID) === groupId)
      .map(([accId]) => accId)
    deleteAccountGroup
      .mutateAsync({ budgetId: selectedBudgetId, groupId, accountIdsToUngroup })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to delete account type.'))
  }, [currentBudget, selectedBudgetId, accounts, deleteAccountGroup])

  const handleMoveGroup = useCallback(async (groupId: string, direction: 'up' | 'down') => {
    const sortedGroupEntries = Object.entries(accountGroups).sort(([, a], [, b]) => a.sort_order - b.sort_order)
    const currentIndex = sortedGroupEntries.findIndex(([gId]) => gId === groupId)
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= sortedGroupEntries.length) return

    const [movedEntry] = sortedGroupEntries.splice(currentIndex, 1)
    sortedGroupEntries.splice(targetIndex, 0, movedEntry)
    const updatedGroups: AccountGroupsMap = {}
    sortedGroupEntries.forEach(([gId, group], index) => { updatedGroups[gId] = { ...group, sort_order: index } })
    setAccountGroupsOptimistic(updatedGroups)
    if (!currentBudget) return
    try { await saveAccountGroups(updatedGroups) }
    catch (err) { setAccountGroupsOptimistic(accountGroups); setError(err instanceof Error ? err.message : 'Failed to move account type') }
  }, [currentBudget, accountGroups, setAccountGroupsOptimistic, saveAccountGroups])

  const { reorderAccountsInGroup, reorderGroups } = useAccountReorder({
    currentBudget, accounts, accountGroups, setAccountsOptimistic, setAccountGroupsOptimistic, saveAccounts, saveAccountGroups, setError,
  })

  return {
    accounts, accountGroups, accountsByGroup, sortedFlatAccounts, sortedGroups, currentBudget, error, setError,
    handleCreateAccount, handleUpdateAccount, handleDeleteAccount, handleMoveAccount, handleSwapAccounts,
    handleCreateGroup, handleUpdateGroup, handleDeleteGroup, handleMoveGroup,
    reorderAccountsInGroup, reorderGroups,
  }
}
