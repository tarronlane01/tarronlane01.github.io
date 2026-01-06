export type DefaultAmountType = 'fixed' | 'percentage'

export interface Category {
  name: string
  description: string
  category_group_id: string | null
  sort_order: number
  default_monthly_amount: number
  default_monthly_type: DefaultAmountType
  balance: number
  /** Hidden categories are excluded from dropdowns and balance displays, shown in a collapsed section in settings */
  is_hidden?: boolean
}

export type CategoriesMap = Record<string, Category>

