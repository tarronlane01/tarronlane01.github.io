/**
 * Autocomplete Helper Functions
 *
 * Fuzzy search and utility functions for autocomplete components.
 */

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

