export type DefaultAmountType = 'fixed' | 'percentage'

export interface Category {
  name: string
  description: string
  category_group_id: string | null
  sort_order: number
  default_monthly_amount: number
  default_monthly_type: DefaultAmountType
  balance: number
}

export type CategoriesMap = Record<string, Category>

