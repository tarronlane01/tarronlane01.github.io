import type { AdjustmentTransaction, FinancialAccount, AccountGroupsMap, CategoriesMap, CategoryGroup } from '@types'
import { TransactionForm, type AccountEntry, type TransactionFormData } from '../Transaction'

export type AdjustmentAccountEntry = [string, FinancialAccount]

interface AdjustmentFormProps {
  accounts: AdjustmentAccountEntry[]
  accountGroups: AccountGroupsMap
  categories: CategoriesMap
  categoryGroups: CategoryGroup[]
  payees: string[]
  initialData?: AdjustmentTransaction
  defaultAccountId?: string
  defaultDate?: string // YYYY-MM-DD format
  onSubmit: (amount: number, accountId: string, categoryId: string, date: string, payee?: string, description?: string, cleared?: boolean) => void
  onCancel: () => void
  onDelete?: () => void // Optional delete handler (shown when editing)
  submitLabel: string
}

export function AdjustmentForm({
  accounts,
  accountGroups,
  categories,
  categoryGroups,
  payees,
  initialData,
  defaultAccountId,
  defaultDate,
  onSubmit,
  onCancel,
  onDelete,
  submitLabel,
}: AdjustmentFormProps) {
  function handleSubmit(data: TransactionFormData) {
    onSubmit(
      data.amount,
      data.accountId,
      data.categoryId!, // Required for adjustments
      data.date,
      data.payee,
      data.description,
      data.cleared
    )
  }

  return (
    <TransactionForm
      accounts={accounts as AccountEntry[]}
      accountGroups={accountGroups}
      categories={categories}
      categoryGroups={categoryGroups}
      payees={payees}
      initialData={initialData ? {
        date: initialData.date,
        payee: initialData.payee,
        categoryId: initialData.category_id,
        accountId: initialData.account_id,
        amount: initialData.amount,
        description: initialData.description,
        cleared: initialData.cleared,
      } : undefined}
      defaultAccountId={defaultAccountId}
      defaultDate={defaultDate}
      config={{
        showCategory: true,
        showCleared: true,
        showNoCategoryOption: true,  // Allow No Category for account-only adjustments
        showNoAccountOption: true,   // Allow No Account for category-only adjustments
        showSignToggle: true,        // Allow positive and negative adjustments
        accountLabel: 'Account',
        payeePlaceholder: 'e.g., Bank, Interest source',
        descriptionPlaceholder: 'e.g., Starting balance, Correction',
        submitLabel,
      }}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      onDelete={onDelete}
    />
  )
}


