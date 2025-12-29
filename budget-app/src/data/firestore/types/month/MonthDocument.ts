import type { IncomeTransaction } from './IncomeTransaction'
import type { ExpenseTransaction } from './ExpenseTransaction'
import type { CategoryMonthBalance } from './CategoryMonthBalance'
import type { AccountMonthBalance } from './AccountMonthBalance'

export interface MonthDocument {

  budget_id: string

  // Example: "202502" so we can get all future months
  // easily without having to do any fancy logic
  year_month_ordinal: string
  year: number
  month: number

  income: IncomeTransaction[]
  total_income: number
  previous_month_income: number

  expenses: ExpenseTransaction[]
  total_expenses: number

  account_balances: AccountMonthBalance[]
  category_balances: CategoryMonthBalance[]
  are_allocations_finalized: boolean

  is_needs_recalculation: boolean
  created_at: string
  updated_at: string
}

