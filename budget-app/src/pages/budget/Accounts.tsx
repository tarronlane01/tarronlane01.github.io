import { useState, type FormEvent, type DragEvent } from 'react'
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore'
import app from '../../firebase'
import { useBudget, type FinancialAccount, type AccountGroup, type ExpectedBalanceType } from '../../contexts/budget_context'
import {
  ErrorAlert,
  Button,
  DraggableCard,
  DropZone,
  StatCard,
  StatItem,
  FormWrapper,
  FormField,
  TextInput,
  SelectInput,
  FormButtonGroup,
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

interface AccountFormData {
  nickname: string
  account_group_id: string | null
}

interface GroupFormData {
  name: string
  expected_balance: ExpectedBalanceType
}

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
  const { currentBudget, accounts, setAccounts, accountGroups, setAccountGroups } = useBudget()
  const [error, setError] = useState<string | null>(null)
  const isMobile = useIsMobile()

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

  // Save functions
  async function saveAccounts(newAccounts: FinancialAccount[]) {
    if (!currentBudget) return
    try {
      const budgetDocRef = doc(db, 'budgets', currentBudget.id)
      const budgetDoc = await getDoc(budgetDocRef)
      if (budgetDoc.exists()) {
        const data = budgetDoc.data()
        await setDoc(budgetDocRef, { ...data, accounts: newAccounts })
      }
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to save accounts')
    }
  }

  async function saveAccountGroups(newGroups: AccountGroup[]) {
    if (!currentBudget) return
    try {
      const budgetDocRef = doc(db, 'budgets', currentBudget.id)
      const budgetDoc = await getDoc(budgetDocRef)
      if (budgetDoc.exists()) {
        const data = budgetDoc.data()
        // Ensure all groups have expected_balance defaulted to 'positive'
        const cleanedGroups = newGroups.map(group => ({
          id: group.id,
          name: group.name,
          sort_order: group.sort_order,
          expected_balance: group.expected_balance || 'positive',
        }))
        await setDoc(budgetDocRef, { ...data, account_groups: cleanedGroups })
      }
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to save account groups')
    }
  }

  async function saveBoth(newAccounts: FinancialAccount[], newGroups: AccountGroup[]) {
    if (!currentBudget) return
    try {
      const budgetDocRef = doc(db, 'budgets', currentBudget.id)
      const budgetDoc = await getDoc(budgetDocRef)
      if (budgetDoc.exists()) {
        const data = budgetDoc.data()
        await setDoc(budgetDocRef, { ...data, accounts: newAccounts, account_groups: newGroups })
      }
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to save changes')
    }
  }

  // Account handlers
  async function handleCreateAccount(formData: AccountFormData, forGroupId: string | null) {
    if (!currentBudget) return

    const groupAccounts = accounts.filter(a =>
      (forGroupId === 'ungrouped' ? !a.account_group_id : a.account_group_id === forGroupId)
    )
    const maxSortOrder = groupAccounts.length > 0
      ? Math.max(...groupAccounts.map(a => a.sort_order))
        : -1

      const newAccount: FinancialAccount = {
        id: `account_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        nickname: formData.nickname,
      balance: 0, // Balance will be calculated from transactions
      account_group_id: forGroupId === 'ungrouped' ? null : forGroupId,
        sort_order: maxSortOrder + 1,
      }

    const newAccounts = [...accounts, newAccount].sort((a, b) => a.sort_order - b.sort_order)
      setAccounts(newAccounts)
    setCreateForGroupId(null)

    try {
      await saveAccounts(newAccounts)
    } catch (err) {
      setAccounts(accounts)
      setError(err instanceof Error ? err.message : 'Failed to create account')
    }
  }

  async function handleUpdateAccount(accountId: string, formData: AccountFormData) {
    if (!currentBudget) return
    try {
      const account = accounts.find(a => a.id === accountId)
      if (!account) return

      const oldGroupId = account.account_group_id || 'ungrouped'
      const newGroupId = formData.account_group_id

      // If group changed, update sort_order for the new group
      let newSortOrder = account.sort_order
      if (oldGroupId !== (newGroupId || 'ungrouped')) {
        const targetGroupAccounts = accounts.filter(a => {
          const accGroupId = a.account_group_id || 'ungrouped'
          return accGroupId === (newGroupId || 'ungrouped') && a.id !== accountId
        })
        newSortOrder = targetGroupAccounts.length > 0
          ? Math.max(...targetGroupAccounts.map(a => a.sort_order)) + 1
          : 0
      }

      const newAccounts = accounts.map(acc =>
        acc.id === accountId
          ? {
              ...acc,
              nickname: formData.nickname,
              account_group_id: newGroupId,
              sort_order: newSortOrder,
            }
          : acc
      )
      setAccounts(newAccounts)
      await saveAccounts(newAccounts)
      setEditingAccountId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update account')
    }
  }

  async function handleDeleteAccount(accountId: string) {
    if (!confirm('Are you sure you want to delete this account?')) return
    if (!currentBudget) return
    try {
      const newAccounts = accounts.filter(account => account.id !== accountId)
      setAccounts(newAccounts)
      await saveAccounts(newAccounts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account')
    }
  }

  // Group handlers
  async function handleCreateGroup(formData: GroupFormData) {
    if (!currentBudget) return
    try {
      const maxSortOrder = accountGroups.length > 0
        ? Math.max(...accountGroups.map(g => g.sort_order))
        : -1

      const newGroup: AccountGroup = {
        id: `account_group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: formData.name,
        sort_order: maxSortOrder + 1,
        expected_balance: formData.expected_balance,
      }

      const newGroups = [...accountGroups, newGroup]
      setAccountGroups(newGroups)
      await saveAccountGroups(newGroups)
      setShowCreateGroupForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account type')
    }
  }

  async function handleUpdateGroup(groupId: string, formData: GroupFormData) {
    if (!currentBudget) return
    try {
      const newGroups = accountGroups.map(group =>
        group.id === groupId
          ? { ...group, name: formData.name, expected_balance: formData.expected_balance }
          : group
      )
      setAccountGroups(newGroups)
      await saveAccountGroups(newGroups)
      setEditingGroupId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update account type')
    }
  }

  async function handleDeleteGroup(groupId: string) {
    if (!confirm('Are you sure you want to delete this account type? Accounts in this type will move to Ungrouped.')) return
    if (!currentBudget) return
    try {
      // Move accounts from this group to ungrouped
      const newAccounts = accounts.map(account =>
        account.account_group_id === groupId
          ? { ...account, account_group_id: null }
          : account
      )
      const newGroups = accountGroups.filter(group => group.id !== groupId)

      setAccounts(newAccounts)
      setAccountGroups(newGroups)
      await saveBoth(newAccounts, newGroups)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account type')
    }
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

    const draggedAccount = accounts.find(a => a.id === draggedId)
    if (!draggedAccount) return

    const newGroupId = targetGroupId === 'ungrouped' ? null : targetGroupId
    const targetGroupAccounts = accounts.filter(a => {
      const accGroupId = a.account_group_id || 'ungrouped'
      return accGroupId === targetGroupId
    })

    let newAccounts = accounts.filter(a => a.id !== draggedId)
    let newSortOrder: number

    if (targetId === '__group_end__' || targetGroupAccounts.length === 0 || !targetGroupAccounts.find(a => a.id === targetId)) {
      const maxInGroup = targetGroupAccounts.length > 0
        ? Math.max(...targetGroupAccounts.filter(a => a.id !== draggedId).map(a => a.sort_order))
        : -1
      newSortOrder = maxInGroup + 1
    } else {
      const targetAccount = targetGroupAccounts.find(a => a.id === targetId)
      if (targetAccount) {
        newSortOrder = targetAccount.sort_order
        newAccounts = newAccounts.map(a => {
          const accGroupId = a.account_group_id || 'ungrouped'
          if (accGroupId === targetGroupId && a.sort_order >= newSortOrder) {
            return { ...a, sort_order: a.sort_order + 1 }
          }
          return a
        })
      } else {
        newSortOrder = 0
      }
    }

    const updatedDraggedAccount: FinancialAccount = {
      ...draggedAccount,
      account_group_id: newGroupId,
      sort_order: newSortOrder,
    }

    newAccounts.push(updatedDraggedAccount)
    newAccounts.sort((a, b) => a.sort_order - b.sort_order)

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

    const draggedIndex = accountGroups.findIndex(g => g.id === draggedId)
    const newGroups = [...accountGroups]
    const [draggedItem] = newGroups.splice(draggedIndex, 1)

    if (targetId === '__end__') {
      newGroups.push(draggedItem)
    } else {
      const targetIndex = newGroups.findIndex(g => g.id === targetId)
      newGroups.splice(targetIndex, 0, draggedItem)
    }

    const updatedGroups = newGroups.map((group, index) => ({
      ...group,
      sort_order: index,
    }))

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
    const account = accounts.find(a => a.id === accountId)
    if (!account) return

    const groupId = account.account_group_id || 'ungrouped'
    const groupAccounts = accounts
      .filter(a => (a.account_group_id || 'ungrouped') === groupId)
      .sort((a, b) => a.sort_order - b.sort_order)

    const currentIndex = groupAccounts.findIndex(a => a.id === accountId)
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1

    if (targetIndex < 0 || targetIndex >= groupAccounts.length) return

    // Swap sort orders
    const targetAccount = groupAccounts[targetIndex]
    const newAccounts = accounts.map(a => {
      if (a.id === accountId) {
        return { ...a, sort_order: targetAccount.sort_order }
      }
      if (a.id === targetAccount.id) {
        return { ...a, sort_order: account.sort_order }
      }
      return a
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
    const sortedGroupsCopy = [...accountGroups].sort((a, b) => a.sort_order - b.sort_order)
    const currentIndex = sortedGroupsCopy.findIndex(g => g.id === groupId)
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1

    if (targetIndex < 0 || targetIndex >= sortedGroupsCopy.length) return

    // Swap positions in array
    const [movedGroup] = sortedGroupsCopy.splice(currentIndex, 1)
    sortedGroupsCopy.splice(targetIndex, 0, movedGroup)

    // Update sort orders
    const updatedGroups = sortedGroupsCopy.map((group, index) => ({
      ...group,
      sort_order: index,
    }))

    setAccountGroups(updatedGroups)

    if (!currentBudget) return
    try {
      await saveAccountGroups(updatedGroups)
    } catch (err) {
      setAccountGroups(accountGroups)
      setError(err instanceof Error ? err.message : 'Failed to move account type')
    }
  }

  // Organize accounts by group
  const accountsByGroup = accounts.reduce((acc, account) => {
    const groupId = account.account_group_id || 'ungrouped'
    if (!acc[groupId]) acc[groupId] = []
    acc[groupId].push(account)
    return acc
  }, {} as Record<string, FinancialAccount[]>)

  // Sort groups by sort_order
  const sortedGroups = [...accountGroups].sort((a, b) => a.sort_order - b.sort_order)

  // Calculate totals
  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0)

  // Calculate balances by group
  const groupBalances = sortedGroups.map(group => {
    const groupAccounts = accountsByGroup[group.id] || []
    return {
      id: group.id,
      name: group.name,
      balance: groupAccounts.reduce((sum, acc) => sum + acc.balance, 0),
      count: groupAccounts.length,
    }
  })

  // Ungrouped balance
  const ungroupedAccounts = accountsByGroup['ungrouped'] || []
  const ungroupedBalance = ungroupedAccounts.reduce((sum, acc) => sum + acc.balance, 0)

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

      {/* Summary Stats */}
      <StatCard style={{
        borderLeft: `4px solid ${colors.primary}`,
        background: `linear-gradient(135deg, color-mix(in srgb, ${colors.primary} 8%, transparent), color-mix(in srgb, currentColor 3%, transparent))`,
        padding: '1.25rem 1.5rem',
      }}>
        <StatItem
          label="Total Balance (All Accounts)"
          value={formatCurrency(totalBalance)}
          valueColor={getBalanceColor(totalBalance)}
        />
      </StatCard>

      {/* Balances by Group */}
      {(groupBalances.length > 0 || ungroupedAccounts.length > 0) && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.75rem',
          marginBottom: '1.5rem',
        }}>
          {groupBalances.map(group => {
            const accountGroup = accountGroups.find(g => g.id === group.id)
            const warning = getBalanceWarning(group.balance, accountGroup?.expected_balance)
            return (
              <div
                key={group.id}
                style={{
                  background: 'color-mix(in srgb, currentColor 5%, transparent)',
                  padding: '1rem',
                  borderRadius: '8px',
                  borderLeft: `3px solid ${getBalanceColor(group.balance)}`,
                }}
              >
                <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {group.name}
                </p>
                <p style={{
                  margin: '0.25rem 0 0 0',
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  color: getBalanceColor(group.balance),
                }}>
                  {formatCurrency(group.balance)}
                </p>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', opacity: 0.5 }}>
                  {group.count} account{group.count !== 1 ? 's' : ''}
                </p>
                {warning && (
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.7rem', color: '#fbbf24' }}>
                    ⚠️ {warning}
                  </p>
                )}
              </div>
            )
          })}
          {ungroupedAccounts.length > 0 && (
            <div
              style={{
                background: 'color-mix(in srgb, currentColor 5%, transparent)',
                padding: '1rem',
                borderRadius: '8px',
                borderLeft: `3px solid ${getBalanceColor(ungroupedBalance)}`,
                opacity: 0.7,
              }}
            >
              <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Ungrouped
              </p>
              <p style={{
                margin: '0.25rem 0 0 0',
                fontSize: '1.25rem',
                fontWeight: 600,
                color: getBalanceColor(ungroupedBalance),
              }}>
                {formatCurrency(ungroupedBalance)}
              </p>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', opacity: 0.5 }}>
                {ungroupedAccounts.length} account{ungroupedAccounts.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
      </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
        {accounts.length === 0 && accountGroups.length === 0 && (
          <p style={{ opacity: 0.7 }}>No accounts yet. Create an account type first, then add accounts!</p>
        )}

        {/* Render groups */}
        {sortedGroups.map((group, groupIndex) => {
          const groupAccounts = (accountsByGroup[group.id] || []).sort((a, b) => a.sort_order - b.sort_order)
          const isGroupDragging = dragType === 'group' && draggedId === group.id
          const isGroupDragOver = dragType === 'group' && dragOverId === group.id
          const isAccountMovingHere = dragType === 'account' && dragOverGroupId === group.id
          const draggedAccount = draggedId && dragType === 'account' ? accounts.find(a => a.id === draggedId) : null
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
                  initialData={{ name: group.name, expected_balance: group.expected_balance || 'positive' }}
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
                    <h3 style={{ ...sectionHeader, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
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
                          }}
                          onSubmit={(data) => handleUpdateAccount(account.id, data)}
                          onCancel={() => setEditingAccountId(null)}
                          submitLabel="Save"
                          accountGroups={accountGroups}
                          showGroupSelector={true}
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
                  <span style={itemTitle}>{account.nickname}</span>
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
                        accountGroups={accountGroups}
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
          const draggedAccount = draggedId && dragType === 'account' ? accounts.find(a => a.id === draggedId) : null
          const isMovingToDifferentGroup = draggedAccount && draggedAccount.account_group_id !== null

          if (ungroupedAccounts.length === 0 && !createForGroupId && accountGroups.length > 0 && dragType !== 'account') {
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
                      }}
                      onSubmit={(data) => handleUpdateAccount(account.id, data)}
                      onCancel={() => setEditingAccountId(null)}
                      submitLabel="Save"
                      accountGroups={accountGroups}
                      showGroupSelector={true}
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
                        <span style={itemTitle}>{account.nickname}</span>
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
                    accountGroups={accountGroups}
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

// Account Form
interface AccountFormProps {
  initialData?: AccountFormData
  onSubmit: (data: AccountFormData) => void
  onCancel: () => void
  submitLabel: string
  accountGroups: AccountGroup[]
  showGroupSelector?: boolean
}

function AccountForm({ initialData, onSubmit, onCancel, submitLabel, accountGroups, showGroupSelector = false }: AccountFormProps) {
  const [formData, setFormData] = useState<AccountFormData>(initialData || { nickname: '', account_group_id: null })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!formData.nickname.trim()) return
    onSubmit(formData)
  }

  return (
    <FormWrapper onSubmit={handleSubmit}>
      <FormField label="Account Nickname" htmlFor="account-nickname">
        <TextInput
          id="account-nickname"
          type="text"
          value={formData.nickname}
          onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
          placeholder="e.g., Main Checking, Savings"
          required
          autoFocus
        />
      </FormField>
      {showGroupSelector && (
        <FormField label="Account Type" htmlFor="account-group">
          <SelectInput
            id="account-group"
            value={formData.account_group_id || 'ungrouped'}
            onChange={(e) => setFormData({
              ...formData,
              account_group_id: e.target.value === 'ungrouped' ? null : e.target.value
            })}
          >
            <option value="ungrouped">Ungrouped</option>
            {accountGroups.map(group => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </SelectInput>
        </FormField>
      )}
      <FormButtonGroup>
        <Button type="submit">{submitLabel}</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
      </FormButtonGroup>
    </FormWrapper>
  )
}

// Group Form
interface GroupFormProps {
  initialData?: GroupFormData
  onSubmit: (data: GroupFormData) => void
  onCancel: () => void
  submitLabel: string
}

function GroupForm({ initialData, onSubmit, onCancel, submitLabel }: GroupFormProps) {
  const [formData, setFormData] = useState<GroupFormData>(initialData || { name: '', expected_balance: 'positive' })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!formData.name.trim()) return
    onSubmit(formData)
  }

  return (
    <FormWrapper onSubmit={handleSubmit}>
      <FormField label="Account Type Name" htmlFor="group-name">
        <TextInput
          id="group-name"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Checking, Savings, Credit Cards, Investments"
          required
          autoFocus
        />
      </FormField>
      <FormField label="Expected Balance" htmlFor="expected-balance">
        <SelectInput
          id="expected-balance"
          value={formData.expected_balance}
          onChange={(e) => setFormData({ ...formData, expected_balance: e.target.value as ExpectedBalanceType })}
        >
          <option value="positive">Normally Positive (e.g., Checking, Savings)</option>
          <option value="negative">Normally Negative (e.g., Credit Cards, Loans)</option>
          <option value="any">Either (no warnings)</option>
        </SelectInput>
      </FormField>
      <FormButtonGroup>
        <Button type="submit">{submitLabel}</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
      </FormButtonGroup>
    </FormWrapper>
  )
}

// Drop zone for adding account to end of group
interface AccountEndDropZoneProps {
  groupId: string
  isActive: boolean
  onDragOver: (e: DragEvent) => void
  onDragLeave: (e: DragEvent) => void
  onDrop: (e: DragEvent) => void
}

function AccountEndDropZone({ isActive, onDragOver, onDragLeave, onDrop }: AccountEndDropZoneProps) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        position: 'relative',
        height: '2rem',
        marginTop: '-0.25rem',
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
          opacity: isActive ? 1 : 0.3,
          transition: 'opacity 0.15s',
          boxShadow: isActive ? `0 0 8px rgba(100, 108, 255, 0.6)` : 'none',
        }}
      />
      {isActive && (
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
          Move to end
        </span>
      )}
    </div>
  )
}

export default Accounts
