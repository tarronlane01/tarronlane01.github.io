import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useBudget } from '@contexts'
import { useBudgetData, useBudgetMonth } from '@hooks'
import { useIsMobile } from '@hooks'
import type { FinancialAccount } from '@types'
import { Button } from '../../ui'
import { colors } from '@styles/shared'
import { TransferForm } from '../Transfers'
import { TransferGridRow } from './TransferGridRow'
import { logUserAction, getDefaultFormDate } from '@utils'
import { isNoCategory, NO_CATEGORY_NAME, isNoAccount, NO_ACCOUNT_NAME } from '@data/constants'

// Column header style for the grid
const columnHeaderStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  opacity: 0.6,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  padding: '0.5rem',
  borderTop: '1px solid rgba(255,255,255,0.1)',
}

export function MonthTransfers() {
  const { selectedBudgetId, currentYear, currentMonthNumber, setCurrentYear, setCurrentMonthNumber } = useBudget()
  const { accounts, accountGroups, categories, categoryGroups } = useBudgetData()
  const {
    month: currentMonth,
    isLoading: monthLoading,
    addTransfer,
    updateTransfer,
    deleteTransfer,
  } = useBudgetMonth(selectedBudgetId, currentYear, currentMonthNumber)

  const isMobile = useIsMobile()
  const [error, setError] = useState<string | null>(null)
  const [showAddTransfer, setShowAddTransfer] = useState(false)
  const [editingTransferId, setEditingTransferId] = useState<string | null>(null)

  // Note: Recalculation is NOT triggered on this tab since it only shows raw transactions.
  // Edits here will mark months for recalculation (via writeMonthData), and recalc
  // will happen when the user navigates to Categories or Accounts tabs.

  // Helper to get effective is_active value considering group overrides
  function getEffectiveActive(account: FinancialAccount): boolean {
    const group = account.account_group_id ? accountGroups[account.account_group_id] : undefined
    if (group?.is_active !== undefined) return group.is_active
    return account.is_active !== false
  }

  // Helper to get effective on_budget value considering group overrides
  function getEffectiveOnBudget(account: FinancialAccount): boolean {
    const group = account.account_group_id ? accountGroups[account.account_group_id] : undefined
    if (group?.on_budget !== undefined) return group.on_budget
    return account.on_budget !== false
  }

  // Account entry type for working with accounts map
  type AccountEntry = [string, FinancialAccount]

  // Filter accounts for transfer dropdown - all active on-budget accounts
  const activeOnBudgetAccounts = Object.entries(accounts).filter(
    ([, a]) => getEffectiveActive(a) && getEffectiveOnBudget(a)
  ) as AccountEntry[]

  // Handle transfer operations
  // Note: Mutations handle optimistic cache updates internally
  function handleAddTransfer(
    amount: number,
    fromAccountId: string,
    toAccountId: string,
    fromCategoryId: string,
    toCategoryId: string,
    date: string,
    description?: string,
    cleared?: boolean
  ) {
    setError(null)
    setShowAddTransfer(false) // Close form immediately - mutation handles optimistic update

    // Parse the date to determine which month this transfer belongs to
    const [transferYear, transferMonth] = date.split('-').map(Number)

    // Navigate to target month if different
    if (transferYear !== currentYear || transferMonth !== currentMonthNumber) {
      setCurrentYear(transferYear)
      setCurrentMonthNumber(transferMonth)
    }

    // Mutation handles optimistic update and Firestore write
    addTransfer(amount, fromAccountId, toAccountId, fromCategoryId, toCategoryId, date, description, cleared)
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Failed to add transfer')
      })
  }

  function handleUpdateTransfer(
    transferId: string,
    amount: number,
    fromAccountId: string,
    toAccountId: string,
    fromCategoryId: string,
    toCategoryId: string,
    date: string,
    description?: string,
    cleared?: boolean
  ) {
    setError(null)
    setEditingTransferId(null) // Close form immediately - mutation handles optimistic update

    // Mutation handles optimistic update and Firestore write
    updateTransfer(transferId, amount, fromAccountId, toAccountId, fromCategoryId, toCategoryId, date, description, cleared)
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Failed to update transfer')
      })
  }

  function handleDeleteTransfer(transferId: string) {
    if (!confirm('Are you sure you want to delete this transfer?')) return
    setError(null)

    // Mutation handles optimistic update and Firestore delete
    deleteTransfer(transferId).catch(err => {
      setError(err instanceof Error ? err.message : 'Failed to delete transfer')
    })
  }

  const canAddTransfer = activeOnBudgetAccounts.length >= 1 && Object.keys(categories).length >= 1

  return (
    <div style={{
      opacity: monthLoading ? 0.5 : 1,
      transition: 'opacity 0.15s ease-out',
      pointerEvents: monthLoading ? 'none' : 'auto',
    }}>
      {error && (
        <div style={{
          background: `color-mix(in srgb, ${colors.error} 15%, transparent)`,
          border: `1px solid ${colors.error}`,
          borderRadius: '8px',
          padding: '0.75rem',
          marginBottom: '1rem',
          color: colors.error,
        }}>
          {error}
        </div>
      )}

      {/* CSS Grid container - header and content share the same grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '5rem 6rem 1fr 1fr 2rem 1fr 1fr 1fr 3rem 4rem',
      }}>
        {/* Sticky wrapper using subgrid on desktop, block on mobile */}
        <div style={{
          gridColumn: '1 / -1',
          position: 'sticky',
          top: 0,
          zIndex: 49,
          backgroundColor: '#242424',
          borderBottom: '1px solid rgba(255,255,255,0.15)',
          display: isMobile ? 'block' : 'grid',
          gridTemplateColumns: isMobile ? undefined : 'subgrid',
        }}>
          {/* Stats + Button row - spans all columns */}
          <div style={{
            gridColumn: '1 / -1',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '0.5rem 1rem',
            fontSize: '0.85rem',
            paddingTop: '0.5rem',
            paddingBottom: '0.5rem',
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', flex: 1, alignItems: 'center' }}>
              <span style={{ fontWeight: 600 }}>Transfers:</span>
              <span style={{ opacity: 0.6, fontSize: '0.8rem' }}>
                Moving money between accounts and categories within the budget
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
              {!showAddTransfer && (
                <Button
                  actionName="Open Add Transfer Form"
                  onClick={() => setShowAddTransfer(true)}
                  disabled={!canAddTransfer}
                  style={{ fontSize: '0.8rem', padding: '0.4em 0.8em' }}
                >
                  + Add Transfer
                </Button>
              )}
            </div>
          </div>

          {/* Column headers - desktop only */}
          {!isMobile && (
            <>
              <div style={columnHeaderStyle}>Date</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'right' }}>Amount</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'center' }}>From Cat</div>
              <div style={columnHeaderStyle}>From Acct</div>
              <div style={columnHeaderStyle}></div>
              <div style={{ ...columnHeaderStyle, textAlign: 'center' }}>To Cat</div>
              <div style={columnHeaderStyle}>To Acct</div>
              <div style={columnHeaderStyle}>Description</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'center' }}>Clr</div>
              <div style={columnHeaderStyle}></div>
            </>
          )}
        </div>

        {/* Warning messages - span all columns */}
        {!canAddTransfer && (
          <p style={{ gridColumn: '1 / -1', opacity: 0.6, fontSize: '0.9rem', padding: '1rem 0' }}>
            You need at least one account and one category before adding transfers.{' '}
            <Link to="/budget/accounts" style={{ opacity: 1 }}>
              Manage accounts →
            </Link>
          </p>
        )}

        {/* Add Transfer Form - spans all columns */}
        {showAddTransfer && (
          <div style={{ gridColumn: '1 / -1', marginBottom: '1rem' }}>
            <TransferForm
              accounts={activeOnBudgetAccounts}
              accountGroups={accountGroups}
              categories={categories}
              categoryGroups={categoryGroups}
              defaultDate={getDefaultFormDate(currentYear, currentMonthNumber)}
              onSubmit={handleAddTransfer}
              onCancel={() => setShowAddTransfer(false)}
              submitLabel="Add Transfer"
            />
          </div>
        )}

        {/* Transfers List - each row uses display: contents */}
        {currentMonth?.transfers
          ?.slice()
          .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
          .map((transfer, index) => (
            editingTransferId === transfer.id ? (
              <div key={transfer.id} style={{ gridColumn: '1 / -1', padding: '0.5rem' }}>
                <TransferForm
                  accounts={activeOnBudgetAccounts}
                  accountGroups={accountGroups}
                  categories={categories}
                  categoryGroups={categoryGroups}
                  initialData={transfer}
                  onSubmit={(amount, fromAccountId, toAccountId, fromCategoryId, toCategoryId, date, description, cleared) =>
                    handleUpdateTransfer(transfer.id, amount, fromAccountId, toAccountId, fromCategoryId, toCategoryId, date, description, cleared)
                  }
                  onCancel={() => setEditingTransferId(null)}
                  onDelete={() => handleDeleteTransfer(transfer.id)}
                  submitLabel="Save"
                />
              </div>
            ) : (
              <TransferGridRow
                key={transfer.id}
                transfer={transfer}
                fromCategoryName={isNoCategory(transfer.from_category_id) ? NO_CATEGORY_NAME : (categories[transfer.from_category_id]?.name || 'Unknown')}
                toCategoryName={isNoCategory(transfer.to_category_id) ? NO_CATEGORY_NAME : (categories[transfer.to_category_id]?.name || 'Unknown')}
                fromAccountName={isNoAccount(transfer.from_account_id) ? NO_ACCOUNT_NAME : (accounts[transfer.from_account_id]?.nickname || 'Unknown')}
                toAccountName={isNoAccount(transfer.to_account_id) ? NO_ACCOUNT_NAME : (accounts[transfer.to_account_id]?.nickname || 'Unknown')}
                fromAccountGroupName={
                  isNoAccount(transfer.from_account_id) ? undefined : (
                    accounts[transfer.from_account_id]?.account_group_id
                      ? accountGroups[accounts[transfer.from_account_id]!.account_group_id!]?.name
                      : undefined
                  )
                }
                toAccountGroupName={
                  isNoAccount(transfer.to_account_id) ? undefined : (
                    accounts[transfer.to_account_id]?.account_group_id
                      ? accountGroups[accounts[transfer.to_account_id]!.account_group_id!]?.name
                      : undefined
                  )
                }
                isFromCategoryNo={isNoCategory(transfer.from_category_id)}
                isToCategoryNo={isNoCategory(transfer.to_category_id)}
                isFromAccountNo={isNoAccount(transfer.from_account_id)}
                isToAccountNo={isNoAccount(transfer.to_account_id)}
                onEdit={() => {
                  logUserAction('CLICK', 'Edit Transfer', { details: transfer.description || `$${transfer.amount}` })
                  setEditingTransferId(transfer.id)
                }}
                onDelete={() => handleDeleteTransfer(transfer.id)}
                isMobile={isMobile}
                isEvenRow={index % 2 === 0}
              />
            )
          ))}

        {/* Empty state - spans all columns */}
        {(!currentMonth?.transfers || currentMonth.transfers.length === 0) && !showAddTransfer && (
          <p style={{ gridColumn: '1 / -1', opacity: 0.5, fontSize: '0.9rem', textAlign: 'center', padding: '1.5rem' }}>
            No transfers recorded for this month
          </p>
        )}

        {/* Bottom padding */}
        <div style={{ gridColumn: '1 / -1', height: '2rem' }} />
      </div>
    </div>
  )
}

