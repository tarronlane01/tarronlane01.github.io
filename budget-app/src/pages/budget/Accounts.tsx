import { useState, type FormEvent, type DragEvent } from 'react'
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore'
import app from '../../firebase'
import { useBudget, type FinancialAccount, type AccountType } from '../../contexts/budget_context'
import {
  ErrorAlert,
  Button,
  DraggableCard,
  DropZone,
  StatCard,
  StatItem,
  FormWrapper,
  FormField,
  TextInput,
  NumberInput,
  SelectInput,
  FormButtonGroup,
  formatCurrency,
  getBalanceColor,
} from '../../components/ui'
import { pageSubtitle, listContainer, itemTitle, badge } from '../../styles/shared'

interface AccountFormData {
  nickname: string
  balance: string
  account_type: AccountType
}

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: 'Checking',
  savings: 'Savings',
  credit_card: 'Credit Card',
}

function Accounts() {
  const { currentBudget, accounts, setAccounts } = useBudget()
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const db = getFirestore(app)

  async function saveAccounts(newAccounts: FinancialAccount[]) {
    if (!currentBudget) return

    try {
      const budgetDocRef = doc(db, 'budgets', currentBudget.id)
      const budgetDoc = await getDoc(budgetDocRef)

      if (budgetDoc.exists()) {
        const data = budgetDoc.data()
        await setDoc(budgetDocRef, {
          ...data,
          accounts: newAccounts,
        })
      }
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to save accounts')
    }
  }

  async function handleCreate(formData: AccountFormData) {
    if (!currentBudget) return

    try {
      const maxSortOrder = accounts.length > 0
        ? Math.max(...accounts.map(a => a.sort_order))
        : -1

      const newAccount: FinancialAccount = {
        id: `account_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        nickname: formData.nickname,
        balance: parseFloat(formData.balance) || 0,
        account_type: formData.account_type,
        sort_order: maxSortOrder + 1,
      }

      const newAccounts = [...accounts, newAccount]
      setAccounts(newAccounts)
      await saveAccounts(newAccounts)
      setShowCreateForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account')
    }
  }

  async function handleUpdate(accountId: string, formData: AccountFormData) {
    if (!currentBudget) return

    try {
      const newAccounts = accounts.map(account =>
        account.id === accountId
          ? {
              ...account,
              nickname: formData.nickname,
              balance: parseFloat(formData.balance) || 0,
              account_type: formData.account_type,
            }
          : account
      )

      setAccounts(newAccounts)
      await saveAccounts(newAccounts)
      setEditingId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update account')
    }
  }

  async function handleDelete(accountId: string) {
    if (!confirm('Are you sure you want to delete this account?')) return
    if (!currentBudget) return

    try {
      const newAccounts = accounts.filter(account => account.id !== accountId)
      setAccounts(newAccounts)
      await saveAccounts(newAccounts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account')
    }
  }

  function handleDragStart(e: DragEvent, accountId: string) {
    setDraggedId(accountId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: DragEvent, accountId: string) {
    e.preventDefault()
    if (accountId !== draggedId) {
      setDragOverId(accountId)
    }
  }

  function handleDragLeave() {
    setDragOverId(null)
  }

  function handleDragEnd() {
    setDraggedId(null)
    setDragOverId(null)
  }

  async function handleDrop(e: DragEvent, targetId: string) {
    e.preventDefault()
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null)
      setDragOverId(null)
      return
    }

    const draggedIndex = accounts.findIndex(a => a.id === draggedId)
    const newAccounts = [...accounts]
    const [draggedItem] = newAccounts.splice(draggedIndex, 1)

    if (targetId === '__end__') {
      newAccounts.push(draggedItem)
    } else {
      const targetIndex = newAccounts.findIndex(a => a.id === targetId)
      newAccounts.splice(targetIndex, 0, draggedItem)
    }

    const updatedAccounts = newAccounts.map((account, index) => ({
      ...account,
      sort_order: index,
    }))

    setAccounts(updatedAccounts)
    setDraggedId(null)
    setDragOverId(null)

    if (!currentBudget) return

    try {
      await saveAccounts(updatedAccounts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save new order')
    }
  }

  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0)

  if (!currentBudget) {
    return <p>No budget found. Please log in.</p>
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Accounts</h2>
      <p style={{ ...pageSubtitle, fontSize: '0.9rem' }}>
        Drag and drop to reorder.
      </p>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      <StatCard>
        <StatItem
          label="Total Balance"
          value={formatCurrency(totalBalance)}
          valueColor={getBalanceColor(totalBalance)}
        />
      </StatCard>

      <div style={listContainer}>
        {accounts.length === 0 && !showCreateForm && (
          <p style={{ opacity: 0.7 }}>No accounts yet. Create one to get started!</p>
        )}

        {accounts.map((account) => (
          editingId === account.id ? (
            <AccountForm
              key={account.id}
              initialData={{
                nickname: account.nickname,
                balance: account.balance.toString(),
                account_type: account.account_type,
              }}
              onSubmit={(data) => handleUpdate(account.id, data)}
              onCancel={() => setEditingId(null)}
              submitLabel="Save Changes"
            />
          ) : (
            <DraggableCard
              key={account.id}
              isDragging={draggedId === account.id}
              isDragOver={dragOverId === account.id}
              onDragStart={(e) => handleDragStart(e, account.id)}
              onDragOver={(e) => handleDragOver(e, account.id)}
              onDragLeave={handleDragLeave}
              onDragEnd={handleDragEnd}
              onDrop={(e) => handleDrop(e, account.id)}
              onEdit={() => setEditingId(account.id)}
              onDelete={() => handleDelete(account.id)}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={itemTitle}>{account.nickname}</span>
                  <span style={badge}>{ACCOUNT_TYPE_LABELS[account.account_type]}</span>
                </div>
                <p style={{
                  margin: '0.5rem 0 0 0',
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  color: getBalanceColor(account.balance),
                }}>
                  {formatCurrency(account.balance)}
                </p>
              </div>
            </DraggableCard>
          )
        ))}

        {draggedId && accounts.length > 0 && (
          <DropZone
            isActive={dragOverId === '__end__'}
            onDragOver={(e) => handleDragOver(e, '__end__')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, '__end__')}
          />
        )}
      </div>

      {showCreateForm ? (
        <AccountForm
          onSubmit={handleCreate}
          onCancel={() => setShowCreateForm(false)}
          submitLabel="Create Account"
        />
      ) : (
        <Button variant="primary-large" onClick={() => setShowCreateForm(true)}>
          + Add Account
        </Button>
      )}
    </div>
  )
}

interface AccountFormProps {
  initialData?: AccountFormData
  onSubmit: (data: AccountFormData) => void
  onCancel: () => void
  submitLabel: string
}

function AccountForm({ initialData, onSubmit, onCancel, submitLabel }: AccountFormProps) {
  const [formData, setFormData] = useState<AccountFormData>(
    initialData || {
      nickname: '',
      balance: '',
      account_type: 'checking',
    }
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!formData.nickname.trim()) return

    setIsSubmitting(true)
    onSubmit(formData)
  }

  return (
    <FormWrapper onSubmit={handleSubmit}>
      <FormField label="Account Nickname" htmlFor="nickname">
        <TextInput
          id="nickname"
          type="text"
          value={formData.nickname}
          onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
          placeholder="e.g., Main Checking"
          required
          autoFocus
        />
      </FormField>

      <FormField label="Balance ($)" htmlFor="balance">
        <NumberInput
          id="balance"
          value={formData.balance}
          onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
          placeholder="0.00"
        />
      </FormField>

      <FormField label="Account Type" htmlFor="account_type">
        <SelectInput
          id="account_type"
          value={formData.account_type}
          onChange={(e) => setFormData({ ...formData, account_type: e.target.value as AccountType })}
        >
          <option value="checking">Checking</option>
          <option value="savings">Savings</option>
          <option value="credit_card">Credit Card</option>
        </SelectInput>
      </FormField>

      <FormButtonGroup>
        <Button type="submit" isLoading={isSubmitting}>
          {submitLabel}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </FormButtonGroup>
    </FormWrapper>
  )
}

export default Accounts
