import { useState, useMemo, type DragEvent } from 'react'
import { useAccountsPage } from '@hooks'
import {
  ErrorAlert,
  Button,
  DropZone,
  formatCurrency,
  getBalanceColor,
} from '../../../components/ui'
import { useIsMobile } from '@hooks'
import {
  GroupForm,
  AccountGroupCard,
  UngroupedAccountsSection,
} from '../../../components/budget/Accounts'
import { RecalculateAllButton } from '../../../components/budget/Month'

type DragType = 'account' | 'group' | null

function Accounts() {
  const {
    accounts,
    accountsByGroup,
    sortedGroups,
    currentBudget,
    error,
    setError,
    handleCreateAccount,
    handleUpdateAccount,
    handleDeleteAccount,
    handleMoveAccount,
    handleCreateGroup,
    handleUpdateGroup,
    handleDeleteGroup,
    handleMoveGroup,
    reorderAccountsInGroup,
    reorderGroups,
  } = useAccountsPage()

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

    await reorderAccountsInGroup(draggedId, targetId, targetGroupId)
    handleDragEnd()
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

    await reorderGroups(draggedId, targetId)
    handleDragEnd()
  }

  // Calculate stats for header
  const stats = useMemo(() => {
    const accountList = Object.values(accounts)
    const totalBalance = accountList.reduce((sum, acc) => sum + (acc.balance ?? 0), 0)

    // Calculate on-budget total (accounts in on-budget groups or ungrouped on-budget accounts)
    let onBudgetTotal = 0
    let offBudgetTotal = 0

    for (const acc of accountList) {
      const group = sortedGroups.find(g => g.id === acc.account_group_id)
      // Account is on-budget if: its own on_budget is true, OR (on_budget is undefined and group's on_budget is true or undefined)
      const isOnBudget = acc.on_budget === true || (acc.on_budget === undefined && (group?.on_budget !== false))
      if (isOnBudget) {
        onBudgetTotal += acc.balance ?? 0
      } else {
        offBudgetTotal += acc.balance ?? 0
      }
    }

    return {
      count: accountList.length,
      groupCount: sortedGroups.length,
      totalBalance,
      onBudgetTotal,
      offBudgetTotal,
    }
  }, [accounts, sortedGroups])

  if (!currentBudget) {
    return <p>No budget found. Please log in.</p>
  }

  const ungroupedAccounts = accountsByGroup['ungrouped'] || []

  return (
    <div>
      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {/* Sticky header: title + stats + buttons */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backgroundColor: '#242424',
        marginLeft: 'calc(-1 * var(--page-padding, 2rem))',
        marginRight: 'calc(-1 * var(--page-padding, 2rem))',
        paddingLeft: 'var(--page-padding, 2rem)',
        paddingRight: 'var(--page-padding, 2rem)',
        paddingTop: '0.5rem',
        paddingBottom: '0.5rem',
        borderBottom: '1px solid rgba(255,255,255,0.15)',
      }}>
        {/* Title + Stats + Buttons row */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.5rem 1rem',
          fontSize: '0.85rem',
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', flex: 1, alignItems: 'center' }}>
            <span style={{ fontWeight: 600 }}>Accounts:</span>
            <span>
              <span style={{ opacity: 0.6 }}>On-Budget: </span>
              <span style={{ color: getBalanceColor(stats.onBudgetTotal), fontWeight: 600 }}>{formatCurrency(stats.onBudgetTotal)}</span>
            </span>
            {stats.offBudgetTotal !== 0 && (
              <span>
                <span style={{ opacity: 0.6 }}>Off-Budget: </span>
                <span style={{ fontWeight: 600, opacity: 0.7 }}>{formatCurrency(stats.offBudgetTotal)}</span>
              </span>
            )}
            <span>
              <span style={{ opacity: 0.6 }}>Total: </span>
              <span style={{ color: getBalanceColor(stats.totalBalance), fontWeight: 600 }}>{formatCurrency(stats.totalBalance)}</span>
            </span>
            <span style={{ opacity: 0.5, fontSize: '0.8rem' }}>
              {isMobile ? 'Drag to move.' : 'Drag between types or use ▲▼ to reorder.'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            <RecalculateAllButton />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem', paddingTop: '1rem' }}>
        {Object.keys(accounts).length === 0 && sortedGroups.length === 0 && (
          <p style={{ opacity: 0.7 }}>No accounts yet. Create an account type first, then add accounts!</p>
        )}

        {/* Render groups */}
        {sortedGroups.map((group, groupIndex) => (
          <AccountGroupCard
            key={group.id}
            group={group}
            groupIndex={groupIndex}
            totalGroups={sortedGroups.length}
            accounts={accountsByGroup[group.id] || []}
            allGroups={sortedGroups}
            allAccounts={accounts}
            editingAccountId={editingAccountId}
            editingGroupId={editingGroupId}
            createForGroupId={createForGroupId}
            setEditingAccountId={setEditingAccountId}
            setEditingGroupId={setEditingGroupId}
            setCreateForGroupId={setCreateForGroupId}
            dragType={dragType}
            draggedId={draggedId}
            dragOverId={dragOverId}
            dragOverGroupId={dragOverGroupId}
            setDragOverId={setDragOverId}
            setDragOverGroupId={setDragOverGroupId}
            onAccountDragStart={handleAccountDragStart}
            onAccountDragOver={handleAccountDragOver}
            onAccountDrop={handleAccountDrop}
            onGroupDragStart={handleGroupDragStart}
            onGroupDragOver={handleDragOverGroup}
            onGroupDrop={handleGroupDrop}
            onDragLeave={handleDragLeave}
            onDragLeaveGroup={handleDragLeaveGroup}
            onDragEnd={handleDragEnd}
            onDropOnGroup={handleDropOnGroup}
            onCreateAccount={handleCreateAccount}
            onUpdateAccount={(id, data) => { handleUpdateAccount(id, data); setEditingAccountId(null) }}
            onDeleteAccount={handleDeleteAccount}
            onMoveAccount={handleMoveAccount}
            onUpdateGroup={(id, data) => { handleUpdateGroup(id, data); setEditingGroupId(null) }}
            onDeleteGroup={handleDeleteGroup}
            onMoveGroup={handleMoveGroup}
          />
        ))}

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
        <UngroupedAccountsSection
          accounts={ungroupedAccounts}
          allGroups={sortedGroups}
          allAccounts={accounts}
          hasGroups={sortedGroups.length > 0}
          editingAccountId={editingAccountId}
          createForGroupId={createForGroupId}
          setEditingAccountId={setEditingAccountId}
          setCreateForGroupId={setCreateForGroupId}
          dragType={dragType}
          draggedId={draggedId}
          dragOverId={dragOverId}
          dragOverGroupId={dragOverGroupId}
          setDragOverId={setDragOverId}
          setDragOverGroupId={setDragOverGroupId}
          onAccountDragStart={handleAccountDragStart}
          onAccountDragOver={handleAccountDragOver}
          onAccountDrop={handleAccountDrop}
          onDragOverGroup={handleDragOverGroup}
          onDropOnGroup={handleDropOnGroup}
          onDragLeave={handleDragLeave}
          onDragLeaveGroup={handleDragLeaveGroup}
          onDragEnd={handleDragEnd}
          onCreateAccount={handleCreateAccount}
          onUpdateAccount={(id, data) => { handleUpdateAccount(id, data); setEditingAccountId(null) }}
          onDeleteAccount={handleDeleteAccount}
          onMoveAccount={handleMoveAccount}
        />
      </div>

      {/* Add Account Type button/form */}
      {showCreateGroupForm ? (
        <GroupForm
          onSubmit={(data) => { handleCreateGroup(data); setShowCreateGroupForm(false) }}
          onCancel={() => setShowCreateGroupForm(false)}
          submitLabel="Create Account Type"
        />
      ) : (
        <Button variant="primary-large" actionName="Open Add Account Type Form" onClick={() => setShowCreateGroupForm(true)}>
          + Add Account Type
        </Button>
      )}
    </div>
  )
}

export default Accounts

