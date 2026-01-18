/**
 * Account Reorder Helpers - Drag and drop reordering logic for accounts
 */

import { useCallback } from 'react'
import type { AccountsMap, AccountGroupsMap, Budget } from '@types'
import { UNGROUPED_ACCOUNT_GROUP_ID } from '@constants'

interface UseAccountReorderParams {
  currentBudget: Budget | null
  accounts: AccountsMap
  accountGroups: AccountGroupsMap
  setAccountsOptimistic: (accounts: AccountsMap) => void
  setAccountGroupsOptimistic: (groups: AccountGroupsMap) => void
  saveAccounts: (accounts: AccountsMap) => Promise<void>
  saveAccountGroups: (groups: AccountGroupsMap) => Promise<void>
  setError: (error: string | null) => void
}

export function useAccountReorder({
  currentBudget,
  accounts,
  accountGroups,
  setAccountsOptimistic,
  setAccountGroupsOptimistic,
  saveAccounts,
  saveAccountGroups,
  setError,
}: UseAccountReorderParams) {
  const reorderAccountsInGroup = useCallback(async (
    draggedId: string,
    targetId: string,
    targetGroupId: string
  ) => {
    const draggedAccount = accounts[draggedId]
    if (!draggedAccount) return

    const newGroupId = targetGroupId === 'ungrouped' ? UNGROUPED_ACCOUNT_GROUP_ID : targetGroupId
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
  }, [currentBudget, accounts, setAccountsOptimistic, saveAccounts, setError])

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
  }, [currentBudget, accountGroups, setAccountGroupsOptimistic, saveAccountGroups, setError])

  return { reorderAccountsInGroup, reorderGroups }
}

