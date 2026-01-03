import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useBudget } from '../../../contexts/budget_context'
import { useBudgetData, useBudgetMonth } from '../../../hooks'
import { useIsMobile } from '../../../hooks/useIsMobile'
import { usePayeesQuery } from '../../../data'
import type { FinancialAccount, ExpenseTransaction } from '@types'
import { Button, formatSignedCurrencyAlways, getBalanceColor } from '../../ui'
import { colors } from '../../../styles/shared'
import { ExpenseForm } from '../Spend'
import { logUserAction } from '@utils'
import { isAdjustmentCategory, ADJUSTMENT_CATEGORY_NAME, isNoAccount, NO_ACCOUNT_NAME } from '../../../data/constants'

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
        // Date, Payee, Category, Account, Amount, Description, Cleared, Actions
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
            <Link to="/budget/accounts" style={{ color: colors.primaryLight }}>
              Manage accounts →
            </Link>
          </p>
        )}

        {Object.keys(categories).length === 0 && (
          <p style={{ gridColumn: '1 / -1', opacity: 0.6, fontSize: '0.9rem', padding: '1rem 0' }}>
            You need to create at least one category before adding expenses.{' '}
            <Link to="/budget/settings/categories" style={{ color: colors.primaryLight }}>
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
                categoryName={isAdjustmentCategory(expense.category_id) ? ADJUSTMENT_CATEGORY_NAME : (categories[expense.category_id]?.name || 'Unknown Category')}
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

// =============================================================================
// EXPENSE GRID ROW - renders directly as grid items (display: contents)
// =============================================================================

interface ExpenseGridRowProps {
  expense: ExpenseTransaction
  categoryName: string
  accountName: string
  accountGroupName?: string
  onEdit: () => void
  onDelete: () => void
  isMobile?: boolean
  isEvenRow: boolean
}

function ExpenseGridRow({ expense, categoryName, accountName, accountGroupName, onEdit, onDelete, isMobile, isEvenRow }: ExpenseGridRowProps) {
  const formattedDate = expense.date
    ? new Date(expense.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '—'

  const accountDisplay = accountGroupName ? `${accountGroupName} / ${accountName}` : accountName
  const rowBg = isEvenRow ? 'color-mix(in srgb, currentColor 3%, transparent)' : 'color-mix(in srgb, currentColor 6%, transparent)'

  // Mobile: Card-like view (tappable)
  if (isMobile) {
    return (
      <div
        onClick={onEdit}
        style={{
          gridColumn: '1 / -1',
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: '0.5rem',
          padding: '0.75rem 1rem',
          background: rowBg,
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', opacity: 0.5, fontFamily: 'monospace', minWidth: '3rem' }}>
              {formattedDate}
            </span>
            <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>
              {expense.payee || '—'}
            </span>
            {expense.cleared && (
              <span style={{ fontSize: '0.7rem', color: colors.success }} title="Cleared">
                ✓
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '0.7rem',
              background: `color-mix(in srgb, ${colors.primary} 20%, transparent)`,
              color: colors.primaryLight,
              padding: '0.1rem 0.4rem',
              borderRadius: '3px',
            }}>
              {categoryName}
            </span>
            <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>
              ← {accountDisplay}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, color: getBalanceColor(expense.amount), fontFamily: 'monospace' }}>
            {formatSignedCurrencyAlways(expense.amount)}
          </span>
        </div>
      </div>
    )
  }

  // Desktop: Grid row using display: contents
  const cellStyle: React.CSSProperties = {
    padding: '0.6rem 0.25rem',
    background: rowBg,
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.9rem',
  }

  return (
    <div style={{ display: 'contents' }}>
      {/* Date */}
      <div style={{ ...cellStyle, fontSize: '0.85rem', opacity: 0.6, fontFamily: 'monospace' }}>
        {formattedDate}
      </div>

      {/* Payee */}
      <div style={{ ...cellStyle, fontWeight: 500, overflow: 'hidden' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {expense.payee || '—'}
        </span>
      </div>

      {/* Category */}
      <div style={{ ...cellStyle, justifyContent: 'center' }}>
        <span style={{
          fontSize: '0.8rem',
          background: `color-mix(in srgb, ${colors.primary} 15%, transparent)`,
          color: colors.primaryLight,
          padding: '0.2rem 0.5rem',
          borderRadius: '4px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {categoryName}
        </span>
      </div>

      {/* Account */}
      <div style={{ ...cellStyle, opacity: 0.7, overflow: 'hidden' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
          {accountDisplay}
        </span>
      </div>

      {/* Amount */}
      <div style={{ ...cellStyle, justifyContent: 'flex-end', fontWeight: 600, color: getBalanceColor(expense.amount), fontFamily: 'monospace' }}>
        {formatSignedCurrencyAlways(expense.amount)}
      </div>

      {/* Description */}
      <div style={{ ...cellStyle, paddingLeft: '0.5rem', opacity: 0.6, overflow: 'hidden' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
          {expense.description || '—'}
        </span>
      </div>

      {/* Cleared */}
      <div style={{
        ...cellStyle,
        justifyContent: 'center',
        color: expense.cleared ? colors.success : 'inherit',
        opacity: expense.cleared ? 1 : 0.3,
        fontSize: '1rem',
      }}>
        {expense.cleared ? '✓' : '○'}
      </div>

      {/* Actions */}
      <div style={{ ...cellStyle, justifyContent: 'flex-end', gap: '0.25rem' }}>
        <button
          onClick={onEdit}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            opacity: 0.5,
            fontSize: '0.85rem',
            padding: '0.25rem',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.5'}
          title="Edit"
        >
          ✏️
        </button>
        <button
          onClick={onDelete}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            opacity: 0.5,
            fontSize: '0.85rem',
            padding: '0.25rem',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.5'}
          title="Delete"
        >
          🗑️
        </button>
      </div>
    </div>
  )
}

