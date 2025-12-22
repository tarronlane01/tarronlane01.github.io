import { useState, useEffect, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useBudget, type BudgetInvite, type IncomeTransaction, type FinancialAccount, type AccountGroup } from '../../contexts/budget_context'
import {
  PageContainer,
  Button,
  ErrorAlert,
  FormWrapper,
  FormField,
  TextInput,
  SelectInput,
  FormButtonGroup,
  CurrencyInput,
  PayeeAutocomplete,
  formatCurrency,
  getBalanceColor,
} from '../../components/ui'
import { navBar, colors, listContainer } from '../../styles/shared'

// Month name helper
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

function Budget() {
  const {
    currentBudget,
    isOwner,
    hasPendingInvites,
    pendingInvites,
    needsFirstBudget,
    acceptBudgetInvite,
    createNewBudget,
    accounts,
    accountGroups,
    currentMonth,
    currentYear,
    currentMonthNumber,
    monthLoading,
    loadMonth,
    goToPreviousMonth,
    goToNextMonth,
    addIncome,
    updateIncome,
    deleteIncome,
    recomputeMonthTotals,
    payees,
    loadPayees,
  } = useBudget()

  const [error, setError] = useState<string | null>(null)
  const [showAddIncome, setShowAddIncome] = useState(false)
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null)
  const [isRecomputing, setIsRecomputing] = useState(false)

  // Load current month when budget is loaded
  useEffect(() => {
    if (currentBudget && !currentMonth && !monthLoading) {
      loadMonth(currentYear, currentMonthNumber).catch(err => {
        setError(err instanceof Error ? err.message : 'Failed to load month')
      })
    }
  }, [currentBudget, currentMonth, monthLoading, currentYear, currentMonthNumber, loadMonth])

  // Load payees when budget is loaded
  useEffect(() => {
    if (currentBudget) {
      loadPayees().catch(err => {
        console.warn('Failed to load payees:', err)
      })
    }
  }, [currentBudget, loadPayees])

  // Helper to get effective is_active value considering group overrides
  function getEffectiveActive(account: FinancialAccount): boolean {
    const group = accountGroups.find(g => g.id === account.account_group_id)
    if (group?.is_active !== undefined) return group.is_active
    return account.is_active !== false
  }

  // Helper to get effective on_budget value considering group overrides
  function getEffectiveOnBudget(account: FinancialAccount): boolean {
    const group = accountGroups.find(g => g.id === account.account_group_id)
    if (group?.on_budget !== undefined) return group.on_budget
    return account.on_budget !== false
  }

  // Filter accounts for income dropdown:
  // 1. Must be active and on-budget (considering group-level overrides)
  // 2. If income accounts are marked, use those; otherwise fall back to all eligible accounts
  const activeOnBudgetAccounts = accounts.filter(a => getEffectiveActive(a) && getEffectiveOnBudget(a))
  const markedIncomeAccounts = activeOnBudgetAccounts.filter(a => a.is_income_account)
  const incomeAccounts = markedIncomeAccounts.length > 0 ? markedIncomeAccounts : activeOnBudgetAccounts
  const defaultIncomeAccount = activeOnBudgetAccounts.find(a => a.is_income_default)

  // If no current budget but there are pending invites, show invite selection
  if (!currentBudget && hasPendingInvites) {
    return (
      <PageContainer>
        <nav style={navBar}>
          <Link to="/">← Back to Home</Link>
        </nav>
        <PendingInvitesScreen
          invites={pendingInvites}
          onAccept={acceptBudgetInvite}
          onCreateNew={createNewBudget}
        />
      </PageContainer>
    )
  }

  // If user needs to create their first budget (no invites, no existing budgets)
  if (!currentBudget && needsFirstBudget) {
    return (
      <PageContainer>
        <nav style={navBar}>
          <Link to="/">← Back to Home</Link>
        </nav>
        <CreateFirstBudgetScreen onCreateNew={createNewBudget} />
      </PageContainer>
    )
  }

  // Handle month navigation
  async function handlePreviousMonth() {
    setError(null)
    try {
      await goToPreviousMonth()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to navigate')
    }
  }

  async function handleNextMonth() {
    setError(null)
    try {
      await goToNextMonth()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to navigate')
    }
  }

  // Handle income operations
  function handleAddIncome(amount: number, accountId: string, date: string, payee?: string, description?: string) {
    setError(null)
    // Close form immediately (optimistic)
    setShowAddIncome(false)
    // Save in background
    addIncome(amount, accountId, date, payee, description).catch(err => {
      setError(err instanceof Error ? err.message : 'Failed to add income')
    })
  }

  function handleUpdateIncome(incomeId: string, amount: number, accountId: string, date: string, payee?: string, description?: string) {
    setError(null)
    // Close form immediately (optimistic)
    setEditingIncomeId(null)
    // Save in background
    updateIncome(incomeId, amount, accountId, date, payee, description).catch(err => {
      setError(err instanceof Error ? err.message : 'Failed to update income')
    })
  }

  async function handleRecompute() {
    setError(null)
    setIsRecomputing(true)
    try {
      await recomputeMonthTotals()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to recompute totals')
    } finally {
      setIsRecomputing(false)
    }
  }

  function handleDeleteIncome(incomeId: string) {
    if (!confirm('Are you sure you want to delete this income entry?')) return
    setError(null)
    // Delete in background (UI updates happen in context)
    deleteIncome(incomeId).catch(err => {
      setError(err instanceof Error ? err.message : 'Failed to delete income')
    })
  }

  // Calculate total income for the month
  const totalMonthlyIncome = currentMonth?.income.reduce((sum, inc) => sum + inc.amount, 0) || 0

  return (
    <PageContainer>
      <nav style={navBar}>
        <Link to="/">← Back to Home</Link>
        <Link
          to="/budget/admin"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '2.5rem',
            height: '2.5rem',
            borderRadius: '8px',
            background: 'color-mix(in srgb, currentColor 8%, transparent)',
            textDecoration: 'none',
            fontSize: '1.25rem',
            transition: 'background 0.15s',
          }}
          title={isOwner ? 'Admin Settings' : 'Budget Settings'}
        >
          ⚙️
        </Link>
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
        <h1 style={{ margin: 0 }}>Budget</h1>
        {currentBudget && (
          <span style={{
            background: `color-mix(in srgb, ${colors.primary} 15%, transparent)`,
            color: colors.primaryLight,
            padding: '0.25rem 0.75rem',
            borderRadius: '6px',
            fontSize: '0.85rem',
            fontWeight: 500,
          }}>
            {currentBudget.name}
          </span>
        )}
      </div>

      {currentBudget && (
        <p style={{ opacity: 0.6, fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          {currentBudget.user_ids.length} user{currentBudget.user_ids.length !== 1 ? 's' : ''} •
          {isOwner ? ' You are the owner' : ' Shared with you'}
        </p>
      )}

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {/* Month Navigation */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        marginBottom: '1.5rem',
        padding: '1rem',
        background: 'color-mix(in srgb, currentColor 5%, transparent)',
        borderRadius: '12px',
      }}>
        <button
          onClick={handlePreviousMonth}
          disabled={monthLoading}
          style={{
            background: 'color-mix(in srgb, currentColor 10%, transparent)',
            border: 'none',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            cursor: monthLoading ? 'not-allowed' : 'pointer',
            fontSize: '1.25rem',
            opacity: monthLoading ? 0.5 : 1,
            transition: 'opacity 0.15s, background 0.15s',
          }}
          title="Previous month"
        >
          ←
        </button>

        <div style={{ textAlign: 'center', minWidth: '180px' }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem' }}>
            {MONTH_NAMES[currentMonthNumber - 1]} {currentYear}
          </h2>
          {monthLoading && (
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', opacity: 0.6 }}>Loading...</p>
          )}
        </div>

        <button
          onClick={handleNextMonth}
          disabled={monthLoading}
          style={{
            background: 'color-mix(in srgb, currentColor 10%, transparent)',
            border: 'none',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            cursor: monthLoading ? 'not-allowed' : 'pointer',
            fontSize: '1.25rem',
            opacity: monthLoading ? 0.5 : 1,
            transition: 'opacity 0.15s, background 0.15s',
          }}
          title="Next month"
        >
          →
        </button>
      </div>

      {/* Income Section */}
      <div style={{
        background: 'color-mix(in srgb, currentColor 5%, transparent)',
        borderRadius: '12px',
        padding: '1.5rem',
        marginBottom: '1.5rem',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid color-mix(in srgb, currentColor 15%, transparent)',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Income</h3>
            <p style={{
              margin: '0.25rem 0 0 0',
              fontSize: '1.25rem',
              fontWeight: 600,
              color: getBalanceColor(totalMonthlyIncome),
            }}>
              {formatCurrency(totalMonthlyIncome)}
            </p>
          </div>
          {!showAddIncome && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <Button onClick={() => setShowAddIncome(true)} disabled={incomeAccounts.length === 0}>
                + Add Income
              </Button>
              <button
                onClick={handleRecompute}
                disabled={isRecomputing || monthLoading}
                style={{
                  background: 'color-mix(in srgb, currentColor 10%, transparent)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.5rem 0.75rem',
                  cursor: isRecomputing || monthLoading ? 'not-allowed' : 'pointer',
                  fontSize: '0.85rem',
                  opacity: isRecomputing || monthLoading ? 0.5 : 1,
                  transition: 'opacity 0.15s, background 0.15s',
                }}
                title="Recompute totals from income transactions"
              >
                {isRecomputing ? '⏳' : '🔄'} Recompute
              </button>
            </div>
          )}
        </div>

        {incomeAccounts.length === 0 && (
          <p style={{ opacity: 0.6, fontSize: '0.9rem', marginBottom: '1rem' }}>
            {accounts.length === 0
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
              defaultAccountId={defaultIncomeAccount?.id}
              defaultDate={`${currentYear}-${String(currentMonthNumber).padStart(2, '0')}-01`}
              onSubmit={(amount, accountId, date, payee, description) => handleAddIncome(amount, accountId, date, payee, description)}
              onCancel={() => setShowAddIncome(false)}
              submitLabel="Add Income"
            />
          </div>
        )}

        {/* Income List - sorted by date */}
        <div style={listContainer}>
          {currentMonth?.income
            .slice() // Create a copy to avoid mutating state
            .sort((a, b) => {
              // Sort by date ascending (earliest first)
              const dateA = a.date || ''
              const dateB = b.date || ''
              return dateA.localeCompare(dateB)
            })
            .map(income => (
            editingIncomeId === income.id ? (
              <IncomeForm
                key={income.id}
                accounts={incomeAccounts}
                accountGroups={accountGroups}
                payees={payees}
                initialData={income}
                onSubmit={(amount, accountId, date, payee, description) => handleUpdateIncome(income.id, amount, accountId, date, payee, description)}
                onCancel={() => setEditingIncomeId(null)}
                submitLabel="Save"
              />
            ) : (
              <IncomeItem
                key={income.id}
                income={income}
                accountName={accounts.find(a => a.id === income.account_id)?.nickname || 'Unknown Account'}
                accountGroupName={accountGroups.find(g => g.id === accounts.find(a => a.id === income.account_id)?.account_group_id)?.name}
                onEdit={() => setEditingIncomeId(income.id)}
                onDelete={() => handleDeleteIncome(income.id)}
              />
            )
          ))}

          {(!currentMonth?.income || currentMonth.income.length === 0) && !showAddIncome && (
            <p style={{ opacity: 0.5, fontSize: '0.9rem', textAlign: 'center', padding: '1rem' }}>
              No income recorded for this month
            </p>
          )}
        </div>
      </div>
    </PageContainer>
  )
}

// Income Form Component
interface IncomeFormProps {
  accounts: FinancialAccount[]
  accountGroups: AccountGroup[]
  payees: string[]
  initialData?: IncomeTransaction
  defaultAccountId?: string
  defaultDate?: string // YYYY-MM-DD format
  onSubmit: (amount: number, accountId: string, date: string, payee?: string, description?: string) => void
  onCancel: () => void
  submitLabel: string
}

function IncomeForm({ accounts, accountGroups, payees, initialData, defaultAccountId, defaultDate, onSubmit, onCancel, submitLabel }: IncomeFormProps) {
  // Default to today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0]
  const [amount, setAmount] = useState(initialData?.amount?.toString() || '')
  const [accountId, setAccountId] = useState(initialData?.account_id || defaultAccountId || accounts[0]?.id || '')
  const [date, setDate] = useState(initialData?.date || defaultDate || today)
  const [payee, setPayee] = useState(initialData?.payee || '')
  const [description, setDescription] = useState(initialData?.description || '')

  // Group accounts by their account group for the dropdown
  const accountsByGroup: Record<string, FinancialAccount[]> = {}
  const ungroupedAccounts: FinancialAccount[] = []

  accounts.forEach(account => {
    if (account.account_group_id) {
      if (!accountsByGroup[account.account_group_id]) {
        accountsByGroup[account.account_group_id] = []
      }
      accountsByGroup[account.account_group_id].push(account)
    } else {
      ungroupedAccounts.push(account)
    }
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) return
    if (!accountId) return
    if (!date) return
    onSubmit(parsedAmount, accountId, date, payee.trim() || undefined, description.trim() || undefined)
  }

  return (
    <FormWrapper onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <FormField label="Amount" htmlFor="income-amount">
          <CurrencyInput
            id="income-amount"
            value={amount}
            onChange={setAmount}
            placeholder="$0.00"
            required
            autoFocus
          />
        </FormField>
        <FormField label="Date" htmlFor="income-date">
          <TextInput
            id="income-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </FormField>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <FormField label="Deposit To" htmlFor="income-account">
          <SelectInput
            id="income-account"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            required
          >
            {/* Render grouped accounts with optgroups */}
            {accountGroups.map(group => {
              const groupAccounts = accountsByGroup[group.id]
              if (!groupAccounts || groupAccounts.length === 0) return null
              return (
                <optgroup key={group.id} label={group.name}>
                  {groupAccounts.map(account => (
                    <option key={account.id} value={account.id}>
                      {account.nickname}
                    </option>
                  ))}
                </optgroup>
              )
            })}
            {/* Ungrouped accounts */}
            {ungroupedAccounts.length > 0 && (
              <optgroup label="Other">
                {ungroupedAccounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.nickname}
                  </option>
                ))}
              </optgroup>
            )}
          </SelectInput>
        </FormField>
        <FormField label="Payee" htmlFor="income-payee">
          <PayeeAutocomplete
            id="income-payee"
            value={payee}
            onChange={setPayee}
            payees={payees}
            placeholder="e.g., Employer, Client name"
          />
        </FormField>
      </div>
      <FormField label="Description (optional)" htmlFor="income-description">
        <TextInput
          id="income-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g., January paycheck, Project bonus"
        />
      </FormField>
      <FormButtonGroup>
        <Button type="submit">{submitLabel}</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
      </FormButtonGroup>
    </FormWrapper>
  )
}

// Income Item Component
interface IncomeItemProps {
  income: IncomeTransaction
  accountName: string
  accountGroupName?: string
  onEdit: () => void
  onDelete: () => void
}

function IncomeItem({ income, accountName, accountGroupName, onEdit, onDelete }: IncomeItemProps) {
  return (
    <div style={{
      background: 'color-mix(in srgb, currentColor 8%, transparent)',
      padding: '1rem 1.25rem',
      borderRadius: '8px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '1rem',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
          {income.date && (
            <span style={{
              fontSize: '0.8rem',
              opacity: 0.6,
              fontFamily: 'monospace',
            }}>
              {new Date(income.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
          <span style={{
            fontSize: '1.15rem',
            fontWeight: 600,
            color: colors.success,
          }}>
            +{formatCurrency(income.amount)}
          </span>
          {income.payee && (
            <span style={{
              fontSize: '0.95rem',
              fontWeight: 500,
            }}>
              {income.payee}
            </span>
          )}
          <span style={{
            fontSize: '0.85rem',
            opacity: 0.7,
            background: 'color-mix(in srgb, currentColor 10%, transparent)',
            padding: '0.15rem 0.5rem',
            borderRadius: '4px',
          }}>
            → {accountGroupName ? `${accountGroupName} / ` : ''}{accountName}
          </span>
        </div>
        {income.description && (
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', opacity: 0.7 }}>
            {income.description}
          </p>
        )}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={onEdit}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            opacity: 0.6,
            fontSize: '0.9rem',
            padding: '0.25rem',
          }}
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
            opacity: 0.6,
            fontSize: '0.9rem',
            padding: '0.25rem',
          }}
          title="Delete"
        >
          🗑️
        </button>
      </div>
    </div>
  )
}

interface CreateFirstBudgetScreenProps {
  onCreateNew: (name?: string) => Promise<void>
}

function CreateFirstBudgetScreen({ onCreateNew }: CreateFirstBudgetScreenProps) {
  const [budgetName, setBudgetName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setIsCreating(true)
    setError(null)

    try {
      await onCreateNew(budgetName.trim() || undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create budget')
      setIsCreating(false)
    }
  }

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '0.5rem' }}>Welcome!</h1>
      <p style={{ opacity: 0.7, marginBottom: '2rem' }}>
        You don't have any budgets yet. Create your first budget to get started.
      </p>

      {error && (
        <div style={{
          background: 'rgba(220, 38, 38, 0.1)',
          border: '1px solid rgba(220, 38, 38, 0.3)',
          color: '#f87171',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#f87171',
              cursor: 'pointer',
              fontSize: '1.2rem',
              padding: '0 0.25rem',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      )}

      <div style={{
        background: 'color-mix(in srgb, #646cff 8%, transparent)',
        border: '1px solid color-mix(in srgb, #646cff 25%, transparent)',
        padding: '2rem',
        borderRadius: '12px',
      }}>
        <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>✨</span> Create Your Budget
        </h2>

        <form onSubmit={handleCreate}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', opacity: 0.8 }}>
              Budget Name
            </label>
            <input
              type="text"
              value={budgetName}
              onChange={(e) => setBudgetName(e.target.value)}
              placeholder="My Budget"
              autoFocus
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: '1px solid color-mix(in srgb, currentColor 25%, transparent)',
                background: 'color-mix(in srgb, currentColor 5%, transparent)',
                fontSize: '1rem',
                color: 'inherit',
                boxSizing: 'border-box',
              }}
            />
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', opacity: 0.5 }}>
              You can always rename this later
            </p>
          </div>

          <button
            type="submit"
            disabled={isCreating}
            style={{
              width: '100%',
              background: colors.primary,
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              cursor: isCreating ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              opacity: isCreating ? 0.7 : 1,
              fontSize: '1rem',
            }}
          >
            {isCreating ? 'Creating...' : 'Create Budget'}
          </button>
        </form>
      </div>

      <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.85rem', opacity: 0.6 }}>
        If someone has invited you to their budget, you can accept the invitation from the budget settings page after creating your account.
      </p>
    </div>
  )
}

interface PendingInvitesScreenProps {
  invites: BudgetInvite[]
  onAccept: (budgetId: string) => Promise<void>
  onCreateNew: (name?: string) => Promise<void>
}

function PendingInvitesScreen({ invites, onAccept, onCreateNew }: PendingInvitesScreenProps) {
  const [isAccepting, setIsAccepting] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [budgetName, setBudgetName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAccept(budgetId: string) {
    setIsAccepting(budgetId)
    setError(null)

    try {
      await onAccept(budgetId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation')
      setIsAccepting(null)
    }
  }

  async function handleCreateNew(e: React.FormEvent) {
    e.preventDefault()
    setIsCreating(true)
    setError(null)

    try {
      await onCreateNew(budgetName.trim() || undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create new budget')
      setIsCreating(false)
    }
  }

  return (
    <div>
      <h1 style={{ marginBottom: '0.5rem' }}>Welcome!</h1>
      <p style={{ opacity: 0.7, marginBottom: '2rem' }}>
        You've been invited to join {invites.length === 1 ? 'a budget' : 'some budgets'}. Choose one to get started!
      </p>

      {error && (
        <div style={{
          background: 'rgba(220, 38, 38, 0.1)',
          border: '1px solid rgba(220, 38, 38, 0.3)',
          color: '#f87171',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#f87171',
              cursor: 'pointer',
              fontSize: '1.2rem',
              padding: '0 0.25rem',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Pending Invitations */}
      <div style={{
        background: 'color-mix(in srgb, #f59e0b 8%, transparent)',
        border: '1px solid color-mix(in srgb, #f59e0b 25%, transparent)',
        padding: '1.5rem',
        borderRadius: '12px',
        marginBottom: '1.5rem',
      }}>
        <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>📨</span> Budget Invitations
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {invites.map((invite) => (
            <div
              key={invite.budgetId}
              style={{
                background: 'color-mix(in srgb, currentColor 8%, transparent)',
                padding: '1rem 1.25rem',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ flex: 1, minWidth: '200px' }}>
                <p style={{ margin: '0 0 0.25rem 0', fontWeight: 600, fontSize: '1.05rem' }}>
                  {invite.budgetName}
                </p>
                {invite.ownerEmail && (
                  <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.6 }}>
                    From: {invite.ownerEmail}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleAccept(invite.budgetId)}
                disabled={isAccepting !== null || isCreating}
                style={{
                  background: '#22c55e',
                  color: 'white',
                  border: 'none',
                  padding: '0.6rem 1.5rem',
                  borderRadius: '8px',
                  cursor: isAccepting !== null || isCreating ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                  opacity: isAccepting !== null || isCreating ? 0.7 : 1,
                  fontSize: '0.9rem',
                }}
              >
                {isAccepting === invite.budgetId ? 'Joining...' : 'Accept & Join'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Create New Budget Option */}
      <div style={{
        background: 'color-mix(in srgb, currentColor 5%, transparent)',
        border: '1px dashed color-mix(in srgb, currentColor 20%, transparent)',
        padding: '1.5rem',
        borderRadius: '12px',
      }}>
        {!showCreateForm ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: '0 0 1rem 0', opacity: 0.7 }}>
              Or start fresh with your own budget
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              disabled={isAccepting !== null}
              style={{
                background: colors.primary,
                color: 'white',
                border: 'none',
                padding: '0.6rem 1.5rem',
                borderRadius: '8px',
                cursor: isAccepting !== null ? 'not-allowed' : 'pointer',
                fontWeight: 500,
                opacity: isAccepting !== null ? 0.7 : 1,
                fontSize: '0.9rem',
              }}
            >
              Create New Budget
            </button>
          </div>
        ) : (
          <form onSubmit={handleCreateNew}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>Create Your Budget</h3>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', opacity: 0.8 }}>
                Budget Name
              </label>
              <input
                type="text"
                value={budgetName}
                onChange={(e) => setBudgetName(e.target.value)}
                placeholder="My Budget"
                autoFocus
                style={{
                  width: '100%',
                  padding: '0.6rem 0.8rem',
                  borderRadius: '6px',
                  border: '1px solid color-mix(in srgb, currentColor 25%, transparent)',
                  background: 'color-mix(in srgb, currentColor 5%, transparent)',
                  fontSize: '0.95rem',
                  color: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="submit"
                disabled={isCreating || isAccepting !== null}
                style={{
                  background: colors.primary,
                  color: 'white',
                  border: 'none',
                  padding: '0.6rem 1.25rem',
                  borderRadius: '6px',
                  cursor: isCreating || isAccepting !== null ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                  opacity: isCreating || isAccepting !== null ? 0.7 : 1,
                  fontSize: '0.9rem',
                }}
              >
                {isCreating ? 'Creating...' : 'Create Budget'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false)
                  setBudgetName('')
                }}
                disabled={isCreating}
                style={{
                  background: 'transparent',
                  color: 'inherit',
                  border: '1px solid color-mix(in srgb, currentColor 30%, transparent)',
                  padding: '0.6rem 1.25rem',
                  borderRadius: '6px',
                  cursor: isCreating ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                  opacity: isCreating ? 0.7 : 0.8,
                  fontSize: '0.9rem',
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default Budget
