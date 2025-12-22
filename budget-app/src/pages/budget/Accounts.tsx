import { useState, useEffect, type DragEvent } from 'react'
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore'
import app from '../../firebase'
import { useBudget, type FinancialAccount, type AccountsMap, type AccountGroup, type AccountGroupsMap, type ExpectedBalanceType } from '../../contexts/budget_context'
import {
  ErrorAlert,
  Button,
  DraggableCard,
  DropZone,
  formatCurrency,
  getBalanceColor,
} from '../../components/ui'
import {
  pageSubtitle,
  listContainer,
  itemTitle,
  sectionHeader,
  colors,
  reorderButton,
  reorderButtonGroup,
} from '../../styles/shared'
import { useIsMobile } from '../../hooks/useIsMobile'
import {
  AccountForm,
  GroupForm,
  AccountFlags,
  GroupOverrideFlags,
  AccountEndDropZone,
  type AccountFormData,
  type GroupFormData,
  type GroupWithId,
} from '../../components/budget/Accounts'

type DragType = 'account' | 'group' | null

// Helper to check if a balance is unexpected based on the group's expected_balance setting
function hasUnexpectedBalance(balance: number, expectedBalance?: ExpectedBalanceType): boolean {
  if (!expectedBalance || expectedBalance === 'any' || balance === 0) return false
  if (expectedBalance === 'positive' && balance < 0) return true
  if (expectedBalance === 'negative' && balance > 0) return true
  return false
}

// Helper to get warning message for unexpected balance
function getBalanceWarning(balance: number, expectedBalance?: ExpectedBalanceType): string | null {
  if (!expectedBalance || expectedBalance === 'any' || balance === 0) return null
  if (expectedBalance === 'positive' && balance < 0) {
    return 'Unexpected negative balance'
  }
  if (expectedBalance === 'negative' && balance > 0) {
    return 'Unexpected positive balance (credit owed to you?)'
  }
  return null
}

function Accounts() {
  const {
    currentBudget,
    accounts,
    setAccounts,
    accountGroups,
    setAccountGroups,
    checkBalanceMismatch,
    reconcileBalances,
    balanceMismatch,
  } = useBudget()
  const [error, setError] = useState<string | null>(null)
  const [isReconciling, setIsReconciling] = useState(false)
  const [isCheckingMismatch, setIsCheckingMismatch] = useState(false)
  const isMobile = useIsMobile()

  // Check for balance mismatches on load
  useEffect(() => {
    if (currentBudget && Object.keys(accounts).length > 0) {
      setIsCheckingMismatch(true)
      checkBalanceMismatch().finally(() => setIsCheckingMismatch(false))
    }
  }, [currentBudget?.id, Object.keys(accounts).length])

  // Account editing state
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null)
  const [createForGroupId, setCreateForGroupId] = useState<string | null>(null)

  // Group editing state
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [showCreateGroupForm, setShowCreateGroupForm] = useState(false)

  // Drag state
  const [dragType, setDragType] = useState<DragType>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null)

  const db = getFirestore(app)

  // Helper to clean accounts for Firestore (avoid undefined values)
  function cleanAccountsForFirestore(accts: AccountsMap): AccountsMap {
    const cleaned: AccountsMap = {}
    Object.entries(accts).forEach(([accId, acc]) => {
      cleaned[accId] = {
        nickname: acc.nickname,
        balance: acc.balance,
        account_group_id: acc.account_group_id ?? null,
        sort_order: acc.sort_order,
      }
      if (acc.is_income_account !== undefined) cleaned[accId].is_income_account = acc.is_income_account
      if (acc.is_income_default !== undefined) cleaned[accId].is_income_default = acc.is_income_default
      if (acc.is_outgo_account !== undefined) cleaned[accId].is_outgo_account = acc.is_outgo_account
      if (acc.is_outgo_default !== undefined) cleaned[accId].is_outgo_default = acc.is_outgo_default
      if (acc.on_budget !== undefined) cleaned[accId].on_budget = acc.on_budget
      if (acc.is_active !== undefined) cleaned[accId].is_active = acc.is_active
    })
    return cleaned
  }

  // Helper to clean account groups for Firestore
  function cleanAccountGroupsForFirestore(groups: AccountGroupsMap): AccountGroupsMap {
    const cleaned: AccountGroupsMap = {}
    Object.entries(groups).forEach(([groupId, group]) => {
      cleaned[groupId] = {
        name: group.name,
        sort_order: group.sort_order,
        expected_balance: group.expected_balance || 'positive',
      }
      if (group.on_budget !== undefined) cleaned[groupId].on_budget = group.on_budget
      if (group.is_active !== undefined) cleaned[groupId].is_active = group.is_active
    })
    return cleaned
  }

  // Save functions
  async function saveAccounts(newAccounts: AccountsMap) {
    if (!currentBudget) return
    try {
      const budgetDocRef = doc(db, 'budgets', currentBudget.id)
      const budgetDoc = await getDoc(budgetDocRef)
      if (budgetDoc.exists()) {
        const data = budgetDoc.data()
        await setDoc(budgetDocRef, { ...data, accounts: cleanAccountsForFirestore(newAccounts) })
      }
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to save accounts')
    }
  }

  async function saveAccountGroups(newGroups: AccountGroupsMap) {
    if (!currentBudget) return
    try {
      const budgetDocRef = doc(db, 'budgets', currentBudget.id)
      const budgetDoc = await getDoc(budgetDocRef)
      if (budgetDoc.exists()) {
        const data = budgetDoc.data()
        await setDoc(budgetDocRef, { ...data, account_groups: cleanAccountGroupsForFirestore(newGroups) })
      }
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to save account groups')
    }
  }

  async function saveBoth(newAccounts: AccountsMap, newGroups: AccountGroupsMap) {
    if (!currentBudget) return
    try {
      const budgetDocRef = doc(db, 'budgets', currentBudget.id)
      const budgetDoc = await getDoc(budgetDocRef)
      if (budgetDoc.exists()) {
        const data = budgetDoc.data()
        await setDoc(budgetDocRef, {
          ...data,
          accounts: cleanAccountsForFirestore(newAccounts),
          account_groups: cleanAccountGroupsForFirestore(newGroups),
        })
      }
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to save changes')
    }
  }

  // Account handlers
  function handleCreateAccount(formData: AccountFormData, forGroupId: string | null) {
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
      balance: 0,
      account_group_id: forGroupId === 'ungrouped' ? null : forGroupId,
      sort_order: maxSortOrder + 1,
      is_income_account: formData.is_income_account,
      is_income_default: formData.is_income_default,
      is_outgo_account: formData.is_outgo_account,
      is_outgo_default: formData.is_outgo_default,
      on_budget: formData.on_budget !== false,
      is_active: formData.is_active !== false,
    }

    // If this account is income default, remove default from other accounts
    const newAccounts: AccountsMap = { ...accounts }
    if (formData.is_income_default) {
      Object.keys(newAccounts).forEach(accId => {
        newAccounts[accId] = { ...newAccounts[accId], is_income_default: false }
      })
    }
    // If this account is outgo default, remove default from other accounts
    if (formData.is_outgo_default) {
      Object.keys(newAccounts).forEach(accId => {
        newAccounts[accId] = { ...newAccounts[accId], is_outgo_default: false }
      })
    }
    newAccounts[newAccountId] = newAccount

    // Optimistic update: update UI immediately, close form, save in background
    setAccounts(newAccounts)
    setCreateForGroupId(null)

    // Save in background
    saveAccounts(newAccounts).catch(err => {
      console.error('[Accounts] Error creating account:', err)
      setError(err instanceof Error ? err.message : 'Failed to create account. Changes may not persist.')
    })
  }

  function handleUpdateAccount(accountId: string, formData: AccountFormData) {
    if (!currentBudget) return

    const account = accounts[accountId]
    if (!account) return

    const oldGroupId = account.account_group_id || 'ungrouped'
    const newGroupId = formData.account_group_id

    // If group changed, update sort_order for the new group
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

    // Build new accounts map
    const newAccounts: AccountsMap = {}
    Object.entries(accounts).forEach(([accId, acc]) => {
      if (accId === accountId) {
        newAccounts[accId] = {
          ...acc,
          nickname: formData.nickname,
          account_group_id: newGroupId,
          sort_order: newSortOrder,
          is_income_account: formData.is_income_account,
          is_income_default: formData.is_income_default,
          is_outgo_account: formData.is_outgo_account,
          is_outgo_default: formData.is_outgo_default,
          on_budget: formData.on_budget !== false,
          is_active: formData.is_active !== false,
        }
      } else {
        newAccounts[accId] = { ...acc }
        // If this account is being set as income default, remove default from others
        if (formData.is_income_default && !account.is_income_default) {
          newAccounts[accId].is_income_default = false
        }
        // If this account is being set as outgo default, remove default from others
        if (formData.is_outgo_default && !account.is_outgo_default) {
          newAccounts[accId].is_outgo_default = false
        }
      }
    })

    // Optimistic update: update UI immediately, close form, save in background
    setAccounts(newAccounts)
    setEditingAccountId(null)

    // Save in background
    saveAccounts(newAccounts).catch(err => {
      console.error('[Accounts] Error saving account:', err)
      setError(err instanceof Error ? err.message : 'Failed to save account. Changes may not persist.')
    })
  }

  function handleDeleteAccount(accountId: string) {
    if (!confirm('Are you sure you want to delete this account?')) return
    if (!currentBudget) return

    const { [accountId]: _, ...newAccounts } = accounts

    // Optimistic update: update UI immediately, save in background
    setAccounts(newAccounts)

    // Save in background
    saveAccounts(newAccounts).catch(err => {
      console.error('[Accounts] Error deleting account:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete account. Changes may not persist.')
    })
  }

  // Group handlers
  function handleCreateGroup(formData: GroupFormData) {
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

    // Optimistic update: update UI immediately, close form, save in background
    setAccountGroups(newGroups)
    setShowCreateGroupForm(false)

    // Save in background
    saveAccountGroups(newGroups).catch(err => {
      console.error('[Accounts] Error creating group:', err)
      setError(err instanceof Error ? err.message : 'Failed to create account type. Changes may not persist.')
    })
  }

  function handleUpdateGroup(groupId: string, formData: GroupFormData) {
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

    // Optimistic update: update UI immediately, close form, save in background
    setAccountGroups(newGroups)
    setEditingGroupId(null)

    // Save in background
    saveAccountGroups(newGroups).catch(err => {
      console.error('[Accounts] Error updating group:', err)
      setError(err instanceof Error ? err.message : 'Failed to update account type. Changes may not persist.')
    })
  }

  function handleDeleteGroup(groupId: string) {
    if (!confirm('Are you sure you want to delete this account type? Accounts in this type will move to Ungrouped.')) return
    if (!currentBudget) return

    // Move accounts from this group to ungrouped
    const newAccounts: AccountsMap = {}
    Object.entries(accounts).forEach(([accId, account]) => {
      newAccounts[accId] = account.account_group_id === groupId
        ? { ...account, account_group_id: null }
        : account
    })
    const { [groupId]: _, ...newGroups } = accountGroups

    // Optimistic update: update UI immediately, save in background
    setAccounts(newAccounts)
    setAccountGroups(newGroups)

    // Save in background
    saveBoth(newAccounts, newGroups).catch(err => {
      console.error('[Accounts] Error deleting group:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete account type. Changes may not persist.')
    })
  }

  // Account drag handlers
  function handleAccountDragStart(e: DragEvent, accountId: string) {
    setDragType('account')
    setDraggedId(accountId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleAccountDragOver(e: DragEvent, accountId: string, groupId: string) {
    e.preventDefault()
    if (dragType !== 'account') return
    if (accountId !== draggedId) {
      setDragOverId(accountId)
    }
    setDragOverGroupId(groupId)
  }

  function handleDragOverGroup(e: DragEvent, groupId: string) {
    e.preventDefault()
    if (dragType === 'account') {
      setDragOverGroupId(groupId)
      setDragOverId(null)
    } else if (dragType === 'group' && groupId !== draggedId) {
      setDragOverId(groupId)
    }
  }

  function handleDragLeave() {
    setDragOverId(null)
  }

  function handleDragLeaveGroup() {
    setDragOverGroupId(null)
  }

  function handleDragEnd() {
    setDragType(null)
    setDraggedId(null)
    setDragOverId(null)
    setDragOverGroupId(null)
  }

  async function handleAccountDrop(e: DragEvent, targetId: string, targetGroupId: string) {
    e.preventDefault()
    e.stopPropagation()

    if (!draggedId || dragType !== 'account') {
      handleDragEnd()
      return
    }

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

    setAccounts(newAccounts)
    handleDragEnd()

    if (!currentBudget) return
    try {
      await saveAccounts(newAccounts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes')
    }
  }

  async function handleDropOnGroup(e: DragEvent, groupId: string) {
    e.preventDefault()
    if (dragType === 'account') {
      await handleAccountDrop(e, '__group_end__', groupId)
    } else if (dragType === 'group') {
      await handleGroupDrop(e, groupId)
    }
  }

  // Group drag handlers
  function handleGroupDragStart(e: DragEvent, groupId: string) {
    e.stopPropagation()
    setDragType('group')
    setDraggedId(groupId)
    e.dataTransfer.effectAllowed = 'move'
  }

  async function handleGroupDrop(e: DragEvent, targetId: string) {
    e.preventDefault()
    if (!draggedId || dragType !== 'group' || draggedId === targetId) {
      handleDragEnd()
      return
    }

    // Convert map to sorted array for reordering
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

    setAccountGroups(updatedGroups)
    handleDragEnd()

    if (!currentBudget) return
    try {
      await saveAccountGroups(updatedGroups)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save new order')
    }
  }

  // Move account up/down within its group
  async function handleMoveAccount(accountId: string, direction: 'up' | 'down') {
    const account = accounts[accountId]
    if (!account) return

    const groupId = account.account_group_id || 'ungrouped'
    const groupAccountEntries = Object.entries(accounts)
      .filter(([, a]) => (a.account_group_id || 'ungrouped') === groupId)
      .sort(([, a], [, b]) => a.sort_order - b.sort_order)

    const currentIndex = groupAccountEntries.findIndex(([accId]) => accId === accountId)
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1

    if (targetIndex < 0 || targetIndex >= groupAccountEntries.length) return

    // Swap sort orders
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

    setAccounts(newAccounts)

    if (!currentBudget) return
    try {
      await saveAccounts(newAccounts)
    } catch (err) {
      setAccounts(accounts)
      setError(err instanceof Error ? err.message : 'Failed to move account')
    }
  }

  // Move group up/down
  async function handleMoveGroup(groupId: string, direction: 'up' | 'down') {
    const sortedGroupEntries = Object.entries(accountGroups)
      .sort(([, a], [, b]) => a.sort_order - b.sort_order)
    const currentIndex = sortedGroupEntries.findIndex(([gId]) => gId === groupId)
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1

    if (targetIndex < 0 || targetIndex >= sortedGroupEntries.length) return

    // Swap positions in array
    const [movedEntry] = sortedGroupEntries.splice(currentIndex, 1)
    sortedGroupEntries.splice(targetIndex, 0, movedEntry)

    // Update sort orders
    const updatedGroups: AccountGroupsMap = {}
    sortedGroupEntries.forEach(([gId, group], index) => {
      updatedGroups[gId] = { ...group, sort_order: index }
    })

    setAccountGroups(updatedGroups)

    if (!currentBudget) return
    try {
      await saveAccountGroups(updatedGroups)
    } catch (err) {
      setAccountGroups(accountGroups)
      setError(err instanceof Error ? err.message : 'Failed to move account type')
    }
  }

  // Organize accounts by group (accounts with their IDs)
  type AccountWithId = FinancialAccount & { id: string }
  const accountsByGroup = Object.entries(accounts).reduce((acc, [accId, account]) => {
    const groupId = account.account_group_id || 'ungrouped'
    if (!acc[groupId]) acc[groupId] = []
    acc[groupId].push({ ...account, id: accId })
    return acc
  }, {} as Record<string, AccountWithId[]>)

  // Sort groups by sort_order (convert map to sorted array of entries with IDs)
  const sortedGroups: GroupWithId[] = Object.entries(accountGroups)
    .sort(([, a], [, b]) => a.sort_order - b.sort_order)
    .map(([gId, group]) => ({ ...group, id: gId }))

  if (!currentBudget) {
    return <p>No budget found. Please log in.</p>
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Accounts</h2>
      <p style={pageSubtitle}>
        Organize your financial accounts by type.
        <br />
        <span style={{ fontSize: '0.9rem' }}>
          {isMobile
            ? 'Use ▲▼ buttons to reorder items, or drag to move between types.'
            : 'Drag accounts between types, or use ▲▼ buttons to reorder.'}
        </span>
      </p>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {/* Balance Reconciliation Warning */}
      {balanceMismatch && Object.keys(balanceMismatch).length > 0 && (
        <div style={{
          background: 'color-mix(in srgb, #f59e0b 15%, transparent)',
          border: '1px solid #f59e0b',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1rem',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'flex-start' : 'center',
          gap: '1rem',
        }}>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 600, color: '#f59e0b' }}>
              ⚠️ Balance Mismatch Detected
            </p>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', opacity: 0.9 }}>
              {Object.keys(balanceMismatch).length} account{Object.keys(balanceMismatch).length !== 1 ? 's have' : ' has'} balances that don't match the calculated totals from income history.
            </p>
            <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.25rem', fontSize: '0.8rem', opacity: 0.8 }}>
              {Object.entries(balanceMismatch).slice(0, 3).map(([accId, { stored, calculated }]) => {
                const acc = accounts[accId]
                return (
                  <li key={accId}>
                    {acc?.nickname || 'Unknown'}: stored ${stored.toFixed(2)} vs calculated ${calculated.toFixed(2)}
                  </li>
                )
              })}
              {Object.keys(balanceMismatch).length > 3 && (
                <li>...and {Object.keys(balanceMismatch).length - 3} more</li>
              )}
            </ul>
          </div>
          <button
            onClick={async () => {
              setIsReconciling(true)
              try {
                await reconcileBalances()
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to reconcile')
              } finally {
                setIsReconciling(false)
              }
            }}
            disabled={isReconciling}
            style={{
              background: '#f59e0b',
              color: '#000',
              border: 'none',
              borderRadius: '6px',
              padding: '0.5rem 1rem',
              fontWeight: 600,
              cursor: isReconciling ? 'not-allowed' : 'pointer',
              opacity: isReconciling ? 0.7 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {isReconciling ? '⏳ Reconciling...' : '🔄 Reconcile Now'}
          </button>
        </div>
      )}

      {/* Manual Reconcile Button (when no mismatch) */}
      {!balanceMismatch && (
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginBottom: '1rem',
          gap: '0.5rem',
        }}>
          <button
            onClick={async () => {
              setIsCheckingMismatch(true)
              try {
                await checkBalanceMismatch()
              } finally {
                setIsCheckingMismatch(false)
              }
            }}
            disabled={isCheckingMismatch}
            style={{
              background: 'color-mix(in srgb, currentColor 10%, transparent)',
              border: 'none',
              borderRadius: '6px',
              padding: '0.5rem 0.75rem',
              fontSize: '0.85rem',
              cursor: isCheckingMismatch ? 'not-allowed' : 'pointer',
              opacity: isCheckingMismatch ? 0.6 : 1,
            }}
            title="Check if account balances match income history"
          >
            {isCheckingMismatch ? '⏳ Checking...' : '🔍 Check Balances'}
          </button>
          <button
            onClick={async () => {
              setIsReconciling(true)
              try {
                await reconcileBalances()
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to reconcile')
              } finally {
                setIsReconciling(false)
              }
            }}
            disabled={isReconciling}
            style={{
              background: 'color-mix(in srgb, currentColor 10%, transparent)',
              border: 'none',
              borderRadius: '6px',
              padding: '0.5rem 0.75rem',
              fontSize: '0.85rem',
              cursor: isReconciling ? 'not-allowed' : 'pointer',
              opacity: isReconciling ? 0.6 : 1,
            }}
            title="Recalculate all account balances from income history"
          >
            {isReconciling ? '⏳ Reconciling...' : '🔄 Reconcile All'}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
        {Object.keys(accounts).length === 0 && Object.keys(accountGroups).length === 0 && (
          <p style={{ opacity: 0.7 }}>No accounts yet. Create an account type first, then add accounts!</p>
        )}

        {/* Render groups */}
        {sortedGroups.map((group, groupIndex) => {
          const groupAccounts = (accountsByGroup[group.id] || []).sort((a, b) => a.sort_order - b.sort_order)
          const isGroupDragging = dragType === 'group' && draggedId === group.id
          const isGroupDragOver = dragType === 'group' && dragOverId === group.id
          const isAccountMovingHere = dragType === 'account' && dragOverGroupId === group.id
          const draggedAccount = draggedId && dragType === 'account' ? accounts[draggedId] : null
          const isMovingToDifferentGroup = draggedAccount && (draggedAccount.account_group_id || 'ungrouped') !== group.id

          // Check if we should show the drop indicator line above this group
          const showDropIndicator = dragType === 'group' && isGroupDragOver && draggedId !== group.id

          // Group reorder state
          const canMoveGroupUp = groupIndex > 0
          const canMoveGroupDown = groupIndex < sortedGroups.length - 1

          // Calculate group total
          const groupTotal = groupAccounts.reduce((sum, acc) => sum + acc.balance, 0)

          return (
            <div key={group.id}>
              {/* Drop indicator line above group */}
              {dragType === 'group' && !isGroupDragging && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOverId(group.id) }}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleGroupDrop(e, group.id)}
                  style={{
                    position: 'relative',
                    height: showDropIndicator ? '2.5rem' : '0.5rem',
                    marginBottom: showDropIndicator ? '-0.5rem' : '-0.25rem',
                    transition: 'height 0.15s',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: 0,
                      right: 0,
                      height: '3px',
                      background: colors.primary,
                      borderRadius: '2px',
                      opacity: showDropIndicator ? 1 : 0,
                      transition: 'opacity 0.15s',
                      boxShadow: showDropIndicator ? `0 0 8px rgba(100, 108, 255, 0.6)` : 'none',
                    }}
                  />
                  {showDropIndicator && (
                    <span style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      fontSize: '0.75rem',
                      opacity: 0.7,
                      background: 'var(--background, #1a1a1a)',
                      padding: '0 0.5rem',
                      whiteSpace: 'nowrap',
                    }}>
                      Drop here
                    </span>
                  )}
                </div>
              )}

              <div
                draggable={editingGroupId !== group.id}
                onDragStart={(e) => handleGroupDragStart(e, group.id)}
                onDragOver={(e) => {
                  handleDragOverGroup(e, group.id)
                }}
                onDragLeave={handleDragLeaveGroup}
                onDragEnd={handleDragEnd}
                onDrop={(e) => handleDropOnGroup(e, group.id)}
                style={{
                  background: isGroupDragging
                    ? 'color-mix(in srgb, currentColor 3%, transparent)'
                    : (isAccountMovingHere && isMovingToDifferentGroup)
                      ? `color-mix(in srgb, ${colors.primary} 10%, transparent)`
                      : 'color-mix(in srgb, currentColor 5%, transparent)',
                  borderRadius: '12px',
                  padding: '1rem',
                  opacity: isGroupDragging ? 0.5 : 1,
                  border: (isAccountMovingHere && isMovingToDifferentGroup)
                      ? `2px dashed ${colors.primary}`
                      : '2px solid transparent',
                  cursor: editingGroupId === group.id ? 'default' : 'grab',
                  transition: 'all 0.15s',
                }}
              >
              {editingGroupId === group.id ? (
                <GroupForm
                  initialData={{
                    name: group.name,
                    expected_balance: group.expected_balance || 'positive',
                    on_budget: group.on_budget,
                    is_active: group.is_active,
                  }}
                  onSubmit={(data) => handleUpdateGroup(group.id, data)}
                  onCancel={() => setEditingGroupId(null)}
                  submitLabel="Save"
                />
              ) : (
                <>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: isMobile ? '0.5rem' : '0.75rem',
                    paddingBottom: '0.5rem',
                    borderBottom: '1px solid color-mix(in srgb, currentColor 15%, transparent)',
                    gap: '0.5rem',
                    flexWrap: isMobile ? 'wrap' : 'nowrap',
                  }}>
                    <h3 style={{ ...sectionHeader, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                      {!isMobile && <span style={{ cursor: 'grab', opacity: 0.4 }}>⋮⋮</span>}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {group.name}
                      </span>
                      <span style={{ opacity: 0.5, fontWeight: 400, fontSize: '0.9rem', flexShrink: 0 }}>
                        ({groupAccounts.length})
                      </span>
                      <span style={{
                        marginLeft: '0.5rem',
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        color: getBalanceColor(groupTotal),
                        flexShrink: 0,
                      }}>
                        {formatCurrency(groupTotal)}
                      </span>
                      {/* Group-level override indicators */}
                      <GroupOverrideFlags group={group} />
                    </h3>
                    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, alignItems: 'center' }}>
                      {!isMobile && (
                        <Button variant="small" onClick={() => setCreateForGroupId(group.id)} disabled={createForGroupId !== null}>
                          + Account
                        </Button>
                      )}
                      <button
                        onClick={() => setEditingGroupId(group.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          opacity: 0.6,
                          fontSize: '0.9rem',
                          padding: '0.25rem',
                        }}
                        title="Edit account type"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteGroup(group.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          opacity: 0.6,
                          fontSize: '0.9rem',
                          padding: '0.25rem',
                        }}
                        title="Delete account type"
                      >
                        🗑️
                      </button>
                      {/* Group reorder buttons - on right side after edit/delete */}
                      <div style={reorderButtonGroup}>
                        <button
                          onClick={() => handleMoveGroup(group.id, 'up')}
                          disabled={!canMoveGroupUp}
                          style={{
                            ...reorderButton,
                            opacity: canMoveGroupUp ? 0.6 : 0.2,
                            cursor: canMoveGroupUp ? 'pointer' : 'default',
                          }}
                          title="Move account type up"
                          aria-label="Move account type up"
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => handleMoveGroup(group.id, 'down')}
                          disabled={!canMoveGroupDown}
                          style={{
                            ...reorderButton,
                            opacity: canMoveGroupDown ? 0.6 : 0.2,
                            cursor: canMoveGroupDown ? 'pointer' : 'default',
                          }}
                          title="Move account type down"
                          aria-label="Move account type down"
                        >
                          ▼
                        </button>
                      </div>
                    </div>
                  </div>
                  {/* Mobile: Add account button on its own row */}
                  {isMobile && (
                    <div style={{ marginBottom: '0.5rem' }}>
                      <Button variant="small" onClick={() => setCreateForGroupId(group.id)} disabled={createForGroupId !== null}>
                        + Account
                      </Button>
                    </div>
                  )}

                  <div style={listContainer}>
                    {groupAccounts.map((account) => (
                      editingAccountId === account.id ? (
            <AccountForm
              key={account.id}
              initialData={{
                nickname: account.nickname,
                            account_group_id: account.account_group_id,
                            is_income_account: account.is_income_account,
                            is_income_default: account.is_income_default,
                            is_outgo_account: account.is_outgo_account,
                            is_outgo_default: account.is_outgo_default,
                            on_budget: account.on_budget,
                            is_active: account.is_active,
                          }}
                          onSubmit={(data) => handleUpdateAccount(account.id, data)}
                          onCancel={() => setEditingAccountId(null)}
                          submitLabel="Save"
                          accountGroups={sortedGroups}
                          showGroupSelector={true}
                          showIncomeSettings={true}
                          currentGroupId={account.account_group_id}
                          hasExistingIncomeDefault={Object.entries(accounts).some(([accId, a]) => a.is_income_default && accId !== account.id)}
                          hasExistingOutgoDefault={Object.entries(accounts).some(([accId, a]) => a.is_outgo_default && accId !== account.id)}
            />
          ) : (
            <DraggableCard
              key={account.id}
                          isDragging={dragType === 'account' && draggedId === account.id}
              isDragOver={dragOverId === account.id}
                          onDragStart={(e) => { e.stopPropagation(); handleAccountDragStart(e, account.id) }}
                          onDragOver={(e) => handleAccountDragOver(e, account.id, group.id)}
              onDragLeave={handleDragLeave}
              onDragEnd={handleDragEnd}
                          onDrop={(e) => handleAccountDrop(e, account.id, group.id)}
                          onEdit={() => setEditingAccountId(account.id)}
                          onDelete={() => handleDeleteAccount(account.id)}
                          onMoveUp={() => handleMoveAccount(account.id, 'up')}
                          onMoveDown={() => handleMoveAccount(account.id, 'down')}
                          canMoveUp={groupAccounts.findIndex(a => a.id === account.id) > 0}
                          canMoveDown={groupAccounts.findIndex(a => a.id === account.id) < groupAccounts.length - 1}
            >
              <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={itemTitle}>{account.nickname}</span>
                    <AccountFlags account={account} accountGroups={sortedGroups} />
                  </div>
                            <p style={{
                              margin: '0.25rem 0 0 0',
                              fontSize: '1.1rem',
                              fontWeight: 600,
                              color: getBalanceColor(account.balance),
                            }}>
                              {formatCurrency(account.balance)}
                              {hasUnexpectedBalance(account.balance, group.expected_balance) && (
                                <span title={getBalanceWarning(account.balance, group.expected_balance) || ''} style={{ marginLeft: '0.5rem', fontSize: '0.85rem' }}>⚠️</span>
                              )}
                            </p>
                          </div>
                        </DraggableCard>
          )
        ))}

                    {groupAccounts.length === 0 && !createForGroupId && (
                      <p style={{ opacity: 0.5, fontSize: '0.9rem', margin: '0.5rem 0' }}>
                        No accounts in this type
                      </p>
                    )}

                    {/* Drop zone at end of account list */}
                    {dragType === 'account' && groupAccounts.length > 0 && (
                      <AccountEndDropZone
                        groupId={group.id}
                        isActive={dragOverId === `__end__${group.id}`}
                        onDragOver={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setDragOverId(`__end__${group.id}`)
                          setDragOverGroupId(group.id)
                        }}
                        onDragLeave={(e) => {
                          e.stopPropagation()
                          setDragOverId(null)
                        }}
                        onDrop={(e) => {
                          e.stopPropagation()
                          handleAccountDrop(e, '__group_end__', group.id)
                        }}
                      />
                    )}

                    {createForGroupId === group.id && (
                      <AccountForm
                        initialData={{ nickname: '', account_group_id: group.id }}
                        onSubmit={(data) => handleCreateAccount(data, group.id)}
                        onCancel={() => setCreateForGroupId(null)}
                        submitLabel="Create"
                        accountGroups={sortedGroups}
                        showIncomeSettings={true}
                        currentGroupId={group.id}
                      />
                    )}
                  </div>

                  {/* Bottom add account button */}
                  {createForGroupId !== group.id && (
                    <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid color-mix(in srgb, currentColor 10%, transparent)' }}>
                      <Button variant="small" onClick={() => setCreateForGroupId(group.id)} disabled={createForGroupId !== null}>
                        + Add Account
                      </Button>
                    </div>
                  )}
                </>
              )}
              </div>
            </div>
          )
        })}

        {/* Drop zone for reordering groups to end */}
        {dragType === 'group' && sortedGroups.length > 0 && (
          <DropZone
            isActive={dragOverId === '__end__'}
            onDragOver={(e) => { e.preventDefault(); setDragOverId('__end__') }}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleGroupDrop(e, '__end__')}
            label="Move account type to end"
          />
        )}

        {/* Ungrouped section */}
        {(() => {
          const ungroupedAccounts = (accountsByGroup['ungrouped'] || []).sort((a, b) => a.sort_order - b.sort_order)
          const isAccountMovingHere = dragType === 'account' && dragOverGroupId === 'ungrouped'
          const draggedAccount = draggedId && dragType === 'account' ? accounts[draggedId] : null
          const isMovingToDifferentGroup = draggedAccount && draggedAccount.account_group_id !== null

          if (ungroupedAccounts.length === 0 && !createForGroupId && Object.keys(accountGroups).length > 0 && dragType !== 'account') {
            return null
          }

          const ungroupedTotal = ungroupedAccounts.reduce((sum, acc) => sum + acc.balance, 0)

          return (
            <div
              onDragOver={(e) => handleDragOverGroup(e, 'ungrouped')}
              onDragLeave={handleDragLeaveGroup}
              onDrop={(e) => handleDropOnGroup(e, 'ungrouped')}
              style={{
                background: (isAccountMovingHere && isMovingToDifferentGroup)
                  ? `color-mix(in srgb, ${colors.primary} 10%, transparent)`
                  : 'color-mix(in srgb, currentColor 5%, transparent)',
                borderRadius: '12px',
                padding: '1rem',
                border: (isAccountMovingHere && isMovingToDifferentGroup)
                  ? `2px dashed ${colors.primary}`
                  : '2px solid transparent',
                transition: 'all 0.15s',
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.75rem',
                paddingBottom: '0.5rem',
                borderBottom: '1px solid color-mix(in srgb, currentColor 15%, transparent)',
              }}>
                <h3 style={{ ...sectionHeader, margin: 0, opacity: 0.7, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Ungrouped
                  <span style={{ marginLeft: '0.5rem', opacity: 0.5, fontWeight: 400, fontSize: '0.9rem' }}>
                    ({ungroupedAccounts.length})
                  </span>
                  {ungroupedAccounts.length > 0 && (
                    <span style={{
                      marginLeft: '0.5rem',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                      color: getBalanceColor(ungroupedTotal),
                    }}>
                      {formatCurrency(ungroupedTotal)}
                    </span>
                  )}
                </h3>
                <Button variant="small" onClick={() => setCreateForGroupId('ungrouped')} disabled={createForGroupId !== null}>
                  + Account
                </Button>
                </div>

              <div style={listContainer}>
                {ungroupedAccounts.map((account) => (
                  editingAccountId === account.id ? (
                    <AccountForm
                      key={account.id}
                      initialData={{
                        nickname: account.nickname,
                        account_group_id: account.account_group_id,
                        is_income_account: account.is_income_account,
                        is_income_default: account.is_income_default,
                        is_outgo_account: account.is_outgo_account,
                        is_outgo_default: account.is_outgo_default,
                        on_budget: account.on_budget,
                        is_active: account.is_active,
                      }}
                      onSubmit={(data) => handleUpdateAccount(account.id, data)}
                      onCancel={() => setEditingAccountId(null)}
                      submitLabel="Save"
                      accountGroups={sortedGroups}
                      showGroupSelector={true}
                      showIncomeSettings={true}
                      currentGroupId={null}
                      hasExistingIncomeDefault={Object.entries(accounts).some(([accId, a]) => a.is_income_default && accId !== account.id)}
                      hasExistingOutgoDefault={Object.entries(accounts).some(([accId, a]) => a.is_outgo_default && accId !== account.id)}
                    />
                  ) : (
                    <DraggableCard
                      key={account.id}
                      isDragging={dragType === 'account' && draggedId === account.id}
                      isDragOver={dragOverId === account.id}
                      onDragStart={(e) => handleAccountDragStart(e, account.id)}
                      onDragOver={(e) => handleAccountDragOver(e, account.id, 'ungrouped')}
                      onDragLeave={handleDragLeave}
                      onDragEnd={handleDragEnd}
                      onDrop={(e) => handleAccountDrop(e, account.id, 'ungrouped')}
                      onEdit={() => setEditingAccountId(account.id)}
                      onDelete={() => handleDeleteAccount(account.id)}
                      onMoveUp={() => handleMoveAccount(account.id, 'up')}
                      onMoveDown={() => handleMoveAccount(account.id, 'down')}
                      canMoveUp={ungroupedAccounts.findIndex(a => a.id === account.id) > 0}
                      canMoveDown={ungroupedAccounts.findIndex(a => a.id === account.id) < ungroupedAccounts.length - 1}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={itemTitle}>{account.nickname}</span>
                          <AccountFlags account={account} accountGroups={sortedGroups} />
                        </div>
                <p style={{
                          margin: '0.25rem 0 0 0',
                          fontSize: '1.1rem',
                  fontWeight: 600,
                  color: getBalanceColor(account.balance),
                }}>
                  {formatCurrency(account.balance)}
                </p>
              </div>
            </DraggableCard>
          )
        ))}

                {ungroupedAccounts.length === 0 && dragType === 'account' && (
                  <p style={{ opacity: 0.5, fontSize: '0.9rem', margin: '0.5rem 0', textAlign: 'center' }}>
                    Drop here to ungroup
                  </p>
                )}

                {/* Drop zone at end of ungrouped account list */}
                {dragType === 'account' && ungroupedAccounts.length > 0 && (
                  <AccountEndDropZone
                    groupId="ungrouped"
                    isActive={dragOverId === '__end__ungrouped'}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setDragOverId('__end__ungrouped')
                      setDragOverGroupId('ungrouped')
                    }}
                    onDragLeave={(e) => {
                      e.stopPropagation()
                      setDragOverId(null)
                    }}
                    onDrop={(e) => {
                      e.stopPropagation()
                      handleAccountDrop(e, '__group_end__', 'ungrouped')
                    }}
                  />
                )}

                {createForGroupId === 'ungrouped' && (
                  <AccountForm
                    initialData={{ nickname: '', account_group_id: null }}
                    onSubmit={(data) => handleCreateAccount(data, 'ungrouped')}
                    onCancel={() => setCreateForGroupId(null)}
                    submitLabel="Create"
                    accountGroups={sortedGroups}
                    showIncomeSettings={true}
                    currentGroupId={null}
          />
        )}
      </div>

              {/* Bottom add account button for ungrouped */}
              {createForGroupId !== 'ungrouped' && (
                <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid color-mix(in srgb, currentColor 10%, transparent)' }}>
                  <Button variant="small" onClick={() => setCreateForGroupId('ungrouped')} disabled={createForGroupId !== null}>
                    + Add Account
                  </Button>
                </div>
              )}
            </div>
          )
        })()}
      </div>

      {/* Add Account Type button/form */}
      {showCreateGroupForm ? (
        <GroupForm
          onSubmit={handleCreateGroup}
          onCancel={() => setShowCreateGroupForm(false)}
          submitLabel="Create Account Type"
        />
      ) : (
        <Button variant="primary-large" onClick={() => setShowCreateGroupForm(true)}>
          + Add Account Type
        </Button>
      )}
    </div>
  )
}

export default Accounts
