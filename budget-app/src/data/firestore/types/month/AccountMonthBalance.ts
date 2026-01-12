// Account balance tracking for a month
export interface AccountMonthBalance {
  account_id: string
  start_balance: number // Balance at start of month (end of previous month)
  income: number // Total income deposited to this account this month
  expenses: number // Total expenses from this account (negative = money out, positive = money in)
  transfers: number // Net transfers (positive = money in, negative = money out)
  adjustments: number // Net adjustments (positive = add, negative = subtract)
  net_change: number // income + expenses + transfers + adjustments
  end_balance: number // start + net_change
}

