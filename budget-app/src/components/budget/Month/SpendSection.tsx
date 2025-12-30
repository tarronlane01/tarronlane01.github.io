import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useBudget } from '../../../contexts/budget_context'
import { useBudgetData, useBudgetMonth } from '../../../hooks'
import { useIsMobile } from '../../../hooks/useIsMobile'
import { usePayeesQuery } from '../../../data'
import type { FinancialAccount } from '@types'
import { Button, formatCurrency, SectionTotalHeader } from '../../ui'
import { colors } from '../../../styles/shared'
import { ExpenseForm, ExpenseItem, ExpenseTableHeader } from '../Spend'
import { logUserAction } from '@utils'

export function SpendSection() {
  const { selectedBudgetId, currentUserId, currentYear, currentMonthNumber } = useBudget()
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
    addExpense(amount, categoryId, accountId, date, payee, description, cleared).catch(err => {
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
      background: 'color-mix(in srgb, currentColor 5%, transparent)',
      borderRadius: '12px',
      padding: '1.5rem',
      marginBottom: '1.5rem',
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

      <SectionTotalHeader
        label="Total Expenses"
        value={
          <span style={{ color: totalMonthlyExpenses > 0 ? colors.error : 'inherit' }}>
            {totalMonthlyExpenses > 0 ? '-' : ''}{formatCurrency(totalMonthlyExpenses)}
          </span>
        }
        action={!showAddExpense && (
          <Button
            actionName="Open Add Expense Form"
            onClick={() => setShowAddExpense(true)}
            disabled={expenseAccounts.length === 0 || Object.keys(categories).length === 0}
          >
            + Add Expense
          </Button>
        )}
      />

      {expenseAccounts.length === 0 && (
        <p style={{ opacity: 0.6, fontSize: '0.9rem', marginBottom: '1rem' }}>
          {Object.keys(accounts).length === 0
            ? 'You need to create at least one account before adding expenses.'
            : 'No accounts are set up for expenses. Edit an account and enable "Show in expense list".'
          }{' '}
          <Link to="/budget/accounts" style={{ color: colors.primaryLight }}>
            Manage accounts →
          </Link>
        </p>
      )}

      {Object.keys(categories).length === 0 && (
        <p style={{ opacity: 0.6, fontSize: '0.9rem', marginBottom: '1rem' }}>
          You need to create at least one category before adding expenses.{' '}
          <Link to="/budget/settings/categories" style={{ color: colors.primaryLight }}>
            Create categories →
          </Link>
        </p>
      )}

      {/* Add Expense Form */}
      {showAddExpense && (
        <div style={{ marginBottom: '1rem' }}>
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

      {/* Expenses List - sorted by date */}
      <div style={{
        background: 'color-mix(in srgb, currentColor 3%, transparent)',
        borderRadius: '8px',
        overflow: 'hidden',
        marginBottom: '1rem',
      }}>
        {/* Table header - only show on desktop when there are items */}
        {!isMobile && currentMonth?.expenses && currentMonth.expenses.length > 0 && (
          <ExpenseTableHeader />
        )}

        {currentMonth?.expenses
          ?.slice()
          .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
          .map(expense => (
            editingExpenseId === expense.id ? (
              <div key={expense.id} style={{ padding: '0.5rem' }}>
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
              <ExpenseItem
                key={expense.id}
                expense={expense}
                categoryName={categories[expense.category_id]?.name || 'Unknown Category'}
                accountName={accounts[expense.account_id]?.nickname || 'Unknown Account'}
                accountGroupName={
                  accounts[expense.account_id]?.account_group_id
                    ? accountGroups[accounts[expense.account_id]!.account_group_id!]?.name
                    : undefined
                }
                onEdit={() => {
                  logUserAction('CLICK', 'Edit Expense', { details: expense.payee || `$${expense.amount}` })
                  setEditingExpenseId(expense.id)
                }}
                onDelete={() => handleDeleteExpense(expense.id)}
                isMobile={isMobile}
              />
            )
          ))}

        {(!currentMonth?.expenses || currentMonth.expenses.length === 0) && !showAddExpense && (
          <p style={{ opacity: 0.5, fontSize: '0.9rem', textAlign: 'center', padding: '1.5rem' }}>
            No expenses recorded for this month
          </p>
        )}
      </div>
    </div>
  )
}

