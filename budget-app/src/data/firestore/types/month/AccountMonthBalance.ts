// Account balance tracking for a month
export interface AccountMonthBalance {
  account_id: string
  start_balance: number // Balance at start of month (end of previous month)
  income: number // Total income deposited to this account this month
  expenses: number // Total expenses from this account this month
  net_change: number // income - expenses
  end_balance: number // start + income - expenses
}

