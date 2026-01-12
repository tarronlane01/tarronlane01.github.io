// Category balance tracking for a month (stored with allocations)
export interface CategoryMonthBalance {
  category_id: string
  start_balance: number // Balance at start of month (end of previous month)
  allocated: number // Allocations this month
  spent: number // Total spend this month (negative = money out, positive = money in)
  transfers: number // Net transfers (positive = money in, negative = money out)
  adjustments: number // Net adjustments (positive = add, negative = subtract)
  end_balance: number // start + allocated + spent + transfers + adjustments
}

