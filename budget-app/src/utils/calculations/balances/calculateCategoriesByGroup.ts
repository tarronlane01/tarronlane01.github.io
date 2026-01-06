import type { Category } from '@contexts/budget_context'

export type CategoryEntry = [string, Category]

interface CalculateCategoriesByGroupOptions {
  /** If true, include hidden categories (default: false) */
  includeHidden?: boolean
}

/**
 * Organizes categories by their group ID
 * Returns a record mapping group IDs to arrays of category entries,
 * with categories sorted by sort_order within each group
 */
export function calculateCategoriesByGroup(
  categories: Record<string, Category>,
  options?: CalculateCategoriesByGroupOptions
): Record<string, CategoryEntry[]> {
  const { includeHidden = false } = options || {}

  const result = Object.entries(categories)
    .filter(([, cat]) => includeHidden || !cat.is_hidden)
    .reduce((acc, [catId, cat]) => {
      const groupId = cat.category_group_id || 'ungrouped'
      if (!acc[groupId]) acc[groupId] = []
      acc[groupId].push([catId, cat] as CategoryEntry)
      return acc
    }, {} as Record<string, CategoryEntry[]>)

  Object.keys(result).forEach(groupId => {
    result[groupId].sort((a, b) => a[1].sort_order - b[1].sort_order)
  })

  return result
}

