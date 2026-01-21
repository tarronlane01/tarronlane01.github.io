import { useState } from 'react'
import { useBudget } from '@contexts'
import { useBudgetData, useMonthData } from '@hooks'
import { useIsMobile } from '@hooks'
import { usePayeesQuery } from '@data'
import { useAddExpense, useUpdateExpense, useDeleteExpense } from '@data/mutations/month'
import type { FinancialAccount } from '@types'
import { Button, formatSignedCurrencyAlways, getBalanceColor, PrerequisiteWarning } from '../../ui'
import { colors } from '@styles/shared'
import { ExpenseForm } from '../Spend'
import { ExpenseGridRow } from './ExpenseGridRow'
import { logUserAction, getDefaultFormDate, parseDateToYearMonth } from '@utils'
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

export function MonthSpend() {
  const { selectedBudgetId, currentYear, currentMonthNumber, setCurrentYear, setCurrentMonthNumber } = useBudget()
  const { accounts, accountGroups, categories, categoryGroups } = useBudgetData()
  const { month: currentMonth, isLoading: monthLoading } = useMonthData(selectedBudgetId, currentYear, currentMonthNumber)

  // Expense mutations - imported directly
  const { addExpense } = useAddExpense()
  const { updateExpense } = useUpdateExpense()
  const { deleteExpense } = useDeleteExpense()

  const isMobile = useIsMobile()
  const [error, setError] = useState<string | null>(null)
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)

  // Note: Recalculation is NOT triggered on this tab since it only shows raw transactions.
  // Edits here will update the month_map (via writeMonthData) and trigger recalculation
  // will happen when the user navigates to Categories or Accounts tabs.

  // Only fetch payees when a form is open (lazy loading)
  const isFormOpen = showAddExpense || editingExpenseId !== null
  const payeesQuery = usePayeesQuery(selectedBudgetId, { enabled: isFormOpen })
  const payees = payeesQuery.data || []

  // Helper to get effective is_active value considering group overrides
  function getEffectiveActive(account: FinancialAccount): boolean {
    const group = account.account_group_id ? accountGroups[account.account_group_id] : undefined
    if (group && group.is_active !== null) return group.is_active
    return account.is_active !== false
  }

  // Helper to get effective on_budget value considering group overrides
  function getEffectiveOnBudget(account: FinancialAccount): boolean {
    const group = account.account_group_id ? accountGroups[account.account_group_id] : undefined
    if (group && group.on_budget !== null) return group.on_budget
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
  // Note: Mutations handle optimistic cache updates internally
  function handleAddExpense(amount: number, categoryId: string, accountId: string, date: string, payee?: string, description?: string, cleared?: boolean) {
    if (!selectedBudgetId) return
    setError(null)
    setShowAddExpense(false) // Close form immediately - mutation handles optimistic update

    // Parse the date to determine which month this expense belongs to
    const { year: expenseYear, month: expenseMonth } = parseDateToYearMonth(date)

    // Navigate to target month if different
    if (expenseYear !== currentYear || expenseMonth !== currentMonthNumber) {
      setCurrentYear(expenseYear)
      setCurrentMonthNumber(expenseMonth)
    }

    // Call mutation directly with explicit params
    addExpense(selectedBudgetId, expenseYear, expenseMonth, amount, categoryId, accountId, date, payee, description, cleared)
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Failed to add expense')
      })
  }

  function handleUpdateExpense(expenseId: string, amount: number, categoryId: string, accountId: string, date: string, payee?: string, description?: string, cleared?: boolean) {
    if (!selectedBudgetId) return
    setError(null)
    setEditingExpenseId(null) // Close form immediately - mutation handles optimistic update

    // Call mutation directly with explicit params
    updateExpense(selectedBudgetId, currentYear, currentMonthNumber, expenseId, amount, categoryId, accountId, date, payee, description, cleared)
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Failed to update expense')
      })
  }

  function handleDeleteExpense(expenseId: string) {
    if (!selectedBudgetId) return
    if (!confirm('Are you sure you want to delete this expense?')) return
    setError(null)

    // Call mutation directly with explicit params
    deleteExpense(selectedBudgetId, currentYear, currentMonthNumber, expenseId).catch(err => {
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
              <span style={{ fontWeight: 600 }}>Expenses:</span>
              <span style={{ opacity: 0.6, fontSize: '0.8rem' }}>
                Transactions that should be factored into spend calculations
              </span>
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
                  disabledReason={
                    expenseAccounts.length === 0 && Object.keys(categories).length === 0
                      ? "Create accounts and categories first"
                      : expenseAccounts.length === 0
                        ? "Create an expense account first"
                        : "Create a category first"
                  }
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
          <PrerequisiteWarning
            message={
              Object.keys(accounts).length === 0
                ? 'You need to create at least one account before adding expenses.'
                : 'No accounts are set up for expenses. Edit an account and enable "Show in expense list".'
            }
            linkText="Manage accounts"
            linkTo="/budget/settings/accounts"
          />
        )}

        {Object.keys(categories).length === 0 && (
          <PrerequisiteWarning
            message="You need to create at least one category before adding expenses."
            linkText="Create categories"
            linkTo="/budget/settings/categories"
          />
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
              defaultDate={getDefaultFormDate(currentYear, currentMonthNumber)}
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
