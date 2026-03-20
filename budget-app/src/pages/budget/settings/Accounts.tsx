import { useState, useMemo, useEffect, useCallback } from 'react'
import { useAccountsPage, useBudgetData, useMonthData, useEnsureBalancesFresh, useSetOffBudgetBalance } from '@hooks'
import { useBudget, useApp } from '@contexts'
import { calculateAccountClearedBalances } from '@calculations'
import { isAccountOnBudget } from '@utils/calculations/balances/calculateTotalAvailable'
import {
  Button,
  formatStatsCurrency,
  getBalanceColor,
  bannerQueue,
} from '@components/ui'
import { useIsMobile } from '@hooks'
import { UNGROUPED_ACCOUNT_GROUP_ID } from '@constants'
import {
  AccountForm,
  AccountSectionDivider,
  EditGroupsModal,
} from '@components/budget/Accounts'
import { SettingsAccountTableRow } from '@components/budget/Accounts/SettingsAccountTableRow'

function Accounts() {
  const { selectedBudgetId, currentYear, currentMonthNumber, initialBalanceCalculationComplete } = useBudget()
  const { isLoading: isBudgetLoading, isFetching: isBudgetFetching, accounts: budgetAccounts, getOnBudgetTotal, totalAvailable } = useBudgetData()
  const { month: currentMonth } = useMonthData(selectedBudgetId, currentYear, currentMonthNumber)

  const {
    accounts,
    accountGroups,
    sortedFlatAccounts,
    sortedGroups: allSortedGroups,
    currentBudget,
    error,
    setError,
    handleCreateAccount,
    handleUpdateAccount,
    handleDeleteAccount,
    handleSwapAccounts,
    handleCreateGroup,
    handleUpdateGroup,
    handleDeleteGroup,
    handleMoveGroup,
  } = useAccountsPage()

  const isMobile = useIsMobile()
  const { addLoadingHold, removeLoadingHold } = useApp()
  const { setBalance: setOffBudgetBalance } = useSetOffBudgetBalance()

  const isDataLoading = isBudgetLoading || isBudgetFetching || !currentBudget || !initialBalanceCalculationComplete
  useEnsureBalancesFresh(!isDataLoading && !!currentBudget && initialBalanceCalculationComplete, { alwaysRecalculate: true })
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
  const [showCreateAccount, setShowCreateAccount] = useState(false)

  // Group modal state
  const [showGroupsModal, setShowGroupsModal] = useState(false)

  // Stats
  const stats = useMemo(() => {
    const activeAccounts = Object.values(accounts).filter(acc => !acc.is_deleted)
    const totalBalance = activeAccounts.reduce((sum, acc) => sum + (acc.balance ?? 0), 0)
    let onBudgetTotal = 0
    let offBudgetTotal = 0
    const groupsMap = Object.fromEntries(allSortedGroups.map(g => [g.id, g]))
    for (const acc of activeAccounts) {
      if (isAccountOnBudget(acc, groupsMap)) {
        onBudgetTotal += acc.balance ?? 0
      } else {
        offBudgetTotal += acc.balance ?? 0
      }
    }
    return { totalBalance, onBudgetTotal, offBudgetTotal }
  }, [accounts, allSortedGroups])

  // Groups for the modal (exclude ungrouped)
  const sortedGroups = useMemo(() => {
    return allSortedGroups.filter(g => g.id !== UNGROUPED_ACCOUNT_GROUP_ID)
  }, [allSortedGroups])

  // Calculate cleared balances from current month
  const accountClearedBalances = useMemo(() => {
    if (!currentMonth) return {}
    return calculateAccountClearedBalances(currentMonth, budgetAccounts)
  }, [currentMonth, budgetAccounts])

  // Split accounts into on-budget and off-budget sections
  const groupsMap = useMemo(() =>
    Object.fromEntries(allSortedGroups.map(g => [g.id, g])),
    [allSortedGroups]
  )

  const { onBudgetAccounts, offBudgetAccounts } = useMemo(() => {
    const on: typeof sortedFlatAccounts = []
    const off: typeof sortedFlatAccounts = []
    for (const account of sortedFlatAccounts) {
      if (isAccountOnBudget(account, groupsMap)) {
        on.push(account)
      } else {
        off.push(account)
      }
    }
    return { onBudgetAccounts: on, offBudgetAccounts: off }
  }, [sortedFlatAccounts, groupsMap])

  // Section-aware move: constrain up/down within the same section
  const handleSectionMove = useCallback((accountId: string, direction: 'up' | 'down', section: typeof sortedFlatAccounts) => {
    const sectionIdx = section.findIndex(a => a.id === accountId)
    if (sectionIdx < 0) return
    const targetIdx = direction === 'up' ? sectionIdx - 1 : sectionIdx + 1
    if (targetIdx < 0 || targetIdx >= section.length) return
    handleSwapAccounts(accountId, section[targetIdx].id)
  }, [handleSwapAccounts])

  const columnHeaderStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    fontWeight: 600,
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    paddingTop: '0.75rem',
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
      setError(null)
    }
  }, [error, setError])

  if (isDataLoading || !currentBudget) {
    return isDataLoading ? null : <p>No budget found. Please log in.</p>
  }

  return (
    <div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1fr 1fr 1fr 1.5fr 1fr',
        marginBottom: '1.5rem',
      }}>
        {/* Sticky header */}
        <div style={{
          gridColumn: '1 / -1',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backgroundColor: 'var(--sticky-header-bg)',
          display: isMobile ? 'block' : 'grid',
          gridTemplateColumns: isMobile ? undefined : 'subgrid',
        }}>
          {/* Stats header */}
          <div style={{
            gridColumn: '1 / -1',
            marginLeft: 'calc(-1 * var(--page-padding, 2rem))',
            marginRight: 'calc(-1 * var(--page-padding, 2rem))',
            paddingLeft: 'var(--page-padding, 2rem)',
            paddingRight: 'var(--page-padding, 2rem)',
            paddingTop: '0.5rem',
            paddingBottom: '0.5rem',
          }}>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '0.5rem 1rem',
              fontSize: '0.85rem',
              paddingBottom: '0.5rem',
              borderBottom: '1px solid var(--border-medium)',
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
                <span style={{ marginLeft: '0.5rem', paddingLeft: '0.5rem', borderLeft: '1px solid var(--border-medium)' }}>
                  <span style={{ opacity: 0.6 }}>On-Budget: </span>
                  <span style={{ color: getBalanceColor(getOnBudgetTotal()), fontWeight: 600 }}>{formatStatsCurrency(getOnBudgetTotal())}</span>
                  <span style={{ opacity: 0.6 }}> − Allocated: </span>
                  <span style={{ fontWeight: 600 }}>{formatStatsCurrency(getOnBudgetTotal() - totalAvailable)}</span>
                  <span style={{ opacity: 0.6 }}> = Avail: </span>
                  <span style={{ color: getBalanceColor(totalAvailable), fontWeight: 600 }}>{formatStatsCurrency(totalAvailable)}</span>
                </span>
              </div>
              <Button variant="small" actionName="Open Add Account Form" onClick={() => setShowCreateAccount(true)} disabled={showCreateAccount}>
                + Account
              </Button>
            </div>
          </div>

          {/* Column headers */}
          {!isMobile && (
            <>
              <div style={columnHeaderStyle}>Account</div>
              <div style={{ ...columnHeaderStyle, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                Group
                <button
                  onClick={() => setShowGroupsModal(true)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    opacity: 0.5,
                    fontSize: '0.75rem',
                    padding: '0.1rem',
                  }}
                  title="Edit account types"
                >
                  ✏️
                </button>
              </div>
              <div style={{ ...columnHeaderStyle, textAlign: 'right' }}>Total</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'right' }}>Cleared</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'right' }}>Uncleared</div>
              <div style={columnHeaderStyle}>Flags</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'right' }}>Actions</div>
            </>
          )}
        </div>

        {/* Empty state */}
        {sortedFlatAccounts.length === 0 && !showCreateAccount && (
          <p style={{ gridColumn: '1 / -1', opacity: 0.7, textAlign: 'center', padding: '2rem' }}>
            No accounts yet. Click "+ Account" to create one!
          </p>
        )}

        {/* Create account form */}
        {showCreateAccount && (
          <div style={{ gridColumn: '1 / -1', marginBottom: '0.5rem', marginTop: '0.5rem' }}>
            <AccountForm
              initialData={{ nickname: '', account_group_id: null }}
              onSubmit={(data) => { handleCreateAccount(data, data.account_group_id); setShowCreateAccount(false) }}
              onCancel={() => setShowCreateAccount(false)}
              submitLabel="Create"
              accountGroups={allSortedGroups}
              showGroupSelector={true}
              showIncomeSettings={true}
            />
          </div>
        )}

        {/* On-budget account list */}
        {onBudgetAccounts.map((account, idx) => {
          const group = accountGroups[account.account_group_id]
          return (
            <SettingsAccountTableRow
              key={account.id}
              account={account}
              accountIndex={idx}
              totalAccounts={onBudgetAccounts.length}
              allGroups={allSortedGroups}
              allAccounts={accounts}
              clearedBalance={accountClearedBalances?.[account.id]}
              groupName={group?.name ?? 'Ungrouped'}
              groupColor={group?.badge_color ?? 'grey'}
              onEdit={setEditingAccountId}
              onDelete={handleDeleteAccount}
              onMoveUp={() => handleSectionMove(account.id, 'up', onBudgetAccounts)}
              onMoveDown={() => handleSectionMove(account.id, 'down', onBudgetAccounts)}
              canMoveUp={idx > 0}
              canMoveDown={idx < onBudgetAccounts.length - 1}
              editingAccountId={editingAccountId}
              setEditingAccountId={setEditingAccountId}
              onUpdateAccount={(id, data) => { handleUpdateAccount(id, data); setEditingAccountId(null) }}
              isMobile={isMobile}
            />
          )
        })}

        {/* Off-budget section inside the same grid so columns align */}
        {offBudgetAccounts.length > 0 && (
          <>
            <div style={{ gridColumn: '1 / -1' }}>
              <AccountSectionDivider label="Off-Budget" />
            </div>
            {offBudgetAccounts.map((account, idx) => {
              const group = accountGroups[account.account_group_id]
              return (
                <SettingsAccountTableRow
                  key={account.id}
                  account={account}
                  accountIndex={idx}
                  totalAccounts={offBudgetAccounts.length}
                  allGroups={allSortedGroups}
                  allAccounts={accounts}
                  clearedBalance={accountClearedBalances?.[account.id]}
                  groupName={group?.name ?? 'Ungrouped'}
                  groupColor={group?.badge_color ?? 'grey'}
                  onEdit={setEditingAccountId}
                  onDelete={handleDeleteAccount}
                  onMoveUp={() => handleSectionMove(account.id, 'up', offBudgetAccounts)}
                  onMoveDown={() => handleSectionMove(account.id, 'down', offBudgetAccounts)}
                  canMoveUp={idx > 0}
                  canMoveDown={idx < offBudgetAccounts.length - 1}
                  editingAccountId={editingAccountId}
                  setEditingAccountId={setEditingAccountId}
                  onUpdateAccount={(id, data) => { handleUpdateAccount(id, data); setEditingAccountId(null) }}
                  isMobile={isMobile}
                  isOffBudget
                  onSetOffBudgetBalance={setOffBudgetBalance}
                  offBudgetBalanceMonth={account.off_budget_balance_month}
                />
              )
            })}
          </>
        )}

        <div style={{ gridColumn: '1 / -1', height: '1rem' }} />
      </div>

      {/* Edit Groups Modal */}
      <EditGroupsModal
        isOpen={showGroupsModal}
        onClose={() => setShowGroupsModal(false)}
        groups={sortedGroups}
        onCreateGroup={handleCreateGroup}
        onUpdateGroup={handleUpdateGroup}
        onDeleteGroup={handleDeleteGroup}
        onMoveGroup={handleMoveGroup}
      />
    </div>
  )
}

export default Accounts
