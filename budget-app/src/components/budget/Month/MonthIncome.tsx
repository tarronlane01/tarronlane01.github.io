import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useBudget } from '../../../contexts/budget_context'
import { useBudgetData, useBudgetMonth } from '../../../hooks'
import { useIsMobile } from '../../../hooks/useIsMobile'
import { usePayeesQuery } from '../../../data'
import type { FinancialAccount } from '@types'
import { Button, formatCurrency, getBalanceColor } from '../../ui'
import { colors } from '../../../styles/shared'
import { IncomeForm } from '../Income'
import { IncomeGridRow } from './IncomeGridRow'
import { logUserAction } from '@utils'
import { isNoAccount, NO_ACCOUNT_NAME } from '../../../data/constants'

// Column header style for the grid
const columnHeaderStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  opacity: 0.6,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  paddingTop: '0.5rem',
  paddingBottom: '0.5rem',
  borderTop: '1px solid rgba(255,255,255,0.1)',
}

export function MonthIncome() {
  const { selectedBudgetId, currentUserId, currentYear, currentMonthNumber, setCurrentYear, setCurrentMonthNumber } = useBudget()
  const { accounts, accountGroups } = useBudgetData(selectedBudgetId, currentUserId)
  const {
    month: currentMonth,
    isLoading: monthLoading,
    addIncome,
    updateIncome,
    deleteIncome,
  } = useBudgetMonth(selectedBudgetId, currentYear, currentMonthNumber)

  const isMobile = useIsMobile()
  const [error, setError] = useState<string | null>(null)
  const [showAddIncome, setShowAddIncome] = useState(false)
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null)

  // Only fetch payees when a form is open (lazy loading)
  const isFormOpen = showAddIncome || editingIncomeId !== null
  const payeesQuery = usePayeesQuery(selectedBudgetId, { enabled: isFormOpen })
  const payees = payeesQuery.data || []

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

  // Filter accounts for income dropdown
  const activeOnBudgetAccounts = Object.entries(accounts).filter(
    ([, a]) => getEffectiveActive(a) && getEffectiveOnBudget(a)
  ) as AccountEntry[]
  const markedIncomeAccounts = activeOnBudgetAccounts.filter(([, a]) => a.is_income_account)
  const incomeAccounts = markedIncomeAccounts.length > 0 ? markedIncomeAccounts : activeOnBudgetAccounts
  const defaultIncomeAccountEntry = activeOnBudgetAccounts.find(([, a]) => a.is_income_default)
  const defaultIncomeAccountId = defaultIncomeAccountEntry ? defaultIncomeAccountEntry[0] : undefined

  // Calculate total income for the month
  const totalMonthlyIncome = currentMonth?.income.reduce((sum, inc) => sum + inc.amount, 0) || 0

  // Handle income operations
  function handleAddIncome(amount: number, accountId: string, date: string, payee?: string, description?: string) {
    setError(null)
    setShowAddIncome(false)

    // Parse the date to determine which month this income belongs to
    const [incomeYear, incomeMonth] = date.split('-').map(Number)

    addIncome(amount, accountId, date, payee, description)
      .then(() => {
        // Navigate to the target month if different from current view
        if (incomeYear !== currentYear || incomeMonth !== currentMonthNumber) {
          setCurrentYear(incomeYear)
          setCurrentMonthNumber(incomeMonth)
        }
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Failed to add income')
      })
  }

  function handleUpdateIncome(incomeId: string, amount: number, accountId: string, date: string, payee?: string, description?: string) {
    setError(null)
    setEditingIncomeId(null)
    updateIncome(incomeId, amount, accountId, date, payee, description).catch(err => {
      setError(err instanceof Error ? err.message : 'Failed to update income')
    })
  }

  function handleDeleteIncome(incomeId: string) {
    if (!confirm('Are you sure you want to delete this income entry?')) return
    setError(null)
    deleteIncome(incomeId).catch(err => {
      setError(err instanceof Error ? err.message : 'Failed to delete income')
    })
  }

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
        gridTemplateColumns: isMobile ? '1fr' : '5rem 1.5fr 2fr 7rem 1.5fr 3rem',
      }}>
        {/* Sticky wrapper using subgrid */}
        <div style={{
          gridColumn: '1 / -1',
          position: 'sticky',
          top: 0,
          zIndex: 49,
          backgroundColor: '#242424',
          borderBottom: '1px solid rgba(255,255,255,0.15)',
          display: 'grid',
          gridTemplateColumns: 'subgrid',
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
              <span style={{ fontWeight: 600 }}>Income:</span>
              <span>
                <span style={{ opacity: 0.6 }}>Total: </span>
                <span style={{ color: getBalanceColor(totalMonthlyIncome), fontWeight: 600 }}>{formatCurrency(totalMonthlyIncome)}</span>
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
              {!showAddIncome && (
                <Button actionName="Open Add Income Form" onClick={() => setShowAddIncome(true)} disabled={incomeAccounts.length === 0} style={{ fontSize: '0.8rem', padding: '0.4em 0.8em' }}>
                  + Add Income
                </Button>
              )}
            </div>
          </div>

          {/* Column headers - desktop only */}
          {!isMobile && (
            <>
              <div style={columnHeaderStyle}>Date</div>
              <div style={columnHeaderStyle}>Payee</div>
              <div style={columnHeaderStyle}>Account</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'right' }}>Amount</div>
              <div style={columnHeaderStyle}>Description</div>
              <div style={columnHeaderStyle}></div>
            </>
          )}
        </div>

        {/* Info note about tithing - spans all columns */}
        <div style={{
          gridColumn: '1 / -1',
          fontSize: '0.8rem',
          opacity: 0.55,
          fontStyle: 'italic',
          padding: '0.5rem 0',
        }}>
          💡 All income entries on this page count towards the tithing owed calculation.
        </div>

        {/* Warning messages - span all columns */}
        {incomeAccounts.length === 0 && (
          <p style={{ gridColumn: '1 / -1', opacity: 0.6, fontSize: '0.9rem', padding: '1rem 0' }}>
            {Object.keys(accounts).length === 0
              ? 'You need to create at least one account before adding income.'
              : 'No accounts are set up for income deposits. Edit an account and enable "Show in income deposit list".'
            }{' '}
            <Link to="/budget/accounts" style={{ color: colors.primaryLight }}>
              Manage accounts →
            </Link>
          </p>
        )}

        {/* Add Income Form - spans all columns */}
        {showAddIncome && (
          <div style={{ gridColumn: '1 / -1', marginBottom: '1rem' }}>
            <IncomeForm
              accounts={incomeAccounts}
              accountGroups={accountGroups}
              payees={payees}
              defaultAccountId={defaultIncomeAccountId}
              defaultDate={`${currentYear}-${String(currentMonthNumber).padStart(2, '0')}-01`}
              onSubmit={handleAddIncome}
              onCancel={() => setShowAddIncome(false)}
              submitLabel="Add Income"
              isMobile={isMobile}
            />
          </div>
        )}

        {/* Income List - each row uses display: contents */}
        {currentMonth?.income
          .slice()
          .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
          .map((income, index) => (
            editingIncomeId === income.id ? (
              <div key={income.id} style={{ gridColumn: '1 / -1', padding: '0.5rem' }}>
                <IncomeForm
                  accounts={incomeAccounts}
                  accountGroups={accountGroups}
                  payees={payees}
                  initialData={income}
                  onSubmit={(amount, accountId, date, payee, description) =>
                    handleUpdateIncome(income.id, amount, accountId, date, payee, description)
                  }
                  onCancel={() => setEditingIncomeId(null)}
                  onDelete={() => handleDeleteIncome(income.id)}
                  submitLabel="Save"
                  isMobile={isMobile}
                />
              </div>
            ) : (
              <IncomeGridRow
                key={income.id}
                income={income}
                accountName={isNoAccount(income.account_id) ? NO_ACCOUNT_NAME : (accounts[income.account_id]?.nickname || 'Unknown Account')}
                accountGroupName={
                  isNoAccount(income.account_id) ? undefined : (
                    accounts[income.account_id]?.account_group_id
                      ? accountGroups[accounts[income.account_id]!.account_group_id!]?.name
                      : undefined
                  )
                }
                onEdit={() => {
                  logUserAction('CLICK', 'Edit Income', { details: income.payee || `$${income.amount}` })
                  setEditingIncomeId(income.id)
                }}
                onDelete={() => handleDeleteIncome(income.id)}
                isMobile={isMobile}
                isEvenRow={index % 2 === 0}
              />
            )
          ))}

        {/* Empty state - spans all columns */}
        {(!currentMonth?.income || currentMonth.income.length === 0) && !showAddIncome && (
          <p style={{ gridColumn: '1 / -1', opacity: 0.5, fontSize: '0.9rem', textAlign: 'center', padding: '1.5rem' }}>
            No income recorded for this month
          </p>
        )}

        {/* Bottom padding */}
        <div style={{ gridColumn: '1 / -1', height: '2rem' }} />
      </div>
    </div>
  )
}
