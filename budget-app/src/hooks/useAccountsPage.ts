import { useState, useCallback, useMemo } from 'react'
import { useBudget } from '../contexts/budget_context'
import { useBudgetData } from './useBudgetData'
import type { FinancialAccount, AccountsMap, AccountGroup, AccountGroupsMap } from '@types'
import type { AccountFormData, GroupWithId } from '../components/budget/Accounts/AccountForm'
import type { GroupFormData } from '../components/budget/Accounts/GroupForm'

// Re-export types for convenience
export type { AccountFormData, GroupFormData, GroupWithId }

export interface AccountWithId extends FinancialAccount {
  id: string
}

export function useAccountsPage() {
  const { selectedBudgetId, currentUserId } = useBudget()
  const {
    budget: currentBudget,
    accounts,
    accountGroups,
    saveAccounts,
    saveAccountGroups,
    saveAccountsAndGroups,
    setAccountsOptimistic,
    setAccountGroupsOptimistic,
  } = useBudgetData(selectedBudgetId, currentUserId)

  const [error, setError] = useState<string | null>(null)

  // Organize accounts by group
  const accountsByGroup = useMemo(() => {
    return Object.entries(accounts).reduce((acc, [accId, account]) => {
      const groupId = account.account_group_id || 'ungrouped'
      if (!acc[groupId]) acc[groupId] = []
      acc[groupId].push({ ...account, id: accId })
      return acc
    }, {} as Record<string, AccountWithId[]>)
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

    const groupAccounts = Object.values(accounts).filter(a =>
      (forGroupId === 'ungrouped' ? !a.account_group_id : a.account_group_id === forGroupId)
    )
    const maxSortOrder = groupAccounts.length > 0
      ? Math.max(...groupAccounts.map(a => a.sort_order))
      : -1

    const newAccountId = `account_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newAccount: FinancialAccount = {
      nickname: formData.nickname,
      description: '',
      balance: 0,
      account_group_id: forGroupId === 'ungrouped' ? null : forGroupId,
      sort_order: maxSortOrder + 1,
      is_income_account: formData.is_income_account ?? false,
      is_income_default: formData.is_income_default ?? false,
      is_outgo_account: formData.is_outgo_account ?? false,
      is_outgo_default: formData.is_outgo_default ?? false,
      on_budget: formData.on_budget !== false,
      is_active: formData.is_active !== false,
    }

    const newAccounts: AccountsMap = { ...accounts }
    if (formData.is_income_default) {
      Object.keys(newAccounts).forEach(accId => {
        newAccounts[accId] = { ...newAccounts[accId], is_income_default: false }
      })
    }
    if (formData.is_outgo_default) {
      Object.keys(newAccounts).forEach(accId => {
        newAccounts[accId] = { ...newAccounts[accId], is_outgo_default: false }
      })
    }
    newAccounts[newAccountId] = newAccount

    setAccountsOptimistic(newAccounts)

    saveAccounts(newAccounts).catch(err => {
      console.error('[useAccountHandlers] Error creating account:', err)
      setError(err instanceof Error ? err.message : 'Failed to create account.')
    })
  }, [currentBudget, accounts, setAccountsOptimistic, saveAccounts])

  const handleUpdateAccount = useCallback((accountId: string, formData: AccountFormData) => {
    if (!currentBudget) return

    const account = accounts[accountId]
    if (!account) return

    const oldGroupId = account.account_group_id || 'ungrouped'
    const newGroupId = formData.account_group_id

    let newSortOrder = account.sort_order
    if (oldGroupId !== (newGroupId || 'ungrouped')) {
      const targetGroupAccounts = Object.values(accounts).filter(a => {
        const accGroupId = a.account_group_id || 'ungrouped'
        return accGroupId === (newGroupId || 'ungrouped')
      })
      newSortOrder = targetGroupAccounts.length > 0
        ? Math.max(...targetGroupAccounts.map(a => a.sort_order)) + 1
        : 0
    }

    const newAccounts: AccountsMap = {}
    Object.entries(accounts).forEach(([accId, acc]) => {
      if (accId === accountId) {
        newAccounts[accId] = {
          ...acc,
          nickname: formData.nickname,
          account_group_id: newGroupId,
          sort_order: newSortOrder,
          is_income_account: formData.is_income_account ?? false,
          is_income_default: formData.is_income_default ?? false,
          is_outgo_account: formData.is_outgo_account ?? false,
          is_outgo_default: formData.is_outgo_default ?? false,
          on_budget: formData.on_budget !== false,
          is_active: formData.is_active !== false,
        }
      } else {
        newAccounts[accId] = { ...acc }
        if (formData.is_income_default && !account.is_income_default) {
          newAccounts[accId].is_income_default = false
        }
        if (formData.is_outgo_default && !account.is_outgo_default) {
          newAccounts[accId].is_outgo_default = false
        }
      }
    })

    setAccountsOptimistic(newAccounts)

    saveAccounts(newAccounts).catch(err => {
      console.error('[useAccountHandlers] Error saving account:', err)
      setError(err instanceof Error ? err.message : 'Failed to save account.')
    })
  }, [currentBudget, accounts, setAccountsOptimistic, saveAccounts])

  const handleDeleteAccount = useCallback((accountId: string) => {
    if (!confirm('Are you sure you want to delete this account?')) return
    if (!currentBudget) return

    const { [accountId]: _removed, ...newAccounts } = accounts
    void _removed // Intentionally unused - destructuring to exclude from object
    setAccountsOptimistic(newAccounts)

    saveAccounts(newAccounts).catch(err => {
      console.error('[useAccountHandlers] Error deleting account:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete account.')
    })
  }, [currentBudget, accounts, setAccountsOptimistic, saveAccounts])

  const handleMoveAccount = useCallback(async (accountId: string, direction: 'up' | 'down') => {
    const account = accounts[accountId]
    if (!account) return

    const groupId = account.account_group_id || 'ungrouped'
    const groupAccountEntries = Object.entries(accounts)
      .filter(([, a]) => (a.account_group_id || 'ungrouped') === groupId)
      .sort(([, a], [, b]) => a.sort_order - b.sort_order)

    const currentIndex = groupAccountEntries.findIndex(([accId]) => accId === accountId)
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1

    if (targetIndex < 0 || targetIndex >= groupAccountEntries.length) return

    const [targetAccId, targetAccount] = groupAccountEntries[targetIndex]
    const newAccounts: AccountsMap = {}
    Object.entries(accounts).forEach(([accId, a]) => {
      if (accId === accountId) {
        newAccounts[accId] = { ...a, sort_order: targetAccount.sort_order }
      } else if (accId === targetAccId) {
        newAccounts[accId] = { ...a, sort_order: account.sort_order }
      } else {
        newAccounts[accId] = { ...a }
      }
    })

    setAccountsOptimistic(newAccounts)

    if (!currentBudget) return
    try {
      await saveAccounts(newAccounts)
    } catch (err) {
      setAccountsOptimistic(accounts)
      setError(err instanceof Error ? err.message : 'Failed to move account')
    }
  }, [currentBudget, accounts, setAccountsOptimistic, saveAccounts])

  // Group handlers
  const handleCreateGroup = useCallback((formData: GroupFormData) => {
    if (!currentBudget) return

    const sortOrders = Object.values(accountGroups).map(g => g.sort_order)
    const maxSortOrder = sortOrders.length > 0 ? Math.max(...sortOrders) : -1

    const newGroupId = `account_group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newGroup: AccountGroup = {
      name: formData.name,
      sort_order: maxSortOrder + 1,
      expected_balance: formData.expected_balance,
      on_budget: formData.on_budget,
      is_active: formData.is_active,
    }

    const newGroups: AccountGroupsMap = { ...accountGroups, [newGroupId]: newGroup }
    setAccountGroupsOptimistic(newGroups)

    saveAccountGroups(newGroups).catch(err => {
      console.error('[useAccountHandlers] Error creating group:', err)
      setError(err instanceof Error ? err.message : 'Failed to create account type.')
    })
  }, [currentBudget, accountGroups, setAccountGroupsOptimistic, saveAccountGroups])

  const handleUpdateGroup = useCallback((groupId: string, formData: GroupFormData) => {
    if (!currentBudget) return

    const newGroups: AccountGroupsMap = {
      ...accountGroups,
      [groupId]: {
        ...accountGroups[groupId],
        name: formData.name,
        expected_balance: formData.expected_balance,
        on_budget: formData.on_budget,
        is_active: formData.is_active,
      },
    }

    setAccountGroupsOptimistic(newGroups)

    saveAccountGroups(newGroups).catch(err => {
      console.error('[useAccountHandlers] Error updating group:', err)
      setError(err instanceof Error ? err.message : 'Failed to update account type.')
    })
  }, [currentBudget, accountGroups, setAccountGroupsOptimistic, saveAccountGroups])

  const handleDeleteGroup = useCallback((groupId: string) => {
    if (!confirm('Are you sure you want to delete this account type? Accounts in this type will move to Ungrouped.')) return
    if (!currentBudget) return

    const newAccounts: AccountsMap = {}
    Object.entries(accounts).forEach(([accId, account]) => {
      newAccounts[accId] = account.account_group_id === groupId
        ? { ...account, account_group_id: null }
        : account
    })
    const { [groupId]: _removedGroup, ...newGroups } = accountGroups
    void _removedGroup // Intentionally unused - destructuring to exclude from object

    setAccountsOptimistic(newAccounts)
    setAccountGroupsOptimistic(newGroups)

    saveAccountsAndGroups(newAccounts, newGroups).catch(err => {
      console.error('[useAccountHandlers] Error deleting group:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete account type.')
    })
  }, [currentBudget, accounts, accountGroups, setAccountsOptimistic, setAccountGroupsOptimistic, saveAccountsAndGroups])

  const handleMoveGroup = useCallback(async (groupId: string, direction: 'up' | 'down') => {
    const sortedGroupEntries = Object.entries(accountGroups)
      .sort(([, a], [, b]) => a.sort_order - b.sort_order)
    const currentIndex = sortedGroupEntries.findIndex(([gId]) => gId === groupId)
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1

    if (targetIndex < 0 || targetIndex >= sortedGroupEntries.length) return

    const [movedEntry] = sortedGroupEntries.splice(currentIndex, 1)
    sortedGroupEntries.splice(targetIndex, 0, movedEntry)

    const updatedGroups: AccountGroupsMap = {}
    sortedGroupEntries.forEach(([gId, group], index) => {
      updatedGroups[gId] = { ...group, sort_order: index }
    })

    setAccountGroupsOptimistic(updatedGroups)

    if (!currentBudget) return
    try {
      await saveAccountGroups(updatedGroups)
    } catch (err) {
      setAccountGroupsOptimistic(accountGroups)
      setError(err instanceof Error ? err.message : 'Failed to move account type')
    }
  }, [currentBudget, accountGroups, setAccountGroupsOptimistic, saveAccountGroups])

  // Reorder helpers
  const reorderAccountsInGroup = useCallback(async (
    draggedId: string,
    targetId: string,
    targetGroupId: string
  ) => {
    const draggedAccount = accounts[draggedId]
    if (!draggedAccount) return

    const newGroupId = targetGroupId === 'ungrouped' ? null : targetGroupId
    const targetGroupAccounts = Object.entries(accounts).filter(([, a]) => {
      const accGroupId = a.account_group_id || 'ungrouped'
      return accGroupId === targetGroupId
    })

    const newAccounts: AccountsMap = {}
    Object.entries(accounts).forEach(([accId, a]) => {
      if (accId !== draggedId) {
        newAccounts[accId] = { ...a }
      }
    })

    let newSortOrder: number

    if (targetId === '__group_end__' || targetGroupAccounts.length === 0 || !targetGroupAccounts.find(([accId]) => accId === targetId)) {
      const maxInGroup = targetGroupAccounts.length > 0
        ? Math.max(...targetGroupAccounts.filter(([accId]) => accId !== draggedId).map(([, a]) => a.sort_order))
        : -1
      newSortOrder = maxInGroup + 1
    } else {
      const targetEntry = targetGroupAccounts.find(([accId]) => accId === targetId)
      if (targetEntry) {
        const [, targetAccount] = targetEntry
        newSortOrder = targetAccount.sort_order
        Object.entries(newAccounts).forEach(([accId, a]) => {
          const accGroupId = a.account_group_id || 'ungrouped'
          if (accGroupId === targetGroupId && a.sort_order >= newSortOrder) {
            newAccounts[accId] = { ...a, sort_order: a.sort_order + 1 }
          }
        })
      } else {
        newSortOrder = 0
      }
    }

    newAccounts[draggedId] = {
      ...draggedAccount,
      account_group_id: newGroupId,
      sort_order: newSortOrder,
    }

    setAccountsOptimistic(newAccounts)

    if (!currentBudget) return
    try {
      await saveAccounts(newAccounts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes')
    }
  }, [currentBudget, accounts, setAccountsOptimistic, saveAccounts])

  const reorderGroups = useCallback(async (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return

    const sortedGroupEntries = Object.entries(accountGroups)
      .sort(([, a], [, b]) => a.sort_order - b.sort_order)
    const draggedIndex = sortedGroupEntries.findIndex(([gId]) => gId === draggedId)
    const newGroupEntries = [...sortedGroupEntries]
    const [draggedItem] = newGroupEntries.splice(draggedIndex, 1)

    if (targetId === '__end__') {
      newGroupEntries.push(draggedItem)
    } else {
      const targetIndex = newGroupEntries.findIndex(([gId]) => gId === targetId)
      newGroupEntries.splice(targetIndex, 0, draggedItem)
    }

    const updatedGroups: AccountGroupsMap = {}
    newGroupEntries.forEach(([gId, group], index) => {
      updatedGroups[gId] = { ...group, sort_order: index }
    })

    setAccountGroupsOptimistic(updatedGroups)

    if (!currentBudget) return
    try {
      await saveAccountGroups(updatedGroups)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save new order')
    }
  }, [currentBudget, accountGroups, setAccountGroupsOptimistic, saveAccountGroups])

  return {
    // Data
    accounts,
    accountGroups,
    accountsByGroup,
    sortedGroups,
    currentBudget,
    error,
    setError,

    // Account handlers
    handleCreateAccount,
    handleUpdateAccount,
    handleDeleteAccount,
    handleMoveAccount,

    // Group handlers
    handleCreateGroup,
    handleUpdateGroup,
    handleDeleteGroup,
    handleMoveGroup,

    // Reorder helpers (for drag-and-drop)
    reorderAccountsInGroup,
    reorderGroups,
  }
}

