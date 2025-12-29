// Category balance tracking for a month (stored with allocations)
export interface CategoryMonthBalance {
  category_id: string
  start_balance: number // Balance at start of month (end of previous month)
  allocated: number // Allocations this month
  spent: number // Total spend this month
  end_balance: number // start + allocated - spent
}

