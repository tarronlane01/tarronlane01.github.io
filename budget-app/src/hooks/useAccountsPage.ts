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

  // Organize accounts by group (excluding hidden)
  const accountsByGroup = useMemo(() => {
    return Object.entries(accounts)
      .filter(([, account]) => !account.is_hidden) // Exclude hidden accounts from normal view
      .reduce((acc, [accId, account]) => {
        const groupId = account.account_group_id || UNGROUPED_ACCOUNT_GROUP_ID
        if (!acc[groupId]) acc[groupId] = []
        acc[groupId].push({ ...account, id: accId })
        return acc
      }, {} as Record<string, AccountWithId[]>)
  }, [accounts])

  // Hidden accounts list
  const hiddenAccounts = useMemo(() => {
    return Object.entries(accounts)
      .filter(([, account]) => account.is_hidden)
      .map(([accId, account]) => ({ ...account, id: accId }))
      .sort((a, b) => a.sort_order - b.sort_order)
  }, [accounts])

  // Sort groups by sort_order
  const sortedGroups: GroupWithId[] = useMemo(() => {
    return Object.entries(accountGroups)
      .sort(([, a], [, b]) => a.sort_order - b.sort_order)
      .map(([gId, group]) => ({ ...group, id: gId }))
  }, [accountGroups])

  // Account handlers
  const handleCreateAccount = useCallback((formData: AccountFormData, forGroupId: string | null) => {
    if (!currentBudget) return

    // Use ungrouped group ID if null is passed
    const effectiveGroupId = forGroupId || UNGROUPED_ACCOUNT_GROUP_ID
    const groupAccounts = Object.values(accounts).filter(a =>
      a.account_group_id === effectiveGroupId
    )
    const maxSortOrder = groupAccounts.length > 0 ? Math.max(...groupAccounts.map(a => a.sort_order)) : -1

    const newAccountId = `account_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newAccount: FinancialAccount = {
      nickname: formData.nickname, description: '', balance: 0,
      account_group_id: effectiveGroupId,
      sort_order: maxSortOrder + 1,
      is_income_account: formData.is_income_account ?? false,
      is_income_default: formData.is_income_default ?? false,
      is_outgo_account: formData.is_outgo_account ?? false,
      is_outgo_default: formData.is_outgo_default ?? false,
      on_budget: formData.on_budget !== false,
      is_active: formData.is_active !== false,
      is_hidden: formData.is_hidden ?? false,
    }

    const newAccounts: AccountsMap = { ...accounts }
    if (formData.is_income_default) {
      Object.keys(newAccounts).forEach(accId => { newAccounts[accId] = { ...newAccounts[accId], is_income_default: false } })
    }
    if (formData.is_outgo_default) {
      Object.keys(newAccounts).forEach(accId => { newAccounts[accId] = { ...newAccounts[accId], is_outgo_default: false } })
    }
    newAccounts[newAccountId] = newAccount

    setAccountsOptimistic(newAccounts)
    saveAccounts(newAccounts).catch(err => setError(err instanceof Error ? err.message : 'Failed to create account.'))
  }, [currentBudget, accounts, setAccountsOptimistic, saveAccounts])

  const handleUpdateAccount = useCallback((accountId: string, formData: AccountFormData) => {
    if (!currentBudget) return
    const account = accounts[accountId]
    if (!account) return

    const oldGroupId = account.account_group_id || UNGROUPED_ACCOUNT_GROUP_ID
    // Use ungrouped group ID if null is passed
    const newGroupId = formData.account_group_id || UNGROUPED_ACCOUNT_GROUP_ID
    let newSortOrder = account.sort_order
    if (oldGroupId !== newGroupId) {
      const targetGroupAccounts = Object.values(accounts).filter(a => a.account_group_id === newGroupId)
      newSortOrder = targetGroupAccounts.length > 0 ? Math.max(...targetGroupAccounts.map(a => a.sort_order)) + 1 : 0
    }

    const newAccounts: AccountsMap = {}
    Object.entries(accounts).forEach(([accId, acc]) => {
      if (accId === accountId) {
        newAccounts[accId] = { ...acc, nickname: formData.nickname, account_group_id: newGroupId, sort_order: newSortOrder,
          is_income_account: formData.is_income_account ?? false, is_income_default: formData.is_income_default ?? false,
          is_outgo_account: formData.is_outgo_account ?? false, is_outgo_default: formData.is_outgo_default ?? false,
          on_budget: formData.on_budget !== false, is_active: formData.is_active !== false,
          is_hidden: formData.is_hidden ?? false }
      } else {
        newAccounts[accId] = { ...acc }
        if (formData.is_income_default && !account.is_income_default) newAccounts[accId].is_income_default = false
        if (formData.is_outgo_default && !account.is_outgo_default) newAccounts[accId].is_outgo_default = false
      }
    })

    setAccountsOptimistic(newAccounts)
    saveAccounts(newAccounts).catch(err => setError(err instanceof Error ? err.message : 'Failed to save account.'))
  }, [currentBudget, accounts, setAccountsOptimistic, saveAccounts])

  const handleDeleteAccount = useCallback((accountId: string) => {
    if (!confirm('Are you sure you want to delete this account?')) return
    if (!currentBudget || !selectedBudgetId) return
    deleteAccount.mutateAsync({ budgetId: selectedBudgetId, accountId }).catch(err =>
      setError(err instanceof Error ? err.message : 'Failed to delete account.')
    )
  }, [currentBudget, selectedBudgetId, deleteAccount])

  const handleMoveAccount = useCallback(async (accountId: string, direction: 'up' | 'down') => {
    const account = accounts[accountId]
    if (!account) return
    const groupId = account.account_group_id || UNGROUPED_ACCOUNT_GROUP_ID
    const groupAccountEntries = Object.entries(accounts).filter(([, a]) => a.account_group_id === groupId).sort(([, a], [, b]) => a.sort_order - b.sort_order)
    const currentIndex = groupAccountEntries.findIndex(([accId]) => accId === accountId)
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= groupAccountEntries.length) return

    const [targetAccId, targetAccount] = groupAccountEntries[targetIndex]
    const newAccounts: AccountsMap = {}
    Object.entries(accounts).forEach(([accId, a]) => {
      if (accId === accountId) newAccounts[accId] = { ...a, sort_order: targetAccount.sort_order }
      else if (accId === targetAccId) newAccounts[accId] = { ...a, sort_order: account.sort_order }
      else newAccounts[accId] = { ...a }
    })
    setAccountsOptimistic(newAccounts)
    if (!currentBudget) return
    try { await saveAccounts(newAccounts) }
    catch (err) { setAccountsOptimistic(accounts); setError(err instanceof Error ? err.message : 'Failed to move account') }
  }, [currentBudget, accounts, setAccountsOptimistic, saveAccounts])

  // Group handlers
  const handleCreateGroup = useCallback((formData: GroupFormData) => {
    if (!currentBudget) return
    const sortOrders = Object.values(accountGroups).map(g => g.sort_order)
    const maxSortOrder = sortOrders.length > 0 ? Math.max(...sortOrders) : -1
    const newGroupId = `account_group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newGroup: AccountGroup = { name: formData.name, sort_order: maxSortOrder + 1, expected_balance: formData.expected_balance, on_budget: formData.on_budget ?? null, is_active: formData.is_active ?? null }
    const newGroups: AccountGroupsMap = { ...accountGroups, [newGroupId]: newGroup }
    setAccountGroupsOptimistic(newGroups)
    saveAccountGroups(newGroups).catch(err => setError(err instanceof Error ? err.message : 'Failed to create account type.'))
  }, [currentBudget, accountGroups, setAccountGroupsOptimistic, saveAccountGroups])

  const handleUpdateGroup = useCallback((groupId: string, formData: GroupFormData) => {
    if (!currentBudget) return
    const newGroups: AccountGroupsMap = { ...accountGroups, [groupId]: { ...accountGroups[groupId], name: formData.name, expected_balance: formData.expected_balance, on_budget: formData.on_budget ?? null, is_active: formData.is_active ?? null } }
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
    accounts, accountGroups, accountsByGroup, hiddenAccounts, sortedGroups, currentBudget, error, setError,
    handleCreateAccount, handleUpdateAccount, handleDeleteAccount, handleMoveAccount,
    handleCreateGroup, handleUpdateGroup, handleDeleteGroup, handleMoveGroup,
    reorderAccountsInGroup, reorderGroups,
  }
}
