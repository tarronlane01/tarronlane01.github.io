import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useBudget } from '../../../contexts/budget_context'
import { useBudgetData, useBudgetMonth } from '../../../hooks'
import { useIsMobile } from '../../../hooks/useIsMobile'
import { usePayeesQuery } from '../../../data'
import type { FinancialAccount } from '@types'
import { Button, formatCurrency, getBalanceColor, SectionTotalHeader } from '../../ui'
import { colors } from '../../../styles/shared'
import { IncomeForm, IncomeItem, IncomeTableHeader } from '../Income'
import { logUserAction } from '@utils'

export function IncomeSection() {
  const { selectedBudgetId, currentUserId, currentYear, currentMonthNumber } = useBudget()
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
    addIncome(amount, accountId, date, payee, description).catch(err => {
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
        label="Total"
        value={<span style={{ color: getBalanceColor(totalMonthlyIncome) }}>{formatCurrency(totalMonthlyIncome)}</span>}
        action={!showAddIncome && (
          <Button actionName="Open Add Income Form" onClick={() => setShowAddIncome(true)} disabled={incomeAccounts.length === 0}>
            + Add Income
          </Button>
        )}
      />

      {incomeAccounts.length === 0 && (
        <p style={{ opacity: 0.6, fontSize: '0.9rem', marginBottom: '1rem' }}>
          {Object.keys(accounts).length === 0
            ? 'You need to create at least one account before adding income.'
            : 'No accounts are set up for income deposits. Edit an account and enable "Show in income deposit list".'
          }{' '}
          <Link to="/budget/accounts" style={{ color: colors.primaryLight }}>
            Manage accounts →
          </Link>
        </p>
      )}

      {/* Add Income Form */}
      {showAddIncome && (
        <div style={{ marginBottom: '1rem' }}>
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

      {/* Income List - sorted by date */}
      <div style={{
        background: 'color-mix(in srgb, currentColor 3%, transparent)',
        borderRadius: '8px',
        overflow: 'hidden',
        marginBottom: '1rem',
      }}>
        {/* Table header - only show on desktop when there are items */}
        {!isMobile && currentMonth?.income && currentMonth.income.length > 0 && (
          <IncomeTableHeader />
        )}

        {currentMonth?.income
          .slice()
          .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
          .map(income => (
            editingIncomeId === income.id ? (
              <div key={income.id} style={{ padding: '0.5rem' }}>
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
              <IncomeItem
                key={income.id}
                income={income}
                accountName={accounts[income.account_id]?.nickname || 'Unknown Account'}
                accountGroupName={
                  accounts[income.account_id]?.account_group_id
                    ? accountGroups[accounts[income.account_id]!.account_group_id!]?.name
                    : undefined
                }
                onEdit={() => {
                  logUserAction('CLICK', 'Edit Income', { details: income.payee || `$${income.amount}` })
                  setEditingIncomeId(income.id)
                }}
                onDelete={() => handleDeleteIncome(income.id)}
                isMobile={isMobile}
              />
            )
          ))}

        {(!currentMonth?.income || currentMonth.income.length === 0) && !showAddIncome && (
          <p style={{ opacity: 0.5, fontSize: '0.9rem', textAlign: 'center', padding: '1.5rem' }}>
            No income recorded for this month
          </p>
        )}
      </div>
    </div>
  )
}

