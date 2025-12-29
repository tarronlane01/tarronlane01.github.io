// Category group type for budget document

// CategoryGroup - when stored as a map the key is the ID,
// when used as an array the id is included in the object
export interface CategoryGroup {
  id: string
  name: string
  sort_order: number
}

// Map of category group ID to CategoryGroup data (id is redundant but included for consistency)
export type CategoryGroupsMap = Record<string, CategoryGroup>

// Alias for backwards compatibility
export type CategoryGroupWithId = CategoryGroup

