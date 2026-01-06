/**
 * Autocomplete Helper Functions
 *
 * Fuzzy search, sorting, and utility functions for autocomplete components.
 * Sorting matches the order used on budget category/account pages.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface AutocompleteItem {
  id: string
  name: string
  groupId: string | null
  groupName: string | null
  sortOrder: number
  groupSortOrder: number
}

export interface GroupedItems<T extends AutocompleteItem> {
  groupId: string | null
  groupName: string | null
  groupSortOrder: number
  items: T[]
}

// =============================================================================
// FUZZY SEARCH
// =============================================================================

// Fuzzy search - matches if all characters appear in order (case insensitive)
// Also matches if query appears anywhere in the string
export function fuzzyMatch(query: string, target: string): { match: boolean; score: number } {
  const lowerQuery = query.toLowerCase()
  const lowerTarget = target.toLowerCase()

  // Direct substring match (highest priority)
  if (lowerTarget.includes(lowerQuery)) {
    const index = lowerTarget.indexOf(lowerQuery)
    // Prefer matches at word boundaries
    const atWordStart = index === 0 || /\s/.test(lowerTarget[index - 1])
    return { match: true, score: atWordStart ? 100 : 90 }
  }

  // Fuzzy match - characters in order
  let queryIndex = 0
  let score = 0
  let consecutiveMatches = 0

  for (let i = 0; i < lowerTarget.length && queryIndex < lowerQuery.length; i++) {
    if (lowerTarget[i] === lowerQuery[queryIndex]) {
      queryIndex++
      consecutiveMatches++
      score += consecutiveMatches * 2 // Reward consecutive matches
    } else {
      consecutiveMatches = 0
    }
  }

  if (queryIndex === lowerQuery.length) {
    return { match: true, score }
  }

  return { match: false, score: 0 }
}

// =============================================================================
// SORTING - Matches budget pages (groups by sort_order, items by sort_order within group)
// =============================================================================

/**
 * Sort items by group sort_order, then by item sort_order within group.
 * Ungrouped items appear at the end.
 */
export function sortItemsByGroup<T extends AutocompleteItem>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    // Ungrouped items go to the end
    if (!a.groupId && b.groupId) return 1
    if (a.groupId && !b.groupId) return -1

    // If both ungrouped, sort by item sort_order
    if (!a.groupId && !b.groupId) {
      return a.sortOrder - b.sortOrder
    }

    // Sort by group sort_order first
    if (a.groupSortOrder !== b.groupSortOrder) {
      return a.groupSortOrder - b.groupSortOrder
    }

    // Within same group, sort by item sort_order
    return a.sortOrder - b.sortOrder
  })
}

/**
 * Group items by their groupId while maintaining sort order.
 * Returns groups sorted by groupSortOrder, with items sorted by sortOrder within each group.
 */
export function groupItemsForDisplay<T extends AutocompleteItem>(items: T[]): GroupedItems<T>[] {
  // First sort items
  const sortedItems = sortItemsByGroup(items)

  // Group them while maintaining order
  const groups: GroupedItems<T>[] = []
  let currentGroupId: string | null = '__initial__'

  sortedItems.forEach(item => {
    if (item.groupId !== currentGroupId) {
      currentGroupId = item.groupId
      groups.push({
        groupId: item.groupId,
        groupName: item.groupName,
        groupSortOrder: item.groupSortOrder,
        items: [],
      })
    }
    groups[groups.length - 1].items.push(item)
  })

  return groups
}

/**
 * Filter items by search query, then sort by relevance score.
 * Falls back to standard sort order when scores are equal.
 */
export function filterAndSortItems<T extends AutocompleteItem>(
  items: T[],
  query: string,
  getSearchTargets: (item: T) => string[]
): T[] {
  if (!query.trim()) {
    return sortItemsByGroup(items)
  }

  // Score each item
  const scoredItems = items.map(item => {
    const targets = getSearchTargets(item)
    let bestScore = 0
    let hasMatch = false

    for (const target of targets) {
      const result = fuzzyMatch(query, target)
      if (result.match) {
        hasMatch = true
        bestScore = Math.max(bestScore, result.score)
      }
    }

    return { item, score: bestScore, hasMatch }
  })

  // Filter to matches only, sort by score then by standard order
  return scoredItems
    .filter(({ hasMatch }) => hasMatch)
    .sort((a, b) => {
      // Higher score first
      if (b.score !== a.score) return b.score - a.score
      // Fall back to standard sort order
      if (!a.item.groupId && b.item.groupId) return 1
      if (a.item.groupId && !b.item.groupId) return -1
      if (a.item.groupSortOrder !== b.item.groupSortOrder) {
        return a.item.groupSortOrder - b.item.groupSortOrder
      }
      return a.item.sortOrder - b.item.sortOrder
    })
    .map(({ item }) => item)
}

// Dropdown styles shared between autocomplete components
export const dropdownContainerStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  marginTop: '4px',
  background: 'var(--background, #1a1a1a)',
  border: '1px solid color-mix(in srgb, currentColor 20%, transparent)',
  borderRadius: '6px',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
  zIndex: 1000,
}

export const suggestionItemStyle: React.CSSProperties = {
  padding: '0.6rem 0.8rem',
  cursor: 'pointer',
  transition: 'background 0.1s',
}

