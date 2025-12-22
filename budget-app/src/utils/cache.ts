/**
 * Firebase Data Cache Utility
 *
 * Caches Firebase reads to localStorage to reduce read counts.
 * Each cached item has a timestamp and can be manually refreshed.
 */

export interface CacheEntry<T> {
  data: T
  timestamp: number
  version: number
}

// Cache version - increment this to invalidate all cached data on app updates
const CACHE_VERSION = 1

// Default TTL: 1 hour (in milliseconds)
// During development, you might want this shorter
export const DEFAULT_TTL_MS = 60 * 60 * 1000

// Cache keys
export const CACHE_KEYS = {
  USER_DOC: (userId: string) => `cache_user_${userId}`,
  BUDGET: (budgetId: string) => `cache_budget_${budgetId}`,
  MONTH: (budgetId: string, year: number, month: number) => `cache_month_${budgetId}_${year}_${month}`,
  PAYEES: (budgetId: string) => `cache_payees_${budgetId}`,
  ACCESSIBLE_BUDGETS: (userId: string) => `cache_accessible_budgets_${userId}`,
  CATEGORY_BALANCES: (budgetId: string) => `cache_category_balances_${budgetId}`,
  LAST_REFRESH: 'cache_last_refresh',
} as const

/**
 * Get data from cache
 * Returns null if not found, expired, or version mismatch
 */
export function getFromCache<T>(key: string, ttlMs: number = DEFAULT_TTL_MS): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null

    const entry: CacheEntry<T> = JSON.parse(raw)

    // Check version
    if (entry.version !== CACHE_VERSION) {
      localStorage.removeItem(key)
      return null
    }

    // Check TTL
    const age = Date.now() - entry.timestamp
    if (age > ttlMs) {
      // Expired, but don't remove - we might want to use stale data
      console.log(`[Cache] ${key} is stale (${Math.round(age / 1000)}s old)`)
      return null
    }

    console.log(`[Cache] HIT: ${key} (${Math.round(age / 1000)}s old)`)
    return entry.data
  } catch (err) {
    console.warn(`[Cache] Error reading ${key}:`, err)
    localStorage.removeItem(key)
    return null
  }
}

/**
 * Save data to cache
 */
export function saveToCache<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      version: CACHE_VERSION,
    }
    localStorage.setItem(key, JSON.stringify(entry))
    console.log(`[Cache] SAVED: ${key}`)
  } catch (err) {
    console.warn(`[Cache] Error saving ${key}:`, err)
    // If localStorage is full, try to clear old cache entries
    clearOldCacheEntries()
  }
}

/**
 * Remove a specific cache entry
 */
export function removeFromCache(key: string): void {
  localStorage.removeItem(key)
  console.log(`[Cache] REMOVED: ${key}`)
}

/**
 * Clear all cache entries for a specific budget
 */
export function clearBudgetCache(budgetId: string): void {
  const keysToRemove: string[] = []

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.includes(budgetId) && key.startsWith('cache_')) {
      keysToRemove.push(key)
    }
  }

  keysToRemove.forEach(key => localStorage.removeItem(key))
  console.log(`[Cache] Cleared ${keysToRemove.length} entries for budget ${budgetId}`)
}

/**
 * Clear all cache entries
 */
export function clearAllCache(): void {
  const keysToRemove: string[] = []

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith('cache_')) {
      keysToRemove.push(key)
    }
  }

  keysToRemove.forEach(key => localStorage.removeItem(key))
  console.log(`[Cache] Cleared all ${keysToRemove.length} cache entries`)
}

/**
 * Clear old cache entries to free up space
 */
function clearOldCacheEntries(): void {
  const entries: { key: string; timestamp: number }[] = []

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith('cache_')) {
      try {
        const raw = localStorage.getItem(key)
        if (raw) {
          const entry = JSON.parse(raw)
          entries.push({ key, timestamp: entry.timestamp || 0 })
        }
      } catch {
        // Invalid entry, remove it
        if (key) localStorage.removeItem(key)
      }
    }
  }

  // Sort by timestamp (oldest first) and remove the oldest half
  entries.sort((a, b) => a.timestamp - b.timestamp)
  const toRemove = entries.slice(0, Math.ceil(entries.length / 2))
  toRemove.forEach(e => localStorage.removeItem(e.key))

  console.log(`[Cache] Cleared ${toRemove.length} old entries to free space`)
}

/**
 * Get the timestamp of the last manual refresh
 */
export function getLastRefreshTime(): number | null {
  try {
    const raw = localStorage.getItem(CACHE_KEYS.LAST_REFRESH)
    if (!raw) return null
    return parseInt(raw, 10)
  } catch {
    return null
  }
}

/**
 * Update the last refresh timestamp
 */
export function setLastRefreshTime(): void {
  localStorage.setItem(CACHE_KEYS.LAST_REFRESH, Date.now().toString())
}

/**
 * Get cache stats for debugging
 */
export function getCacheStats(): { count: number; totalSize: number; entries: { key: string; size: number; age: string }[] } {
  const entries: { key: string; size: number; age: string }[] = []
  let totalSize = 0

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith('cache_')) {
      const raw = localStorage.getItem(key) || ''
      const size = raw.length * 2 // Approximate bytes (UTF-16)
      totalSize += size

      let age = 'unknown'
      try {
        const entry = JSON.parse(raw)
        const ageMs = Date.now() - entry.timestamp
        if (ageMs < 60000) {
          age = `${Math.round(ageMs / 1000)}s`
        } else if (ageMs < 3600000) {
          age = `${Math.round(ageMs / 60000)}m`
        } else {
          age = `${Math.round(ageMs / 3600000)}h`
        }
      } catch { /* ignore */ }

      entries.push({ key, size, age })
    }
  }

  return { count: entries.length, totalSize, entries }
}

