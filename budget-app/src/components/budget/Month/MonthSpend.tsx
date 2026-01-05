import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useBudget } from '@contexts'
import { useBudgetData, useBudgetMonth } from '@hooks'
import { useIsMobile } from '@hooks'
import { usePayeesQuery } from '@data'
import type { FinancialAccount } from '@types'
import { Button, formatSignedCurrencyAlways, getBalanceColor } from '../../ui'
import { colors } from '@styles/shared'
import { ExpenseForm } from '../Spend'
import { ExpenseGridRow } from './ExpenseGridRow'
import { logUserAction } from '@utils'
import { isNoCategory, NO_CATEGORY_NAME, isNoAccount, NO_ACCOUNT_NAME } from '@data/constants'

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

export function MonthSpend() {
  const { selectedBudgetId, currentUserId, currentYear, currentMonthNumber, setCurrentYear, setCurrentMonthNumber } = useBudget()
  const { accounts, accountGroups, categories, categoryGroups } = useBudgetData(selectedBudgetId, currentUserId)
  const {
    month: currentMonth,
    isLoading: monthLoading,
    addExpense,
    updateExpense,
    deleteExpense,
  } = useBudgetMonth(selectedBudgetId, currentYear, currentMonthNumber)

  const isMobile = useIsMobile()
  const [error, setError] = useState<string | null>(null)
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)

  // Note: Recalculation is NOT triggered on this tab since it only shows raw transactions.
  // Edits here will mark months for recalculation (via writeMonthData), and recalc
  // will happen when the user navigates to Categories or Accounts tabs.

  // Only fetch payees when a form is open (lazy loading)
  const isFormOpen = showAddExpense || editingExpenseId !== null
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

  // Filter accounts for expense dropdown
  const activeOnBudgetAccounts = Object.entries(accounts).filter(
    ([, a]) => getEffectiveActive(a) && getEffectiveOnBudget(a)
  ) as AccountEntry[]
  const markedOutgoAccounts = activeOnBudgetAccounts.filter(([, a]) => a.is_outgo_account)
  const expenseAccounts = markedOutgoAccounts.length > 0 ? markedOutgoAccounts : activeOnBudgetAccounts
  const defaultOutgoAccountEntry = activeOnBudgetAccounts.find(([, a]) => a.is_outgo_default)
  const defaultOutgoAccountId = defaultOutgoAccountEntry ? defaultOutgoAccountEntry[0] : undefined

  // Calculate total expenses for the month
  const totalMonthlyExpenses = currentMonth?.expenses?.reduce((sum, exp) => sum + exp.amount, 0) || 0

  // Handle expense operations
  function handleAddExpense(amount: number, categoryId: string, accountId: string, date: string, payee?: string, description?: string, cleared?: boolean) {
    setError(null)
    setShowAddExpense(false)

    // Parse the date to determine which month this expense belongs to
    const [expenseYear, expenseMonth] = date.split('-').map(Number)

    addExpense(amount, categoryId, accountId, date, payee, description, cleared)
      .then(() => {
        // Navigate to the target month if different from current view
        if (expenseYear !== currentYear || expenseMonth !== currentMonthNumber) {
          setCurrentYear(expenseYear)
          setCurrentMonthNumber(expenseMonth)
        }
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Failed to add expense')
      })
  }

  function handleUpdateExpense(expenseId: string, amount: number, categoryId: string, accountId: string, date: string, payee?: string, description?: string, cleared?: boolean) {
    setError(null)
    setEditingExpenseId(null)
    updateExpense(expenseId, amount, categoryId, accountId, date, payee, description, cleared).catch(err => {
      setError(err instanceof Error ? err.message : 'Failed to update expense')
    })
  }

  function handleDeleteExpense(expenseId: string) {
    if (!confirm('Are you sure you want to delete this expense?')) return
    setError(null)
    deleteExpense(expenseId).catch(err => {
      setError(err instanceof Error ? err.message : 'Failed to delete expense')
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
        gridTemplateColumns: isMobile ? '1fr' : '5rem 1.5fr 7rem 1fr 6rem 1fr 3rem 4rem',
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
              <span style={{ fontWeight: 600 }}>Expenses:</span>
              <span>
                <span style={{ opacity: 0.6 }}>Total: </span>
                <span style={{ color: getBalanceColor(totalMonthlyExpenses), fontWeight: 600 }}>
                  {formatSignedCurrencyAlways(totalMonthlyExpenses)}
                </span>
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
              {!showAddExpense && (
                <Button
                  actionName="Open Add Expense Form"
                  onClick={() => setShowAddExpense(true)}
                  disabled={expenseAccounts.length === 0 || Object.keys(categories).length === 0}
                  style={{ fontSize: '0.8rem', padding: '0.4em 0.8em' }}
                >
                  + Add Expense
                </Button>
              )}
            </div>
          </div>

          {/* Column headers - desktop only */}
          {!isMobile && (
            <>
              <div style={columnHeaderStyle}>Date</div>
              <div style={columnHeaderStyle}>Payee</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'center' }}>Category</div>
              <div style={columnHeaderStyle}>Account</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'right' }}>Amount</div>
              <div style={columnHeaderStyle}>Description</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'center' }}>Clr</div>
              <div style={columnHeaderStyle}></div>
            </>
          )}
        </div>

        {/* Warning messages - span all columns */}
        {expenseAccounts.length === 0 && (
          <p style={{ gridColumn: '1 / -1', opacity: 0.6, fontSize: '0.9rem', padding: '1rem 0' }}>
            {Object.keys(accounts).length === 0
              ? 'You need to create at least one account before adding expenses.'
              : 'No accounts are set up for expenses. Edit an account and enable "Show in expense list".'
            }{' '}
            <Link to="/budget/accounts" style={{ opacity: 1 }}>
              Manage accounts →
            </Link>
          </p>
        )}

        {Object.keys(categories).length === 0 && (
          <p style={{ gridColumn: '1 / -1', opacity: 0.6, fontSize: '0.9rem', padding: '1rem 0' }}>
            You need to create at least one category before adding expenses.{' '}
            <Link to="/budget/settings/categories" style={{ opacity: 1 }}>
              Create categories →
            </Link>
          </p>
        )}

        {/* Add Expense Form - spans all columns */}
        {showAddExpense && (
          <div style={{ gridColumn: '1 / -1', marginBottom: '1rem' }}>
            <ExpenseForm
              accounts={expenseAccounts}
              accountGroups={accountGroups}
              categories={categories}
              categoryGroups={categoryGroups}
              payees={payees}
              defaultAccountId={defaultOutgoAccountId}
              defaultDate={`${currentYear}-${String(currentMonthNumber).padStart(2, '0')}-01`}
              onSubmit={handleAddExpense}
              onCancel={() => setShowAddExpense(false)}
              submitLabel="Add Expense"
              isMobile={isMobile}
            />
          </div>
        )}

        {/* Expenses List - each row uses display: contents */}
        {currentMonth?.expenses
          ?.slice()
          .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
          .map((expense, index) => (
            editingExpenseId === expense.id ? (
              <div key={expense.id} style={{ gridColumn: '1 / -1', padding: '0.5rem' }}>
                <ExpenseForm
                  accounts={expenseAccounts}
                  accountGroups={accountGroups}
                  categories={categories}
                  categoryGroups={categoryGroups}
                  payees={payees}
                  initialData={expense}
                  onSubmit={(amount, categoryId, accountId, date, payee, description, cleared) =>
                    handleUpdateExpense(expense.id, amount, categoryId, accountId, date, payee, description, cleared)
                  }
                  onCancel={() => setEditingExpenseId(null)}
                  onDelete={() => handleDeleteExpense(expense.id)}
                  submitLabel="Save"
                  isMobile={isMobile}
                />
              </div>
            ) : (
              <ExpenseGridRow
                key={expense.id}
                expense={expense}
                categoryName={isNoCategory(expense.category_id) ? NO_CATEGORY_NAME : (categories[expense.category_id]?.name || 'Unknown Category')}
                accountName={isNoAccount(expense.account_id) ? NO_ACCOUNT_NAME : (accounts[expense.account_id]?.nickname || 'Unknown Account')}
                accountGroupName={
                  isNoAccount(expense.account_id) ? undefined : (
                    accounts[expense.account_id]?.account_group_id
                      ? accountGroups[accounts[expense.account_id]!.account_group_id!]?.name
                      : undefined
                  )
                }
                onEdit={() => {
                  logUserAction('CLICK', 'Edit Expense', { details: expense.payee || `$${expense.amount}` })
                  setEditingExpenseId(expense.id)
                }}
                onDelete={() => handleDeleteExpense(expense.id)}
                isMobile={isMobile}
                isEvenRow={index % 2 === 0}
              />
            )
          ))}

        {/* Empty state - spans all columns */}
        {(!currentMonth?.expenses || currentMonth.expenses.length === 0) && !showAddExpense && (
          <p style={{ gridColumn: '1 / -1', opacity: 0.5, fontSize: '0.9rem', textAlign: 'center', padding: '1.5rem' }}>
            No expenses recorded for this month
          </p>
        )}

        {/* Bottom padding */}
        <div style={{ gridColumn: '1 / -1', height: '2rem' }} />
      </div>
    </div>
  )
}
