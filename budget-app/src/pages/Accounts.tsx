import { Link } from 'react-router-dom'
import { useState, useEffect, type FormEvent } from 'react'
import { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import app from '../firebase'
import useFirebaseAuth from '../hooks/useFirebaseAuth'

type AccountType = 'checking' | 'savings' | 'credit_card'

interface FinancialAccount {
  id: string
  nickname: string
  balance: number
  account_type: AccountType
  user_id: string
}

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
  const firebase_auth_hook = useFirebaseAuth()
  const [accounts, setAccounts] = useState<FinancialAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)

  const db = getFirestore(app)
  const current_user = firebase_auth_hook.get_current_firebase_user()

  useEffect(() => {
    if (!current_user) {
      setLoading(false)
      return
    }

    loadAccounts()
  }, [current_user?.uid])

  async function loadAccounts() {
    if (!current_user) return

    setLoading(true)
    setError(null)

    try {
      const accountsRef = collection(db, 'accounts')
      const q = query(accountsRef, where('user_id', '==', current_user.uid))
      const querySnapshot = await getDocs(q)

      const loadedAccounts: FinancialAccount[] = []
      querySnapshot.forEach((doc) => {
        loadedAccounts.push({
          id: doc.id,
          ...doc.data(),
        } as FinancialAccount)
      })

      setAccounts(loadedAccounts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(formData: AccountFormData) {
    if (!current_user) return

    try {
      const accountsRef = collection(db, 'accounts')
      await addDoc(accountsRef, {
        nickname: formData.nickname,
        balance: parseFloat(formData.balance) || 0,
        account_type: formData.account_type,
        user_id: current_user.uid,
      })
      setShowCreateForm(false)
      await loadAccounts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account')
    }
  }

  async function handleUpdate(accountId: string, formData: AccountFormData) {
    try {
      const accountRef = doc(db, 'accounts', accountId)
      await updateDoc(accountRef, {
        nickname: formData.nickname,
        balance: parseFloat(formData.balance) || 0,
        account_type: formData.account_type,
      })
      setEditingId(null)
      await loadAccounts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update account')
    }
  }

  async function handleDelete(accountId: string) {
    if (!confirm('Are you sure you want to delete this account?')) return

    try {
      const accountRef = doc(db, 'accounts', accountId)
      await deleteDoc(accountRef)
      await loadAccounts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account')
    }
  }

  const totalBalance = accounts.reduce((sum, acc) => {
    // Credit card balances are typically debts, so we might want to subtract them
    // But for simplicity, we'll just sum all balances as entered
    return sum + acc.balance
  }, 0)

  return (
    <div style={{ maxWidth: '60rem', margin: '0 auto', padding: '2rem' }}>
      <nav style={{ marginBottom: '1.5rem' }}>
        <Link to="/budget">← Back to Budget</Link>
      </nav>

      <h1>Accounts</h1>

      {error && (
        <div style={{
          background: 'rgba(220, 38, 38, 0.1)',
          border: '1px solid rgba(220, 38, 38, 0.3)',
          color: '#f87171',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          marginBottom: '1rem',
        }}>
          {error}
        </div>
      )}

      {loading ? (
        <p>Loading accounts...</p>
      ) : (
        <>
          {/* Summary */}
          <div style={{
            background: 'color-mix(in srgb, currentColor 5%, transparent)',
            padding: '1rem 1.5rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
          }}>
            <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.7 }}>Total Balance</p>
            <p style={{
              margin: '0.25rem 0 0 0',
              fontSize: '1.75rem',
              fontWeight: 600,
              color: totalBalance >= 0 ? '#4ade80' : '#f87171',
            }}>
              ${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          {/* Account List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
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
                <AccountCard
                  key={account.id}
                  account={account}
                  onEdit={() => setEditingId(account.id)}
                  onDelete={() => handleDelete(account.id)}
                />
              )
            ))}
          </div>

          {/* Create Form */}
          {showCreateForm ? (
            <AccountForm
              onSubmit={handleCreate}
              onCancel={() => setShowCreateForm(false)}
              submitLabel="Create Account"
            />
          ) : (
            <button
              onClick={() => setShowCreateForm(true)}
              style={{
                background: '#646cff',
                color: 'white',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              + Add Account
            </button>
          )}
        </>
      )}
    </div>
  )
}

interface AccountCardProps {
  account: FinancialAccount
  onEdit: () => void
  onDelete: () => void
}

function AccountCard({ account, onEdit, onDelete }: AccountCardProps) {
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontWeight: 500, fontSize: '1.1rem' }}>{account.nickname}</span>
          <span style={{
            background: 'color-mix(in srgb, currentColor 15%, transparent)',
            padding: '0.2rem 0.6rem',
            borderRadius: '4px',
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            {ACCOUNT_TYPE_LABELS[account.account_type]}
          </span>
        </div>
        <p style={{
          margin: '0.5rem 0 0 0',
          fontSize: '1.25rem',
          fontWeight: 600,
          color: account.balance >= 0 ? '#4ade80' : '#f87171',
        }}>
          ${account.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={onEdit}
          style={{
            background: 'transparent',
            border: '1px solid color-mix(in srgb, currentColor 30%, transparent)',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          style={{
            background: 'transparent',
            border: '1px solid rgba(220, 38, 38, 0.4)',
            color: '#f87171',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          Delete
        </button>
      </div>
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
    <form
      onSubmit={handleSubmit}
      style={{
        background: 'color-mix(in srgb, currentColor 8%, transparent)',
        padding: '1.25rem',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label htmlFor="nickname" style={{ fontSize: '0.9rem', fontWeight: 500 }}>
          Account Nickname
        </label>
        <input
          id="nickname"
          type="text"
          value={formData.nickname}
          onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
          placeholder="e.g., Main Checking"
          required
          style={{
            padding: '0.6rem 0.8rem',
            borderRadius: '6px',
            border: '1px solid color-mix(in srgb, currentColor 20%, transparent)',
            background: 'color-mix(in srgb, currentColor 5%, transparent)',
            fontSize: '1rem',
            color: 'inherit',
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label htmlFor="balance" style={{ fontSize: '0.9rem', fontWeight: 500 }}>
          Balance ($)
        </label>
        <input
          id="balance"
          type="number"
          step="0.01"
          value={formData.balance}
          onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
          placeholder="0.00"
          style={{
            padding: '0.6rem 0.8rem',
            borderRadius: '6px',
            border: '1px solid color-mix(in srgb, currentColor 20%, transparent)',
            background: 'color-mix(in srgb, currentColor 5%, transparent)',
            fontSize: '1rem',
            color: 'inherit',
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label htmlFor="account_type" style={{ fontSize: '0.9rem', fontWeight: 500 }}>
          Account Type
        </label>
        <select
          id="account_type"
          value={formData.account_type}
          onChange={(e) => setFormData({ ...formData, account_type: e.target.value as AccountType })}
          style={{
            padding: '0.6rem 0.8rem',
            borderRadius: '6px',
            border: '1px solid color-mix(in srgb, currentColor 20%, transparent)',
            background: 'color-mix(in srgb, currentColor 5%, transparent)',
            fontSize: '1rem',
            color: 'inherit',
            cursor: 'pointer',
          }}
        >
          <option value="checking">Checking</option>
          <option value="savings">Savings</option>
          <option value="credit_card">Credit Card</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            background: '#646cff',
            color: 'white',
            border: 'none',
            padding: '0.6rem 1.25rem',
            borderRadius: '6px',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            fontWeight: 500,
            opacity: isSubmitting ? 0.7 : 1,
          }}
        >
          {isSubmitting ? 'Saving...' : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            background: 'transparent',
            border: '1px solid color-mix(in srgb, currentColor 30%, transparent)',
            padding: '0.6rem 1.25rem',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

export default Accounts

