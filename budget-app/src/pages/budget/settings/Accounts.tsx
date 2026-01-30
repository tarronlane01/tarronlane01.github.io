import { useState, useMemo, useEffect } from 'react'
import { useAccountsPage, useBudgetData, useMonthData, useEnsureBalancesFresh } from '@hooks'
import { useBudget, useApp } from '@contexts'
import { calculateAccountClearedBalances } from '@calculations'
import {
  Button,
  formatStatsCurrency,
  getBalanceColor,
  bannerQueue,
} from '@components/ui'
import { useIsMobile } from '@hooks'
import { UNGROUPED_ACCOUNT_GROUP_ID } from '@constants'
import {
  GroupForm,
  SettingsHiddenAccounts,
} from '@components/budget/Accounts'
import { SettingsAccountGroupRows } from '@components/budget/Accounts/SettingsAccountGroupRows'

function Accounts() {
  const { selectedBudgetId, currentYear, currentMonthNumber } = useBudget()
  const { isLoading: isBudgetLoading, isFetching: isBudgetFetching, accounts: budgetAccounts } = useBudgetData()
  const { month: currentMonth } = useMonthData(selectedBudgetId, currentYear, currentMonthNumber)

  const {
    accounts,
    accountsByGroup,
    hiddenAccounts,
    sortedGroups: allSortedGroups,
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
  } = useAccountsPage()

  const isMobile = useIsMobile()
  const { addLoadingHold, removeLoadingHold } = useApp()

  // Check fetching state BEFORE rendering to avoid flashing empty values
  const isDataLoading = isBudgetLoading || isBudgetFetching || !currentBudget
  // Ensure months are fresh in cache before calculating balances (refetches if stale)
  useEnsureBalancesFresh(!isDataLoading && !!currentBudget)
  // Add loading hold while loading or fetching - keep it up until budget data is fully loaded
  useEffect(() => {
    if (isDataLoading) {
      addLoadingHold('accounts', 'Loading accounts...')
    } else {
      removeLoadingHold('accounts')
    }
    return () => removeLoadingHold('accounts')
  }, [isDataLoading, addLoadingHold, removeLoadingHold])

  // Account editing state
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null)
  const [createForGroupId, setCreateForGroupId] = useState<string | null>(null)

  // Group editing state
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [showCreateGroupForm, setShowCreateGroupForm] = useState(false)

  // Calculate stats for header
  const stats = useMemo(() => {
    const accountList = Object.values(accounts)
    const totalBalance = accountList.reduce((sum, acc) => sum + (acc.balance ?? 0), 0)

    // Calculate on-budget total (accounts in on-budget groups or ungrouped on-budget accounts)
    let onBudgetTotal = 0
    let offBudgetTotal = 0

    for (const acc of accountList) {
      const group = allSortedGroups.find(g => g.id === acc.account_group_id)
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
      groupCount: allSortedGroups.filter(g => g.id !== UNGROUPED_ACCOUNT_GROUP_ID).length,
      totalBalance,
      onBudgetTotal,
      offBudgetTotal,
    }
  }, [accounts, allSortedGroups])

  // Filter out ungrouped group from sortedGroups so it appears last
  const sortedGroups = useMemo(() => {
    return allSortedGroups.filter(g => g.id !== UNGROUPED_ACCOUNT_GROUP_ID)
  }, [allSortedGroups])

  // Create ungrouped group object for table display - must be before early return
  const ungroupedGroup = useMemo(() => ({
    id: UNGROUPED_ACCOUNT_GROUP_ID,
    name: 'Ungrouped',
    sort_order: sortedGroups.length,
    expected_balance: 'any' as const,
    on_budget: null,
    is_active: null,
  }), [sortedGroups.length])

  const ungroupedAccounts = accountsByGroup[UNGROUPED_ACCOUNT_GROUP_ID] || []

  // Calculate cleared balances from current month
  const accountClearedBalances = useMemo(() => {
    if (!currentMonth) return {}
    return calculateAccountClearedBalances(currentMonth, budgetAccounts)
  }, [currentMonth, budgetAccounts])

  // Column header style - matches month pages
  const columnHeaderStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    fontWeight: 600,
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    paddingTop: '0.75rem', // More space above to match visual spacing below
    paddingBottom: '0.5rem',
    paddingLeft: '0.5rem',
    paddingRight: '0.5rem',
    borderBottom: '2px solid var(--border-medium)',
  }

  // Show errors via banner system
  useEffect(() => {
    if (error) {
      console.error('[Settings/Accounts] Error:', error)
      bannerQueue.add({
        type: 'error',
        message: 'Failed to update accounts. See console for details.',
        autoDismissMs: 0,
      })
      // Clear error after showing banner
      setError(null)
    }
  }, [error, setError])

  // Don't render content if data is loading or fetching (cache invalid) - show loading overlay instead
  if (isDataLoading || !currentBudget) {
    return isDataLoading ? null : <p>No budget found. Please log in.</p>
  }

  return (
    <div>
      {/* CSS Grid container - header and content share the same grid */}
      <div style={{
        display: 'grid',
        // Account, Total, Cleared, Uncleared, Flags, Actions
        gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1fr 1fr 1.5fr 1fr',
        marginBottom: '1.5rem',
      }}>
        {/* Sticky wrapper using subgrid - contains both stats header and column headers as subgrid rows */}
        <div style={{
          gridColumn: '1 / -1',
          position: 'sticky',
          top: 0, // Sticky at top, stats header will be first row inside
          zIndex: 50,
          backgroundColor: 'var(--sticky-header-bg)',
          display: isMobile ? 'block' : 'grid',
          gridTemplateColumns: isMobile ? undefined : 'subgrid',
        }}>
          {/* First subgrid row: stats header */}
          <div style={{
            gridColumn: '1 / -1',
            marginLeft: 'calc(-1 * var(--page-padding, 2rem))',
            marginRight: 'calc(-1 * var(--page-padding, 2rem))',
            paddingLeft: 'var(--page-padding, 2rem)',
            paddingRight: 'var(--page-padding, 2rem)',
            paddingTop: '0.5rem',
            paddingBottom: '0.5rem', // Reduced spacing before column headers
          }}>
            {/* Title + Stats + Buttons row */}
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              alignItems: 'center', 
              gap: '0.5rem 1rem', 
              fontSize: '0.85rem',
              paddingBottom: '0.5rem', // Spacing above border to separate button
              borderBottom: '1px solid var(--border-medium)', // Border on inner element to respect page container
            }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', flex: 1, alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>Accounts:</span>
                <span>
                  <span style={{ opacity: 0.6 }}>On-Budget: </span>
                  <span style={{ color: getBalanceColor(stats.onBudgetTotal), fontWeight: 600 }}>{formatStatsCurrency(stats.onBudgetTotal)}</span>
                </span>
                {stats.offBudgetTotal !== 0 && (
                  <span>
                    <span style={{ opacity: 0.6 }}>Off-Budget: </span>
                    <span style={{ fontWeight: 600, opacity: 0.7 }}>{formatStatsCurrency(stats.offBudgetTotal)}</span>
                  </span>
                )}
                <span>
                  <span style={{ opacity: 0.6 }}>Total: </span>
                  <span style={{ color: getBalanceColor(stats.totalBalance), fontWeight: 600 }}>{formatStatsCurrency(stats.totalBalance)}</span>
                </span>
                <span style={{ opacity: 0.5, fontSize: '0.8rem' }}>
                  Use ▲▼ buttons to reorder accounts.
                </span>
              </div>
            </div>
          </div>

          {/* Second subgrid row: column headers */}
          {!isMobile && (
            <>
              <div style={columnHeaderStyle}>Account</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'right' }}>Total</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'right' }}>Cleared</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'right' }}>Uncleared</div>
              <div style={columnHeaderStyle}>Flags</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'right' }}>Actions</div>
            </>
          )}
        </div>

        {/* Empty state */}
        {Object.keys(accounts).length === 0 && sortedGroups.length === 0 && (
          <p style={{ gridColumn: '1 / -1', opacity: 0.7, textAlign: 'center', padding: '2rem' }}>
            No accounts yet. Create an account type first, then add accounts!
          </p>
        )}

        {/* Render groups */}
        {sortedGroups.map((group, groupIndex) => {
          const groupAccounts = accountsByGroup[group.id] || []
          if (groupAccounts.length === 0 && editingGroupId !== group.id && createForGroupId !== group.id) return null

          // If editing group, show form outside grid
          if (editingGroupId === group.id) {
            return (
              <div key={group.id} style={{ gridColumn: '1 / -1', marginBottom: '1rem' }}>
                <GroupForm
                  initialData={{
                    name: group.name,
                    expected_balance: group.expected_balance || 'positive',
                    on_budget: group.on_budget ?? undefined,
                    is_active: group.is_active ?? undefined,
                  }}
                  onSubmit={(data) => {
                    handleUpdateGroup(group.id, data)
                    setEditingGroupId(null)
                  }}
                  onCancel={() => setEditingGroupId(null)}
                  submitLabel="Save"
                />
              </div>
            )
          }

          return (
            <SettingsAccountGroupRows
              key={group.id}
              group={group}
              accounts={groupAccounts}
              allGroups={sortedGroups}
              allAccounts={accounts}
              accountClearedBalances={accountClearedBalances}
              editingAccountId={editingAccountId}
              createForGroupId={createForGroupId}
              setEditingAccountId={setEditingAccountId}
              setCreateForGroupId={setCreateForGroupId}
              onUpdateAccount={(id, data) => { handleUpdateAccount(id, data); setEditingAccountId(null) }}
              onDeleteAccount={handleDeleteAccount}
              onMoveAccount={handleMoveAccount}
              onCreateAccount={handleCreateAccount}
              isMobile={isMobile}
              canMoveGroupUp={groupIndex > 0}
              canMoveGroupDown={groupIndex < sortedGroups.length - 1}
              onEditGroup={() => setEditingGroupId(group.id)}
              onDeleteGroup={() => handleDeleteGroup(group.id)}
              onMoveGroupUp={() => handleMoveGroup(group.id, 'up')}
              onMoveGroupDown={() => handleMoveGroup(group.id, 'down')}
            />
          )
        })}

        {/* Ungrouped section - always rendered last, after all groups */}
        {(ungroupedAccounts.length > 0 || createForGroupId === 'ungrouped') && (
          <SettingsAccountGroupRows
            group={ungroupedGroup}
            accounts={ungroupedAccounts}
            allGroups={sortedGroups}
            allAccounts={accounts}
            accountClearedBalances={accountClearedBalances}
            editingAccountId={editingAccountId}
            createForGroupId={createForGroupId}
            setEditingAccountId={setEditingAccountId}
            setCreateForGroupId={setCreateForGroupId}
            onUpdateAccount={(id, data) => { handleUpdateAccount(id, data); setEditingAccountId(null) }}
            onDeleteAccount={handleDeleteAccount}
            onMoveAccount={handleMoveAccount}
            onCreateAccount={handleCreateAccount}
            isMobile={isMobile}
            isUngrouped
            canMoveGroupUp={false}
            canMoveGroupDown={false}
            onEditGroup={() => {}} // Ungrouped can't be edited
            onDeleteGroup={() => {}} // Ungrouped can't be deleted
            onMoveGroupUp={() => {}}
            onMoveGroupDown={() => {}}
          />
        )}

        <div style={{ gridColumn: '1 / -1', height: '1rem' }} />
      </div>

      {/* Hidden accounts section */}
      <SettingsHiddenAccounts
        hiddenAccounts={hiddenAccounts}
        accounts={accounts}
        sortedGroups={sortedGroups}
        editingAccountId={editingAccountId}
        setEditingAccountId={setEditingAccountId}
        onUpdateAccount={handleUpdateAccount}
      />

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

