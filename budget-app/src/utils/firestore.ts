/**
 * Firestore Utility Functions
 *
 * Utilities for preparing data to be written to Firestore.
 */

import type { FirestoreData } from '@types'

/**
 * Recursively remove undefined values from an object.
 * Firestore does not allow undefined values - they must be omitted or set to null.
 *
 * @param obj - The object to clean
 * @returns A new object with undefined values removed
 *
 * @example
 * cleanForFirestore({ a: 1, b: undefined, c: { d: 2, e: undefined } })
 * // Returns: { a: 1, c: { d: 2 } }
 */
export function cleanForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(item => cleanForFirestore(item)) as T
  }

  if (typeof obj === 'object') {
    const cleaned: FirestoreData = {}
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = cleanForFirestore(value)
      }
    }
    return cleaned as T
  }

  return obj
}

