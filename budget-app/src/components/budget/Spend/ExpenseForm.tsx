import type { ExpenseTransaction, FinancialAccount, AccountGroupsMap, CategoriesMap, CategoryGroup } from '@types'
import { TransactionForm, type AccountEntry, type TransactionFormData } from '../Transaction'

export type ExpenseAccountEntry = [string, FinancialAccount]

interface ExpenseFormProps {
  accounts: ExpenseAccountEntry[]
  accountGroups: AccountGroupsMap
  categories: CategoriesMap
  categoryGroups: CategoryGroup[]
  payees: string[]
  initialData?: ExpenseTransaction
  defaultAccountId?: string
  defaultDate?: string // YYYY-MM-DD format
  onSubmit: (amount: number, categoryId: string, accountId: string, date: string, payee?: string, description?: string, cleared?: boolean) => void
  onCancel: () => void
  onDelete?: () => void // Optional delete handler (shown when editing)
  submitLabel: string
  isMobile?: boolean // kept for API compatibility but handled internally now
}

export function ExpenseForm({
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
}: ExpenseFormProps) {
  function handleSubmit(data: TransactionFormData) {
    onSubmit(
      data.amount,
      data.categoryId!, // Category is required for expenses
      data.accountId,
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
        accountLabel: 'Pay From',
        payeePlaceholder: 'e.g., Grocery Store',
        descriptionPlaceholder: 'e.g., Weekly groceries',
        submitLabel,
      }}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      onDelete={onDelete}
    />
  )
}
