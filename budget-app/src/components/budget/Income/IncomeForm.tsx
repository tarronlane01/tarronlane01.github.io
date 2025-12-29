import type { IncomeTransaction, FinancialAccount, AccountGroupsMap } from '@types'
import { TransactionForm, type AccountEntry, type TransactionFormData } from '../Transaction'

export type IncomeAccountEntry = [string, FinancialAccount]

interface IncomeFormProps {
  accounts: IncomeAccountEntry[]
  accountGroups: AccountGroupsMap
  payees: string[]
  initialData?: IncomeTransaction
  defaultAccountId?: string
  defaultDate?: string // YYYY-MM-DD format
  onSubmit: (amount: number, accountId: string, date: string, payee?: string, description?: string) => void
  onCancel: () => void
  onDelete?: () => void // Optional delete handler (shown when editing)
  submitLabel: string
  isMobile?: boolean // kept for API compatibility but handled internally now
}

export function IncomeForm({
  accounts,
  accountGroups,
  payees,
  initialData,
  defaultAccountId,
  defaultDate,
  onSubmit,
  onCancel,
  onDelete,
  submitLabel,
}: IncomeFormProps) {
  function handleSubmit(data: TransactionFormData) {
    onSubmit(
      data.amount,
      data.accountId,
      data.date,
      data.payee,
      data.description
    )
  }

  return (
    <TransactionForm
      accounts={accounts as AccountEntry[]}
      accountGroups={accountGroups}
      payees={payees}
      initialData={initialData ? {
        date: initialData.date,
        payee: initialData.payee,
        accountId: initialData.account_id,
        amount: initialData.amount,
        description: initialData.description,
      } : undefined}
      defaultAccountId={defaultAccountId}
      defaultDate={defaultDate}
      config={{
        showCategory: false,
        showCleared: false,
        accountLabel: 'Deposit To',
        payeePlaceholder: 'e.g., Employer, Client name',
        descriptionPlaceholder: 'e.g., January paycheck',
        submitLabel,
      }}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      onDelete={onDelete}
    />
  )
}
