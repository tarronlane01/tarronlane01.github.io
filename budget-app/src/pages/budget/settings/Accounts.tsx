import { useState, useMemo, useEffect } from 'react'
import { useAccountsPage, useBudgetData, useAutoRecalculation } from '@hooks'
import { useBudget, useApp } from '@contexts'
import {
  Button,
  formatCurrency,
  getBalanceColor,
  CollapsibleSection,
  bannerQueue,
} from '@components/ui'
import { useIsMobile } from '@hooks'
import { UNGROUPED_ACCOUNT_GROUP_ID } from '@constants'
import {
  GroupForm,
  AccountForm,
} from '@components/budget/Accounts'
import { SettingsAccountGroupRows } from '@components/budget/Accounts/SettingsAccountGroupRows'
import { RecalculateAllButton } from '@components/budget/Month'

function Accounts() {
  const { selectedBudgetId } = useBudget()
  const { monthMap, isLoading: isBudgetLoading } = useBudgetData()

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

  // Add loading hold while loading - keep it up until budget data is fully loaded
  useEffect(() => {
    if (isBudgetLoading || !currentBudget) {
      addLoadingHold('accounts', 'Loading accounts...')
    } else {
      removeLoadingHold('accounts')
    }
    return () => removeLoadingHold('accounts')
  }, [isBudgetLoading, currentBudget, addLoadingHold, removeLoadingHold])

  // Auto-trigger recalculation when navigating to Accounts settings if ANY month needs recalc
  useAutoRecalculation({ budgetId: selectedBudgetId, monthMap, checkAnyMonth: true, additionalCondition: !isBudgetLoading && !!currentBudget, logPrefix: '[Settings/Accounts]' })

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

  // Column header style - matches month pages
  const columnHeaderStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    fontWeight: 600,
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: '0.5rem',
    borderBottom: '2px solid rgba(255,255,255,0.2)',
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

  // Don't show "No budget found" while still loading
  if (isBudgetLoading) {
    return null
  }

  if (!currentBudget) {
    return <p>No budget found. Please log in.</p>
  }

  return (
    <div>

      {/* Sticky header: title + stats + buttons */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, backgroundColor: '#242424', marginLeft: 'calc(-1 * var(--page-padding, 2rem))', marginRight: 'calc(-1 * var(--page-padding, 2rem))', paddingLeft: 'var(--page-padding, 2rem)', paddingRight: 'var(--page-padding, 2rem)', paddingTop: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
        {/* Title + Stats + Buttons row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem 1rem', fontSize: '0.85rem' }}>
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
              Use ▲▼ buttons to reorder accounts.
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            <RecalculateAllButton />
          </div>
        </div>
      </div>

      {/* CSS Grid container - header and content share the same grid */}
      <div style={{
        display: 'grid',
        // Account, Balance, Flags, Actions
        gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1.5fr 1fr',
        marginTop: '1rem',
        marginBottom: '1.5rem',
      }}>
        {/* Sticky wrapper using subgrid on desktop, block on mobile */}
        <div style={{
          gridColumn: '1 / -1',
          position: 'sticky',
          top: '3.5rem', // Below the stats header
          zIndex: 49,
          backgroundColor: '#242424',
          display: isMobile ? 'block' : 'grid',
          gridTemplateColumns: isMobile ? undefined : 'subgrid',
        }}>
          {/* Column headers row - desktop only */}
          {!isMobile && (
            <>
              <div style={columnHeaderStyle}>Account</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'right' }}>Balance</div>
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

        {/* Bottom padding */}
        <div style={{ gridColumn: '1 / -1', height: '1rem' }} />
      </div>

      {/* Hidden accounts section */}
      {hiddenAccounts.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <CollapsibleSection title="Hidden Accounts" count={hiddenAccounts.length}>
            <div style={{
              padding: '0.75rem',
              marginBottom: '1rem',
              background: 'color-mix(in srgb, currentColor 5%, transparent)',
              borderRadius: '8px',
              fontSize: '0.85rem',
            }}>
              <p style={{ margin: '0 0 0.5rem 0', opacity: 0.8 }}>
                <strong>🙈 Hidden accounts</strong> are excluded from dropdowns and balance displays.
                They're useful for historical accounts (like closed bank accounts or old 401Ks) that you want to keep for record-keeping but don't need in everyday use.
              </p>
              <p style={{ margin: 0, opacity: 0.6 }}>
                To unhide an account, click it to edit and uncheck "Hidden account".
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {hiddenAccounts.map(account => (
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
                      is_hidden: account.is_hidden,
                    }}
                    onSubmit={(data) => { handleUpdateAccount(account.id, data); setEditingAccountId(null) }}
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
                  <div
                    key={account.id}
                    onClick={() => setEditingAccountId(account.id)}
                    style={{
                      padding: '0.75rem 1rem',
                      background: 'color-mix(in srgb, currentColor 3%, transparent)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      opacity: 0.7,
                    }}
                  >
                    <span>{account.nickname}</span>
                    <span style={{ color: getBalanceColor(account.balance), fontWeight: 500 }}>
                      {formatCurrency(account.balance)}
                    </span>
                  </div>
                )
              ))}
            </div>
          </CollapsibleSection>
        </div>
      )}

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

